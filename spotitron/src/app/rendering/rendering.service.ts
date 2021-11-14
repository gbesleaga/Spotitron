import { Injectable } from '@angular/core';
import { SpotifyPlaylistTrackObject } from 'spotify-lib';

import * as THREE from 'three';
import { AnimationAction, AnimationClip, AnimationMixer, Clock, Vector3, VectorKeyframeTrack } from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

import { CountryDataService } from '../shared/country-data.service';
import { CountrySelectionService } from '../shared/country-selection.service';
import { CountryChart, Position2D } from '../shared/types';

import { Map3DGeometry } from './geometry/Map3DGeometry';
import { EffectComposer } from './postprocessing/effect-composer';
import { FXAAShader } from './shaders/fxaa-shader';
import { OutlinePass } from './postprocessing/outline-pass';
import { RenderPass } from './postprocessing/render-pass';
import { ShaderPass } from './postprocessing/shader-pass';
import { ClearPass } from './postprocessing/clear-pass';
import { NotificationsService, NotificationType } from 'notifications-lib';
import { MobileService } from '../shared/mobile.service';


// starfield
export enum StarfieldState {
    Halt,
    Cruise,
    Hyper
};

// rendering quality
export type Quality = "Low" | "Standard";

interface Animation {
    mixer: AnimationMixer;
    action: AnimationAction;
    reverseAction: AnimationAction | undefined;
}

const GLOBE_SCALE = 250.0;
const COUNTRY_EXTRUDE_SCALE = 1.3;
const COUNTRY_STARTING_SCALE = 1.005; // avoids z-fighting with globe

const HALT_SPEED = 0.0;
const ROTATIONAL_HALT_SPEED = 0.005;
const CRUISE_SPEED = 0.02;
const HYPER_SPEED = 10;

const ACCELERATION = 0.2; // 0.5

@Injectable({providedIn: 'root'})
export class RenderingService {

    private quality: Quality = "Low";
    private storageKeyForQuality = "STRON_quality"

    countrySelected: boolean = false;
    selectedCountryName: string = "";

    private selectableCountries: string[] = [];

    onCountrySelectedCallback: (() => void) | undefined = undefined;

    private sceneStarfield: THREE.Scene = new THREE.Scene();
    private starfieldQuad: THREE.Mesh | undefined;
    private starfieldState = StarfieldState.Cruise;
    private starfieldCurrentSpeedFactor = CRUISE_SPEED;
    private starfieldTargetSpeedFactor = -1;
    private starfieldForwardSpeedUniform = new THREE.Uniform(CRUISE_SPEED);
    private starfieldRotationalSpeedUniform = new THREE.Uniform(CRUISE_SPEED);

    private scene: THREE.Scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
    private controls: OrbitControls | undefined = undefined;
    private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
    private globe: THREE.Object3D = new THREE.Object3D();
    private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

    private countryDefaultMaterials: THREE.MeshBasicMaterial[] = [];
    private countryExtrudeSuffix = "_extrude";

    // postprocessing
    private composer: EffectComposer | undefined;
    private starfieldPass: RenderPass | undefined;
    private outlinePass: OutlinePass | undefined;
    private effectFXAA: ShaderPass | undefined;

    // initial positions
    // globe is at 0,0,0 and doesn't move
    private cameraInitialPosition = new THREE.Vector3(0, 600, 200);

    // camera dolly
    private cameraDollySpeed = 10;
    private cameraDollyOutMaxDist = 0;
    private cameraDollyInMaxDist = 450; // manually tested, might need to be adjusted if initial position is changed 

    // user input
    private mousePressed: boolean = false;
    private mouseMoved: boolean = false;
    private mousePosition: Position2D = {x: 0, y: 0};
    private mouseDragDelta: number = 5;

    // animations
    private clock = new Clock();
    private activeAnimations: Animation[] = [];
    private cameraAnimating: boolean = false;
    private cameraDollyUser = -1; // distance the user was before auto dolly animation

