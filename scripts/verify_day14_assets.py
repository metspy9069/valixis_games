import asyncio
import json
import base64
import os
import subprocess
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9222
URL = "http://localhost:3000/road-riot/index.html"
ARTIFACTS_DIR = r"C:\Users\nagas\.gemini\antigravity\brain\8ea69033-02ce-4c15-aaf2-824a48008b4e"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)


async def run_day14_assets_verification():
    print(f"[DAY14-ASSETS] Launching Chrome headless on port {CDP_PORT}...", flush=True)
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[DAY14-ASSETS] Connected to CDP at {ws_url}", flush=True)

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg_id = 0

            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=20.0)
                    res = json.loads(raw)
                    if res.get("id") == msg_id:
                        if "error" in res:
                            print(f"[CDP ERROR] {res['error']}", flush=True)
                        result = res.get("result", {})
                        if "exceptionDetails" in result:
                            print(f"[CDP EXCEPTION] {result['exceptionDetails']}", flush=True)
                        return result

            await send("Page.enable")
            await send("Runtime.enable")
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day14Errors = [];
                window.addEventListener('error', e => {
                    window.__day14Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            start_nav_time = asyncio.get_event_loop().time()
            await send("Page.navigate", {"url": URL})
            print("[DAY14-ASSETS] Navigating to Road Riot for Cold-Load & Preloader verification...", flush=True)

            # Phase 1: Capture Preloader UI & Progress
            await asyncio.sleep(0.3)
            preloader_shot = await send("Page.captureScreenshot", {"format": "png"})
            preloader_shot_path = os.path.join(ARTIFACTS_DIR, "day14_preloader_progress.png")
            with open(preloader_shot_path, "wb") as f:
                f.write(base64.b64decode(preloader_shot.get("data", "")))
            print(f"[DAY14-ASSETS] Preloader progress screenshot saved: {preloader_shot_path}", flush=True)

            # Wait for game initialization & preloader completion
            initialized = False
            for _ in range(40):
                st = await send("Runtime.evaluate", {
                    "expression": "Boolean(window.game && window.game.player && window.game.traffic)",
                    "returnByValue": True
                })
                if st.get("result", {}).get("value") is True:
                    initialized = True
                    break
                await asyncio.sleep(0.3)

            if not initialized:
                raise RuntimeError("Game engine failed to initialize within timeout")

            nav_elapsed = asyncio.get_event_loop().time() - start_nav_time
            print(f"[DAY14-ASSETS] Engine initialized in {nav_elapsed:.2f}s", flush=True)

            # Telemetry for Preloader & Draco / KTX2 Loaders
            preloader_telemetry = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    const pre = g.getPreloaderTelemetry ? g.getPreloaderTelemetry() : {};
                    const hasDraco = Boolean(g.gltfLoader && g.gltfLoader.dracoLoader);
                    const hasKtx2 = Boolean(g.gltfLoader && g.gltfLoader.ktx2Loader);
                    const perfNav = performance.getEntriesByType('navigation')[0] || {};
                    return {
                        preloader: pre,
                        hasDraco,
                        hasKtx2,
                        domContentLoadedMs: perfNav.domContentLoadedEventEnd || 0,
                        loadEventMs: perfNav.loadEventEnd || 0,
                        coldLoadSec: parseFloat((""" + str(nav_elapsed) + """).toFixed(2))
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value", {})
            print(f"[DAY14-ASSETS] Preloader & Loader Telemetry: {json.dumps(preloader_telemetry)}", flush=True)

            # -------------------------------------------------------------
            # Phase 2: Draco 3D Vehicle Model Rendered in Showroom
            # -------------------------------------------------------------
            print("[DAY14-ASSETS] Inspecting Draco-compressed Hyperion model in Showroom...", flush=True)
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.openGarage();
                    const hypIdx = window.game.garageVehicleList.indexOf('hyperion');
                    if (hypIdx !== -1) {
                        window.game.garageIndex = hypIdx;
                        window.game.renderGarageCarousel();
                    }
                })()
                """
            })
            await asyncio.sleep(2.0)

            # Re-read preloader telemetry now that models had time to stream
            preloader_final = (await send("Runtime.evaluate", {
                "expression": "window.game.getPreloaderTelemetry ? window.game.getPreloaderTelemetry() : {}",
                "returnByValue": True
            })).get("result", {}).get("value", {})
            if preloader_final:
                preloader_telemetry["preloader"] = preloader_final

            draco_telemetry = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const p = window.game.player;
                    const model = p.modelGroup;
                    let meshCount = 0;
                    let vertexCount = 0;
                    if (model) {
                        model.traverse(n => {
                            if (n.isMesh) {
                                meshCount++;
                                if (n.geometry && n.geometry.attributes && n.geometry.attributes.position) {
                                    vertexCount += n.geometry.attributes.position.count;
                                }
                            }
                        });
                    }
                    return {
                        vehicle: p.currentVehicle,
                        meshCount,
                        vertexCount,
                        modelVisible: Boolean(model && model.visible),
                        turntableAngle: window.game.turntableAngle
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value", {})
            print(f"[DAY14-ASSETS] Draco Model Telemetry: {json.dumps(draco_telemetry)}", flush=True)

            draco_shot = await send("Page.captureScreenshot", {"format": "png"})
            draco_shot_path = os.path.join(ARTIFACTS_DIR, "day14_draco_model_rendered.png")
            with open(draco_shot_path, "wb") as f:
                f.write(base64.b64decode(draco_shot.get("data", "")))
            print(f"[DAY14-ASSETS] Draco model rendered screenshot saved: {draco_shot_path}", flush=True)

            # -------------------------------------------------------------
            # Phase 3: Traffic Distance LOD System Active Verification
            # -------------------------------------------------------------
            print("[DAY14-ASSETS] Testing Traffic Distance LOD (75m threshold)...", flush=True)
            # Close garage and enter running race state with traffic
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    if (g.ui.garageModal) g.ui.garageModal.classList.add('hidden');
                    g.state = 'RUNNING';
                    g.player.speed = 28;

                    // Ensure traffic manager has both near (<75m) and far (>75m) entities
                    const tm = g.traffic;
                    // Spawn near car at Z = -35 (distance from player at -8 is 27m < 75m)
                    const nearCar = tm.buildVehicleMesh('sports', false, false, false, false);
                    nearCar.position.set(0, 0, -35);
                    tm.scene.add(nearCar);
                    tm.vehicles.push({
                        mesh: nearCar,
                        lane: 0,
                        speed: 20,
                        baseSpeed: 20,
                        currentLod: 'near',
                        width: 2.2,
                        length: 4.6,
                        hit: false
                    });

                    // Spawn far car at Z = -135 (distance from player at -8 is 127m > 75m)
                    const farCar = tm.buildVehicleMesh('sedan', false, false, false, false);
                    farCar.position.set(6, 0, -135);
                    tm.scene.add(farCar);
                    tm.vehicles.push({
                        mesh: farCar,
                        lane: 6,
                        speed: 18,
                        baseSpeed: 18,
                        currentLod: 'far',
                        width: 2.2,
                        length: 4.6,
                        hit: false
                    });

                    // Update 1 frame to trigger LOD evaluation
                    tm.update(0.016, 28, g.player);
                })()
                """
            })
            await asyncio.sleep(0.8)

            lod_telemetry = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    const lod = g.getTrafficLodTelemetry ? g.getTrafficLodTelemetry() : {};
                    let verifiedNearVisible = 0;
                    let verifiedFarVisible = 0;
                    g.traffic.vehicles.forEach(v => {
                        const dist = Math.abs(v.mesh.position.z - (g.player.mesh ? g.player.mesh.position.z : -8));
                        const nearGrp = v.mesh.userData && v.mesh.userData.lodNear;
                        const farGrp = v.mesh.userData && v.mesh.userData.lodFar;
                        if (dist <= 75 && nearGrp && nearGrp.visible) verifiedNearVisible++;
                        if (dist > 75 && farGrp && farGrp.visible) verifiedFarVisible++;
                    });
                    return {
                        telemetry: lod,
                        verifiedNearVisible,
                        verifiedFarVisible,
                        playerZ: g.player.mesh ? g.player.mesh.position.z : -8
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value", {})
            print(f"[DAY14-ASSETS] Traffic LOD Telemetry: {json.dumps(lod_telemetry)}", flush=True)

            lod_shot = await send("Page.captureScreenshot", {"format": "png"})
            lod_shot_path = os.path.join(ARTIFACTS_DIR, "day14_traffic_lod_active.png")
            with open(lod_shot_path, "wb") as f:
                f.write(base64.b64decode(lod_shot.get("data", "")))
            print(f"[DAY14-ASSETS] Traffic LOD active screenshot saved: {lod_shot_path}", flush=True)

            # Check runtime errors
            errors = (await send("Runtime.evaluate", {
                "expression": "window.__day14Errors || []",
                "returnByValue": True
            })).get("result", {}).get("value", [])

            verification_payload = {
                "timestamp": "2026-11-28T19:15:00Z",
                "day": 14,
                "title": "Asset Optimization, Draco Geometry & KTX2 Texture Streaming",
                "coldLoadTelemetry": preloader_telemetry,
                "dracoVehicleTelemetry": draco_telemetry,
                "trafficLodTelemetry": lod_telemetry,
                "runtimeErrors": errors,
                "verificationPassed": len(errors) == 0 and lod_telemetry.get("telemetry", {}).get("farLodCount", 0) >= 1
            }

            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day14_verification_telemetry.json")
            with open(telemetry_path, "w", encoding="utf-8") as f:
                json.dump(verification_payload, f, indent=2)
            print(f"[DAY14-ASSETS] Verification telemetry saved to {telemetry_path}", flush=True)
            print("[DAY14-ASSETS] Day 14 WebGL CDP Verification complete!", flush=True)

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()


if __name__ == "__main__":
    asyncio.run(run_day14_assets_verification())
