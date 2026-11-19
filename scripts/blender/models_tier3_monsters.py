"""
VALIXIS GAMES STUDIO - SOUL EMBER
Tier 3: Biome Beasts & Aberrations (Models 17 - 24)
Procedural 3D model generators matching the concept art.
"""

import bpy
import math
from mathutils import Vector
from soul_ember_materials import MaterialLibrary
from soul_ember_builder import (
    clear_scene, add_cube, add_cylinder, add_cone, add_sphere, add_torus, add_icosphere,
    finalize_model
)
from soul_ember_studio import export_all_formats

# -------------------------------------------------------------
# 17: Leech Swarm (Writhing Clump of Blood Lampreys)
# -------------------------------------------------------------
def build_17_monster_leech_swarm(out_dir):
    clear_scene()
    parts = []
    viscera = MaterialLibrary.get('flesh_bloody_viscera')
    bone = MaterialLibrary.get('bone_aged_ivory')
    
    # Mound of coiled, writhing segmented worm bodies
    worm_configs = [
        # (radius, depth, x, y, z, rx, ry, rz)
        (0.12, 0.85, 0, 0, 0.35, 25, 15, 0),
        (0.10, 0.75, 0.18, 0.12, 0.45, -35, 40, 20),
        (0.11, 0.80, -0.16, 0.08, 0.40, 45, -30, -15),
        (0.09, 0.70, 0.08, -0.18, 0.30, -20, -45, 60),
        (0.10, 0.75, -0.12, -0.14, 0.35, 15, 50, -45),
        (0.08, 0.65, 0.22, -0.05, 0.25, 60, 20, 30),
        (0.09, 0.70, -0.24, 0.02, 0.28, -50, -15, -60),
        (0.11, 0.90, 0, 0.05, 0.60, 15, 0, 0),  # Top dominant leech rearing up
    ]
    
    for i, (rad, depth, x, y, z, rx, ry, rz) in enumerate(worm_configs):
        body = add_cylinder(f'leech_body_{i}', radius=rad, depth=depth,
                            location=(x, y, z), rotation=(math.radians(rx), math.radians(ry), math.radians(rz)), material=viscera)
        head = add_sphere(f'leech_head_{i}', radius=rad * 1.05, location=(x, y, z + depth * 0.45), material=viscera)
        # Circular lamprey mouth & ring of teeth
        mouth = add_torus(f'leech_mouth_{i}', major_radius=rad * 0.75, minor_radius=rad * 0.20,
                          location=(x, y, z + depth * 0.50), rotation=(math.radians(rx), math.radians(ry), math.radians(rz)), material=bone)
        parts.extend([body, head, mouth])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "17_monster_leech_swarm", parts)

# -------------------------------------------------------------
# 18: Mimic Chest (Predatory Treasure Box)
# -------------------------------------------------------------
def build_18_monster_mimic_chest(out_dir):
    clear_scene()
    parts = []
    wood = MaterialLibrary.get('wood_ancient_oak')
    iron = MaterialLibrary.get('metal_iron_dark')
    flesh = MaterialLibrary.get('flesh_bloody_viscera')
    bone = MaterialLibrary.get('bone_aged_ivory')
    
    # Bottom Chest Box
    box = add_cube('mimic_box', size=1.0, scale=(0.75, 0.55, 0.40), location=(0, 0, 0.35), material=wood)
    parts.append(box)
    
    # Iron Straps on box
    strap1 = add_cube('mimic_strap1', size=1.0, scale=(0.78, 0.08, 0.42), location=(0, 0.15, 0.35), material=iron)
    strap2 = add_cube('mimic_strap2', size=1.0, scale=(0.78, 0.08, 0.42), location=(0, -0.15, 0.35), material=iron)
    parts.extend([strap1, strap2])
    
    # Hinged Upper Lid Opening Wide (at 45 degree angle)
    lid = add_cube('mimic_lid', size=1.0, scale=(0.76, 0.56, 0.20), location=(0, -0.10, 0.70), rotation=(math.radians(-42), 0, 0), material=wood)
    parts.append(lid)
    
    # Jagged Needle Teeth on Lower Rim & Upper Lid
    for i in range(7):
        tx = -0.30 + i * 0.10
        # Lower teeth
        t_low = add_cone(f'mimic_t_low_{i}', radius1=0.025, radius2=0.002, depth=0.12, location=(tx, 0.24, 0.55), material=bone)
        # Upper teeth
        t_up = add_cone(f'mimic_t_up_{i}', radius1=0.025, radius2=0.002, depth=0.14, location=(tx, 0.10, 0.75), rotation=(math.radians(140), 0, 0), material=bone)
        parts.extend([t_low, t_up])
        
    # Long Lolling Fleshy Tongue
    tongue = add_cube('mimic_tongue', size=1.0, scale=(0.18, 0.48, 0.06), location=(0, 0.35, 0.50), rotation=(math.radians(-25), 0, 0), material=flesh)
    parts.append(tongue)
    
    # Multi-jointed Spindly Crab/Spider Legs underneath
    for s in (-1, 1):
        for li in range(3):
            lx = s * 0.38
            ly = -0.18 + li * 0.18
            leg1 = add_cylinder(f'mimic_leg1_{s}_{li}', radius=0.025, depth=0.35, location=(lx + s * 0.10, ly, 0.25), rotation=(0, math.radians(s * 45), 0), material=iron)
            leg2 = add_cylinder(f'mimic_leg2_{s}_{li}', radius=0.018, depth=0.35, location=(lx + s * 0.22, ly, 0.10), rotation=(0, math.radians(s * -35), 0), material=iron)
            parts.extend([leg1, leg2])
            
    finalize_model(parts)
    return export_all_formats(out_dir, "18_monster_mimic_chest", parts)

