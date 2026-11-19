"""
VALIXIS GAMES STUDIO - SOUL EMBER
Tier 2: Dungeon & Crypt Foes (Models 09 - 16)
Procedural 3D model generators matching the concept art.
"""

import bpy
import math
from mathutils import Vector
from soul_ember_materials import MaterialLibrary
from soul_ember_builder import (
    clear_scene, add_cube, add_cylinder, add_cone, add_sphere, add_torus, add_icosphere,
    create_humanoid_base, create_bow, create_bell, create_censer, finalize_model
)
from soul_ember_studio import export_all_formats

# -------------------------------------------------------------
# 09: Flesh Ghoul (Starved Undead)
# -------------------------------------------------------------
def build_09_enemy_flesh_ghoul(out_dir):
    clear_scene()
    parts = []
    necro_flesh = MaterialLibrary.get('flesh_necrotic')
    bone = MaterialLibrary.get('bone_aged_ivory')
    rag = MaterialLibrary.get('cloth_midnight_hood')
    
    # Crouched, Emaciated Stance
    torso = add_cone('ghoul_torso', radius1=0.14, radius2=0.22, depth=0.55, location=(0, 0.15, 0.75), rotation=(math.radians(35), 0, 0), material=necro_flesh)
    parts.append(torso)
    
    # Exposed Ribs
    for i in range(4):
        rib = add_torus(f'ghoul_rib_{i}', major_radius=0.18 - i * 0.015, minor_radius=0.012,
                        location=(0, 0.16 + i * 0.04, 0.85 - i * 0.08), rotation=(math.radians(35), 0, 0), material=bone)
        parts.append(rib)
        
    # Skull-like Head
    head = add_sphere('ghoul_head', radius=0.14, scale=(0.85, 1.25, 0.95), location=(0, 0.42, 1.05), rotation=(math.radians(20), 0, 0), material=necro_flesh)
    jaw = add_cone('ghoul_jaw', radius1=0.08, radius2=0.02, depth=0.12, location=(0, 0.48, 0.96), rotation=(math.radians(50), 0, 0), material=bone)
    parts.extend([head, jaw])
    
    # Elongated Clawed Arms
    for s in (-1, 1):
        arm1 = add_cylinder(f'ghoul_arm_upper_{s}', radius=0.045, depth=0.45, location=(s * 0.28, 0.25, 0.82), rotation=(math.radians(-25), math.radians(s * 20), 0), material=necro_flesh)
        arm2 = add_cylinder(f'ghoul_arm_lower_{s}', radius=0.035, depth=0.50, location=(s * 0.35, 0.45, 0.48), rotation=(math.radians(45), math.radians(s * 10), 0), material=necro_flesh)
        # Claws
        for c in range(3):
            claw = add_cone(f'ghoul_claw_{s}_{c}', radius1=0.012, radius2=0.002, depth=0.12,
                            location=(s * 0.35 + (c - 1) * 0.025, 0.62, 0.25), rotation=(math.radians(65), 0, 0), material=bone)
            parts.append(claw)
        parts.extend([arm1, arm2])
        
    # Bent Crouching Legs
    for s in (-1, 1):
        thigh = add_cylinder(f'ghoul_thigh_{s}', radius=0.065, depth=0.45, location=(s * 0.22, -0.05, 0.55), rotation=(math.radians(55), math.radians(s * 15), 0), material=necro_flesh)
        shin = add_cylinder(f'ghoul_shin_{s}', radius=0.05, depth=0.50, location=(s * 0.24, 0.12, 0.24), rotation=(math.radians(-40), math.radians(s * 10), 0), material=necro_flesh)
        parts.extend([thigh, shin])
        
    # Tattered loincloth
    loin = add_cone('ghoul_loincloth', radius1=0.22, radius2=0.14, depth=0.35, location=(0, 0, 0.48), material=rag)
    parts.append(loin)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "09_enemy_flesh_ghoul", parts)