    // country extrude animation
    private countryExtrudeClip = new AnimationClip('extrude', -1, [
        new VectorKeyframeTrack(
            '.scale',
            [0, 1],     // times
            [
                COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE, 
                COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE
            ]  // values
        )
    ]);

    private countryIntrudeClip = new AnimationClip('intrude', -1, [
        new VectorKeyframeTrack(
            '.scale',
            [0, 1],     // times
            [
                COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, 
                COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE
            ]  // values
        )
    ]);

    private countryAnimations: Map<string, Animation> = new Map();

    // user input
    private onMouseDownBinding: (e: PointerEvent) => void;
    private onMouseUpBinding: (e: PointerEvent) => void;
    private onMouseMoveBinding: (e: PointerEvent) => void;
    private onWheelBinding: (e: WheelEvent) => void;

    // mobile
    private evCache = new Array();
    private prevDiff = -1;
    private tapCountryName: string = "";

    private onPointerCancelBinding: (e: PointerEvent) => void;
    private onPointerOutBinding: (e: PointerEvent) => void;
    private onPointerLeaveBinding: (e: PointerEvent) => void;

    constructor(
        private countryDataService: CountryDataService,
        private countrySelectionService: CountrySelectionService,
        private notificationService: NotificationsService,
        private mobileService: MobileService) {

            // determine default quality
            this.autoDetectQuality();

            this.onMouseDownBinding = this.onMouseDown.bind(this);
            this.onMouseUpBinding = this.onMouseUp.bind(this);
            this.onMouseMoveBinding = this.onMouseMove.bind(this);
            this.onWheelBinding = this.onWheel.bind(this);

            this.onPointerCancelBinding = this.onPointerCancel.bind(this);
            this.onPointerOutBinding = this.onPointerOut.bind(this);
            this.onPointerLeaveBinding = this.onPointerLeave.bind(this);

            this.countrySelectionService.onClearSelection().subscribe( () => {
                this.deselectCountry();
            });
    }


    private autoDetectQuality() {
        // if quality is already stored, use it
        const q = this.fetchQualityFromStorage();

        if (q) {
            this.quality = q;
            return;
        }

        // assume quality is low and then check if we can do better
        this.quality = "Low";

        let gl: WebGL2RenderingContext | WebGLRenderingContext | null = this.renderer.domElement.getContext('webgl2');

        if (!gl) {
            gl = this.renderer.domElement.getContext('webgl');
        }

        if (!gl) {
            return;
        }

        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');

        if (!dbgInfo) {
            return;
        }

        const renderer: string = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL);

        if (!renderer) {
            return;
        }

        const rendererLowerCase = renderer.toLowerCase();

