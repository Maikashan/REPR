export default `
precision highp float;

#define M_PI 3.1415926535897932384626433832795

// Vertex shader output
in vec3 vWorldPos;
in vec3 vNormalWS;

// Fragment shader output
out vec4 outFragColor;

// Uniforms
struct Material
{
  vec3 albedo;
};
uniform Material uMaterial;
uniform sampler2D uTextureInitial;
uniform float uWidth;
uniform float uHeight;

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

vec2 cartesianToSpherical(vec3 cartesian) {
    // Compute azimuthal angle, in [-PI, PI]
    float phi = atan(cartesian.z, cartesian.x);
    // Compute polar angle, in [-PI/2, PI/2]
    float theta = asin(cartesian.y);
    return vec2(phi, theta);
}

vec2 ToUV(vec3 direction){
  vec2 polar = cartesianToSpherical(direction);
  polar.x = (polar.x + M_PI) / (2.0 * M_PI);
  polar.y = (polar.y + M_PI / 2.0) / M_PI;
  return polar;
}

// http://graphicrants.blogspot.com/2009/04/rgbm-color-encoding.html
vec4 RGBMEncode( vec3 color ) {
  vec4 rgbm;
  color *= 1.0 / 6.0;
  rgbm.a = clamp( max( max( color.r, color.g ), max( color.b, 1e-6 ) ), 0.0, 1.0);
  rgbm.a = ceil( rgbm.a * 255.0 ) / 255.0;
  rgbm.rgb = color / rgbm.a;
  return rgbm;
}

void main()
{
  vec2 N = vec2(vWorldPos.x, -vWorldPos.y / 2.0);
  vec3 acc = vec3(0.0);

  int count = 0;

  for (float phi = -0.5 * M_PI; phi <  0.5 * M_PI; phi+=0.05)
  {
    for (float theta = -0.5 * M_PI; theta < 0.5 * M_PI; theta += 0.05)
    {
      vec2 pol = N * M_PI + vec2(theta, phi);
      vec3 direction = vec3(cos(pol.x) * cos(pol.y), sin(pol.y), sin(pol.x) * cos(pol.y));
      vec2 uv = ToUV(direction);
      acc += (RGBMDecode(texture(uTextureInitial, uv))).rgb * cos(theta) * cos(phi);
      // acc += ((texture(uTextureInitial, uv))).rgb * cos(theta) * cos(phi);
      count++;
    }
  }
  // outFragColor.rgba = vec4(M_PI * acc / float(count),1.0);
  outFragColor.rgba = RGBMEncode(M_PI * acc / float(count));
  // **DO NOT** forget to do all your computation in linear space.
  // vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;

  // // **DO NOT** forget to apply gamma correction as last step.
  // outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
}
`;