import { TextureLoader } from "three";

const loader = new TextureLoader();
const markerIcon = loader.load('/marker_icon.png');

const MarkerShader = {
    name: "MarkerShader",
    uniforms: {
        marker_icon_texture: {value: markerIcon},
        scene_depth_texture: {value: null},
        time: {value: 0.0}
    },
    vertexShader: `
    varying vec2 texcoord;
    varying vec3 world_position;

    void main() {
        texcoord = uv;

        world_position = instanceMatrix[3].xyz;
        vec4 view_position = viewMatrix * vec4(world_position, 1.0);
        
        float scale = 0.04;
        vec3 sphnormal = normalize(world_position);
        float visibility = max(dot(-normalize(world_position - cameraPosition), sphnormal), 0.0) * 10.0;
        scale *= clamp(visibility, 0.0, 1.0);

        float size = scale * -view_position.z;

        vec3 pos = view_position.xyz;
        pos.xy += position.xy * size;

        gl_Position = projectionMatrix * vec4(pos, 1.0);
    }`,
    fragmentShader: `
    varying vec2 texcoord;
    varying vec3 world_position;
    uniform sampler2D marker_icon_texture;
    uniform float time;
    const float PI = 3.14159265359;
    void main() {
        float theta = PI / 4.0;
        float costh = cos(theta);
        float sinth = sin(theta);
        mat2 rot = mat2(costh, sinth, -sinth, costh); 
        vec2 uv = rot * (texcoord - 0.5) + 0.5;
        float marker = texture2D(marker_icon_texture, uv).w * 1.0;
        gl_FragColor = vec4(marker);
    }`
}

export { MarkerShader };