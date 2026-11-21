import bpy
import math

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
        if emissive_color and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emissive_color, 1.0) if len(emissive_color) == 3 else emissive_color
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
        elif emissive_color and "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emissive_color, 1.0) if len(emissive_color) == 3 else emissive_color
        if transparent:
            if "Transmission Weight" in bsdf.inputs:
                bsdf.inputs["Transmission Weight"].default_value = 1.0 - opacity
            elif "Transmission" in bsdf.inputs:
                bsdf.inputs["Transmission"].default_value = 1.0 - opacity
    return mat

def add_box(name, size, location, material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
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

def add_cylinder(name, radius, depth, location, rotation=(0, 0, 0), material=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=location, rotation=rotation, vertices=24)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj

def add_wheel(parent_prefix, x, y, z, radius=0.38, width=0.32, rim_color=(0.9, 0.9, 0.95), tire_mat=None, rim_mat=None, brake_mat=None):
    # Tire
    rot = (0, math.pi / 2, 0)
    tire = add_cylinder(f"{parent_prefix}_Tire", radius, width, (x, y, z), rotation=rot, material=tire_mat)
    # Rim
    rim = add_cylinder(f"{parent_prefix}_Rim", radius * 0.72, width * 1.02, (x, y, z), rotation=rot, material=rim_mat)
    # Brake Rotor
    rotor = add_cylinder(f"{parent_prefix}_Rotor", radius * 0.52, width * 0.4, (x, y, z), rotation=rot, material=brake_mat)
    return [tire, rim, rotor]
