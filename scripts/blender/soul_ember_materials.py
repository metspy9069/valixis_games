"""
VALIXIS GAMES STUDIO - SOUL EMBER
Blender 4.5 Procedural Dark Fantasy PBR Shader Library
Zero external texture dependencies; fully packed and game-engine export ready.
"""

import bpy

def set_socket(node, socket_name, value):
    """Safely set a socket value on a shader node."""
    if socket_name in node.inputs:
        node.inputs[socket_name].default_value = value

def create_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0),
                        metallic=0.0, roughness=0.5,
                        emission_color=(0.0, 0.0, 0.0, 1.0), emission_strength=0.0,
                        transmission=0.0, ior=1.45,
                        subsurface=0.0, alpha=1.0, blend_method='OPAQUE'):
    """Create a Principled BSDF PBR material."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    
    output = tree.nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (300, 0)
    
    bsdf = tree.nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    set_socket(bsdf, 'Base Color', base_color)
    set_socket(bsdf, 'Metallic', metallic)
    set_socket(bsdf, 'Roughness', roughness)
    set_socket(bsdf, 'Emission Color', emission_color)
    set_socket(bsdf, 'Emission Strength', emission_strength)
    set_socket(bsdf, 'Transmission Weight', transmission)
    set_socket(bsdf, 'IOR', ior)
    set_socket(bsdf, 'Subsurface Weight', subsurface)
    set_socket(bsdf, 'Alpha', alpha)
    
    if alpha < 1.0 or transmission > 0.0:
        mat.blend_method = blend_method if hasattr(mat, 'blend_method') else 'BLEND'
    
    return mat

class MaterialLibrary:
    """Central repository for all Soul Ember dark fantasy materials."""

    DEFINITIONS = {
        # --- METALS ---
        'metal_steel': ('SE_Steel_Worn', lambda: create_pbr_material('SE_Steel_Worn', base_color=(0.35, 0.37, 0.40, 1.0), metallic=0.92, roughness=0.32)),
        'metal_iron_dark': ('SE_Iron_Dark', lambda: create_pbr_material('SE_Iron_Dark', base_color=(0.18, 0.18, 0.20, 1.0), metallic=0.90, roughness=0.45)),
        'metal_iron_rusted': ('SE_Iron_Rusted', lambda: create_pbr_material('SE_Iron_Rusted', base_color=(0.28, 0.18, 0.14, 1.0), metallic=0.75, roughness=0.78)),
        'metal_bronze_antique': ('SE_Bronze_Antique', lambda: create_pbr_material('SE_Bronze_Antique', base_color=(0.42, 0.32, 0.18, 1.0), metallic=0.88, roughness=0.38)),
        'metal_bronze_verdigris': ('SE_Bronze_Verdigris', lambda: create_pbr_material('SE_Bronze_Verdigris', base_color=(0.25, 0.38, 0.32, 1.0), metallic=0.78, roughness=0.55)),
        'metal_gold_ancient': ('SE_Gold_Ancient', lambda: create_pbr_material('SE_Gold_Ancient', base_color=(0.82, 0.62, 0.18, 1.0), metallic=0.98, roughness=0.28)),
        'metal_gold_filigree': ('SE_Gold_Filigree', lambda: create_pbr_material('SE_Gold_Filigree', base_color=(0.95, 0.75, 0.22, 1.0), metallic=1.0, roughness=0.20)),

        # --- CLOTH, LEATHER, WOOD ---
        'cloth_crimson': ('SE_Cloth_Crimson', lambda: create_pbr_material('SE_Cloth_Crimson', base_color=(0.45, 0.08, 0.06, 1.0), metallic=0.0, roughness=0.85)),
        'cloth_scarlet_tattered': ('SE_Cloth_Scarlet', lambda: create_pbr_material('SE_Cloth_Scarlet', base_color=(0.60, 0.14, 0.08, 1.0), metallic=0.0, roughness=0.90)),
        'cloth_forest_green': ('SE_Cloth_ForestGreen', lambda: create_pbr_material('SE_Cloth_ForestGreen', base_color=(0.12, 0.26, 0.14, 1.0), metallic=0.0, roughness=0.85)),
        'cloth_midnight_hood': ('SE_Cloth_Midnight', lambda: create_pbr_material('SE_Cloth_Midnight', base_color=(0.06, 0.06, 0.08, 1.0), metallic=0.0, roughness=0.88)),
        'cloth_offwhite_habit': ('SE_Cloth_Offwhite', lambda: create_pbr_material('SE_Cloth_Offwhite', base_color=(0.72, 0.68, 0.60, 1.0), metallic=0.0, roughness=0.80)),
        'cloth_cerulean_frost': ('SE_Cloth_FrostCerulean', lambda: create_pbr_material('SE_Cloth_FrostCerulean', base_color=(0.20, 0.35, 0.55, 1.0), metallic=0.05, roughness=0.75)),
        'cloth_regal_violet': ('SE_Cloth_RegalViolet', lambda: create_pbr_material('SE_Cloth_RegalViolet', base_color=(0.22, 0.08, 0.35, 1.0), metallic=0.05, roughness=0.80)),
        'leather_brown_worn': ('SE_Leather_Brown', lambda: create_pbr_material('SE_Leather_Brown', base_color=(0.25, 0.15, 0.10, 1.0), metallic=0.0, roughness=0.45)),
        'leather_black': ('SE_Leather_Black', lambda: create_pbr_material('SE_Leather_Black', base_color=(0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.40)),
        'wood_ancient_oak': ('SE_Wood_DarkOak', lambda: create_pbr_material('SE_Wood_DarkOak', base_color=(0.18, 0.12, 0.08, 1.0), metallic=0.0, roughness=0.75)),
        'wood_scorched': ('SE_Wood_Scorched', lambda: create_pbr_material('SE_Wood_Scorched', base_color=(0.07, 0.06, 0.05, 1.0), metallic=0.0, roughness=0.82)),
        'fur_grey_wolf': ('SE_Fur_GreyWolf', lambda: create_pbr_material('SE_Fur_GreyWolf', base_color=(0.32, 0.30, 0.28, 1.0), metallic=0.0, roughness=0.95)),

        # --- ORGANIC, BONE, STONE ---
        'bone_aged_ivory': ('SE_Bone_AgedIvory', lambda: create_pbr_material('SE_Bone_AgedIvory', base_color=(0.80, 0.76, 0.64, 1.0), metallic=0.0, roughness=0.48, subsurface=0.15)),
        'flesh_necrotic': ('SE_Flesh_Necrotic', lambda: create_pbr_material('SE_Flesh_Necrotic', base_color=(0.36, 0.40, 0.34, 1.0), metallic=0.0, roughness=0.60, subsurface=0.20)),
        'flesh_bloody_viscera': ('SE_Flesh_Viscera', lambda: create_pbr_material('SE_Flesh_Viscera', base_color=(0.42, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.22)),
        'flesh_toad_warty': ('SE_Flesh_ToadWarty', lambda: create_pbr_material('SE_Flesh_ToadWarty', base_color=(0.28, 0.36, 0.18, 1.0), metallic=0.0, roughness=0.35)),
        'chitin_spider_black': ('SE_Chitin_BlackSpider', lambda: create_pbr_material('SE_Chitin_BlackSpider', base_color=(0.10, 0.08, 0.09, 1.0), metallic=0.1, roughness=0.25)),
        'stone_gargoyle': ('SE_Stone_Gargoyle', lambda: create_pbr_material('SE_Stone_Gargoyle', base_color=(0.35, 0.35, 0.35, 1.0), metallic=0.0, roughness=0.88)),
        'stone_mossy_boulder': ('SE_Stone_Mossy', lambda: create_pbr_material('SE_Stone_Mossy', base_color=(0.24, 0.30, 0.20, 1.0), metallic=0.0, roughness=0.85)),
        'feathers_scavenger': ('SE_Feathers_Scavenger', lambda: create_pbr_material('SE_Feathers_Scavenger', base_color=(0.15, 0.14, 0.16, 1.0), metallic=0.05, roughness=0.75)),

        # --- CRYSTAL, GLASS, TRANSLUCENT ---
        'crystal_glacial_ice': ('SE_Crystal_Glacial', lambda: create_pbr_material('SE_Crystal_Glacial', base_color=(0.45, 0.75, 0.95, 1.0), metallic=0.0, roughness=0.12, transmission=0.85, ior=1.31, emission_color=(0.2, 0.5, 0.8, 1.0), emission_strength=1.5)),
        'crystal_soul_ember': ('SE_Crystal_SoulEmber', lambda: create_pbr_material('SE_Crystal_SoulEmber', base_color=(0.55, 0.80, 1.0, 1.0), metallic=0.0, roughness=0.08, transmission=0.90, ior=1.52, emission_color=(0.4, 0.75, 1.0, 1.0), emission_strength=3.5)),
        'glass_potion_vial': ('SE_Glass_Vial', lambda: create_pbr_material('SE_Glass_Vial', base_color=(0.95, 0.95, 0.95, 1.0), metallic=0.0, roughness=0.04, transmission=0.95, ior=1.49)),
        'liquid_crimson_elixir': ('SE_Liquid_CrimsonElixir', lambda: create_pbr_material('SE_Liquid_CrimsonElixir', base_color=(0.85, 0.06, 0.12, 1.0), metallic=0.0, roughness=0.10, transmission=0.60, emission_color=(0.9, 0.1, 0.15, 1.0), emission_strength=2.2)),
        'spectral_ghost_cyan': ('SE_Spectral_Ghost', lambda: create_pbr_material('SE_Spectral_Ghost', base_color=(0.20, 0.65, 0.75, 0.7), metallic=0.0, roughness=0.30, alpha=0.72, emission_color=(0.2, 0.7, 0.8, 1.0), emission_strength=2.5)),

        # --- EMISSIVES & LIGHTS ---
        'emission_fire_core': ('SE_Emission_Fire', lambda: create_pbr_material('SE_Emission_Fire', base_color=(1.0, 0.45, 0.05, 1.0), emission_color=(1.0, 0.45, 0.05, 1.0), emission_strength=5.5)),
        'emission_molten_lava': ('SE_Emission_Lava', lambda: create_pbr_material('SE_Emission_Lava', base_color=(1.0, 0.25, 0.02, 1.0), emission_color=(1.0, 0.22, 0.02, 1.0), emission_strength=4.5)),
        'emission_soul_lantern': ('SE_Emission_SoulLight', lambda: create_pbr_material('SE_Emission_SoulLight', base_color=(0.30, 0.85, 1.0, 1.0), emission_color=(0.30, 0.85, 1.0, 1.0), emission_strength=5.0)),
        'emission_solar_halo': ('SE_Emission_SolarHalo', lambda: create_pbr_material('SE_Emission_SolarHalo', base_color=(1.0, 0.82, 0.20, 1.0), emission_color=(1.0, 0.82, 0.20, 1.0), emission_strength=6.0)),
        'emission_void_eye': ('SE_Emission_VoidEye', lambda: create_pbr_material('SE_Emission_VoidEye', base_color=(0.85, 0.15, 0.95, 1.0), emission_color=(0.85, 0.15, 0.95, 1.0), emission_strength=4.0))
    }

    @classmethod
    def get(cls, key):
        if key not in cls.DEFINITIONS:
            raise KeyError(f"Unknown material key: {key}")
        mat_name, maker = cls.DEFINITIONS[key]
        mat = bpy.data.materials.get(mat_name)
        if mat is not None:
            return mat
        return maker()
