export default `
precision highp float;

// Fragment shader output
out vec4 outFragColor;

in vec3 vNormalWS;
in vec3 ViewDirectionWS;

// Uniforms
struct Material
{
  vec3 albedo;
};

struct Light{
  vec3 pos;
  vec3 color;
  float intensity;
};

uniform Material uMaterial;
// uniform Light uLights[3];
uniform Light uLights[2];

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

void main()
{

  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  // **DO NOT** forget to apply gamma correction as last step.
  outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));

  for (int i = 0; i < 1; i++){
    vec3 to_light = normalize(uLights[i].pos - gl_FragCoord.xyz);
    float d = length(to_light);
    float light_attenuation = clamp(10./d,0.,1.);
    outFragColor.rgba = outFragColor.rgba * light_attenuation;
  }
  
}
`;
