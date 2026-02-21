import * as THREE from "three";
import * as GeometryUtils from "three/addons/utils/GeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { 
    atan, cos, float, max, min, mix, PI, PI2, sin, vec2, vec3, vec4, color, 
    Fn, hash, hue, If, instanceIndex, Loop, mx_fractal_noise_float, 
    mx_fractal_noise_vec3, pass, pcurve, storage, deltaTime, time, uv, 
    uniform, step, instancedBufferAttribute, shapeCircle, computeSkinning, 
    objectWorldMatrix, instancedArray
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import WebGPU from "three/addons/capabilities/WebGPU.js";

let currentScene = null;
let isInitialized = false;
let camera, renderer, controls, postProcessing, bloomPass;
let clock = new THREE.Clock();

const audioBass = uniform(0.0);
const audioMid = uniform(0.0);
const audioHigh = uniform(0.0);
const audioOverall = uniform(0.0);

const settings = {
    bassSensitivity: 1.5,
    midSensitivity: 1.5,
    highSensitivity: 1.5,
    bassSpawnRate: 50,
    bassRadius: 3,
    bassBloom: 2,
    midTurbulence: 2,
    midFrequency: 0.5,
    midSpeed: 0.5,
    highSize: 2,
    highColorSpeed: 3,
    overallLifetime: 0.5,
    baseSpawnRate: 5,
    baseTurbulence: 0.5,
    baseSize: 1,
    baseRadius: 2,
    bloomStrength: 0.75,
    bloomThreshold: 0.1,
    bloomRadius: 0.5,
    pulseSpeed: 6,
    minWidth: 6,
    maxWidth: 20,
    autoRotate: true,
    autoRotateSpeed: 2
};

let particlesScene = {
    scene: null,
    updateParticles: null,
    spawnParticles: null,
    nbParticles: Math.pow(2, 13),
    elapsedTime: 0,
    timeScale: uniform(1.0),
    particleLifetime: uniform(0.5),
    particleSize: uniform(1.0),
    linksWidth: uniform(0.005),
    colorOffset: uniform(0.0),
    colorVariance: uniform(2.0),
    colorRotationSpeed: uniform(1.0),
    spawnIndex: uniform(0),
    nbToSpawn: uniform(5),
    spawnPosition: uniform(vec3(0.0)),
    previousSpawnPosition: uniform(vec3(0.0)),
    turbFrequency: uniform(0.5),
    turbAmplitude: uniform(0.5),
    turbOctaves: uniform(2),
    turbLacunarity: uniform(2.0),
    turbGain: uniform(0.5),
    turbFriction: uniform(0.01),
};

