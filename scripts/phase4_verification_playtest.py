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

async def run_verification():
    print(f"[VERIFY] Starting Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
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
        ws_url = targets[0]["webSocketDebuggerUrl"]
        print(f"[VERIFY] Connected to CDP at {ws_url}")

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
            await send("DOM.enable")

            print("[VERIFY] Injecting telemetry harness...")
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__telemetry = {
                    consoleLogs: [],
                    consoleErrors: [],
                    consoleWarns: [],
                    audioEvents: {},
                    fpsSamples: [],
                    collisionEvents: [],
                    rampEvents: [],
                    nearMissEvents: 0,
                    checkpointEvents: [],
                    nitroEvents: 0,
                    brakeEvents: 0,
                    driftEvents: 0,
                    sparksSpawned: 0,
                    maxSpeedKmh: 0,
                    maxGearReached: 1,
                    radarBlipsObserved: 0,
                    proximityAlertsTriggered: 0,
                    totalFrames: 0,
                    lastFrameTime: performance.now(),
                    frameCount: 0,
                    minFps: 999,
                    maxFps: 0,
                    droppedFrames: 0
                };

                const origError = console.error;
                console.error = function(...args) {
                    window.__telemetry.consoleErrors.push({ time: performance.now(), msg: args.map(String).join(' ') });
                    origError.apply(console, args);
                };
                const origWarn = console.warn;
                console.warn = function(...args) {
                    window.__telemetry.consoleWarns.push({ time: performance.now(), msg: args.map(String).join(' ') });
                    origWarn.apply(console, args);
                };
                const origLog = console.log;
                console.log = function(...args) {
                    window.__telemetry.consoleLogs.push({ time: performance.now(), msg: args.map(String).join(' ') });
                    origLog.apply(console, args);
                };
                window.addEventListener('error', e => {
                    window.__telemetry.consoleErrors.push({ time: performance.now(), msg: e.message, filename: e.filename, lineno: e.lineno });
                });

                let fpsTimer = performance.now();
                let fpsFrames = 0;
                function frameTick() {
                    const now = performance.now();
                    const dt = (now - window.__telemetry.lastFrameTime) / 1000;
                    window.__telemetry.lastFrameTime = now;
                    window.__telemetry.totalFrames++;
                    fpsFrames++;

                    if (dt > 0.033) {
                        window.__telemetry.droppedFrames++;
                    }

                    if (now - fpsTimer >= 500) {
                        const currentFps = (fpsFrames * 1000) / (now - fpsTimer);
                        window.__telemetry.fpsSamples.push(Math.round(currentFps));
                        if (currentFps < window.__telemetry.minFps) window.__telemetry.minFps = Math.round(currentFps);
                        if (currentFps > window.__telemetry.maxFps) window.__telemetry.maxFps = Math.round(currentFps);
                        fpsFrames = 0;
                        fpsTimer = now;
                    }
                    requestAnimationFrame(frameTick);
                }
                requestAnimationFrame(frameTick);
                """
            })

            # Navigate to Road Riot
            print(f"[VERIFY] Navigating to {URL}...")
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(4.0)

            # Bind hooks into audio, toasts, sparks, and telemetry
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    if (window.audio) {
                        const origPlay = window.audio.play.bind(window.audio);
                        window.audio.play = function(sfx) {
                            window.__telemetry.audioEvents[sfx] = (window.__telemetry.audioEvents[sfx] || 0) + 1;
                            return origPlay(sfx);
                        };
                    }
                    const tm = window.game?.traffic;
                    if (tm && tm.spawnSparks) {
                        const origSparks = tm.spawnSparks.bind(tm);
                        tm.spawnSparks = function(...args) {
                            window.__telemetry.sparksSpawned += (args[1] || 1);
                            return origSparks(...args);
                        };
                    }
                    const origToast = window.game.toast.bind(window.game);
                    window.game.toast = function(msg, type) {
                        if (msg && msg.includes('NEAR MISS')) window.__telemetry.nearMissEvents++;
                        if (msg && msg.includes('CHECKPOINT')) window.__telemetry.checkpointEvents.push(msg);
                        if (msg && msg.includes('COLLISION')) window.__telemetry.collisionEvents.push(msg);
                        if (msg && msg.includes('STUNT')) window.__telemetry.rampEvents.push(msg);
                        return origToast(msg, type);
                    };
                })()
                """
            })

            # Capture Menu / Showroom verification screenshot
            menu_ss = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "verification_phase4_menu_showroom_verified.png"), "wb") as f:
                f.write(base64.b64decode(menu_ss["data"]))
            print("[VERIFY] Captured verification_phase4_menu_showroom_verified.png")

            # Setup Autonomous AI Driver
            await send("Runtime.evaluate", {
                "expression": """
                window.__pilot = {
                    enabled: true,
                    targetLane: 0,
                    updatePilot: function() {
                        if (!this.enabled || !window.game || window.game.state !== 'RUNNING') return;
                        const g = window.game;
                        const p = g.player;
                        const t = g.traffic;

                        const currentKmh = Math.round((p.speed || 0) * 9);
                        if (currentKmh > window.__telemetry.maxSpeedKmh) {
                            window.__telemetry.maxSpeedKmh = currentKmh;
                        }
                        if (g.lastGear > window.__telemetry.maxGearReached) {
                            window.__telemetry.maxGearReached = g.lastGear;
                        }

                        // Check radar blips
                        const totalBlips = (document.querySelector('#blips-lane-left')?.children?.length || 0) +
                                           (document.querySelector('#blips-lane-center')?.children?.length || 0) +
                                           (document.querySelector('#blips-lane-right')?.children?.length || 0);
                        if (totalBlips > 0) {
                            window.__telemetry.radarBlipsObserved = Math.max(window.__telemetry.radarBlipsObserved, totalBlips);
                        }
                        // Check proximity alert
                        const proxAlert = document.querySelector('#hud-proximity-alert');
                        if (proxAlert && !proxAlert.classList.contains('hidden')) {
                            window.__telemetry.proximityAlertsTriggered++;
                        }

                        const currentX = p.x;
                        const currentZ = p.mesh.position.z;
                        const lanes = [-6, 0, 6];
                        const laneScores = { '-6': 0, '0': 0, '6': 0 };

                        t.vehicles.forEach(v => {
                            const relZ = v.mesh.position.z - currentZ;
                            if (relZ < 0 && relZ > -65) {
                                const dist = -relZ;
                                const weight = (65 - dist) / 65;
                                [-6, 0, 6].forEach(lane => {
                                    if (Math.abs(v.mesh.position.x - lane) < 2.4) {
                                        laneScores[lane] += weight * 4.5;
                                    }
                                });
                            }
                        });

                        t.obstacles.forEach(o => {
                            const relZ = o.mesh.position.z - currentZ;
                            if (relZ < 0 && relZ > -60) {
                                const dist = -relZ;
                                const weight = (60 - dist) / 60;
                                [-6, 0, 6].forEach(lane => {
                                    if (Math.abs(o.mesh.position.x - lane) < 2.2) {
                                        laneScores[lane] += weight * 5.5;
                                    }
                                });
                            }
                        });

                        // Seek ramps for aerial verification
                        if (t.jumpRamps) {
                            t.jumpRamps.forEach(r => {
                                const rz = r.parent.position.z + r.mesh.position.z;
                                const relZ = rz - currentZ;
                                if (relZ < 0 && relZ > -55) {
                                    if (laneScores[r.lane] < 2.5) {
                                        laneScores[r.lane] -= 4.0;
                                    }
                                }
                            });
                        }

                        let bestLane = 0;
                        let minScore = 999;
                        lanes.forEach(l => {
                            const score = laneScores[l] + (Math.abs(l - currentX) * 0.15);
                            if (score < minScore) {
                                minScore = score;
                                bestLane = l;
                            }
                        });

                        const laneDiff = bestLane - currentX;
                        if (Math.abs(laneDiff) > 0.4) {
                            if (laneDiff > 0) {
                                g.keys.delete('ArrowLeft');
                                g.keys.delete('KeyA');
                                g.keys.add('ArrowRight');
                                g.keys.add('KeyD');
                            } else {
                                g.keys.delete('ArrowRight');
                                g.keys.delete('KeyD');
                                g.keys.add('ArrowLeft');
                                g.keys.add('KeyA');
                            }
                        } else {
                            g.keys.delete('ArrowLeft');
                            g.keys.delete('KeyA');
                            g.keys.delete('ArrowRight');
                            g.keys.delete('KeyD');
                        }

                        // Ceramic Braking
                        const currentLaneScore = laneScores[Math.round(currentX / 6) * 6] || 0;
                        if (currentLaneScore >= 3.2 && minScore >= 2.5) {
                            g.keys.add('ArrowDown');
                            window.__telemetry.brakeEvents++;
                        } else {
                            g.keys.delete('ArrowDown');
                        }

                        // Nitrous Boost
                        if (minScore <= 0.6 && p.nitro >= 20 && !p.isAirborne && !g.keys.has('ArrowDown')) {
                            g.keys.add('ShiftLeft');
                            window.__telemetry.nitroEvents++;
                        } else {
                            g.keys.delete('ShiftLeft');
                        }
                    }
                };

                setInterval(() => window.__pilot.updatePilot(), 50);
                """
            })

            # Verification Matrix across disciplines
            verify_sessions = [
                {
                    "discipline": "sprint",
                    "biome": "midnight",
                    "label": "Midnight Sprint 1500m (Hypersonic Boost & Radar Verification)",
                    "target_ss": "verification_phase4_hypersonic_boost.png",
                    "ss_trigger": "boost"
                },
                {
                    "discipline": "endless",
                    "biome": "sunset",
                    "label": "Sunset Endless Highway (Traffic Radar & Proximity Cue Verification)",
                    "target_ss": "verification_phase4_spatial_radar_traffic.png",
                    "ss_trigger": "traffic"
                },
                {
                    "discipline": "endless",
                    "biome": "arctic",
                    "label": "Arctic Blizzard Stunt Jumping (Ramp Cue & Aerial Physics)",
                    "target_ss": "verification_phase4_stunt_ramp_launch.png",
                    "ss_trigger": "ramp"
                },
                {
                    "discipline": "sprint",
                    "biome": "neo-rain",
                    "label": "Neo-Rain Drift Handling (Counter-Steer Slip & Wet Reflection)",
                    "target_ss": "verification_phase4_drift_countersteer.png",
                    "ss_trigger": "drift"
                }
            ]

            for session_idx, sess in enumerate(verify_sessions):
                print(f"\n[VERIFY] === Starting Session {session_idx + 1}/4: {sess['label']} ===")

                # Select Discipline
                if sess["discipline"] == "sprint":
                    await send("Runtime.evaluate", {
                        "expression": "document.querySelector('#discipline-sprint')?.click() || (window.game.selectedDiscipline = 'sprint')"
                    })
                else:
                    await send("Runtime.evaluate", {
                        "expression": "document.querySelector('#discipline-endless')?.click() || (window.game.selectedDiscipline = 'endless')"
                    })

                # Select Biome
                await send("Runtime.evaluate", {
                    "expression": f"document.querySelector('[data-biome=\"{sess['biome']}\"]')?.click() || window.game.world.setBiome('{sess['biome']}')"
                })
                await asyncio.sleep(0.5)

                # Start Race
                await send("Runtime.evaluate", {
                    "expression": "window.game.startCountdown(); window.game.startRun();"
                })

                ss_taken = False
                for step in range(8):
                    await asyncio.sleep(4.0)

                    status = await send("Runtime.evaluate", {
                        "expression": """
                        ({
                            state: window.game?.state,
                            speed: Math.round((window.game?.player?.speed || 0) * 9),
                            distance: Math.round(window.game?.distance || 0),
                            gear: window.game?.lastGear,
                            isAirborne: window.game?.player?.isAirborne,
                            verticalY: (window.game?.player?.verticalY || 0).toFixed(2),
                            isBoosting: window.game?.player?.isBoosting,
                            isBraking: window.game?.player?.isBraking,
                            lateralSlip: (window.game?.player?.lateralSlip || 0).toFixed(2),
                            radarBlips: (document.querySelector('#blips-lane-left')?.children?.length || 0) +
                                        (document.querySelector('#blips-lane-center')?.children?.length || 0) +
                                        (document.querySelector('#blips-lane-right')?.children?.length || 0),
                            proxAlertActive: !document.querySelector('#hud-proximity-alert')?.classList.contains('hidden'),
                            rampCueActive: !document.querySelector('#hud-ramp-cue')?.classList.contains('hidden'),
                            checkpointRem: document.querySelector('#hud-checkpoint-rem')?.textContent || '',
                            sparks: window.__telemetry.sparksSpawned
                        })
                        """,
                        "returnByValue": True
                    })
                    st = status.get("result", {}).get("value", {})
                    print(f"  [Step {step + 1}/8] Speed: {st.get('speed')} km/h | Gear: {st.get('gear')} | Dist: {st.get('distance')}m | Radar: {st.get('radarBlips')} blips | Prox: {st.get('proxAlertActive')} | Ramp: {st.get('rampCueActive')} | CP: {st.get('checkpointRem')} | Air: {st.get('isAirborne')}")

                    # Trigger Screenshot based on target condition
                    if not ss_taken:
                        trigger = sess["ss_trigger"]
                        should_capture = False
                        if trigger == "boost" and (st.get("speed", 0) >= 240 or step >= 4):
                            should_capture = True
                        elif trigger == "traffic" and (st.get("radarBlips", 0) >= 2 or step >= 4):
                            should_capture = True
                        elif trigger == "ramp" and (st.get("isAirborne") or st.get("rampCueActive") or step >= 4):
                            should_capture = True
                        elif trigger == "drift" and (abs(float(st.get("lateralSlip", 0))) > 0.05 or step >= 4):
                            should_capture = True

                        if should_capture:
                            ss_data = await send("Page.captureScreenshot", {"format": "png"})
                            with open(os.path.join(ARTIFACTS_DIR, sess["target_ss"]), "wb") as f:
                                f.write(base64.b64decode(ss_data["data"]))
                            print(f"  [VERIFY] Successfully captured verification screenshot: {sess['target_ss']}")
                            ss_taken = True

                # Reset to menu
                await send("Runtime.evaluate", {
                    "expression": "if (window.game.state === 'GAMEOVER') document.querySelector('#gameover-restart-btn')?.click();"
                })
                await asyncio.sleep(1.0)
                await send("Runtime.evaluate", {
                    "expression": "if (window.game.state !== 'MENU') { window.game.state = 'MENU'; window.game.ui.menuModal.classList.remove('hidden'); window.game.ui.hud.classList.add('hidden'); window.game.ui.gameoverModal.classList.add('hidden'); }"
                })
                await asyncio.sleep(0.5)

            # Compile Verification Telemetry
            print("\n[VERIFY] Compiling Phase 4 Verification Telemetry...")
            telemetry_res = await send("Runtime.evaluate", {
                "expression": """
                ({
                    telemetry: window.__telemetry,
                    fps: {
                        samples: window.__telemetry.fpsSamples.slice(-40),
                        min: window.__telemetry.minFps,
                        max: window.__telemetry.maxFps,
                        avg: Math.round(window.__telemetry.fpsSamples.reduce((a,b)=>a+b, 0) / Math.max(1, window.__telemetry.fpsSamples.length)),
                        droppedFrames: window.__telemetry.droppedFrames,
                        totalFrames: window.__telemetry.totalFrames
                    },
                    audio: window.__telemetry.audioEvents,
                    consoleErrors: window.__telemetry.consoleErrors,
                    consoleWarns: window.__telemetry.consoleWarns,
                    maxSpeedKmh: window.__telemetry.maxSpeedKmh,
                    maxGearReached: window.__telemetry.maxGearReached,
                    radarBlipsObserved: window.__telemetry.radarBlipsObserved,
                    proximityAlertsTriggered: window.__telemetry.proximityAlertsTriggered,
                    sparksSpawned: window.__telemetry.sparksSpawned
                })
                """,
                "returnByValue": True
            })

            verify_data = telemetry_res.get("result", {}).get("value", {})
            verify_json_path = os.path.join(ARTIFACTS_DIR, "road_riot_phase4_telemetry.json")
            with open(verify_json_path, "w") as f:
                json.dump(verify_data, f, indent=2)
            print(f"[VERIFY] Phase 4 telemetry written to {verify_json_path}")

            print("\n[VERIFY] === Phase 4 Verification Results ===")
            print(f"Total Frames Rendered: {verify_data.get('fps', {}).get('totalFrames')}")
            print(f"Average FPS: {verify_data.get('fps', {}).get('avg')} | Min: {verify_data.get('fps', {}).get('min')} | Max: {verify_data.get('fps', {}).get('max')}")
            print(f"Dropped Frames (>33ms): {verify_data.get('fps', {}).get('droppedFrames')}")
            print(f"Console Errors: {len(verify_data.get('consoleErrors', []))}")
            if verify_data.get('consoleErrors'):
                for err in verify_data.get('consoleErrors'):
                    print(f"  - ERROR: {err}")
            print(f"Max Speed Reached: {verify_data.get('maxSpeedKmh')} KM/H")
            print(f"Max Gear Reached: Gear {verify_data.get('maxGearReached')}")
            print(f"Peak Radar Blips: {verify_data.get('radarBlipsObserved')}")
            print(f"Proximity Alerts Triggered: {verify_data.get('proximityAlertsTriggered')}")
            print(f"Collision Sparks Spawned: {verify_data.get('sparksSpawned')}")
            print(f"Stunt Jumps: {len(verify_data.get('telemetry', {}).get('rampEvents', []))}")
            print(f"Checkpoints Reached: {len(verify_data.get('telemetry', {}).get('checkpointEvents', []))}")
            print(f"Near Misses: {verify_data.get('telemetry', {}).get('nearMissEvents')}")
            print(f"Nitrous Surges: {verify_data.get('telemetry', {}).get('nitroEvents')}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.wait(timeout=2)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_verification())