# -------------------------------------------------------------
# 10: Skeleton Guard (Footman with Cross Kite Shield)
# -------------------------------------------------------------
def build_10_enemy_skeleton_guard(out_dir):
    clear_scene()
    parts = []
    bone = MaterialLibrary.get('bone_aged_ivory')
    iron_rust = MaterialLibrary.get('metal_iron_rusted')
    steel = MaterialLibrary.get('metal_steel')
    wood = MaterialLibrary.get('wood_ancient_oak')
    
    # Skeletal Spine & Ribcage
    spine = add_cylinder('skel_spine', radius=0.035, depth=0.65, location=(0, 0, 1.05), material=bone)
    parts.append(spine)
    for i in range(5):
        rib = add_torus(f'skel_rib_{i}', major_radius=0.19 - i * 0.015, minor_radius=0.015, location=(0, 0, 1.25 - i * 0.07), material=bone)
        parts.append(rib)
    pelvis = add_sphere('skel_pelvis', radius=0.14, scale=(1.2, 0.8, 0.6), location=(0, 0, 0.85), material=bone)
    parts.append(pelvis)
    
    # Skull
    skull = add_sphere('skel_skull', radius=0.12, scale=(0.85, 1.15, 1.0), location=(0, 0.02, 1.55), material=bone)
    parts.append(skull)
    
    # Rusted Kettle Helmet
    helm_dome = add_sphere('skel_helm_dome', radius=0.14, scale=(1.0, 1.0, 0.6), location=(0, 0.02, 1.63), material=iron_rust)
    helm_brim = add_cylinder('skel_helm_brim', radius=0.22, depth=0.02, location=(0, 0.02, 1.58), material=iron_rust)
    parts.extend([helm_dome, helm_brim])
    
    # Skeletal Limbs
    for s in (-1, 1):
        arm1 = add_cylinder(f'skel_arm1_{s}', radius=0.025, depth=0.35, location=(s * 0.28, 0, 1.22), material=bone)
        arm2 = add_cylinder(f'skel_arm2_{s}', radius=0.020, depth=0.35, location=(s * 0.32, 0.12, 0.95), rotation=(math.radians(25), 0, 0), material=bone)
        leg1 = add_cylinder(f'skel_leg1_{s}', radius=0.035, depth=0.45, location=(s * 0.15, 0, 0.62), material=bone)
        leg2 = add_cylinder(f'skel_leg2_{s}', radius=0.028, depth=0.45, location=(s * 0.15, 0, 0.22), material=bone)
        parts.extend([arm1, arm2, leg1, leg2])
        
    # Right Hand: Notched Arming Sword
    sword_blade = add_cube('skel_sword_blade', size=1.0, scale=(0.06, 0.015, 0.85), location=(0.35, 0.25, 0.80), rotation=(math.radians(20), 0, 0), material=iron_rust)
    sword_guard = add_cube('skel_sword_guard', size=1.0, scale=(0.22, 0.03, 0.025), location=(0.35, 0.25, 0.40), rotation=(math.radians(20), 0, 0), material=iron_rust)
    parts.extend([sword_blade, sword_guard])
    
    # Left Hand: Large Cross Kite Shield
    shield_body = add_cube('skel_shield', size=1.0, scale=(0.42, 0.04, 0.80), location=(-0.35, 0.20, 0.95), rotation=(math.radians(5), math.radians(-15), 0), material=wood)
    shield_rim = add_torus('skel_shield_rim', major_radius=0.28, minor_radius=0.02, location=(-0.35, 0.22, 0.95), rotation=(math.radians(90), 0, 0), material=iron_rust)
    shield_cross_v = add_cube('skel_shield_cross_v', size=1.0, scale=(0.07, 0.02, 0.65), location=(-0.35, 0.23, 0.95), material=steel)
    shield_cross_h = add_cube('skel_shield_cross_h', size=1.0, scale=(0.28, 0.02, 0.07), location=(-0.35, 0.23, 1.05), material=steel)
    parts.extend([shield_body, shield_rim, shield_cross_v, shield_cross_h])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "10_enemy_skeleton_guard", parts)

