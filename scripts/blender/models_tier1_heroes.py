"""
VALIXIS GAMES STUDIO - SOUL EMBER
Tier 1: Playable Heroes & Classes (Models 01 - 08)
Procedural 3D model generators matching the concept art.
"""

import bpy
import math
from mathutils import Vector
from soul_ember_materials import MaterialLibrary
from soul_ember_builder import (
    clear_scene, add_cube, add_cylinder, add_cone, add_sphere, add_torus, add_icosphere,
    create_humanoid_base, create_hood_and_cloak, create_staff, create_greatsword,
    create_bow, create_bell, finalize_model
)
from soul_ember_studio import export_all_formats

# -------------------------------------------------------------
# 01: Pyro Mage (Fire Pilgrim)
# -------------------------------------------------------------
def build_01_hero_pyro(out_dir):
    clear_scene()
    parts = []
    flesh = MaterialLibrary.get('flesh_necrotic')
    robe = MaterialLibrary.get('cloth_crimson')
    cloak = MaterialLibrary.get('cloth_scarlet_tattered')
    wood = MaterialLibrary.get('wood_ancient_oak')
    flame = MaterialLibrary.get('emission_fire_core')
    
    parts.extend(create_humanoid_base('pyro', height=1.75, flesh_mat=flesh, cloth_mat=robe))
    parts.extend(create_hood_and_cloak('pyro', height=1.75, cloak_mat=cloak))
    
    # Fire Staff
    staff = create_staff('pyro_staff', height=1.95, pole_mat=wood, head_mat=flame, head_type='fire')
    for p in staff:
        p.location.x += 0.42
        p.location.y += 0.15
    parts.extend(staff)
    
    # Leather Pouch
    pouch = add_cube('pyro_pouch', size=0.12, scale=(1.0, 0.6, 1.2), location=(-0.18, 0.12, 0.95), material=MaterialLibrary.get('leather_brown_worn'))
    parts.append(pouch)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "01_hero_pyro_mage", parts)

# -------------------------------------------------------------
# 02: Heavy Paladin (Knight of the Cinder)
# -------------------------------------------------------------
def build_02_hero_paladin(out_dir):
    clear_scene()
    parts = []
    steel = MaterialLibrary.get('metal_steel')
    iron_dark = MaterialLibrary.get('metal_iron_dark')
    gold = MaterialLibrary.get('metal_gold_ancient')
    fur = MaterialLibrary.get('fur_grey_wolf')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    # Bulky Armored Humanoid
    parts.extend(create_humanoid_base('paladin', height=1.92, chest_w=0.62, hip_w=0.48, flesh_mat=flesh, cloth_mat=steel))
    
    # Fluted Great Helm with Cross Visor
    helm = add_cylinder('paladin_helm', radius=0.15, depth=0.28, location=(0, 0, 1.76), material=steel)
    helm_top = add_sphere('paladin_helm_dome', radius=0.15, scale=(1.0, 1.0, 0.6), location=(0, 0, 1.88), material=steel)
    visor = add_cube('paladin_visor_slit', size=1.0, scale=(0.14, 0.04, 0.02), location=(0, 0.14, 1.76), material=iron_dark)
    parts.extend([helm, helm_top, visor])
    
    # Spiked Pauldrons (Shoulder Guards)
    for s in (-1, 1):
        pauldron = add_sphere(f'paladin_pauldron_{s}', radius=0.16, scale=(1.2, 1.0, 0.8), location=(s * 0.42, 0, 1.58), material=steel)
        p_spike = add_cone(f'paladin_spike_{s}', radius1=0.04, radius2=0.005, depth=0.12, location=(s * 0.44, 0, 1.70), material=iron_dark)
        parts.extend([pauldron, p_spike])
        
    # Fur Mantle / Collar
    fur_mantle = add_torus('paladin_fur_collar', major_radius=0.32, minor_radius=0.11, location=(0, -0.04, 1.58), rotation=(math.radians(15), 0, 0), material=fur)
    parts.append(fur_mantle)
    
    # Long Cape Behind
    cape = add_cone('paladin_cape', radius1=0.42, radius2=0.20, depth=1.30, location=(0, -0.16, 0.80), rotation=(math.radians(-8), 0, 0), material=MaterialLibrary.get('cloth_midnight_hood'))
    parts.append(cape)
    
    # Massive Greatsword Planted into Ground in Front
    sword = create_greatsword('paladin_greatsword', length=1.75, blade_mat=steel, hilt_mat=iron_dark, guard_mat=gold)
    for p in sword:
        p.location.x += 0.28
        p.location.y += 0.24
    parts.extend(sword)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "02_hero_heavy_paladin", parts)

