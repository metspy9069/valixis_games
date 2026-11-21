import bpy
import math
import os

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5, emissive_color=None, emissive_strength=0.0, transparent=False, opacity=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0) if len(base_color) == 3 else base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emissive_color:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emissive_color, 1.0) if len(emissive_color) == 3 else emissive_color
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emissive_color, 1.0) if len(emissive_color) == 3 else emissive_color
        if transparent:
            if "Transmission Weight" in bsdf.inputs:
                bsdf.inputs["Transmission Weight"].default_value = 1.0 - opacity
            elif "Transmission" in bsdf.inputs:
                bsdf.inputs["Transmission"].default_value = 1.0 - opacity
    return mat

def add_box(name, size, location, rotation=(0, 0, 0), material=None, bevel=0.0):
    # size = (width_X, length_Y, height_Z)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        bev = obj.modifiers.new(name="Bevel", type='BEVEL')
        bev.width = bevel
        bev.segments = 2
    if material:
        obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj

def add_cylinder(name, radius, depth, location, rotation=(0, 0, 0), vertices=24, material=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=location, rotation=rotation, vertices=vertices)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj

def add_wheel(prefix, x, y, z, radius=0.38, width=0.30, tire_mat=None, rim_mat=None, rotor_mat=None, caliper_mat=None):
    # In Blender: cylinder default depth is along Z.
    # To rotate so wheel rolls forward along Y, rotate around Y by 90° (axis along X)
    rot = (0, math.pi / 2, 0)
    # Tire
    add_cylinder(f"{prefix}_Tire", radius, width, (x, y, z), rotation=rot, vertices=28, material=tire_mat)
    # Rim outer lip
    add_cylinder(f"{prefix}_Wheel_Rim", radius * 0.74, width * 1.02, (x, y, z), rotation=rot, vertices=24, material=rim_mat)
    # Brake Rotor
    add_cylinder(f"{prefix}_Rotor", radius * 0.52, width * 0.45, (x, y, z), rotation=rot, vertices=20, material=rotor_mat)
    # Brake Caliper
    caliper_offset_y = radius * 0.35
    caliper_x = x - (0.04 if x > 0 else -0.04)
    add_box(f"{prefix}_Caliper", (0.08, 0.22, 0.12), (caliper_x, y + caliper_offset_y, z + radius * 0.28), material=caliper_mat)

def export_glb(filepath):
    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    print(f"Exported: {filepath} ({os.path.getsize(filepath):,} bytes)")