        if (rendererLowerCase.includes('nvidia') || rendererLowerCase.includes('amd')) {
            this.quality = "Standard";
        }
    }
    

    public setQuality(q: Quality) {
        this.quality = q;
        this.storeQuality();

        if (!this.starfieldPass) {
            return;
        }

        switch(this.quality) {
            case "Low":
                this.starfieldPass.enabled = false;
                break;

            case "Standard":
                this.starfieldPass.enabled = true;
                break;
        }
    }

    private storeQuality(): void {
        try {
            localStorage.setItem(this.storageKeyForQuality, this.quality);
        } catch (e) {
            // do nothing
        }
    }

    public getQuality() {
        return this.quality;
    }

    private fetchQualityFromStorage(): Quality | null {
        const q = localStorage.getItem(this.storageKeyForQuality);

        if (q == "Low" || q == "Standard") {
            return q;
        }

        return null;
    }

    public init()
    {
        this.camera.position.copy(this.cameraInitialPosition);
        this.camera.lookAt(this.scene.position);
        this.scene.add(this.camera);

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const canvasPlaceholder = document.getElementById('canvas-placeholder');
        if (canvasPlaceholder) {
            canvasPlaceholder.appendChild(this.renderer.domElement);
        }

        // starfield
        const starfieldVS = document.getElementById('starfield-vs')?.textContent;
        const starfieldFS = document.getElementById('starfield-fs')?.textContent;

        this.starfieldQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
              uniforms: {
                  iSpeed: { value: 0.0 },
                  iSpeedRot: { value: 0.0 },
                  iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight)}
              },
              vertexShader: starfieldVS?starfieldVS:undefined,
              fragmentShader: starfieldFS?starfieldFS:undefined, 
              depthWrite: false,
              depthTest: false
            })
        );

        this.sceneStarfield.add(this.starfieldQuad);

        // render passes
        this.composer = new EffectComposer(this.renderer);

        const clearPass = new ClearPass(0x8e44ad, 1.0);
        this.composer.addPass( clearPass );

        this.starfieldPass = new RenderPass(this.sceneStarfield, this.camera);
        this.starfieldPass.clear = false;

        if (this.quality === "Low") {
            this.starfieldPass.enabled = false;
        }

        this.composer.addPass(this.starfieldPass);

        const renderPass = new RenderPass(this.scene, this.camera);
        renderPass.clear = false;
        this.composer.addPass(renderPass);

        this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera, undefined);
        this.composer.addPass(this.outlinePass);

        this.effectFXAA = new ShaderPass(new FXAAShader());
        this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
        this.composer.addPass(this.effectFXAA);

        this.resize();

        window.addEventListener('resize', () => this.resize(), false);
    }

    public initGlobe(charts: Map<string, CountryChart>) {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableZoom = false;

        this.cameraDollyOutMaxDist = this.camera.position.distanceTo(this.globe.position) * 1.5;

        this.globe.scale.set(GLOBE_SCALE, GLOBE_SCALE, GLOBE_SCALE);
        this.scene.add(this.globe);


        let radius =  0.995;

        let geometry = new THREE.SphereGeometry(radius, 90, 45);
        
        let material = new THREE.MeshBasicMaterial({ color: 0x2c3e50 });

        this.globe.add(new THREE.Mesh(geometry, material));

        //this.textureLoader.setCrossOrigin('*');

        const vs = document.getElementById("country-vs")?.textContent;
        const fs = document.getElementById("country-fs")?.textContent;

        // country default materials
        this.countryDefaultMaterials.push(
            new THREE.MeshBasicMaterial({ color: 0x1abc9c }),
            new THREE.MeshBasicMaterial({ color: 0x16a085 }),
            new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
            new THREE.MeshBasicMaterial({ color: 0x3498db }),
            new THREE.MeshBasicMaterial({ color: 0xf1c40f }),
            new THREE.MeshBasicMaterial({ color: 0xe67e22 }),
            new THREE.MeshBasicMaterial({ color: 0xe74c3c }),
            new THREE.MeshBasicMaterial({ color: 0xf39c12 }),
            new THREE.MeshBasicMaterial({ color: 0xd35400 }),
            new THREE.MeshBasicMaterial({ color: 0x27ae60 }),
            new THREE.MeshBasicMaterial({ color: 0x2980b9 }),
            new THREE.MeshBasicMaterial({ color: 0xc0392b })
        );

        let countries: any = this.countryDataService.geometryData;

        let i = 0;

        // key is url for number 1 song cover
        const countryMaterials = new Map<string, THREE.ShaderMaterial>();

        this.selectableCountries = [];

        for (let name in countries) {
            let cGeometry = new Map3DGeometry (countries[name], 1);
            let cGeometryExtrude = new Map3DGeometry (countries[name], 0)

            let material: THREE.ShaderMaterial | THREE.MeshBasicMaterial | undefined = this.countryDefaultMaterials[i % this.countryDefaultMaterials.length];
            let url = '';

            // country has chart?
            const countryChart = charts.get(name);
            if (countryChart) {
                const playlistItems = countryChart.tracks.items as SpotifyPlaylistTrackObject[];

                if (playlistItems.length > 0) {
                    const nImages = playlistItems[0].track.album.images.length;
                    if (nImages) {
                        url = playlistItems[0].track.album.images[0].url; // picking largest size
                    }

                    this.selectableCountries.push(name); // country is selectable
                }
            }

            // we got an image?
            if (url) {
                material = countryMaterials.get(url);

                if (!material) {
                    // no material yet, so create it

                    material = new THREE.ShaderMaterial({
                        uniforms: { 
                            tMatCap: { value: this.textureLoader.load(url) }
                        },
                        vertexShader: vs?vs:"",
                        fragmentShader: fs?fs:""
                    });
                
                    material.uniforms.tMatCap.value.wrapS = material.uniforms.tMatCap.value.wrapT = THREE.ClampToEdgeWrapping;

                    countryMaterials.set(url, material);
                }
            }

            let cMesh = new THREE.Mesh(cGeometry, material);
            let cMeshExtrude = new THREE.Mesh(cGeometryExtrude, material);
            
            cMesh.visible = true;
            cMeshExtrude.visible = false;

            cMesh.name = name;
            cMeshExtrude.name = name + this.countryExtrudeSuffix;

            cMesh.scale.set(COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE);
            cMeshExtrude.scale.set(COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE, COUNTRY_STARTING_SCALE);

            this.globe.add(cMesh);
            this.globe.add(cMeshExtrude);

            // country animations
            const cMixer = new AnimationMixer(cMeshExtrude);
            cMixer.addEventListener('finished', (e) => {
                for (let i = 0; i < this.activeAnimations.length; ++i) {
                    let found: boolean = false;

                    if (this.activeAnimations[i].action === e.action) {
                        found = true;
                    } else if (this.activeAnimations[i].reverseAction === e.action) {
                        found = true;
                        cMesh.visible = true;
                        cMeshExtrude.visible = false;
                    }

                    if (found) {
                        this.activeAnimations.splice(i, 1);
                        break;
                    }
                }
            });

            const cAction = cMixer.clipAction(this.countryExtrudeClip);
            cAction.setLoop(THREE.LoopOnce, 1);
            cAction.clampWhenFinished = true;
            
            const cReverseAction = cMixer.clipAction(this.countryIntrudeClip);
            cReverseAction.setLoop(THREE.LoopOnce, 1);
            cReverseAction.clampWhenFinished = true;

            this.countryAnimations.set(name, {mixer: cMixer, action: cAction, reverseAction: cReverseAction });

            // loop
            i++;
        }

        // event listening
        this.enableUserInput();
    }

    public hideGlobe() {
        this.globe.visible = false;
        if (this.controls) {
            this.controls.enabled = false;
        }
    }

    public enableUserInput() {
        this.renderer.domElement.addEventListener('pointerdown', this.onMouseDownBinding);
        this.renderer.domElement.addEventListener('pointermove', this.onMouseMoveBinding);
        this.renderer.domElement.addEventListener('pointerup', this.onMouseUpBinding);
        this.renderer.domElement.addEventListener('wheel', this.onWheelBinding);

        this.renderer.domElement.addEventListener('pointercancel', this.onPointerCancelBinding);
        this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeaveBinding);
        this.renderer.domElement.addEventListener('pointerout', this.onPointerOutBinding);
    }

    public disableUserInput() {
        this.renderer.domElement.removeEventListener('pointerdown', this.onMouseDownBinding);
        this.renderer.domElement.removeEventListener('pointermove', this.onMouseMoveBinding);
        this.renderer.domElement.removeEventListener('pointerup', this.onMouseUpBinding);
        this.renderer.domElement.removeEventListener('wheel', this.onWheelBinding);

        this.renderer.domElement.removeEventListener('pointercancel', this.onPointerCancelBinding);
        this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeaveBinding);
        this.renderer.domElement.removeEventListener('pointerout', this.onPointerOutBinding);

        this.evCache = new Array();
        this.prevDiff = -1;
    }

    public render() {
        //animations
        const delta = this.clock.getDelta();

        //starfield
        if (this.starfieldQuad) {
            if (this.starfieldTargetSpeedFactor >= 0) {
                if (this.starfieldCurrentSpeedFactor < this.starfieldTargetSpeedFactor) {
                    this.starfieldCurrentSpeedFactor += delta * ACCELERATION;

                    if (this.starfieldCurrentSpeedFactor >= this.starfieldTargetSpeedFactor) {
                        this.starfieldCurrentSpeedFactor = this.starfieldTargetSpeedFactor;
                        this.starfieldTargetSpeedFactor = -1;
                    }
                }
            }

            const material = this.starfieldQuad.material as THREE.ShaderMaterial;

            const t = this.clock.getElapsedTime();
            this.starfieldForwardSpeedUniform.value = this.starfieldCurrentSpeedFactor * t;
            material.uniforms['iSpeed'] = this.starfieldForwardSpeedUniform; 

            switch(this.starfieldState) {
                case StarfieldState.Halt:
                    this.starfieldRotationalSpeedUniform.value = ROTATIONAL_HALT_SPEED * t;
                    break;

                case StarfieldState.Cruise:
                    this.starfieldRotationalSpeedUniform.value = this.starfieldForwardSpeedUniform.value;
                    break;

                case StarfieldState.Hyper:
                    this.starfieldRotationalSpeedUniform.value = this.starfieldForwardSpeedUniform.value / 2.0;
                    break;
            }

            material.uniforms['iSpeedRot'] = this.starfieldRotationalSpeedUniform;
        }

        for (let animation of this.activeAnimations) {
            animation.mixer.update(delta);
        }

        if (this.cameraAnimating) {
            this.camera.lookAt(0,0,0); // keep camera looking at center
        }

        this.composer?.render();
    };

    public resize() {
        if (this.renderer.domElement.parentElement) {
            let w = window.innerWidth;
            let h = window.innerHeight;

            // notify the renderer of the size change
            this.renderer.setSize(w, h);
            this.composer?.setSize(w,h);
            this.effectFXAA?.uniforms[ 'resolution' ].value.set( 1 / w, 1 / h );

            if (this.starfieldQuad) {
                const material = this.starfieldQuad.material as THREE.ShaderMaterial;
                material.uniforms['iResolution'] = new THREE.Uniform(new THREE.Vector2(w, h));
            }

            // update the camera
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    public setStarfieldState(state: StarfieldState) {
        if (this.starfieldState === state) {
            return;
        }

        switch (state) {
            case StarfieldState.Halt:
                this.starfieldCurrentSpeedFactor = HALT_SPEED;
                this.starfieldTargetSpeedFactor = -1;
                break;

            case StarfieldState.Cruise:
                this.starfieldCurrentSpeedFactor = CRUISE_SPEED;
                this.starfieldTargetSpeedFactor = -1;
                break;

            case StarfieldState.Hyper:
                this.starfieldTargetSpeedFactor = HYPER_SPEED;
                break;
        }

        this.starfieldState = state;
    }

    private onMouseDown(e: PointerEvent) {
        this.mousePressed = true;
        this.mouseMoved = false;

        this.mousePosition.x = e.pageX;
        this.mousePosition.y = e.pageY;

        if (this.mobileService.isOnMobile()) {
            // pinch
            this.evCache.push(e);
        }
    }

    private onMouseMove(e: PointerEvent) {
        if (this.mousePressed) {
            if (Math.abs(this.mousePosition.x - e.pageX) > this.mouseDragDelta ||
                Math.abs(this.mousePosition.y - e.pageY) > this.mouseDragDelta) {
                this.mouseMoved = true;
            }
        } else {
            this.doOutline(e);
        }

        if (this.mobileService.isOnMobile()) {
            // pinch
            // Find this event in the cache and update its record with this event
            for (let i = 0; i < this.evCache.length; i++) {
                if (e.pointerId == this.evCache[i].pointerId) {
                    this.evCache[i] = e;
                    break;
                }
            }

            // If two pointers are down, check for pinch gestures
            if (this.evCache.length == 2) {
                // Calculate the distance between the two pointers
                let curDiff = Math.sqrt(
                    Math.pow(this.evCache[0].clientX - this.evCache[1].clientX, 2) +
                    Math.pow(this.evCache[0].clientY - this.evCache[1].clientY, 2)
                );
                
                if (this.prevDiff > 0) {
                    if (curDiff > this.prevDiff) {
                        // The distance between the two pointers has increased
                        this.doDolly('in');
                    }
                    
                    if (curDiff < this.prevDiff) {
                        // The distance between the two pointers has decreased
                        this.doDolly('out');
                    }
                }
 
                // Cache the distance for the next move event
                this.prevDiff = curDiff;
            }
        }
    }

    private doOutline(e: PointerEvent) {
        if (this.outlinePass) {
            const country = this.getCountryUnderMouse(e);

            if (country) {
                this.outlinePass.selectedObjects = [country];
                this.countrySelectionService.hoverCountry(country.name);
            } else {
                this.outlinePass.selectedObjects = [];
                this.countrySelectionService.hoverCountry("");
            }
        }
    }

    private onMouseUp(e: PointerEvent) {
        this.mousePressed = false;

        if (this.mobileService.isOnMobile()) {
            // pinch
            this.removeEvent(e);
        }

        if (this.mouseMoved) {
            return;
        }

        if (this.mobileService.isOnMobile()) {
            const country = this.getCountryUnderMouse(e);
            if (country && country.name) {
                if(country.name !== this.tapCountryName) {
                    // first tap outlines
                    this.tapCountryName = country.name;
                    this.doOutline(e);
                } else {
                    // second tap selects
                    this.doSelect(e);
                    this.tapCountryName = "";
                }
            }            
        } else {
           this.doSelect(e);
        }
    }

    private doSelect(e: PointerEvent) {
        const country = this.getCountryUnderMouse(e);

        if (country) {
            this.selectCountry(country.name);
            if (this.outlinePass) {
                this.outlinePass.selectedObjects = [country];
                this.countrySelectionService.hoverCountry(country.name);
            }   
        }
    }

    private removeEvent(e: PointerEvent) {
        // Remove this event from the target's cache
        for (let i = 0; i < this.evCache.length; i++) {
            if (this.evCache[i].pointerId == e.pointerId) {
                this.evCache.splice(i, 1);
                break;
            }
        }

        if (this.evCache.length < 2) {
            this.prevDiff = -1;
        }
    }
    
    private onPointerCancel(e: PointerEvent) {
        if (this.mobileService.isOnMobile()) {
            this.removeEvent(e);
        }
    }

    private onPointerOut(e: PointerEvent) {
        if (this.mobileService.isOnMobile()) {
            this.removeEvent(e);
        }
    }

    private onPointerLeave(e: PointerEvent) {
        if (this.mobileService.isOnMobile()) {
            this.removeEvent(e);
        }
    }

    private onWheel(e: WheelEvent) {
        e.preventDefault();

        if (Math.sign(e.deltaY) < 0) {
            // - is wheel forward, i.e camera moves in
            this.doDolly('in');
        } else {
            // + is wheel backwards, i.e camera moves out
            this.doDolly('out');
        }
    }

    private doDolly(direction: 'in' | 'out') {
        // bounds won't be exact but that's good enough
        const dist = this.camera.position.distanceTo(this.globe.position);

        const cameraDisplacementVector = (this.globe.position.clone().sub(this.camera.position)).normalize();
        cameraDisplacementVector.multiplyScalar(this.cameraDollySpeed);

        if (direction === 'in') { 
            // only move in if we are not already too close
            if (dist > this.cameraDollyInMaxDist) {
                this.camera.position.add(cameraDisplacementVector);
            }
        } else {
            // only move out if we are not already too far away
            if (dist < this.cameraDollyOutMaxDist) {
                this.camera.position.sub(cameraDisplacementVector);
            }
        }

        this.controls?.update();
    }

    private getCountryUnderMouse(event: PointerEvent): THREE.Object3D | null {
        // calculate mouse position in normalized device coordinates
	    // (-1 to +1) for both components
        const mouse = new THREE.Vector2();
	    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

        let raycaster = new THREE.Raycaster ();
        
        // update the picking ray with the camera and mouse position
	    raycaster.setFromCamera( mouse, this.camera );

	    // calculate objects intersecting the picking ray
	    const intersects = raycaster.intersectObject(this.scene, true);

        if (intersects && intersects[0]) {
            let mesh = intersects[0].object;
            if (mesh.visible && mesh.name) {
                return mesh;
            }
        }

        return null;
    }

    public selectCountry(country: string) {
        const countryObj = this.globe.getObjectByName(country);
        const countryObjExtrude = this.globe.getObjectByName(country + this.countryExtrudeSuffix);

        if ((this.selectableCountries.indexOf(country) !== -1) && countryObj && countryObjExtrude) {
            countryObj.visible = false;
            countryObjExtrude.visible = true;

            //disable user input
            this.disableUserInput();

            // start country extrude animation
            const animation = this.countryAnimations.get(country);

            if (animation) {
                animation.mixer.setTime(0);
                animation.action.paused = false;
                animation.action.play();
                this.activeAnimations.push(animation);
            }

            // move camera above country
            this.cameraAnimating = true;
            this.cameraDollyUser = this.camera.position.distanceTo(this.globe.position);
            this.selectedCountryName = country;

            const center = this.getCenterPointOfMesh(countryObj as THREE.Mesh);

            // move along the direction of center globe (0,0,0) and this point (away from center)
            const direction = center.normalize();
            const newCameraPosition = direction.multiplyScalar(this.cameraDollyInMaxDist);

            const cameraMoveClip = new AnimationClip('move-n-look', -1, [
                new VectorKeyframeTrack(
                    '.position',
                    [0, 1],     // times
                    [this.camera.position.x, this.camera.position.y, this.camera.position.z, newCameraPosition.x, newCameraPosition.y, newCameraPosition.z]  // values
                )
            ]);

            const mixer = new AnimationMixer(this.camera);
            mixer.addEventListener('finished', (e) => {
                this.cameraAnimating = false;
                this.controls?.update();
                this.countrySelected = true;
                
                this.countrySelectionService.selectCountry(this.selectedCountryName);

                for (let i = 0; i < this.activeAnimations.length; ++i) {
                    if (this.activeAnimations[i].action === e.action) {
                        this.activeAnimations.splice(i, 1);
                        break;
                    }
                }
            });

            const action = mixer.clipAction(cameraMoveClip);
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;

            this.activeAnimations.push({mixer: mixer, action: action, reverseAction: undefined});

            action.play();
        } else {
            this.notificationService.notify({type: NotificationType.INFO, msg: "No chart data for: " + country});
        }
    }

    public deselectCountry() {
        // reverse country extrude animation
        const animation = this.countryAnimations.get(this.selectedCountryName);

        if (animation && animation.reverseAction) {
            animation.mixer.setTime(0);
            animation.reverseAction.paused = false;
            animation.reverseAction.play();
            this.activeAnimations.push(animation);
        }
        
        this.countrySelected = false;
        this.selectedCountryName = "";

        if (this.cameraDollyUser > 0) {
            // move camera back to user defined distance
            this.cameraAnimating = true;

            let newCameraPosition = this.camera.position.clone();
            newCameraPosition.sub(this.globe.position);
            newCameraPosition.normalize();
            newCameraPosition.multiplyScalar(this.cameraDollyUser);

            const cameraMoveClip = new AnimationClip('move-back-n-look', -1, [
                new VectorKeyframeTrack(
                    '.position',
                    [0, 1],     // times
                    [this.camera.position.x, this.camera.position.y, this.camera.position.z, newCameraPosition.x, newCameraPosition.y, newCameraPosition.z]  // values
                )
            ]);

            const mixer = new AnimationMixer(this.camera);
            mixer.addEventListener('finished', (e) => {
                this.cameraAnimating = false;
                this.controls?.update();

                //enable user input
                this.enableUserInput();
                
                for (let i = 0; i < this.activeAnimations.length; ++i) {
                    if (this.activeAnimations[i].action === e.action) {
                        this.activeAnimations.splice(i, 1);
                        break;
                    }
                }
            });

            const action = mixer.clipAction(cameraMoveClip);
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;

            this.activeAnimations.push({mixer: mixer, action: action, reverseAction: undefined});

            action.play();
        }
    }

    private getCenterPointOfMesh(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        
        let center = new THREE.Vector3();
        geometry.boundingBox!.getCenter(center);
        
        mesh.localToWorld(center );
        
        return center;
    }
}