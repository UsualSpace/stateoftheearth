import { Vector3 } from "three";

const AtmosphereShader = {

	name: 'AtmosphereShader',

	uniforms: {

		'tDiffuse': { value: null },
		'raymarch_steps': { value: 32 },
        'rayleigh_coefficients': { value: new Vector3(5.3, 13.5, 33.1) },
        'mie_coefficients': { value: new Vector3(1.0, 1.0, 1.0) },
        'planet_radius': { value: 6315.0 },
        'camera_position': { value: new Vector3(0, 0, 0) },
        'depth_texture': { value: null },
        'projection_matrix_inverse': { value: null },
        'view_matrix_inverse': { value: null },
        'light_direction': { value: new Vector3(1, 0 ,0) },
        'air_scale_height': {value: 8.5},
        'aerosol_scale_height': {value: 10.0}
	},

	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,

	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
        uniform sampler2D depth_texture;
        uniform int raymarch_steps;
        uniform vec3 rayleigh_coefficients;
        uniform vec3 mie_coefficients;
        uniform float air_scale_height;
        uniform float aerosol_scale_height;
        uniform float planet_radius;
        uniform vec3 camera_position;
        uniform mat4 projection_matrix_inverse;
        uniform mat4 view_matrix_inverse;
        uniform vec3 light_direction;

		varying vec2 vUv;

        struct Radiance {
            vec3 in_scattering;
            vec3 transmittance;
        };

        struct AtmosphereProfile {
            float planet_radius;
            float air_scale_height;
            float aerosol_scale_height;
            vec3 rayleigh_scattering_coefficients;
            vec3 mie_scattering_coefficients;
        };

        vec2 RaySphereIntersect(vec3 ray_origin, vec3 ray_direction, float sphere_radius) {
            float a = dot(ray_direction, ray_direction);
            float b = 2.0 * dot(ray_direction, ray_origin);
            float c = dot(ray_origin, ray_origin) - (sphere_radius * sphere_radius);
            float d = (b * b) - 4.0 * a * c;
            if (d < 0.0) return vec2(0.0);
            float sqrt_d = sqrt(d);
            float distance_to_sphere = max((-b - sqrt_d) / (2.0 * a), 0.0);
            float distance_through_sphere = (-b + sqrt_d) / (2.0 * a);
            if(distance_to_sphere > distance_through_sphere) return vec2(0.0); 
            return vec2(distance_to_sphere, distance_through_sphere);
        }

        float GetAirDensityAtPoint(vec3 point, AtmosphereProfile profile) {
            float height_above_surface = max(length(point) - profile.planet_radius, 0.0); //Make sure height above surface isn't ever below zero.
            return exp(-height_above_surface / profile.air_scale_height);
        }

        float GetAerosolDensityAtPoint(vec3 point, AtmosphereProfile profile) {
            float height_above_surface = max(length(point) - profile.planet_radius + 66.0, 0.0); //Make sure height above surface isn't ever below zero.
            return exp(-height_above_surface / profile.aerosol_scale_height);
        }

        //https://books.google.co.uk/books?id=epxYDwAAQBAJ&pg=PA175#v=onepage&q&f=false
        //Do not fully understand this approximation yet but overall understand what the chapman
        //function is meant to solve. Essentially approximates the accumulated airmass
        //along a ray through an atmosphere, without numerical integration. This will allow us to eliminate the inner light marching loop, optimizing the atmospheric raymarching process.
        float ChapmanApproximation(float X, float h, float cos_chi) {
            float c = sqrt(X + h);
            if(cos_chi >= 0.0) {
                return c / (c * cos_chi + 1.0) * exp(-h);
            } 
            float x0 = sqrt(1.0 - cos_chi * cos_chi) * (X + h);
            float c0 = sqrt(x0);
            return 2.0 * c0 * exp(X - x0) - c / (1.0 - c * cos_chi) * exp(-h);
        }

        vec3 GetAirTransmittanceAlongRay(vec3 ray_origin, vec3 ray_direction, AtmosphereProfile profile) {
            float height_above_surface = length(ray_origin) - profile.planet_radius;
            vec3 zenith_vector = normalize(ray_origin);
            float zenith_angle = dot(zenith_vector, (ray_direction));
            return exp(-profile.rayleigh_scattering_coefficients * profile.air_scale_height * ChapmanApproximation(profile.planet_radius / profile.air_scale_height, height_above_surface / profile.air_scale_height, zenith_angle));
        }

        vec3 GetAerosolTransmittanceAlongRay(vec3 ray_origin, vec3 ray_direction, AtmosphereProfile profile) {
            float height_above_surface = length(ray_origin) - profile.planet_radius;
            vec3 zenith_vector = normalize(ray_origin);
            float zenith_angle = dot(zenith_vector, (ray_direction));
            return exp(-profile.mie_scattering_coefficients * profile.aerosol_scale_height * ChapmanApproximation(profile.planet_radius / profile.aerosol_scale_height, height_above_surface / profile.aerosol_scale_height, zenith_angle));
        }

        float GetRayleighPhase(float mu) {
            return 3.0 / (50.2654824574) * (1.0 + mu * mu);
        }

        float GetMiePhase(float mu, float g) {
            return max(3.0 / (25.1327412287) * ((1.0 - g * g) * (mu * mu + 1.0)) / (pow(1.0 + g * g - 2.0 * mu * g, 1.5) * (2.0 + g * g)), 0.0);
        }

        Radiance GetAtmosphereRadianceToPoint(vec3 start_point, vec3 end_point, vec3 light_vector, int steps, AtmosphereProfile profile) {
            vec3 ray_direction = normalize(end_point - start_point);
            vec3 ray_origin = start_point;
            float step_size = length(end_point - start_point) / float(steps);

            float t = 0.0;

            Radiance result = Radiance(vec3(0.0), vec3(1.0));
            float mu = dot(ray_direction, light_vector);
            float r_phase = GetRayleighPhase(mu);
            float m_phase = GetMiePhase(mu, 0.9);

            vec3 LT;

            for(int i = 0; i < steps; ++i) {
                vec3 point = ray_origin + ray_direction * (t + step_size * 0.5);
                vec3 rS = GetAirDensityAtPoint(point, profile) * profile.rayleigh_scattering_coefficients;
                vec3 aS = GetAirDensityAtPoint(point, profile) * vec3(0.1, 0.2, 0.9);
                vec3 mS = GetAerosolDensityAtPoint(point, profile) * profile.mie_scattering_coefficients;
                vec3 E = rS + mS;

                if(length(E) > 0.0) {
                    vec3 sample_transmittance = exp(-E * step_size);
                    LT = GetAirTransmittanceAlongRay(point, light_vector, profile) * GetAerosolTransmittanceAlongRay(point, light_vector, profile);
                    vec3 sample_radiance = (rS * r_phase + mS * m_phase * 100.0) * LT + aS * 0.2;
                    vec3 integrate = (sample_radiance - sample_radiance * sample_transmittance) / max(E, vec3(0.00000001));
                    result.in_scattering += result.transmittance * integrate;
                    result.transmittance *= sample_transmittance;
                }
                
                t += step_size;
            }

            //result.transmittance *= (LT);
            return result;
        }

        vec3 worldCoordinatesFromDepth(float depth) {
            float z = depth * 2.0 - 1.0;
        
            vec4 clipSpaceCoordinate = vec4(vUv * 2.0 - 1.0, z, 1.0);
            vec4 viewSpaceCoordinate = projection_matrix_inverse * clipSpaceCoordinate;
        
            viewSpaceCoordinate /= viewSpaceCoordinate.w;
        
            vec4 worldSpaceCoordinates = view_matrix_inverse * viewSpaceCoordinate;
        
            return worldSpaceCoordinates.xyz;
        }

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
            vec4 depth = texture2D(depth_texture, vUv);
			
            vec3 world_position = worldCoordinatesFromDepth(depth.x);
            vec3 ray_origin = camera_position;
            vec3 ray_direction = normalize(world_position - camera_position);
            
            vec2 intersect = RaySphereIntersect(ray_origin, ray_direction, planet_radius + 110.0);

            vec3 color = texel.xyz;
            if(intersect.y >= 0.0) {
                AtmosphereProfile profile;
                profile.planet_radius = planet_radius;
                profile.air_scale_height = air_scale_height;
                profile.aerosol_scale_height = aerosol_scale_height;
                profile.rayleigh_scattering_coefficients = rayleigh_coefficients;
                profile.mie_scattering_coefficients = mie_coefficients;

                float pdistance = distance(ray_origin, world_position);
                vec3 start = ray_origin + ray_direction * intersect.x;
                vec3 end = ray_origin + ray_direction * min(intersect.y, pdistance);
                Radiance radiance = GetAtmosphereRadianceToPoint(start, end, normalize(light_direction), raymarch_steps, profile);

                color = texel.xyz * radiance.transmittance + radiance.in_scattering * 10.0;
            } 

            gl_FragColor = 1.0 - exp(-vec4(color, 1.0));
		}`

};

export { AtmosphereShader };