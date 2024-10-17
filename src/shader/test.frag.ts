export default `
precision highp float;

#define M_PI 3.1415926535897932384626433832795
#define EPSILON 0.000001

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

struct Direct{
  bool diffuse;
  bool specular;
};

struct Indirect{
  bool diffuse;
  bool specular;
};

uniform Material uMaterial;
uniform PointLight uPointLights[4];
uniform DirectLight uDirectLights[2];
uniform sampler2D uTextureDiffuse;
uniform sampler2D uTextureSpecular;
uniform sampler2D uTextureBRDF;
uniform sampler2D uTextureDiffuseGenerated;

uniform Direct uIndirect;
uniform Indirect uDirect;


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
  vec3 h = normalize(w_i + w_o);
  float WOdotH = max(dot(w_o, h),0.0);
  return f0 + (1.0 - f0) * pow(1.0 - WOdotH, 5.0);
}

float G_shlick(vec3 v,float k){
  float NdotV = max(dot(vNormalWS, v),0.0);
  return NdotV / ((NdotV * (1.0-k) + k) + EPSILON);
}

float shadowing_shlick(vec3 w_i,vec3 w_o){
  float k = pow(uMaterial.roughness + 1.0,2.0) / 8.0;
  float res = G_shlick(w_o, k) * G_shlick(w_i,k);
  return res;
}

float normalDistribFunction(vec3 w_i, vec3 w_o){
  vec3 h = normalize(w_i + w_o);
  float alpha2 = pow(uMaterial.roughness, 2.0);
  float NdotH = max(dot(vNormalWS, h),0.0);
  return  alpha2 / ((M_PI * pow(pow(NdotH,2.0) *(alpha2- 1.0) + 1.0,2.0)) + EPSILON);
}

float specular_component(vec3 w_i,vec3 w_o){
  float num = shadowing_shlick(w_i,w_o) * normalDistribFunction(w_i, w_o);
  float denum = 4.0 * max(dot(w_o, vNormalWS),0.0) * max(dot(w_i, vNormalWS),0.0) + EPSILON;
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

vec3 RGBMDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

vec2 cartesianToPolar(vec3 cartesian) {
    // Compute azimuthal angle, in [-PI, PI]
    float phi = atan(cartesian.z, cartesian.x);
    // Compute polar angle, in [-PI/2, PI/2]
    float theta = asin(cartesian.y);
    return vec2(phi, theta);
}

vec2 remapPolar(vec2 polar){
  float phi = polar.x;
  float theta = polar.y;
  phi =  (phi + M_PI) / (2.0 * M_PI);
  theta = (theta + (M_PI / 2.0)) / M_PI;
  return vec2(phi, theta);
}

vec3 getFromTexture(sampler2D ourTexture, vec3 vector){
  vec2 polar_vector = cartesianToPolar(vector);
  vec2 normalized_polar_vector = remapPolar(polar_vector);
  return RGBMDecode(texture(ourTexture, normalized_polar_vector));
}

vec2 computeRoughnessLevel(float roughness){
  vec2 res = vec2(0.0,-1.0);
  float pad = 1.0;
  float i = 1.0;
  // Compute the lower level (or the exact level)
  while (i < 6.0 && i < roughness * 6.0 )
    i+=1.0;
  res.x = i;
  // If we are not on an exact boundary or at the smallest level, get a second level
  if (i < 6.0 && i !=  roughness * 6.0)
    res.y = i + 1.0;
  return res;
}

// We assume the values in init are in the range [0,1]
float remapValues(float init, float low, float top){
  float res = (init * (top - low)) + low;
  return res;
}

vec3 getFromRoughnessTexture(sampler2D our_texture, vec2 uv, float lvl){
  float height = 0.5;
  float begin_y = 0.0;
  float width = 1.0;
  float step_btw_lvl = 0.5;
  for (float i = 1.0; i < lvl; i++){
    width = step_btw_lvl;
    step_btw_lvl /= 2.0;
    begin_y = height;
    height += step_btw_lvl;
  }
  float remapped_x = remapValues(uv.x, 0.0, width);
  float remapped_y = remapValues(uv.y, begin_y, height);
  if (uv.y < 0.0)
    return vec3(1.0,0.0,0.0);
  vec2 new_uv = vec2(remapped_x, remapped_y);
  return RGBMDecode(texture(our_texture, new_uv));
}


vec3 computePrefilteredSpec(float roughness, vec3 reflected){
  vec2 polar_vector = cartesianToPolar(reflected);
  vec2 normalized_polar_vector = remapPolar(polar_vector);
  vec2 level = computeRoughnessLevel(roughness);
  vec3 res = getFromRoughnessTexture(uTextureSpecular, normalized_polar_vector, level.x);
  return res;
  if (level.y > -1.0 + EPSILON){
    vec3 second_level = getFromRoughnessTexture(uTextureSpecular, normalized_polar_vector, level.x);
    float pos = roughness * 6.0;
    res = (pos - level.x) * res + (level.y - pos) * second_level;
  }
  return res;
}

vec2 computeBRDFSpec(vec3 w_i, float roughness){
  float u = max(dot(w_i, vNormalWS),0.0);
  float v = roughness;
  vec2 uv = vec2(u,v);
  vec4 brdf = sRGBToLinear(texture(uTextureBRDF, uv));
  return brdf.xy;
}

vec3 indirectLighting(vec3 albedo){

  if (!uIndirect.diffuse && !uIndirect.specular)
    return vec3(0.0);

  vec3 w_o = ViewDirectionWS;
  vec3 f0 = vec3(uMaterial.metalness, uMaterial.metalness, uMaterial.metalness);
  vec3 ks = fresnel_shlick(f0, vNormalWS, w_o);
  vec3 kd = (1.0 - ks) * (1.0 - uMaterial.metalness);

  vec3 diffuse = vec3(0.0);

  if (uIndirect.diffuse)
    diffuse = albedo * kd * getFromTexture(uTextureDiffuse, vNormalWS);

  
  vec3 specular = vec3(0.0);
  if (uIndirect.specular)
  {
    vec3 reflected = -reflect(w_o, vNormalWS);
    vec3 prefilteredSpec = computePrefilteredSpec(uMaterial.roughness, reflected);

    vec2 brdf = computeBRDFSpec(w_o, uMaterial.roughness);
    specular = prefilteredSpec * (ks * brdf.r + brdf.g);

  }

  return specular + diffuse;

}

vec3 pointLight(int i, vec3 albedo){
  if (!uDirect.diffuse && !uDirect.specular)
    return vec3(0.0);
  // Computing the vector w_i and w_o, as well as the distance to the light
  vec3 to_light =  uPointLights[i].pos - vWorldPos;
  float d = length(to_light);
  vec3 w_i = normalize(to_light);
  vec3 w_o = ViewDirectionWS;
  // Computing ks from the metalness
  vec3 f0 = vec3(uMaterial.metalness, uMaterial.metalness, uMaterial.metalness);
  vec3 ks = fresnel_shlick(f0, w_i, w_o);
  vec3 kd = (1.0 - ks) * (1.0 - uMaterial.metalness);


  vec3 diffuse = vec3(0.0);
  if (uDirect.diffuse)
    diffuse = albedo * kd * diffuse_component(albedo);
  vec3 specular = vec3(0.0);
  if (uDirect.specular)
    specular = ks * specular_component(w_i, w_o);
  
  // Computing the inRadiance
  vec3 inRadiance = calcPointLight(w_i,d,i);
  // Computing the impact of the light
  float cosTheta = max(dot(vNormalWS, w_i),0.0);
  return (diffuse + specular)* inRadiance * cosTheta;
}

vec3 directLight(int i, vec3 albedo){
  vec3 w_i = normalize(uDirectLights[i].dir);
  vec3 w_o = ViewDirectionWS;
  vec3 ks = fresnel_shlick(albedo,w_i , w_o);
  vec3 specular = ks * specular_component(w_i, w_o);
  vec3 diffuse = diffuse_component(albedo) * (1.0 - ks);
  vec3 inRadiance =  calcDirectLight(w_i,i);
  float cosTheta = max(dot(vNormalWS, w_i),0.0);
  return (diffuse + specular)* inRadiance * cosTheta;
}

void main()
{
  // **DO NOT** forget to do all your computation in linear space.
  // vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  // vec3 radiance = vec3(0.0);

  
  // for (int i = 0; i < 4; i++){
  //   radiance += pointLight(i, albedo);
  // }

  // radiance += indirectLighting(albedo);
  // radiance = tone_mapping(radiance);

  // outFragColor.rgba = vec4(0.0,0.0,0.0,1.0);
  // return;
  // **DO NOT** forget to apply gamma correction as last step.
  // outFragColor.rgba = vec4(0.0, 1.0,0.0,1.0);
  // return;
  // for (float i = 0.0; i < 1.0; i+=0.01){
  //   for (float j = 0.0; j < 1.0; j+=0.01){
  //     vec4 color = (texture(uTextureDiffuseGenerated, vec2(i, j)));
  //     if (color.b != 0.0 || color.g != 0.0 || color.r != 0.0 || color.a != 0.0){
  //         outFragColor.rgba = vec4(1.0,0.0,0.0,1.0);
  //         return;
  //     }
  //   }
  // }
  outFragColor.rgba = texture(uTextureDiffuseGenerated, vec2(0, 0));  //LinearTosRGB(vec4(radiance, 1.0));
  // outFragColor.rgba = vec4(1.0,0.0,0.0,1.0);
  
}
`;
