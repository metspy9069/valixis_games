"""
VALIXIS GAMES STUDIO - SOUL EMBER
Blender 4.5 Studio Lighting, Camera Framing & Multi-Format Exporter
"""

import bpy
import os
import math
from mathutils import Vector

def setup_studio_lighting():
    """Sets up a dramatic dark fantasy 3-point studio lighting rig."""
    # Key Light (Warm, high angle, front-right)
    key_data = bpy.data.lights.new(name="Studio_Key", type='SPOT')
    key_data.energy = 450.0
    key_data.spot_size = math.radians(65)
    key_data.spot_blend = 0.35
    key_data.color = (1.0, 0.92, 0.82)
    key_obj = bpy.data.objects.new("Studio_Key", key_data)
    key_obj.location = (2.5, -2.2, 3.2)
    key_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(48))
    bpy.context.collection.objects.link(key_obj)

    # Fill Light (Cool bluish, soft diffuse, front-left)
    fill_data = bpy.data.lights.new(name="Studio_Fill", type='POINT')
    fill_data.energy = 140.0
    fill_data.color = (0.55, 0.70, 0.95)
    fill_obj = bpy.data.objects.new("Studio_Fill", fill_data)
    fill_obj.location = (-2.8, -1.8, 2.0)
    bpy.context.collection.objects.link(fill_obj)

    # Rim / Kicker Light (Crisp backlight for rim silhouette pop)
    rim_data = bpy.data.lights.new(name="Studio_Rim", type='SPOT')
    rim_data.energy = 600.0
    rim_data.spot_size = math.radians(50)
    rim_data.spot_blend = 0.4
    rim_data.color = (0.85, 0.90, 1.0)
    rim_obj = bpy.data.objects.new("Studio_Rim", rim_data)
    rim_obj.location = (-1.5, 2.8, 2.8)
    rim_obj.rotation_euler = (math.radians(-42), math.radians(-15), math.radians(-150))
    bpy.context.collection.objects.link(rim_obj)

def frame_camera_and_render(model_parts, render_output_path, resolution=1080):
    """Calculates model bounding box and positions camera for beauty shot."""
    scene = bpy.context.scene
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    
    # Calculate global bounding box of all mesh objects
    mesh_objs = [p for p in model_parts if p.type == 'MESH']
    if not mesh_objs:
        return
        
    all_corners = []
    for obj in mesh_objs:
        for c in obj.bound_box:
            all_corners.append(obj.matrix_world @ Vector(c))
            
    min_x = min(v.x for v in all_corners)
    max_x = max(v.x for v in all_corners)
    min_y = min(v.y for v in all_corners)
    max_y = max(v.y for v in all_corners)
    min_z = min(v.z for v in all_corners)
    max_z = max(v.z for v in all_corners)
    
    center = Vector(((min_x + max_x) * 0.5, (min_y + max_y) * 0.5, (min_z + max_z) * 0.5))
    height = max(0.1, max_z - min_z)
    width = max(0.1, max_x - min_x, max_y - min_y)
    diagonal = max(height, width * 1.2)
    
    # Position camera
    cam_dist = diagonal * 2.3
    cam_data = bpy.data.cameras.new("Beauty_Cam")
    cam_data.lens = 65  # portrait focal length
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("Beauty_Cam", cam_data)
    
    # Isometric-style 3/4 beauty angle
    angle_azimuth = math.radians(-32)  # front-right look
    angle_elevation = math.radians(18)  # slightly above
    
    cx = center.x + cam_dist * math.sin(angle_azimuth) * math.cos(angle_elevation)
    cy = center.y - cam_dist * math.cos(angle_azimuth) * math.cos(angle_elevation)
    cz = center.z + cam_dist * math.sin(angle_elevation) + height * 0.15
    
    cam_obj.location = (cx, cy, cz)
    
    # Point camera at center
    direction = center - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Render still
    scene.render.filepath = render_output_path
    bpy.ops.render.render(write_still=True)
    return cam_obj

def export_all_formats(target_dir, base_name, model_parts):
    """
    Exports:
    1. <base_name>.blend (native Blender scene)
    2. <base_name>.glb   (glTF 2.0 binary, embedded PBR)
    3. <base_name>.fbx   (universal 3D engine interchange)
    4. <base_name>_render.png (beauty render)
    """
    os.makedirs(target_dir, exist_ok=True)
    
    blend_path = os.path.join(target_dir, f"{base_name}.blend")
    glb_path = os.path.join(target_dir, f"{base_name}.glb")
    fbx_path = os.path.join(target_dir, f"{base_name}.fbx")
    render_path = os.path.join(target_dir, f"{base_name}_render.png")
    
    # 1. Setup Studio Lights and Render Still
    setup_studio_lighting()
    frame_camera_and_render(model_parts, render_path)
    
    # 2. Export GLB (glTF 2.0 Binary)
    # Select only the model mesh parts for clean export
    bpy.ops.object.select_all(action='DESELECT')
    for p in model_parts:
        if p and p.name in bpy.data.objects:
            p.select_set(True)
    
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    
    # 3. Export FBX
    bpy.ops.export_scene.fbx(
        filepath=fbx_path,
        use_selection=True,
        apply_unit_scale=True,
        bake_space_transform=True
    )
    
    # 4. Save native .blend file
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    return {
        'blend': blend_path,
        'glb': glb_path,
        'fbx': fbx_path,
        'render': render_path
    }