# ==============================================================================
# CAR 1: VENOM DRIFT-R (GT3 / Widebody Racing Supercar)
# ==============================================================================
def build_venom(out_path):
    clean_scene()
    
    body_mat = create_pbr_material("Chassis_Body", (0.61, 0.31, 0.87), metallic=0.9, roughness=0.15)
    glass_mat = create_pbr_material("Window_Glass", (0.04, 0.08, 0.14), metallic=0.95, roughness=0.05, transparent=True, opacity=0.3)
    carbon_mat = create_pbr_material("Carbon_Aero", (0.08, 0.09, 0.11), metallic=0.5, roughness=0.35)
    tire_mat = create_pbr_material("Tyre_Rubber", (0.07, 0.08, 0.09), metallic=0.05, roughness=0.85)
    rim_mat = create_pbr_material("Wheel_Rim", (0.92, 0.94, 0.96), metallic=0.98, roughness=0.1)
    rotor_mat = create_pbr_material("Brake_Rotor", (0.45, 0.48, 0.52), metallic=0.92, roughness=0.32)
    caliper_mat = create_pbr_material("Brake_Caliper", (0.9, 0.08, 0.15), metallic=0.7, roughness=0.2)
    headlight_mat = create_pbr_material("Light_Head", (0.85, 0.95, 1.0), emissive_color=(0.0, 0.85, 1.0), emissive_strength=4.0)
    taillight_mat = create_pbr_material("Light_Tail", (1.0, 0.1, 0.2), emissive_color=(1.0, 0.05, 0.15), emissive_strength=4.5)
    chrome_mat = create_pbr_material("Chrome_Exhaust", (0.95, 0.95, 0.98), metallic=0.98, roughness=0.08)

    # 1. Main Lower Chassis (width_X, length_Y, height_Z), loc=(X, Y, Z)
    add_box("Chassis_Lower", (2.05, 4.4, 0.36), (0, 0, 0.38), material=body_mat, bevel=0.06)

    # 2. Front Hood & Nose (-Y is front)
    add_box("Chassis_Hood", (1.85, 1.6, 0.24), (0, -1.25, 0.52), rotation=(-0.08, 0, 0), material=body_mat, bevel=0.05)
    # Hood Extractor Vents
    add_box("Carbon_HoodVent_L", (0.35, 0.6, 0.04), (-0.45, -1.1, 0.62), rotation=(-0.08, 0, 0), material=carbon_mat)
    add_box("Carbon_HoodVent_R", (0.35, 0.6, 0.04), (0.45, -1.1, 0.62), rotation=(-0.08, 0, 0), material=carbon_mat)

    # 3. Flared Widebody Fenders
    # Front Fenders
    add_box("Fender_FL", (0.32, 1.0, 0.48), (-1.02, -1.35, 0.44), material=body_mat, bevel=0.04)
    add_box("Fender_FR", (0.32, 1.0, 0.48), (1.02, -1.35, 0.44), material=body_mat, bevel=0.04)
    # Rear Wide Haunches
    add_box("Fender_RL", (0.36, 1.1, 0.52), (-1.04, 1.25, 0.48), material=body_mat, bevel=0.04)
    add_box("Fender_RR", (0.36, 1.1, 0.52), (1.04, 1.25, 0.48), material=body_mat, bevel=0.04)

    # 4. Aerodynamic Cockpit & Roof Canopy
    add_box("Chassis_Cabin", (1.45, 1.85, 0.45), (0, 0.05, 0.88), rotation=(0.05, 0, 0), material=body_mat, bevel=0.06)
    # Windshield (slanted down to -Y)
    add_box("Window_Windshield", (1.42, 0.85, 0.42), (0, -0.65, 0.85), rotation=(-0.42, 0, 0), material=glass_mat)
    # Side Windows
    add_box("Window_Side_L", (0.05, 1.1, 0.35), (-0.72, 0.05, 0.88), material=glass_mat)
    add_box("Window_Side_R", (0.05, 1.1, 0.35), (0.72, 0.05, 0.88), material=glass_mat)
    # Rear Window (slanted down to +Y)
    add_box("Window_Rear", (1.32, 0.9, 0.38), (0, 0.82, 0.82), rotation=(0.35, 0, 0), material=glass_mat)

    # 5. Carbon Fiber Aero Kit
    # Front Splitter Lip (-Y)
    add_box("Carbon_FrontSplitter", (2.12, 0.65, 0.06), (0, -2.25, 0.18), material=carbon_mat, bevel=0.02)
    # Side Skirts
    add_box("Carbon_SideSkirt_L", (0.16, 2.5, 0.08), (-1.08, 0, 0.18), material=carbon_mat)
    add_box("Carbon_SideSkirt_R", (0.16, 2.5, 0.08), (1.08, 0, 0.18), material=carbon_mat)
    # Rear Diffuser & Strakes (+Y)
    add_box("Carbon_RearDiffuser", (1.95, 0.6, 0.22), (0, 2.22, 0.26), rotation=(0.15, 0, 0), material=carbon_mat)
    for sx in [-0.6, -0.2, 0.2, 0.6]:
        add_box(f"Carbon_Strake_{sx}", (0.04, 0.55, 0.18), (sx, 2.22, 0.24), material=carbon_mat)

    # 6. High-Downforce GT3 Rear Wing
    # Pylons / Uprights
    add_box("Carbon_WingPylon_L", (0.05, 0.25, 0.48), (-0.52, 2.05, 0.95), rotation=(0.1, 0, 0), material=carbon_mat)
    add_box("Carbon_WingPylon_R", (0.05, 0.25, 0.48), (0.52, 2.05, 0.95), rotation=(0.1, 0, 0), material=carbon_mat)
    # Wing Blade
    add_box("Carbon_WingBlade", (1.95, 0.45, 0.06), (0, 2.1, 1.22), rotation=(-0.06, 0, 0), material=carbon_mat, bevel=0.015)
    # Endplates
    add_box("Carbon_Endplate_L", (0.03, 0.52, 0.28), (-0.98, 2.1, 1.22), material=carbon_mat)
    add_box("Carbon_Endplate_R", (0.03, 0.52, 0.28), (0.98, 2.1, 1.22), material=carbon_mat)

    # 7. Dual Polished Central Exhaust Tips (+Y)
    rot_exhaust = (math.pi / 2, 0, 0)
    add_cylinder("Chrome_Exhaust_L", 0.09, 0.35, (-0.16, 2.28, 0.34), rotation=rot_exhaust, material=chrome_mat)
    add_cylinder("Chrome_Exhaust_R", 0.09, 0.35, (0.16, 2.28, 0.34), rotation=rot_exhaust, material=chrome_mat)

    # 8. LED Lights
    # Headlights (-Y)
    add_box("Light_Head_L", (0.42, 0.25, 0.12), (-0.72, -2.12, 0.48), rotation=(-0.1, 0, 0.15), material=headlight_mat)
    add_box("Light_Head_R", (0.42, 0.25, 0.12), (0.72, -2.12, 0.48), rotation=(-0.1, 0, -0.15), material=headlight_mat)
    # Continuous Rear LED Light Blade (+Y)
    add_box("Light_Tail_Blade", (1.82, 0.08, 0.08), (0, 2.21, 0.62), material=taillight_mat)

    # 9. Wheels & Suspension
    wheel_z = 0.38
    add_wheel("FL", -1.02, -1.35, wheel_z, radius=0.38, width=0.32, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("FR", 1.02, -1.35, wheel_z, radius=0.38, width=0.32, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RL", -1.04, 1.25, wheel_z, radius=0.40, width=0.36, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RR", 1.04, 1.25, wheel_z, radius=0.40, width=0.36, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)

    export_glb(out_path)

# ==============================================================================
# CAR 2: PHANTOM GTS (Twin-Turbo V8 Luxury Sport Coupe)
# ==============================================================================
def build_phantom(out_path):
    clean_scene()
    
    body_mat = create_pbr_material("Chassis_Body", (0.95, 0.72, 0.05), metallic=0.92, roughness=0.18)
    glass_mat = create_pbr_material("Window_Glass", (0.02, 0.05, 0.1), metallic=0.95, roughness=0.04, transparent=True, opacity=0.35)
    carbon_mat = create_pbr_material("Carbon_Aero", (0.1, 0.11, 0.13), metallic=0.6, roughness=0.3)
    tire_mat = create_pbr_material("Tyre_Rubber", (0.08, 0.08, 0.09), metallic=0.05, roughness=0.86)
    rim_mat = create_pbr_material("Wheel_Rim", (0.2, 0.22, 0.25), metallic=0.95, roughness=0.15)
    rotor_mat = create_pbr_material("Brake_Rotor", (0.5, 0.52, 0.55), metallic=0.95, roughness=0.3)
    caliper_mat = create_pbr_material("Brake_Caliper", (0.95, 0.7, 0.05), metallic=0.8, roughness=0.2)
    headlight_mat = create_pbr_material("Light_Head", (0.95, 0.98, 1.0), emissive_color=(0.85, 0.95, 1.0), emissive_strength=4.5)
    taillight_mat = create_pbr_material("Light_Tail", (1.0, 0.05, 0.1), emissive_color=(1.0, 0.02, 0.08), emissive_strength=4.5)
    chrome_mat = create_pbr_material("Chrome_Trim", (0.95, 0.96, 0.98), metallic=0.99, roughness=0.05)

    # 1. Muscular Grand Tourer Lower Chassis
    add_box("Chassis_Lower", (2.02, 4.6, 0.42), (0, 0, 0.42), material=body_mat, bevel=0.08)

    # 2. Elongated Muscular Hood with Power Bulge (-Y)
    add_box("Chassis_Hood", (1.82, 1.85, 0.28), (0, -1.3, 0.58), rotation=(-0.06, 0, 0), material=body_mat, bevel=0.06)
    # Hood Center Power Dome
    add_box("Chassis_PowerDome", (0.65, 1.4, 0.08), (0, -1.2, 0.72), rotation=(-0.06, 0, 0), material=body_mat, bevel=0.03)

    # 3. Bold Front Fascia & Chrome Hex Grille (-Y)
    add_box("Grille_Frame", (1.1, 0.15, 0.38), (0, -2.31, 0.42), material=chrome_mat, bevel=0.03)
    add_box("Grille_Mesh", (1.02, 0.12, 0.32), (0, -2.31, 0.42), material=carbon_mat)
    # Lower Chin Air Dam
    add_box("Carbon_ChinSplitter", (1.98, 0.45, 0.08), (0, -2.32, 0.20), material=carbon_mat, bevel=0.02)

    # 4. Sculpted Fastback Cabin & Glass
    add_box("Chassis_Cabin", (1.52, 2.1, 0.50), (0, 0.15, 0.96), rotation=(0.04, 0, 0), material=body_mat, bevel=0.08)
    # Sweeping Windshield
    add_box("Window_Windshield", (1.48, 0.95, 0.46), (0, -0.68, 0.92), rotation=(-0.46, 0, 0), material=glass_mat)
    # Side Windows
    add_box("Window_Side_L", (0.05, 1.25, 0.38), (-0.76, 0.15, 0.96), material=glass_mat)
    add_box("Window_Side_R", (0.05, 1.25, 0.38), (0.76, 0.15, 0.96), material=glass_mat)
    # Fastback Rear Window
    add_box("Window_Rear", (1.38, 1.15, 0.42), (0, 0.95, 0.90), rotation=(0.38, 0, 0), material=glass_mat)

    # 5. Integrated Ducktail Rear Lip Spoiler & Bumper (+Y)
    add_box("Chassis_Ducktail", (1.75, 0.4, 0.12), (0, 2.22, 0.82), rotation=(-0.18, 0, 0), material=body_mat, bevel=0.03)
    add_box("Carbon_RearDiffuser", (1.85, 0.5, 0.25), (0, 2.3, 0.28), rotation=(0.1, 0, 0), material=carbon_mat)

    # 6. Quad Oval Chrome Exhausts (+Y)
    rot_exhaust = (math.pi / 2, 0, 0)
    for x_side in [-1, 1]:
        add_cylinder(f"Chrome_Exhaust_{x_side}_1", 0.07, 0.32, (x_side * 0.65, 2.35, 0.32), rotation=rot_exhaust, material=chrome_mat)
        add_cylinder(f"Chrome_Exhaust_{x_side}_2", 0.07, 0.32, (x_side * 0.82, 2.35, 0.32), rotation=rot_exhaust, material=chrome_mat)

    # 7. Xenon Headlights (-Y) & OLED Taillights (+Y)
    add_box("Light_Head_L", (0.38, 0.2, 0.14), (-0.72, -2.25, 0.54), rotation=(-0.05, 0, 0.12), material=headlight_mat)
    add_box("Light_Head_R", (0.38, 0.2, 0.14), (0.72, -2.25, 0.54), rotation=(-0.05, 0, -0.12), material=headlight_mat)
    add_box("Light_Tail_L", (0.45, 0.15, 0.12), (-0.72, 2.31, 0.68), material=taillight_mat)
    add_box("Light_Tail_R", (0.45, 0.15, 0.12), (0.72, 2.31, 0.68), material=taillight_mat)

    # 8. Wheels
    wheel_z = 0.40
    add_wheel("FL", -1.01, -1.45, wheel_z, radius=0.39, width=0.31, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("FR", 1.01, -1.45, wheel_z, radius=0.39, width=0.31, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RL", -1.02, 1.35, wheel_z, radius=0.40, width=0.34, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RR", 1.02, 1.35, wheel_z, radius=0.40, width=0.34, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)

    export_glb(out_path)

# ==============================================================================
# CAR 3: SHADOW INTERCEPTOR (High-Tech Pursuit Supercar)
# ==============================================================================
def build_interceptor(out_path):
    clean_scene()
    
    body_mat = create_pbr_material("Chassis_Body", (0.05, 0.08, 0.12), metallic=0.92, roughness=0.18)
    accent_mat = create_pbr_material("Chassis_Accent", (0.88, 0.92, 0.96), metallic=0.7, roughness=0.25)
    glass_mat = create_pbr_material("Window_Glass", (0.01, 0.03, 0.06), metallic=0.98, roughness=0.02, transparent=True, opacity=0.2)
    carbon_mat = create_pbr_material("Carbon_Aero", (0.08, 0.09, 0.10), metallic=0.5, roughness=0.35)
    pushbar_mat = create_pbr_material("Steel_Pushbar", (0.12, 0.14, 0.16), metallic=0.85, roughness=0.4)
    tire_mat = create_pbr_material("Tyre_Rubber", (0.07, 0.07, 0.08), metallic=0.05, roughness=0.88)
    rim_mat = create_pbr_material("Wheel_Rim", (0.15, 0.17, 0.20), metallic=0.95, roughness=0.18)
    rotor_mat = create_pbr_material("Brake_Rotor", (0.48, 0.50, 0.54), metallic=0.95, roughness=0.3)
    caliper_mat = create_pbr_material("Brake_Caliper", (0.0, 0.75, 1.0), metallic=0.8, roughness=0.2)
    headlight_mat = create_pbr_material("Light_Head", (0.9, 0.96, 1.0), emissive_color=(0.85, 0.95, 1.0), emissive_strength=5.0)
    taillight_mat = create_pbr_material("Light_Tail", (1.0, 0.05, 0.15), emissive_color=(1.0, 0.02, 0.1), emissive_strength=5.0)
    siren_blue = create_pbr_material("Light_Siren_Blue", (0.0, 0.6, 1.0), emissive_color=(0.0, 0.85, 1.0), emissive_strength=8.0)
    siren_red = create_pbr_material("Light_Siren_Red", (1.0, 0.05, 0.1), emissive_color=(1.0, 0.05, 0.15), emissive_strength=8.0)

    # 1. Wedge Pursuit Chassis
    add_box("Chassis_Lower", (2.05, 4.5, 0.40), (0, 0, 0.40), material=body_mat, bevel=0.07)
    # Side Contrast Panels
    add_box("Chassis_DoorPanel_L", (0.04, 1.6, 0.32), (-1.03, 0, 0.44), material=accent_mat)
    add_box("Chassis_DoorPanel_R", (0.04, 1.6, 0.32), (1.03, 0, 0.44), material=accent_mat)

    # 2. Angular Wedge Hood (-Y)
    add_box("Chassis_Hood", (1.84, 1.7, 0.26), (0, -1.25, 0.54), rotation=(-0.09, 0, 0), material=body_mat, bevel=0.06)

    # 3. Tactical Push-Bar (Front Bull-Bar at -Y)
    add_box("Pushbar_Rail_Upper", (1.4, 0.08, 0.08), (0, -2.42, 0.52), material=pushbar_mat)
    add_box("Pushbar_Rail_Lower", (1.4, 0.08, 0.08), (0, -2.42, 0.28), material=pushbar_mat)
    add_box("Pushbar_Upright_L", (0.10, 0.22, 0.44), (-0.48, -2.38, 0.40), material=pushbar_mat, bevel=0.02)
    add_box("Pushbar_Upright_R", (0.10, 0.22, 0.44), (0.48, -2.38, 0.40), material=pushbar_mat, bevel=0.02)

    # 4. Stealth Pursuit Cabin & Glass
    add_box("Chassis_Cabin", (1.46, 1.9, 0.46), (0, 0.05, 0.90), rotation=(0.04, 0, 0), material=body_mat, bevel=0.07)
    # Windshield
    add_box("Window_Windshield", (1.42, 0.88, 0.44), (0, -0.65, 0.88), rotation=(-0.44, 0, 0), material=glass_mat)
    add_box("Window_Side_L", (0.05, 1.15, 0.36), (-0.73, 0.05, 0.90), material=glass_mat)
    add_box("Window_Side_R", (0.05, 1.15, 0.36), (0.73, 0.05, 0.90), material=glass_mat)
    add_box("Window_Rear", (1.34, 0.95, 0.40), (0, 0.85, 0.84), rotation=(0.36, 0, 0), material=glass_mat)

    # 5. Roof Emergency Lightbar
    add_box("Lightbar_Housing", (1.1, 0.24, 0.06), (0, 0.05, 1.16), material=carbon_mat)
    add_box("Siren_Red_L", (0.45, 0.18, 0.06), (-0.26, 0.05, 1.18), material=siren_red)
    add_box("Siren_Blue_R", (0.45, 0.18, 0.06), (0.26, 0.05, 1.18), material=siren_blue)

    # 6. Pursuit Rear Wing & Diffuser (+Y)
    add_box("Carbon_RearWing", (1.82, 0.4, 0.06), (0, 2.15, 1.05), rotation=(-0.05, 0, 0), material=carbon_mat, bevel=0.02)
    add_box("Carbon_WingUpright_L", (0.05, 0.22, 0.35), (-0.55, 2.12, 0.85), material=carbon_mat)
    add_box("Carbon_WingUpright_R", (0.05, 0.22, 0.35), (0.55, 2.12, 0.85), material=carbon_mat)
    add_box("Carbon_Diffuser", (1.92, 0.55, 0.24), (0, 2.25, 0.26), rotation=(0.12, 0, 0), material=carbon_mat)

    # 7. Headlights (-Y) & Pursuit Taillight Blade (+Y)
    add_box("Light_Head_L", (0.44, 0.24, 0.11), (-0.74, -2.15, 0.50), rotation=(-0.08, 0, 0.16), material=headlight_mat)
    add_box("Light_Head_R", (0.44, 0.24, 0.11), (0.74, -2.15, 0.50), rotation=(-0.08, 0, -0.16), material=headlight_mat)
    add_box("Light_Tail_Blade", (1.84, 0.08, 0.09), (0, 2.26, 0.65), material=taillight_mat)

    # 8. Wheels
    wheel_z = 0.39
    add_wheel("FL", -1.02, -1.38, wheel_z, radius=0.39, width=0.32, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("FR", 1.02, -1.38, wheel_z, radius=0.39, width=0.32, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RL", -1.03, 1.30, wheel_z, radius=0.40, width=0.35, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RR", 1.03, 1.30, wheel_z, radius=0.40, width=0.35, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)

    export_glb(out_path)

# ==============================================================================
# CAR 4: TITAN JUGGERNAUT (Armored Tactical Rally Beast / Super-SUV)
# ==============================================================================
def build_titan(out_path):
    clean_scene()
    
    body_mat = create_pbr_material("Chassis_Body", (0.14, 0.20, 0.26), metallic=0.85, roughness=0.35)
    armor_mat = create_pbr_material("Chassis_ArmorPlate", (0.08, 0.10, 0.13), metallic=0.7, roughness=0.6)
    glass_mat = create_pbr_material("Window_Glass", (0.02, 0.04, 0.07), metallic=0.98, roughness=0.05, transparent=True, opacity=0.4)
    steel_mat = create_pbr_material("Steel_Guard", (0.15, 0.16, 0.18), metallic=0.9, roughness=0.35)
    tire_mat = create_pbr_material("Tyre_Rubber", (0.08, 0.08, 0.09), metallic=0.05, roughness=0.92)
    rim_mat = create_pbr_material("Wheel_Rim", (0.22, 0.25, 0.28), metallic=0.85, roughness=0.3)
    rotor_mat = create_pbr_material("Brake_Rotor", (0.50, 0.52, 0.55), metallic=0.92, roughness=0.35)
    caliper_mat = create_pbr_material("Brake_Caliper", (0.0, 0.9, 0.4), metallic=0.7, roughness=0.25)
    headlight_mat = create_pbr_material("Light_Head", (1.0, 0.98, 0.9), emissive_color=(1.0, 0.95, 0.85), emissive_strength=5.5)
    taillight_mat = create_pbr_material("Light_Tail", (1.0, 0.05, 0.1), emissive_color=(1.0, 0.02, 0.08), emissive_strength=4.5)
    floodlight_mat = create_pbr_material("Light_Flood", (1.0, 0.95, 0.8), emissive_color=(1.0, 0.9, 0.6), emissive_strength=6.0)

    # 1. Lifted Heavy-Duty Armored Lower Hull (High Ground Clearance)
    add_box("Chassis_Lower", (2.20, 4.8, 0.65), (0, 0, 0.68), material=body_mat, bevel=0.09)
    # Lower Skid Plate (-Y)
    add_box("SkidPlate_Front", (1.4, 0.9, 0.08), (0, -2.1, 0.32), rotation=(-0.35, 0, 0), material=steel_mat)

    # 2. High Muscular Hood & Squared Fenders (-Y)
    add_box("Chassis_Hood", (2.05, 1.8, 0.35), (0, -1.35, 1.08), rotation=(-0.04, 0, 0), material=body_mat, bevel=0.08)
    # Bolted Fender Flares
    add_box("Fender_FL", (0.35, 1.15, 0.55), (-1.15, -1.45, 0.76), material=armor_mat, bevel=0.04)
    add_box("Fender_FR", (0.35, 1.15, 0.55), (1.15, -1.45, 0.76), material=armor_mat, bevel=0.04)
    add_box("Fender_RL", (0.35, 1.15, 0.55), (-1.15, 1.45, 0.76), material=armor_mat, bevel=0.04)
    add_box("Fender_RR", (0.35, 1.15, 0.55), (1.15, 1.45, 0.76), material=armor_mat, bevel=0.04)

    # 3. Massive Front Brush Guard (-Y)
    add_box("BrushGuard_Main", (1.85, 0.12, 0.55), (0, -2.55, 0.75), material=steel_mat, bevel=0.03)
    add_box("BrushGuard_Crossbar", (1.75, 0.10, 0.10), (0, -2.52, 0.95), material=steel_mat)
    add_box("BrushGuard_Lower", (1.65, 0.10, 0.10), (0, -2.52, 0.45), material=steel_mat)

    # 4. Armored Tall SUV Cabin & Windows
    add_box("Chassis_Cabin", (1.82, 2.6, 0.65), (0, 0.25, 1.50), material=body_mat, bevel=0.08)
    # Windshield
    add_box("Window_Windshield", (1.74, 0.75, 0.58), (0, -0.85, 1.45), rotation=(-0.38, 0, 0), material=glass_mat)
    # Side Windows
    add_box("Window_Side_L", (0.05, 1.9, 0.48), (-0.92, 0.35, 1.52), material=glass_mat)
    add_box("Window_Side_R", (0.05, 1.9, 0.48), (0.92, 0.35, 1.52), material=glass_mat)
    # Rear Window
    add_box("Window_Rear", (1.65, 0.08, 0.52), (0, 1.56, 1.48), material=glass_mat)

    # 5. Roof Expedition Basket & 4 Floodlights
    add_box("Roof_Rack", (1.65, 2.1, 0.10), (0, 0.3, 1.88), material=steel_mat)
    rot_flood = (math.pi / 2, 0, 0)
    for fx in [-0.6, -0.2, 0.2, 0.6]:
        add_cylinder(f"FloodLight_Housing_{fx}", 0.14, 0.15, (fx, -0.7, 1.96), rotation=rot_flood, material=steel_mat)
        add_cylinder(f"FloodLight_Lens_{fx}", 0.12, 0.05, (fx, -0.78, 1.96), rotation=rot_flood, material=floodlight_mat)

    # 6. Rock Sliders (Side Steps)
    add_box("RockSlider_L", (0.16, 2.4, 0.08), (-1.18, 0, 0.42), material=steel_mat)
    add_box("RockSlider_R", (0.16, 2.4, 0.08), (1.18, 0, 0.42), material=steel_mat)

    # 7. Headlights (-Y) & Armored Taillights (+Y)
    add_box("Light_Head_L", (0.45, 0.18, 0.20), (-0.78, -2.42, 0.95), material=headlight_mat)
    add_box("Light_Head_R", (0.45, 0.18, 0.20), (0.78, -2.42, 0.95), material=headlight_mat)
    add_box("Light_Tail_L", (0.18, 0.12, 0.52), (-0.88, 2.42, 1.15), material=taillight_mat)
    add_box("Light_Tail_R", (0.18, 0.12, 0.52), (0.88, 2.42, 1.15), material=taillight_mat)

    # 8. All-Terrain Wheels
    wheel_z = 0.46
    add_wheel("FL", -1.14, -1.45, wheel_z, radius=0.46, width=0.40, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("FR", 1.14, -1.45, wheel_z, radius=0.46, width=0.40, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RL", -1.14, 1.45, wheel_z, radius=0.48, width=0.42, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)
    add_wheel("RR", 1.14, 1.45, wheel_z, radius=0.48, width=0.42, tire_mat=tire_mat, rim_mat=rim_mat, rotor_mat=rotor_mat, caliper_mat=caliper_mat)

    export_glb(out_path)

if __name__ == "__main__":
    assets_dir = os.path.abspath("road-riot/assets")
    build_venom(os.path.join(assets_dir, "venom.glb"))
    build_phantom(os.path.join(assets_dir, "phantom.glb"))
    build_interceptor(os.path.join(assets_dir, "interceptor.glb"))
    build_titan(os.path.join(assets_dir, "titan.glb"))
    print("ALL 4 SUPERCARS ACCURATELY BUILT AND EXPORTED!")
