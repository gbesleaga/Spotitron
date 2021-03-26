import {
	OrthographicCamera,
	PlaneGeometry,
	Mesh,
    Material,
    Renderer,
    WebGLRenderer,
    WebGLRenderTarget
} from 'three';

abstract class Pass {
	// if set to true, the pass is processed by the composer
	enabled = true;

	// if set to true, the pass indicates to swap read and write buffer after rendering
	needsSwap = true;

	// if set to true, the pass clears its buffer before rendering
	clear = false;

	// if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
	renderToScreen = false;

    abstract setSize(width: number, height: number): void;

    //TODO figure out these any's
    abstract render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void;
}

export { Pass };

// Helper for passes that need to fill the viewport with a single quad.

// Important: It's actually a hack to put FullScreenQuad into the Pass namespace. This is only
// done to make examples/js code work. Normally, FullScreenQuad should be exported
// from this module like Pass.

export class FullScreenQuad {
    camera = new OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	geometry = new PlaneGeometry( 2, 2 );
    _mesh: Mesh;

    constructor(material: Material | undefined) {
		this._mesh = new Mesh(this.geometry, material);
	};

    getMaterial() {
        return this._mesh.material;
    }

    setMaterial(value: Material) {
        this._mesh.material = value;
    }

    dispose() {
        this._mesh.geometry.dispose();
    }

    render(renderer: Renderer) {
        renderer.render(this._mesh, this.camera);
    }
}