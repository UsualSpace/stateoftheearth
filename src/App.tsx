import { useRef, useEffect } from 'react';
import './App.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { AtmosphereShader } from './shaders/atmosphere';
import { EarthShader } from './shaders/earth';
import { MarkerShader } from './shaders/marker';
import { MarkersScreenShader } from './shaders/markersScreenShader';
import { getEarthRotationAngle, getJulianDate } from './astronomical_utils';
import { degToRad } from 'three/src/math/MathUtils.js';

type AirCraftData = {
  icao24: string;
  longitude: number;
  latitude: number;
  altitude: number;
};

function App() {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aviationRef = useRef(new Map<string, AirCraftData>())

  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_STATEOFTHEEARTH_API_URL}/events`);
    console.log("Registered aviation stream")
        
    //Listen for messages from server.
    eventSource.addEventListener("aviation_data", (event: MessageEvent) => {
      console.log("received aviation data")
      const delta = JSON.parse(event.data);
      
      for(const aircraft of delta.create) aviationRef.current.set(aircraft.icao24, aircraft);
      for(const aircraft of delta.update) aviationRef.current.set(aircraft.icao24, aircraft);
      for(const icao24 of delta.delete) aviationRef.current.delete(icao24);

    });

    //Log connection error
    eventSource.onerror = function(event) {
        console.log('Error occurred:', event);
    };
  }, []);

  //Renderer setup.
  useEffect(() => {
    if(!canvasRef.current) return;

    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1000.0, 1000000 );
    camera.position.set(0, 0, 10000);
    const controls = new OrbitControls( camera, canvasRef.current );
    controls.minDistance = 7000;
    controls.target.set(0, 0, 0)
    controls.update();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      logarithmicDepthBuffer: true,
    });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
      renderer.setPixelRatio(window.devicePixelRatio);
      composer.setSize(width, height);
    }

    window.addEventListener('resize', resize);
   
    const depthRT = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false,
            depthBuffer: true,
            depthTexture: new THREE.DepthTexture(window.innerWidth, window.innerHeight)
        },
    );

    const markersRT = new THREE.WebGLRenderTarget(
        window.innerWidth,
        window.innerHeight,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false,
            depthBuffer: false,
        },
    );

    const composer = new EffectComposer(renderer);

    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.DirectionalLight();
    light.position.set(0, 0, -1);

    const geometry = new THREE.SphereGeometry(6371, 500, 500);
    const globeMaterial = new THREE.ShaderMaterial(EarthShader);
    const globe = new THREE.Mesh( geometry, globeMaterial );

    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const markerMaterial = new THREE.ShaderMaterial(MarkerShader);
    markerMaterial.transparent = true;
    markerMaterial.blending = THREE.AdditiveBlending;
    markerMaterial.depthWrite = false;
    const markers = new THREE.InstancedMesh(planeGeometry, markerMaterial, 30000);

    function LLAToECEF(latDeg: number, lonDeg: number, altKm: number): THREE.Vector3 {
      const R = 6371 + altKm;

      const lat = latDeg * Math.PI / 180;
      const lon = (lonDeg - 180) * Math.PI / 180;

      return new THREE.Vector3(
          -R * Math.cos(lat) * Math.cos(lon),
          R * Math.sin(lat),
          R * Math.cos(lat) * Math.sin(lon)
      );
    }

    //FOR TESTING
    // function randomAircraftPosition() {
    //   return {
    //     lat: Math.random() * 180 - 90,
    //     lon: Math.random() * 360 - 180,
    //     alt: 11 + (Math.random() - 0.5) * 2 // 10-12 km centered at 11
    //   };
    // }

    // for(let i = 0; i < 500; ++i) {
    //   const p = randomAircraftPosition();
    //   const t = LLAToECEF(p.lat, p.lon, p.alt);
    //   const m = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(t), new THREE.Matrix4().makeScale(100.0, 100.0, 100.0));
    //   markers.setMatrixAt(i, m);
    // }

    const markersScene = new THREE.Scene();
    markersScene.add(markers)

    const scene = new THREE.Scene();
    scene.add(globe);
    scene.add(light);

    const atmospherePass = new ShaderPass(AtmosphereShader);
    atmospherePass.uniforms.depth_texture.value = depthRT.depthTexture;
    atmospherePass.uniforms.projection_matrix_inverse.value = camera.projectionMatrixInverse;
    atmospherePass.uniforms.view_matrix_inverse.value = camera.matrixWorld;
    atmospherePass.uniforms.camera_position.value = camera.position;
    atmospherePass.uniforms.light_direction.value = light.position;

    const markersPass = new ShaderPass(MarkersScreenShader);
    markersPass.uniforms.markers_texture.value = markersRT.texture;
    markersPass.uniforms.depth_texture.value = depthRT.depthTexture;
    markersPass.uniforms.projection_matrix_inverse.value = camera.projectionMatrixInverse;
    markersPass.uniforms.view_matrix_inverse.value = camera.matrixWorld;
    markersPass.uniforms.camera_position.value = camera.position;

    const scenePass = new RenderPass(scene, camera); 

    composer.addPass(scenePass);
    composer.addPass(atmospherePass);
    composer.addPass(markersPass);

    

    renderer.setClearColor(0, 0);

    const tiltQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -degToRad(23.439281)
    );

    function animate(time: number) {
      controls.update();
      globeMaterial.uniforms.light_direction.value = light.position;
      globeMaterial.uniforms.time.value = time;


      const spinQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (getEarthRotationAngle(getJulianDate()) - Math.PI / 16.0)
      );

      // Earth orientation only
      globe.quaternion.copy(tiltQ).multiply(spinQ);
      markers.quaternion.copy(globe.quaternion);

      //Read in latest aircraft positions every frame.
      //TODO: handle many other types of data (maritime, satellite, etc.)
      let i = 0;
      for(const aircraft of aviationRef.current.values()) {
        const position = LLAToECEF(aircraft.latitude, aircraft.longitude, aircraft.altitude / 1000);
        markers.setMatrixAt(i, new THREE.Matrix4().makeTranslation(position));
        ++i;
      }
      markers.instanceMatrix.needsUpdate = true;

      //if(aviationRef.current.size > 0) console.log(aviationRef.current)

      //Render standard scene
      renderer.setRenderTarget(depthRT);
      renderer.render(scene, camera);

      //Render markers.
      renderer.setRenderTarget(markersRT);
      renderer.clearColor();
      renderer.render(markersScene, camera);
      renderer.setRenderTarget(null);

      composer.render();
    }

    requestAnimationFrame(() => {
      resize();
    });
    renderer.setAnimationLoop( animate );

  }, [canvasRef.current]);



  return (
    <div id="main-container">
      <canvas id="main-canvas" ref={canvasRef}>
        Failed to load canvas...
      </canvas>
    </div>
  );
}

export default App;