# -------------------------------------------------------------
# 11: Censer Cultist (Ritual Acolyte)
# -------------------------------------------------------------
def build_11_enemy_censer_cultist(out_dir):
    clear_scene()
    parts = []
    crimson = MaterialLibrary.get('cloth_crimson')
    cream = MaterialLibrary.get('cloth_offwhite_habit')
    bronze = MaterialLibrary.get('metal_bronze_antique')
    iron = MaterialLibrary.get('metal_iron_dark')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('cultist', height=1.72, flesh_mat=flesh, cloth_mat=cream))
    
    # Draped Cowl & Blindfold Shroud
    hood = add_sphere('cultist_hood', radius=0.15, scale=(0.95, 1.15, 1.1), location=(0, 0, 1.58), material=cream)
    blindfold = add_torus('cultist_blindfold', major_radius=0.12, minor_radius=0.025, location=(0, 0.05, 1.54), material=crimson)
    parts.extend([hood, blindfold])
    
    # Blood-Splattered Ritual Stole
    stole = add_cube('cultist_stole', size=1.0, scale=(0.28, 0.06, 0.85), location=(0, 0.12, 0.95), material=crimson)
    parts.append(stole)
    
    # Hanging Bronze Incense Censer held forward by chains
    censer = create_censer('cultist_censer', chain_len=0.65, censer_mat=bronze, chain_mat=iron)
    for p in censer:
        p.location.x += 0.25
        p.location.y += 0.38
        p.location.z += 0.55
    parts.extend(censer)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "11_enemy_censer_cultist", parts)

# -------------------------------------------------------------
# 12: Bell Quasimodo (Hunchback Bell Chimera)
# -------------------------------------------------------------
def build_12_enemy_bell_quasimodo(out_dir):
    clear_scene()
    parts = []
    flesh = MaterialLibrary.get('flesh_necrotic')
    bronze = MaterialLibrary.get('metal_bronze_antique')
    iron = MaterialLibrary.get('metal_iron_dark')
    rag = MaterialLibrary.get('cloth_midnight_hood')
    
    # Massive Asymmetric Hunched Body
    torso = add_sphere('quasi_torso', radius=0.45, scale=(1.1, 1.3, 0.9), location=(0, 0.10, 0.95), material=flesh)
    hunch = add_sphere('quasi_hunch', radius=0.35, scale=(1.0, 1.1, 1.2), location=(0, -0.22, 1.30), material=flesh)
    parts.extend([torso, hunch])
    
    # Distorted Head nestled low in chest
    head = add_sphere('quasi_head', radius=0.15, scale=(1.1, 1.2, 0.85), location=(0, 0.32, 1.15), material=flesh)
    parts.append(head)
    
    # Enormous Antique Bronze Bell Bolted to Spine
    bell = create_bell('quasi_bell', height=0.68, radius_base=0.42, bronze_mat=bronze, iron_mat=iron)
    for p in bell:
        p.rotation_euler.x = math.radians(-35)
        p.location.y -= 0.32
        p.location.z += 1.25
    parts.extend(bell)
    
    # Heavy Iron Collar & Straps holding bell
    collar = add_torus('quasi_collar', major_radius=0.28, minor_radius=0.04, location=(0, 0.05, 1.18), rotation=(math.radians(25), 0, 0), material=iron)
    parts.append(collar)
    
    # Hulking Arms
    for s in (-1, 1):
        arm = add_cylinder(f'quasi_arm_{s}', radius=0.12, depth=0.75, location=(s * 0.48, 0.15, 0.70), rotation=(math.radians(20), math.radians(s * 15), 0), material=flesh)
        fist = add_sphere(f'quasi_fist_{s}', radius=0.14, location=(s * 0.52, 0.28, 0.35), material=flesh)
        parts.extend([arm, fist])
        
    # Squat Legs
    for s in (-1, 1):
        leg = add_cylinder(f'quasi_leg_{s}', radius=0.15, depth=0.55, location=(s * 0.28, -0.05, 0.30), material=rag)
        parts.append(leg)
        
    finalize_model(parts)
    return export_all_formats(out_dir, "12_enemy_bell_quasimodo", parts)

