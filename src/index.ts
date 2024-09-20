import { GUI } from "dat.gui";
import { mat4, vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { SphereGeometry } from "./geometries/sphere";
import { GLContext } from "./gl";
import { PBRShader } from "./shader/pbr-shader";
import { Texture, Texture2D } from "./textures/texture";
import { UniformType } from "./types";
import { DirectionalLight, PointLight } from "./lights/lights";

// GUI elements
interface GUIProperties {
  albedo: number[];
  light_intensity: number;
  light_color: number[];
  light_pos_x: number;
  light_pos_y: number;
  light_pos_z: number;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  private _context: GLContext; // Context used to draw to the canvas
  private _shader: PBRShader;
  private _geometry: SphereGeometry;
  private _uniforms: Record<string, UniformType | Texture>;
  private _textureExample: Texture2D<HTMLElement> | null;
  private _camera: Camera;
  private _guiProperties: GUIProperties; // Object updated with the properties from the GUI
  private _point_lights: [PointLight, PointLight , PointLight, PointLight ];
  private _direct_lights: [DirectionalLight, DirectionalLight/*, PointLight */];

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera(0.0, 0.0, 30.0);
    this._geometry = new SphereGeometry();
    this._shader = new PBRShader();
    this._textureExample = null;
    this._point_lights = [new PointLight(), new PointLight() , new PointLight(), new PointLight()];
    this._direct_lights = [new DirectionalLight(), new DirectionalLight() /*, new PointLight */];
    this._uniforms = {
      "uMaterial.albedo": vec3.create(),
      "uMaterial.roughness" : 0.25,
      "uModel.LS_to_WS": mat4.create(),
      "uCamera.WS_to_CS": mat4.create(),
      uCameraPos: this._camera._position,
    };

    this._point_lights[0].setColorRGB(1.0, 1.0, 1.0);
    this._point_lights[1].setColorRGB(1.0, 1.0, 1.0);
    this._point_lights[2].setColorRGB(1.0, 1.0, 1.0);
    this._point_lights[3].setColorRGB(1.0, 1.0, 1.0);
    this._direct_lights[0].setColorRGB(1.0, 1.0, 1.0);

    this._point_lights[0].setIntensity(500);
    this._point_lights[1].setIntensity(500);
    this._point_lights[2].setIntensity(500);
    this._point_lights[3].setIntensity(500);
    this._direct_lights[0].setIntensity(0.5);
    // this._lights[1].setIntensity(10);
    // this._lights[2].setIntensity(10);

    this._point_lights[0].setPosition(-5, -5, 5);
    this._point_lights[1].setPosition(-5, 5, 5);
    this._point_lights[2].setPosition(5, -5, 5);
    this._point_lights[3].setPosition(5, 5, 5);
    this._direct_lights[0].setDirection(0, 1, 0);
    // this._lights[1].setPosition(-30,0,0);
    // this._lights[2].setPosition(0,15,0);

    for (let i = 0; i < this._point_lights.length; i++) {
      this._uniforms[`uPointLights[${i}].pos`] = this._point_lights[i].positionWS;
      this._uniforms[`uPointLights[${i}].color`] = this._point_lights[i].color;
      this._uniforms[`uPointLights[${i}].intensity`] = this._point_lights[i].intensity;
    }

    for (let i = 0; i < this._direct_lights.length; i++) {
      this._uniforms[`uDirectLights[${i}].dir`] = this._direct_lights[i].directionWS;
      this._uniforms[`uDirectLights[${i}].color`] = this._direct_lights[i].color;
      this._uniforms[`uDirectLights[${i}].intensity`] = this._direct_lights[i].intensity;
    }

    // Set GUI default values
    this._guiProperties = {
      // albedo: [255, 255, 255],
      albedo: [255, 255, 255],
      light_intensity: 1000,
      light_color: [255, 255, 255],
      light_pos_x: -5,
      light_pos_y: -5,
      light_pos_z: 5,
    };

    // Creates a GUI floating on the upper right side of the page.
    // You are free to do whatever you want with this GUI.
    // It's useful to have parameters you can dynamically change to see what happens.
    const gui = new GUI();
    gui.addColor(this._guiProperties, "albedo");
    gui.addColor(this._guiProperties, "light_color");
    gui.add(this._guiProperties, "light_intensity");
    gui.add(this._guiProperties, "light_pos_x");
    gui.add(this._guiProperties, "light_pos_y");
    gui.add(this._guiProperties, "light_pos_z");
  }

  /**
   * Initializes the application.
   */
  async init() {
    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureExample = await Texture2D.load(
      "assets/ggx-brdf-integrated.png"
    );
    if (this._textureExample !== null) {
      this._context.uploadTexture(this._textureExample);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
    }

    // Handle keyboard and mouse inputs to translate and rotate camera.
    canvas.addEventListener(
      "keydown",
      this._camera.onKeyDown.bind(this._camera),
      true
    );
    canvas.addEventListener(
      "pointerdown",
      this._camera.onPointerDown.bind(this._camera),
      true
    );
    canvas.addEventListener(
      "pointermove",
      this._camera.onPointerMove.bind(this._camera),
      true
    );
    canvas.addEventListener(
      "pointerup",
      this._camera.onPointerUp.bind(this._camera),
      true
    );
    canvas.addEventListener(
      "pointerleave",
      this._camera.onPointerUp.bind(this._camera),
      true
    );
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resetViewport();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    this._context.clear();
    this._context.setDepthTest(true);

    const props = this._guiProperties;

    // Set the albedo uniform using the GUI value
    this._uniforms["uMaterial.albedo"] = vec3.fromValues(
      props.albedo[0] / 255,
      props.albedo[1] / 255,
      props.albedo[2] / 255
    );

    this._uniforms["uPointLights[0].pos"] = vec3.fromValues(
      props.light_pos_x,
      props.light_pos_y,
      props.light_pos_z
    );

    this._uniforms["uPointLights[0].color"] = vec3.fromValues(
      props.light_color[0] / 255,
      props.light_color[1] / 255,
      props.light_color[2] / 255
    );

    this._uniforms["uPointLights[0].intensity"] = props.light_intensity;
    // Set World-Space to Clip-Space transformation matrix (a.k.a view-projection).
    const aspect =
      this._context.gl.drawingBufferWidth /
      this._context.gl.drawingBufferHeight;
    let WS_to_CS = this._uniforms["uCamera.WS_to_CS"] as mat4;
    mat4.multiply(
      WS_to_CS,
      this._camera.computeProjection(aspect),
      this._camera.computeView()
    );

    // Draw the 5x5 grid of spheres
    const rows = 5;
    const columns = 5;
    const spacing = this._geometry.radius * 2.5;
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < columns; ++c) {
        // Set Local-Space to World-Space transformation matrix (a.k.a model).
        const WsSphereTranslation = vec3.fromValues(
          (c - columns * 0.5) * spacing + spacing * 0.5,
          (r - rows * 0.5) * spacing + spacing * 0.5,
          0.0
        );
        const LS_to_WS = this._uniforms["uModel.LS_to_WS"] as mat4;
        mat4.fromTranslation(LS_to_WS, WsSphereTranslation);
        this._uniforms["uMaterial.roughness"] = c * 0.15 + 0.01;
        this._uniforms["uMaterial.metalness"] = r * 0.21 + 0.04;

        // Draw the triangles
        this._context.draw(this._geometry, this._shader, this._uniforms);
      }
    }
  }
}

const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */
const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
