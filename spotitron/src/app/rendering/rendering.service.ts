import { Injectable } from '@angular/core';
import { SpotifyPlaylistTrackObject } from 'spotify-lib';

import * as THREE from 'three';
import { AnimationAction, AnimationClip, AnimationMixer, Clock, VectorKeyframeTrack } from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

import { CountryDataService } from '../shared/country-data.service';
import { CountrySelectionService } from '../shared/country-selection.service';
import { CountryChart, Position2D } from '../shared/types';

import { Map3DGeometry } from './geometry/Map3DGeometry';
import { EffectComposer } from './postprocessing/effect-composer';
import { FXAAShader } from './postprocessing/fxaa-shader';
import { OutlinePass } from './postprocessing/outline-pass';
import { RenderPass } from './postprocessing/render-pass';
import { ShaderPass } from './postprocessing/shared-pass';

interface Animation {
    mixer: AnimationMixer;
    action: AnimationAction;
    reverseAction: AnimationAction | undefined;
}

const COUNTRY_EXTRUDE_SCALE = 1.3;

@Injectable({providedIn: 'root'})
export class RenderingService {

    constructor(
        private countryDataService: CountryDataService,
        private countrySelectionService: CountrySelectionService) {
            this.countrySelectionService.onClearSelection().subscribe( () => {
                this.deselectCountry();
            });
    }

    countrySelected: boolean = false;
    selectedCountryName: string = "";

    onCountrySelectedCallback: (() => void) | undefined = undefined;

    private scene: THREE.Scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
    private controls: OrbitControls | undefined = undefined;
    // TODO add renderer to main view component
    private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
    private globe: THREE.Object3D = new THREE.Object3D();
    private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

    private countryExtrudeSuffix = "_extrude";

    // postprocessing
    private composer: EffectComposer | undefined;
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

    //animations
    private clock = new Clock();
    private activeAnimations: Animation[] = [];
    private cameraAnimating: boolean = false;

    // country extrude animation
    private countryExtrudeClip = new AnimationClip('extrude', -1, [
        new VectorKeyframeTrack(
            '.scale',
            [0, 1],     // times
            [1.0, 1.0, 1.0, COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE]  // values
        )
    ]);

    private countryIntrudeClip = new AnimationClip('intrude', -1, [
        new VectorKeyframeTrack(
            '.scale',
            [0, 1],     // times
            [COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, COUNTRY_EXTRUDE_SCALE, 1.0, 1.0, 1.0]  // values
        )
    ]);

    private countryAnimations: Map<string, Animation> = new Map();


    public init(charts: Map<string, CountryChart>) {
        this.camera.position.copy(this.cameraInitialPosition);
        this.camera.lookAt(this.scene.position);
        this.scene.add(this.camera);

        this.renderer.setSize( window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xff0000);

        const canvasPlaceholder = document.getElementById('canvas-placeholder');
        if (canvasPlaceholder) {
            canvasPlaceholder.appendChild(this.renderer.domElement);
        }
    
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableZoom = false;

        this.cameraDollyOutMaxDist = this.camera.position.distanceTo(this.globe.position) * 1.5;

        this.globe.scale.set(250, 250, 250);
        this.scene.add(this.globe);


        let radius =  0.995;
        let geometry = new THREE.SphereGeometry(radius, 30, 15);
        let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );

        //this.textureLoader.setCrossOrigin('*');

        const vs = document.getElementById( "sem-vs" )?.textContent;
        const fs = document.getElementById( "sem-fs" )?.textContent;

        //console.log(vs);

        const defaultCountryMaterial = new THREE.ShaderMaterial({
            uniforms: { 
                tMatCap: { value: this.textureLoader.load("https://jbouny.github.io/texturing-intro-slides/iframes/resources/original/uv-test.png") }
            },
            vertexShader: vs?vs:"",
            fragmentShader: fs?fs:""
        });
    
        defaultCountryMaterial.uniforms.tMatCap.value.wrapS = defaultCountryMaterial.uniforms.tMatCap.value.wrapT = THREE.ClampToEdgeWrapping;

        this.globe.add(new THREE.Mesh(geometry, material));

        let countries: any = this.countryDataService.geometryData;

        let i = 0;

        // key is url for number 1 song cover
        const countryMaterials = new Map<string, THREE.ShaderMaterial>();

