import { SRGBColorSpace, TextureLoader, Vector3 } from "three";

const loader = new TextureLoader();
const albedo = loader.load('/8k_earth_daymap.jpg');
const normal = loader.load('/8k_earth_normal_map.jpg');
const specular = loader.load('/8k_earth_specular_map.jpg');
const night = loader.load('/8k_earth_nightmap.jpg');
const clouds = loader.load('/8k_earth_clouds.jpg');

albedo.colorSpace = SRGBColorSpace;
night.colorSpace = SRGBColorSpace;
clouds.colorSpace = SRGBColorSpace;

const EarthShader = {
    name: "EarthShader",

    uniforms: {
        earth_albedo: {value: albedo},
        earth_specular: {value: specular},
        earth_normal: {value: normal},
        earth_albedo_night: {value: night},
        earth_clouds: {value: clouds},
        light_direction: {value: new Vector3(1, 0, 0)}
    },

    vertexShader: `
    varying vec2 texcoord;
    varying vec3 world_position;
    varying vec3 vnormal;
    void main() {
        texcoord = uv;
        vnormal = normal;
        vec4 vposition = modelMatrix * vec4(position, 1.0);
        world_position = vposition.xyz;
        gl_Position = projectionMatrix * viewMatrix * vposition;
    }`,
    fragmentShader: `
    varying vec2 texcoord;
    varying vec3 world_position;
    varying vec3 vnormal;
    uniform sampler2D earth_albedo;
    uniform sampler2D earth_specular;
    uniform sampler2D earth_normal;
    uniform sampler2D earth_albedo_night;
    uniform sampler2D earth_clouds;

    uniform vec3 light_direction;

    const float PI = 3.14159265359;

    vec3 schlickFresnel(float vdotH) {
        return vec3(0.04) + (1.0 - vec3(0.04)) * pow(clamp(1.0 - vdotH, 0.0, 1.0), 5.0);
    }

    float ggxDistribution(float nDotH, float roughness) {
        float alpha2 = pow(roughness, 4.0);
        float d = nDotH * nDotH * (alpha2 - 1.0) + 1.0;
        return alpha2 / (PI * d * d);
    }

    float geomSmith(float dp, float roughness) {
        float k = pow(roughness + 1.0, 2.0) / 8.0;
        float denom = dp * (1.0 - k) + k;
        return dp / denom;
    }

    float GetMiePhase(float mu, float g) {
        return max(3.0 / (25.1327412287) * ((1.0 - g * g) * (mu * mu + 1.0)) / (pow(1.0 + g * g - 2.0 * mu * g, 1.5) * (2.0 + g * g)), 0.0);
    }
    
    void main() {
        vec3 albedo = clamp(texture2D(earth_albedo, texcoord).xyz, 0.0, 1.0);
        float roughness = mix(0.5, 1.0, 1.0 - texture2D(earth_specular, texcoord).x);
        vec3 normal = (texture2D(earth_normal, texcoord).xyz * 2.0 - 1.0) * vec3(1, 1, 1);
        vec3 albedo_night = clamp(texture2D(earth_albedo_night, texcoord).xyz, 0.0, 1.0);
        float clouds = clamp(texture2D(earth_clouds, texcoord).x * 1.0, 0.0, 1.0);
        
        vec3 N = normalize(vnormal);
        vec3 T = normalize(cross(N, vec3(0, 1, 0)));
        vec3 B = normalize(cross(N, T));
        mat3 TBN = mat3(T, B, N);

        vec3 l = normalize(light_direction);
        vec3 n = normalize(TBN * normal);
        vec3 v = normalize(cameraPosition - world_position);
        vec3 h = normalize(v + l);

        float nDotL = max(dot(l, n), 0.0);
        float vDotH = max(dot(v, h), 0.0);
        float nDotH = max(dot(n, h), 0.0);
        float nDotV = max(dot(n, v), 0.0);

        vec3 F = schlickFresnel(vDotH);
        vec3 kS = F;
        vec3 kD = 1.0 - kS;

        vec3 specular_brdf_numerator = ggxDistribution(nDotH, roughness) * F * geomSmith(nDotL, roughness) * geomSmith(nDotV, roughness);

        float specular_brdf_denominator = 4.0 * nDotV * nDotL + 0.0001;

        vec3 specular_brdf = specular_brdf_numerator / specular_brdf_denominator;

        
        vec2 cloudshadow_uvs = vec2(1.0);
        float cloudshadow = clamp(texture2D(earth_clouds, texcoord).x * 10.0, 0.0, 1.0);

        vec3 diffuse_brdf = kD * albedo / PI;

        vec3 color = (diffuse_brdf + specular_brdf) * nDotL * 10.0 * (1.0 - clouds) + albedo_night * pow((1.0 - nDotL), 3.0) * (1.0 - clouds) + mix(vec3(0.02), vec3(1.0), max(dot(N, l), 0.0)) * clouds * 4.0;

        gl_FragColor = (vec4(mix(color, vec3(length(color)), 0.3), 1.0));
    }`
}

export { EarthShader }