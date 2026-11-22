import struct
import json
import os

os.makedirs('scripts/extracted_lambo_textures', exist_ok=True)

with open('road-riot/assets/player-lamborghini.glb', 'rb') as f:
    magic, ver, length = struct.unpack('<III', f.read(12))
    chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
    gltf_json = json.loads(f.read(chunk0_len).decode('utf-8'))
    chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
    bin_data = f.read(chunk1_len)

buffer_views = gltf_json.get('bufferViews', [])
for i, img in enumerate(gltf_json.get('images', [])):
    bv_idx = img['bufferView']
    bv = buffer_views[bv_idx]
    offset = bv.get('byteOffset', 0)
    byte_len = bv['byteLength']
    img_data = bin_data[offset:offset+byte_len]
    out_name = f"scripts/extracted_lambo_textures/lambo_tex_{i}.png"
    with open(out_name, 'wb') as out_f:
        out_f.write(img_data)
    print(f"Lambo Tex {i}: {out_name} ({len(img_data)} bytes)")
