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

async def run_day02_verification():
    print(f"[DAY02-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
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
        print(f"[DAY02-VERIFY] Connected to CDP at {ws_url}")

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

            # Telemetry instrumentation
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day02Telemetry = {
                    consoleErrors: [],
                    driftSamples: [],
                    weightTransfers: [],
                    recoverySamples: [],
                    maxLateralG: 0,
                    maxSlipAngleDeg: 0,
                    antiSnapbackVerified: false
                };
                window.addEventListener('error', e => {
                    window.__day02Telemetry.consoleErrors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                const origErr = console.error;
                console.error = function(...args) {
                    window.__day02Telemetry.consoleErrors.push({ msg: args.map(String).join(' ') });
                    origErr.apply(console, args);
                };
                """
            })

            print(f"[DAY02-VERIFY] Navigating to {URL}...")
            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(3.0)

            # Select NEO-RAIN Biome and Start Run
            print("[DAY02-VERIFY] Selecting Neo-Rain Biome and launching race...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    // Set Neo-Rain biome
                    document.querySelector("button[data-biome='neotokyo']")?.click();
                    // Start run
                    window.game.startRun();
                })()
                """
            })
            await asyncio.sleep(1.5)

            # TEST 1: High-Speed Cornering & Dynamic Weight Transfer
            print("[DAY02-VERIFY] Executing Test 1: High-Speed Cornering & Pacejka Lateral Friction...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    g.player.speed = 28; // ~252 km/h
                    g.keys.add('ArrowRight');
                    g.keys.add('KeyD');
                })()
                """
            })

            for i in range(8):
                await asyncio.sleep(0.15)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const p = window.game.player;
                        const slipDeg = Math.abs(p.slipAngle * (180 / Math.PI));
                        if (slipDeg > window.__day02Telemetry.maxSlipAngleDeg) {
                            window.__day02Telemetry.maxSlipAngleDeg = slipDeg;
                        }
                        if (p.lateralG > window.__day02Telemetry.maxLateralG) {
                            window.__day02Telemetry.maxLateralG = p.lateralG;
                        }
                        window.__day02Telemetry.weightTransfers.push({
                            speedKmh: Math.round(p.speed * 9),
                            vx: p.vx.toFixed(2),
                            slipDeg: slipDeg.toFixed(1),
                            lateralG: p.lateralG.toFixed(2),
                            fl: p.weightTransfer.fl.toFixed(2),
                            fr: p.weightTransfer.fr.toFixed(2),
                            roll: p.suspensionRoll.toFixed(3)
                        });
                        return window.__day02Telemetry.weightTransfers[window.__day02Telemetry.weightTransfers.length - 1];
                    })()
                    """,
                    "returnByValue": True
                })
                sample = res.get("result", {}).get("value", {})
                if i % 2 == 0:
                    print(f"  [Cornering Step {i}] Spd: {sample.get('speedKmh')} km/h | Slip: {sample.get('slipDeg')} deg | G: {sample.get('lateralG')} | FL: {sample.get('fl')} FR: {sample.get('fr')} | Roll: {sample.get('roll')}")

            # TEST 2: Active Pacejka Drift Entry & Counter-Steer Stabilization
            print("[DAY02-VERIFY] Executing Test 2: Powerslide Drift Initiation & Counter-Steer Assist...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    // Steer left hard while engaging active brake drift
                    g.keys.delete('ArrowRight');
                    g.keys.delete('KeyD');
                    g.keys.add('ArrowLeft');
                    g.keys.add('KeyA');
                    g.keys.add('ArrowDown'); // brake drift trigger
                    g.player.speed = 32; // ~288 km/h entry
                })()
                """
            })

            for i in range(10):
                await asyncio.sleep(0.15)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const p = window.game.player;
                        const slipDeg = Math.abs(p.slipAngle * (180 / Math.PI));
                        if (slipDeg > window.__day02Telemetry.maxSlipAngleDeg) {
                            window.__day02Telemetry.maxSlipAngleDeg = slipDeg;
                        }
                        window.__day02Telemetry.driftSamples.push({
                            isDrifting: p.isDrifting,
                            speedKmh: Math.round(p.speed * 9),
                            vx: p.vx.toFixed(2),
                            slipDeg: slipDeg.toFixed(1),
                            steerAngle: p.steerAngle.toFixed(3),
                            pacejkaMu: p.pacejkaMu.toFixed(2),
                            driftAngle: (p.driftAngle * 180 / Math.PI).toFixed(1)
                        });
                        return window.__day02Telemetry.driftSamples[window.__day02Telemetry.driftSamples.length - 1];
                    })()
                    """,
                    "returnByValue": True
                })
                sample = res.get("result", {}).get("value", {})
                if i % 3 == 0:
                    print(f"  [Drift Step {i}] Drifting: {sample.get('isDrifting')} | Spd: {sample.get('speedKmh')} km/h | Slip: {sample.get('slipDeg')} deg | Mu: {sample.get('pacejkaMu')} | Steer: {sample.get('steerAngle')} | Yaw: {sample.get('driftAngle')} deg")

            # Capture Drift Screenshot
            ss_drift = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day02_pacejka_drift_countersteer.png"), "wb") as f:
                f.write(base64.b64decode(ss_drift["data"]))
            print("[DAY02-VERIFY] Captured day02_pacejka_drift_countersteer.png")

            # TEST 3: Anti-Snapback Smooth Recovery (Release drift and center)
            print("[DAY02-VERIFY] Executing Test 3: Anti-Snapback Drift Recovery Damping...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    // Release all steering and braking to enter neutral recovery
                    g.keys.delete('ArrowLeft');
                    g.keys.delete('KeyA');
                    g.keys.delete('ArrowDown');
                    g.keys.delete('s');
                })()
                """
            })

            prevYawSign = None
            snapbackDetected = False
            for i in range(8):
                await asyncio.sleep(0.08)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const p = window.game.player;
                        window.__day02Telemetry.recoverySamples.push({
                            exitTimer: p.driftExitTimer.toFixed(3),
                            vx: p.vx.toFixed(2),
                            yaw: (p.mesh.rotation.y * 180 / Math.PI).toFixed(2),
                            roll: p.suspensionRoll.toFixed(3)
                        });
                        return window.__day02Telemetry.recoverySamples[window.__day02Telemetry.recoverySamples.length - 1];
                    })()
                    """,
                    "returnByValue": True
                })
                sample = res.get("result", {}).get("value", {})
                yawVal = float(sample.get("yaw", 0))
                if i > 2 and abs(yawVal) > 1.5 and prevYawSign is not None and (yawVal > 0) != prevYawSign:
                    snapbackDetected = True
                prevYawSign = yawVal > 0
                if i % 2 == 0:
                    print(f"  [Recovery Step {i}] Timer: {sample.get('exitTimer')}s | Vx: {sample.get('vx')} | Yaw: {sample.get('yaw')} deg | Roll: {sample.get('roll')}")

            # Capture Recovery Screenshot
            ss_recovery = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day02_anti_snapback_recovery.png"), "wb") as f:
                f.write(base64.b64decode(ss_recovery["data"]))
            print("[DAY02-VERIFY] Captured day02_anti_snapback_recovery.png")

            # Extract full telemetry
            results = await send("Runtime.evaluate", {
                "expression": """
                ({
                    maxLateralG: window.__day02Telemetry.maxLateralG,
                    maxSlipAngleDeg: window.__day02Telemetry.maxSlipAngleDeg,
                    sampleWeightTransfer: window.__day02Telemetry.weightTransfers.slice(-4),
                    sampleDrift: window.__day02Telemetry.driftSamples.slice(-4),
                    sampleRecovery: window.__day02Telemetry.recoverySamples,
                    snapbackDetected: false,
                    consoleErrors: window.__day02Telemetry.consoleErrors
                })
                """,
                "returnByValue": True
            })

            data = results.get("result", {}).get("value", {})
            data["snapbackDetected"] = snapbackDetected
            data["antiSnapbackVerified"] = not snapbackDetected

            print("\n=======================================================")
            print("[DAY02-VERIFY] DAY 02 VERIFICATION SUMMARY")
            print("=======================================================")
            print(f"Peak Lateral G-Force: {data.get('maxLateralG'):.2f} G")
            print(f"Peak Tire Slip Angle: {data.get('maxSlipAngleDeg'):.1f} deg")
            print(f"Drift Samples Logged: {len(data.get('sampleDrift', []))}")
            print(f"Snapback Detected: {data.get('snapbackDetected')} (Anti-Snapback Verified: {data.get('antiSnapbackVerified')})")
            print(f"Console Errors: {len(data.get('consoleErrors', []))}")
            if data.get('consoleErrors'):
                for err in data.get('consoleErrors'):
                    print(f"  [ERROR] {err}")
            print("=======================================================\n")

            with open(os.path.join(ARTIFACTS_DIR, "road_riot_day02_verification_telemetry.json"), "w") as f:
                json.dump(data, f, indent=2)

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.wait(timeout=3)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_day02_verification())
