import {
	Color, WebGLRenderer, WebGLRenderTarget
} from 'three';

import { Pass } from './pass';

export class RenderPass extends Pass {

  scene: THREE.Scene;
  camera: THREE.Camera;
  overrideMaterial: THREE.ShaderMaterial | undefined;
  clearColor: THREE.Color | undefined;
  clearAlpha: number | undefined;

  clear = true;
  clearDepth = false;
  needsSwap = false;
  _oldClearColor = new Color();
  
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, overrideMaterial?: THREE.ShaderMaterial, clearColor?: THREE.Color, clearAlpha?: number) {
      super();

      this.scene = scene;
      this.camera = camera;
  
      this.overrideMaterial = overrideMaterial;
  
      this.clearColor = clearColor;
      this.clearAlpha = (clearAlpha !== undefined) ? clearAlpha : 0;
  }


  render(renderer: WebGLRenderer, _writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, _deltaTime?: number, _maskActive?: boolean): void {
		let oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		let oldClearAlpha, oldOverrideMaterial = null;

		if (this.overrideMaterial !== undefined) {
			oldOverrideMaterial = this.scene.overrideMaterial;
			this.scene.overrideMaterial = this.overrideMaterial;
		}

		if (this.clearColor) {
			renderer.getClearColor(this._oldClearColor);
			oldClearAlpha = renderer.getClearAlpha();
			renderer.setClearColor(this.clearColor, this.clearAlpha);
		}

		if (this.clearDepth) {
			renderer.clearDepth();
		}

		renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);

		if (this.clear) {
      renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
    } 

		renderer.render(this.scene, this.camera);

		if (this.clearColor) {
			renderer.setClearColor( this._oldClearColor, oldClearAlpha );
		}

		if (this.overrideMaterial !== undefined) {
			this.scene.overrideMaterial = oldOverrideMaterial;
		}

		renderer.autoClear = oldAutoClear;
	}


  setSize(_width: number, _height: number): void {
  }
}