        for (let name in countries) {
            let cGeometry = new Map3DGeometry (countries[name], 2);
            let cGeometryExtrude = new Map3DGeometry (countries[name], 0)

            let material: THREE.ShaderMaterial | undefined = defaultCountryMaterial;
            let url = '';

            // country has chart?
            const countryChart = charts.get(name);
            if (countryChart) {
                const playlistItems = countryChart.tracks.items as SpotifyPlaylistTrackObject[];

                if (playlistItems.length > 0) {
                    const nImages = playlistItems[0].track.album.images.length;
                    if (nImages) {
                        //TODO which size do we want; we are picking largest here
                        url = playlistItems[0].track.album.images[0].url;
                    }
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

            let cMesh = new THREE.Mesh (cGeometry, material);
            let cMeshExtrude = new THREE.Mesh (cGeometryExtrude, material);
            
            //TODO are we smart about this or will everything be considered for rendering??
            cMesh.visible = true;
            cMeshExtrude.visible = false;

            cMesh.name = name;
            cMeshExtrude.name = name + this.countryExtrudeSuffix;

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

        // postprocessing
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera, undefined);
        this.composer.addPass(this.outlinePass);

        this.textureLoader.load('/assets/images/tri_pattern.jpg', (texture) => {
            this.outlinePass!.patternTexture = texture;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        });

        this.effectFXAA = new ShaderPass(new FXAAShader());
        this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
        this.composer.addPass(this.effectFXAA);

        // event listening
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('pointerup', (e) =>   this.onMouseUp(e));
        this.renderer.domElement.addEventListener('wheel', (e) =>   this.onWheel(e));

        window.addEventListener('resize', () => this.resize(), false);

        this.resize();
    }

    public render() {
        this.composer?.render();

        //animations
        const delta = this.clock.getDelta();

        for (let animation of this.activeAnimations) {
            animation.mixer.update(delta);
        }

        if (this.cameraAnimating) {
            this.camera.lookAt(0,0,0); // keep camera looking at center
        }
    };

    public resize() {
        if (this.renderer.domElement.parentElement) {
            let w = window.innerWidth;
            let h = window.innerHeight;

            // notify the renderer of the size change
            this.renderer.setSize(w, h);
            this.composer?.setSize(w,h);
            this.effectFXAA?.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );

            // update the camera
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    private onMouseDown(e: MouseEvent) {
        this.mousePressed = true;
        this.mouseMoved = false;

        this.mousePosition.x = e.pageX;
        this.mousePosition.y = e.pageY;
    }

    private onMouseMove(e: MouseEvent) {
        if (this.mousePressed) {
            if (Math.abs(this.mousePosition.x - e.pageX) > this.mouseDragDelta ||
                Math.abs(this.mousePosition.y - e.pageY) > this.mouseDragDelta) {
                this.mouseMoved = true;
            }
        } else {
            if (this.outlinePass) {
                const country = this.getCountryUnderMouse(e);

                if (country) {
                    this.outlinePass.selectedObjects = [country];
                } else {
                    this.outlinePass.selectedObjects = [];
                }
            }
        }
    }

    private onMouseUp(e: MouseEvent) {
        this.mousePressed = false;

        if (!this.mouseMoved) {
            const country = this.getCountryUnderMouse(e);

            if (country) {
                this.selectCountry(country.name);
                if (this.outlinePass) {
                    this.outlinePass.selectedObjects = [country];
                }   
            }
        }
    }

    private onWheel(e: WheelEvent) {
        e.preventDefault();

        // bounds won't be exact but that's good enough
        const dist = this.camera.position.distanceTo(this.globe.position);

        const cameraDisplacementVector = (this.globe.position.clone().sub(this.camera.position)).normalize();
        cameraDisplacementVector.multiplyScalar(this.cameraDollySpeed);

        if (Math.sign(e.deltaY) < 0) {
            //  - is wheel forward, i.e camera moves in
            // only move in if we are not already too close
            if (dist > this.cameraDollyInMaxDist) {
                this.camera.position.add(cameraDisplacementVector);
            }
        } else {
            // + is wheel backwards, i.e camera moves out
            // only move out if we are not already too far away
            if (dist < this.cameraDollyOutMaxDist) {
                this.camera.position.sub(cameraDisplacementVector);
            }
        }

        this.controls?.update();
    }

    private getCountryUnderMouse(event: MouseEvent): THREE.Object3D | null {
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

        if (countryObj && countryObjExtrude) {
            countryObj.visible = false;
            countryObjExtrude.visible = true;

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