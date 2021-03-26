import { Injectable } from '@angular/core';
import { SpotifyPlaylistTrackObject } from 'spotify-lib';

import * as THREE from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

import { CountryDataService } from '../shared/country-data.service';
import { CountryChart, Position2D } from '../shared/types';

import { Map3DGeometry } from './geometry/Map3DGeometry';
import { EffectComposer } from './postprocessing/effect-composer';
import { FXAAShader } from './postprocessing/fxaa-shader';
import { OutlinePass } from './postprocessing/outline-pass';
import { RenderPass } from './postprocessing/render-pass';
import { ShaderPass } from './postprocessing/shared-pass';

@Injectable({providedIn: 'root'})
export class RenderingService {

    constructor(private countryDataService: CountryDataService) {
    }

    private scene: THREE.Scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
    private controls: OrbitControls | undefined = undefined;
    // TODO add renderer to main view component
    private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
    private globe: THREE.Object3D = new THREE.Object3D();
    private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

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


    public init(charts: Map<string, CountryChart>) {
        this.camera.position.copy(this.cameraInitialPosition);
        this.camera.lookAt(this.scene.position);
        this.scene.add(this.camera);

        this.renderer.setSize( window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xff0000);

        document.body.appendChild( this.renderer.domElement );
    
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

        let countries: any = this.countryDataService.data;

        let i = 0;

        // key is url for number 1 song cover
        const countryMaterials = new Map<string, THREE.ShaderMaterial>();

        for (var name in countries) {
            //console.log(name);
            let cGeometry = new Map3DGeometry (countries[name], 0);

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
            
            cMesh.name = name;
            this.globe.add(cMesh);

            i++;
        }


        // postprocessing
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.outlinePass = new OutlinePass( new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera, undefined);
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
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('mouseup', (e) =>   this.onMouseUp(e));
        this.renderer.domElement.addEventListener('wheel', (e) =>   this.onWheel(e));

        window.addEventListener('resize', () => this.resize(), false);

        this.resize();
    }

    public render() {
        this.composer?.render();
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
                this.selectCountry(country);
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
            if (mesh.name) {
                //console.log(mesh.name);
                return mesh;
            }
        }

        return null;
    }

    public selectCountry(countryObj: THREE.Object3D) {    
        countryObj.scale.x = 1.5;
        countryObj.scale.y = 1.5;
        countryObj.scale.z = 1.5;
    }
}