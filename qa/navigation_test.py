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
DEBUG_PORT = 9342
URL = "http://127.0.0.1:8040/"


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


with tempfile.TemporaryDirectory(prefix="andmep-chrome-") as profile:
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
            nonlocal_counter = None
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

        def wait_for_path(path):
            for _ in range(60):
                if evaluate("location.pathname") == path:
                    time.sleep(0.25)
                    return
                time.sleep(0.1)
            raise AssertionError(f"Navigation did not reach {path}")

        def screenshot(name):
            result = command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
            (ROOT / "qa" / name).write_bytes(base64.b64decode(result["data"]))

        command("Page.enable")
        command("Runtime.enable")
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(1)

        landing = json.loads(evaluate("""JSON.stringify({
          title: document.title,
          heading: document.querySelector('.hero-grid h1').textContent.trim(),
          cards: [...document.querySelectorAll('.api-card input')].map(input => input.value),
          selected: document.querySelector('input[name="api-version"]:checked').value,
          startHref: startButton.getAttribute('href'),
          startText: startButton.querySelector('span').textContent,
          mapLinks: document.querySelectorAll('.sequence .path-card').length,
          apiPathLinks: document.querySelectorAll('.api-path .path-card').length,
          standaloneLinks: document.querySelectorAll('.standalone-path .path-card').length,
          footerDetails: document.querySelectorAll('.site-footer .footer-detail').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert landing == {
            "title": "Andmepädevus · interaktiivsed praktikumid",
            "heading": "Vali teema, millest alustada.",
            "cards": ["api1", "api2", "api3", "kraapimine", "ai-andmetoo"],
            "selected": "api1",
            "startHref": "./api1/",
            "startText": "Alusta API 1 praktikumi",
            "mapLinks": 5,
            "apiPathLinks": 3,
            "standaloneLinks": 2,
            "footerDetails": 3,
            "overflow": False,
        }, landing
        screenshot("landing-desktop.png")

        expected_routes = {
            "api1": ("./api1/", "Alusta API 1 praktikumi"),
            "api2": ("./api2/", "Alusta API 2 praktikumi"),
            "api3": ("./api3/", "Alusta API 3 praktikumi"),
            "kraapimine": ("./kraapimine/", "Alusta veebikraapimise praktikumi"),
            "ai-andmetoo": ("./ai-andmetoo/", "Alusta AI-andmetöö praktikumi"),
        }
        for value, expected in expected_routes.items():
            changed = json.loads(evaluate(f"""(() => {{
              document.querySelector('input[value="{value}"]').click();
              return JSON.stringify({{href:startButton.getAttribute('href'),text:startButton.querySelector('span').textContent}});
            }})()"""))
            assert (changed["href"], changed["text"]) == expected, {value: changed}

        modules = {
            "api1": "../api1/",
            "api2": "../api2/",
            "api3": "../api3/",
            "kraapimine": "../kraapimine/",
            "ai-andmetoo": "../ai-andmetoo/",
        }
        module_states = {}
        for route, selected in modules.items():
            command("Page.navigate", {"url": URL + route + "/"})
            wait_for_path(f"/{route}/")
            state = json.loads(evaluate("""JSON.stringify({
              selected: document.querySelector('.api-version-select').value,
              options: document.querySelectorAll('.api-version-select option').length,
              homeHref: document.querySelector('.api-home-link').getAttribute('href'),
              homeText: document.querySelector('.api-home-link').textContent.trim(),
              heading: document.querySelector('.hero-title').getAttribute('aria-label'),
              footer: Boolean(document.querySelector('.site-footer')),
              homeHeight: Math.round(document.querySelector('.api-home-link').getBoundingClientRect().height),
              homeWidth: Math.round(document.querySelector('.api-home-link').getBoundingClientRect().width),
              homeOverflow: getComputedStyle(document.querySelector('.api-home-link')).overflow,
              homeBackground: getComputedStyle(document.querySelector('.api-home-link')).backgroundColor,
              homeAfter: getComputedStyle(document.querySelector('.api-home-link'), '::after').content,
              selectWidth: Math.round(document.querySelector('.api-version-select').getBoundingClientRect().width),
              selectHeight: Math.round(document.querySelector('.api-version-select').getBoundingClientRect().height),
              selectBefore: getComputedStyle(document.querySelector('.api-version-switch'), '::before').content,
              resultHidden: document.querySelector('#impactCard, #stageCard, .stage-card')?.hidden ?? null,
              resultPending: document.querySelector('.lab-grid')?.classList.contains('impact-pending') || document.querySelector('.lab-grid')?.classList.contains('result-pending'),
              controlCenterDelta: Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left + document.querySelector('.control-card').getBoundingClientRect().width / 2) - innerWidth / 2)),
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
            })"""))
            assert state["selected"] == selected and state["options"] == 5, {route: state}
            assert state["homeHref"] == "../" and state["homeText"] == "ANDMEPÄDEVUS", {route: state}
            assert state["heading"] and state["footer"] and not state["overflow"], {route: state}
            assert state["homeHeight"] >= 52 and "AVALEHT" in state["homeAfter"], {route: state}
            assert state["selectWidth"] >= 210 and state["selectHeight"] >= 52 and "VALI PRAKTIKUM" in state["selectBefore"], {route: state}
            if route == "kraapimine":
                assert not evaluate("Boolean(document.querySelector('.source-profile'))")
            assert state["resultHidden"] and state["resultPending"], {route: state}
            assert state["controlCenterDelta"] <= 10, {route: state}
            module_states[route] = state
            screenshot(f"{route}-initial.png")

            if route in ("api1", "api2"):
                evaluate("document.querySelector('#getMetadata').click()")
                revealed = json.loads(evaluate("JSON.stringify({hidden:document.querySelector('.stage-card').hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
                assert revealed == {"hidden": False, "pending": False}, {route: revealed}
            elif route == "api3":
                evaluate("document.querySelector('[data-run=\"1\"]').click()")
                revealed = json.loads(evaluate("JSON.stringify({hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
                assert revealed == {"hidden": False, "pending": False}, {route: revealed}
            elif route == "ai-andmetoo":
                intro = evaluate("document.querySelector('.labeling-instruction-intro').textContent.replace(/\\s+/g,' ').trim()")
                assert intro == "MIS ON MÄRGENDUSJUHIS? Märgendusjuhis on ühine reeglistik, mis selgitab, mida iga märgend tähendab ja millise nähtava info põhjal seda kasutada. Selge juhis aitab eri märgendajatel sarnaseid juhtumeid ühtemoodi hinnata ning loob mudelile järjepidevad treeningandmed.", intro
                choices = json.loads(evaluate("JSON.stringify({rules:[...labelRule.options].map(option=>option.textContent),audits:[...representationAudit.options].map(option=>option.textContent),missing:[...missingPolicy.options].map(option=>option.textContent),disagreement:[...disagreementPolicy.options].map(option=>option.textContent)})"))
                assert choices["rules"] == [
                    "Vali üks reegel",
                    "Kasuta iseteeninduse aktiivsust inimese toevajaduse hinnanguna",
                    "Lähtu praegusest dokumenteeritud vajadusest ja märgendusjuhisest",
                ], choices
                assert not evaluate("Boolean(document.querySelector('#sourceChoices input[value=\"history\"]'))"), "Varasema teenuseotsuse valik on alles"
                assert "Varasem teenuseotsus" not in evaluate("document.querySelector('[data-stage=\"1\"]').textContent"), "Varasema teenuseotsuse tekst on alles"
                assert not evaluate("Boolean(document.querySelector('#saveScenario, .comparison-card'))"), "Variandivõrdluse plokk on alles"
                assert "PROOVI TEIST VARIANTI" not in evaluate("document.body.textContent"), "Variandivõrdluse tekst on alles"
                assert choices["audits"] == [
                    "Vali üks kontroll",
                    "Ainult seda, kas juhtumeid on kokku piisavalt",
                    "Ainult seda, kas kõik faili lahtrid on täidetud",
                    "Kas piirkonnad, keeled ja teeninduskanalid on esindatud ning kus andmed puuduvad",
                ], choices
                assert choices["missing"] == [
                    "Vali üks tegevus",
                    "Eelda, et takistust pole, ja kasuta märgendit „Tavaplaan”",
                    "Vali olemasoleva info põhjal kõige tõenäolisem toe märgend",
                    "Kasuta märgendit „Andmete täiendamine” ja suuna juhtum info täiendamisele",
                ], choices
                assert choices["disagreement"] == [
                    "Vali üks tegevus",
                    "Kasuta esimese märgendaja valikut",
                    "Lisa sama juhtum mõlema märgendiga treeningandmetesse",
                    "Valdkonnaspetsialist teeb põhjendatud lõppotsuse ja ebaselgus lisatakse juhisesse",
                ], choices
                evaluate("""(() => {
                  ['fast','standard','supplement','review'].forEach(value=>document.querySelector(`#availableLabelChoices input[value="${value}"]`).click());
                  ['notes','barriers','activity'].forEach(value=>document.querySelector(`#sourceChoices input[value="${value}"]`).click());
                  missingPolicy.value='average'; missingPolicy.dispatchEvent(new Event('change',{bubbles:true}));
                  disagreementPolicy.value='first'; disagreementPolicy.dispatchEvent(new Event('change',{bubbles:true}));
                  labelRule.value='activity'; labelRule.dispatchEvent(new Event('change',{bubbles:true}));
                  representationAudit.value='overall'; representationAudit.dispatchEvent(new Event('change',{bubbles:true}));
                })()""")
                wrong = json.loads(evaluate("JSON.stringify({button:document.querySelector('[data-complete=\"1\"]').disabled,ruleInvalid:labelRule.getAttribute('aria-invalid'),auditInvalid:representationAudit.getAttribute('aria-invalid'),missingInvalid:missingPolicy.getAttribute('aria-invalid'),disagreementInvalid:disagreementPolicy.getAttribute('aria-invalid'),ruleHint:ruleAvailability.textContent,auditHint:auditAvailability.textContent,missingHint:missingPolicyFeedback.textContent,disagreementHint:disagreementFeedback.textContent})"))
                assert wrong["button"] and wrong["ruleInvalid"] == "true" and wrong["auditInvalid"] == "true" and wrong["missingInvalid"] == "true" and wrong["disagreementInvalid"] == "true", wrong
                assert "aktiivsuse hulk" in wrong["ruleHint"].lower() and "koguarv" in wrong["auditHint"].lower() and "teadmata" in wrong["missingHint"].lower() and "ei lahenda" in wrong["disagreementHint"].lower(), wrong
                evaluate("labelRule.value='current'; labelRule.dispatchEvent(new Event('change',{bubbles:true})); representationAudit.value='coverage'; representationAudit.dispatchEvent(new Event('change',{bubbles:true})); missingPolicy.value='drop'; missingPolicy.dispatchEvent(new Event('change',{bubbles:true})); disagreementPolicy.value='expert'; disagreementPolicy.dispatchEvent(new Event('change',{bubbles:true}))")
                correct = json.loads(evaluate("JSON.stringify({button:document.querySelector('[data-complete=\"1\"]').disabled,ruleInvalid:labelRule.getAttribute('aria-invalid'),auditInvalid:representationAudit.getAttribute('aria-invalid'),missingInvalid:missingPolicy.getAttribute('aria-invalid'),disagreementInvalid:disagreementPolicy.getAttribute('aria-invalid'),ruleGood:ruleAvailability.classList.contains('good'),auditGood:auditAvailability.classList.contains('good'),missingGood:missingPolicyFeedback.classList.contains('good'),disagreementGood:disagreementFeedback.classList.contains('good')})"))
                assert correct == {"button": False, "ruleInvalid": "false", "auditInvalid": "false", "missingInvalid": "false", "disagreementInvalid": "false", "ruleGood": True, "auditGood": True, "missingGood": True, "disagreementGood": True}, correct
                evaluate("labelRule.scrollIntoView({block:'center'})")
                time.sleep(0.25)
                screenshot("ai-andmetoo-stage1-choices.png")

        command("Page.navigate", {"url": URL + "kraapimine/"})
        wait_for_path("/kraapimine/")
        evaluate("[...document.querySelectorAll('#permissionChecklist input')].forEach(input=>input.click()); document.querySelector('[data-run=\"1\"]').click()")
        time.sleep(0.7)
        evaluate("recordSelector.value='.quote'; textSelector.value='.text'; authorSelector.value='.author'; tagSelector.value='.tags .tag'; selectorFields.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('[data-run=\"2\"]').click()")
        time.sleep(0.7)
        before_scrape = json.loads(evaluate("JSON.stringify({step:document.querySelector('.lesson-panel:not([hidden])').dataset.lesson,hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
        assert before_scrape == {"step": "3", "hidden": True, "pending": True}, before_scrape
        evaluate("document.querySelector('[data-run=\"3\"]').click()")
        time.sleep(2.4)
        evaluate("flowDialogClose.click()")
        after_scrape = json.loads(evaluate("JSON.stringify({hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending'),rows:rowCount.textContent})"))
        assert after_scrape == {"hidden": False, "pending": False, "rows": "10"}, after_scrape
        screenshot("kraapimine-result.png")

        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        command("Page.navigate", {"url": URL})
        wait_for_path("/")
        mobile = json.loads(evaluate("""JSON.stringify({
          width: document.documentElement.clientWidth,
          cards: document.querySelectorAll('.api-card').length,
          columns: getComputedStyle(document.querySelector('.api-options')).gridTemplateColumns.split(' ').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          startFits: startButton.getBoundingClientRect().right <= innerWidth
        })"""))
        assert mobile == {"width": 390, "cards": 5, "columns": 1, "overflow": False, "startFits": True}, mobile
        screenshot("landing-mobile.png")

        mobile_modules = {}
        for route in modules:
            command("Page.navigate", {"url": URL + route + "/"})
            wait_for_path(f"/{route}/")
            state = json.loads(evaluate("""JSON.stringify({
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              homeFits: document.querySelector('.api-home-link').getBoundingClientRect().right <= innerWidth,
              selectFits: document.querySelector('.api-version-select').getBoundingClientRect().right <= innerWidth,
              options: document.querySelectorAll('.api-version-select option').length
            })"""))
            assert state == {"overflow": False, "homeFits": True, "selectFits": True, "options": 5}, {route: state}
            mobile_modules[route] = state
        screenshot("ai-andmetoo-header-mobile.png")

        print(json.dumps({"landing": landing, "modules": module_states, "mobile": mobile, "mobileModules": mobile_modules}, ensure_ascii=False, indent=2))
        ws.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
