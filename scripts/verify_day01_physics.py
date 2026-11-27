import asyncio
import json
import base64
import os
import subprocess
import time
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9222
URL = "http://localhost:3000/road-riot/index.html"
ARTIFACTS_DIR = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

async def run_day01_verification():
    print(f"[DAY01-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720",
        "--autoplay-policy=no-user-gesture-required",
        "--enable-logging=stderr",
        "--v=1"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[DAY01-VERIFY] Connected to CDP at {ws_url}")

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    res = json.loads(raw)
                    if res.get("id") == msg_id:
                        return res.get("result", {})

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Log.enable")

            # Telemetry container
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day01Telemetry = {
                    consoleErrors: [],
                    guardrailContacts: 0,
                    guardrailBounces: [],
                    ccdCollisions: [],
                    maxSpeedKmh: 0,
                    toasts: []
                };
                window.addEventListener('error', e => {
                    window.__day01Telemetry.consoleErrors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                const origErr = console.error;
                console.error = function(...args) {
                    window.__day01Telemetry.consoleErrors.push({ msg: args.map(String).join(' ') });
                    origErr.apply(console, args);
                };
                """
            })

            print(f"[DAY01-VERIFY] Navigating to {URL}...")
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(3.5)

            # Hook toast logging
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    if (window.game) {
                        const origToast = window.game.toast.bind(window.game);
                        window.game.toast = function(msg, type) {
                            window.__day01Telemetry.toasts.push({ msg, type, time: performance.now() });
                            if (msg && (msg.includes('IMPACT') || msg.includes('SCRAPE') || msg.includes('COLLISION') || msg.includes('CRASH'))) {
                                window.__day01Telemetry.ccdCollisions.push(msg);
                            }
                            return origToast(msg, type);
                        };
                    }
                })()
                """
            })

            # Start Endless Highway Race
            print("[DAY01-VERIFY] Starting race in Endless Highway...")
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#mode-endless-btn')?.click(); window.game.startCountdown(); window.game.startRun();"
            })
            await asyncio.sleep(2.0)

            # TEST 1: Elastic Guardrail Contact (Steer hard left into the boundary X <= -7.95)
            print("[DAY01-VERIFY] Executing Test 1: Elastic Guardrail Deflection on left barrier...")
            for i in range(12):
                await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || g.state !== 'RUNNING') return;
                        // Steer left into guardrail
                        g.keys.add('ArrowLeft');
                        g.keys.add('KeyA');
                        g.keys.delete('ArrowRight');
                        g.keys.delete('KeyD');

                        if (g.player.x <= -7.90) {
                            window.__day01Telemetry.guardrailContacts++;
                            window.__day01Telemetry.guardrailBounces.push({
                                x: g.player.x.toFixed(2),
                                vx: (g.player.vx || 0).toFixed(2),
                                steerAngle: (g.player.steerAngle || 0).toFixed(2),
                                speed: (g.player.speed * 9).toFixed(0)
                            });
                        }
                    })()
                    """
                })
                await asyncio.sleep(0.25)

            # Capture Guardrail Deflection Screenshot
            ss_guardrail = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day01_elastic_guardrail_deflection.png"), "wb") as f:
                f.write(base64.b64decode(ss_guardrail["data"]))
            print("[DAY01-VERIFY] Captured day01_elastic_guardrail_deflection.png")

            # TEST 2: High-Speed Swept AABB Collision & Momentum Damage
            print("[DAY01-VERIFY] Executing Test 2: High-Speed Swept AABB & Velocity-Scaled Impact...")
            # Position player and truck in center lane (X = 0) for supersonic rear-end intercept
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    if (!g) return;
                    g.keys.delete('ArrowLeft');
                    g.keys.delete('KeyA');
                    g.keys.delete('ArrowRight');
                    g.keys.delete('KeyD');

                    g.player.x = 0;
                    g.player.mesh.position.x = 0;
                    g.player.vx = 0;
                    g.player.steerAngle = 0;

                    // Engage Nitrous Boost to reach 340+ km/h
                    g.keys.add('ShiftLeft');
                    g.player.nitro = 100;
                    g.player.speed = 38; // ~342 km/h supersonic test

                    // Ensure traffic vehicle exists in lane 0 ahead
                    if (!g.traffic.vehicles || g.traffic.vehicles.length === 0) {
                        g.traffic.spawnTraffic(0);
                    }
                    if (g.traffic && g.traffic.vehicles.length > 0) {
                        const v = g.traffic.vehicles[0];
                        v.lane = 0;
                        v.targetLane = 0;
                        v.mesh.position.x = 0;
                        v.mesh.position.z = g.player.mesh.position.z - 16; // 16m ahead
                        v.speed = 5; // 45 km/h -> delta-V ~297 km/h
                        v.isTruck = true;
                        v.hit = false;
                        v.isColliding = false;
                    }
                })()
                """
            })

            # Monitor closure and impact
            for step in range(16):
                await asyncio.sleep(0.15)
                status = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        const p = g.player;
                        const t = g.traffic;
                        const kmh = Math.round(p.speed * 9);
                        if (kmh > window.__day01Telemetry.maxSpeedKmh) {
                            window.__day01Telemetry.maxSpeedKmh = kmh;
                        }

                        // Maintain Center Lane 0
                        p.x = 0;
                        p.mesh.position.x = 0;

                        return {
                            x: p.x.toFixed(2),
                            speedKmh: kmh,
                            hull: p.hull,
                            collisions: window.__day01Telemetry.ccdCollisions.length
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                st = status.get("result", {}).get("value", {})
                print(f"  [Speed Test Step {step}] Spd: {st.get('speedKmh')} km/h | X: {st.get('x')}m | Hull: {st.get('hull')}% | Impacts: {st.get('collisions')}")
                if st.get("collisions", 0) > 0:
                    break

            # Capture Collision Response Screenshot
            ss_collision = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day01_swept_aabb_collision.png"), "wb") as f:
                f.write(base64.b64decode(ss_collision["data"]))
            print("[DAY01-VERIFY] Captured day01_swept_aabb_collision.png")

            # Extract Full Day 01 Verification Telemetry
            results = await send("Runtime.evaluate", {
                "expression": """
                ({
                    guardrailContacts: window.__day01Telemetry.guardrailContacts,
                    guardrailSampleBounces: window.__day01Telemetry.guardrailBounces.slice(-5),
                    ccdCollisions: window.__day01Telemetry.ccdCollisions,
                    maxSpeedKmh: window.__day01Telemetry.maxSpeedKmh,
                    toasts: window.__day01Telemetry.toasts.map(t => t.msg),
                    consoleErrors: window.__day01Telemetry.consoleErrors
                })
                """,
                "returnByValue": True
            })

            data = results.get("result", {}).get("value", {})
            print("\n=======================================================")
            print("[DAY01-VERIFY] DAY 01 VERIFICATION SUMMARY")
            print("=======================================================")
            print(f"Guardrail Contacts Detected: {data.get('guardrailContacts')}")
            print(f"Sample Guardrail Bounces: {json.dumps(data.get('guardrailSampleBounces'), indent=2)}")
            print(f"Swept AABB Collisions Logged: {len(data.get('ccdCollisions', []))}")
            for c in data.get('ccdCollisions', []):
                print(f"  - Impact Event: {c}")
            print(f"Peak Speed Tested: {data.get('maxSpeedKmh')} KM/H")
            print(f"Console Errors: {len(data.get('consoleErrors', []))}")
            if data.get('consoleErrors'):
                for err in data.get('consoleErrors'):
                    print(f"  [ERROR] {err}")
            print("=======================================================\n")

            # Persist summary
            with open(os.path.join(ARTIFACTS_DIR, "road_riot_day01_verification_telemetry.json"), "w") as f:
                json.dump(data, f, indent=2)

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.wait(timeout=3)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_day01_verification())
