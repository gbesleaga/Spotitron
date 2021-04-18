import {
    IUniform,
	ShaderMaterial,
	UniformsUtils,
    WebGLRenderer,
    WebGLRenderTarget
} from 'three';

import { FullScreenQuad, Pass } from './pass';

export class ShaderPass extends Pass {
    textureID: any;
    shader: any;
    uniforms: { [uniform: string]: IUniform } = {};
    material: ShaderMaterial | undefined = undefined;

    fsQuad: FullScreenQuad;

    constructor(shader: any, textureID?: any) {
        super();

        this.textureID = (textureID !== undefined) ? textureID : 'tDiffuse';

        if (shader instanceof ShaderMaterial) {
            this.uniforms = shader.uniforms;
            this.material = shader;
        } else if (shader) {
            this.uniforms = UniformsUtils.clone(shader.uniforms);
            this.material = new ShaderMaterial({
                defines: Object.assign( {}, shader.defines ),
                uniforms: this.uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader
            });
        }
    
        this.fsQuad = new FullScreenQuad(this.material);
    }

    setSize(width: number, height: number): void {
    }

    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime?: number, maskActive?: boolean) {
		if (this.uniforms && this.uniforms[this.textureID]) {
			this.uniforms[this.textureID].value = readBuffer.texture;
		}

        if (this.material) {
            this.fsQuad.setMaterial(this.material);
        }

		if (this.renderToScreen) {
			renderer.setRenderTarget(null);
			this.fsQuad.render(renderer);
		} else {
			renderer.setRenderTarget(writeBuffer);
            
			if (this.clear) {
                renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
            }
            
            this.fsQuad.render(renderer);
		}
	}
}