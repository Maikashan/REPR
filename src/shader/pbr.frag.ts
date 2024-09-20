export default `
precision highp float;

#define M_PI 3.1415926535897932384626433832795

// Fragment shader output
out vec4 outFragColor;

in vec3 vNormalWS;
in vec3 ViewDirectionWS;
in vec3 vWorldPos;

// Uniforms
struct Material
{
  vec3 albedo;
  float roughness;
  float metalness;
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
uniform PointLight uPointLights[4];
uniform DirectLight uDirectLights[2];


vec3 calcPointLight(vec3 to_light, float d, int i)
{
  vec3 col = uPointLights[i].color* uPointLights[i].intensity;// * max(dot(vNormalWS,to_light),0.0); //calcLight(uLights[i], to_light);
  float light_attenuation  = 4.0 * M_PI * d * d;
  return col / light_attenuation;
}

vec3 calcDirectLight(vec3 to_light, int i){
  return uDirectLights[i].color * uDirectLights[i].intensity;
}

vec3 tone_mapping(vec3 col){
  return col / (col + 1.0);
}

vec3 diffuse_component(vec3 albedo){
  return albedo / M_PI;
}

vec3 fresnel_shlick(vec3 f0, vec3 w_i, vec3 w_o){
  vec3 h = (w_i + w_o) /length(w_i + w_o) ;
  float WOdotH = dot(w_o, h);
  return f0 + (1.0 - f0) * pow(1.0 - WOdotH, 5.0);
}

float G_shlick(vec3 v,float k){
  return dot(vNormalWS, v) / (dot(vNormalWS, v) * (1.0-k) + k);
}

float shadowing_shlick(vec3 w_i,vec3 w_o){
  float k = pow(uMaterial.roughness + 1.0,2.0) / 8.0;
  float res = G_shlick(w_o, k) * G_shlick(w_i,k);
  return res,1.0;
}

float normalDistribFunction(vec3 w_i, vec3 w_o){
  vec3 h = normalize(w_i + w_o);
  float alpha2 = pow(uMaterial.roughness, 2.0);
  float NdotH = dot(vNormalWS, h);
  return  alpha2 / (M_PI * pow(pow(NdotH,2.0) *(alpha2- 1.0) + 1.0,2.0));
}

float specular_component(vec3 w_i,vec3 w_o){
  float num = shadowing_shlick(w_i,w_o)* normalDistribFunction(w_i, w_o);
  float denum = 4.0 * dot(w_o, vNormalWS) * dot(w_i, vNormalWS);
  return  num / denum;
}

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}


// Demander au prof si c'est normal si metalness == 0 et roughness == 0 -> noir
vec3 pointLight(int i, vec3 albedo){

  vec3 to_light =  uPointLights[i].pos - vWorldPos;
  float d = length(to_light);
  vec3 w_i = normalize(to_light);
  vec3 w_o = ViewDirectionWS;
  vec3 f0 = vec3(uMaterial.metalness, uMaterial.metalness, uMaterial.metalness);
  vec3 ks = fresnel_shlick(f0, w_i, w_o);
  vec3 specular = ks * specular_component(w_i, w_o);
  vec3 diffuse = diffuse_component(albedo) * (1.0 - ks);
  vec3 inRadiance = calcPointLight(w_i,d,i);
  float cosTheta = dot(vNormalWS, w_i);
  return (diffuse + specular)* inRadiance * cosTheta;
}

vec3 directLight(int i, vec3 albedo){
  vec3 w_i = normalize(uDirectLights[i].dir);
  vec3 w_o = ViewDirectionWS;
  vec3 ks = fresnel_shlick(albedo,w_i , w_o);
  vec3 specular = ks * specular_component(w_i, w_o);
  vec3 diffuse = diffuse_component(albedo) * (1.0 - ks);
  vec3 inRadiance =  calcDirectLight(w_i,i);
  float cosTheta = dot(vNormalWS, w_i);
  return (diffuse + specular)* inRadiance * cosTheta;
}

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  vec3 radiance = vec3(0.0);

  
  for (int i = 0; i < 4; i++){

  radiance += pointLight(i, albedo);
  // **DO NOT** forget to apply gamma correction as last step.
  // outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
  }
  radiance = tone_mapping(radiance);
  outFragColor.rgba = LinearTosRGB(vec4(radiance, 1.0));
  
}
`;
