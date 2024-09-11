export default `
precision highp float;

// Fragment shader output
out vec4 outFragColor;

in vec3 vNormalWS;
in vec3 ViewDirectionWS;
in vec4 vWorldPos;

// Uniforms
struct Material
{
  vec3 albedo;
};

struct PointLight{
  vec3 pos;
  vec3 color;
  float intensity;
};

struct DirectLight{
  vec3 dir;
  vec3 color;
  float intensity;
};

uniform Material uMaterial;
uniform PointLight uPointLights[2];
uniform DirectLight uDirectLights[2];

float pi = 3.14;

vec3 calcPointLight(int i)
{
  vec3 to_light = uPointLights[i].pos - vWorldPos.xyz;
  float d = length(to_light);
  to_light = (normalize(to_light) + 1.0) / 2.0;
  vec3 col = uPointLights[i].color* uPointLights[i].intensity * max(dot(vNormalWS,to_light),0.0); //calcLight(uLights[i], to_light);
  float light_attenuation  = 4.0 * pi * d * d;
  return col / light_attenuation;
}

vec3 calcDirectLight(int i){
  return uDirectLights[i].color * max(uDirectLights[i].intensity * dot(vNormalWS, -uDirectLights[i].dir),0.0); 
}

vec3 tone_mapping(vec3 col){
  return col / (col + 1.0);
}

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
  // outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));

  vec3 tot_col = vec3(0.0);
  for (int i = 0; i < 1; i++){
    vec3 tmp = albedo * calcPointLight(i);
    tot_col += tmp;
  }
  tot_col = tone_mapping(tot_col);
  outFragColor.rgba = LinearTosRGB(vec4(tot_col, 1.0));
  
}
`;