# -------------------------------------------------------------
# 13: Ember Hound (Blighted Molten Wolf)
# -------------------------------------------------------------
def build_13_enemy_ember_hound(out_dir):
    clear_scene()
    parts = []
    pelt = MaterialLibrary.get('cloth_midnight_hood')
    lava = MaterialLibrary.get('emission_molten_lava')
    bone = MaterialLibrary.get('bone_aged_ivory')
    
    # Muscular Quadruped Canine Torso
    chest = add_sphere('hound_chest', radius=0.35, scale=(0.85, 1.4, 1.0), location=(0, 0.15, 0.70), material=pelt)
    pelvis = add_sphere('hound_pelvis', radius=0.28, scale=(0.75, 1.1, 0.9), location=(0, -0.45, 0.65), material=pelt)
    parts.extend([chest, pelvis])
    
    # Glowing Molten Rib Fissures
    for i in range(4):
        fissure = add_torus(f'hound_fissure_{i}', major_radius=0.26 - i * 0.02, minor_radius=0.012,
                            location=(0, 0.25 - i * 0.15, 0.70), rotation=(0, math.radians(90), 0), material=lava)
        parts.append(fissure)
        
    # Spined Ridge Along Back
    for i in range(6):
        spike = add_cone(f'hound_spine_{i}', radius1=0.04, radius2=0.005, depth=0.18,
                         location=(0, 0.35 - i * 0.16, 0.95), rotation=(math.radians(-25), 0, 0), material=bone)
        parts.append(spike)
        
    # Snarling Wolf Head with Glowing Magma Maw
    head = add_sphere('hound_head', radius=0.18, scale=(0.85, 1.3, 0.9), location=(0, 0.65, 0.92), material=pelt)
    snout = add_cone('hound_snout', radius1=0.10, radius2=0.04, depth=0.25, location=(0, 0.85, 0.90), rotation=(math.radians(90), 0, 0), material=pelt)
    maw_glow = add_sphere('hound_maw_glow', radius=0.08, scale=(0.7, 1.4, 0.6), location=(0, 0.82, 0.85), material=lava)
    parts.extend([head, snout, maw_glow])
    
    # 4 Powerful Legs
    for side, sign in [('fl', -1), ('fr', 1)]:
        f_leg = add_cylinder(f'hound_leg_{side}', radius=0.065, depth=0.65, location=(sign * 0.24, 0.30, 0.35), rotation=(math.radians(-10), 0, 0), material=pelt)
        parts.append(f_leg)
    for side, sign in [('bl', -1), ('fr', 1)]:
        b_leg1 = add_cylinder(f'hound_bleg1_{side}', radius=0.08, depth=0.38, location=(sign * 0.22, -0.45, 0.50), rotation=(math.radians(35), 0, 0), material=pelt)
        b_leg2 = add_cylinder(f'hound_bleg2_{side}', radius=0.055, depth=0.38, location=(sign * 0.22, -0.48, 0.20), rotation=(math.radians(-25), 0, 0), material=pelt)
        parts.extend([b_leg1, b_leg2])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "13_enemy_ember_hound", parts)

