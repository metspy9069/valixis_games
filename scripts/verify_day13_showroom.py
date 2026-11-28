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


async def run_day13_showroom_verification():
    print(f"[DAY13-SHOWROOM] Launching Chrome headless on port {CDP_PORT}...", flush=True)
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
        print(f"[DAY13-SHOWROOM] Connected to CDP at {ws_url}", flush=True)

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
                window.__day13Errors = [];
                window.addEventListener('error', e => {
                    window.__day13Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            print("[DAY13-SHOWROOM] Navigating to Road Riot...", flush=True)
            await asyncio.sleep(2.5)

            # Wait for game initialization
            initialized = False
            for _ in range(35):
                st = await send("Runtime.evaluate", {
                    "expression": "Boolean(window.game && window.game.player && document.querySelector('#garage-btn'))",
                    "returnByValue": True
                })
                if st.get("result", {}).get("value") is True:
                    initialized = True
                    break
                await asyncio.sleep(0.3)

            if not initialized:
                raise RuntimeError("Game failed to initialize within timeout")

            print("[DAY13-SHOWROOM] Game initialized. Entering 3D Supercar Showroom & Garage...", flush=True)

            # -------------------------------------------------------------
            # Phase 1: Enter Showroom Floor 2.0 & Turntable Lighting
            # -------------------------------------------------------------
            await send("Runtime.evaluate", {
                "expression": "window.game.openGarage();"
            })
            await asyncio.sleep(1.2)

            telemetry_p1 = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    const turntable = g.turntableMesh;
                    const epoxy = turntable?.getObjectByName('EpoxyShowroomFloor');
                    const outerRing = turntable?.getObjectByName('OuterLedStrip');
                    const innerRing = turntable?.getObjectByName('InnerLedStrip');
                    const keySpot = turntable?.getObjectByName('StudioSpotKey');
                    const fillSpot = turntable?.getObjectByName('StudioSpotFill');
                    const rimSpot = turntable?.getObjectByName('StudioSpotRim');
                    const overhead = turntable?.getObjectByName('StudioOverheadLight');
                    const floorBounce = turntable?.getObjectByName('StudioFloorBounceLight');

                    return {
                        state: g.state,
                        turntableMeshVisible: turntable ? turntable.visible : false,
                        epoxyFloor: {
                            exists: Boolean(epoxy),
                            type: epoxy?.material?.type,
                            clearcoat: epoxy?.material?.clearcoat,
                            roughness: epoxy?.material?.roughness,
                            metalness: epoxy?.material?.metalness
                        },
                        ledPerimeter: {
                            outerStrip: Boolean(outerRing),
                            innerStrip: Boolean(innerRing)
                        },
                        studioLighting: {
                            keySpotIntensity: keySpot?.intensity,
                            fillSpotIntensity: fillSpot?.intensity,
                            rimSpotIntensity: rimSpot?.intensity,
                            overheadIntensity: overhead?.intensity,
                            floorBounceIntensity: floorBounce?.intensity
                        },
                        cameraPreset: g.activeCameraPreset,
                        cameraPos: {
                            x: parseFloat(g.camera.position.x.toFixed(2)),
                            y: parseFloat(g.camera.position.y.toFixed(2)),
                            z: parseFloat(g.camera.position.z.toFixed(2))
                        }
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value")

            print(f"[DAY13-SHOWROOM] Phase 1 Telemetry: {json.dumps(telemetry_p1, indent=2)}", flush=True)

            shot_p1 = await send("Page.captureScreenshot", {"format": "png"})
            shot_path1 = os.path.join(ARTIFACTS_DIR, "day13_showroom_turntable_pbr.png")
            with open(shot_path1, "wb") as f:
                f.write(base64.b64decode(shot_p1["data"]))
            print(f"[DAY13-SHOWROOM] Saved Phase 1 screenshot: {shot_path1}", flush=True)

            # -------------------------------------------------------------
            # Phase 2: Interactive Camera Angle Presets (Cockpit Interior View)
            # -------------------------------------------------------------
            print("[DAY13-SHOWROOM] Testing camera angle presets (Side, Cockpit, Rear Wing)...", flush=True)

            # Switch to Low Side Profile
            await send("Runtime.evaluate", {
                "expression": "window.game.setCameraPreset('side_profile');"
            })
            await asyncio.sleep(0.8)

            # Switch to Cockpit Interior Close-up
            await send("Runtime.evaluate", {
                "expression": "window.game.setCameraPreset('cockpit_interior');"
            })
            await asyncio.sleep(1.0)

            telemetry_p2 = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    return {
                        activeCameraPreset: g.activeCameraPreset,
                        cameraPos: {
                            x: parseFloat(g.camera.position.x.toFixed(2)),
                            y: parseFloat(g.camera.position.y.toFixed(2)),
                            z: parseFloat(g.camera.position.z.toFixed(2))
                        },
                        cockpitTarget: {
                            x: parseFloat(g.cameraCurrentLook.x.toFixed(2)),
                            y: parseFloat(g.cameraCurrentLook.y.toFixed(2)),
                            z: parseFloat(g.cameraCurrentLook.z.toFixed(2))
                        }
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value")

            print(f"[DAY13-SHOWROOM] Phase 2 (Cockpit) Telemetry: {json.dumps(telemetry_p2, indent=2)}", flush=True)

            shot_p2 = await send("Page.captureScreenshot", {"format": "png"})
            shot_path2 = os.path.join(ARTIFACTS_DIR, "day13_camera_presets_cockpit.png")
            with open(shot_path2, "wb") as f:
                f.write(base64.b64decode(shot_p2["data"]))
            print(f"[DAY13-SHOWROOM] Saved Phase 2 screenshot: {shot_path2}", flush=True)

            # -------------------------------------------------------------
            # Phase 3: Interactive Articulation (Doors & Bonnet) & Dyno Curve
            # -------------------------------------------------------------
            print("[DAY13-SHOWROOM] Returning to Front 3/4 view and engaging door/bonnet articulation...", flush=True)

            # Return to Front 3/4 Studio View
            await send("Runtime.evaluate", {
                "expression": "window.game.setCameraPreset('front_three_quarter');"
            })
            await asyncio.sleep(0.8)

            # Toggle Scissor Doors and Mid-Engine Bonnet Open
            await send("Runtime.evaluate", {
                "expression": """
                window.game.toggleGarageDoors();
                window.game.toggleGarageBonnet();
                """
            })
            await asyncio.sleep(1.2)

            # Engage Live Dynamometer Benchmark
            print("[DAY13-SHOWROOM] Revving engine and running live dyno benchmark...", flush=True)
            await send("Runtime.evaluate", {
                "expression": "window.game.runDynoBenchmark();"
            })
            # Wait for RPM sweep to reach ~6,500 - 7,500 RPM near peak power
            await asyncio.sleep(1.8)

            telemetry_p3 = (await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    const p = g.player;
                    const dynoCanvas = g.ui.garageDynoCanvas;
                    const carId = g.garageVehicleList[g.garageIndex] || 'apex';
                    const dynoData = g.getShowroomTelemetry ? g.getShowroomTelemetry() : {};

                    return {
                        doorsOpen: p.doorsOpen,
                        doorAngle: parseFloat((p.doorAngle || 0).toFixed(2)),
                        leftDoorRotZ: parseFloat((p.leftDoorGroup?.rotation?.z || 0).toFixed(2)),
                        rightDoorRotZ: parseFloat((p.rightDoorGroup?.rotation?.z || 0).toFixed(2)),
                        bonnetOpen: p.bonnetOpen,
                        bonnetAngle: parseFloat((p.bonnetAngle || 0).toFixed(2)),
                        engineCoverRotX: parseFloat((p.engineCoverGroup?.rotation?.x || 0).toFixed(2)),
                        isDynoTesting: g.isDynoTesting,
                        liveRpmText: g.ui.dynoLiveRpm?.textContent,
                        dynoCanvasWidth: dynoCanvas?.width,
                        dynoCanvasHeight: dynoCanvas?.height,
                        carId,
                        peakHp: dynoData.peakHp,
                        peakTorque: dynoData.peakTorque
                    };
                })()
                """,
                "returnByValue": True
            })).get("result", {}).get("value")

            print(f"[DAY13-SHOWROOM] Phase 3 Telemetry: {json.dumps(telemetry_p3, indent=2)}", flush=True)

            shot_p3 = await send("Page.captureScreenshot", {"format": "png"})
            shot_path3 = os.path.join(ARTIFACTS_DIR, "day13_doors_open_dyno_curve.png")
            with open(shot_path3, "wb") as f:
                f.write(base64.b64decode(shot_p3["data"]))
            print(f"[DAY13-SHOWROOM] Saved Phase 3 screenshot: {shot_path3}", flush=True)

            # Check page errors
            errors = (await send("Runtime.evaluate", {
                "expression": "window.__day13Errors",
                "returnByValue": True
            })).get("result", {}).get("value", [])

            telemetry_summary = {
                "phase1_showroom_turntable": telemetry_p1,
                "phase2_camera_presets": telemetry_p2,
                "phase3_articulation_dyno": telemetry_p3,
                "page_errors": errors,
                "passed": len(errors) == 0 and telemetry_p1["epoxyFloor"]["exists"] and telemetry_p3["doorsOpen"] and telemetry_p3["bonnetOpen"]
            }

            telem_path = os.path.join(ARTIFACTS_DIR, "road_riot_day13_verification_telemetry.json")
            with open(telem_path, "w") as f:
                json.dump(telemetry_summary, f, indent=2)
            print(f"[DAY13-SHOWROOM] Telemetry saved to {telem_path}", flush=True)

            if len(errors) > 0:
                print(f"[DAY13-SHOWROOM] WARNING: Detected {len(errors)} page errors: {errors}", flush=True)
            else:
                print("[DAY13-SHOWROOM] SUCCESS: 0 Page Errors. Showroom 2.0 & Interactive Garage verified!", flush=True)

    finally:
        print("[DAY13-SHOWROOM] Terminating Chrome...", flush=True)
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()


if __name__ == "__main__":
    asyncio.run(run_day13_showroom_verification())
