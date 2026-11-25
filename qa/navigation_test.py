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

        def confirm_quality_and_check_summary():
            point = evaluate("""(() => {
              const button = document.querySelector('[data-complete="3"]');
              button.scrollIntoView({block:'center', behavior:'instant'});
              const box = button.getBoundingClientRect();
              return {x: box.left + box.width / 2, y: box.top + box.height / 2};
            })()""")
            for event_type in ("mousePressed", "mouseReleased"):
                command("Input.dispatchMouseEvent", {"type": event_type, "button": "left", "clickCount": 1, **point})

            summary = evaluate("""({
              stage: state.currentStage,
              dialogOpen: impactDialog.open,
              completed: state.completed.has(3),
              completedCount: completedCount.textContent,
              focused: document.activeElement === impactCard,
              impactVisible: !impactCard.hidden && !reviewImpactSummary.hidden,
              impactTitle: impactTitle.textContent,
              canConfirmAgain: !document.querySelector('[data-complete="3"]').disabled,
              controlsInactive: document.querySelector('.control-card').inert,
              controlsGray: getComputedStyle(document.querySelector('.control-card')).filter === 'grayscale(1)',
              retryText: retryFromImpact.textContent
            })""")
            assert summary == {
                "stage": 3,
                "dialogOpen": False,
                "completed": True,
                "completedCount": "3",
                "focused": True,
                "impactVisible": True,
                "impactTitle": "Mida tuleb järgmises mudeliversioonis parandada?",
                "canConfirmAgain": False,
                "controlsInactive": True,
                "controlsGray": True,
                "retryText": "Hinda väljundeid uuesti",
            }, summary
            for _ in range(20):
                top = evaluate("impactTitle.getBoundingClientRect().top")
                if 0 <= top < 140:
                    break
                time.sleep(0.05)
            else:
                raise AssertionError(f"Summary heading outside the top of the viewport: {top}")

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
                assert intro == "MIS ON MÄRGENDUSJUHIS? Märgendusjuhis on ühine reeglistik, mis selgitab, mida iga märgend tähendab ja millise nähtava info põhjal seda kasutada. Selge juhis aitab eri märgendajatel samasuguste registriandmetega tööotsijaid ühtemoodi hinnata ning loob mudelile järjepidevad treeningandmed.", intro
                label_requirement = json.loads(evaluate("JSON.stringify({cue:activeTaskCue.querySelector('b').textContent,intro:document.querySelector('#availableLabelChoices .choice-intro').textContent})"))
                assert label_requirement == {"cue": "Vali kõik 5 märgendit", "intro": "Vali kõik viis märgendit."}, label_requirement
                assert evaluate("document.querySelector('#sourceChoices .choice-intro').textContent") == "Vali kõik viis andmevälja."
                evaluate("document.querySelector('#availableLabelChoices input[value=\"fast\"]').click(); document.querySelector('#availableLabelChoices input[value=\"standard\"]').click()")
                two_labels = json.loads(evaluate("JSON.stringify({button:document.querySelector('[data-complete=\"1\"]').disabled,cue:activeTaskCue.querySelector('b').textContent,feedback:stage1Feedback.textContent})"))
                assert two_labels["button"] and two_labels["cue"] == "Vali kõik 5 märgendit" and "Vali veel 3 märgendit" in two_labels["feedback"], two_labels
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
                assert evaluate("activeTaskCue.querySelector('b').textContent") == "Vali kõik 5 andmevälja"
                assert "Vali veel 1 andmeväli" in evaluate("stage1Feedback.textContent")
                evaluate("document.querySelector('#sourceChoices input[value=\"freshness\"]').click()")
                evaluate("document.querySelector('#availableLabelChoices input[value=\"self\"]').click()")
                assert evaluate("document.querySelector('[data-complete=\"1\"]').disabled")
                assert "Vali veel 1 märgend" in evaluate("stage1Feedback.textContent")
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
                assert stage1_captions == ["ANDMED JA JUHIS", "MÄRGENDAMINE", "MUDELI ÕPPIMINE"], stage1_captions
                assert evaluate("dialogMiddle.textContent") == "Kirjeid märgendades saad kasutada 5 märgendit ja 5 andmevälja"
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Valitud märgendid", "Märgendajale nähtavad väljad", "Märgendusreegel", "Mida mudel saab õppida?"
                ]
                assert evaluate("[...dialogInsight.querySelectorAll('ul')].map(list => list.children.length)") == [5, 5]
                assert "Andmete kontrollimise aeg" in evaluate("dialogInsight.textContent")
                assert "Lähtu märgendusjuhisest." in evaluate("dialogInsight.textContent")
                assert evaluate("getComputedStyle(dialogInsight).gridTemplateColumns.split(' ').length") == 2
                screenshot("ai-andmetoo-choice-summary.png")
                command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
                assert evaluate("getComputedStyle(dialogInsight).gridTemplateColumns.split(' ').length") == 1
                assert evaluate("impactDialog.scrollWidth <= impactDialog.clientWidth")
                evaluate("dialogInsight.scrollIntoView({block: 'start', behavior: 'instant'})")
                screenshot("ai-andmetoo-choice-summary-mobile.png")
                command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
                evaluate("dialogContinue.click()")
                time.sleep(0.25)
                five_case_start = json.loads(evaluate("JSON.stringify({total:labelCases.length,progress:labelProgress.textContent,step:document.querySelector('[data-step=\"2\"] small').textContent,caseId:document.querySelector('#labelCase .case-top span').textContent,caseTitle:document.querySelector('#labelCase h4').textContent,trainingIds:labelCases.map(item=>item.id),trainingTitles:labelCases.map(item=>item.title),outputIds:outputCases.map(item=>item.id),outputTitles:outputCases.map(item=>item.title),briefing:document.querySelector('.briefing-copy').textContent})"))
                assert evaluate("parseFloat(getComputedStyle(activeTaskCue.querySelector('small')).fontSize)") >= 16
                assert five_case_start["total"] == 5 and five_case_start["progress"] == "0 / 5 märgendatud", five_case_start
                assert evaluate("document.querySelectorAll('#labelCase .case-data-grid > div').length") == 5
                assert evaluate("labelCases.every(item => Object.keys(fieldNames).every(key => item.fields[key]))")
                assert "Andmete kontrollimise aeg" in evaluate("labelCase.textContent")
                assert five_case_start["step"] == "5 registrikirjet · valik, põhjendus ja parandus" and five_case_start["caseId"] == "T-101 · 1/5" and five_case_start["caseTitle"] == "Tööotsija T-101", five_case_start
                assert five_case_start["trainingIds"] == ["T-101", "T-102", "T-103", "T-104", "T-105"] and five_case_start["trainingTitles"] == ["Tööotsija T-101", "Tööotsija T-102", "Tööotsija T-103", "Tööotsija T-104", "Tööotsija T-105"], five_case_start
                assert five_case_start["outputIds"] == ["T-201", "T-202", "T-203", "T-204"] and five_case_start["outputTitles"] == ["Tööotsija T-201", "Tööotsija T-202", "Tööotsija T-203", "Tööotsija T-204"], five_case_start
                briefing = five_case_start["briefing"]
                assert "igale registreeritud tööotsijale" in briefing, briefing
                assert "Ametnik otsustab" in briefing and "kasutada tehisarumudeli soovitust" in briefing, briefing
                assert "märgendad viis anonüümset tööotsija kirjet" in briefing and ".csv" not in briefing, briefing
                assert "hindad mudeli väljundeid" in briefing and "mida järgmises mudeliversioonis parandada" in briefing, briefing
                assert not evaluate("Boolean(document.querySelector('.case-rule-hint'))"), "Kinnitatud reegli plokk on alles"
                evaluate("document.querySelector('#labelActions button[data-label=\"supplement\"]').click()")
                label_feedback = json.loads(evaluate("JSON.stringify({result:labelExplanation.dataset.result,status:labelExplanationStatus.textContent,title:labelExplanationTitle.textContent,text:labelExplanationText.textContent,summary:stage2Feedback.textContent,summaryHidden:stage2Feedback.hidden})"))
                assert label_feedback["result"] == "incorrect" and label_feedback["status"] == "VALE MÄRGEND", label_feedback
                assert label_feedback["title"] == "Õige vastus: „Kiire tugi”", label_feedback
                assert "Sinu valik: „Andmete täiendamine”." in label_feedback["text"] and "vale märgend treeningandmetesse" in label_feedback["text"], label_feedback
                assert "Vale märgend." in label_feedback["summary"] and "Õige vastus: „Kiire tugi”" in label_feedback["summary"], label_feedback
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
                assert before_summary["progress"] == "5 / 5 märgendatud" and before_summary["nextText"] == "Vaata märgenduse kokkuvõtet", before_summary
                assert before_summary["impactHidden"] and before_summary["pending"] and before_summary["centerDelta"] <= 10, before_summary
                evaluate("nextLabelCase.click()")
                time.sleep(0.25)
                five_case_end = json.loads(evaluate("JSON.stringify({progress:labelProgress.textContent,summary:document.querySelector('#labelCase .case-top b').textContent,completeDisabled:document.querySelector('[data-complete=\"2\"]').disabled,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),fact:labeledFact.textContent,centerDelta:Math.round(Math.abs((document.querySelector('.control-card').getBoundingClientRect().left+document.querySelector('.control-card').getBoundingClientRect().width/2)-innerWidth/2)),cue:activeTaskCue.textContent})"))
                assert five_case_end["progress"] == "5 / 5 märgendatud" and five_case_end["summary"] == "5 registrikirjet" and not five_case_end["completeDisabled"], five_case_end
                assert five_case_end["impactHidden"] and five_case_end["pending"] and five_case_end["centerDelta"] <= 10 and "Kinnita märgendus" in five_case_end["cue"], five_case_end
                screenshot("ai-andmetoo-before-label-confirmation.png")
                evaluate("document.querySelector('[data-complete=\"2\"]').click()")
                time.sleep(0.25)
                after_confirmation = json.loads(evaluate("JSON.stringify({impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending'),dialogOpen:impactDialog.open,dialogAction:dialogContinue.textContent.trim()})"))
                assert after_confirmation == {"impactHidden": False, "pending": False, "dialogOpen": True, "dialogAction": "Vaata märgenduse mõju"}, after_confirmation
                stage2_captions = json.loads(evaluate("""JSON.stringify(
                    [...document.querySelectorAll('#impactDialog .flow-node small')].map(node => node.textContent)
                )"""))
                assert stage2_captions == ["MÄRGENDAMINE", "TREENINGANDMED", "MUDELI SOOVITUSED"], stage2_captions
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Millest mudel õpib?", "Mõju järgmistele soovitustele"
                ]
                evaluate("dialogContinue.click()")
                time.sleep(0.25)
                impact_transition = json.loads(evaluate("JSON.stringify({stage:state.currentStage,dialogOpen:impactDialog.open,impactHidden:impactCard.hidden,impactTitle:impactTitle.textContent,nextHidden:impactNextStep.hidden,nextText:continueFromImpact.textContent.trim(),focused:document.activeElement===impactCard})"))
                assert impact_transition == {"stage": 2, "dialogOpen": False, "impactHidden": False, "impactTitle": "Mida mudel sinu märgenditest õpib?", "nextHidden": False, "nextText": "Jätka mudeli väljundite hindamisega", "focused": True}, impact_transition
                assert evaluate("document.querySelector('.control-card').inert")
                assert evaluate("getComputedStyle(document.querySelector('.control-card')).filter === 'grayscale(1)'")
                assert evaluate("retryFromImpact.textContent") == "Märgenda kirjed uuesti"
                assert evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').textContent.trim()") == "Märgendus kinnitatud"
                screenshot("ai-andmetoo-label-impact-transition.png")
                evaluate("continueFromImpact.click()")
                time.sleep(0.25)
                stage3 = json.loads(evaluate("""JSON.stringify({
                  stepTitle: document.querySelector('[data-step="3"] b').textContent,
                  stepDetail: document.querySelector('[data-step="3"] small').textContent,
                  stageTitle: document.querySelector('[data-stage="3"] .control-title h3').textContent,
                  stageLead: document.querySelector('[data-stage="3"] .control-title p').textContent,
                  transition: document.querySelector('[data-stage="3"] .labeling-instruction-intro').textContent,
                  cue: activeTaskCue.textContent,
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
                assert stage3["stepTitle"] == "Hinda mudeli väljundeid" and "kvaliteedimärge" in stage3["stepDetail"] and "arendusmeeskonnale" in stage3["stepDetail"], stage3
                assert stage3["stageTitle"] == "Kui kvaliteetsed on mudeli soovitused?" and "Teenuseotsuse eest vastutab ametnik" in stage3["stageLead"] and "varem valitud märgendid" in stage3["stageLead"], stage3
                assert "Märgendamistöö on lõppenud." in stage3["transition"] and "uute registrikirjete" in stage3["transition"] and "arendajal ja tooteomanikul" in stage3["transition"], stage3
                assert stage3["impactHidden"] and stage3["pending"] and stage3["centerDelta"] <= 10, stage3
                assert evaluate("!document.querySelector('.control-card').inert")
                assert "tagasisidet kogub" in stage3["cue"] and "Võrdle kuvatud soovitust kontrollkirje infoga" in stage3["cue"], stage3
                assert stage3["policyLabel"] == "Kuidas peaks amet mudeli kohta tagasisidet koguma?" and len(stage3["policyOptions"]) == 5 and stage3["policyOptions"][1] == "Hinda iga kasutatud soovitust", stage3
                assert stage3["recommendationLabel"] == "MUDELI SOOVITUS" and stage3["confidenceLabel"] == "MUDELI KINDLUS" and not stage3["qualityPromptExists"] and not stage3["impactLabelExists"], stage3
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
                assert "Iseseisev jätkamine" in quality_feedback["text"] and "rohkem aega" in quality_feedback["feedback"] and quality_feedback["impactHidden"] and quality_feedback["pending"], quality_feedback
                screenshot("ai-andmetoo-quality-feedback.png")
                evaluate("nextReviewCase.click()")
                for recommendation, rating in [("Andmete täiendamine", "accept"), ("Tavaplaan", "accept"), ("Inimese ülevaatus", "human")]:
                    actual = evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent")
                    assert actual == recommendation, actual
                    evaluate(f"document.querySelector('#reviewActions button[data-review=\"{rating}\"]').click()")
                    assert evaluate("reviewExplanation.dataset.result") == "correct", recommendation
                    evaluate("nextReviewCase.click()")
                time.sleep(0.25)
                before_quality_confirmation = json.loads(evaluate("JSON.stringify({completeDisabled:document.querySelector('[data-complete=\"3\"]').disabled,reviews:state.reviews.length,impactHidden:impactCard.hidden,pending:document.querySelector('.lab-grid').classList.contains('impact-pending')})"))
                assert not before_quality_confirmation["completeDisabled"] and before_quality_confirmation["reviews"] == 4 and before_quality_confirmation["impactHidden"] and before_quality_confirmation["pending"], before_quality_confirmation
                assert "4 / 4 sinu hinnangust" in evaluate("outputCase.textContent")
                screenshot("ai-andmetoo-before-quality-confirmation.png")
                confirm_quality_and_check_summary()
                assert evaluate("trainingFlow.hidden && trainingImpact.hidden && !reviewImpactSummary.hidden")
                assert evaluate("[...reviewImpactDetails.querySelectorAll('strong')].map(node => node.textContent)") == [
                    "T-201 · Vajab parandamist", "T-204 · Hinnanguks pole piisavalt infot"
                ]
                assert evaluate("state.currentStage === 3 && !impactNextStep.hidden")
                assert evaluate("continueFromImpact.textContent.trim()") == "Jätka paranduskava juurde"
                evaluate("continueFromImpact.click()")
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
                assert after_plan_confirmation == {"dialogOpen": True, "completed": True, "completedCount": "4", "impactHidden": False, "pending": False, "impactTitle": "Kuidas jõuavad parandused järgmisse versiooni?"}, after_plan_confirmation
                assert evaluate("[...dialogInsight.querySelectorAll('h3')].map(title => title.textContent)") == [
                    "Mida tasub säilitada?", "Kontroll järgmises versioonis"
                ]
                assert evaluate("dialogInsight.querySelectorAll('li').length") == 4
                evaluate("dialogContinue.click(); document.querySelector('[data-step=\"2\"]').click()")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                evaluate("retryFromImpact.click()")
                assert evaluate("!document.querySelector('.control-card').inert && impactCard.hidden && state.labels.length === 0")
                evaluate("""(() => {
                  for (const label of ['self', 'fast', 'standard', 'self', 'review']) {
                    document.querySelector('#labelActions button[data-label="' + label + '"]').click();
                    nextLabelCase.click();
                  }
                })()""")
                assert not evaluate("document.querySelector('[data-complete=\"2\"]').disabled")
                assert evaluate("document.querySelector('[data-complete=\"2\"]').textContent.trim()") == "Kinnita märgendus"
                assert evaluate("document.querySelector('[data-step=\"3\"]').disabled")
                evaluate("document.querySelector('[data-complete=\"2\"]').click(); dialogContinue.click(); continueFromImpact.click()")
                for recommendation, rating in [("Iseseisev jätkamine", "accept"), ("Tavaplaan", "correct")]:
                    actual = evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent")
                    assert actual == recommendation, actual
                    assert not evaluate(f"document.querySelector('#reviewActions button[data-review=\"{rating}\"]').disabled")
                    evaluate(f"document.querySelector('#reviewActions button[data-review=\"{rating}\"]').click()")
                    assert evaluate("!reviewExplanation.hidden && reviewExplanation.dataset.result === 'correct'"), recommendation
                    evaluate("nextReviewCase.click()")
                assert "T-203" in evaluate("outputCase.textContent")
                assert evaluate("document.querySelector('#outputCase .output-recommendation strong').textContent") == "Kiire tugi"
                evaluate("document.querySelector('#reviewActions button[data-review=\"accept\"]').click()")
                assert evaluate("reviewExplanation.dataset.result") == "incorrect"
                assert evaluate("reviewExplanationTitle.textContent") == "Sobiv hinnang on „Vajab parandamist”"
                evaluate("undoReviewChoice.click(); document.querySelector('#reviewActions button[data-review=\"correct\"]').click()")
                assert evaluate("reviewExplanation.dataset.result") == "correct"
                assert "Sobiv soovitus on „Tavaplaan”" in evaluate("reviewExplanationText.textContent")
                evaluate("nextReviewCase.click(); document.querySelector('#reviewActions [data-review=\"human\"]').click(); nextReviewCase.click()")
                command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
                confirm_quality_and_check_summary()
                evaluate("retryFromImpact.click()")
                assert evaluate("state.currentStage === 3 && !document.querySelector('.control-card').inert && impactCard.hidden && state.reviews.length === 0")
                command("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})

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