# -------------------------------------------------------------
# 19: Toxic Toad (Blighted Pustule Frog)
# -------------------------------------------------------------
def build_19_monster_toxic_toad(out_dir):
    clear_scene()
    parts = []
    toad_skin = MaterialLibrary.get('flesh_toad_warty')
    slime = MaterialLibrary.get('emission_fire_core')
    bone = MaterialLibrary.get('bone_aged_ivory')
    
    # Massive Bloated Toad Body
    body = add_sphere('toad_body', radius=0.55, scale=(1.15, 1.35, 0.85), location=(0, 0, 0.52), material=toad_skin)
    parts.append(body)
    
    # Pustules & Toxic Warts on back
    pustule_locs = [
        (0.18, 0.15, 0.88, 0.11),
        (-0.20, 0.12, 0.86, 0.12),
        (0, -0.15, 0.85, 0.14),
        (0.24, -0.18, 0.78, 0.10),
        (-0.25, -0.22, 0.76, 0.09),
        (0.08, 0.32, 0.75, 0.08)
    ]
    for i, (px, py, pz, pr) in enumerate(pustule_locs):
        pust = add_sphere(f'toad_pustule_{i}', radius=pr, location=(px, py, pz), material=slime)
        parts.append(pust)
        
    # Bulging Eyes & Brow Ridges
    for s in (-1, 1):
        eye_socket = add_sphere(f'toad_socket_{s}', radius=0.14, location=(s * 0.26, 0.42, 0.80), material=toad_skin)
        eye_orb = add_sphere(f'toad_eye_{s}', radius=0.10, location=(s * 0.27, 0.46, 0.82), material=bone)
        parts.extend([eye_socket, eye_orb])
        
    # Wide Gaping Mouth dripping venom
    maw_lip = add_torus('toad_lip', major_radius=0.38, minor_radius=0.05, location=(0, 0.45, 0.48), rotation=(math.radians(20), 0, 0), material=toad_skin)
    parts.append(maw_lip)
    
    # Splayed Muscular Webbed Limbs
    for s in (-1, 1):
        f_arm = add_cylinder(f'toad_farm_{s}', radius=0.09, depth=0.45, location=(s * 0.42, 0.32, 0.25), rotation=(math.radians(25), math.radians(s * 30), 0), material=toad_skin)
        b_thigh = add_sphere(f'toad_bthigh_{s}', radius=0.22, scale=(1.2, 1.0, 0.8), location=(s * 0.48, -0.25, 0.35), material=toad_skin)
        parts.extend([f_arm, b_thigh])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "19_monster_toxic_toad", parts)

