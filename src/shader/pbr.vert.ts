export default `

precision highp float;

// Attributes (vertex shader inputs)
in vec3 in_position;
in vec3 in_normal;
#ifdef USE_UV
  in vec2 in_uv;
#endif

// Varyings (vertex shader outputs)
out vec3 vNormalWS;
out vec3 ViewDirectionWS;
out vec4 vWorldPos;
#ifdef USE_UV
  out vec2 vUv;
#endif

// Uniforms
struct Camera
{
  mat4 WS_to_CS; // World-Space to Clip-Space (view * proj)
};
uniform Camera uCamera;
uniform vec3 uCameraPos;

struct Model
{
  mat4 LS_to_WS; // Local-Space to World-Space
};
uniform Model uModel;

void main()
{
  vec4 positionLocal = vec4(in_position, 1.0);
  gl_Position = uCamera.WS_to_CS * uModel.LS_to_WS * positionLocal;
  vWorldPos = uModel.LS_to_WS * positionLocal;
  vNormalWS = (in_normal + 1.0) / 2.0;
  vec3 ws_position = (uModel.LS_to_WS * positionLocal).xyz;
  ViewDirectionWS = (normalize(uCameraPos - ws_position) + 1.0)/2.0;
}
`;
