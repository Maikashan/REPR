import { GUI } from "dat.gui";
import { mat4, vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { SphereGeometry } from "./geometries/sphere";
import { PlaneGeometry} from "./geometries/plane";
import { GLContext } from "./gl";
import { PBRShader } from "./shader/pbr-shader";
import { Texture, Texture2D } from "./textures/texture";
import { PixelArray, UniformType } from "./types";
import { DirectionalLight, PointLight } from "./lights/lights";
import { IBLDShader } from "./shader/ibld-shader";

// GUI elements
interface GUIProperties {
  albedo: number[];
  light_intensity: number;
  light_color: number[];
  light_pos_x: number;
  light_pos_y: number;
  light_pos_z: number;
  indirect_diffuse: boolean;
  indirect_specular: boolean;
  direct_diffuse: boolean;
  direct_specular: boolean;
  use_drawn: boolean;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  private _context: GLContext; // Context used to draw to the canvas
  private _shader: PBRShader;
  private _ibldShader: IBLDShader;
  private _geometry: SphereGeometry;
  private _ibldGeometry: PlaneGeometry;
  private _uniforms: Record<string, UniformType | Texture>;
  private _textureDiffuse: Texture2D<HTMLElement> | null;
  private _textureSpecular: Texture2D<HTMLElement> | null;
  private _textureBRDF: Texture2D<HTMLElement> | null;
  private _initialTexture: Texture2D<HTMLElement> | null;
  private _textureTarget : Texture2D<PixelArray> | null;
  private _drawTexture: boolean;
  private _camera: Camera;
  private _guiProperties: GUIProperties; // Object updated with the properties from the GUI
  private _point_lights: [PointLight, PointLight , PointLight, PointLight ];
  private _direct_lights: [DirectionalLight, DirectionalLight/*, PointLight */];

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera(0.0, 0.0, 30.0);
    this._geometry = new SphereGeometry();
    this._shader = new PBRShader();
    this._ibldGeometry = new PlaneGeometry();
    this._ibldShader = new IBLDShader();
    this._textureDiffuse= null;
    this._textureSpecular= null;
    this._textureBRDF= null;
    this._initialTexture = null;
    this._textureTarget = null;
    this._drawTexture = true;
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
      light_intensity: 500,
      light_color: [255, 255, 255],
      light_pos_x: -5,
      light_pos_y: -5,
      light_pos_z: 5,
      indirect_specular: false,
      indirect_diffuse: true,
      direct_diffuse: false,
      direct_specular: false,
      use_drawn: false,
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
    gui.add(this._guiProperties, "use_drawn");

    var indirect = gui.addFolder("Indirect lighting");
    indirect.add(this._guiProperties, "indirect_specular");
    indirect.add(this._guiProperties, "indirect_diffuse");
    var direct = gui.addFolder("Direct lighting");
    direct.add(this._guiProperties, "direct_specular");
    direct.add(this._guiProperties, "direct_diffuse");
  }

  /**
   * Initializes the application.
   */
  async init() {
    
    await this.generateEnvironment();

    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureDiffuse= await Texture2D.load(
      "assets/env/Alexs_Apt_2k-diffuse-RGBM.png"
    );
    if (this._textureDiffuse!== null) {
      this._context.uploadTexture(this._textureDiffuse);
      // You can then use it directly as a uniform:
      // ```uniforms.myTexture = this._textureExample;```
      this._uniforms["uTextureDiffuse"] = this._textureDiffuse;
    }

    this._textureSpecular = await Texture2D.load(
      "assets/env/Alexs_Apt_2k-specular-RGBM.png"
    );
    if (this._textureSpecular !== null) {
      this._context.uploadTexture(this._textureSpecular);
      this._uniforms["uTextureSpecular"] = this._textureSpecular;
    }

    this._textureBRDF = await Texture2D.load(
      "assets/ggx-brdf-integrated.png"
    );
    if (this._textureBRDF !== null) {
      this._context.uploadTexture(this._textureBRDF);
      this._uniforms["uTextureBRDF"] = this._textureBRDF;
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

    this._drawTexture = false;
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
    if (this._drawTexture)
      return;
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

    this._uniforms["uIndirect.diffuse"] = props.indirect_diffuse;
    this._uniforms["uIndirect.specular"] = props.indirect_specular;

    this._uniforms["uDirect.diffuse"] = props.direct_diffuse;
    this._uniforms["uDirect.specular"] = props.direct_specular;

    this._uniforms["uUseDrawn"] = props.use_drawn;


    let aspect =
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
        this._uniforms["uMaterial.roughness"] = c * 0.18 + 0.01;
        this._uniforms["uMaterial.metalness"] = r * 0.23 + 0.04;

        // Draw the triangles
        this._context.draw(this._geometry, this._shader, this._uniforms);
      }
    }
  }
