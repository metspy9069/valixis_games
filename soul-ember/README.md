# 🎮 VALIXIS Games (`games.valixis.tech`)

Official gaming division and browser-native interactive arcade by **VALIXIS Technologies**.

---

## 🕹️ Active Showcase Game: Soul Ember — Dungeon Survivors

A high-performance 2D top-down roguelite survival game built in HTML5 Canvas & Web Audio API.
- **Zero dependencies, zero build steps, 100% client-side.**
- **PWA Ready:** Plays offline, installs to home screen / desktop.
- **8 Playable Heroes:** Pyromancer, Cryomancer, Void Rogue, Necromancer, Paladin, Archer, Warlock, Bard.
- **Permanent Meta-Progression:** The Soul Forge armory auto-saves gold and upgrades to `localStorage`.
- **Boss Encounter:** Malakor, Void Lich with alert banners, phases, and projectile patterns.
- **Cross-Platform Controls:** Desktop (WASD/Arrows + Space) and Mobile (virtual touch joystick + dash).

---

## 🌐 Subdomain Architecture

VALIXIS Web Infrastructure:
- **Main Corporate Site:** [`https://valixis.tech`](https://valixis.tech) (GitHub Pages / `VALIXIS/company-docs`)
- **Developer & Client Portal:** [`https://portal.valixis.tech`](https://portal.valixis.tech) (Vercel / `VALIXIS/VALIXIS_PORTAL`)
- **Gaming Platform:** [`https://games.valixis.tech`](https://games.valixis.tech) (Vercel or GitHub Pages)

---

## 🚀 How to Deploy `games.valixis.tech`

### Method A: Deploy on Vercel (Recommended — Identical to `portal.valixis.tech`)
1. Create a repository on GitHub (e.g. `VALIXIS/games` or `VALIXIS/valixis-games`).
2. Push this folder to the repository:
   ```bash
   git init
   git add .
   git commit -m "feat(games): launch games.valixis.tech with Soul Ember Survivors"
   git branch -M main
   git remote add origin https://github.com/VALIXIS/games.git
   git push -u origin main
   ```
3. In [Vercel Dashboard](https://vercel.com/dashboard):
   - Click **Add New...** → **Project**.
   - Import `VALIXIS/games`.
   - Framework Preset: **Other** (Static HTML).
   - Click **Deploy**.
4. In Vercel Project **Settings** → **Domains**:
   - Add domain: `games.valixis.tech`.
5. In your DNS Manager (where `valixis.tech` is registered, e.g. OrderBox / Hostinger / Cloudflare):
   - Add a CNAME record:
     - **Name / Host:** `games`
     - **Type:** `CNAME`
     - **Target / Value:** `cname.vercel-dns.com`
     - **TTL:** `3600` (or Automatic)

---

### Method B: Deploy on GitHub Pages (Free)
1. Push this folder to `https://github.com/VALIXIS/games.git`.
2. Ensure the `CNAME` file contains `games.valixis.tech`.
3. In repository **Settings** → **Pages**:
   - Source: **Deploy from a branch** (`main` / root).
   - Custom Domain: `games.valixis.tech`.
   - Enforce HTTPS: Checked.
4. In your DNS Manager:
   - Add a CNAME record:
     - **Name / Host:** `games`
     - **Type:** `CNAME`
     - **Target / Value:** `valixis.github.io`
     - **TTL:** `3600`

---

## 🧪 Local Testing
Run a quick local web server:
```bash
python -m http.server 8080
```
Then visit `http://localhost:8080/`.
