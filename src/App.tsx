import { useState, useRef, useEffect } from 'react';
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

function App() {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  //Renderer setup.
  useEffect(() => {
    if(!canvasRef.current) return;

    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1000.0, 1000000 );
    camera.position.set(0, 0, 10000);
    const controls = new OrbitControls( camera, canvasRef.current );
    controls.target.set(0, 0, 0)
    controls.update();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      logarithmicDepthBuffer: true,
    });

   
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
            type: THREE.FloatType,
            stencilBuffer: false,
            depthBuffer: false,
        },
    );

    const composer = new EffectComposer(renderer);

    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.DirectionalLight()

    const geometry = new THREE.SphereGeometry(6371, 500, 500);
    const globeMaterial = new THREE.ShaderMaterial(EarthShader);
    const globe = new THREE.Mesh( geometry, globeMaterial );

    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const markerMaterial = new THREE.ShaderMaterial(MarkerShader);
    markerMaterial.transparent = true;
    markerMaterial.blending = THREE.AdditiveBlending;
    markerMaterial.depthWrite = false;
    const markers = new THREE.InstancedMesh(planeGeometry, markerMaterial, 10000);

    function randomAircraftPosition() {
      return {
        lat: Math.random() * 180 - 90,
        lon: Math.random() * 360 - 180,
        alt: 11 + (Math.random() - 0.5) * 2 // 10-12 km centered at 11
      };
    }

    function latLonAltToECEF(latDeg: number, lonDeg: number, altKm: number): THREE.Vector3 {
      const R = 6371 + altKm;

      const lat = latDeg * Math.PI / 180;
      const lon = lonDeg * Math.PI / 180;

      return new THREE.Vector3(
          R * Math.cos(lat) * Math.cos(lon),
          R * Math.sin(lat),
          R * Math.cos(lat) * Math.sin(lon)
      );
    }

    for(let i = 0; i < 500; ++i) {
      const p = randomAircraftPosition();
      const t = latLonAltToECEF(p.lat, p.lon, p.alt);
      const m = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(t), new THREE.Matrix4().makeScale(100.0, 100.0, 100.0));
      markers.setMatrixAt(i, m);
    }

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

    function animate(time: number) {
      controls.update();
      const angle = 0.0;// time * 0.001;
      light.position.set(Math.cos(angle), 0.0, Math.sin(angle))
      globeMaterial.uniforms.light_direction.value = light.position;
      globeMaterial.uniforms.time.value = time;

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