# -------------------------------------------------------------
# 03: Swift Ranger (Archer of Whispering Pines)
# -------------------------------------------------------------
def build_03_hero_ranger(out_dir):
    clear_scene()
    parts = []
    green_cloth = MaterialLibrary.get('cloth_forest_green')
    leather = MaterialLibrary.get('leather_brown_worn')
    wood = MaterialLibrary.get('wood_ancient_oak')
    flesh = MaterialLibrary.get('flesh_necrotic')
    steel = MaterialLibrary.get('metal_steel')
    
    parts.extend(create_humanoid_base('ranger', height=1.72, chest_w=0.42, hip_w=0.36, flesh_mat=flesh, cloth_mat=green_cloth))
    parts.extend(create_hood_and_cloak('ranger', height=1.72, cloak_mat=green_cloth, trim_mat=leather))
    
    # Recurve Composite Bow in Hand
    bow = create_bow('ranger_bow', span=1.35, wood_mat=wood, string_mat=MaterialLibrary.get('metal_steel'))
    for p in bow:
        p.rotation_euler.y = math.radians(18)
        p.location.x -= 0.38
        p.location.y += 0.18
        p.location.z += 0.85
    parts.extend(bow)
    
    # Back Quiver with Arrows
    quiver = add_cylinder('ranger_quiver', radius=0.065, depth=0.75, location=(0.14, -0.22, 1.25), rotation=(math.radians(20), math.radians(-15), 0), material=leather)
    parts.append(quiver)
    for i in range(4):
        arrow = add_cylinder(f'ranger_arrow_{i}', radius=0.008, depth=0.85, location=(0.12 + i * 0.02, -0.23, 1.35), rotation=(math.radians(20), math.radians(-15), 0), material=wood)
        fletch = add_cone(f'ranger_fletch_{i}', radius1=0.02, radius2=0.005, depth=0.08, location=(0.12 + i * 0.02, -0.25, 1.68), rotation=(math.radians(20), math.radians(-15), 0), material=green_cloth)
        parts.extend([arrow, fletch])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "03_hero_swift_ranger", parts)

# -------------------------------------------------------------
# 04: Frost Witch (Cryomancer of the Glaze)
# -------------------------------------------------------------
def build_04_hero_cryo(out_dir):
    clear_scene()
    parts = []
    cerulean = MaterialLibrary.get('cloth_cerulean_frost')
    frost_crystal = MaterialLibrary.get('crystal_glacial_ice')
    fur = MaterialLibrary.get('cloth_offwhite_habit')
    flesh = MaterialLibrary.get('flesh_necrotic')
    silver = MaterialLibrary.get('metal_steel')
    
    # Flowing Robed Silhouette
    parts.extend(create_humanoid_base('cryo', height=1.70, chest_w=0.38, hip_w=0.42, flesh_mat=flesh, cloth_mat=cerulean))
    
    # Bell-shaped Elegant Gown Base
    skirt = add_cone('cryo_skirt', radius1=0.48, radius2=0.20, depth=0.95, location=(0, 0, 0.48), material=cerulean)
    parts.append(skirt)
    
    # Ice Crystal Crown / Diadem
    crown_base = add_torus('cryo_crown_ring', major_radius=0.12, minor_radius=0.015, location=(0, 0, 1.64), material=silver)
    parts.append(crown_base)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        icicle = add_cone(f'cryo_crown_spike_{a}', radius1=0.025, radius2=0.002, depth=0.12 + (a % 90 == 0) * 0.08,
                          location=(math.cos(rad) * 0.11, math.sin(rad) * 0.11, 1.70), rotation=(0, 0, 0), material=frost_crystal, vertices=5)
        parts.append(icicle)
        
    # Fur Collar / Shawl
    shawl = add_torus('cryo_fur_shawl', major_radius=0.25, minor_radius=0.08, location=(0, 0, 1.38), material=fur)
    parts.append(shawl)
    
    # Glacial Frost Staff
    staff = create_staff('cryo_staff', height=1.92, pole_mat=silver, head_mat=frost_crystal, head_type='crystal')
    for p in staff:
        p.location.x += 0.38
        p.location.y += 0.15
    parts.extend(staff)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "04_hero_frost_witch", parts)

