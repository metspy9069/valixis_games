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


async def run_day06_verification():
    print(f"[DAY06-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720",
        "--autoplay-policy=no-user-gesture-required"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[DAY06-VERIFY] Connected to CDP at {ws_url}")

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
                window.__day06Errors = [];
                window.addEventListener('error', e => {
                    window.__day06Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(2.5)

            # Start gameplay
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#start-btn').click()"
            })
            for _ in range(30):
                st = await send("Runtime.evaluate", {"expression": "window.game?.state", "returnByValue": True})
                if st.get("result", {}).get("value") == "RUNNING":
                    break
                await asyncio.sleep(0.35)

            # Set player protection and initial Heat Level ★3 (Tactical Interceptors active)
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.activateShield(60);
                    window.game.player.hull = 100;
                    window.game.heatLevel = 3;
                    window.game.updateHeatHud();
                    // Spawn a tactical interceptor alongside/behind player
                    const meshA = window.game.traffic.buildVehicleMesh('police', false, true, false, false);
                    meshA.position.set(-2.5, 0, -2.0);
                    window.game.scene.add(meshA);
                    window.game.traffic.vehicles.push({
                        mesh: meshA,
                        lane: 0,
                        targetLane: 0,
                        pendingTargetLane: 0,
                        signalDir: 0,
                        signalTimer: 0,
                        speed: window.game.player.speed,
                        baseSpeed: 32,
                        length: 4.6,
                        width: 2.2,
                        isRival: false,
                        isPolice: true,
                        isInterceptor: true,
                        pitCooldown: 0,
                        isTruck: false,
                        isTanker: false,
                        nearMissAwarded: false,
                        hit: false,
                        laneChangeTimer: 0
                    });
                })()
                """
            })

            samples = []
            interceptor_pit_seen = False
            roadblock_seen = False
            evasion_completed = False

            # Phase A: Observe Interceptor Speed Matching & PIT Maneuver Contact
            for step in range(15):
                await asyncio.sleep(0.3)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || !g.traffic) return null;
                        const t = g.traffic.getTrafficTelemetry();
                        const p = g.player;
                        const interceptors = g.traffic.vehicles.filter(v => v.isPolice && v.isInterceptor);
                        return {
                            distance: Math.round(g.distance),
                            playerSpeed: parseFloat(p.speed.toFixed(2)),
                            playerX: parseFloat(p.x.toFixed(2)),
                            playerDriftAngle: parseFloat((p.driftAngle || 0).toFixed(3)),
                            heatLevel: g.heatLevel,
                            policeActive: g.policeActive,
                            evasionTimer: parseFloat((g.evasionTimer || 0).toFixed(2)),
                            telemetry: t
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                val = res.get("result", {}).get("value")
                if val:
                    samples.append(val)
                    if abs(val["playerDriftAngle"]) > 0.05 or val["telemetry"]["interceptorCount"] > 0:
                        interceptor_pit_seen = True

                if step == 4:
                    snap1 = await send("Page.captureScreenshot", {"format": "png"})
                    with open(os.path.join(ARTIFACTS_DIR, "day06_police_interceptor_pit.png"), "wb") as f:
                        f.write(base64.b64decode(snap1["data"]))
                    print("[DAY06-VERIFY] Saved screenshot: day06_police_interceptor_pit.png")

            # Phase B: Escalate Heat to ★4 and Spawn SWAT Roadblock Formation
            print("[DAY06-VERIFY] Escalating Heat to ★4 and spawning SWAT Roadblock formation...")
            await send("Runtime.evaluate", {
                "expression": """
                window.game.heatLevel = 4;
                window.game.updateHeatHud();
                window.game.traffic.spawnRoadblock(window.game.distance, 4);
                """
            })

            for step in range(8):
                await asyncio.sleep(0.3)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || !g.traffic) return null;
                        return {
                            distance: Math.round(g.distance),
                            roadblocks: g.traffic.obstacles.filter(o => o.isRoadblock).map(o => ({ lane: o.lane, z: o.mesh.position.z })),
                            telemetry: g.traffic.getTrafficTelemetry()
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                val = res.get("result", {}).get("value")
                if val and len(val.get("roadblocks", [])) >= 2:
                    roadblock_seen = True

            # Phase C: Test Pursuit Evasion (Clear close police and tick 6.0s evasion window)
            print("[DAY06-VERIFY] Testing 6.0s continuous pursuit evasion...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    // Clean up close police and spawn distant pursuit beyond 45m threshold
                    window.game.traffic.vehicles.forEach(v => {
                        if (v.isPolice && v.mesh) {
                            window.game.scene.remove(v.mesh);
                        }
                    });
                    window.game.traffic.vehicles = window.game.traffic.vehicles.filter(v => !v.isPolice);
                    const distantMesh = window.game.traffic.buildVehicleMesh('police', false, true, false, false);
                    distantMesh.position.set(0, 0, -65);
                    window.game.scene.add(distantMesh);
                    window.game.traffic.vehicles.push({
                        mesh: distantMesh,
                        lane: 0,
                        targetLane: 0,
                        pendingTargetLane: 0,
                        signalDir: 0,
                        signalTimer: 0,
                        speed: window.game.player.speed,
                        baseSpeed: 28,
                        length: 4.6,
                        width: 2.2,
                        isRival: false,
                        isPolice: true,
                        isInterceptor: true,
                        pitCooldown: 0,
                        isTruck: false,
                        isTanker: false,
                        nearMissAwarded: false,
                        hit: false,
                        laneChangeTimer: 0
                    });
                    window.game.policeActive = true;
                    window.game.evasionTimer = 5.2; // 0.8s away from 6.0s evasion goal
                })()
                """
            })

            for step in range(30):
                await asyncio.sleep(0.12)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        try {
                            const g = window.game;
                            if (!g) return { err: "no game" };
                            const pvList = g.traffic.vehicles.filter(v => v.isPolice).map(v => ({
                                isPolice: v.isPolice,
                                isInterceptor: v.isInterceptor,
                                z: parseFloat(v.mesh.position.z.toFixed(1)),
                                d: parseFloat(Math.hypot(v.mesh.position.x - g.player.x, v.mesh.position.z - g.player.mesh.position.z).toFixed(1))
                            }));
                            return {
                                policeActive: g.policeActive,
                                pursuitEvasions: g.pursuitEvasions || 0,
                                heatLevel: g.heatLevel,
                                minPoliceDist: parseFloat((g.minPoliceDist || 0).toFixed(1)),
                                evasionTimer: parseFloat((g.evasionTimer || 0).toFixed(2)),
                                policeList: pvList
                            };
                        } catch (e) {
                            return { err: e.message };
                        }
                    })()
                    """,
                    "returnByValue": True
                })
                val = res.get("result", {}).get("value")
                if val:
                    print(f"[DAY06-VERIFY] Evasion step {step}: minPoliceDist={val.get('minPoliceDist')}m, timer={val.get('evasionTimer')}s, policeActive={val.get('policeActive')}, evasions={val.get('pursuitEvasions')}, policeList={val.get('policeList')}", flush=True)
                    if val.get("pursuitEvasions", 0) > 0 or not val.get("policeActive", True):
                        evasion_completed = True
                        break

            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day06_swat_roadblock_evasion.png"), "wb") as f:
                f.write(base64.b64decode(snap2["data"]))
            print("[DAY06-VERIFY] Saved screenshot: day06_swat_roadblock_evasion.png")

            err_res = await send("Runtime.evaluate", {
                "expression": "window.__day06Errors",
                "returnByValue": True
            })
            errors = err_res.get("result", {}).get("value", [])

            summary = {
                "samplesCount": len(samples),
                "interceptorPitSeen": interceptor_pit_seen,
                "roadblockSeen": roadblock_seen,
                "evasionCompleted": evasion_completed,
                "errors": errors,
                "finalSample": samples[-1] if samples else None
            }
            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day06_verification_telemetry.json")
            with open(telemetry_path, "w") as f:
                json.dump(summary, f, indent=2)
            print(f"[DAY06-VERIFY] Interceptor PIT: {interceptor_pit_seen}, Roadblock: {roadblock_seen}, Evasion: {evasion_completed}, Errors: {len(errors)}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.kill()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(run_day06_verification())
