import struct
import json
import os

def repack_ferrari():
    src_glb = 'road-riot/assets/player-ferrari.glb'
    with open(src_glb, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        gltf_json = json.loads(f.read(chunk0_len).decode('utf-8'))
        chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
        orig_bin = f.read(chunk1_len)

    buffer_views = gltf_json['bufferViews']
    images = gltf_json.get('images', [])

    # Map image index to sanitized file if modified
    modified_images = {
        0: 'scripts/extracted_textures/tex_0.png',
        1: 'scripts/extracted_textures/tex_1.png',
        2: 'scripts/extracted_textures/tex_2.png',
        6: 'scripts/extracted_textures/tex_6.png',
        9: 'scripts/extracted_textures/tex_9.png',
        12: 'scripts/extracted_textures/tex_12.png',
    }

    # Map bufferView index to new bytes
    bv_new_bytes = {}
    for img_idx, file_path in modified_images.items():
        if os.path.exists(file_path):
            with open(file_path, 'rb') as fp:
                data = fp.read()
            bv_idx = images[img_idx]['bufferView']
            bv_new_bytes[bv_idx] = data

    new_bin = bytearray()
    for bv_idx, bv in enumerate(buffer_views):
        if bv_idx in bv_new_bytes:
            data = bv_new_bytes[bv_idx]
        else:
            orig_off = bv.get('byteOffset', 0)
            orig_len = bv['byteLength']
            data = orig_bin[orig_off:orig_off+orig_len]

        # 4-byte alignment
        aligned_offset = len(new_bin)
        if aligned_offset % 4 != 0:
            pad = 4 - (aligned_offset % 4)
            new_bin.extend(b'\x00' * pad)
            aligned_offset += pad

        bv['byteOffset'] = aligned_offset
        bv['byteLength'] = len(data)
        new_bin.extend(data)

    # Align total binary buffer to 4 bytes
    if len(new_bin) % 4 != 0:
        new_bin.extend(b'\x00' * (4 - (len(new_bin) % 4)))

    gltf_json['buffers'][0]['byteLength'] = len(new_bin)

    # Encode JSON chunk
    new_json_bytes = json.dumps(gltf_json, separators=(',', ':')).encode('utf-8')
    if len(new_json_bytes) % 4 != 0:
        new_json_bytes += b' ' * (4 - (len(new_json_bytes) % 4))

    out_len = 12 + 8 + len(new_json_bytes) + 8 + len(new_bin)
    out_glb = bytearray()
    out_glb.extend(struct.pack('<III', magic, ver, out_len))
    out_glb.extend(struct.pack('<II', len(new_json_bytes), 0x4E4F534A))
    out_glb.extend(new_json_bytes)
    out_glb.extend(struct.pack('<II', len(new_bin), 0x004E4942))
    out_glb.extend(new_bin)

    for target in ['road-riot/assets/player-ferrari.glb', 'road-riot/assets/player-apex.glb']:
        with open(target, 'wb') as fp:
            fp.write(out_glb)
        print(f"Repacked Ferrari -> {target} ({len(out_glb)} bytes)")

def repack_lamborghini():
    src_glb = 'road-riot/assets/player-lamborghini.glb'
    with open(src_glb, 'rb') as f:
        magic, ver, total_len = struct.unpack('<III', f.read(12))
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        gltf_json = json.loads(f.read(chunk0_len).decode('utf-8'))
        chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
        orig_bin = f.read(chunk1_len)

    buffer_views = gltf_json['bufferViews']
    images = gltf_json.get('images', [])

    modified_images = {
        10: 'scripts/extracted_lambo_textures/lambo_tex_10.png',
        13: 'scripts/extracted_lambo_textures/lambo_tex_13.png',
        14: 'scripts/extracted_lambo_textures/lambo_tex_14.png',
    }

    bv_new_bytes = {}
    for img_idx, file_path in modified_images.items():
        if os.path.exists(file_path):
            with open(file_path, 'rb') as fp:
                data = fp.read()
            bv_idx = images[img_idx]['bufferView']
            bv_new_bytes[bv_idx] = data

    new_bin = bytearray()
    for bv_idx, bv in enumerate(buffer_views):
        if bv_idx in bv_new_bytes:
            data = bv_new_bytes[bv_idx]
        else:
            orig_off = bv.get('byteOffset', 0)
            orig_len = bv['byteLength']
            data = orig_bin[orig_off:orig_off+orig_len]

        aligned_offset = len(new_bin)
        if aligned_offset % 4 != 0:
            pad = 4 - (aligned_offset % 4)
            new_bin.extend(b'\x00' * pad)
            aligned_offset += pad

        bv['byteOffset'] = aligned_offset
        bv['byteLength'] = len(data)
        new_bin.extend(data)

    if len(new_bin) % 4 != 0:
        new_bin.extend(b'\x00' * (4 - (len(new_bin) % 4)))

    gltf_json['buffers'][0]['byteLength'] = len(new_bin)

    new_json_bytes = json.dumps(gltf_json, separators=(',', ':')).encode('utf-8')
    if len(new_json_bytes) % 4 != 0:
        new_json_bytes += b' ' * (4 - (len(new_json_bytes) % 4))

    out_len = 12 + 8 + len(new_json_bytes) + 8 + len(new_bin)
    out_glb = bytearray()
    out_glb.extend(struct.pack('<III', magic, ver, out_len))
    out_glb.extend(struct.pack('<II', len(new_json_bytes), 0x4E4F534A))
    out_glb.extend(new_json_bytes)
    out_glb.extend(struct.pack('<II', len(new_bin), 0x004E4942))
    out_glb.extend(new_bin)

    for target in ['road-riot/assets/player-lamborghini.glb', 'road-riot/assets/player-hyperion.glb']:
        with open(target, 'wb') as fp:
            fp.write(out_glb)
        print(f"Repacked Lamborghini -> {target} ({len(out_glb)} bytes)")

if __name__ == "__main__":
    repack_ferrari()
    repack_lamborghini()
    print("ALL GLBS REPACKED WITH SANITIZED TEXTURES!")