# -------------------------------------------------------------
# 05: Skull Shaman (Necromancer of the Crypt)
# -------------------------------------------------------------
def build_05_hero_necro(out_dir):
    clear_scene()
    parts = []
    bone = MaterialLibrary.get('bone_aged_ivory')
    burlap = MaterialLibrary.get('cloth_midnight_hood')
    wood = MaterialLibrary.get('wood_ancient_oak')
    flesh = MaterialLibrary.get('flesh_necrotic')
    bronze = MaterialLibrary.get('metal_bronze_antique')
    
    parts.extend(create_humanoid_base('necro', height=1.75, flesh_mat=flesh, cloth_mat=burlap))
    parts.extend(create_hood_and_cloak('necro', height=1.75, cloak_mat=burlap))
    
    # Horned Ram Skull Mask
    skull_face = add_sphere('necro_skull_mask', radius=0.11, scale=(0.85, 1.25, 1.0), location=(0, 0.12, 1.58), material=bone)
    parts.append(skull_face)
    for s in (-1, 1):
        horn = add_torus(f'necro_mask_horn_{s}', major_radius=0.14, minor_radius=0.035,
                         location=(s * 0.15, 0.05, 1.64), rotation=(math.radians(35), math.radians(s * 55), math.radians(s * 25)), material=bone)
        parts.append(horn)
        
    # Ritual Bone Staff with Skulls & Chimes
    staff = create_staff('necro_staff', height=2.0, pole_mat=wood, head_mat=bone, head_type='bone')
    for p in staff:
        p.location.x += 0.40
        p.location.y += 0.18
    parts.extend(staff)
    
    # Dangling Talisman Bells on Belt
    for i in range(3):
        bell = add_cone(f'necro_charm_{i}', radius1=0.03, radius2=0.01, depth=0.06, location=(-0.16 + i * 0.15, 0.14, 0.90), material=bronze)
        parts.append(bell)
        
    finalize_model(parts)
    return export_all_formats(out_dir, "05_hero_skull_shaman", parts)

# -------------------------------------------------------------
# 06: Shadow Rogue (Dual-Blade Void Assassin)
# -------------------------------------------------------------
def build_06_hero_rogue(out_dir):
    clear_scene()
    parts = []
    leather_black = MaterialLibrary.get('leather_black')
    violet_cloth = MaterialLibrary.get('cloth_regal_violet')
    steel = MaterialLibrary.get('metal_steel')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('rogue', height=1.74, chest_w=0.40, hip_w=0.34, flesh_mat=flesh, cloth_mat=leather_black))
    
    # Billowing Shadow Scarf
    scarf = add_torus('rogue_scarf_loop', major_radius=0.18, minor_radius=0.05, location=(0, 0, 1.44), rotation=(math.radians(15), 0, 0), material=violet_cloth)
    tail1 = add_cone('rogue_scarf_tail1', radius1=0.12, radius2=0.02, depth=0.85, location=(-0.22, -0.22, 1.05), rotation=(math.radians(-30), math.radians(-25), 0), material=violet_cloth)
    tail2 = add_cone('rogue_scarf_tail2', radius1=0.10, radius2=0.015, depth=0.70, location=(0.18, -0.20, 1.10), rotation=(math.radians(-35), math.radians(20), 0), material=violet_cloth)
    parts.extend([scarf, tail1, tail2])
    
    # Masked Cowl
    cowl = add_sphere('rogue_cowl', radius=0.12, scale=(0.95, 1.1, 1.1), location=(0, 0, 1.58), material=leather_black)
    mask = add_cube('rogue_face_mask', size=1.0, scale=(0.10, 0.08, 0.08), location=(0, 0.09, 1.54), material=leather_black)
    parts.extend([cowl, mask])
    
    # Dual Curved Assassin Daggers (one in each hand)
    for side, sign in [('l', -1), ('r', 1)]:
        blade = add_cube(f'rogue_dagger_blade_{side}', size=1.0, scale=(0.04, 0.012, 0.42),
                         location=(sign * 0.38, 0.22, 0.85), rotation=(math.radians(sign * 25), math.radians(sign * 15), 0), material=steel)
        hilt = add_cylinder(f'rogue_dagger_hilt_{side}', radius=0.018, depth=0.14,
                            location=(sign * 0.38, 0.22, 0.60), rotation=(math.radians(sign * 25), math.radians(sign * 15), 0), material=leather_black)
        guard = add_cube(f'rogue_dagger_guard_{side}', size=1.0, scale=(0.10, 0.025, 0.02),
                         location=(sign * 0.38, 0.22, 0.67), rotation=(math.radians(sign * 25), math.radians(sign * 15), 0), material=steel)
        parts.extend([blade, hilt, guard])
        
    finalize_model(parts)
    return export_all_formats(out_dir, "06_hero_shadow_rogue", parts)

