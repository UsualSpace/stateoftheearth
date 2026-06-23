const MarkersScreenShader = {

    name: 'MarkersScreenShader',

    uniforms: {
        'tDiffuse': { value: null },
        'markers_texture': {value: null},
        'depth_texture': { value: null },
        'projection_matrix_inverse': { value: null },
        'view_matrix_inverse': { value: null },
        'camera_position': {value: null}
    },

    vertexShader: /* glsl */`
        varying vec2 texcoord;
        void main() {
            texcoord = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform sampler2D markers_texture;
        varying vec2 texcoord;
        uniform sampler2D depth_texture;
        uniform mat4 projection_matrix_inverse;
        uniform mat4 view_matrix_inverse;
        uniform vec3 camera_position;

        void main() {
            vec4 scene_color = texture2D(tDiffuse, texcoord);
            vec4 markers = texture2D(markers_texture, texcoord);

            vec3 color = mix(scene_color.xyz, 1.0 - scene_color.xyz * 1.0, markers.x);

            gl_FragColor = vec4(color, 1.0);
        }`

};

export { MarkersScreenShader };