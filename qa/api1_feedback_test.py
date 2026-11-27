import base64
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket


ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
DEBUG_PORT = 9343
URL = "http://127.0.0.1:8040/api1/"


def wait_for_page():
    for _ in range(80):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/list") as response:
                pages = json.load(response)
            page = next((item for item in pages if item.get("type") == "page"), None)
            if page:
                return page
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Chrome DevTools did not start")


with tempfile.TemporaryDirectory(prefix="andmep-api1-chrome-") as profile:
    process = subprocess.Popen(
        [
            str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run",
            f"--remote-debugging-port={DEBUG_PORT}", "--remote-allow-origins=*",
            f"--user-data-dir={profile}", URL,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        page = wait_for_page()
        ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=15)
        counter = 0

        def command(method, params=None):
            global counter
            counter += 1
            request_id = counter
            ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get("id") == request_id:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})

        def evaluate(expression):
            result = command("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
            if result.get("exceptionDetails"):
                raise RuntimeError(result["exceptionDetails"])
            return result["result"].get("value")

        def wait_until(expression, timeout=8):
            deadline = time.time() + timeout
            while time.time() < deadline:
                if evaluate(expression):
                    return
                time.sleep(0.1)
            raise AssertionError(f"Condition did not become true: {expression}")

        def screenshot(name):
            result = command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
            (ROOT / "qa" / name).write_bytes(base64.b64decode(result["data"]))

        command("Page.enable")
        command("Runtime.enable")
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        command("Page.reload", {"ignoreCache": True})
        wait_until("document.readyState === 'complete'")

        initial = json.loads(evaluate("""JSON.stringify({
          title: document.title,
          heading: document.querySelector('.hero-title').textContent.trim(),
          purpose: document.querySelector('.hero-description').textContent.replace(/\\s+/g, ' ').trim(),
          task: document.querySelector('.briefing-card').textContent.replace(/\\s+/g, ' ').trim(),
          progress: progressText.textContent,
          metadataButton: getMetadata.textContent.trim(),
          hasChart: Boolean(document.querySelector('.result-viz, .bar-chart')),
          sourceLabel: document.querySelector('.service-node small').textContent,
          sourceName: document.querySelector('.service-node b').textContent,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert initial["title"] == "API 1 · API kaudu andmete pärimise näide", initial
        assert initial["heading"] == "API kaudu andmete pärimise näide", initial
        assert "Harjutuse eesmärk" in initial["purpose"], initial
        assert "Miks kasutatakse siin API-t?" in initial["task"], initial
        assert "väikest andmehulka teadlikult" in initial["task"], initial
        assert initial["progress"] == "1. Tabeli kirjeldus", initial
        assert initial["metadataButton"] == "Ava tabeli kirjeldus (GET)→", initial
        assert not initial["hasChart"] and not initial["overflow"], initial
        assert initial["sourceLabel"] == "ANDMEALLIKAS" and initial["sourceName"] == "Tabel PA111", initial
        screenshot("api1-feedback-initial.png")

        evaluate("getMetadata.click()")
        wait_until("!flowDialogClose.disabled")
        evaluate("flowDialogClose.click()")
        wait_until("!sendRequest.disabled")
        evaluate("sendRequest.click()")
        wait_until("!flowDialogClose.disabled")
        evaluate("flowDialogClose.click()")
        wait_until("!resultSummary.hidden")
        evaluate("resultSummary.scrollIntoView({block:'center', behavior:'instant'})")
        time.sleep(0.2)

        result = json.loads(evaluate("""JSON.stringify({
          periods: [...document.querySelectorAll('#resultValues dt')].map(node => node.textContent.trim()),
          values: [...document.querySelectorAll('#resultValues dd')].map(node => node.textContent.replace(/\\s+/g, ' ').trim()),
          comparison: resultComparison.textContent.replace(/\\s+/g, ' ').trim(),
          note: resultSummaryNote.textContent.replace(/\\s+/g, ' ').trim(),
          responseValues: [...document.querySelectorAll('.response-value')].map(node => Number(node.textContent)),
          rawValues: JSON.parse(responseOutput.textContent).value,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert result["periods"] == ["2024 II kv", "2025 II kv", "2026 II kv"], result
        assert result["values"] == ["2 007 €", "2 126 €", "2 243 €"], result
        assert result["rawValues"] == result["responseValues"] == [2007, 2126, 2243], result
        assert "119 € (5,9%)" in result["comparison"], result
        assert "117 € (5,5%)" in result["comparison"], result
        assert "236 € (11,8%)" in result["comparison"], result
        assert "Statistikaameti tabeli PA111 kontrollväärtused" in result["note"], result
        assert not result["overflow"], result
        screenshot("api1-feedback-result.png")

        evaluate("[...validationFields.querySelectorAll('input')].forEach(input => input.click())")
        evaluate("decoderOptions.querySelector('[data-code=\"404\"]').click()")
        assert evaluate("!decoderHint.hidden && !decoderNext.hidden && decoderQuestionNumber.textContent === '1 / 4'")
        time.sleep(2)
        assert evaluate("!decoderHint.hidden && decoderQuestionNumber.textContent === '1 / 4'")
        evaluate("decoderNext.click()")
        assert evaluate("decoderHint.hidden && decoderNext.hidden && decoderQuestionNumber.textContent === '2 / 4'")
        for selector, feedback, next_button in [
            ("#methodOptions [data-method=manual]", "methodFeedback", "methodNext"),
            ("#conceptOptions [data-answer='1']", "conceptFeedback", "conceptNext"),
        ]:
            evaluate(f"document.querySelector({json.dumps(selector)}).click()")
            assert evaluate(f"!{feedback}.hidden && !{next_button}.hidden")
            evaluate(f"{next_button}.click()")
            assert evaluate(f"{feedback}.hidden && {next_button}.hidden")

        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        command("Page.navigate", {"url": URL})
        wait_until("document.readyState === 'complete'")
        mobile = json.loads(evaluate("""JSON.stringify({
          width: document.documentElement.clientWidth,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          headingFits: document.querySelector('.hero-title').getBoundingClientRect().right <= innerWidth,
          briefingFits: document.querySelector('.briefing-card').getBoundingClientRect().right <= innerWidth
        })"""))
        assert mobile == {"width": 390, "overflow": False, "headingFits": True, "briefingFits": True}, mobile
        screenshot("api1-feedback-mobile.png")

        print(json.dumps({"initial": initial, "result": result, "mobile": mobile}, ensure_ascii=True, indent=2))
    finally:
        process.terminate()
        process.wait(timeout=10)
