"""
VALIXIS GAMES STUDIO - SOUL EMBER
Tier 4: Arch-Bosses & Sacred Relics (Models 25 - 32)
Procedural 3D model generators matching the concept art.
"""

import bpy
import math
import random
from mathutils import Vector
from soul_ember_materials import MaterialLibrary
from soul_ember_builder import (
    clear_scene, add_cube, add_cylinder, add_cone, add_sphere, add_torus, add_icosphere,
    create_humanoid_base, create_staff, finalize_model
)
from soul_ember_studio import export_all_formats

# -------------------------------------------------------------
# 25: Shadow Queen (Malakor's Consort / Banshee)
# -------------------------------------------------------------
def build_25_boss_shadow_queen(out_dir):
    clear_scene()
    parts = []
    silk = MaterialLibrary.get('cloth_regal_violet')
    cowl_mat = MaterialLibrary.get('cloth_midnight_hood')
    thorn_mat = MaterialLibrary.get('wood_scorched')
    soul_threads = MaterialLibrary.get('emission_soul_lantern')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    # Looming Floating Regal Silhouette (2.4m height)
    parts.extend(create_humanoid_base('queen', height=2.4, chest_w=0.45, hip_w=0.42, flesh_mat=flesh, cloth_mat=silk))
    
    # Billowing Shredded Gown
    skirt = add_cone('queen_skirt', radius1=0.65, radius2=0.22, depth=1.65, location=(0, 0, 0.75), material=silk)
    parts.append(skirt)
    
    # Crown of Thorny Dark Brambles
    crown_ring = add_torus('queen_crown_ring', major_radius=0.15, minor_radius=0.02, location=(0, 0, 2.32), material=thorn_mat)
    parts.append(crown_ring)
    for a in range(0, 360, 40):
        rad = math.radians(a)
        spike = add_cone(f'queen_thorn_{a}', radius1=0.03, radius2=0.005, depth=0.22 + (a % 80 == 0) * 0.12,
                         location=(math.cos(rad) * 0.14, math.sin(rad) * 0.14, 2.42), material=thorn_mat)
        parts.append(spike)
        
    # Flowing Veil Mantle
    veil = add_cone('queen_veil', radius1=0.45, radius2=0.16, depth=1.85, location=(0, -0.15, 1.25), rotation=(math.radians(-8), 0, 0), material=cowl_mat)
    parts.append(veil)
    
    # Ethereal Glowing Soul Threads hanging from outstretched fingers
    for s in (-1, 1):
        for t in range(3):
            tx = s * (0.42 + t * 0.08)
            ty = 0.25 + t * 0.05
            thread = add_cylinder(f'queen_thread_{s}_{t}', radius=0.004, depth=1.10, location=(tx, ty, 0.95), material=soul_threads)
            parts.append(thread)
            
    finalize_model(parts, target_origin_at_bottom=False)
    return export_all_formats(out_dir, "25_boss_shadow_queen", parts)