async generateEnvironment(){

    this._context.uploadGeometry(this._ibldGeometry);
    this._context.compileProgram(this._ibldShader);

    // Loading the image to generate the Diffuse Texture
    // this._initialTexture = await Texture2D.load(
    //   "assets/env/moonlit_golf_2k-RGBM.png"
    // );
    // this._initialTexture = await Texture2D.load(
    //   "assets/test.png"
    // );
    this._initialTexture = await Texture2D.load(
      "assets/env/zwartkops_straight_morning_2k-RGBM.png"
    );
    // this._initialTexture = await Texture2D.load(
    //   "assets/env/thatch_chapel_2k-RGBM.png"
    // );
    if (this._initialTexture !== null) {
      // Upload the initial texture to the GPU
      this._context.uploadTexture(this._initialTexture);
      // Must pass it as an uniform
      this._uniforms['uTextureInitial'] = this._initialTexture;
      this._uniforms['uWidth'] = this._initialTexture.width;
      this._uniforms['uHeight'] = this._initialTexture.height;
      console.log(this._initialTexture.width);
      console.log(this._initialTexture.height);

      // Create a Texture2D<PixelArray> and upload it to the GPU  
      let data : PixelArray = new Uint8Array(this._initialTexture.width * this._initialTexture.height * 4);
      this._textureTarget = new Texture2D<PixelArray>(data, this._initialTexture.width, this._initialTexture.height, this._initialTexture.formatGL, this._initialTexture.internalFormatGL,this._context.gl.UNSIGNED_BYTE);
      this._context.uploadTexture(this._textureTarget);

      // Create a framebuffer and bind it
      const framebuffer = this._context.gl.createFramebuffer();
      this._context.gl.bindFramebuffer(this._context.gl.FRAMEBUFFER, framebuffer);
      
      // Attach the created texture as the color output
      this._context.setFramebufferTexture(this._textureTarget);

      // // Setting the viewport to match the size of the texture (i guess ? Not sure at all here)
      let height = this._textureTarget.height;
      let width = this._textureTarget.width;
      this._context.setViewport(width, height);


    //   let WS_to_CS = this._uniforms["uCamera.WS_to_CS"] as mat4;
    //   let aspect =
    //   this._textureTarget.width / 
    //   this._textureTarget.height;

    // mat4.multiply(
    //   WS_to_CS,
    //   this._camera.computeProjection(aspect),
    //   this._camera.computeView()
    // );

      // Launch a drawcall, after setting a geometry and compiled the saders
      this._context.draw(this._ibldGeometry, this._ibldShader, this._uniforms);

      const new_data = new Uint8Array(4 * width * height);

      if (this._context.gl.checkFramebufferStatus(this._context.gl.FRAMEBUFFER) === this._context.gl.FRAMEBUFFER_COMPLETE) {
        this._context.gl.readPixels(0, 0, width, height, this._textureTarget.formatGL, this._textureTarget.typeGL, new_data);
      }

      this._textureTarget = new Texture2D<PixelArray>(new_data, this._initialTexture.width, this._initialTexture.height, this._initialTexture.formatGL, this._initialTexture.internalFormatGL,this._context.gl.UNSIGNED_BYTE);

      this._context.uploadTexture(this._textureTarget);

      this._uniforms["uTextureDiffuseGenerated"] = this._textureTarget;

      this._context.clear();
    // Rebinding to the default buffer
      this._context.gl.bindFramebuffer(this._context.gl.FRAMEBUFFER, null);

  // Reset the viewort
      this.resize();
    }

      this._context.destroyGeometry(this._ibldGeometry);
      this._context.destroyProgram(this._ibldShader);
  }

  debug_render() {
    if (this._drawTexture || this._initialTexture === null)
      return;
    this._context.clear();
    this._context.setDepthTest(true);

      let WS_to_CS = this._uniforms["uCamera.WS_to_CS"] as mat4;
      const aspect=
      this._initialTexture.height/ 
      this._initialTexture.width;

    mat4.multiply(
      WS_to_CS,
      this._camera.computeProjection(aspect),
      this._camera.computeView()
    );

    this._context.draw(this._ibldGeometry, this._ibldShader, this._uniforms);
    this.resize();
  }
}


const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);

app.init();

function animate() {
  app.update();
  app.render();
  //////////////DEBUG////////////////////:
  // app.debug_render();
  //////////////////////////////////////
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