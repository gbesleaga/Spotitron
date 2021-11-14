import {
	Clock,
	LinearFilter,
	RGBAFormat,
	Vector2,
  WebGLRenderer,
	WebGLRenderTarget
} from 'three';

import { CopyShader } from '../shaders/copy-shader';
import { Pass } from './pass';
import { ShaderPass } from './shader-pass';


export class EffectComposer {

  renderer: WebGLRenderer;
  renderTarget1: WebGLRenderTarget;
  renderTarget2: WebGLRenderTarget;

  writeBuffer: WebGLRenderTarget;
  readBuffer: WebGLRenderTarget;

  _pixelRatio: number;
  _width: number;
  _height: number;
  
  renderToScreen = true;
  passes: Pass[] = [];

  copyPass: ShaderPass;

  clock = new Clock();


  constructor(renderer: WebGLRenderer, renderTarget?: WebGLRenderTarget ) {
    this.renderer = renderer;

    if (renderTarget === undefined) {
      const parameters = {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        format: RGBAFormat
      };

      const size = renderer.getSize(new Vector2());
      this._pixelRatio = renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;

      renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, parameters);
      renderTarget.texture.name = 'EffectComposer.rt1';
    } else {
      this._pixelRatio = 1;
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }

    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = 'EffectComposer.rt2';

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;

    this.copyPass = new ShaderPass(new CopyShader);
  }


  swapBuffers(): void {
		let tmp = this.readBuffer;
		this.readBuffer = this.writeBuffer;
		this.writeBuffer = tmp;
	}


	addPass(pass: Pass): void {
		this.passes.push(pass);
		pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
	}


	insertPass(pass: Pass, index: number): void {
		this.passes.splice(index, 0, pass);
		pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
	}


	removePass(pass: Pass): void {
		const index = this.passes.indexOf(pass);

		if (index !== - 1) {
			this.passes.splice(index, 1);
		}
	}


	isLastEnabledPass(passIndex: number): boolean {
		for (let i = passIndex + 1; i < this.passes.length; i++) {
			if (this.passes[i].enabled) {
				return false;
			}
		}

		return true;
	}


  // deltaTime value is in seconds
	render (deltaTime?: number): void {
		if (deltaTime === undefined) {
			deltaTime = this.clock.getDelta();
		}

		let currentRenderTarget = this.renderer.getRenderTarget();

		let maskActive = false;

		let il = this.passes.length;
		for (let i = 0; i < il; i ++) {
			const pass = this.passes[i];

			if (pass.enabled === false) {
        continue;
      }

			pass.renderToScreen = (this.renderToScreen && this.isLastEnabledPass(i));
			pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);

			if (pass.needsSwap) {
				if (maskActive) {
					let context = this.renderer.getContext();
					let stencil = this.renderer.state.buffers.stencil;

					//context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );
					stencil.setFunc(context.NOTEQUAL, 1, 0xffffffff);

					this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime);

					//context.stencilFunc( context.EQUAL, 1, 0xffffffff );
					stencil.setFunc(context.EQUAL, 1, 0xffffffff);
				}

				this.swapBuffers();
			}
		}
		
    this.renderer.setRenderTarget(currentRenderTarget);
	}


	reset(renderTarget: WebGLRenderTarget): void {
		if (renderTarget === undefined) {
			let size = this.renderer.getSize(new Vector2());
			this._pixelRatio = this.renderer.getPixelRatio();
			this._width = size.width;
			this._height = size.height;

			renderTarget = this.renderTarget1.clone();
			renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
		}

		this.renderTarget1.dispose();
		this.renderTarget2.dispose();
		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;
	}


	setSize(width: number, height: number): void {
		this._width = width;
		this._height = height;

		const effectiveWidth = this._width * this._pixelRatio;
		const effectiveHeight = this._height * this._pixelRatio;

		this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
		this.renderTarget2.setSize(effectiveWidth, effectiveHeight);

		for (let i = 0; i < this.passes.length; i++) {
			this.passes[i].setSize(effectiveWidth, effectiveHeight);
		}
	}


	setPixelRatio(pixelRatio: number): void {
		this._pixelRatio = pixelRatio;
		this.setSize(this._width, this._height);
	}
}