# -------------------------------------------------------------
# 07: Plague Alchemist (Doctor of the Miasma)
# -------------------------------------------------------------
def build_07_hero_alchemist(out_dir):
    clear_scene()
    parts = []
    leather = MaterialLibrary.get('leather_brown_worn')
    bone = MaterialLibrary.get('bone_aged_ivory')
    bronze = MaterialLibrary.get('metal_bronze_antique')
    glass = MaterialLibrary.get('glass_potion_vial')
    elixir = MaterialLibrary.get('liquid_crimson_elixir')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('alchemist', height=1.75, flesh_mat=flesh, cloth_mat=leather))
    
    # Long Trenchcoat / Greatcoat
    coat = add_cone('alchemist_coat', radius1=0.45, radius2=0.22, depth=1.10, location=(0, 0, 0.65), material=leather)
    parts.append(coat)
    
    # Wide Brimmed Doctor Hat
    brim = add_cylinder('alchemist_hat_brim', radius=0.34, depth=0.025, location=(0, 0, 1.68), material=leather)
    crown = add_cylinder('alchemist_hat_crown', radius=0.18, depth=0.18, location=(0, 0, 1.77), material=leather)
    parts.extend([brim, crown])
    
    # Plague Doctor Beak Mask
    beak = add_cone('alchemist_beak', radius1=0.065, radius2=0.008, depth=0.32, location=(0, 0.24, 1.54), rotation=(math.radians(82), 0, 0), material=bone)
    parts.append(beak)
    for s in (-1, 1):
        goggle = add_torus(f'alchemist_goggle_{s}', major_radius=0.035, minor_radius=0.01, location=(s * 0.065, 0.11, 1.60), rotation=(math.radians(90), 0, 0), material=bronze)
        parts.append(goggle)
        
    # Bandolier of Potion Vials on Chest
    for i in range(4):
        vial = add_cylinder(f'alchemist_vial_{i}', radius=0.025, depth=0.10, location=(-0.14 + i * 0.09, 0.16, 1.25 - i * 0.05), rotation=(0, math.radians(25), 0), material=glass)
        cap = add_cylinder(f'alchemist_vial_cap_{i}', radius=0.015, depth=0.025, location=(-0.14 + i * 0.09, 0.16, 1.30 - i * 0.05), rotation=(0, math.radians(25), 0), material=bronze)
        parts.extend([vial, cap])
        
    # Holding Chemical Flask in Right Hand
    flask_body = add_sphere('alchemist_flask_globe', radius=0.08, location=(0.35, 0.28, 0.88), material=elixir)
    flask_neck = add_cylinder('alchemist_flask_neck', radius=0.02, depth=0.08, location=(0.35, 0.28, 0.96), material=glass)
    parts.extend([flask_body, flask_neck])
    
    finalize_model(parts)
    return export_all_formats(out_dir, "07_hero_plague_alchemist", parts)

# -------------------------------------------------------------
# 08: Bell Inquisitor (Monk of Holy Chimes)
# -------------------------------------------------------------
def build_08_hero_bell_monk(out_dir):
    clear_scene()
    parts = []
    habit = MaterialLibrary.get('cloth_offwhite_habit')
    leather = MaterialLibrary.get('leather_brown_worn')
    bronze = MaterialLibrary.get('metal_bronze_antique')
    iron = MaterialLibrary.get('metal_iron_dark')
    flesh = MaterialLibrary.get('flesh_necrotic')
    
    parts.extend(create_humanoid_base('bell_monk', height=1.78, chest_w=0.46, hip_w=0.42, flesh_mat=flesh, cloth_mat=habit))
    parts.extend(create_hood_and_cloak('bell_monk', height=1.78, cloak_mat=habit))
    
    # Monastic Scapular / Cowl drape
    scapular = add_cube('bell_monk_scapular', size=1.0, scale=(0.32, 0.06, 0.95), location=(0, 0.14, 0.85), material=MaterialLibrary.get('cloth_crimson'))
    parts.append(scapular)
    
    # Rope Cincture with dangling beads
    rope = add_torus('bell_monk_rope', major_radius=0.22, minor_radius=0.025, location=(0, 0, 0.96), material=leather)
    parts.append(rope)
    
    # Oversized Holy Cathedral Bell Flail / Lantern
    bell = create_bell('bell_monk_bell', height=0.55, radius_base=0.30, bronze_mat=bronze, iron_mat=iron)
    # Position bell in right hand
    for p in bell:
        p.location.x += 0.45
        p.location.y += 0.20
        p.location.z += 0.70
    parts.extend(bell)
    
    # Connecting Chain to hand
    chain = add_cylinder('bell_monk_chain', radius=0.012, depth=0.45, location=(0.38, 0.18, 1.15), material=iron)
    parts.append(chain)
    
    finalize_model(parts)
    return export_all_formats(out_dir, "08_hero_bell_inquisitor", parts)

def build_tier_1_heroes(base_desktop_dir):
    """Executes all 8 heroes in Tier 1."""
    tier1_dir = f"{base_desktop_dir}\\01_Heroes"
    print(">>> GENERATING TIER 1: 01_HEROES...")
    results = [
        build_01_hero_pyro(tier1_dir),
        build_02_hero_paladin(tier1_dir),
        build_03_hero_ranger(tier1_dir),
        build_04_hero_cryo(tier1_dir),
        build_05_hero_necro(tier1_dir),
        build_06_hero_rogue(tier1_dir),
        build_07_hero_alchemist(tier1_dir),
        build_08_hero_bell_monk(tier1_dir)
    ]
    return results