# -------------------------------------------------------------
# 20: Lantern Wraith (Ethereal Soul Specter)
# -------------------------------------------------------------
def build_20_monster_lantern_wraith(out_dir):
    clear_scene()
    parts = []
    ghost = MaterialLibrary.get('spectral_ghost_cyan')
    soul_light = MaterialLibrary.get('emission_soul_lantern')
    iron = MaterialLibrary.get('metal_iron_dark')
    
    # Floating Ethereal Tattered Robes (origin elevated)
    head_cowl = add_sphere('wraith_cowl', radius=0.18, scale=(0.95, 1.25, 1.1), location=(0, 0, 1.60), material=ghost)
    body_cone = add_cone('wraith_body', radius1=0.45, radius2=0.18, depth=1.20, location=(0, 0, 0.95), material=ghost)
    parts.extend([head_cowl, body_cone])
    
    # Shredded Trailing Wisps of Vapor
    for i in range(6):
        rad = math.radians(i * 60)
        wisp = add_cone(f'wraith_wisp_{i}', radius1=0.08, radius2=0.01, depth=0.75,
                        location=(math.cos(rad) * 0.28, math.sin(rad) * 0.28, 0.35), rotation=(math.radians(15), math.radians(15), 0), material=ghost)
        parts.append(wisp)
        
    # Skeletal Arm Reaching Forward
    arm = add_cylinder('wraith_arm', radius=0.025, depth=0.55, location=(0.32, 0.25, 1.35), rotation=(math.radians(65), math.radians(20), 0), material=ghost)
    parts.append(arm)
    
    # Hanging Gothic Soul Cage Lantern
    lantern_chain = add_cylinder('wraith_chain', radius=0.008, depth=0.35, location=(0.42, 0.50, 1.25), material=iron)
    lantern_cap = add_cone('wraith_lantern_cap', radius1=0.10, radius2=0.02, depth=0.08, location=(0.42, 0.50, 1.10), material=iron)
    lantern_cage = add_cylinder('wraith_lantern_cage', radius=0.09, depth=0.18, location=(0.42, 0.50, 0.98), material=iron, vertices=6)
    soul_core = add_icosphere('wraith_soul_core', radius=0.065, location=(0.42, 0.50, 0.98), material=soul_light)
    parts.extend([lantern_chain, lantern_cap, lantern_cage, soul_core])
    
    finalize_model(parts, target_origin_at_bottom=False)
    return export_all_formats(out_dir, "20_monster_lantern_wraith", parts)

# -------------------------------------------------------------
# 21: Briar Imp (Thorn Goblin of the Thicket)
# -------------------------------------------------------------
def build_21_monster_briar_imp(out_dir):
    clear_scene()
    parts = []
    bark = MaterialLibrary.get('wood_ancient_oak')
    spines = MaterialLibrary.get('wood_scorched')
    eye_mat = MaterialLibrary.get('emission_fire_core')
    
    # Spiky Gnarled Wood Torso
    torso = add_cone('imp_torso', radius1=0.12, radius2=0.18, depth=0.45, location=(0, 0, 0.65), material=bark)
    head = add_sphere('imp_head', radius=0.13, scale=(0.85, 1.2, 1.0), location=(0, 0.05, 0.95), material=bark)
    parts.extend([torso, head])
    
    # Long Pointed Thorn Ears
    for s in (-1, 1):
        ear = add_cone(f'imp_ear_{s}', radius1=0.04, radius2=0.005, depth=0.22,
                       location=(s * 0.18, 0, 1.02), rotation=(0, math.radians(s * 60), 0), material=spines)
        parts.append(ear)
        
    # Glowing Amber Eyes
    for s in (-1, 1):
        eye = add_sphere(f'imp_eye_{s}', radius=0.025, location=(s * 0.05, 0.14, 0.96), material=eye_mat)
        parts.append(eye)
        
    # Bramble Spikes Covering Back
    for i in range(8):
        rad = math.radians(i * 45)
        spike = add_cone(f'imp_spike_{i}', radius1=0.025, radius2=0.002, depth=0.16,
                         location=(math.cos(rad) * 0.14, -0.08, 0.72 - (i % 3) * 0.08), rotation=(math.radians(-35), 0, 0), material=spines)
        parts.append(spike)
        
    # Long Thorn Spear in Hand
    spear_shaft = add_cylinder('imp_spear_shaft', radius=0.015, depth=1.40, location=(0.30, 0.20, 0.70), material=bark)
    spear_head = add_cone('imp_spear_tip', radius1=0.04, radius2=0.002, depth=0.25, location=(0.30, 0.20, 1.45), material=spines)
    parts.extend([spear_shaft, spear_head])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "21_monster_briar_imp", parts)

