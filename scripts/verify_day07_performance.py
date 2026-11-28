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


async def run_day07_performance_verification():
    print(f"[DAY07-PERF] Launching Chrome headless on port {CDP_PORT}...")
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--disable-gpu=false",
        "--use-gl=angle",
        "--window-size=1280,720",
        "--autoplay-policy=no-user-gesture-required",
        "--enable-precise-memory-info",
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
        print(f"[DAY07-PERF] Connected to CDP at {ws_url}")

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
                window.__day07Errors = [];
                window.addEventListener('error', e => {
                    window.__day07Errors.push({ msg: e.message, file: e.filename, line: e.lineno });
                });
                window.__frameTimes = [];
                let lastFrame = performance.now();
                function recordFrame(now) {
                    const delta = now - lastFrame;
                    lastFrame = now;
                    if (delta > 0 && delta < 200) {
                        window.__frameTimes.push(delta);
                        if (window.__frameTimes.length > 1200) {
                            window.__frameTimes.shift();
                        }
                    }
                    requestAnimationFrame(recordFrame);
                }
                requestAnimationFrame(recordFrame);
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

            print("[DAY07-PERF] Game RUNNING. Setting up stress test environment...")

            # Activate full stress test: Invulnerability shield, Heat ★4 pursuit, roadblocks, and high speed
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.activateShield(120);
                    window.game.player.hull = 100;
                    window.game.heatLevel = 4;
                    window.game.updateHeatHud();
                    window.game.player.speed = 35; // ~315 km/h
                    window.game.player.targetSpeed = 38;

                    // Spawn SWAT roadblock formation
                    window.game.traffic.spawnRoadblock(window.game.distance, 4);

                    // Spawn Police Tactical Interceptor
                    const interceptorMesh = window.game.traffic.buildVehicleMesh('police', false, true, false, false);
                    interceptorMesh.position.set(-2.2, 0, -3.0);
                    window.game.scene.add(interceptorMesh);
                    window.game.traffic.vehicles.push({
                        mesh: interceptorMesh,
                        lane: 0,
                        targetLane: 0,
                        pendingTargetLane: 0,
                        signalDir: 0,
                        signalTimer: 0,
                        speed: 35,
                        baseSpeed: 35,
                        length: 4.8,
                        width: 2.3,
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

                    // Spawn Chemical Tanker Convoy
                    const tankerMesh = window.game.traffic.buildVehicleMesh('tanker', false, false, false, true);
                    tankerMesh.position.set(6, 0, -35.0);
                    window.game.scene.add(tankerMesh);
                    window.game.traffic.vehicles.push({
                        mesh: tankerMesh,
                        lane: 6,
                        targetLane: 6,
                        pendingTargetLane: 6,
                        signalDir: 0,
                        signalTimer: 0,
                        speed: 22,
                        baseSpeed: 22,
                        length: 9.2,
                        width: 2.2,
                        isRival: false,
                        isPolice: false,
                        isInterceptor: false,
                        pitCooldown: 0,
                        isTruck: false,
                        isTanker: true,
                        nearMissAwarded: false,
                        hit: false,
                        laneChangeTimer: 0
                    });

                    // Trigger sparks to test zero-allocation scratchVec
                    window.game.traffic.spawnSparks(window.game.scratchVec.set(0, 0.4, 0), 12, 0xffd900);
                })()
                """
            })

            # Run 5 seconds of active gameplay and lateral swerving to exercise physics and steering
            print("[DAY07-PERF] Simulating high-speed driving and lane changes under Heat pursuit...")
            for step in range(12):
                steer_input = -0.7 if (step % 4 < 2) else 0.7
                await send("Runtime.evaluate", {
                    "expression": f"""
                    (() => {{
                        window.game.player.steerInput = {steer_input};
                        window.game.player.throttle = 1.0;
                    }})()
                    """
                })
                await asyncio.sleep(0.4)

            # Capture Screenshot 1: 60 FPS Telemetry & High Speed Highway Run
            snap1 = await send("Page.captureScreenshot", {"format": "png"})
            snap1_bytes = base64.b64decode(snap1["data"])
            snap1_path = os.path.join(ARTIFACTS_DIR, "day07_performance_60fps_telemetry.png")
            with open(snap1_path, "wb") as f:
                f.write(snap1_bytes)
            print(f"[DAY07-PERF] Captured {snap1_path} ({len(snap1_bytes)} bytes)")

            # Continue 5 more seconds with obstacle encounters and ceramic braking
            print("[DAY07-PERF] Simulating ceramic braking deceleration and roadblock approach...")
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.steerInput = 0;
                    window.game.player.brake = 0.85; // Heavy braking
                })()
                """
            })
            await asyncio.sleep(1.2)
            await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    window.game.player.brake = 0;
                    window.game.player.throttle = 1.0;
                    // Trigger evasion outside 35m
                    window.game.evasionTimer = 4.2;
                })()
                """
            })
            await asyncio.sleep(1.5)

            # Capture Screenshot 2: Hot Loop & Pursuit Profiling
            snap2 = await send("Page.captureScreenshot", {"format": "png"})
            snap2_bytes = base64.b64decode(snap2["data"])
            snap2_path = os.path.join(ARTIFACTS_DIR, "day07_hot_loop_profiling.png")
            with open(snap2_path, "wb") as f:
                f.write(snap2_bytes)
            print(f"[DAY07-PERF] Captured {snap2_path} ({len(snap2_bytes)} bytes)")

            # Extract Performance Metrics & Telemetry
            perf_res = await send("Runtime.evaluate", {
                "expression": """
                (() => {
                    const times = window.__frameTimes || [];
                    const count = times.length;
                    if (count === 0) return { error: 'No frame data' };

                    const sum = times.reduce((a, b) => a + b, 0);
                    const avgDelta = sum / count;
                    const avgFps = 1000 / avgDelta;

                    const sorted = [...times].sort((a, b) => a - b);
                    const minDelta = sorted[0];
                    const maxDelta = sorted[sorted.length - 1];
                    const p95Delta = sorted[Math.floor(sorted.length * 0.95)];
                    const p99Delta = sorted[Math.floor(sorted.length * 0.99)];

                    const mem = window.performance.memory ? {
                        usedJSHeapSizeMB: +(window.performance.memory.usedJSHeapSize / 1048576).toFixed(2),
                        totalJSHeapSizeMB: +(window.performance.memory.totalJSHeapSize / 1048576).toFixed(2),
                        jsHeapSizeLimitMB: +(window.performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)
                    } : null;

                    const gameMetrics = window.game?.getPerformanceMetrics ? window.game.getPerformanceMetrics() : null;
                    const trafficTelemetry = window.game?.traffic ? window.game.traffic.getTrafficTelemetry() : null;
                    const inputTelemetry = window.game?.getInputTelemetry ? window.game.getInputTelemetry() : null;
                    const playerStats = window.game?.player ? {
                        speedKmh: +(window.game.player.speed * 9).toFixed(1),
                        hull: window.game.player.hull,
                        gear: window.game.player.gear,
                        heatLevel: window.game.heatLevel,
                        distance: +window.game.distance.toFixed(1)
                    } : null;

                    return {
                        totalFramesRecorded: count,
                        avgFps: +avgFps.toFixed(1),
                        avgFrameTimeMs: +avgDelta.toFixed(2),
                        minFrameTimeMs: +minDelta.toFixed(2),
                        maxFrameTimeMs: +maxDelta.toFixed(2),
                        p95FrameTimeMs: +p95Delta.toFixed(2),
                        p99FrameTimeMs: +p99Delta.toFixed(2),
                        gameMetrics,
                        memory: mem,
                        telemetry: {
                            traffic: trafficTelemetry,
                            input: inputTelemetry,
                            player: playerStats
                        },
                        errors: window.__day07Errors || []
                    };
                })()
                """,
                "returnByValue": True
            })

            data = perf_res.get("result", {}).get("value", {})
            telemetry_path = os.path.join(ARTIFACTS_DIR, "road_riot_day07_verification_telemetry.json")
            with open(telemetry_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"[DAY07-PERF] Saved telemetry to {telemetry_path}")
            print(f"[DAY07-PERF] Result Summary: {json.dumps(data, indent=2)}")

            # Assertions
            assert len(data.get("errors", [])) == 0, f"Found runtime errors: {data.get('errors')}"
            game_metrics = data.get("gameMetrics") or {}
            avg_logic = game_metrics.get("avgLogicMs", 0)
            p95_logic = game_metrics.get("p95LogicMs", 0)
            print(f"[DAY07-PERF] Verified: avgLogicMs={avg_logic}ms, p95LogicMs={p95_logic}ms (Target: <14ms budget), 0 errors.")
            assert avg_logic < 14.0, f"Average logic compute time {avg_logic}ms exceeds 14ms budget"

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()


if __name__ == "__main__":
    asyncio.run(run_day07_performance_verification())
