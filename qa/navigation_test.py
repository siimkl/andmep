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

        def wait_for_counter(expected):
            for _ in range(75):
                actual = evaluate("document.querySelector('.control-head .stage-counter').textContent.trim()")
                if actual == expected:
                    return
                time.sleep(0.1)
            raise AssertionError(f"Expected {expected}, got {actual}")

        def click_element(selector):
            point = evaluate(f"""(() => {{
              const element = document.querySelector({json.dumps(selector)});
              element.scrollIntoView({{block:'center', behavior:'instant'}});
              const box = element.getBoundingClientRect();
              return {{x: box.left + box.width / 2, y: box.top + box.height / 2}};
            }})()""")
            for event_type in ("mousePressed", "mouseReleased"):
                command("Input.dispatchMouseEvent", {"type": event_type, "button": "left", "clickCount": 1, **point})

        def open_practicum(route):
            command("Page.navigate", {"url": URL})
            wait_for_path("/")
            click_element(f'.practicum-link[href="./{route}/"]')
            wait_for_path(f"/{route}/")

        def submit_api2_request():
            evaluate("""new Promise(resolve => {
              const observer = new MutationObserver(() => {
                if (flowDialogClose.disabled) return;
                observer.disconnect();
                resolve(true);
              });
              observer.observe(flowDialogClose, {attributes: true, attributeFilter: ['disabled']});
              sendRequest.click();
            })""")
            evaluate("flowDialogClose.click()")
            wait_for_counter("SAMM 4 / 4")

        def assert_api2_result():
            evaluate("flowDialogClose.click()")
            submit_api2_request()
            result = evaluate(r"""({
              rows: [...rTableRows.rows].map(row => [...row.cells].map(cell => cell.textContent.replace(/\s+/g, ' '))),
              values: JSON.parse(responseOutput.textContent).value,
              comparison: rComparison.textContent,
              example: rExampleCode.textContent,
              visible: !rResult.hidden && !validationFields.disabled,
              chartRemoved: !document.querySelector('.bar-chart, .result-viz')
            })""")
            assert result["rows"] == [
                ["2024 II kv", "2 007 €", "—"],
                ["2025 II kv", "2 126 €", "+119 €"],
                ["2026 II kv", "2 243 €", "+117 €"],
            ], result
            assert result["values"] == [2007, 2126, 2243] and "+236 €" in result["comparison"], result
            assert "diff(andmed$vaartus)" in result["example"] and result["visible"] and result["chartRemoved"], result
            evaluate("document.querySelector('.r-example').open = true; rResult.scrollIntoView({block:'start', behavior:'instant'})")
            screenshot("api2-r-result-desktop.png")

            command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
            evaluate("rResult.scrollIntoView({block:'start', behavior:'instant'})")
            assert evaluate("""document.documentElement.scrollWidth === document.documentElement.clientWidth
              && document.querySelector('.r-result-table').getBoundingClientRect().right <= innerWidth""")
            screenshot("api2-r-result-mobile.png")
            command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

            evaluate("[...validationFields.querySelectorAll('input')].forEach(input => input.click())")
            assert evaluate("progressValue.textContent === '100%' && !document.querySelector('.practice-suite').classList.contains('locked')")
            evaluate("[0, 1, 2, 3, 4, 5].forEach(step => workflowOptions.querySelector(`[data-step=\"${step}\"]`).click()); workflowNext.click()")
            assert evaluate("!document.querySelector('[data-test=rcode]').hidden && practiceCompleted.textContent === '1 / 5'")
            evaluate("[...selectionFields.querySelectorAll('input:checked')].slice(1).forEach(input => input.click())")
            submit_api2_request()
            assert evaluate("""rTableRows.rows.length === 1
              && rComparison.textContent.includes('vähemalt kaht perioodi')
              && checkScore.textContent === '0/4'
              && document.querySelector('.practice-suite').inert
              && !validationFields.disabled""")
            evaluate("[...validationFields.querySelectorAll('input')].forEach(input => input.click())")
            assert evaluate("!document.querySelector('.practice-suite').inert && practiceCompleted.textContent === '1 / 5'")
            complete_quiz = """([id, answers, next]) => {
              const options = document.getElementById(id + 'Options');
              const button = document.getElementById(id + 'Next');
              for (const answer of answers) {
                options.querySelector('[data-answer="' + answer + '"]').click();
                if (button.hidden) return false;
                button.click();
              }
              if (next) button.click();
              return true;
            }"""
            assert evaluate(f"({complete_quiz})(['rcode', [1, 2, 0, 2], true])")
            assert evaluate("""!document.querySelector('[data-test=url]').hidden
                && document.querySelector('.practice-example code').textContent.includes('forecast_days=7')""")
            assert evaluate(f"({complete_quiz})(['url', [0, 2, 1, 2], true])")
            assert evaluate(f"({complete_quiz})(['method', [0, 1, 2, 3, 2], true])")
            assert evaluate(f"({complete_quiz})(['detective', [1, 0, 1, 0, 1, 1], false])")
            assert evaluate("practiceCompleted.textContent === '5 / 5' && !restartTests.closest('[hidden]')")
            return result["example"]

        def run_dialog_step(step):
            evaluate(f"""new Promise(resolve => {{
              const observer = new MutationObserver(() => {{
                if (flowDialogClose.disabled) return;
                observer.disconnect();
                resolve(true);
              }});
              observer.observe(flowDialogClose, {{attributes: true, attributeFilter: ['disabled']}});
              document.querySelector('[data-run="{step}"]').click();
            }})""")
            evaluate("flowDialogClose.click()")

        def assert_api3_flow():
            evaluate("flowDialogClose.click(); selectionAction.click()")
            wait_for_counter("SAMM 3 / 4")
            run_dialog_step(3)
            wait_for_counter("SAMM 4 / 4")
            result = evaluate(r"""({
              rows: [...dataRows.rows].map(row => [...row.cells].map(c => c.textContent.replace(/\s+/g, ' '))),
              values: JSON.parse(postResponseOutput.textContent).value,
              input: JSON.parse(modelInputPreview.textContent),
              rCode: code4.textContent,
              change: dataComparison.textContent,
              chartRemoved: !document.querySelector('.result-viz, .bar-chart'),
              choicesLocked: selectionFields.disabled
            })""")
            assert result["rows"] == [["2024 II kv", "2 007 €"], ["2025 II kv", "2 126 €"], ["2026 II kv", "2 243 €"]], result
            assert result["input"]["vaartused"] == result["values"] == [2007, 2126, 2243], result
            assert result["input"]["muutus"] == 236 and result["input"]["suhteline_muutus_protsentides"] == 11.8, result
            assert "+236 € (+11,8%)" in result["change"] and result["chartRemoved"] and result["choicesLocked"], result

            run_dialog_step(4)
            assert evaluate("""!modelResult.hidden && !dataSummary.hidden
              && modelAnswer.textContent.includes('+236 € (+11,8%)')
              && JSON.parse(consoleOutput.textContent).steps[0].content[0].text === modelAnswer.textContent
              && progressValue.textContent === '100%' && !sequenceExercise.inert && !practiceSuite.inert""")
            evaluate("stageCard.scrollIntoView({block:'start', behavior:'instant'})")
            screenshot("api3-comparison-desktop.png")
            command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
            evaluate("modelResult.scrollIntoView({block:'start', behavior:'instant'})")
            assert evaluate("""document.documentElement.scrollWidth === document.documentElement.clientWidth
              && dataSummary.getBoundingClientRect().right <= innerWidth""")
            screenshot("api3-comparison-mobile.png")
            command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

            evaluate("""(() => {
              const up = key => document.querySelector(`[data-flow-key="${key}"] [data-sequence-move=up]`).click();
              ['trigger', 'trigger', 'transform', 'transform', 'ai'].forEach(up);
              sequenceStack.querySelectorAll('select').forEach(select => {
                select.value = select.dataset.answer;
                select.dispatchEvent(new Event('change', {bubbles:true}));
              });
            })()""")
            assert evaluate("sequenceFeedback.classList.contains('complete')")
            assert evaluate("plannerFeedback.hidden && stressResult.hidden && !document.querySelector('.quality-score')")
            evaluate("""sensitivityInput.value='personal';
              sensitivityInput.dispatchEvent(new Event('change', {bubbles: true}));
              stressInput.value='personal-data';
              stressInput.dispatchEvent(new Event('change', {bubbles: true}));""")
            assert evaluate("""!plannerFeedback.hidden && privacyFeedback.textContent.includes('isikuandmete')
              && !stressResult.hidden && stressResult.classList.contains('warn')""")
            evaluate("clearWorkflow.click()")
            assert evaluate("plannerFeedback.hidden && stressResult.hidden")
            evaluate("resetButton.click()")
            assert evaluate("!selectionFields.disabled && progressValue.textContent === '0%' && dataSummary.hidden && modelResult.hidden")
            run_dialog_step(1)
            evaluate("""indicatorSelect.value = 'GR_W_AVG_SM'; activitySelect.value = 'P';
              selectionFields.querySelector('input[value="2025Q2"]').click();
              selectionAction.click()""")
            run_dialog_step(3)
            run_dialog_step(4)
            alternate = evaluate("""({
              input: JSON.parse(modelInputPreview.textContent),
              answer: modelAnswer.textContent,
              values: JSON.parse(postResponseOutput.textContent).value
            })""")
            assert alternate["input"]["tegevusala"] == "Haridus" and alternate["input"]["perioodid"] == ["2024Q2", "2026Q2"], alternate
            assert alternate["input"]["vaartused"] == alternate["values"] == [4.4, 5], alternate
            assert alternate["input"]["suhteline_muutus_protsentides"] is None and "(Haridus)" in alternate["answer"], alternate
            assert "+0,6 protsendipunkti" in alternate["answer"], alternate
            return {"rCode": result["rCode"], "input": result["input"]}

        def assert_shared_footer(columns):
            footer = evaluate("""(() => {
              const text = nodes => [...nodes].map(node => node.textContent.trim());
              const details = document.querySelector('.site-footer .footer-details');
              return {
                author: text(document.querySelectorAll('.site-footer .footer-author :is(small, strong)')),
                details: [...details.children].map(item => text(item.children)),
                route: location.pathname,
                columns: getComputedStyle(details).gridTemplateColumns.split(' ').length
              };
            })()""")
            source_copy = {
                "/": "Brauser kuvab harjutuste näidisvastused.",
                "/kraapimine/": "Brauser kuvab väljavõtte harjutusveebi andmetest.",
                "/ai-andmetoo/": "Tööotsijate andmed on väljamõeldud.",
            }.get(footer.pop("route"), "Brauser kasutab kohalikke näidisvastuseid.")
            assert footer == {
                "author": ["Õppematerjali autor", "Siim Klais"],
                "details": [
                    ["Tehnoloogia", "HTML5 · CSS3 · JavaScript (ES2022)", "Harjutused töötavad brauseris."],
                    ["Arendustööriistad", "Visual Studio Code · OpenAI Codex", "Rakenduse arendamisel kasutati tehisaru abi."],
                    ["Versioonihaldus ja avaldamine", "GitHub · GitHub Actions · GitHub Pages"],
                    ["Andmed", "Õppeandmed ja avalikud allikad", source_copy],
                ],
                "columns": columns,
            }, footer

        def confirm_quality_and_check_transition():
            click_element('[data-complete="3"]')
            transition = evaluate("""({
              stage: state.currentStage,
              dialogOpen: impactDialog.open,
              completed: state.completed.has(3),
              completedCount: completedCount.textContent,
              focused: document.activeElement === stage4Title,
              impactHidden: impactCard.hidden,
              reviewSummaryExists: Boolean(document.querySelector('#reviewImpactSummary')),
              canConfirmAgain: !document.querySelector('[data-complete="3"]').disabled,
              controlsInactive: document.querySelector('.control-card').inert,
              planVisible: !document.querySelector('[data-stage="4"]').hidden
            })""")
            assert transition == {
                "stage": 4,
                "dialogOpen": False,
                "completed": True,
                "completedCount": "3",
                "focused": True,
                "impactHidden": True,
                "reviewSummaryExists": False,
                "canConfirmAgain": False,
                "controlsInactive": False,
                "planVisible": True,
            }, transition
            for _ in range(20):
                top = evaluate("document.querySelector('.control-card').getBoundingClientRect().top")
                if -1 <= top < 140:
                    break
                time.sleep(0.05)
            else:
                raise AssertionError(f"Planning controls outside the top of the viewport: {top}")

        command("Page.enable")
        command("Runtime.enable")
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        command("Page.reload", {"ignoreCache": True})
        time.sleep(1)

        landing = json.loads(evaluate("""JSON.stringify({
          title: document.title,
          heading: document.querySelector('.page-intro h1').textContent.trim(),
          links: [...document.querySelectorAll('main a')].map(link => link.getAttribute('href')),
          orderedLinks: document.querySelectorAll('.practicums ol .practicum-link').length,
          independentLinks: document.querySelectorAll('.practicums ul .practicum-link').length,
          footerDetails: document.querySelectorAll('.site-footer .footer-detail').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        })"""))
        assert landing == {
            "title": "Andmepädevuse praktikumid",
            "heading": "Andmepädevuse praktikumid",
            "links": ["./api1/", "./api2/", "./api3/", "./kraapimine/", "./ai-andmetoo/"],
            "orderedLinks": 3,
            "independentLinks": 2,
            "footerDetails": 4,
            "overflow": False,
        }, landing
        assert_shared_footer(4)
        screenshot("landing-desktop.png")
        command("Emulation.setDeviceMetricsOverride", {"width": 1024, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
        assert_shared_footer(2)
        command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

        modules = {
            "api1": "../api1/",
            "api2": "../api2/",
            "api3": "../api3/",
            "kraapimine": "../kraapimine/",
            "ai-andmetoo": "../ai-andmetoo/",
        }
        module_states = {}
        for route, selected in modules.items():
            open_practicum(route)
            assert_shared_footer(4)
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
            assert evaluate("""(() => {
              const fields = [...document.querySelectorAll('select')];
              const styleKey = field => {
                const css = getComputedStyle(field);
                return [css.fontFamily, css.fontSize, css.borderRadius, css.paddingRight, css.backgroundImage].join('|');
              };
              return fields.length > 1 && new Set(fields.map(styleKey)).size === 1
                && getComputedStyle(fields[0]).backgroundImage.startsWith('url(');
            })()"""), route
            if route == "kraapimine":
                assert not evaluate("Boolean(document.querySelector('.source-profile'))")
            assert state["resultHidden"] and state["resultPending"], {route: state}
            assert state["controlCenterDelta"] <= 10, {route: state}
            badge_state = evaluate("""(() => {
                const badge = document.querySelector('.control-head .stage-counter');
                const style = getComputedStyle(badge);
                return {text: badge.textContent.trim(), fontSize: parseFloat(style.fontSize),
                  height: badge.getBoundingClientRect().height, background: style.backgroundColor, color: style.color};
            })()""")
            expected_counter = {"api1": "SAMM 1 / 3", "kraapimine": "SAMM 1 / 5", "ai-andmetoo": "ETAPP 1 / 4"}.get(route, "SAMM 1 / 4")
            assert badge_state["text"] == expected_counter and badge_state["fontSize"] >= 16 and badge_state["height"] >= 40, {route: badge_state}
            assert badge_state["background"] == "rgb(35, 79, 136)" and badge_state["color"] == "rgb(255, 255, 255)", {route: badge_state}
            if route not in ("ai-andmetoo", "api1"):
                inactive_palette = evaluate("""(() => {
                  const panel = document.querySelector('.practice-suite.locked');
                  return [getComputedStyle(panel).backgroundColor, getComputedStyle(panel).opacity,
                    getComputedStyle(panel.querySelector('h2')).color];
                })()""")
                assert inactive_palette == ["rgb(238, 242, 244)", "1", "rgb(67, 88, 101)"], {route: inactive_palette}
            module_states[route] = state
            screenshot(f"{route}-initial.png")

            if route == "api1":
                assert state["heading"] == "GET-päring Statistikaameti API-s"
                assert evaluate("readingSection.hidden && quizSection.hidden")
            elif route == "api2":
                assert evaluate("getMetadata.textContent.trim()") == "Saada GET-päring"
                evaluate("document.querySelector('#getMetadata').click()")
                revealed = json.loads(evaluate("JSON.stringify({hidden:document.querySelector('.stage-card').hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
                assert revealed == {"hidden": False, "pending": False}, {route: revealed}
                wait_for_counter("SAMM 2 / 4")
                state["rExample"] = assert_api2_result()
            elif route == "api3":
                evaluate("document.querySelector('[data-run=\"1\"]').click()")
                revealed = json.loads(evaluate("JSON.stringify({hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
                assert revealed == {"hidden": False, "pending": False}, {route: revealed}
                wait_for_counter("SAMM 2 / 4")
                state["modelExample"] = assert_api3_flow()
            elif route == "ai-andmetoo":
                intro = evaluate("document.querySelector('.labeling-instruction-intro').textContent.replace(/\\s+/g,' ').trim()")
                assert "Märgendusjuhis kirjeldab, mida iga märgend tähendab" in intro, intro
                label_requirement = json.loads(evaluate("JSON.stringify({cue:activeTaskCue.querySelector('b').textContent,intro:document.querySelector('#availableLabelChoices .choice-intro').textContent})"))
                assert label_requirement == {"cue": "Märgendid 0/5 · andmeväljad 0/5", "intro": "Märgi kõik viis harjutuses kasutatavat märgendit."}, label_requirement
                assert evaluate("document.querySelector('#sourceChoices .choice-intro').textContent") == "Märgi kõik viis välja, mida märgendaja kirje juures näeb."
                evaluate("document.querySelector('#availableLabelChoices input[value=\"fast\"]').click(); document.querySelector('#availableLabelChoices input[value=\"standard\"]').click()")
                assert evaluate("document.querySelector('[data-complete=\"1\"]').disabled && stage1Feedback.hidden")
                assert evaluate("activeTaskCue.querySelector('b').textContent") == "Märgendid 2/5 · andmeväljad 0/5"
                choices = json.loads(evaluate("JSON.stringify({rules:[...labelRule.options].map(option=>option.textContent),audits:[...representationAudit.options].map(option=>option.textContent),missing:[...missingPolicy.options].map(option=>option.textContent),disagreement:[...disagreementPolicy.options].map(option=>option.textContent)})"))
                assert choices["rules"] == [
                    "Vali üks reegel",
                    "Kasuta iseteeninduse aktiivsust inimese toevajaduse hinnanguna",
                    "Lähtu märgendusjuhisest",
                ], choices
                assert not evaluate("Boolean(document.querySelector('#sourceChoices input[value=\"history\"]'))"), "Varasema teenuseotsuse valik on alles"
                assert "Varasem teenuseotsus" not in evaluate("document.querySelector('[data-stage=\"1\"]').textContent"), "Varasema teenuseotsuse tekst on alles"
                assert not evaluate("Boolean(document.querySelector('#saveScenario, .comparison-card'))"), "Variandivõrdluse plokk on alles"
                assert "PROOVI TEIST VARIANTI" not in evaluate("document.body.textContent"), "Variandivõrdluse tekst on alles"
                assert choices["audits"] == [
                    "Vali üks kontroll",
                    "Ainult seda, kas treeningkirjeid on kokku piisavalt",
                    "Ainult seda, kas kõik faili lahtrid on täidetud",
                    "Kas registri piirkonnad, keeled ja teeninduskanalid on treeningvalimis esindatud ning kus andmed puuduvad",
                ], choices
                assert choices["missing"] == [
                    "Vali üks tegevus",
                    "Eelda, et takistust pole, ja kasuta märgendit „Tavaplaan”",
                    "Vali olemasoleva info põhjal kõige tõenäolisem toe märgend",
                    "Kasuta märgendit „Andmete täiendamine” ja saada kirje andmeomanikule täiendamiseks",
                ], choices
                assert choices["disagreement"] == [
                    "Vali üks tegevus",
                    "Kasuta esimese märgendaja valikut",
                    "Lisa sama registrikirje mõlema märgendiga treeningandmetesse",
                    "Valdkonnaspetsialist teeb põhjendatud lõppotsuse ja ebaselgus lisatakse juhisesse",
                ], choices
                evaluate("""(() => {
                  ['self','supplement','review'].forEach(value=>document.querySelector(`#availableLabelChoices input[value="${value}"]`).click());
                  ['profile','notes','barriers','activity'].forEach(value=>document.querySelector(`#sourceChoices input[value="${value}"]`).click());
                  missingPolicy.value='average'; missingPolicy.dispatchEvent(new Event('change',{bubbles:true}));
                  disagreementPolicy.value='first'; disagreementPolicy.dispatchEvent(new Event('change',{bubbles:true}));
                  labelRule.value='activity'; labelRule.dispatchEvent(new Event('change',{bubbles:true}));
                  representationAudit.value='overall'; representationAudit.dispatchEvent(new Event('change',{bubbles:true}));
                })()""")
                wrong = json.loads(evaluate("JSON.stringify({button:document.querySelector('[data-complete=\"1\"]').disabled,ruleInvalid:labelRule.getAttribute('aria-invalid'),auditInvalid:representationAudit.getAttribute('aria-invalid'),missingInvalid:missingPolicy.getAttribute('aria-invalid'),disagreementInvalid:disagreementPolicy.getAttribute('aria-invalid'),ruleHint:ruleAvailability.textContent,auditHint:auditAvailability.textContent,missingHint:missingPolicyFeedback.textContent,disagreementHint:disagreementFeedback.textContent})"))
                assert wrong["button"] and wrong["ruleInvalid"] == "true" and wrong["auditInvalid"] == "true" and wrong["missingInvalid"] == "true" and wrong["disagreementInvalid"] == "true", wrong
                assert "aktiivsuse hulk" in wrong["ruleHint"].lower() and "koguarv" in wrong["auditHint"].lower() and "teadmata" in wrong["missingHint"].lower() and "ei lahenda" in wrong["disagreementHint"].lower(), wrong
                evaluate("labelRule.value='current'; labelRule.dispatchEvent(new Event('change',{bubbles:true})); representationAudit.value='coverage'; representationAudit.dispatchEvent(new Event('change',{bubbles:true})); missingPolicy.value='drop'; missingPolicy.dispatchEvent(new Event('change',{bubbles:true})); disagreementPolicy.value='expert'; disagreementPolicy.dispatchEvent(new Event('change',{bubbles:true}))")
                assert evaluate("document.querySelector('[data-complete=\"1\"]').disabled")
                assert evaluate("activeTaskCue.querySelector('b').textContent") == "Märgendid 5/5 · andmeväljad 4/5"
                evaluate("document.querySelector('#sourceChoices input[value=\"freshness\"]').click()")
                evaluate("document.querySelector('#availableLabelChoices input[value=\"self\"]').click()")
                assert evaluate("document.querySelector('[data-complete=\"1\"]').disabled")
                assert evaluate("activeTaskCue.querySelector('b').textContent") == "Märgendid 4/5 · andmeväljad 5/5"
                evaluate("document.querySelector('#availableLabelChoices input[value=\"self\"]').click()")
                correct = json.loads(evaluate("JSON.stringify({button:document.querySelector('[data-complete=\"1\"]').disabled,ruleInvalid:labelRule.getAttribute('aria-invalid'),auditInvalid:representationAudit.getAttribute('aria-invalid'),missingInvalid:missingPolicy.getAttribute('aria-invalid'),disagreementInvalid:disagreementPolicy.getAttribute('aria-invalid'),ruleGood:ruleAvailability.classList.contains('good'),auditGood:auditAvailability.classList.contains('good'),missingGood:missingPolicyFeedback.classList.contains('good'),disagreementGood:disagreementFeedback.classList.contains('good')})"))
                assert correct == {"button": False, "ruleInvalid": "false", "auditInvalid": "false", "missingInvalid": "false", "disagreementInvalid": "false", "ruleGood": True, "auditGood": True, "missingGood": True, "disagreementGood": True}, correct
                evaluate("labelRule.scrollIntoView({block:'center'})")
                time.sleep(0.25)
                screenshot("ai-andmetoo-stage1-choices.png")
                evaluate("document.querySelector('[data-complete=\"1\"]').click()")
                time.sleep(0.25)
                stage1_captions = json.loads(evaluate("""JSON.stringify(
                    [...document.querySelectorAll('#impactDialog .flow-node small')].map(node => node.textContent)
                )"""))
                assert stage1_captions == ["ANDMEVÄLJAD", "MÄRGENDID", "JÄRGMINE ETAPP"], stage1_captions
                assert evaluate("dialogTitle.textContent") == "Andmete ja juhise kokkuvõte"
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Valitud märgendid", "Märgendajale nähtavad väljad",
                    "Kui soovituseks vajalik registriinfo puudub", "Mille põhjal määratakse uus märgend?",
                    "Kui kaks märgendajat sama kirje puhul ei nõustu", "Mida kontrollitakse enne märgendamise algust?",
                ]
                assert evaluate("[...dialogInsight.querySelectorAll('ul')].map(list => list.children.length)") == [5, 5]
                assert "Andmete kontrollimise aeg" in evaluate("dialogInsight.textContent")
                assert evaluate("""(() => {
                  const answers = [...dialogInsight.querySelectorAll('.dialog-rule-selected')];
                  return answers.length === 4
                    && [missingPolicy, labelRule, disagreementPolicy, representationAudit].every((field, index) =>
                      answers[index].textContent === field.selectedOptions[0].textContent
                      && answers[index].parentElement.children.length === 2
                    );
                })()""")
                assert evaluate("document.activeElement === dialogTitle && impactDialog.scrollTop === 0")
                assert evaluate("getComputedStyle(dialogInsight).gridTemplateColumns.split(' ').length") == 2
                screenshot("ai-andmetoo-choice-summary.png")
                command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
                assert evaluate("getComputedStyle(dialogInsight).gridTemplateColumns.split(' ').length") == 1
                assert evaluate("impactDialog.scrollWidth <= impactDialog.clientWidth")
                evaluate("dialogInsight.scrollIntoView({block: 'start', behavior: 'instant'})")
                screenshot("ai-andmetoo-choice-summary-mobile.png")
                assert evaluate("""(() => {
                  dialogContinue.scrollIntoView({block: 'center', behavior: 'instant'});
                  return dialogContinue.getBoundingClientRect().bottom <= impactDialog.getBoundingClientRect().bottom;
                })()""")
                command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
                evaluate("dialogContinue.click()")
                time.sleep(0.25)
                five_case_start = json.loads(evaluate("JSON.stringify({total:labelCases.length,progress:labelProgress.textContent,step:document.querySelector('[data-step=\"2\"] b').textContent,caseId:document.querySelector('#labelCase .case-top span').textContent,caseTitle:document.querySelector('#labelCase h4').textContent,trainingIds:labelCases.map(item=>item.id),trainingTitles:labelCases.map(item=>item.title),outputIds:outputCases.map(item=>item.id),outputTitles:outputCases.map(item=>item.title),briefing:document.querySelector('.briefing-card').textContent})"))
                assert evaluate("activeTaskCue.hidden && labelGuide.open && labelGuide.closest('[data-stage]').dataset.stage === '2'")
                assert five_case_start["total"] == 5 and five_case_start["progress"] == "0 / 5 märgendatud", five_case_start
                assert evaluate("document.querySelectorAll('#labelCase .case-data-grid > div').length") == 5
                assert evaluate("labelCases.every(item => Object.keys(fieldNames).every(key => item.fields[key]))")
                assert "Andmete kontrollimise aeg" in evaluate("labelCase.textContent")
                assert five_case_start["step"] == "Treeningkirjete märgendamine" and five_case_start["caseId"] == "T-101 · 1/5" and five_case_start["caseTitle"] == "Tööotsija T-101", five_case_start
                assert five_case_start["trainingIds"] == ["T-101", "T-102", "T-103", "T-104", "T-105"] and five_case_start["trainingTitles"] == ["Tööotsija T-101", "Tööotsija T-102", "Tööotsija T-103", "Tööotsija T-104", "Tööotsija T-105"], five_case_start
                assert five_case_start["outputIds"] == ["T-201", "T-202", "T-203", "T-204"] and five_case_start["outputTitles"] == ["Tööotsija T-201", "Tööotsija T-202", "Tööotsija T-203", "Tööotsija T-204"], five_case_start
                briefing = five_case_start["briefing"]
                assert "Lõpliku otsuse teeb ametnik" in briefing, briefing
                assert "viis treeningkirjet" in briefing and "nelja eraldi kontrollkirje" in briefing, briefing
                assert "seob iga kontrollkirje ühe treeningkirjega" in briefing, briefing
                assert not evaluate("Boolean(document.querySelector('.case-rule-hint'))"), "Kinnitatud reegli plokk on alles"
                evaluate("document.querySelector('#labelActions button[data-label=\"supplement\"]').click()")
                label_feedback = json.loads(evaluate("JSON.stringify({result:labelExplanation.dataset.result,status:labelExplanationStatus.textContent,title:labelExplanationTitle.textContent,text:labelExplanationText.textContent,summaryHidden:stage2Feedback.hidden})"))
                assert label_feedback["result"] == "incorrect" and label_feedback["status"] == "VALE MÄRGEND", label_feedback
                assert label_feedback["title"] == "Õige vastus: „Kiire tugi”", label_feedback
                assert "Sinu valik: „Andmete täiendamine”." in label_feedback["text"] and "vale märgend treeningandmetesse" in label_feedback["text"], label_feedback
                assert label_feedback["summaryHidden"], label_feedback
                evaluate("labelExplanation.scrollIntoView({block:'center'})")
                time.sleep(0.25)
                screenshot("ai-andmetoo-wrong-label-feedback.png")
                evaluate("""(() => {
                  undoLabelChoice.click();
                  ['fast','standard','supplement','self'].forEach(label => {
                    document.querySelector(`#labelActions button[data-label="${label}"]`).click();
                    nextLabelCase.click();
                  });
                  document.querySelector('#labelActions button[data-label="review"]').click();
                })()""")
                time.sleep(0.25)
                before_summary = json.loads(evaluate("JSON.stringify({progress:labelProgress.textContent,nextText:nextLabelCase.textContent,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),centerDelta:Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left+document.querySelector('.control-card').getBoundingClientRect().width/2)-innerWidth/2))})"))
                assert before_summary["progress"] == "5 / 5 märgendatud" and before_summary["nextText"] == "Lõpeta märgendamine", before_summary
                assert before_summary["impactHidden"] and before_summary["pending"] and before_summary["centerDelta"] <= 10, before_summary
                evaluate("nextLabelCase.click()")
                time.sleep(0.25)
                five_case_end = json.loads(evaluate("JSON.stringify({progress:labelProgress.textContent,completeDisabled:document.querySelector('[data-complete=\"2\"]').disabled,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),centerDelta:Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left+document.querySelector('.control-card').getBoundingClientRect().width/2)-innerWidth/2))})"))
                assert five_case_end["progress"] == "5 / 5 märgendatud" and not five_case_end["completeDisabled"], five_case_end
                assert five_case_end["impactHidden"] and five_case_end["pending"] and five_case_end["centerDelta"] <= 10, five_case_end
                screenshot("ai-andmetoo-before-label-confirmation.png")
                evaluate("document.querySelector('[data-complete=\"2\"]').click()")
                time.sleep(0.25)
                after_confirmation = json.loads(evaluate("JSON.stringify({impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),dialogOpen:impactDialog.open,dialogAction:dialogContinue.textContent.trim()})"))
                assert after_confirmation == {"impactHidden": False, "pending": False, "dialogOpen": True, "dialogAction": "Märgenduse kokkuvõtte juurde"}, after_confirmation
                stage2_captions = json.loads(evaluate("""JSON.stringify(
                    [...document.querySelectorAll('#impactDialog .flow-node small')].map(node => node.textContent)
                )"""))
                assert stage2_captions == ["TREENINGKIRJED", "TREENINGANDMED", "KONTROLLKIRJED"], stage2_captions
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Märgendusvea mõju"
                ]
                evaluate("dialogContinue.click()")
                time.sleep(0.25)
                impact_transition = json.loads(evaluate("JSON.stringify({stage:state.currentStage,dialogOpen:impactDialog.open,impactHidden:impactCard.hidden,impactTitle:impactTitle.textContent,nextHidden:impactNextStep.hidden,nextText:continueFromImpact.textContent.trim(),focused:document.activeElement===impactCard})"))
                assert impact_transition == {"stage": 2, "dialogOpen": False, "impactHidden": False, "impactTitle": "Treeningkirjete märgenduse kokkuvõte", "nextHidden": False, "nextText": "Soovituste hindamise juurde", "focused": True}, impact_transition
                assert evaluate("[...document.querySelectorAll('.label-counts dd')].map(count => count.textContent)") == ["1"] * 5
                assert evaluate("categoryFact.textContent") == "5 / 5"
                assert evaluate("stageCounter.textContent") == "ETAPP 2 / 4"
                assert evaluate("document.querySelector('.control-card').inert")
                inactive_palette = evaluate("""(() => {
                  const panel = document.querySelector('.control-card');
                  return [getComputedStyle(panel).backgroundColor, getComputedStyle(panel).opacity,
                    getComputedStyle(panel.querySelector('.decision-stage.active h3')).color];
                })()""")
                assert inactive_palette == ["rgb(238, 242, 244)", "1", "rgb(67, 88, 101)"], inactive_palette
                assert evaluate("retryFromImpact.textContent") == "Märgenda kirjed uuesti"
                assert evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').textContent.trim()") == "Märgendus kinnitatud"
                screenshot("ai-andmetoo-label-impact-transition.png")
                evaluate("continueFromImpact.click()")
                time.sleep(0.25)
                stage3 = json.loads(evaluate("""JSON.stringify({
                  stepTitle: document.querySelector('[data-step="3"] b').textContent,
                  stageTitle: document.querySelector('[data-stage="3"] .control-title h3').textContent,
                  stageLead: document.querySelector('[data-stage="3"] .control-title p').textContent,
                  transition: document.querySelector('[data-stage="3"] .labeling-instruction-intro').textContent,
                  guideAvailable: labelGuide.closest('[data-stage]').dataset.stage === '3' && !labelGuide.open,
                  impactHidden: impactCard.hidden,
                  pending: document.querySelector('.lab-grid').classList.contains('impact-pending'),
                  centerDelta: Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left+document.querySelector('.control-card').getBoundingClientRect().width/2)-innerWidth/2)),
                  policyLabel: document.querySelector('label[for="interventionRule"] span').textContent,
                  policyOptions: [...interventionRule.options].map(option => option.textContent),
                  recommendationLabel: document.querySelector('#outputCase .output-recommendation span').textContent,
                  confidenceLabel: document.querySelector('#outputCase .confidence-ring small').textContent,
                  qualityPromptExists: Boolean(document.querySelector('#qualityReviewPrompt')),
                  impactLabelExists: Boolean(document.querySelector('#outputCase .impact-label')),
                  modelComparisonExists: Boolean(document.querySelector('#modelOutputViz')),
                  latestImpactExists: Boolean(document.querySelector('#latestLabelImpact')),
                  buttons: [...document.querySelectorAll('#reviewActions button')].map(button => button.textContent),
                  complete: document.querySelector('[data-complete="3"] span').textContent
                })"""))
                assert stage3["stepTitle"] == stage3["stageTitle"] == "Soovituste hindamine", stage3
                assert "kuvatud info ja märgendusjuhisega" in stage3["stageLead"] and stage3["guideAvailable"], stage3
                assert "Kindlusprotsendid on harjutuse näited" in stage3["transition"], stage3
                assert stage3["impactHidden"] and stage3["pending"] and stage3["centerDelta"] <= 10, stage3
                assert evaluate("stageCounter.textContent") == "ETAPP 3 / 4"
                assert evaluate("!document.querySelector('.control-card').inert")
                assert stage3["policyLabel"] == "Kuidas peaks amet mudeli kohta tagasisidet koguma?" and len(stage3["policyOptions"]) == 5 and stage3["policyOptions"][1] == "Hinda iga kasutatud soovitust", stage3
                assert stage3["recommendationLabel"] == "NÄIDISSOOVITUS" and stage3["confidenceLabel"] == "NÄITLIK KINDLUS" and not stage3["qualityPromptExists"] and not stage3["impactLabelExists"], stage3
                assert not stage3["modelComparisonExists"] and not stage3["latestImpactExists"], stage3
                assert stage3["buttons"] == ["Kasutatav", "Vajab parandamist", "Hinnanguks pole piisavalt infot"] and stage3["complete"] == "Kinnita kvaliteedihinnangud", stage3
                rating_matrix = evaluate("""outputCases.map(item =>
                    Object.keys(labelNames).map(suggestion => expectedReview(item, suggestion))
                )""")
                assert rating_matrix == [
                    ["correct", "correct", "accept", "correct", "correct"],
                    ["correct", "correct", "correct", "accept", "correct"],
                    ["correct", "accept", "correct", "correct", "correct"],
                    ["human", "human", "human", "human", "human"],
                ], rating_matrix
                for policy, style in [("every", "good"), ("sample", "good"), ("confidence", "warn"), ("complaint", "warn")]:
                    evaluate(f"interventionRule.value='{policy}'; interventionRule.dispatchEvent(new Event('change',{{bubbles:true}}))")
                    assert evaluate(f"stage3Feedback.classList.contains('{style}') && !stage3Feedback.hidden")
                evaluate("document.querySelector('[data-stage=\"3\"] .labeling-instruction-intro').scrollIntoView({block:'center'})")
                time.sleep(0.25)
                screenshot("ai-andmetoo-model-evaluation.png")
                evaluate("interventionRule.value='every'; interventionRule.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#reviewActions button[data-review=\"correct\"]').click()")
                time.sleep(0.25)
                quality_feedback = json.loads(evaluate("JSON.stringify({mark:document.querySelector('#outputCase .quality-result b').textContent,title:reviewExplanationTitle.textContent,text:reviewExplanationText.textContent,result:reviewExplanation.dataset.result,feedback:stage3Feedback.textContent,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending')})"))
                assert quality_feedback["mark"] == "Vajab parandamist" and quality_feedback["title"] == "Vajab parandamist" and quality_feedback["result"] == "correct", quality_feedback
                assert "Varasem takistus on lahendatud" in quality_feedback["text"] and "rohkem aega" in quality_feedback["feedback"] and quality_feedback["impactHidden"] and quality_feedback["pending"], quality_feedback
                assert evaluate("!reviewReference.hidden && reviewReferenceLabel.textContent === 'Iseseisev jätkamine'")
                assert "T-101 määratud märgendil „Kiire tugi”" in evaluate("reviewOrigin.textContent")
                screenshot("ai-andmetoo-quality-feedback.png")
                evaluate("nextReviewCase.click()")
                for recommendation, rating in [("Andmete täiendamine", "accept"), ("Tavaplaan", "accept"), ("Inimese ülevaatus", "human")]:
                    actual = evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent")
                    assert actual == recommendation, actual
                    evaluate(f"document.querySelector('#reviewActions button[data-review=\"{rating}\"]').click()")
                    assert evaluate("reviewExplanation.dataset.result") == "correct", recommendation
                    assert evaluate("reviewReference.hidden"), recommendation
                    evaluate("nextReviewCase.click()")
                time.sleep(0.25)
                before_quality_confirmation = json.loads(evaluate("JSON.stringify({completeDisabled:document.querySelector('[data-complete=\"3\"]').disabled,reviews:state.reviews.length,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending')})"))
                assert not before_quality_confirmation["completeDisabled"] and before_quality_confirmation["reviews"] == 4 and before_quality_confirmation["impactHidden"] and before_quality_confirmation["pending"], before_quality_confirmation
                assert "4 / 4 sinu hinnangust" in evaluate("outputCase.textContent")
                screenshot("ai-andmetoo-before-quality-confirmation.png")
                confirm_quality_and_check_transition()
                assert evaluate("state.reviews.slice()") == ["correct", "accept", "accept", "human"]
                time.sleep(0.25)
                stage4 = json.loads(evaluate("JSON.stringify({stage:state.currentStage,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),centerDelta:Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left+document.querySelector('.control-card').getBoundingClientRect().width/2)-innerWidth/2)),impactTitle:document.querySelector('#impactTitle').textContent})"))
                assert stage4["stage"] == 4 and stage4["impactHidden"] and stage4["pending"] and stage4["centerDelta"] <= 10, stage4
                evaluate("""(() => {
                  document.querySelectorAll('#ownershipGrid select').forEach(select => { select.value='internal'; select.dispatchEvent(new Event('change',{bubbles:true})); });
                  maintenanceCadence.value='quarterly'; maintenanceCadence.dispatchEvent(new Event('change',{bubbles:true}));
                  appealPolicy.value='owned'; appealPolicy.dispatchEvent(new Event('change',{bubbles:true}));
                  [...document.querySelectorAll('#exitAssets input')].slice(0,2).forEach(input => input.click());
                })()""")
                time.sleep(0.25)
                before_plan_confirmation = json.loads(evaluate("JSON.stringify({completeDisabled:document.querySelector('[data-complete=\"4\"]').disabled,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending')})"))
                assert before_plan_confirmation == {"completeDisabled": False, "impactHidden": True, "pending": True}, before_plan_confirmation
                screenshot("ai-andmetoo-before-plan-confirmation.png")
                evaluate("document.querySelector('[data-complete=\"4\"]').click()")
                time.sleep(0.25)
                after_plan_confirmation = json.loads(evaluate("JSON.stringify({dialogOpen:impactDialog.open,completed:state.completed.has(4),completedCount:completedCount.textContent,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),impactTitle:document.querySelector('#impactTitle').textContent})"))
                assert after_plan_confirmation == {"dialogOpen": True, "completed": True, "completedCount": "4", "impactHidden": True, "pending": True, "impactTitle": "Treeningkirjete märgenduse kokkuvõte"}, after_plan_confirmation
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Kuidas kontrollida parandust?"
                ]
                assert evaluate("!resultSection.hidden && tradeoffList.children.length === 4")
                assert evaluate("planSummary.querySelectorAll('dd').length") == 7
                assert "Ameti valdkonnaeksperdid" in evaluate("planSummary.textContent")
                assert "Vaidlustatud registrinäited koos põhjendustega" in evaluate("planSummary.textContent")
                assert "Kontrollitud testprofiilid" not in evaluate("planSummary.textContent")
                assert evaluate("!resultSection.querySelector('#profileTitle, #profileText, #profileTags')")
                evaluate("dialogContinue.click(); document.querySelector('[data-step=\"2\"]').click()")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                evaluate("retryFromImpact.click()")
                assert evaluate("!document.querySelector('.control-card').inert && impactCard.hidden && state.labels.length === 0")
                evaluate("""(() => {
                  for (const label of ['self', 'fast', 'fast', 'self', 'review']) {
                    document.querySelector('#labelActions button[data-label="' + label + '"]').click();
                    nextLabelCase.click();
                  }
                })()""")
                assert not evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                assert evaluate("!stage2Feedback.hidden")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').textContent.trim()") == "Kinnita märgendus"
                assert evaluate("document.querySelector('[data-step=\"3\"]').disabled")
                evaluate("document.querySelector('[data-complete=\"2\"]').click(); dialogContinue.click(); continueFromImpact.click()")
                assert evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent") == "Iseseisev jätkamine"
                evaluate("document.querySelector('#reviewActions button[data-review=\"accept\"]').click()")
                assert evaluate("!reviewExplanation.hidden && reviewExplanation.dataset.result === 'correct'")
                assert "T-101 määratud märgendil „Iseseisev jätkamine”" in evaluate("reviewOrigin.textContent")
                evaluate("nextReviewCase.click()")
                assert "T-202" in evaluate("outputCase.textContent")
                assert evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent") == "Kiire tugi"
                evaluate("document.querySelector('#reviewActions button[data-review=\"accept\"]').click()")
                assert evaluate("reviewExplanation.dataset.result") == "incorrect"
                assert evaluate("reviewExplanationTitle.textContent") == "Vali hinnanguks „Vajab parandamist”"
                assert evaluate("!reviewReference.hidden && reviewReferenceLabel.textContent === 'Andmete täiendamine'")
                assert evaluate("reviewReference.querySelector('small').textContent") == "Juhise järgi sobiv märgend"
                assert "T-103 määratud märgendil „Kiire tugi”" in evaluate("reviewOrigin.textContent")
                assert not evaluate("reviewReference.querySelector('button') !== null")
                assert "Andmete täiendamine" not in evaluate("reviewExplanationText.textContent")
                evaluate("reviewExplanation.scrollIntoView({block:'center',behavior:'instant'})")
                screenshot("ai-andmetoo-t202-review-feedback.png")
                evaluate("undoReviewChoice.click()")
                assert evaluate("[...reviewActions.querySelectorAll('button')].map(button => button.textContent)") == [
                    "Kasutatav", "Vajab parandamist", "Hinnanguks pole piisavalt infot"
                ]
                evaluate("document.querySelector('#reviewActions button[data-review=\"correct\"]').click()")
                assert evaluate("!reviewExplanation.hidden && reviewExplanation.dataset.result === 'correct'")
                evaluate("nextReviewCase.click()")
                assert "T-203" in evaluate("outputCase.textContent")
                assert evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent") == "Kiire tugi"
                evaluate("document.querySelector('#reviewActions button[data-review=\"accept\"]').click()")
                assert evaluate("reviewExplanation.dataset.result") == "incorrect"
                assert evaluate("reviewExplanationTitle.textContent") == "Vali hinnanguks „Vajab parandamist”"
                evaluate("undoReviewChoice.click(); document.querySelector('#reviewActions button[data-review=\"correct\"]').click()")
                assert evaluate("reviewExplanation.dataset.result") == "correct"
                assert evaluate("!reviewReference.hidden && reviewReferenceLabel.textContent === 'Tavaplaan'")
                evaluate("nextReviewCase.click(); document.querySelector('#reviewActions [data-review=\"correct\"]').click()")
                assert evaluate("nextReviewCase.textContent") == "Vaata hinnangute kokkuvõtet"
                evaluate("nextReviewCase.click()")
                command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
                confirm_quality_and_check_transition()
                assert evaluate("state.reviews.slice()") == ["accept", "correct", "correct", "correct"]
                assert evaluate("document.documentElement.scrollWidth <= innerWidth")
                evaluate("document.querySelector('[data-step=\"3\"]').click()")
                assert evaluate("impactCard.hidden && document.querySelector('[data-complete=\"3\"]').disabled")
                evaluate("document.querySelector('[data-rereview]').click()")
                assert evaluate("state.currentStage === 3 && !document.querySelector('.control-card').inert && impactCard.hidden && state.reviews.length === 0")
                assert evaluate("document.querySelector('[data-step=\"4\"]').disabled")
                command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

        command("Page.navigate", {"url": URL + "kraapimine/"})
        wait_for_path("/kraapimine/")
        evaluate("[...document.querySelectorAll('#permissionChecklist input')].forEach(input=>input.click()); document.querySelector('[data-run=\"1\"]').click()")
        wait_for_counter("SAMM 2 / 5")
        evaluate("recordSelector.value='.quote'; textSelector.value='.text'; authorSelector.value='.author'; tagSelector.value='.tags .tag'; selectorFields.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('[data-run=\"2\"]').click()")
        wait_for_counter("SAMM 3 / 5")
        before_scrape = json.loads(evaluate("JSON.stringify({step:document.querySelector('.lesson-panel:not([hidden])').dataset.lesson,hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending')})"))
        assert before_scrape == {"step": "3", "hidden": True, "pending": True}, before_scrape
        assert evaluate("currentStepLabel.textContent") == "SAMM 3 / 5"
        run_dialog_step(3)
        wait_for_counter("SAMM 4 / 5")
        after_scrape = json.loads(evaluate("JSON.stringify({hidden:stageCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('result-pending'),rows:rowCount.textContent})"))
        assert after_scrape == {"hidden": False, "pending": False, "rows": "10"}, after_scrape
        assert evaluate("resultRows.rows[0].cells.length === 2")
        run_dialog_step(4)
        wait_for_counter("SAMM 5 / 5")
        assert evaluate("""rowCount.textContent === '20' && pageCount.textContent === '2'
          && resultRows.rows[0].cells.length === 4
          && resultRows.querySelector('a[href="https://quotes.toscrape.com/page/2/"]') !== null""")
        evaluate("document.querySelector('[data-run=\"5\"]').click()")
        assert evaluate("""progressValue.textContent === '100%' && missingCount.textContent === '0'
          && duplicateCount.textContent === '0' && !qualityResults.hidden && !practiceSuite.inert
          && rExportExample.textContent.includes('write.csv(andmed, "tsitaadid.csv"')""")
        evaluate("scenarioInput.value='file'; methodInput.value='file'; methodInput.dispatchEvent(new Event('change',{bubbles:true}))")
        assert evaluate("!decisionPreview.hidden && decisionPreview.classList.contains('good')")
        evaluate("stageCard.scrollIntoView({block:'start', behavior:'instant'})")
        screenshot("kraapimine-result.png")
        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        evaluate("stageCard.scrollIntoView({block:'start', behavior:'instant'})")
        assert evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth")
        screenshot("kraapimine-result-mobile.png")

        command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        command("Page.navigate", {"url": URL})
        wait_for_path("/")
        mobile = json.loads(evaluate("""JSON.stringify({
          width: document.documentElement.clientWidth,
          links: document.querySelectorAll('.practicum-link').length,
          columns: getComputedStyle(document.querySelector('.practicum-group')).gridTemplateColumns.split(' ').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          linksFit: [...document.querySelectorAll('.practicum-link')].every(link => link.getBoundingClientRect().right <= innerWidth)
        })"""))
        assert mobile == {"width": 390, "links": 5, "columns": 1, "overflow": False, "linksFit": True}, mobile
        assert_shared_footer(1)
        screenshot("landing-mobile.png")

        mobile_modules = {}
        for route in modules:
            open_practicum(route)
            assert_shared_footer(1)
            state = json.loads(evaluate("""JSON.stringify({
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              homeFits: document.querySelector('.api-home-link').getBoundingClientRect().right <= innerWidth,
              selectFits: document.querySelector('.api-version-select').getBoundingClientRect().right <= innerWidth,
              options: document.querySelectorAll('.api-version-select option').length
            })"""))
            assert state == {"overflow": False, "homeFits": True, "selectFits": True, "options": 5}, {route: state}
            assert evaluate("""(() => {
              const badge = document.querySelector('.control-head .stage-counter');
              const rect = badge.getBoundingClientRect();
              return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 40;
            })()"""), route
            reading_sizes = evaluate("""[
              parseFloat(getComputedStyle(document.querySelector('.hero-description')).fontSize),
              parseFloat(getComputedStyle(document.querySelector('.footer-note > span')).fontSize)
            ]""")
            assert reading_sizes[0] >= 16 and reading_sizes[1] >= 14, {route: reading_sizes}
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