# -------------------------------------------------------------
# 26: Bone Titan (Skeletal Colossus Juggernaut)
# -------------------------------------------------------------
def build_26_boss_bone_titan(out_dir):
    clear_scene()
    parts = []
    bone = MaterialLibrary.get('bone_aged_ivory')
    iron = MaterialLibrary.get('metal_iron_dark')
    eye_mat = MaterialLibrary.get('emission_fire_core')
    
    # Colossal Skeletal Frame (Standing 3.4m tall)
    # Massive Spine & Cage
    spine = add_cylinder('titan_spine', radius=0.12, depth=1.45, location=(0, 0, 2.10), material=bone)
    parts.append(spine)
    for i in range(6):
        rib = add_torus(f'titan_rib_{i}', major_radius=0.48 - i * 0.035, minor_radius=0.045, location=(0, 0, 2.50 - i * 0.15), material=bone)
        parts.append(rib)
        
    # Massive Horned Skull
    skull = add_sphere('titan_skull', radius=0.32, scale=(0.85, 1.25, 1.0), location=(0, 0.12, 3.10), material=bone)
    parts.append(skull)
    for s in (-1, 1):
        eye = add_sphere(f'titan_eye_{s}', radius=0.055, location=(s * 0.12, 0.42, 3.12), material=eye_mat)
        parts.append(eye)
        
    # Spiked Heavy Bone Pauldrons
    for s in (-1, 1):
        pauldron = add_sphere(f'titan_pauldron_{s}', radius=0.38, scale=(1.2, 1.0, 0.8), location=(s * 0.78, 0, 2.65), material=bone)
        p_spike = add_cone(f'titan_p_spike_{s}', radius1=0.09, radius2=0.01, depth=0.35, location=(s * 0.85, 0, 2.95), material=bone)
        parts.extend([pauldron, p_spike])
        
    # Massive Limb Bones
    for s in (-1, 1):
        arm1 = add_cylinder(f'titan_arm1_{s}', radius=0.09, depth=0.85, location=(s * 0.72, 0, 2.05), material=bone)
        arm2 = add_cylinder(f'titan_arm2_{s}', radius=0.075, depth=0.85, location=(s * 0.80, 0.22, 1.35), rotation=(math.radians(25), 0, 0), material=bone)
        leg1 = add_cylinder(f'titan_leg1_{s}', radius=0.12, depth=1.05, location=(s * 0.38, 0, 1.15), material=bone)
        leg2 = add_cylinder(f'titan_leg2_{s}', radius=0.095, depth=1.05, location=(s * 0.38, 0, 0.35), material=bone)
        parts.extend([arm1, arm2, leg1, leg2])
        
    # Giant Spiked Skull Morningstar / Mace
    mace_shaft = add_cylinder('titan_mace_shaft', radius=0.05, depth=2.40, location=(0.95, 0.55, 1.45), rotation=(math.radians(15), 0, 0), material=iron)
    mace_head = add_sphere('titan_mace_head', radius=0.34, location=(0.95, 0.85, 2.45), material=bone)
    parts.extend([mace_shaft, mace_head])
    for a in range(0, 360, 60):
        rad = math.radians(a)
        spike = add_cone(f'titan_mace_spike_{a}', radius1=0.06, radius2=0.005, depth=0.25,
                         location=(0.95 + math.cos(rad) * 0.34, 0.85, 2.45 + math.sin(rad) * 0.34),
                         rotation=(0, -rad, 0), material=iron)
        parts.append(spike)
        
    finalize_model(parts)
    return export_all_formats(out_dir, "26_boss_bone_titan", parts)

# -------------------------------------------------------------
# 27: Solar Pope (Grand Inquisitor of the Sun)
# -------------------------------------------------------------
def build_27_boss_solar_pope(out_dir):
    clear_scene()
    parts = []
    crimson = MaterialLibrary.get('cloth_crimson')
    gold = MaterialLibrary.get('metal_gold_filigree')
    solar_halo = MaterialLibrary.get('emission_solar_halo')
    bone = MaterialLibrary.get('bone_aged_ivory')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('pope', height=2.05, flesh_mat=flesh, cloth_mat=crimson))
    
    # Ornate Chasuble / Papal Vestments with Gold Borders
    chasuble = add_cone('pope_chasuble', radius1=0.62, radius2=0.25, depth=1.45, location=(0, 0, 0.85), material=crimson)
    chasuble_gold = add_cube('pope_chasuble_strip', size=1.0, scale=(0.14, 0.08, 1.48), location=(0, 0.22, 0.85), material=gold)
    parts.extend([chasuble, chasuble_gold])
    
    # Tall Papal Mitre Crown
    mitre_base = add_cylinder('pope_mitre_base', radius=0.16, depth=0.22, location=(0, 0, 1.95), material=crimson)
    mitre_peak = add_cone('pope_mitre_peak', radius1=0.16, radius2=0.02, depth=0.35, location=(0, 0, 2.22), material=crimson)
    mitre_cross = add_cube('pope_mitre_cross', size=1.0, scale=(0.04, 0.015, 0.16), location=(0, 0.14, 2.10), material=gold)
    parts.extend([mitre_base, mitre_peak, mitre_cross])
    
    # Blazing Radiant Solar Halo Disk (Behind head)
    halo_ring = add_torus('pope_solar_halo', major_radius=0.48, minor_radius=0.035, location=(0, -0.15, 2.05), rotation=(math.radians(90), 0, 0), material=solar_halo)
    halo_core = add_cylinder('pope_solar_disk', radius=0.42, depth=0.02, location=(0, -0.16, 2.05), rotation=(math.radians(90), 0, 0), material=solar_halo)
    parts.extend([halo_ring, halo_core])
    
    # Tall Solar Monstrance Staff
    staff = create_staff('pope_staff', height=2.45, pole_mat=gold, head_mat=solar_halo, head_type='solar')
    for p in staff:
        p.location.x += 0.52
        p.location.y += 0.25
    parts.extend(staff)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "27_boss_solar_pope", parts)

