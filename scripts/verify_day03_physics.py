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

async def run_day03_verification():
    print(f"[DAY03-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
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
        print(f"[DAY03-VERIFY] Connected to CDP at {ws_url}")

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

            # Telemetry instrumentation
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day03Telemetry = {
                    consoleErrors: [],
                    gearProgression: [],
                    dctShiftCuts: [],
                    revMatchEvents: [],
                    brakeThermalFade: []
                };
                window.addEventListener('error', e => {
                    window.__day03Telemetry.consoleErrors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(3.5)

            # Start game in Endless mode
            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#start-btn').click()"
            })
            await asyncio.sleep(1.0)

            # --- TEST 1: Full Dyno Acceleration through Gears 1 to 6 ---
            print("[DAY03-VERIFY] Running full-throttle acceleration test (Gears 1 to 6)...")
            await send("Input.dispatchKeyEvent", {"type": "keyDown", "code": "KeyW", "key": "w"})
            await send("Input.dispatchKeyEvent", {"type": "keyDown", "code": "ShiftLeft", "key": "Shift"})

            # Sample gear progression every 200ms
            for step in range(35):
                await asyncio.sleep(0.2)
                sample = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || !g.player) return null;
                        const pt = g.player.getPowertrainTelemetry ? g.player.getPowertrainTelemetry() : {};
                        const at = g.audio && g.audio.getTransmissionTelemetry ? g.audio.getTransmissionTelemetry() : {};
                        return {
                            t: (performance.now() / 1000).toFixed(2),
                            speedKmH: Math.round(g.player.speed * 9.0),
                            gear: pt.gear || at.currentGear || 1,
                            rpm: Math.round(pt.rpm || at.currentRpm || 1000),
                            isDctCut: pt.isDctCut || at.isShiftCut || false,
                            rotorTemp: Math.round(pt.brakeRotorTemp || 45),
                            fadeFactor: (pt.brakeFadeFactor || 1.0).toFixed(3)
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                val = sample.get("result", {}).get("value")
                if val:
                    # Record unique gear shifts or cuts
                    if val.get("isDctCut"):
                        print(f" -> DCT Cut active at {val['speedKmH']} km/h (Gear {val['gear']}, RPM {val['rpm']})")
                    if not any(s["gear"] == val["gear"] for s in val.get("gearProgression", [])):
                        print(f" -> Gear engaged: Gear {val['gear']} @ {val['speedKmH']} km/h")

            # Capture high-speed upshift screenshot
            snap1 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day03_dct_gear_upshift.png"), "wb") as f:
                f.write(base64.b64decode(snap1["data"]))
            print("[DAY03-VERIFY] Saved screenshot: day03_dct_gear_upshift.png")

            # Release throttle
            await send("Input.dispatchKeyEvent", {"type": "keyUp", "code": "KeyW", "key": "w"})
            await send("Input.dispatchKeyEvent", {"type": "keyUp", "code": "ShiftLeft", "key": "Shift"})
            await asyncio.sleep(0.5)

            # --- TEST 2: Heavy Ceramic Braking & Downshift Rev-Matching ---
            print("[DAY03-VERIFY] Running heavy ceramic braking and downshift rev-match test...")
            await send("Input.dispatchKeyEvent", {"type": "keyDown", "code": "KeyS", "key": "s"})
            await send("Input.dispatchKeyEvent", {"type": "keyDown", "code": "Space", "key": " "})

            brake_samples = []
            for step in range(30):
                await asyncio.sleep(0.2)
                sample = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || !g.player) return null;
                        const pt = g.player.getPowertrainTelemetry ? g.player.getPowertrainTelemetry() : {};
                        const at = g.audio && g.audio.getTransmissionTelemetry ? g.audio.getTransmissionTelemetry() : {};
                        return {
                            t: (performance.now() / 1000).toFixed(2),
                            speedKmH: Math.round(g.player.speed * 9.0),
                            gear: pt.gear || at.currentGear || 1,
                            rpm: Math.round(pt.rpm || at.currentRpm || 1000),
                            revMatchActive: (pt.revMatchTimer || 0) > 0 || (at.revMatchTimer || 0) > 0,
                            rotorTemp: Math.round(pt.brakeRotorTemp || 45),
                            fadeFactor: (pt.brakeFadeFactor || 1.0).toFixed(3)
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                val = sample.get("result", {}).get("value")
                if val:
                    brake_samples.append(val)
                    if val.get("revMatchActive"):
                        print(f" -> Downshift Rev-Match blip at {val['speedKmH']} km/h into Gear {val['gear']} (+RPM surge)")
                    if val.get("rotorTemp", 0) > 400:
                        print(f" -> Rotor Temp: {val['rotorTemp']}°C (Fade Factor: {val['fadeFactor']})")

            # Release brake
            await send("Input.dispatchKeyEvent", {"type": "keyUp", "code": "KeyS", "key": "s"})
            await send("Input.dispatchKeyEvent", {"type": "keyUp", "code": "Space", "key": " "})

            # Capture braking screenshot
            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day03_downshift_rev_match_braking.png"), "wb") as f:
                f.write(base64.b64decode(snap2["data"]))
            print("[DAY03-VERIFY] Saved screenshot: day03_downshift_rev_match_braking.png")

            # Retrieve final summary
            final_telemetry = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const g = window.game;
                    return {
                        powertrain: g.player.getPowertrainTelemetry ? g.player.getPowertrainTelemetry() : {},
                        transmission: g.audio && g.audio.getTransmissionTelemetry ? g.audio.getTransmissionTelemetry() : {},
                        errors: window.__day03Telemetry.consoleErrors
                    };
                })()
                """,
                "returnByValue": True
            })
            res_data = final_telemetry.get("result", {}).get("value", {})
            res_data["brakeSamples"] = brake_samples

            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day03_verification_telemetry.json")
            with open(telemetry_path, "w") as f:
                json.dump(res_data, f, indent=2)
            print(f"[DAY03-VERIFY] Saved telemetry JSON to: {telemetry_path}")
            print(f"[DAY03-VERIFY] Errors discovered: {len(res_data.get('errors', []))}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.kill()
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(run_day03_verification())
