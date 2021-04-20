import * as THREE from 'three';


class Face3 {
    constructor(public a: number, public b: number, public c: number, public vertexNormals?: THREE.Vector3[]) {}
}

export interface CountryRenderData {
    vertices: number[];   // [lat, lon, ...]
    triangles: number[];  // [tri i-s, ...]
    polygons: number[][][]; // [[poly indices, hole i-s, ...], ...]
}

export class Map3DGeometry extends THREE.BufferGeometry {
    constructor(data: CountryRenderData, innerRadius: number) {
        super();

        let vertices: THREE.Vector3 [] = [];
        let faces: Face3[] = [];
        let faceVertexUvs: THREE.Vector2[][][] = [[]];
        
        var i, uvs = [];
        for (i = 0; i < data.vertices.length; i += 2) {
            var lon = data.vertices[i];
            var lat = data.vertices[i + 1];
            
            // colatitude
            var phi = +(90 - lat) * 0.01745329252; // Math.PI / 180
            // azimuthal angle
            var the = +(180 - lon) * 0.01745329252;
            
            // translate into XYZ coordinates
            var wx = Math.sin (the) * Math.sin (phi) * -1;
            var wz = Math.cos (the) * Math.sin (phi);
            var wy = Math.cos (phi);

            // equirectangular projection
            var wu = 0.5 + lon / 360.0;
            var wv = 0.5 + lat / 180.0;
            
            vertices.push (new THREE.Vector3 (wx, wy, wz));
            uvs.push (new THREE.Vector2 (wu, wv));
        }

        // spread uv coords to [0, 1]
        let uLow = 1.0, uHigh = 0.0, vLow = 1.0, vHigh = 0.0;

        for (let coords of uvs) {
            if (coords.x < uLow) {
                uLow = coords.x;
            } else if (coords.x > uHigh) {
                uHigh = coords.x;
            }
            
            if (coords.y < vLow) {
                vLow = coords.y;
            } else if (coords.y > vHigh) {
                vHigh = coords.y;
            }
        }

        const uSpread = uHigh - uLow;
        const vSpread = vHigh - vLow;

        for (let i = 0; i < uvs.length; ++i) {
            uvs[i].setX( (uvs[i].x - uLow) / uSpread);
            uvs[i].setY( (uvs[i].y - vLow) / vSpread);
        }
	
	    var n = vertices.length;
	
        if (innerRadius <= 1) {
            for (i = 0; i < n; i++) {
                var v = vertices[i];
                vertices.push (v.clone().multiplyScalar(innerRadius));
            }
        }
	
        for (i = 0; i < data.triangles.length; i += 3) {
            var a = data.triangles[i];
            var b = data.triangles[i + 1];
            var c = data.triangles[i + 2];
            
            faces.push(new Face3( a, b, c, [vertices[a], vertices[b], vertices[c]] ) );
            faceVertexUvs[0].push([uvs[a], uvs[b], uvs[c]]);
                    
            if ((0 < innerRadius) && (innerRadius <= 1)) {
                faces.push(new Face3( n + b, n + a, n + c, [
                    vertices[b].clone ().multiplyScalar (-1),
                    vertices[a].clone ().multiplyScalar (-1),
                    vertices[c].clone ().multiplyScalar (-1)
                ] ) );
                
                faceVertexUvs[0].push([uvs[b], uvs[a], uvs[c]]); // shitty uvs to make 3js exporter happy
            }
        }
        
        // extrude
        if (innerRadius < 1) {
            for (i = 0; i < data.polygons.length; i++) {
                var polyWithHoles = data.polygons[i];
                for (var j = 0; j < polyWithHoles.length; j++) {
                    var polygonOrHole = polyWithHoles[j];
                    for (var k = 0; k < polygonOrHole.length; k++) {
                        var a = polygonOrHole[k], b = polygonOrHole[(k + 1) % polygonOrHole.length];
                        var va1 = vertices[a], vb1 = vertices[b];
                        var va2 = vertices[n + a], vb2 = vertices[n + b];
                        var normal;
                        if (j < 1) {
                            // polygon
                            normal = vb1.clone ().sub (va1).cross ( va2.clone ().sub (va1) ).normalize ();
                            faces.push ( new Face3( a, b, n + a, [ normal, normal, normal ] ) );
                            faceVertexUvs[0].push([uvs[a], uvs[b], uvs[a]]); // shitty uvs to make 3js exporter happy
                            if (innerRadius > 0) {
                                faces.push ( new Face3( b, n + b, n + a, [ normal, normal, normal ] ) );
                                faceVertexUvs[0].push([uvs[b], uvs[b], uvs[a]]); // shitty uvs to make 3js exporter happy
                            }
                        } else {
                            // hole
                            normal = va2.clone ().sub (va1).cross ( vb1.clone ().sub (va1) ).normalize ();
                            faces.push ( new Face3( b, a, n + a, [ normal, normal, normal ] ) );
                            faceVertexUvs[0].push([uvs[b], uvs[a], uvs[a]]); // shitty uvs to make 3js exporter happy
                            if (innerRadius > 0) {
                                faces.push ( new Face3( b, n + a, n + b, [ normal, normal, normal ] ) );
                                faceVertexUvs[0].push([uvs[b], uvs[a], uvs[b]]); // shitty uvs to make 3js exporter happy
                            }
                        }
                    }
                }
            }
        }

        //TODO Refactor all this data moving around
        let verticeBuffer = [];
        let uvBuffer = [];

        for(let face of faces) {
            verticeBuffer.push(vertices[face.a].x, vertices[face.a].y, vertices[face.a].z);
            verticeBuffer.push(vertices[face.b].x, vertices[face.b].y, vertices[face.b].z);
            verticeBuffer.push(vertices[face.c].x, vertices[face.c].y, vertices[face.c].z);
        }

        for (let iFace = 0; iFace < faces.length; ++iFace) {
            uvBuffer.push(faceVertexUvs[0][iFace][0].x, faceVertexUvs[0][iFace][0].y);
            uvBuffer.push(faceVertexUvs[0][iFace][1].x, faceVertexUvs[0][iFace][1].y);
            uvBuffer.push(faceVertexUvs[0][iFace][2].x, faceVertexUvs[0][iFace][2].y);
        }

        this.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verticeBuffer), 3));
        this.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvBuffer), 2));
        
        this.boundingSphere = new THREE.Sphere (new THREE.Vector3 (), 1);
    }
}