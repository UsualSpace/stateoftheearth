import { useState, useRef, useEffect } from 'react';
import './App.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AtmosphereShader } from './shaders/atmosphere';
import { EarthShader } from './shaders/earth';

function App() {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  //Renderer setup.
  useEffect(() => {
    if(!canvasRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1000.0, 1000000 );
    camera.position.set(0, 0, 30000);
    const controls = new OrbitControls( camera, canvasRef.current );
    controls.target.set(0, 0, 0)
    controls.update();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      logarithmicDepthBuffer: true
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace
    const composer = new EffectComposer(renderer);

    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.SphereGeometry(6371, 500, 500);
    const material = new THREE.ShaderMaterial(EarthShader);
    const globe = new THREE.Mesh( geometry, material );
    scene.add( globe );

    const light = new THREE.DirectionalLight()
    scene.add(light)

    const target = new THREE.WebGLRenderTarget(
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

    composer.addPass(new RenderPass(scene, camera));
    const atmospherePass = new ShaderPass(AtmosphereShader);
    atmospherePass.uniforms.depth_texture.value = target.depthTexture;
    atmospherePass.uniforms.projection_matrix_inverse.value = camera.projectionMatrixInverse;
    atmospherePass.uniforms.view_matrix_inverse.value = camera.matrixWorld;
    atmospherePass.uniforms.camera_position.value = camera.position;
    atmospherePass.uniforms.light_direction.value = light.position;
    composer.addPass(atmospherePass);
    // composer.addPass(
    //   new UnrealBloomPass(
    //     new THREE.Vector2(window.innerWidth, window.innerHeight),
    //     1.5,
    //     0.4,
    //     0.85
    //   )
    // );

    function animate( time: number ) {
      controls.update();
      const angle = 0.0;//time * 0.0001;
      light.position.set(Math.cos(angle), 0.0, Math.sin(angle))
      material.uniforms.light_direction = { value: light.position }
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
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