# -------------------------------------------------------------
# 14: Stone Gargoyle (Winged Demonic Sentinel)
# -------------------------------------------------------------
def build_14_enemy_stone_gargoyle(out_dir):
    clear_scene()
    parts = []
    stone = MaterialLibrary.get('stone_gargoyle')
    
    # Carved Stone Pedestal Base
    pedestal = add_cylinder('garg_pedestal', radius=0.45, depth=0.25, location=(0, 0, 0.12), material=stone)
    parts.append(pedestal)
    
    # Perching Demon Body
    torso = add_cone('garg_torso', radius1=0.22, radius2=0.32, depth=0.55, location=(0, 0, 0.65), material=stone)
    parts.append(torso)
    
    # Horned Demonic Head
    head = add_sphere('garg_head', radius=0.16, scale=(0.95, 1.15, 1.0), location=(0, 0.08, 1.05), material=stone)
    parts.append(head)
    for s in (-1, 1):
        horn = add_torus(f'garg_horn_{s}', major_radius=0.14, minor_radius=0.03, location=(s * 0.16, 0, 1.18), rotation=(math.radians(45), math.radians(s * 45), 0), material=stone)
        parts.append(horn)
        
    # Large Bat Wings Spread at Sides
    for s in (-1, 1):
        wing_arm = add_cylinder(f'garg_wing_arm_{s}', radius=0.035, depth=0.85, location=(s * 0.45, -0.15, 0.95), rotation=(0, math.radians(s * 55), math.radians(s * 35)), material=stone)
        wing_web = add_cone(f'garg_wing_web_{s}', radius1=0.45, radius2=0.05, depth=0.75, location=(s * 0.55, -0.20, 0.75), rotation=(0, math.radians(s * 45), 0), material=stone)
        parts.extend([wing_arm, wing_web])
        
    # Perched Taloned Legs
    for s in (-1, 1):
        leg = add_cylinder(f'garg_leg_{s}', radius=0.08, depth=0.45, location=(s * 0.22, 0.14, 0.35), rotation=(math.radians(35), 0, 0), material=stone)
        talon = add_cube(f'garg_talon_{s}', size=1.0, scale=(0.10, 0.16, 0.05), location=(s * 0.22, 0.24, 0.25), material=stone)
        parts.extend([leg, talon])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "14_enemy_stone_gargoyle", parts)

# -------------------------------------------------------------
# 15: Swamp Ghoul (Drowned Rotting Corpse)
# -------------------------------------------------------------
def build_15_enemy_swamp_ghoul(out_dir):
    clear_scene()
    parts = []
    necro_flesh = MaterialLibrary.get('flesh_necrotic')
    moss = MaterialLibrary.get('stone_mossy_boulder')
    algae = MaterialLibrary.get('cloth_forest_green')
    
    parts.extend(create_humanoid_base('swamp_ghoul', height=1.75, flesh_mat=necro_flesh, cloth_mat=moss))
    
    # Hanging Moss Strands & Pondweed
    for i in range(8):
        angle = i * 45
        rad = math.radians(angle)
        strand = add_cone(f'swamp_moss_{i}', radius1=0.04, radius2=0.005, depth=0.65 + (i % 3) * 0.2,
                          location=(math.cos(rad) * 0.28, math.sin(rad) * 0.28, 1.15 - (i % 2) * 0.25), material=algae)
        parts.append(strand)
        
    # Bloated Decaying Torso Growth
    boil1 = add_sphere('swamp_boil1', radius=0.12, location=(0.14, 0.15, 1.10), material=moss)
    boil2 = add_sphere('swamp_boil2', radius=0.09, location=(-0.16, 0.12, 0.95), material=moss)
    parts.extend([boil1, boil2])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "15_enemy_swamp_ghoul", parts)