# -------------------------------------------------------------
# 22: Moss Golem (Ancient Earth Behemoth)
# -------------------------------------------------------------
def build_22_monster_moss_golem(out_dir):
    clear_scene()
    parts = []
    stone = MaterialLibrary.get('stone_mossy_boulder')
    vines = MaterialLibrary.get('cloth_forest_green')
    eye_mat = MaterialLibrary.get('emission_soul_lantern')
    
    # Titanic Boulder Torso
    torso = add_sphere('golem_torso', radius=0.55, scale=(1.25, 1.0, 0.95), location=(0, 0, 1.25), material=stone)
    parts.append(torso)
    
    # Head Boulder with Sunken Glowing Eye Slits
    head = add_sphere('golem_head', radius=0.22, scale=(1.1, 1.0, 0.8), location=(0, 0.20, 1.62), material=stone)
    eye = add_cube('golem_eye', size=1.0, scale=(0.12, 0.04, 0.03), location=(0, 0.38, 1.64), material=eye_mat)
    parts.extend([head, eye])
    
    # Massive Asymmetric Boulder Fists (One giant, one normal)
    # Giant Left Fist
    arm_l1 = add_cylinder('golem_arm_l1', radius=0.22, depth=0.65, location=(-0.65, 0.10, 1.20), rotation=(0, math.radians(-25), 0), material=stone)
    fist_l = add_sphere('golem_fist_l', radius=0.38, location=(-0.85, 0.25, 0.65), material=stone)
    # Right Fist
    arm_r1 = add_cylinder('golem_arm_r1', radius=0.18, depth=0.55, location=(0.60, 0.05, 1.25), rotation=(0, math.radians(20), 0), material=stone)
    fist_r = add_sphere('golem_fist_r', radius=0.26, location=(0.75, 0.15, 0.85), material=stone)
    parts.extend([arm_l1, fist_l, arm_r1, fist_r])
    
    # Creeping Vine Overgrowth Across Shoulders
    for i in range(5):
        vine = add_torus(f'golem_vine_{i}', major_radius=0.48 - i * 0.04, minor_radius=0.035, location=(0, 0, 1.50 - i * 0.08), rotation=(math.radians(15), 0, 0), material=vines)
        parts.append(vine)
        
    # Pillar Stone Legs
    for s in (-1, 1):
        leg = add_cylinder(f'golem_leg_{s}', radius=0.22, depth=0.85, location=(s * 0.35, 0, 0.45), material=stone)
        parts.append(leg)
        
    finalize_model(parts)
    return export_all_formats(out_dir, "22_monster_moss_golem", parts)

# -------------------------------------------------------------
# 23: Carrion Harpy (Vulture Beast)
# -------------------------------------------------------------
def build_23_monster_carrion_harpy(out_dir):
    clear_scene()
    parts = []
    feathers = MaterialLibrary.get('feathers_scavenger')
    bone = MaterialLibrary.get('bone_aged_ivory')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    # Gaunt Avian Body
    torso = add_cone('harpy_torso', radius1=0.22, radius2=0.30, depth=0.65, location=(0, 0, 0.95), material=feathers)
    parts.append(torso)
    
    # Vulture Skull & Long Curved Beak
    head = add_sphere('harpy_head', radius=0.13, scale=(0.85, 1.15, 0.9), location=(0, 0.15, 1.45), material=bone)
    beak = add_cone('harpy_beak', radius1=0.065, radius2=0.005, depth=0.32, location=(0, 0.38, 1.38), rotation=(math.radians(78), 0, 0), material=bone)
    parts.extend([head, beak])
    
    # Feathered Wings Spread at Sides
    for s in (-1, 1):
        wing_bone = add_cylinder(f'harpy_wing_bone_{s}', radius=0.035, depth=0.95, location=(s * 0.45, -0.10, 1.25), rotation=(0, math.radians(s * 65), math.radians(s * 25)), material=bone)
        wing_feathers = add_cone(f'harpy_feathers_{s}', radius1=0.45, radius2=0.05, depth=0.85, location=(s * 0.65, -0.15, 1.05), rotation=(0, math.radians(s * 45), 0), material=feathers)
        parts.extend([wing_bone, wing_feathers])
        
    # Raptorial Taloned Feet
    for s in (-1, 1):
        thigh = add_cylinder(f'harpy_thigh_{s}', radius=0.065, depth=0.45, location=(s * 0.18, 0, 0.55), material=feathers)
        talon_joint = add_cylinder(f'harpy_joint_{s}', radius=0.035, depth=0.40, location=(s * 0.18, 0.08, 0.22), material=bone)
        for t in range(3):
            claw = add_cone(f'harpy_claw_{s}_{t}', radius1=0.015, radius2=0.002, depth=0.12, location=(s * 0.18 + (t - 1) * 0.03, 0.22, 0.05), rotation=(math.radians(65), 0, 0), material=bone)
            parts.append(claw)
        parts.extend([thigh, talon_joint])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "23_monster_carrion_harpy", parts)