# -------------------------------------------------------------
# 28: Sunken Warlord (Abyssal Knight of the Deep)
# -------------------------------------------------------------
def build_28_boss_sunken_warlord(out_dir):
    clear_scene()
    parts = []
    steel = MaterialLibrary.get('metal_steel')
    verdigris = MaterialLibrary.get('metal_bronze_verdigris')
    rust_iron = MaterialLibrary.get('metal_iron_rusted')
    eye_glow = MaterialLibrary.get('emission_soul_lantern')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    # Heavy Titan-Class Humanoid (2.2m tall)
    parts.extend(create_humanoid_base('warlord', height=2.2, chest_w=0.68, hip_w=0.52, flesh_mat=flesh, cloth_mat=verdigris))
    
    # Barnacle-Crusted Spiked Sea Crown Helm
    helm = add_cylinder('warlord_helm', radius=0.18, depth=0.35, location=(0, 0, 2.05), material=verdigris)
    visor = add_cube('warlord_visor', size=1.0, scale=(0.18, 0.05, 0.03), location=(0, 0.16, 2.05), material=eye_glow)
    parts.extend([helm, visor])
    for a in range(0, 360, 60):
        rad = math.radians(a)
        crown_spike = add_cone(f'warlord_crown_{a}', radius1=0.035, radius2=0.005, depth=0.16,
                               location=(math.cos(rad) * 0.16, math.sin(rad) * 0.16, 2.28), material=steel)
        parts.append(crown_spike)
        
    # Massive Coral / Barnacle Clusters on Pauldrons
    for s in (-1, 1):
        pauldron = add_sphere(f'warlord_pauldron_{s}', radius=0.25, location=(s * 0.48, 0, 1.82), material=verdigris)
        barnacle1 = add_cone(f'warlord_barnacle1_{s}', radius1=0.06, radius2=0.02, depth=0.12, location=(s * 0.52, 0.10, 1.95), material=rust_iron)
        barnacle2 = add_cone(f'warlord_barnacle2_{s}', radius1=0.05, radius2=0.015, depth=0.10, location=(s * 0.46, -0.10, 1.92), material=rust_iron)
        parts.extend([pauldron, barnacle1, barnacle2])
        
    # Enormous Rusted Iron Sea Anchor as Weapon
    anchor_shank = add_cylinder('warlord_anchor_shank', radius=0.065, depth=2.10, location=(0.48, 0.35, 1.15), material=rust_iron)
    anchor_ring = add_torus('warlord_anchor_ring', major_radius=0.18, minor_radius=0.035, location=(0.48, 0.35, 2.25), rotation=(math.radians(90), 0, 0), material=rust_iron)
    anchor_stock = add_cube('warlord_anchor_stock', size=1.0, scale=(0.65, 0.08, 0.08), location=(0.48, 0.35, 1.95), material=rust_iron)
    anchor_crown = add_torus('warlord_anchor_crown', major_radius=0.45, minor_radius=0.06, location=(0.48, 0.35, 0.35), rotation=(0, math.radians(90), 0), material=rust_iron)
    parts.extend([anchor_shank, anchor_ring, anchor_stock, anchor_crown])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "28_boss_sunken_warlord", parts)

