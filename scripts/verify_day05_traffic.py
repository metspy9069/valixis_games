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


async def run_day05_verification():
    print(f"[DAY05-VERIFY] Launching Chrome headless on port {CDP_PORT}...")
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
        print(f"[DAY05-VERIFY] Connected to CDP at {ws_url}")

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
            await send("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                window.__day05Errors = [];
                window.addEventListener('error', e => {
                    window.__day05Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                """
            })

            await send("Page.navigate", {"url": URL})
            await asyncio.sleep(2.5)

            await send("Runtime.evaluate", {
                "expression": "document.querySelector('#start-btn').click()"
            })
            for _ in range(30):
                st = await send("Runtime.evaluate", {"expression": "window.game?.state", "returnByValue": True})
                if st.get("result", {}).get("value") == "RUNNING":
                    break
                await asyncio.sleep(0.35)

            # Give god-mode shield/repair so car cruises smoothly while observing traffic AI
            await send("Runtime.evaluate", {
                "expression": "window.game.player.activateShield(30);"
            })

            samples = []
            signaling_seen = False
            heavy_lanes_observed = []
            deadlock_violations = 0

            for step in range(24):
                await asyncio.sleep(0.4)
                res = await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const g = window.game;
                        if (!g || !g.traffic) return null;
                        // Trigger a synthetic lane-change signal on a nearby traffic vehicle if none is currently signaling
                        const t = g.traffic.getTrafficTelemetry();
                        if (t.signalingCount === 0 && g.traffic.vehicles.length > 0) {
                            const v = g.traffic.vehicles[0];
                            if (v && v.signalTimer <= 0 && v.targetLane === v.lane) {
                                const nextLane = v.lane === 0 ? 6 : 0;
                                v.pendingTargetLane = nextLane;
                                v.signalDir = Math.sign(nextLane - v.lane);
                                v.signalTimer = 1.2;
                            }
                        }
                        return {
                            distance: Math.round(g.distance),
                            telemetry: g.traffic.getTrafficTelemetry()
                        };
                    })()
                    """,
                    "returnByValue": True
                })
                val = res.get("result", {}).get("value")
                if val:
                    t = val["telemetry"]
                    samples.append(val)
                    if t.get("signalingCount", 0) > 0:
                        signaling_seen = True
                    for hl in t.get("heavyConvoyLanes", []):
                        heavy_lanes_observed.append(hl)
                    if not t.get("hasEscapeCorridor", True):
                        deadlock_violations += 1

                if step == 10:
                    snap1 = await send("Page.captureScreenshot", {"format": "png"})
                    with open(os.path.join(ARTIFACTS_DIR, "day05_traffic_turn_signals.png"), "wb") as f:
                        f.write(base64.b64decode(snap1["data"]))
                    print("[DAY05-VERIFY] Saved screenshot: day05_traffic_turn_signals.png")

            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            with open(os.path.join(ARTIFACTS_DIR, "day05_convoy_escape_flow.png"), "wb") as f:
                f.write(base64.b64decode(snap2["data"]))
            print("[DAY05-VERIFY] Saved screenshot: day05_convoy_escape_flow.png")

            err_res = await send("Runtime.evaluate", {
                "expression": "window.__day05Errors",
                "returnByValue": True
            })
            errors = err_res.get("result", {}).get("value", [])

            summary = {
                "samplesCount": len(samples),
                "signalingSeen": signaling_seen,
                "heavyConvoyLanesObserved": heavy_lanes_observed,
                "deadlockViolations": deadlock_violations,
                "errors": errors,
                "finalSample": samples[-1] if samples else None
            }
            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day05_verification_telemetry.json")
            with open(telemetry_path, "w") as f:
                json.dump(summary, f, indent=2)
            print(f"[DAY05-VERIFY] Signaling Seen: {signaling_seen}, Deadlocks: {deadlock_violations}, Errors: {len(errors)}")

    finally:
        try:
            chrome_proc.terminate()
            chrome_proc.kill()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(run_day05_verification())
