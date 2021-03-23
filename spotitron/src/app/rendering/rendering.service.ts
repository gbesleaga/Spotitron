import { Injectable } from '@angular/core';

import * as THREE from 'three';

import { Map3DGeometry } from './Map3DGeometry';

import countryData from '../../assets/countries/data.json'

@Injectable({providedIn: 'root'})
export class RenderingService {

    private scene: THREE.Scene = new THREE.Scene();
    private camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
    private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
    private globe: THREE.Object3D = new THREE.Object3D();
    private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

    public init() {

        this.camera.position.set(0, 600, 800);
        this.camera.lookAt(this.scene.position);
        this.scene.add(this.camera);

        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.setClearColor(0xffffff);

        document.body.appendChild( this.renderer.domElement );
    
        this.globe.scale.set(250, 250, 250);
        this.scene.add(this.globe);

        let radius =  0.995;
        let geometry = new THREE.SphereGeometry(radius, 30, 15);
        let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );

        //this.textureLoader.setCrossOrigin('*');

        const vs = document.getElementById( "sem-vs" )?.textContent;
        const fs = document.getElementById( "sem-fs" )?.textContent;

        //console.log(vs);

        const usaMaterial = new THREE.ShaderMaterial({
            uniforms: { 
                tMatCap: { value: this.textureLoader.load("https://jbouny.github.io/texturing-intro-slides/iframes/resources/original/uv-test.png") }
            },
            vertexShader: vs?vs:"",
            fragmentShader: fs?fs:""
        });
    
        usaMaterial.uniforms.tMatCap.value.wrapS = usaMaterial.uniforms.tMatCap.value.wrapT = THREE.ClampToEdgeWrapping;

        this.globe.add(new THREE.Mesh(geometry, material));

        let countries: any = countryData;

        let i = 0;

        for (var name in countries) {
            //console.log(name);
            let cGeometry = new Map3DGeometry (countries[name], 0);
            let cMesh = new THREE.Mesh (cGeometry, usaMaterial);
            
            cMesh.name = name;
            this.globe.add(cMesh);

            i++;
        }

        this.renderer.domElement.addEventListener('click', (event) => this.selectCountry(event));

        window.addEventListener('resize', () => this.resize(), false);

        this.resize();
    }

    public render() {
        this.globe.rotation.y += 0.001;
        this.renderer.render( this.scene, this.camera );
    };

    public resize() {
        if (this.renderer.domElement.parentElement) {
            let w = window.innerWidth;
            let h = window.innerHeight;

            // notify the renderer of the size change
            this.renderer.setSize(w, h);
            // update the camera
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    public selectCountry(event: MouseEvent) {
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
                console.log(mesh.name);
                //console.log(mesh.scale);

                mesh.scale.x = 1.5;
                mesh.scale.y = 1.5;
                mesh.scale.z = 1.5;
            }
        }
    }
}