# -------------------------------------------------------------
# 24: Broodmother Spider (Cavern Arachnid)
# -------------------------------------------------------------
def build_24_monster_brood_spider(out_dir):
    clear_scene()
    parts = []
    chitin = MaterialLibrary.get('chitin_spider_black')
    egg_sac_mat = MaterialLibrary.get('bone_aged_ivory')
    eye_mat = MaterialLibrary.get('emission_fire_core')
    
    # Cephalothorax (Front body)
    head = add_sphere('spider_head', radius=0.25, scale=(1.0, 1.2, 0.7), location=(0, 0.25, 0.45), material=chitin)
    parts.append(head)
    
    # Swollen Veined Egg-Sac Abdomen (Rear body)
    abdomen = add_sphere('spider_abdomen', radius=0.45, scale=(1.15, 1.45, 1.05), location=(0, -0.45, 0.60), material=egg_sac_mat)
    parts.append(abdomen)
    
    # Multiple Glowing Red Spider Eyes
    eye_coords = [
        (-0.06, 0.45, 0.52), (0.06, 0.45, 0.52),
        (-0.12, 0.42, 0.54), (0.12, 0.42, 0.54),
        (-0.04, 0.47, 0.46), (0.04, 0.47, 0.46)
    ]
    for i, (ex, ey, ez) in enumerate(eye_coords):
        eye = add_sphere(f'spider_eye_{i}', radius=0.022, location=(ex, ey, ez), material=eye_mat)
        parts.append(eye)
        
    # 8 Long Segmented Jointed Arachnid Legs
    for side, sign in [('l', -1), ('r', 1)]:
        for leg_idx in range(4):
            angle = -35 + leg_idx * 30
            rad = math.radians(angle)
            lx = sign * 0.22
            ly = math.sin(rad) * 0.35
            # Segment 1 (rising up)
            seg1 = add_cylinder(f'spider_leg1_{side}_{leg_idx}', radius=0.025, depth=0.48,
                                location=(lx + sign * 0.18, ly, 0.55), rotation=(0, math.radians(sign * 45), math.radians(angle)), material=chitin)
            # Segment 2 (bending down to floor)
            seg2 = add_cylinder(f'spider_leg2_{side}_{leg_idx}', radius=0.018, depth=0.65,
                                location=(lx + sign * 0.45, ly, 0.28), rotation=(0, math.radians(sign * -40), math.radians(angle)), material=chitin)
            parts.extend([seg1, seg2])
            
    finalize_model(parts)
    return export_all_formats(out_dir, "24_monster_brood_spider", parts)

def build_tier_3_monsters(base_desktop_dir):
    """Executes all 8 monsters in Tier 3."""
    tier3_dir = f"{base_desktop_dir}\\03_Monsters"
    print(">>> GENERATING TIER 3: 03_MONSTERS...")
    results = [
        build_17_monster_leech_swarm(tier3_dir),
        build_18_monster_mimic_chest(tier3_dir),
        build_19_monster_toxic_toad(tier3_dir),
        build_20_monster_lantern_wraith(tier3_dir),
        build_21_monster_briar_imp(tier3_dir),
        build_22_monster_moss_golem(tier3_dir),
        build_23_monster_carrion_harpy(tier3_dir),
        build_24_monster_brood_spider(tier3_dir)
    ]
    return results
