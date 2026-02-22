/**
 * @module scenes/skinning
 * @description Skinning points scene with animated character point cloud.
 * Loads a GLTF model and renders it as audio-reactive points.
 */

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { 
    vec3, float, Fn, color, shapeCircle, instanceIndex,
    instancedArray, objectWorldMatrix, computeSkinning 
} from 'three/tsl';

import { audioBass, audioMid, audioHigh } from '../audio/uniforms.js';

/**
 * Skinning scene state and configuration.
 * @type {Object}
 */
export const skinningScene = {
    /** @type {THREE.Scene|null} */
    scene: null,
    /** @type {THREE.AnimationMixer|null} */
    mixer: null,
    /** @type {THREE.Clock} */
    clock: new THREE.Clock(),
    /** @type {boolean} */
    loaded: false,
    /** @type {THREE.Color} */
    backgroundColor: new THREE.Color(0x111111)
};

/**
 * Initialize the skinning points scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initSkinningScene(renderer, camera, controls) {
    const scene = new THREE.Scene();
    scene.background = skinningScene.backgroundColor;

    // === Ambient Light ===
    scene.add(new THREE.AmbientLight(0xffffff, 10));

    // === Load GLTF Model ===
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
        console.log('Loading model from: models/gltf/Michelle.glb');
        loader.load(
            'models/gltf/Michelle.glb', 
            (gltf) => {
                console.log('Model loaded, animations:', gltf.animations.map(a => a.name));
                const object = gltf.scene;
                skinningScene.mixer = new THREE.AnimationMixer(object);

                // Find and play animation clip
                const clip = gltf.animations.find(a => a.name === 'VRM|DanceLoop@24') || gltf.animations[0];
                const action = skinningScene.mixer.clipAction(clip);
                action.play();

                object.traverse((child) => {
                    if (child.isMesh && child.skeleton) {
                        child.visible = false;

                        const countOfPoints = child.geometry.getAttribute('position').count;

                        const pointPositionArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
                        const pointSpeedArray = instancedArray(countOfPoints, 'vec3').setPBO(true);

                        const pointSpeedAttribute = pointSpeedArray.toAttribute();
                        const skinnedPosition = computeSkinning(child);

                        const materialPoints = new THREE.PointsNodeMaterial();
                        
                        // Audio-reactive color - mix between blue and orange based on speed and audio
                        materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
                            color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))), 
                            color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
                        );
                        
                        materialPoints.opacityNode = shapeCircle().mul(float(0.8).add(audioBass.mul(0.2)));
                        
                        // Audio-reactive size - base size scales with bass
                        materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(5).add(1).add(audioBass.mul(10));
                        
                        materialPoints.sizeAttenuation = false;
                        materialPoints.alphaTest = 0.5;

                        const updateSkinningPoints = Fn(() => {
                            const pointPosition = pointPositionArray.element(instanceIndex);
                            const pointSpeed = pointSpeedArray.element(instanceIndex);

                            const skinnedWorldPos = objectWorldMatrix(child).mul(skinnedPosition);

                            const skinningSpeed = skinnedWorldPos.sub(pointPosition);

                            pointSpeed.assign(skinningSpeed);
                            pointPosition.assign(skinnedWorldPos);
                        }, 'void');

                        materialPoints.positionNode = Fn(() => {
                            updateSkinningPoints();
                            return pointPositionArray.toAttribute();
                        })().compute(countOfPoints).onInit(() => {
                            renderer.compute(updateSkinningPoints().compute(countOfPoints));
                        });

                        const pointCloud = new THREE.Sprite(materialPoints);
                        pointCloud.count = countOfPoints;
                        scene.add(pointCloud);
                    }
                });

                object.scale.set(100, 100, 100);
                object.rotation.x = -Math.PI / 2;

                scene.add(object);

                skinningScene.scene = scene;
                skinningScene.loaded = true;
                console.log('Skinning scene initialized');

                // === Set Camera ===
                camera.position.set(0, 300, -85);
                camera.lookAt(0, 0, -85);
                controls.target.set(0, 0, -85);
                controls.update();

                resolve(scene);
            },
            undefined,
            (error) => {
                console.error('Error loading GLB:', error);
                reject(error);
            }
        );
    });
}

/**
 * Update skinning scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values (unused in this scene)
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer (unused in update)
 */
export function updateSkinningScene(delta, settings, renderer) {
    if (skinningScene.mixer) {
        skinningScene.mixer.update(delta);
    }

    // Green screen toggle
    const greenColor = new THREE.Color(0x007900);
    const darkColor = new THREE.Color(0x111111);
    skinningScene.backgroundColor.copy(settings.greenScreen.value ? greenColor : darkColor);
}
