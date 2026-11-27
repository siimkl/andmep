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

        assert evaluate("document.title") == "API 1 · GET-päring Statistikaameti API-s"
        assert evaluate("progressText.textContent") == "1. GET-päring"
        assert evaluate("requestPreview.textContent") == (
            "GET https://andmed.stat.ee/api/v1/et/stat/PA111\nAccept: application/json"
        )
        assert evaluate("stageCard.hidden && readingSection.hidden && quizSection.hidden")
        assert not evaluate("document.body.textContent.includes('POST')")
        screenshot("api1-feedback-initial.png")

        def send_get():
            evaluate("getMetadata.click()")
            wait_until("flowDialog.open && !flowDialogClose.disabled")
            assert evaluate("dialogFlowStatus.textContent === '200 OK'")
            evaluate("flowDialogClose.click()")
            wait_until("!stageCard.hidden && !readingSection.hidden && !flowDialog.open")

        snapshots = json.loads((ROOT / "dist/api1/pa111-metadata.json").read_text(encoding="utf-8"))
        send_get()
        assert evaluate("progressValue.textContent") == "33%"
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["et"]
        assert evaluate("liveResponse.href") == "https://andmed.stat.ee/api/v1/et/stat/PA111"
        evaluate("""responsePart.value='Vaatlusperiood';
          responsePart.dispatchEvent(new Event('change', {bubbles:true}));""")
        period = evaluate("JSON.parse(responseOutput.textContent)")
        assert period["valueTexts"][period["values"].index("2026Q2")] == "2026 II kvartal"
        screenshot("api1-feedback-result.png")

        evaluate("""requestLanguage.value='en';
          requestLanguage.dispatchEvent(new Event('change', {bubbles:true}));""")
        assert evaluate("requestPath.textContent") == "/api/v1/en/stat/PA111"
        assert evaluate("responsePath.textContent") == "/api/v1/et/stat/PA111"
        send_get()
        wait_until("responsePath.textContent === '/api/v1/en/stat/PA111'")
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["en"]
        assert evaluate("liveResponse.href") == "https://andmed.stat.ee/api/v1/en/stat/PA111"

        evaluate("indicatorCode.value='NR_EMPL'; activityCode.value='TOTAL'; periodCode.value='2026Q2'; checkCodes.click()")
        assert evaluate("quizSection.hidden && indicatorCode.getAttribute('aria-invalid') === 'true'")
        assert "Näitaja" in evaluate("readingFeedback.textContent")
        evaluate("indicatorCode.value='GR_W_AVG'; checkCodes.click()")
        assert evaluate("!quizSection.hidden && progressValue.textContent === '67%' && indicatorCode.disabled")

        evaluate("quizOptions.children[1].click()")
        assert evaluate("!quizFeedback.hidden && !quizNext.hidden && quizCount.textContent === 'Küsimus 1 / 3'")
        time.sleep(1.9)
        assert evaluate("quizCount.textContent === 'Küsimus 1 / 3'")
        evaluate("quizNext.click()")
        for answer in (1, 2):
            evaluate(f"quizOptions.children[{answer}].click()")
            evaluate("quizNext.click()")
        assert evaluate("!quizSummary.hidden && progressValue.textContent === '100%'")
        assert "2 / 3" in evaluate("quizScore.textContent")

        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        assert evaluate("document.documentElement.scrollWidth <= innerWidth")
        evaluate("stageCard.scrollIntoView({block:'start', behavior:'instant'})")
        screenshot("api1-feedback-mobile.png")

        evaluate("resetButton.click()")
        assert evaluate("""requestLanguage.value === 'et' && progressValue.textContent === '0%'
          && stageCard.hidden && readingSection.hidden && quizSection.hidden
          && !indicatorCode.disabled && indicatorCode.value === ''""")
        send_get()
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["et"]
        print("API 1 GET flow passed in both response languages, including metadata reading, quiz and reset.")
    finally:
        process.terminate()
        process.wait(timeout=10)