# -------------------------------------------------------------
# 16: Skeleton Archer (Marksman of the Catacombs)
# -------------------------------------------------------------
def build_16_enemy_skeleton_archer(out_dir):
    clear_scene()
    parts = []
    bone = MaterialLibrary.get('bone_aged_ivory')
    wood = MaterialLibrary.get('wood_ancient_oak')
    leather = MaterialLibrary.get('leather_brown_worn')
    string_mat = MaterialLibrary.get('metal_steel')
    
    # Skeletal Anatomy
    spine = add_cylinder('skel_arc_spine', radius=0.035, depth=0.65, location=(0, 0, 1.05), material=bone)
    parts.append(spine)
    for i in range(5):
        rib = add_torus(f'skel_arc_rib_{i}', major_radius=0.18 - i * 0.015, minor_radius=0.014, location=(0, 0, 1.25 - i * 0.07), material=bone)
        parts.append(rib)
    skull = add_sphere('skel_arc_skull', radius=0.12, scale=(0.85, 1.15, 1.0), location=(0, 0.02, 1.55), material=bone)
    parts.append(skull)
    
    # Arms in Archer Pose: Left arm extended forward holding bow, right arm drawing string
    l_arm1 = add_cylinder('skel_arc_l_arm1', radius=0.025, depth=0.35, location=(-0.25, 0.15, 1.30), rotation=(math.radians(75), math.radians(-35), 0), material=bone)
    l_arm2 = add_cylinder('skel_arc_l_arm2', radius=0.020, depth=0.35, location=(-0.35, 0.42, 1.32), rotation=(math.radians(90), 0, 0), material=bone)
    r_arm1 = add_cylinder('skel_arc_r_arm1', radius=0.025, depth=0.35, location=(0.25, 0.10, 1.28), rotation=(math.radians(45), math.radians(45), 0), material=bone)
    r_arm2 = add_cylinder('skel_arc_r_arm2', radius=0.020, depth=0.35, location=(0.28, 0.15, 1.35), rotation=(math.radians(-45), math.radians(35), 0), material=bone)
    parts.extend([l_arm1, l_arm2, r_arm1, r_arm2])
    
    # Bone Bow
    bow = create_bow('skel_bow', span=1.30, wood_mat=bone, string_mat=string_mat)
    for p in bow:
        p.location.x -= 0.38
        p.location.y += 0.55
        p.location.z += 1.32
        p.rotation_euler.y = math.radians(15)
    parts.extend(bow)
    
    # Bone Arrow Nocked & Drawn
    arrow_shaft = add_cylinder('skel_arrow', radius=0.006, depth=0.75, location=(-0.10, 0.35, 1.35), rotation=(math.radians(90), 0, math.radians(-25)), material=wood)
    arrow_tip = add_cone('skel_arrow_tip', radius1=0.018, radius2=0.002, depth=0.08, location=(-0.28, 0.56, 1.35), rotation=(math.radians(90), 0, math.radians(-25)), material=bone)
    parts.extend([arrow_shaft, arrow_tip])
    
    # Bone Legs
    for s in (-1, 1):
        leg1 = add_cylinder(f'skel_arc_leg1_{s}', radius=0.035, depth=0.45, location=(s * 0.18, 0, 0.62), material=bone)
        leg2 = add_cylinder(f'skel_arc_leg2_{s}', radius=0.028, depth=0.45, location=(s * 0.18, 0, 0.22), material=bone)
        parts.extend([leg1, leg2])
        
    # Quiver of Bone Arrows on Spine
    quiver = add_cylinder('skel_arc_quiver', radius=0.065, depth=0.65, location=(0.10, -0.16, 1.15), rotation=(math.radians(25), math.radians(-20), 0), material=leather)
    parts.append(quiver)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "16_enemy_skeleton_archer", parts)

def build_tier_2_enemies(base_desktop_dir):
    """Executes all 8 enemies in Tier 2."""
    tier2_dir = f"{base_desktop_dir}\\02_Enemies"
    print(">>> GENERATING TIER 2: 02_ENEMIES...")
    results = [
        build_09_enemy_flesh_ghoul(tier2_dir),
        build_10_enemy_skeleton_guard(tier2_dir),
        build_11_enemy_censer_cultist(tier2_dir),
        build_12_enemy_bell_quasimodo(tier2_dir),
        build_13_enemy_ember_hound(tier2_dir),
        build_14_enemy_stone_gargoyle(tier2_dir),
        build_15_enemy_swamp_ghoul(tier2_dir),
        build_16_enemy_skeleton_archer(tier2_dir)
    ]
    return results