# -------------------------------------------------------------
# 29: Horned Forest Lich (Arch-Druid of the Void)
# -------------------------------------------------------------
def build_29_boss_horned_lich(out_dir):
    clear_scene()
    parts = []
    bone = MaterialLibrary.get('bone_aged_ivory')
    moss = MaterialLibrary.get('stone_mossy_boulder')
    bark = MaterialLibrary.get('wood_ancient_oak')
    gold = MaterialLibrary.get('metal_gold_ancient')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('lich', height=2.15, flesh_mat=flesh, cloth_mat=moss))
    
    # Ancient Antlered Stag Horn Crown
    skull = add_sphere('lich_skull', radius=0.15, scale=(0.85, 1.2, 1.0), location=(0, 0.05, 1.95), material=bone)
    parts.append(skull)
    for s in (-1, 1):
        # Main antler beam
        antler1 = add_cylinder(f'lich_antler1_{s}', radius=0.03, depth=0.55,
                               location=(s * 0.22, -0.05, 2.25), rotation=(math.radians(25), math.radians(s * 45), 0), material=bone)
        # Branch 1
        antler2 = add_cylinder(f'lich_antler2_{s}', radius=0.02, depth=0.35,
                               location=(s * 0.35, 0.05, 2.45), rotation=(math.radians(-15), math.radians(s * 75), 0), material=bone)
        parts.extend([antler1, antler2])
        
    # Gnarled Branch Staff with Solar Disk
    staff_shaft = add_cylinder('lich_staff_shaft', radius=0.035, depth=2.30, location=(0.45, 0.20, 1.15), material=bark)
    staff_disk = add_cylinder('lich_staff_disk', radius=0.22, depth=0.025, location=(0.45, 0.20, 2.35), rotation=(math.radians(90), 0, 0), material=gold)
    parts.extend([staff_shaft, staff_disk])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "29_boss_horned_lich", parts)

# -------------------------------------------------------------
# 30: Soul Crystal (Shard of Prismatic Ember)
# -------------------------------------------------------------
def build_30_relic_soul_crystal(out_dir):
    clear_scene()
    parts = []
    crystal = MaterialLibrary.get('crystal_soul_ember')
    iron_brambles = MaterialLibrary.get('metal_iron_dark')
    
    # Core Floating Hexagonal Crystal Shard (Height ~0.8m)
    c_top = add_cone('crystal_top', radius1=0.22, radius2=0.01, depth=0.55, location=(0, 0, 0.85), material=crystal, vertices=6)
    c_bot = add_cone('crystal_bot', radius1=0.01, radius2=0.22, depth=0.35, location=(0, 0, 0.40), material=crystal, vertices=6)
    parts.extend([c_top, c_bot])
    
    # Surrounding Smaller Satellite Shards
    for a in range(0, 360, 72):
        rad = math.radians(a)
        cx = math.cos(rad) * 0.26
        cy = math.sin(rad) * 0.26
        sat_top = add_cone(f'crystal_sat_top_{a}', radius1=0.08, radius2=0.005, depth=0.30, location=(cx, cy, 0.70), material=crystal, vertices=6)
        sat_bot = add_cone(f'crystal_sat_bot_{a}', radius1=0.005, radius2=0.08, depth=0.18, location=(cx, cy, 0.46), material=crystal, vertices=6)
        parts.extend([sat_top, sat_bot])
        
    # Twisting Thorny Wrought-Iron Cage & Roots Cradling the Crystal
    for i in range(4):
        vine = add_torus(f'crystal_cage_{i}', major_radius=0.32 - i * 0.02, minor_radius=0.025,
                         location=(0, 0, 0.35 + i * 0.12), rotation=(math.radians(15 * i), math.radians(20 * i), 0), material=iron_brambles)
        parts.append(vine)
        
    finalize_model(parts, target_origin_at_bottom=False)
    return export_all_formats(out_dir, "30_relic_soul_crystal", parts)

