import struct
import json

with open('road-riot/assets/player-ferrari.glb', 'rb') as f:
    magic, ver, length = struct.unpack('<III', f.read(12))
    chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
    gltf_json = json.loads(f.read(chunk0_len).decode('utf-8'))

print('Textures count:', len(gltf_json.get('textures', [])))
print('Images count:', len(gltf_json.get('images', [])))
for i, img in enumerate(gltf_json.get('images', [])):
    print(f"Image {i}: name={img.get('name')}, mimeType={img.get('mimeType')}, bufferView={img.get('bufferView')}")

print('\nMaterials count:', len(gltf_json.get('materials', [])))
for i, m in enumerate(gltf_json.get('materials', [])):
    pbr = m.get('pbrMetallicRoughness', {})
    tex = pbr.get('baseColorTexture')
    print(f"Mat {i}: name={m.get('name')}, baseColorTex={tex}")
