// Asset loader and external model manager for Dead Signal.
//
// Bridges procedural fallback models with external glTF/GLB models.
// If an external model file is provided (or placed in an assets directory),
// it loads and re-targets its hierarchy into the Dead Signal standardized rig.
// If the file is absent or fails to load, the system transparently falls back to
// the procedural model generator without disrupting gameplay.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.modelUrls = new Map();
    this.enabled = true;
  }

  /**
   * Register a model URL for an enemy type, weapon, or world prop.
   * @param {string} key Identifier (e.g. 'walker', 'runner', 'brute', 'relay')
   * @param {string} url Path to .glb / .gltf file
   */
  register(key, url) {
    this.modelUrls.set(key, url);
  }

  /**
   * Check if an override model is registered for the given key.
   */
  has(key) {
    return this.modelUrls.has(key);
  }

  /**
   * Preload an external model asynchronously.
   * @param {string} key
   * @param {string} [optionalUrl]
   * @returns {Promise<THREE.Group|null>}
   */
  async load(key, optionalUrl = null) {
    const url = optionalUrl || this.modelUrls.get(key);
    if (!url) return null;

    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });

      // Enable shadow casting and receiving on all child meshes
      gltf.scene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          // Ensure correct color space on textures
          if (node.material && node.material.map) {
            node.material.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });

      this.cache.set(url, gltf);
      return gltf;
    } catch (err) {
      console.warn(`[AssetManager] Could not load model for '${key}' at '${url}'. Falling back to procedural geometry.`);
      return null;
    }
  }

  /**
   * Instantiate a loaded model for use in a scene.
   * Maps bone / joint hierarchy to match the Dead Signal standard rig layout.
   */
  instantiate(key) {
    const url = this.modelUrls.get(key);
    if (!url || !this.cache.has(url)) return null;

    const gltf = this.cache.get(url);
    const clone = gltf.scene.clone(true);

    // Build standard rig mapping from the imported scene
    const rig = this.mapImportedRig(clone);
    const hitMeshes = [];

    clone.traverse((child) => {
      if (child.isMesh) {
        hitMeshes.push(child);
      }
    });

    return {
      group: clone,
      rig,
      hitMeshes,
      animations: gltf.animations || [],
    };
  }

  /**
   * Automatically detects and maps bone structures (e.g. Mixamo, Humanoid, or Dead Signal conventions)
   * to the Dead Signal procedural animation rig structure.
   */
  mapImportedRig(root) {
    const nodeMap = new Map();
    root.traverse((node) => {
      if (node.name) {
        nodeMap.set(node.name.toLowerCase().replace(/[^a-z0-9]/g, ''), node);
      }
    });

    const findNode = (...candidates) => {
      for (const name of candidates) {
        const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nodeMap.has(clean)) return nodeMap.get(clean);
      }
      return null;
    };

    // Standard Dead Signal rig structure
    const hips = findNode('hips', 'pelvis', 'root', 'mixamorigHips') || root;
    const spine = findNode('spine', 'spine1', 'torso', 'mixamorigSpine') || hips;
    const chest = findNode('spine2', 'chest', 'upperbody', 'mixamorigSpine2') || spine;
    const neck = findNode('neck', 'headbone', 'mixamorigNeck') || chest;
    const head = findNode('head', 'mixamorigHead') || neck;
    const jaw = findNode('jaw', 'mouth', 'mixamorigJaw') || head;

    const shoulderL = findNode('shoulderl', 'leftshoulder', 'claviclel', 'mixamorigLeftShoulder');
    const upperArmL = findNode('arml', 'upperarml', 'leftarm', 'mixamorigLeftArm') || shoulderL || chest;
    const lowerArmL = findNode('forearml', 'lowerarml', 'leftforearm', 'mixamorigLeftForeArm') || upperArmL;

    const shoulderR = findNode('shoulderr', 'rightshoulder', 'clavicler', 'mixamorigRightShoulder');
    const upperArmR = findNode('armr', 'upperarmr', 'rightarm', 'mixamorigRightArm') || shoulderR || chest;
    const lowerArmR = findNode('forearmr', 'lowerarmr', 'rightforearm', 'mixamorigRightForeArm') || upperArmR;

    const hipL = findNode('uplegl', 'upperlegl', 'thighl', 'leftupleg', 'mixamorigLeftUpLeg') || hips;
    const kneeL = findNode('legl', 'lowerlegl', 'calfl', 'leftleg', 'mixamorigLeftLeg') || hipL;

    const hipR = findNode('uplegr', 'upperlegr', 'thighr', 'rightupleg', 'mixamorigRightUpLeg') || hips;
    const kneeR = findNode('legr', 'lowerlegr', 'calfr', 'rightleg', 'mixamorigRightLeg') || hipR;

    return {
      hips,
      spine,
      chest,
      neck,
      head,
      jaw,
      armL: {
        shoulder: upperArmL,
        elbow: lowerArmL,
      },
      armR: {
        shoulder: upperArmR,
        elbow: lowerArmR,
      },
      legL: {
        hip: hipL,
        knee: kneeL,
      },
      legR: {
        hip: hipR,
        knee: kneeR,
      },
    };
  }
}

export const assets = new AssetManager();
export const mapImportedRig = (model) => assets.mapImportedRig(model);
