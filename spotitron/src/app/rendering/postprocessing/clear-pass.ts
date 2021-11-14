import {
	Color, WebGLRenderer, WebGLRenderTarget
} from 'three'

import { Pass } from './pass';

export class ClearPass extends Pass {
    
  private clearColor: Color | number | string;
  private clearAlpha: number;
  private _oldClearColor: Color;
    
  constructor(clearColor: Color | number | string, clearAlpha: number) {
    super();
    this.needsSwap = false;
    this.clearColor = ( clearColor !== undefined ) ? clearColor : 0x000000;
    this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;
    this._oldClearColor = new Color();
  }


  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, _deltaTime?: number, _maskActive?: boolean): void {
		let oldClearAlpha;

		if (this.clearColor ) {
			renderer.getClearColor(this._oldClearColor);
			oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor(this.clearColor, this.clearAlpha);
		}

		renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
		renderer.clear();

		if (this.clearColor) {
			renderer.setClearColor(this._oldClearColor, oldClearAlpha);
		}
	}

  
  setSize(_width: number, _height: number): void {
  }
};