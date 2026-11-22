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

async def run_audit():
    print(f"[AUDIT] Starting Chrome headless on port {CDP_PORT}...")
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
        print(f"[AUDIT] Connected to CDP at {ws_url}")

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

            # 1. Setup in-browser telemetry agent
            print("[AUDIT] Injecting telemetry and autonomous pilot harness...")
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
                    damageTaken: 0,
                    coinsCollected: 0,
                    upgradesPurchased: 0,
                    totalFrames: 0,
                    lastFrameTime: performance.now(),
                    frameCount: 0,
                    minFps: 999,
                    maxFps: 0,
                    droppedFrames: 0
                };

                // Capture all console calls
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

                // FPS & delta tracker
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

            # 2. Navigate to Road Riot
            print(f"[AUDIT] Navigating to {URL}...")
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(4.0)

            # 3. Intercept audio calls and bind telemetry hooks once game is initialized
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
                    // Hook into near misses
                    const origToast = window.game.toast.bind(window.game);
                    window.game.toast = function(msg, type) {
                        if (msg && msg.includes('NEAR MISS')) window.__telemetry.nearMissEvents++;
                        if (msg && msg.includes('CHECKPOINT')) window.__telemetry.checkpointEvents.push(msg);
                        if (msg && msg.includes('COLLISION')) window.__telemetry.collisionEvents.push(msg);
                        return origToast(msg, type);
                    };
                })()
                """
            })

            # Check initial load status
            init_eval = await send("Runtime.evaluate", {
                "expression": "({ state: window.game?.state, assetsLoaded: Boolean(window.game?.assetPrototypes?.apex), coins: window.game?.progression?.data?.coins, selectedVehicle: window.game?.progression?.data?.selectedVehicle })",
                "returnByValue": True
            })
            print("[AUDIT] Initial Game Status:", init_eval.get("result", {}).get("value"))

            # Capture Screenshot: Main Menu (Sanitized, Rock-Solid 3/4 Hero View)
            menu_ss = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "audit_phase1_menu.png"), "wb") as f:
                f.write(base64.b64decode(menu_ss["data"]))
            print("[AUDIT] Saved audit_phase1_menu.png")

            # 4. Phase 1 Session 1: Showroom & Garage Inspection, Dyno Benchmark, Tuning Upgrades
            print("[AUDIT] Testing Garage Showroom, Tuning Upgrades, Paint Swatches, and Dyno...")
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#garage-btn')?.click() || window.game.openGarage()"
            })
            await asyncio.sleep(1.5)

            # Browse through all 6 supercars in the Showroom
            for i in range(6):
                await send("Runtime.evaluate", {
                    "expression": f"document.querySelectorAll('.garage-card')[{i}]?.click()"
                })
                await asyncio.sleep(0.4)

            # Test Dyno Benchmark button
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#garage-dyno-btn')?.click()"
            })
            await asyncio.sleep(1.2)

            # Capture Screenshot: Showroom Dyno Test
            dyno_ss = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "audit_phase1_garage_dyno.png"), "wb") as f:
                f.write(base64.b64decode(dyno_ss["data"]))
            print("[AUDIT] Saved audit_phase1_garage_dyno.png")

            # Close Garage & Return to Menu
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#garage-close-btn')?.click() || window.game.closeGarage()"
            })
            await asyncio.sleep(0.8)

            # 5. Multi-Discipline & Biome Autonomous Driving Engine
            # Inject autonomous pilot AI
            await send("Runtime.evaluate", {
                "expression": """
                window.__pilot = {
                    enabled: true,
                    mode: 'racing',
                    runsCompleted: 0,
                    targetLane: 0,
                    nitroCooldown: 0,
                    brakeCooldown: 0,
                    steerTimer: 0,
                    updatePilot: function() {
                        if (!this.enabled || !window.game || window.game.state !== 'RUNNING') return;
                        const g = window.game;
                        const p = g.player;
                        const t = g.traffic;

                        // 1. Scan for hazards ahead (within 55m)
                        const currentX = p.x;
                        const currentZ = p.mesh.position.z;
                        const lanes = [-6, 0, 6];

                        // Evaluate lane danger scores
                        const laneScores = { '-6': 0, '0': 0, '6': 0 };

                        // Add danger for vehicles in lane
                        t.vehicles.forEach(v => {
                            const relZ = v.mesh.position.z - currentZ;
                            if (relZ < 0 && relZ > -65) {
                                const dist = -relZ;
                                const weight = (65 - dist) / 65;
                                [-6, 0, 6].forEach(lane => {
                                    if (Math.abs(v.mesh.position.x - lane) < 2.4) {
                                        laneScores[lane] += weight * 4.0;
                                    }
                                });
                            }
                        });

                        // Add danger for obstacles in lane
                        t.obstacles.forEach(o => {
                            const relZ = o.mesh.position.z - currentZ;
                            if (relZ < 0 && relZ > -60) {
                                const dist = -relZ;
                                const weight = (60 - dist) / 60;
                                [-6, 0, 6].forEach(lane => {
                                    if (Math.abs(o.mesh.position.x - lane) < 2.2) {
                                        laneScores[lane] += weight * 5.0;
                                    }
                                });
                            }
                        });

                        // Seek stunt jump ramps for bonus airtime!
                        if (t.jumpRamps) {
                            t.jumpRamps.forEach(r => {
                                const rz = r.parent.position.z + r.mesh.position.z;
                                const relZ = rz - currentZ;
                                if (relZ < 0 && relZ > -50) {
                                    // Highly prioritize jumping the ramp if lane is safe
                                    if (laneScores[r.lane] < 2.0) {
                                        laneScores[r.lane] -= 3.5;
                                    }
                                }
                            });
                        }

                        // Pick best lane
                        let bestLane = 0;
                        let minScore = 999;
                        lanes.forEach(l => {
                            const score = laneScores[l] + (Math.abs(l - currentX) * 0.15);
                            if (score < minScore) {
                                minScore = score;
                                bestLane = l;
                            }
                        });

                        // Autonomous Steering
                        const laneDiff = bestLane - currentX;
                        if (Math.abs(laneDiff) > 0.45) {
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

                        // Emergency Ceramic Braking when pinned in danger
                        const currentLaneScore = laneScores[Math.round(currentX / 6) * 6] || 0;
                        if (currentLaneScore >= 3.2 && minScore >= 2.5) {
                            g.keys.add('ArrowDown');
                            window.__telemetry.brakeEvents++;
                        } else {
                            g.keys.delete('ArrowDown');
                        }

                        // Tactical Nitrous Boost on open roads
                        if (minScore <= 0.5 && p.nitro >= 25 && !p.isAirborne && !g.keys.has('ArrowDown')) {
                            g.keys.add('ShiftLeft');
                            window.__telemetry.nitroEvents++;
                        } else {
                            g.keys.delete('ShiftLeft');
                        }
                    }
                };

                // Pilot loop tick
                setInterval(() => window.__pilot.updatePilot(), 50);
                """
            })

            # Run test matrix across biomes & disciplines:
            test_matrix = [
                {"discipline": "sprint", "biome": "midnight", "desc": "Sprint 1500m Dash in Midnight"},
                {"discipline": "endless", "biome": "sunset", "desc": "Endless Highway High-Density Traffic in Sunset"},
                {"discipline": "sprint", "biome": "neo-rain", "desc": "Sprint 1500m Rain & Wet Reflection Test"},
                {"discipline": "endless", "biome": "arctic", "desc": "Endless Arctic Blizzard Stunt Ramp Test"}
            ]

            screenshots_captured = []

            for run_idx, test_case in enumerate(test_matrix):
                print(f"\n[AUDIT] === Executing Run {run_idx + 1}/4: {test_case['desc']} ===")

                # Select Discipline
                if test_case["discipline"] == "sprint":
                    await send("Runtime.evaluate", {
                        "expression": "document.querySelector('#discipline-sprint')?.click() || (window.game.selectedDiscipline = 'sprint')"
                    })
                else:
                    await send("Runtime.evaluate", {
                        "expression": "document.querySelector('#discipline-endless')?.click() || (window.game.selectedDiscipline = 'endless')"
                    })

                # Select Biome
                await send("Runtime.evaluate", {
                    "expression": f"document.querySelector('[data-biome=\"{test_case['biome']}\"]')?.click() || window.game.world.setBiome('{test_case['biome']}')"
                })
                await asyncio.sleep(0.5)

                # Start Race
                print(f"[AUDIT] Starting race for Run {run_idx + 1}...")
                await send("Runtime.evaluate", {
                    "expression": "window.game.startCountdown(); window.game.startRun();"
                })

                # Simulate driving session for this run
                # Monitor gameplay telemetry at 5-second intervals
                for step in range(6):
                    await asyncio.sleep(5.0)
                    status = await send("Runtime.evaluate", {
                        "expression": """
                        ({
                            state: window.game?.state,
                            speed: Math.round((window.game?.player?.speed || 0) * 9),
                            distance: Math.round(window.game?.distance || 0),
                            score: window.game?.score,
                            coins: window.game?.coins,
                            hull: Math.round(window.game?.player?.hull || 0),
                            gear: window.game?.lastGear,
                            isAirborne: window.game?.player?.isAirborne,
                            verticalY: (window.game?.player?.verticalY || 0).toFixed(2),
                            isBoosting: window.game?.player?.isBoosting,
                            isBraking: window.game?.player?.isBraking,
                            vehiclesAhead: window.game?.traffic?.vehicles?.length || 0
                        })
                        """,
                        "returnByValue": True
                    })
                    st = status.get("result", {}).get("value", {})
                    print(f"  [Step {step + 1}/6] Speed: {st.get('speed')} km/h | Dist: {st.get('distance')}m | Hull: {st.get('hull')} | Gear: {st.get('gear')} | Air: {st.get('isAirborne')} (Y:{st.get('verticalY')}) | Boost: {st.get('isBoosting')} | Brake: {st.get('isBraking')}")

                    # Capture in-action screenshot during high-speed drive
                    if step == 3:
                        ss_name = f"audit_phase1_run_{test_case['biome']}_{test_case['discipline']}.png"
                        ss_path = os.path.join(ARTIFACTS_DIR, ss_name)
                        in_action_ss = await send("Page.captureScreenshot", {"format": "png"})
                        with open(ss_path, "wb") as f:
                            f.write(base64.b64decode(in_action_ss["data"]))
                        screenshots_captured.append(ss_name)
                        print(f"  [AUDIT] Captured action screenshot: {ss_name}")

                # If game reached gameover or completed, restart to menu
                await send("Runtime.evaluate", {
                    "expression": "if (window.game.state === 'GAMEOVER') document.querySelector('#gameover-restart-btn')?.click();"
                })
                await asyncio.sleep(1.0)
                # Ensure back in menu for next discipline
                await send("Runtime.evaluate", {
                    "expression": "if (window.game.state !== 'MENU') { window.game.state = 'MENU'; window.game.ui.menuModal.classList.remove('hidden'); window.game.ui.hud.classList.add('hidden'); window.game.ui.gameoverModal.classList.add('hidden'); }"
                })
                await asyncio.sleep(0.5)

            # 6. Gather Complete Telemetry Snapshot
            print("\n[AUDIT] Compiling complete audit telemetry...")
            telemetry_res = await send("Runtime.evaluate", {
                "expression": """
                ({
                    telemetry: window.__telemetry,
                    fps: {
                        samples: window.__telemetry.fpsSamples.slice(-30),
                        min: window.__telemetry.minFps,
                        max: window.__telemetry.maxFps,
                        avg: Math.round(window.__telemetry.fpsSamples.reduce((a,b)=>a+b, 0) / Math.max(1, window.__telemetry.fpsSamples.length)),
                        droppedFrames: window.__telemetry.droppedFrames,
                        totalFrames: window.__telemetry.totalFrames
                    },
                    audio: window.__telemetry.audioEvents,
                    consoleErrors: window.__telemetry.consoleErrors,
                    consoleWarns: window.__telemetry.consoleWarns,
                    coins: window.game?.progression?.data?.coins,
                    unlockedVehicles: window.game?.progression?.data?.unlockedVehicles,
                    achievementsClaimed: Object.keys(window.game?.progression?.data?.achievements || {}).length,
                    playerStats: {
                        topSpeed: window.game?.player?.topSpeed,
                        maxHull: window.game?.player?.maxHull,
                        handling: window.game?.player?.handling
                    }
                })
                """,
                "returnByValue": True
            })

            audit_data = telemetry_res.get("result", {}).get("value", {})

            # Save full audit data to JSON
            audit_json_path = os.path.join(ARTIFACTS_DIR, "road_riot_audit_telemetry.json")
            with open(audit_json_path, "w") as f:
                json.dump(audit_data, f, indent=2)
            print(f"[AUDIT] Audit telemetry saved to {audit_json_path}")

            print("\n[AUDIT] === Phase 1 Audit Summary ===")
            print(f"Total Frames Rendered: {audit_data.get('fps', {}).get('totalFrames')}")
            print(f"Average FPS: {audit_data.get('fps', {}).get('avg')} | Min: {audit_data.get('fps', {}).get('min')} | Max: {audit_data.get('fps', {}).get('max')}")
            print(f"Dropped Frames (>33ms): {audit_data.get('fps', {}).get('droppedFrames')}")
            print(f"Console Errors: {len(audit_data.get('consoleErrors', []))}")
            if audit_data.get('consoleErrors'):
                for err in audit_data.get('consoleErrors'):
                    print(f"  - ERROR: {err}")
            print(f"Console Warns: {len(audit_data.get('consoleWarns', []))}")
            print(f"Audio SFX Plays: {json.dumps(audit_data.get('audio', {}), indent=2)}")
            print(f"Near Miss Events: {audit_data.get('telemetry', {}).get('nearMissEvents')}")
            print(f"Nitrous Surges: {audit_data.get('telemetry', {}).get('nitroEvents')}")
            print(f"Ceramic Braking Events: {audit_data.get('telemetry', {}).get('brakeEvents')}")
            print(f"Collision Events: {len(audit_data.get('telemetry', {}).get('collisionEvents', []))}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.wait(timeout=2)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_audit())
