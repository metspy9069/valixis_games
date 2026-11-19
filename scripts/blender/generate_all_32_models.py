"""
VALIXIS GAMES STUDIO - SOUL EMBER
Master 3D Asset Generation & Pipeline Orchestrator
Executes all 32 dark fantasy 3D model generators, renders beauty shots,
and compiles the SoulEmber_Manifest.json catalogue.
"""

import os
import sys
import json
import shutil
import time

# Ensure scripts/blender is in Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from models_tier1_heroes import build_tier_1_heroes
from models_tier2_enemies import build_tier_2_enemies
from models_tier3_monsters import build_tier_3_monsters
from models_tier4_bosses import build_tier_4_bosses

def main():
    start_time = time.time()
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    base_dir = os.path.join(desktop, "SoulEmber_3D_Models")
    renders_dir = os.path.join(base_dir, "Renders")
    
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(renders_dir, exist_ok=True)
    
    print("=" * 70)
    print("   VALIXIS GAMES - SOUL EMBER 3D ASSET GENERATION PIPELINE")
    print(f"   Target: {base_dir}")
    print("=" * 70)
    
    all_results = []
    
    # Tier 1: Heroes (1 - 8)
    t1_res = build_tier_1_heroes(base_dir)
    all_results.extend(t1_res)
    
    # Tier 2: Enemies (9 - 16)
    t2_res = build_tier_2_enemies(base_dir)
    all_results.extend(t2_res)
    
    # Tier 3: Monsters (17 - 24)
    t3_res = build_tier_3_monsters(base_dir)
    all_results.extend(t3_res)
    
    # Tier 4: Bosses & Relics (25 - 32)
    t4_res = build_tier_4_bosses(base_dir)
    all_results.extend(t4_res)
    
    print("\n>>> COPYING BEAUTY RENDERS TO RENDERS DIRECTORY...")
    manifest_entries = []
    
    for item in all_results:
        render_path = item['render']
        if os.path.exists(render_path):
            dest_render = os.path.join(renders_dir, os.path.basename(render_path))
            shutil.copy2(render_path, dest_render)
            
        base_name = os.path.basename(item['glb']).replace('.glb', '')
        parts = base_name.split('_')
        idx = parts[0]
        category = parts[1]
        name = " ".join(parts[2:]).title()
        
        manifest_entries.append({
            'index': idx,
            'id': base_name,
            'name': name,
            'category': category,
            'files': {
                'blend': os.path.relpath(item['blend'], base_dir),
                'glb': os.path.relpath(item['glb'], base_dir),
                'fbx': os.path.relpath(item['fbx'], base_dir),
                'render': os.path.relpath(item['render'], base_dir)
            }
        })
        
    # Write SoulEmber_Manifest.json
    manifest_path = os.path.join(base_dir, "SoulEmber_Manifest.json")
    manifest_data = {
        'title': 'Soul Ember 3D Model Asset Registry',
        'engine': 'Blender 4.5.0 Headless',
        'generated_at': time.strftime("%Y-%m-%d %H:%M:%S"),
        'total_models': len(manifest_entries),
        'usage_web_threejs': """
// Three.js / WebGL Import Example:
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('path/to/model.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0, 0, 0); // Origin pre-aligned to base
    scene.add(model);
});
        """.strip(),
        'models': manifest_entries
    }
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_data, f, indent=2)
        
    elapsed = time.time() - start_time
    print("=" * 70)
    print(f"   SUCCESSFULLY GENERATED ALL {len(all_results)} MODELS IN {elapsed:.1f}s!")
    print(f"   Registry written to: {manifest_path}")
    print("=" * 70)

if __name__ == '__main__':
    main()
