"""
VALIXIS GAMES STUDIO - SOUL EMBER
Blender 4.5 3D Mesh Generation & Geometry Utilities
Zero external dependencies; generates precision game-ready geometry.
"""

import bpy
import math
from mathutils import Vector, Euler

def clear_scene():
    """Wipe all existing objects, meshes, and materials in the scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)

def assign_material(obj, mat):
    """Assign or replace material on an object."""
    if obj is None or mat is None:
        return
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def add_cube(name, size=1.0, scale=(1.0, 1.0, 1.0), location=(0, 0, 0), rotation=(0, 0, 0), material=None):
    """Create a scaled, positioned cube."""
    bpy.ops.mesh.primitive_cube_add(size=size, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    if material:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj

def add_cylinder(name, radius=0.5, depth=1.0, location=(0, 0, 0), rotation=(0, 0, 0), material=None, vertices=24):
    """Create a standard cylinder."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj

def add_cone(name, radius1=0.5, radius2=0.0, depth=1.0, location=(0, 0, 0), rotation=(0, 0, 0), material=None, vertices=24):
    """Create a tapered cylinder or cone."""
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj

def add_sphere(name, radius=0.5, scale=(1.0, 1.0, 1.0), location=(0, 0, 0), rotation=(0, 0, 0), material=None, segments=24, ring_count=16):
    """Create a UV sphere."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=ring_count, radius=radius, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    if material:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj

def add_torus(name, major_radius=0.5, minor_radius=0.1, location=(0, 0, 0), rotation=(0, 0, 0), material=None, major_segments=24, minor_segments=12):
    """Create a torus / ring."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=major_segments, minor_segments=minor_segments, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj

def add_icosphere(name, radius=0.5, subdivisions=2, location=(0, 0, 0), material=None):
    """Create an icosphere (ideal for crystals and geodes)."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        assign_material(obj, material)
    return obj

# -------------------------------------------------------------
# Complex Modular Dark Fantasy Elements
# -------------------------------------------------------------

def create_humanoid_base(prefix, height=1.75, chest_w=0.45, hip_w=0.38, flesh_mat=None, cloth_mat=None):
    """Creates a stylized dark fantasy humanoid body mesh hierarchy."""
    parts = []
    
    # Pelvis & Torso
    torso_z = height * 0.58
    torso = add_cone(f"{prefix}_torso", radius1=hip_w * 0.5, radius2=chest_w * 0.5, depth=height * 0.28,
                     location=(0, 0, torso_z), material=cloth_mat or flesh_mat)
    parts.append(torso)
    
    # Chest
    chest_z = height * 0.72
    chest = add_cone(f"{prefix}_chest", radius1=chest_w * 0.5, radius2=chest_w * 0.55, depth=height * 0.16,
                     location=(0, 0, chest_z), material=cloth_mat or flesh_mat)
    parts.append(chest)
    
    # Head & Neck
    neck = add_cylinder(f"{prefix}_neck", radius=0.09, depth=height * 0.08, location=(0, 0, height * 0.82), material=flesh_mat)
    parts.append(neck)
    head = add_sphere(f"{prefix}_head", radius=height * 0.09, scale=(0.85, 1.0, 1.15), location=(0, 0.02, height * 0.91), material=flesh_mat)
    parts.append(head)
    
    # Shoulders & Arms
    for side in (-1, 1):
        sx = side * (chest_w * 0.55)
        shoulder = add_sphere(f"{prefix}_shoulder_{'l' if side < 0 else 'r'}", radius=0.08, location=(sx, 0, height * 0.77), material=cloth_mat or flesh_mat)
        parts.append(shoulder)
        
        upper_arm = add_cone(f"{prefix}_arm_upper_{'l' if side < 0 else 'r'}", radius1=0.07, radius2=0.055, depth=height * 0.20,
                             location=(sx + side * 0.06, 0, height * 0.65), rotation=(0, side * 0.15, 0), material=cloth_mat or flesh_mat)
        parts.append(upper_arm)
        
        forearm = add_cone(f"{prefix}_forearm_{'l' if side < 0 else 'r'}", radius1=0.055, radius2=0.045, depth=height * 0.20,
                           location=(sx + side * 0.12, 0.03, height * 0.48), rotation=(-0.15, side * 0.1, 0), material=cloth_mat or flesh_mat)
        parts.append(forearm)
        
        hand = add_sphere(f"{prefix}_hand_{'l' if side < 0 else 'r'}", radius=0.045, scale=(0.8, 1.2, 0.5), location=(sx + side * 0.14, 0.07, height * 0.38), material=flesh_mat)
        parts.append(hand)

    # Legs
    for side in (-1, 1):
        lx = side * (hip_w * 0.32)
        thigh = add_cone(f"{prefix}_thigh_{'l' if side < 0 else 'r'}", radius1=0.09, radius2=0.07, depth=height * 0.25,
                         location=(lx, 0, height * 0.35), material=cloth_mat or flesh_mat)
        parts.append(thigh)
        
        shin = add_cone(f"{prefix}_shin_{'l' if side < 0 else 'r'}", radius1=0.07, radius2=0.055, depth=height * 0.25,
                        location=(lx, 0, height * 0.14), material=cloth_mat or flesh_mat)
        parts.append(shin)
        
        foot = add_cube(f"{prefix}_foot_{'l' if side < 0 else 'r'}", size=1.0, scale=(0.08, 0.18, 0.06), location=(lx, 0.04, 0.03), material=cloth_mat or flesh_mat)
        parts.append(foot)
        
    return parts

def create_hood_and_cloak(prefix, height=1.75, cloak_mat=None, trim_mat=None):
    """Creates a gothic hooded cowl and draping tattered cloak."""
    parts = []
    # Hood peak & cowl
    hood_dome = add_sphere(f"{prefix}_hood_dome", radius=height * 0.13, scale=(0.95, 1.15, 1.1),
                           location=(0, -0.02, height * 0.93), material=cloak_mat)
    parts.append(hood_dome)
    
    hood_rim = add_torus(f"{prefix}_hood_rim", major_radius=height * 0.12, minor_radius=0.025,
                         location=(0, 0.06, height * 0.90), rotation=(math.radians(25), 0, 0), material=trim_mat or cloak_mat)
    parts.append(hood_rim)
    
    # Mantle around shoulders
    mantle = add_cone(f"{prefix}_mantle", radius1=height * 0.22, radius2=height * 0.12, depth=height * 0.18,
                      location=(0, 0, height * 0.75), material=cloak_mat)
    parts.append(mantle)
    
    # Flowing rear cloak
    cloak_back = add_cone(f"{prefix}_cloak_back", radius1=height * 0.32, radius2=height * 0.16, depth=height * 0.65,
                          location=(0, -0.10, height * 0.38), rotation=(math.radians(-10), 0, 0), material=cloak_mat)
    parts.append(cloak_back)
    
    return parts

def create_staff(name, height=1.9, pole_mat=None, head_mat=None, head_type='crystal'):
    """Creates an ornate staff (Fire, Glacial, Bone, Solar)."""
    parts = []
    shaft = add_cylinder(f"{name}_shaft", radius=0.025, depth=height, location=(0, 0, height * 0.5), material=pole_mat)
    parts.append(shaft)
    
    # Top socket/mounting
    socket = add_cone(f"{name}_socket", radius1=0.03, radius2=0.07, depth=0.12, location=(0, 0, height - 0.04), material=pole_mat)
    parts.append(socket)
    
    if head_type == 'fire':
        # Flaming cage and core
        cage = add_torus(f"{name}_flame_ring", major_radius=0.12, minor_radius=0.02, location=(0, 0, height + 0.10), material=pole_mat)
        core = add_icosphere(f"{name}_flame_core", radius=0.09, subdivisions=2, location=(0, 0, height + 0.10), material=head_mat)
        parts.extend([cage, core])
    elif head_type == 'crystal':
        # Faceted tall glacial crystal
        gem = add_cone(f"{name}_gem_top", radius1=0.07, radius2=0.01, depth=0.22, location=(0, 0, height + 0.15), material=head_mat, vertices=6)
        gem_b = add_cone(f"{name}_gem_bot", radius1=0.01, radius2=0.07, depth=0.10, location=(0, 0, height + 0.03), material=head_mat, vertices=6)
        parts.extend([gem, gem_b])
    elif head_type == 'bone':
        # Skull headpiece with ram horns
        skull = add_sphere(f"{name}_skull", radius=0.08, scale=(0.85, 1.1, 0.9), location=(0, 0, height + 0.08), material=head_mat)
        parts.append(skull)
        for s in (-1, 1):
            horn = add_torus(f"{name}_horn_{s}", major_radius=0.08, minor_radius=0.02,
                             location=(s * 0.08, 0, height + 0.12), rotation=(math.radians(45), math.radians(s * 60), 0), material=head_mat)
            parts.append(horn)
    elif head_type == 'solar':
        # Solar radiant disk / monstrance
        halo = add_torus(f"{name}_sun_halo", major_radius=0.16, minor_radius=0.02, location=(0, 0, height + 0.14), rotation=(math.radians(90), 0, 0), material=head_mat)
        center = add_sphere(f"{name}_sun_gem", radius=0.07, location=(0, 0, height + 0.14), material=head_mat)
        parts.extend([halo, center])
        
    return parts

def create_greatsword(name, length=1.6, blade_mat=None, hilt_mat=None, guard_mat=None):
    """Creates a massive gothic chivalric broadsword / greatsword."""
    parts = []
    # Pommel & Handle
    pommel = add_sphere(f"{name}_pommel", radius=0.045, location=(0, 0, 0.04), material=guard_mat or hilt_mat)
    handle = add_cylinder(f"{name}_handle", radius=0.022, depth=0.28, location=(0, 0, 0.20), material=hilt_mat)
    guard = add_cube(f"{name}_crossguard", size=1.0, scale=(0.36, 0.06, 0.04), location=(0, 0, 0.36), material=guard_mat)
    parts.extend([pommel, handle, guard])
    
    # Blade
    blade = add_cube(f"{name}_blade", size=1.0, scale=(0.11, 0.02, length - 0.50), location=(0, 0, 0.36 + (length - 0.50) * 0.5), material=blade_mat)
    tip = add_cone(f"{name}_tip", radius1=0.075, radius2=0.005, depth=0.16, location=(0, 0, length - 0.04), rotation=(0, 0, math.radians(45)), material=blade_mat, vertices=4)
    parts.extend([blade, tip])
    return parts

def create_bow(name, span=1.35, wood_mat=None, string_mat=None):
    """Creates a recurve hunting composite bow."""
    parts = []
    # Center riser
    riser = add_cylinder(f"{name}_riser", radius=0.025, depth=0.24, location=(0, 0, 0), material=wood_mat)
    parts.append(riser)
    
    # Upper & lower curved limbs
    for side, sign in [('up', 1), ('down', -1)]:
        limb1 = add_cylinder(f"{name}_limb_{side}_1", radius=0.020, depth=span * 0.35,
                             location=(0, sign * 0.06, sign * span * 0.22), rotation=(math.radians(sign * 25), 0, 0), material=wood_mat)
        limb2 = add_cylinder(f"{name}_limb_{side}_2", radius=0.015, depth=span * 0.22,
                             location=(0, sign * 0.16, sign * span * 0.44), rotation=(math.radians(sign * 55), 0, 0), material=wood_mat)
        parts.extend([limb1, limb2])
        
    # Bowstring
    bowstring = add_cylinder(f"{name}_string", radius=0.004, depth=span * 0.95, location=(0, -0.06, 0), material=string_mat or wood_mat)
    parts.append(bowstring)
    return parts

def create_bell(name, height=0.6, radius_base=0.35, bronze_mat=None, iron_mat=None):
    """Creates a heavy bronze cathedral bell with hanging loop and clapper."""
    parts = []
    # Hanging Crown & Loop
    crown_loop = add_torus(f"{name}_loop", major_radius=radius_base * 0.25, minor_radius=0.03, location=(0, 0, height + 0.05), rotation=(math.radians(90), 0, 0), material=iron_mat or bronze_mat)
    parts.append(crown_loop)
    
    # Bell Body Profile (stack of cylinders/cones)
    cap = add_sphere(f"{name}_cap", radius=radius_base * 0.65, scale=(1.0, 1.0, 0.7), location=(0, 0, height * 0.85), material=bronze_mat)
    body = add_cone(f"{name}_body", radius1=radius_base * 0.90, radius2=radius_base * 0.55, depth=height * 0.60, location=(0, 0, height * 0.48), material=bronze_mat)
    rim = add_torus(f"{name}_rim", major_radius=radius_base, minor_radius=0.045, location=(0, 0, height * 0.12), material=bronze_mat)
    parts.extend([cap, body, rim])
    
    # Clapper
    clapper_rod = add_cylinder(f"{name}_clapper_rod", radius=0.018, depth=height * 0.65, location=(0, 0, height * 0.40), material=iron_mat)
    clapper_ball = add_sphere(f"{name}_clapper_ball", radius=0.065, location=(0, 0, height * 0.08), material=iron_mat)
    parts.extend([clapper_rod, clapper_ball])
    return parts

def create_censer(name, chain_len=0.7, censer_mat=None, chain_mat=None):
    """Creates a hanging ornate thurible / incense burner."""
    parts = []
    # Chains
    for angle in (0, 120, 240):
        rad = math.radians(angle)
        chain = add_cylinder(f"{name}_chain_{angle}", radius=0.008, depth=chain_len,
                             location=(math.cos(rad) * 0.06, math.sin(rad) * 0.06, chain_len * 0.5), material=chain_mat or censer_mat)
        parts.append(chain)
        
    # Censer vessel & pierced lid
    bowl = add_sphere(f"{name}_bowl", radius=0.10, scale=(1.0, 1.0, 0.7), location=(0, 0, 0), material=censer_mat)
    lid = add_cone(f"{name}_lid", radius1=0.10, radius2=0.02, depth=0.14, location=(0, 0, 0.10), material=censer_mat)
    finial = add_sphere(f"{name}_finial", radius=0.025, location=(0, 0, 0.18), material=censer_mat)
    parts.extend([bowl, lid, finial])
    return parts

def finalize_model(parts, target_origin_at_bottom=True):
    """Applies transforms, positions the entire collection cleanly."""
    if not parts:
        return
    # Select all parts
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        if p and p.name in bpy.data.objects:
            p.select_set(True)
            bpy.context.view_layer.objects.active = p
            
    # Calculate global bounding box
    min_z = min(v[2] for p in parts for v in [p.matrix_world @ Vector(corner) for corner in p.bound_box])
    
    if target_origin_at_bottom and abs(min_z) > 0.001:
        # Shift all objects so lowest point touches Z=0
        for p in parts:
            p.location.z -= min_z
            
    # Apply location/rotation/scale cleanly
    for p in parts:
        p.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
