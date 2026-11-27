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


async def run_day04_verification():
    print(f"[DAY04-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=844,390",
        "--autoplay-policy=no-user-gesture-required"
    ])

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
            targets = json.loads(resp.read().decode())
        page_target = next(t for t in targets if t.get("type") == "page")
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"[DAY04-VERIFY] Connected to CDP at {ws_url}")

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
            await send("Emulation.setDeviceMetricsOverride", {
                "width": 844,
                "height": 390,
                "deviceScaleFactor": 2,
                "mobile": True,
                "screenOrientation": {"type": "landscapePrimary", "angle": 90}
            })
            await send("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})

            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day04Errors = [];
                window.__vibrateLog = [];
                window.__rumbleLog = [];
                window.addEventListener('error', e => {
                    window.__day04Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                try {
                    navigator.vibrate = (pat) => { window.__vibrateLog.push(pat); return true; };
                } catch (e) {}
                """
            })

            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(3.0)

            # Force mobile controls display for verification & start run
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const mc = document.querySelector('#mobile-controls');
                    if (mc) mc.style.display = 'flex';
                    document.querySelector('#start-btn').click();
                })()
                """
            })
            await asyncio.sleep(2.5)
            # Poll until game reaches RUNNING state (after 3-2-1-GO countdown)
            for _ in range(30):
                st = await send("Runtime.evaluate", {"expression": "window.game?.state", "returnByValue": True})
                if st.get("result", {}).get("value") == "RUNNING":
                    break
                await asyncio.sleep(0.35)

            # --- TEST 1: Virtual Floating Steering Joystick + Multi-Touch Isolation ---
            joy_test = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const zone = document.querySelector('#touch-joystick-zone');
                    const boostBtn = document.querySelector('.boost-btn');
                    const zr = zone.getBoundingClientRect();
                    const br = boostBtn.getBoundingClientRect();
                    const ox = zr.left + zr.width * 0.45;
                    const oy = zr.top + zr.height * 0.55;

                    zone.dispatchEvent(new PointerEvent('pointerdown', {
                        pointerId: 11, clientX: ox, clientY: oy, bubbles: true, cancelable: true
                    }));
                    zone.dispatchEvent(new PointerEvent('pointermove', {
                        pointerId: 11, clientX: ox + 42, clientY: oy - 6, bubbles: true, cancelable: true
                    }));
                    boostBtn.dispatchEvent(new PointerEvent('pointerdown', {
                        pointerId: 12, clientX: br.left + 20, clientY: br.top + 20, bubbles: true, cancelable: true
                    }));
                    return window.game.getInputTelemetry();
                })()
                """,
                "returnByValue": True
            })
            joy_telemetry = joy_test.get("result", {}).get("value", {})
            print("[DAY04-VERIFY] Active multi-touch joystick telemetry:", json.dumps(joy_telemetry, indent=2))

            await asyncio.sleep(0.35)
            snap1 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day04_mobile_virtual_joystick.png"), "wb") as f:
                f.write(base64.b64decode(snap1["data"]))
            print("[DAY04-VERIFY] Saved screenshot: day04_mobile_virtual_joystick.png")

            # Release NITRO pointer (12) while holding joystick (11), then fire pointercancel on joystick (11)
            cancel_test = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const zone = document.querySelector('#touch-joystick-zone');
                    const boostBtn = document.querySelector('.boost-btn');
                    boostBtn.dispatchEvent(new PointerEvent('pointerup', {
                        pointerId: 12, bubbles: true, cancelable: true
                    }));
                    const afterBoostLift = {
                        joystickActiveWhileNitroReleased: window.game.getInputTelemetry().joystick.active,
                        joystickSteerWhileNitroReleased: window.game.getInputTelemetry().joystick.steer,
                        heldKeysAfterNitroLift: window.game.getInputTelemetry().heldKeys
                    };
                    zone.dispatchEvent(new PointerEvent('pointercancel', {
                        pointerId: 11, bubbles: true, cancelable: true
                    }));
                    const afterJoyCancel = window.game.getInputTelemetry();
                    return { afterBoostLift, afterJoyCancel };
                })()
                """,
                "returnByValue": True
            })
            cancel_telemetry = cancel_test.get("result", {}).get("value", {})
            print("[DAY04-VERIFY] Multi-touch & pointercancel cleanup:", json.dumps(cancel_telemetry, indent=2))

            # --- TEST 2: HTML5 Gamepad API Analog Stick, RT/LT Progressive Triggers & Dual-Rumble ---
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.__mockPad = {
                        connected: true,
                        id: 'Valixis Pro Racing Pad (STANDARD GAMEPAD)',
                        axes: [-0.55, 0, 0, 0],
                        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
                        vibrationActuator: {
                            playEffect: (type, opts) => {
                                window.__rumbleLog.push({ type, ...opts });
                                return Promise.resolve('complete');
                            }
                        }
                    };
                    window.__mockPad.buttons[7] = { pressed: true, value: 0.85 }; // RT throttle
                    window.__mockPad.buttons[6] = { pressed: true, value: 0.45 }; // LT progressive brake/drift
                    Object.defineProperty(navigator, 'getGamepads', {
                        configurable: true,
                        value: () => [window.__mockPad]
                    });
                    window.dispatchEvent(new Event('gamepadconnected'));
                })()
                """
            })
            await asyncio.sleep(0.5)

            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day04_gamepad_hud_active.png"), "wb") as f:
                f.write(base64.b64decode(snap2["data"]))
            print("[DAY04-VERIFY] Saved screenshot: day04_gamepad_hud_active.png")

            final_res = await send("Runtime.evaluate", {
                "expression": """
                (() => ({
                    gameState: window.game.state,
                    inputTelemetry: window.game.getInputTelemetry(),
                    gamepadBadgeVisible: !document.querySelector('#hud-gamepad-badge')?.classList.contains('hidden'),
                    vibrateCount: window.__vibrateLog.length,
                    rumbleCount: window.__rumbleLog.length,
                    sampleRumbles: window.__rumbleLog.slice(0, 6),
                    errors: window.__day04Errors
                }))()
                """,
                "returnByValue": True
            })
            summary = final_res.get("result", {}).get("value", {})
            summary["touchJoystickCapture"] = joy_telemetry
            summary["touchCancelVerification"] = cancel_telemetry

            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day04_verification_telemetry.json")
            with open(telemetry_path, "w") as f:
                json.dump(summary, f, indent=2)
            print(f"[DAY04-VERIFY] Saved telemetry JSON to: {telemetry_path}")
            print(f"[DAY04-VERIFY] Gamepad Badge Visible: {summary.get('gamepadBadgeVisible')}, Rumble Fires: {summary.get('rumbleCount')}, Errors: {len(summary.get('errors', []))}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.kill()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(run_day04_verification())
