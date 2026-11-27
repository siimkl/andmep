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

        def click_visible(selector):
            point = evaluate(f"""(async selector => {{
              const element = document.querySelector(selector);
              element.scrollIntoView({{block:'center',behavior:'instant'}});
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              const rect = element.getBoundingClientRect();
              return {{x:rect.x + rect.width/2, y:rect.y + rect.height/2}};
            }})({json.dumps(selector)})""")
            for kind in ("mousePressed", "mouseReleased"):
                command("Input.dispatchMouseEvent", {"type": kind, "button": "left", "clickCount": 1, **point})

        snapshots = json.loads((ROOT / "dist/api1/pa111-metadata.json").read_text(encoding="utf-8"))
        command("Network.enable")
        command("Network.setBlockedURLs", {"urls": ["*pa111-metadata.json*"]})
        evaluate("getMetadata.click()")
        wait_until("!requestError.hidden && !flowDialog.open")
        assert evaluate("!getMetadata.disabled && !requestLanguage.disabled && stageCard.hidden")
        command("Network.setBlockedURLs", {"urls": []})
        send_get()
        assert evaluate("progressValue.textContent") == "33%"
        assert evaluate("""getMetadata.disabled && requestLanguage.disabled
          && getMetadata.textContent === 'GET-päring tehtud'
          && currentStepLabel.textContent === 'SAMM 1 / 3'
          && !continueToSelection.hidden""")
        evaluate("getMetadata.dispatchEvent(new MouseEvent('click', {bubbles:true}))")
        assert evaluate("!flowDialog.open && progressValue.textContent === '33%'")
        evaluate("continueToSelection.click()")
        assert evaluate("document.activeElement === readingTitle")
        assert evaluate("selectionTaskCount.textContent") == "Ülesanne 1 / 3"
        evaluate("readingSection.scrollIntoView({block:'start', behavior:'instant'})")
        screenshot("api1-selection-first-task.png")
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["et"]
        assert evaluate("liveResponse.href") == "https://andmed.stat.ee/api/v1/et/stat/PA111"
        assert evaluate("""indicatorSelect.options.length === 12 && activitySelect.options.length === 20
          && periodOptions.querySelectorAll('input').length === 22 && periodOptions.children.length === 6""")
        assert evaluate("selectionCounts.textContent") == "12 näitajat · 20 tegevusala · 22 vaatlusperioodi"
        assert evaluate("selectionMath.textContent + ' ' + valueCount.textContent") == "1 × 1 × 3 = 3 väärtust"
        assert evaluate("selectedPeriodCodes.textContent") == "2024Q2, 2025Q2, 2026Q2"
        assert evaluate("""Array.from(periodOptions.querySelectorAll('input:checked + span .period-checkmark'))
          .every(mark => getComputedStyle(mark).display !== 'none')""")
        click_visible("#checkSelection")
        assert evaluate("""!nextSelectionTask.hidden
          && periodField.getAttribute('aria-invalid') === 'false'
          && readingFeedback.classList.contains('success')""")
        evaluate("""(() => {
          indicatorSelect.value = 'GR_W_D5';
          indicatorSelect.dispatchEvent(new Event('change', {bubbles:true}));
          activitySelect.value = 'P';
          activitySelect.dispatchEvent(new Event('change', {bubbles:true}));
        })()""")
        click_visible("#clearPeriods")
        assert evaluate("clearPeriods.disabled")
        assert evaluate("selectedPeriodCodes.textContent") == "Valik puudub"
        assert evaluate("selectionMath.textContent") == "1 × 1 × 0"
        evaluate("""responsePart.value='Vaatlusperiood';
          responsePart.dispatchEvent(new Event('change', {bubbles:true}));""")
        period = evaluate("JSON.parse(responseOutput.textContent)")
        assert period["valueTexts"][period["values"].index("2026Q2")] == "2026 II kvartal"
        screenshot("api1-feedback-result.png")

        evaluate("resetButton.click()")
        assert evaluate("!getMetadata.disabled && !requestLanguage.disabled && continueToSelection.hidden")
        evaluate("""requestLanguage.value='en';
          requestLanguage.dispatchEvent(new Event('change', {bubbles:true}));""")
        assert evaluate("requestPath.textContent") == "/api/v1/en/stat/PA111"
        send_get()
        assert evaluate("responsePath.textContent") == "/api/v1/en/stat/PA111"
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["en"]
        assert evaluate("liveResponse.href") == "https://andmed.stat.ee/api/v1/en/stat/PA111"
        assert evaluate("getMetadata.disabled && requestLanguage.disabled")
        evaluate("""(() => {
          indicatorSelect.value = 'GR_W_D5';
          indicatorSelect.dispatchEvent(new Event('change', {bubbles:true}));
          activitySelect.value = 'P';
          activitySelect.dispatchEvent(new Event('change', {bubbles:true}));
          clearPeriods.click();
        })()""")

        assert evaluate("""indicatorSelect.value === 'GR_W_D5' && activitySelect.value === 'P'
          && !periodOptions.querySelector('input:checked')""")
        assert evaluate("indicatorSelect.selectedOptions[0].textContent") == (
            snapshots["en"]["variables"][0]["valueTexts"][6] + " · GR_W_D5"
        )

        evaluate("checkSelection.click()")
        assert evaluate("""quizSection.hidden && nextSelectionTask.hidden
          && indicatorSelect.getAttribute('aria-invalid') === 'true'
          && periodField.getAttribute('aria-invalid') === 'true'""")
        assert "näitajat" in evaluate("readingFeedback.textContent")
        assert "Lisa 2024. aasta II kvartal, 2025. aasta II kvartal ja 2026. aasta II kvartal." in evaluate(
            "readingFeedback.textContent"
        )

        def select_for_task(indicator, activity, periods):
            assert evaluate(f"""(([indicator, activity, periods]) => {{
              indicatorSelect.value = indicator;
              indicatorSelect.dispatchEvent(new Event('change', {{bubbles:true}}));
              activitySelect.value = activity;
              activitySelect.dispatchEvent(new Event('change', {{bubbles:true}}));
              for (const input of periodOptions.querySelectorAll('input')) {{
                if (input.checked !== periods.includes(input.value)) input.click();
              }}
              return selectedPeriodCodes.textContent === periods.join(', ');
            }})({json.dumps([indicator, activity, periods])})""")
            evaluate("checkSelection.click()")

        select_for_task("GR_W_AVG", "TOTAL", ["2024Q2", "2025Q2", "2026Q2"])
        assert evaluate("!nextSelectionTask.hidden && valueCount.textContent === '= 3 väärtust'")
        evaluate("nextSelectionTask.click()")
        assert evaluate("selectionTaskCount.textContent") == "Ülesanne 2 / 3"
        select_for_task("GR_W_D5", "P", ["2024Q2", "2026Q2"])
        assert evaluate("nextSelectionTask.hidden && periodField.getAttribute('aria-invalid') === 'true'")
        assert evaluate("readingFeedback.textContent") == (
            "Lisa 2025. aasta II kvartal. Eemalda 2024. aasta II kvartal."
        )
        for code, periods_after_click in [
            ("2024Q2", "2026Q2"),
            ("2025Q2", "2025Q2, 2026Q2"),
        ]:
            click_visible(f'#periodOptions input[value="{code}"] + .period-label')
            assert evaluate("selectedPeriodCodes.textContent") == periods_after_click
        click_visible("#checkSelection")
        assert evaluate("!nextSelectionTask.hidden && valueCount.textContent === '= 2 väärtust'")
        evaluate("nextSelectionTask.click()")
        assert evaluate("selectionTaskCount.textContent") == "Ülesanne 3 / 3"
        select_for_task("NR_EMPL", "F", ["2025Q1", "2025Q2", "2025Q3", "2025Q4"])
        assert evaluate("""!quizSection.hidden && progressValue.textContent === '67%'
          && !selectionComplete.hidden && continueToSelection.hidden && valueCount.textContent === '= 4 väärtust'""")
        evaluate("readingSection.scrollIntoView({block:'start', behavior:'instant'})")
        screenshot("api1-selection-desktop.png")

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
        evaluate("readingSection.scrollIntoView({block:'start', behavior:'instant'})")
        screenshot("api1-selection-mobile.png")

        evaluate("resetButton.click()")
        assert evaluate("""requestLanguage.value === 'et' && progressValue.textContent === '0%'
          && stageCard.hidden && readingSection.hidden && quizSection.hidden
          && !getMetadata.disabled && !requestLanguage.disabled
          && selectionTaskCount.textContent === 'Ülesanne 1 / 3'""")
        send_get()
        assert evaluate("JSON.parse(responseOutput.textContent)") == snapshots["et"]
        assert evaluate("indicatorSelect.value === 'GR_W_AVG' && activitySelect.value === 'TOTAL' && valueCount.textContent === '= 3 väärtust'")
        click_visible("#checkSelection")
        assert evaluate("!nextSelectionTask.hidden && readingFeedback.classList.contains('success')")
        print("API 1 passed in both languages, including request lock, failed-request retry, ordered tasks and reset.")
    finally:
        process.terminate()
        process.wait(timeout=10)
