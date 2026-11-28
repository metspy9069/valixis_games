"""Inject Google Analytics tags into soul-ember/dist/index.html"""
import sys
import os

GA_BLOCK = """\n<!-- Google tag (gtag.js) / Google Tag Manager -->
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-KTXSRLWK"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'GTM-KTXSRLWK');
  gtag('config', 'G-9SGCBYSRYB');
</script>
"""

TARGET_FILE = os.path.join(os.path.dirname(__file__), '..', 'soul-ember', 'dist', 'index.html')

with open(TARGET_FILE, 'r', encoding='utf-8') as fh:
    content = fh.read()

if 'GTM-KTXSRLWK' in content:
    print('GA already present - no change needed')
    sys.exit(0)

MARKER = 'summary_large_image">'
idx = content.find(MARKER)
if idx < 0:
    print('ERROR: marker not found in file')
    sys.exit(1)

insert_at = idx + len(MARKER)
new_content = content[:insert_at] + GA_BLOCK + content[insert_at:]

with open(TARGET_FILE, 'w', encoding='utf-8', newline='') as fh:
    fh.write(new_content)

print('SUCCESS - GA injected into soul-ember/dist/index.html')