async function initParticlesScene() {
    const scene = new THREE.Scene();
    const nbParticles = particlesScene.nbParticles;

    const particlePositionsBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particleVelocitiesBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particlePositions = storage(particlePositionsBuffer, 'vec4', nbParticles);
    const particleVelocities = storage(particleVelocitiesBuffer, 'vec4', nbParticles);

    const nbVertices = nbParticles * 8;
    const linksVerticesSBA = new THREE.StorageBufferAttribute(nbVertices, 4);
    const linksColorsSBA = new THREE.StorageBufferAttribute(nbVertices, 4);

    const getInstanceColor = Fn(([i]) => {
        return hue(color(0x0000ff), particlesScene.colorOffset.add(mx_fractal_noise_float(i.toFloat().mul(.1), 2, 2.0, 0.5, particlesScene.colorVariance)));
    });

    const particleGeom = new THREE.PlaneGeometry(0.05, 0.05);
    const particleMaterial = new THREE.SpriteNodeMaterial();
    particleMaterial.blending = THREE.AdditiveBlending;
    particleMaterial.depthWrite = false;
    particleMaterial.positionNode = particlePositions.toAttribute();
    particleMaterial.scaleNode = vec2(particlesScene.particleSize);
    particleMaterial.rotationNode = atan(particleVelocities.toAttribute().y, particleVelocities.toAttribute().x);
    particleMaterial.colorNode = Fn(() => {
        const life = particlePositions.toAttribute().w;
        const modLife = pcurve(life.oneMinus(), 8.0, 1.0);
        const pulse = pcurve(sin(hash(instanceIndex).mul(PI2).add(time.mul(0.5).mul(PI2))).mul(0.5).add(0.5), 0.25, 0.25).mul(10.0).add(1.0);
        return getInstanceColor(instanceIndex).mul(pulse.mul(modLife));
    })();
    particleMaterial.opacityNode = Fn(() => {
        const circle = step(uv().xy.sub(0.5).length(), 0.5);
        const life = particlePositions.toAttribute().w;
        return circle.mul(life);
    })();

    const particleMesh = new THREE.InstancedMesh(particleGeom, particleMaterial, nbParticles);
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    const linksIndices = [];
    for (let i = 0; i < nbParticles; i++) {
        const baseIndex = i * 8;
        for (let j = 0; j < 2; j++) {
            const offset = baseIndex + j * 4;
            linksIndices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        }
    }
    const linksGeom = new THREE.BufferGeometry();
    linksGeom.setAttribute('position', linksVerticesSBA);
    linksGeom.setAttribute('color', linksColorsSBA);
    linksGeom.setIndex(linksIndices);

    const linksMaterial = new THREE.MeshBasicNodeMaterial();
    linksMaterial.vertexColors = true;
    linksMaterial.side = THREE.DoubleSide;
    linksMaterial.transparent = true;
    linksMaterial.depthWrite = false;
    linksMaterial.depthTest = false;
    linksMaterial.blending = THREE.AdditiveBlending;
    linksMaterial.opacityNode = storage(linksColorsSBA, 'vec4', nbVertices).toAttribute().w;

    const linksMesh = new THREE.Mesh(linksGeom, linksMaterial);
    linksMesh.frustumCulled = false;
    scene.add(linksMesh);

    const updateParticles = Fn(() => {
        const position = particlePositions.element(instanceIndex).xyz;
        const life = particlePositions.element(instanceIndex).w;
        const velocity = particleVelocities.element(instanceIndex).xyz;
        const dt = deltaTime.mul(0.1).mul(particlesScene.timeScale);

        If(life.greaterThan(0.0), () => {
            const localVel = mx_fractal_noise_vec3(position.mul(particlesScene.turbFrequency), particlesScene.turbOctaves, particlesScene.turbLacunarity, particlesScene.turbGain, particlesScene.turbAmplitude).mul(life.add(.01));
            velocity.addAssign(localVel);
            velocity.mulAssign(particlesScene.turbFriction.oneMinus());
            position.addAssign(velocity.mul(dt));
            life.subAssign(dt.mul(particlesScene.particleLifetime.reciprocal()));

            const closestDist1 = float(10000.0).toVar();
            const closestPos1 = vec3(0.0).toVar();
            const closestLife1 = float(0.0).toVar();
            const closestDist2 = float(10000.0).toVar();
            const closestPos2 = vec3(0.0).toVar();
            const closestLife2 = float(0.0).toVar();

            Loop(nbParticles, ({ i }) => {
                const otherPart = particlePositions.element(i);
                If(i.notEqual(instanceIndex).and(otherPart.w.greaterThan(0.0)), () => {
                    const otherPosition = otherPart.xyz;
                    const dist = position.sub(otherPosition).lengthSq();
                    const moreThanZero = dist.greaterThan(0.0);
                    If(dist.lessThan(closestDist1).and(moreThanZero), () => {
                        closestDist1.assign(dist);
                        closestPos1.assign(otherPosition.xyz);
                        closestLife1.assign(otherPart.w);
                    }).ElseIf(dist.lessThan(closestDist2).and(moreThanZero), () => {
                        closestDist2.assign(dist);
                        closestPos2.assign(otherPosition.xyz);
                        closestLife2.assign(otherPart.w);
                    });
                });
            });

            const linksPositions = storage(linksVerticesSBA, 'vec4', nbVertices);
            const linksColors = storage(linksColorsSBA, 'vec4', nbVertices);
            const firstLinkIndex = instanceIndex.mul(8);
            const secondLinkIndex = firstLinkIndex.add(4);

            linksPositions.element(firstLinkIndex).xyz.assign(position);
            linksPositions.element(firstLinkIndex).y.addAssign(particlesScene.linksWidth);
            linksPositions.element(firstLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(firstLinkIndex.add(1)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(2)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(2)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(3)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(3)).y.addAssign(particlesScene.linksWidth);

            linksPositions.element(secondLinkIndex).xyz.assign(position);
            linksPositions.element(secondLinkIndex).y.addAssign(particlesScene.linksWidth);
            linksPositions.element(secondLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(secondLinkIndex.add(1)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(2)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(2)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(3)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(3)).y.addAssign(particlesScene.linksWidth);

            const linkColor = getInstanceColor(instanceIndex);
            const l1 = max(0.0, min(closestLife1, life)).pow(0.8);
            const l2 = max(0.0, min(closestLife2, life)).pow(0.8);

            Loop(4, ({ i }) => {
                linksColors.element(firstLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(firstLinkIndex.add(i)).w.assign(l1);
                linksColors.element(secondLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(secondLinkIndex.add(i)).w.assign(l2);
            });
        });
    })().compute(nbParticles);

    const spawnParticles = Fn(() => {
        const particleIndex = particlesScene.spawnIndex.add(instanceIndex).mod(float(nbParticles)).toInt();
        const position = particlePositions.element(particleIndex).xyz;
        const life = particlePositions.element(particleIndex).w;
        const velocity = particleVelocities.element(particleIndex).xyz;

        If(instanceIndex.lessThan(particlesScene.nbToSpawn), () => {
            life.assign(1.0);
            const rRange = float(0.01);
            const rTheta = hash(particleIndex).mul(PI2);
            const rPhi = hash(particleIndex.add(1)).mul(PI);
            const rx = sin(rTheta).mul(cos(rPhi));
            const ry = sin(rTheta).mul(sin(rPhi));
            const rz = cos(rTheta);
            const rDir = vec3(rx, ry, rz);
            const pos = mix(particlesScene.previousSpawnPosition, particlesScene.spawnPosition, instanceIndex.toFloat().div(particlesScene.nbToSpawn.sub(1).toFloat()).clamp());
            position.assign(pos.add(rDir.mul(rRange)));
            velocity.assign(rDir.mul(5.0));
        });
    })().compute(200);

    renderer.compute(Fn(() => {
        particlePositions.element(instanceIndex).xyz.assign(vec3(10000.0));
        particlePositions.element(instanceIndex).w.assign(float(-1.0));
    })().compute(nbParticles));

    const backgroundGeom = new THREE.IcosahedronGeometry(100, 5).applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    const backgroundMaterial = new THREE.MeshStandardNodeMaterial();
    backgroundMaterial.roughness = 0.4;
    backgroundMaterial.metalness = 0.9;
    backgroundMaterial.flatShading = true;
    backgroundMaterial.colorNode = color(0x0);
    scene.add(new THREE.Mesh(backgroundGeom, backgroundMaterial));

    const light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);

    particlesScene.scene = scene;
    particlesScene.updateParticles = updateParticles;
    particlesScene.spawnParticles = spawnParticles;
    particlesScene.light = light;
    
    camera.position.set(0, 0, 15);
    controls.target.set(0, 0, 0);
    controls.update();
    
    return scene;
}

function updateParticlesScene(delta) {
    const bass = audioBass.value;
    const mid = audioMid.value;
    const high = audioHigh.value;
    const overall = audioOverall.value;

    particlesScene.nbToSpawn.value = Math.floor(settings.baseSpawnRate + bass * settings.bassSpawnRate);
    particlesScene.turbAmplitude.value = settings.baseTurbulence + mid * settings.midTurbulence;
    particlesScene.turbFrequency.value = 0.5 + mid * settings.midFrequency;
    particlesScene.particleSize.value = settings.baseSize + high * settings.highSize;
    particlesScene.colorRotationSpeed.value = 1.0 + high * settings.highColorSpeed;
    particlesScene.particleLifetime.value = 0.5 + (1 - overall * settings.overallLifetime) * 0.5;

    renderer.compute(particlesScene.updateParticles);
    renderer.compute(particlesScene.spawnParticles);

    particlesScene.spawnIndex.value = (particlesScene.spawnIndex.value + particlesScene.nbToSpawn.value) % particlesScene.nbParticles;

    const radius = settings.baseRadius + bass * settings.bassRadius;
    const speed = 0.5 + mid * settings.midSpeed;
    particlesScene.elapsedTime += delta;
    
    const targetPos = new THREE.Vector3(
        Math.sin(particlesScene.elapsedTime * speed) * radius,
        Math.cos(particlesScene.elapsedTime * speed * 1.3) * radius * 0.5,
        Math.sin(particlesScene.elapsedTime * speed * 0.7) * radius
    );
    
    particlesScene.previousSpawnPosition.value.copy(particlesScene.spawnPosition.value);
    particlesScene.spawnPosition.value.lerp(targetPos, 0.1);

    particlesScene.colorOffset.value += delta * particlesScene.colorRotationSpeed.value * particlesScene.timeScale.value;

    particlesScene.light.position.set(
        Math.sin(particlesScene.elapsedTime * 0.5) * 30,
        Math.cos(particlesScene.elapsedTime * 0.3) * 30,
        Math.sin(particlesScene.elapsedTime * 0.2) * 30
    );
}

let pointsScene = {
    scene: null,
    computeSize: null,
    divisions: 0,
    elapsedTime: 0,
    pulseSpeed: uniform(6),
    minWidth: uniform(6),
    maxWidth: uniform(20),
};

async function initPointsScene() {
    const scene = new THREE.Scene();

    const points = GeometryUtils.hilbert3D(new THREE.Vector3(0, 0, 0), 20.0, 1, 0, 1, 2, 3, 4, 5, 6, 7);
    const spline = new THREE.CatmullRomCurve3(points);
    const divisions = Math.round(4 * points.length);
    pointsScene.divisions = divisions;

    const position = new THREE.Vector3();
    const pointColor = new THREE.Color();

    const positions = [];
    const colors = [];
    const sizes = new Float32Array(divisions);

    for (let i = 0; i < divisions; i++) {
        const t = i / divisions;
        spline.getPoint(t, position);
        positions.push(position.x, position.y, position.z);

        pointColor.setHSL(t, 1.0, 0.5, THREE.SRGBColorSpace);
        colors.push(pointColor.r, pointColor.g, pointColor.b);

        sizes[i] = 10.0;
    }

    const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(positions), 3);
    const colorsAttribute = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
    const instanceSizeBufferAttribute = new THREE.StorageInstancedBufferAttribute(sizes, 1);
    const instanceSizeStorage = storage(instanceSizeBufferAttribute, 'float', divisions);

    pointsScene.computeSize = Fn(() => {
        const relativeTime = time.add(float(instanceIndex));
        const sizeFactor = sin(relativeTime.mul(pointsScene.pulseSpeed).add(audioBass.mul(PI))).add(1).div(2);
        const audioSize = audioBass.mul(20);
        instanceSizeStorage.element(instanceIndex).assign(sizeFactor.mul(pointsScene.maxWidth.sub(pointsScene.minWidth)).add(pointsScene.minWidth).add(audioSize));
    })().compute(divisions);

    const material = new THREE.PointsNodeMaterial({
        colorNode: instancedBufferAttribute(colorsAttribute).mul(vec3(1.0).add(audioHigh.mul(0.5))).mul(vec3(2.0)),
        opacityNode: shapeCircle().mul(float(0.95).add(audioMid.mul(0.05))),
        positionNode: instancedBufferAttribute(positionAttribute),
        sizeNode: instancedBufferAttribute(instanceSizeBufferAttribute),
        vertexColors: true,
        sizeAttenuation: false,
        alphaToCoverage: true
    });

    const instancedPoints = new THREE.Sprite(material);
    instancedPoints.count = divisions;
    scene.add(instancedPoints);

    const backgroundGeom = new THREE.IcosahedronGeometry(100, 5).applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    const backgroundMaterial = new THREE.MeshStandardNodeMaterial();
    backgroundMaterial.roughness = 0.4;
    backgroundMaterial.metalness = 0.9;
    backgroundMaterial.flatShading = true;
    backgroundMaterial.colorNode = color(0x0);
    scene.add(new THREE.Mesh(backgroundGeom, backgroundMaterial));

    const light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);
    pointsScene.light = light;

    pointsScene.scene = scene;
    pointsScene.material = material;

    camera.position.set(-40, 0, 60);
    controls.target.set(0, 0, 0);
    controls.update();

    return scene;
}

function updatePointsScene(delta) {
    pointsScene.pulseSpeed.value = settings.pulseSpeed;
    pointsScene.minWidth.value = settings.minWidth;
    pointsScene.maxWidth.value = settings.maxWidth;
    
    pointsScene.elapsedTime += delta;
    renderer.compute(pointsScene.computeSize);
}

let skinningScene = {
    scene: null,
    mixer: null,
    clock: new THREE.Clock(),
    loaded: false
};

async function initSkinningScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    scene.add(new THREE.AmbientLight(0xffffff, 10));

    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
        loader.load(
            'models/gltf/Michelle.glb', 
            (gltf) => {
                const object = gltf.scene;
                skinningScene.mixer = new THREE.AnimationMixer(object);

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
                    const skinningPosition = computeSkinning(child);

                    const materialPoints = new THREE.PointsNodeMaterial();
                    
                    materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
                        color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))), 
                        color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
                    );
                    
                    materialPoints.opacityNode = shapeCircle().mul(float(0.8).add(audioBass.mul(0.2)));
                    
                    materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(5).add(1).add(audioBass.mul(10));
                    
                    materialPoints.sizeAttenuation = false;
                    materialPoints.alphaTest = 0.5;

                    const updateSkinningPoints = Fn(() => {
                        const pointPosition = pointPositionArray.element(instanceIndex);
                        const pointSpeed = pointSpeedArray.element(instanceIndex);

                        const skinningWorldPosition = objectWorldMatrix(child).mul(skinningPosition);

                        const skinningSpeed = skinningWorldPosition.sub(pointPosition);

                        pointSpeed.assign(skinningSpeed);
                        pointPosition.assign(skinningWorldPosition);
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

function updateSkinningScene(delta) {
    if (skinningScene.mixer) {
        skinningScene.mixer.update(delta);
    }
}

async function init(sceneType) {
    if (!WebGPU.isAvailable()) {
        console.error('WebGPU not available in spout window');
        throw new Error('No WebGPU support');
    }

    if (!isInitialized) {
        camera = new THREE.PerspectiveCamera(60, 1920 / 1080, 0.1, 1000);
        camera.position.set(0, 0, 15);

        renderer = new THREE.WebGPURenderer({ antialias: true });
        renderer.setClearColor(0x14171a);
        renderer.setPixelRatio(1);
        renderer.setSize(1920, 1080);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);
        await renderer.init();
        
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = settings.autoRotate;
        controls.autoRotateSpeed = settings.autoRotateSpeed;
        controls.maxDistance = 200;
        
        isInitialized = true;
    }

    camera.position.set(0, 0, 15);
    controls.target.set(0, 0, 0);
    controls.update();

    let scene;
    if (sceneType === 'particles') {
        scene = await initParticlesScene();
    } else if (sceneType === 'points') {
        scene = await initPointsScene();
    } else if (sceneType === 'skinning') {
        scene = await initSkinningScene();
    }

    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode('output');
    bloomPass = bloom(scenePassColor, settings.bloomStrength, settings.bloomThreshold, settings.bloomRadius);
    postProcessing = new THREE.PostProcessing(renderer, scenePassColor.add(bloomPass));

    currentScene = sceneType;
    
    renderer.setAnimationLoop(animate);
}

function animate() {
    const delta = clock.getDelta();

    bloomPass.strength.value = settings.bloomStrength + audioBass.value * settings.bassBloom;
    bloomPass.threshold.value = settings.bloomThreshold;
    bloomPass.radius.value = settings.bloomRadius;

    controls.autoRotate = settings.autoRotate;
    controls.autoRotateSpeed = settings.autoRotateSpeed;

    if (currentScene === 'particles') {
        updateParticlesScene(delta);
    } else if (currentScene === 'points') {
        updatePointsScene(delta);
    } else if (currentScene === 'skinning') {
        updateSkinningScene(delta);
    }

    controls.update();
    postProcessing.render();
}

function updateSettings(newSettings) {
    if (!newSettings) return;
    
    for (const key in newSettings) {
        if (settings.hasOwnProperty(key)) {
            settings[key] = newSettings[key];
        }
    }
}

function updateAudio(audioData) {
    if (!audioData) return;
    
    audioBass.value = audioData.bass || 0;
    audioMid.value = audioData.mid || 0;
    audioHigh.value = audioData.high || 0;
    audioOverall.value = audioData.overall || 0;
}

async function switchScene(sceneType) {
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
    
    if (skinningScene.mixer) {
        skinningScene.mixer.stopAllAction();
        skinningScene.mixer = null;
    }
    skinningScene.loaded = false;
    skinningScene.scene = null;
    
    particlesScene.scene = null;
    pointsScene.scene = null;
    
    await init(sceneType);
}

if (window.spoutSync) {
    window.spoutSync.onSettings((s) => updateSettings(s));
    window.spoutSync.onAudio((a) => updateAudio(a));
    window.spoutSync.onScene((sceneType) => switchScene(sceneType));
}

console.log('Spout renderer starting, WebGPU available:', WebGPU.isAvailable());
init('particles').catch(err => console.error('Spout renderer init error:', err));