# -------------------------------------------------------------
# 31: Crimson Elixir (Gothic Flask of Life)
# -------------------------------------------------------------
def build_31_relic_crimson_elixir(out_dir):
    clear_scene()
    parts = []
    glass = MaterialLibrary.get('glass_potion_vial')
    elixir = MaterialLibrary.get('liquid_crimson_elixir')
    gold = MaterialLibrary.get('metal_gold_filigree')
    
    # Ornate Gothic Glass Vial (Blown flask)
    # Glass outer shell
    vial_base = add_sphere('elixir_vial_outer', radius=0.22, scale=(1.0, 1.0, 1.25), location=(0, 0, 0.32), material=glass)
    vial_neck = add_cylinder('elixir_neck_outer', radius=0.065, depth=0.25, location=(0, 0, 0.64), material=glass)
    vial_lip = add_torus('elixir_lip_outer', major_radius=0.085, minor_radius=0.02, location=(0, 0, 0.76), material=gold)
    parts.extend([vial_base, vial_neck, vial_lip])
    
    # Inner Glowing Red Liquid
    liquid_body = add_sphere('elixir_liquid_core', radius=0.19, scale=(1.0, 1.0, 1.2), location=(0, 0, 0.30), material=elixir)
    parts.append(liquid_body)
    
    # Gold Filigree Footed Base & Cage
    stand = add_cone('elixir_gold_stand', radius1=0.20, radius2=0.08, depth=0.15, location=(0, 0, 0.10), material=gold)
    parts.append(stand)
    for a in range(0, 360, 60):
        rad = math.radians(a)
        rib = add_torus(f'elixir_filigree_{a}', major_radius=0.23, minor_radius=0.012,
                        location=(0, 0, 0.32), rotation=(math.radians(90), 0, rad), material=gold)
        parts.append(rib)
        
    # Faceted Ruby Gem Stopper
    stopper = add_sphere('elixir_stopper', radius=0.07, scale=(1.0, 1.0, 1.3), location=(0, 0, 0.85), material=elixir)
    parts.append(stopper)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "31_relic_crimson_elixir", parts)

# -------------------------------------------------------------
# 32: Gold Embers (Ancient Holy Coin Cache)
# -------------------------------------------------------------
def build_32_relic_gold_embers(out_dir):
    clear_scene()
    parts = []
    gold = MaterialLibrary.get('metal_gold_ancient')
    steel = MaterialLibrary.get('metal_steel')
    
    random.seed(42)
    
    # Stacked, overflowing mound of thick antique stamped holy coins
    # Base coin dimensions: radius 0.12, depth 0.024
    coin_positions = [
        # Base ring
        (0, 0, 0.015, 0, 0, 0),
        (0.14, 0.05, 0.02, 5, -8, 25),
        (-0.13, 0.08, 0.02, -6, 12, -40),
        (0.04, -0.15, 0.02, 10, 4, 60),
        (-0.12, -0.12, 0.025, -8, -10, 15),
        (0.18, -0.08, 0.02, 4, 15, -70),
        # Middle layer
        (0.02, 0.04, 0.05, 12, 8, 30),
        (-0.08, 0.02, 0.06, -14, 5, -15),
        (0.08, -0.06, 0.06, 6, -16, 45),
        (-0.04, -0.08, 0.065, -10, -12, 85),
        # Top apex coins
        (0, 0, 0.09, 18, -6, 20),
        (0.05, 0.02, 0.11, -8, 22, -35),
        (-0.03, -0.01, 0.13, 14, 10, 50)
    ]
    
    for i, (cx, cy, cz, rx, ry, rz) in enumerate(coin_positions):
        coin = add_cylinder(f'coin_body_{i}', radius=0.12, depth=0.024,
                            location=(cx, cy, cz), rotation=(math.radians(rx), math.radians(ry), math.radians(rz)), material=gold)
        # Cross insignia on face
        cross_v = add_cube(f'coin_cross_v_{i}', size=1.0, scale=(0.025, 0.16, 0.028),
                           location=(cx, cy, cz), rotation=(math.radians(rx), math.radians(ry), math.radians(rz)), material=gold)
        cross_h = add_cube(f'coin_cross_h_{i}', size=1.0, scale=(0.12, 0.025, 0.028),
                           location=(cx, cy, cz), rotation=(math.radians(rx), math.radians(ry), math.radians(rz)), material=gold)
        parts.extend([coin, cross_v, cross_h])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "32_relic_gold_embers", parts)

def build_tier_4_bosses(base_desktop_dir):
    """Executes all 8 bosses & relics in Tier 4."""
    tier4_dir = f"{base_desktop_dir}\\04_Bosses_and_Relics"
    print(">>> GENERATING TIER 4: 04_BOSSES_AND_RELICS...")
    results = [
        build_25_boss_shadow_queen(tier4_dir),
        build_26_boss_bone_titan(tier4_dir),
        build_27_boss_solar_pope(tier4_dir),
        build_28_boss_sunken_warlord(tier4_dir),
        build_29_boss_horned_lich(tier4_dir),
        build_30_relic_soul_crystal(tier4_dir),
        build_31_relic_crimson_elixir(tier4_dir),
        build_32_relic_gold_embers(tier4_dir)
    ]
    return results
