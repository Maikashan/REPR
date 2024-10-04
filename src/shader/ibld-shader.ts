import { Shader } from './shader';

import vertex from './ibld.vert';
import fragment from './ibld.frag';

export class IBLDShader extends Shader {
  public constructor() {
    super(vertex, fragment);
  }

  public set useLightProbe(flag: boolean) {
    this.defines.LIGHT_PROBE = flag;
  }

  public set directionalLightCount(count: number) {
    this.defines.DIRECTIONAL_LIGHT_COUNT = count;
  }

  public set pointLightCount(count: number) {
    this.defines.POINT_LIGHT_COUNT = count;
  }
}
