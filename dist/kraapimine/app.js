(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const TOTAL_STEPS = 5;

  const stepTitles = [
    "Hinda andmeallikat",
    "Leia CSS-selektorid",
    "Kraabi esimene leht",
    "Kogu kaks lehte",
    "Kontrolli kvaliteeti"
  ];

  const completedLabels = [
    "Kraapimisotsus kinnitatud",
    "Selektorid kinnitatud",
    "Esimene leht kraabitud",
    "Kaks lehte kogutud",
    "Kvaliteet kontrollitud"
  ];

  const initialLabels = [
    "Kinnita kraapimisotsus",
    "Kinnita selektorid",
    "Kraabi esimene leht",
    "Kogu mõlemad lehed",
    "Käivita kvaliteedikontroll"
  ];

  const sampleRows = [
    { quote: "The world as we have created it is a process…", author: "Albert Einstein", tags: "change; deep-thoughts; thinking; world", page: 1 },
    { quote: "It is our choices, Harry, that show what we truly are…", author: "J.K. Rowling", tags: "abilities; choices", page: 1 },
    { quote: "There are only two ways to live your life…", author: "Albert Einstein", tags: "inspirational; life; live; miracle; miracles", page: 1 },
    { quote: "The person, be it gentleman or lady, who has not pleasure…", author: "Jane Austen", tags: "aliteracy; books; classic; humor", page: 1 },
    { quote: "Imperfection is beauty, madness is genius…", author: "Marilyn Monroe", tags: "be-yourself; inspirational", page: 1 },
    { quote: "Try not to become a man of success. Rather become…", author: "Albert Einstein", tags: "adulthood; success; value", page: 1 },
    { quote: "It is better to be hated for what you are…", author: "André Gide", tags: "life; love", page: 1 },
    { quote: "I have not failed. I've just found 10,000 ways…", author: "Thomas A. Edison", tags: "edison; failure; inspirational; paraphrased", page: 1 },
    { quote: "A woman is like a tea bag; you never know…", author: "Eleanor Roosevelt", tags: "misattributed-eleanor-roosevelt", page: 1 },
    { quote: "A day without sunshine is like, you know, night.", author: "Steve Martin", tags: "humor; obvious; simile", page: 1 },
    { quote: "This life is what you make it. No matter what…", author: "Marilyn Monroe", tags: "friends; heartbreak; inspirational; life; love; sisters", page: 2 },
    { quote: "It takes a great deal of bravery to stand up…", author: "J.K. Rowling", tags: "courage; friends", page: 2 },
    { quote: "If you can't explain it to a six year old…", author: "Albert Einstein", tags: "simplicity; understand", page: 2 },
    { quote: "You may not be her first, her last, or her only…", author: "Bob Marley", tags: "love", page: 2 },
    { quote: "I like nonsense, it wakes up the brain cells…", author: "Dr. Seuss", tags: "fantasy", page: 2 },
    { quote: "I may not have gone where I intended to go…", author: "Douglas Adams", tags: "life; navigation", page: 2 },
    { quote: "The opposite of love is not hate, it's indifference…", author: "Elie Wiesel", tags: "activism; apathy; hate; indifference; inspirational; love; opposite; philosophy", page: 2 },
    { quote: "It is not a lack of love, but a lack of friendship…", author: "Friedrich Nietzsche", tags: "friendship; lack-of-friendship; lack-of-love; love; marriage; unhappy-marriage", page: 2 },
    { quote: "Good friends, good books, and a sleepy conscience…", author: "Mark Twain", tags: "books; contentment; friends; friendship; life", page: 2 },
    { quote: "Life is what happens to us while we are making other plans.", author: "Allen Saunders", tags: "fate; life; misattributed-john-lennon; planning; plans", page: 2 }
  ];

  const dialogConfigs = {
    3: { kicker: "R KÜSIB ESIMESE LEHE HTML-I", endpoint: "/page/1/", action: "Eraldab 10 tsitaadiplokki", result: "10 kirjet jõudis R-i andmetabelisse." },
    4: { kicker: "R KÜSIB KAHE LEHE HTML-I", endpoint: "/page/1/ ja /page/2/", action: "Ühendab kaks andmetabelit", result: "20 kirjet on koos metaandmetega tabelis." }
  };

  const decisionAnswers = {
    few: { method: "manual", title: "Käsitsi on siin mõistlik", text: "Kolme ühekordse väärtuse jaoks võib käsitsi kopeerimine olla läbipaistvam kui uue töövoo ehitamine." },
    file: { method: "file", title: "Eelista ametlikku faili", text: "CSV säilitab andmestruktuuri ning väldib veebilehe HTML-ist sõltumist." },
    api: { method: "api", title: "Eelista dokumenteeritud API-t", text: "API annab selge otspunkti, parameetrid ja masinloetava vastuse." },
    static: { method: "rvest", title: "R + rvest sobib", text: "Staatilise HTML-i 20 kirjet saab korratava skriptiga koguda ja kontrollida." },
    restricted: { method: "stop", title: "Peatu ja küsi volitust", text: "Ligipääs siseveebi ei anna automaatselt õigust sisu välja võtta, säilitada või edasi saata." }
  };

  const els = {
    progressValue: $("#progressValue"), progressText: $("#progressText"), progressBar: $("#progressBar"),
    completedCount: $("#completedCount"), currentStepLabel: $("#currentStepLabel"), labGrid: $(".lab-grid"), stageCard: $("#stageCard"),
    statusChip: $("#statusChip"), statusText: $("#statusText"), responseContext: $("#responseContext"),
    responseContextLabel: $("#responseContextLabel"), responseContextText: $("#responseContextText"),
    dataPanel: $("#dataPanel"), resultRows: $("#resultRows"), rowCount: $("#rowCount"), pageCount: $("#pageCount"),
    missingCount: $("#missingCount"), duplicateCount: $("#duplicateCount"), tableState: $("#tableState"),
    qualityResults: $("#qualityResults"),
    permissionChecklist: $("#permissionChecklist"), permissionFeedback: $("#permissionFeedback"),
    selectorFields: $("#selectorFields"), selectorFeedback: $("#selectorFeedback"),
    prevLesson: $("#prevLesson"), nextLesson: $("#nextLesson"), lessonDots: $("#lessonDots"),
    practiceSuite: $("#practiceSuite"), scenarioInput: $("#scenarioInput"), methodInput: $("#methodInput"),
    decisionPreview: $("#decisionPreview"), inspectorHelpOpen: $("#inspectorHelpOpen"),
    inspectorHelpDialog: $("#inspectorHelpDialog"), inspectorHelpClose: $("#inspectorHelpClose"),
    flowDialog: $("#flowDialog"), flowDialogKicker: $("#flowDialogKicker"),
    dialogFlowStage: $("#dialogFlowStage"), dialogFlowStatus: $("#dialogFlowStatus"), dialogApiName: $("#dialogApiName"),
    dialogServiceAction: $("#dialogServiceAction"), flowDialogResult: $("#flowDialogResult"), flowDialogClose: $("#flowDialogClose")
  };

  let currentStep = 1;
  let completed = 0;
  let running = false;
  let pendingDialogStep = 0;

  function syncHeight() {
    if (window.self === window.top) return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "simfluence:resize", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }

  function setResultPanelVisible(visible) {
    els.stageCard.hidden = !visible;
    els.labGrid.classList.toggle("result-pending", !visible);
    syncHeight();
  }

  function updateProgress() {
    const percent = Math.round((completed / TOTAL_STEPS) * 100);
    els.progressValue.textContent = `${percent}%`;
    els.progressBar.style.width = `${percent}%`;
    els.completedCount.textContent = String(completed);
    els.progressText.textContent = completed === TOTAL_STEPS ? "Praktikum on valmis" : stepTitles[Math.min(completed, TOTAL_STEPS - 1)];
    $$(".step").forEach((button) => {
      const step = Number(button.dataset.step);
      button.classList.toggle("done", step <= completed);
      button.disabled = step > completed + 1;
    });
  }

  function renderDots() {
    els.lessonDots.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, index) => `<i class="${index + 1 === currentStep ? "active" : index + 1 <= completed ? "done" : ""}"></i>`).join("");
  }

  function showStep(step, manual = false) {
    if (step < 1 || step > TOTAL_STEPS || step > completed + 1) return;
    currentStep = step;
    $$(".lesson-panel").forEach((panel) => {
      const active = Number(panel.dataset.lesson) === step;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    $$(".step").forEach((button) => button.classList.toggle("active", Number(button.dataset.step) === step));
    els.currentStepLabel.textContent = `SAMM ${step} / ${TOTAL_STEPS}`;
    els.prevLesson.disabled = step === 1;
    els.nextLesson.disabled = step === TOTAL_STEPS || step >= completed + 1;
    setResultPanelVisible(step >= 3 && completed >= 3);
    renderDots();
    if (manual) $(".control-card").scrollIntoView({ behavior: "smooth", block: "start" });
    syncHeight();
  }

  function setStatus(text, success = true) {
    els.stageCard.classList.remove("awaiting-response");
    els.stageCard.removeAttribute("aria-disabled");
    els.statusChip.className = `status-chip ${success ? "success" : "neutral"}`;
    els.statusText.textContent = text;
  }

  function setContext(label, value, tone = "success") {
    els.responseContext.className = `response-context ${tone}`;
    els.responseContextLabel.textContent = label;
    els.responseContextText.textContent = value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function renderRows(count) {
    const previewRows = count === 10
      ? sampleRows.slice(0, 5)
      : [...sampleRows.slice(0, 4), ...sampleRows.slice(10, 14)];
    els.resultRows.innerHTML = previewRows.map((row) => `<tr><td>${escapeHtml(row.quote)}</td><td>${escapeHtml(row.author)}</td><td>${escapeHtml(row.tags)}</td><td>${row.page}</td></tr>`).join("");
    els.rowCount.textContent = String(count);
    els.pageCount.textContent = count === 10 ? "1" : "2";
    els.tableState.textContent = `${count} rida · näidatud ${previewRows.length}`;
    els.dataPanel.hidden = false;
  }

  function renderQuality() {
    els.missingCount.textContent = "0";
    els.duplicateCount.textContent = "0";
    els.qualityResults.hidden = false;
    els.qualityResults.innerHTML = `
      <div><span>✓</span><b>20 kirjet</b><small>oodatud arv käes</small></div>
      <div><span>✓</span><b>10 + 10</b><small>mõlemad lehed kaetud</small></div>
      <div><span>✓</span><b>0 tühja</b><small>tekst ja autor olemas</small></div>
      <div><span>✓</span><b>0 kordust</b><small>tsitaadid unikaalsed</small></div>
      <div><span>✓</span><b>Allikas alles</b><small>URL, leht ja kuupäev lisatud</small></div>`;
  }

  function applyStepResult(step) {
    if (step === 3) {
      setResultPanelVisible(true);
      setStatus("10 kirjet käes");
      setContext("ESIMENE LEHT", "HTTP-vastus sisaldas staatilist HTML-i ja .quote-selektor leidis 10 kirjet.");
      renderRows(10);
    } else if (step === 4) {
      setStatus("20 kirjet käes");
      setContext("KAKS LEHTE ÜHENDATUD", "Päringute vahel oli ühe sekundi paus. Iga kirje juures säilisid märksõnad, lehekülg, URL ja kogumise kuupäev.");
      renderRows(20);
    } else if (step === 5) {
      setStatus("Kvaliteet kontrollitud");
      setContext("KONTROLL LÄBITUD", "Kirjete arv, lehekülgede katvus, tühjad väljad ja kordused on kontrollitud. Lõplik kontroll on võrdlus algallikaga.");
      renderRows(20);
      renderQuality();
    }
  }

  async function completeStep(step) {
    applyStepResult(step);
    completed = Math.max(completed, step);
    const button = $(`[data-run="${step}"]`);
    button.disabled = true;
    button.querySelector("span").textContent = completedLabels[step - 1];
    if (step === TOTAL_STEPS) {
      $(`[data-lesson="${step}"]`).classList.add("completed");
      els.practiceSuite.classList.remove("locked");
      els.practiceSuite.removeAttribute("aria-disabled");
    }
    updateProgress();
    running = false;
    if (step < TOTAL_STEPS) {
      await wait(420);
      showStep(step + 1);
    } else {
      showStep(step);
    }
    syncHeight();
  }

  function openFlowDialog(step) {
    const config = dialogConfigs[step];
    pendingDialogStep = step;
    running = true;
    els.flowDialogKicker.textContent = config.kicker;
    els.dialogApiName.textContent = config.endpoint;
    els.dialogServiceAction.textContent = config.action;
    els.dialogFlowStatus.textContent = "Valmistab päringut ette";
    els.flowDialogResult.innerHTML = "<b>Päring on teel.</b> Tulemus pole veel saabunud.";
    els.flowDialogClose.disabled = true;
    els.dialogFlowStage.classList.remove("sending", "returning");
    els.flowDialog.showModal();
    window.setTimeout(() => {
      els.dialogFlowStage.classList.add("sending");
      els.dialogFlowStatus.textContent = "Veebileht tagastab HTML-i";
    }, 250);
    window.setTimeout(() => {
      els.dialogFlowStage.classList.remove("sending");
      els.dialogFlowStage.classList.add("returning");
      els.dialogFlowStatus.textContent = "R seob väljad kirjeteks";
    }, 1250);
    window.setTimeout(() => {
      els.dialogFlowStage.classList.remove("returning");
      els.dialogFlowStatus.textContent = "Tulemus on valmis";
      els.flowDialogResult.innerHTML = `<b>${escapeHtml(config.result)}</b> Vaata tulemust ja jätka.`;
      els.flowDialogClose.disabled = false;
      els.flowDialogClose.focus({ preventScroll: true });
    }, 2200);
  }

  function runStep(step) {
    if (running || step !== currentStep || step > completed + 1) return;
    if ([3, 4].includes(step)) openFlowDialog(step);
    else {
      running = true;
      completeStep(step);
    }
  }

  function updatePermissionChecklist() {
    const inputs = $$("input[type=\"checkbox\"]", els.permissionChecklist);
    const checked = inputs.filter((input) => input.checked).length;
    const ready = checked === inputs.length;
    els.permissionFeedback.textContent = ready ? "Kõik neli kontrolli on kinnitatud. Kraapimisotsus on põhjendatud selle harjutuse piires." : `${checked}/${inputs.length} kontrolli kinnitatud.`;
    els.permissionFeedback.className = `selection-feedback ${ready ? "success" : ""}`;
    $('[data-run="1"]').disabled = !ready;
  }

  function updateSelectorChoices() {
    const values = {
      record: $("#recordSelector").value,
      text: $("#textSelector").value,
      author: $("#authorSelector").value,
      tags: $("#tagSelector").value
    };
    const selected = Object.values(values).filter(Boolean).length;
    const correct = values.record === ".quote" && values.text === ".text" && values.author === ".author" && values.tags === ".tags .tag";
    els.selectorFeedback.className = `selection-feedback ${correct ? "success" : selected === 4 ? "error" : ""}`;
    els.selectorFeedback.textContent = correct
      ? "Õige: väljad leitakse iga .quote-ploki seest ja märksõnade seos säilib."
      : selected === 4
        ? "Mõni selektor lõhub kirje struktuuri. Alusta .quote-plokist ja otsi väljad selle seest."
        : `${selected}/4 selektorit valitud.`;
    $('[data-run="2"]').disabled = !correct;
  }

  function updateDecisionPractice() {
    const scenario = els.scenarioInput.value;
    const method = els.methodInput.value;
    const answer = decisionAnswers[scenario];
    let state = "pending";
    let symbol = "?";
    let title = "Vali olukord ja meetod";
    let text = "Eelista kõige lihtsamat ametlikku allikat, mis täidab ülesande.";
    if (answer && method) {
      const correct = answer.method === method;
      state = correct ? "good" : "warn";
      symbol = correct ? "✓" : "!";
      title = correct ? answer.title : "Valitud meetod pole siin esimene valik";
      const recommended = els.methodInput.querySelector(`option[value="${answer.method}"]`).textContent;
      text = correct ? answer.text : `Sobivam valik on „${recommended}”. ${answer.text}`;
    }
    els.decisionPreview.className = `decision-preview ${state}`;
    els.decisionPreview.querySelector(":scope > span").textContent = symbol;
    els.decisionPreview.querySelector("h3").textContent = title;
    els.decisionPreview.querySelector("p").textContent = text;
    syncHeight();
  }

  function reset() {
    currentStep = 1;
    completed = 0;
    running = false;
    pendingDialogStep = 0;
    if (els.inspectorHelpDialog.open) els.inspectorHelpDialog.close();
    if (els.flowDialog.open) els.flowDialog.close();
    $$('[data-run]').forEach((button) => {
      const step = Number(button.dataset.run);
      button.querySelector("span").textContent = initialLabels[step - 1];
      button.disabled = [1, 2].includes(step);
    });
    $$("input[type=\"checkbox\"]", els.permissionChecklist).forEach((input) => { input.checked = false; });
    $$("select", els.selectorFields).forEach((select) => { select.value = ""; });
    els.scenarioInput.value = "";
    els.methodInput.value = "";
    els.practiceSuite.classList.add("locked");
    els.practiceSuite.setAttribute("aria-disabled", "true");
    setResultPanelVisible(false);
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.statusChip.className = "status-chip neutral";
    els.statusText.textContent = "Kraapimist pole veel käivitatud";
    setContext("TULEMUS ILMUB PÄRAST PÄRINGUT", "See vaade aktiveerub, kui R on esimese lehe HTML-i küsinud.", "neutral");
    els.dataPanel.hidden = true;
    els.qualityResults.hidden = true;
    updatePermissionChecklist();
    updateSelectorChoices();
    updateDecisionPractice();
    updateProgress();
    showStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  els.permissionChecklist.addEventListener("change", updatePermissionChecklist);
  els.selectorFields.addEventListener("change", updateSelectorChoices);
  els.scenarioInput.addEventListener("change", updateDecisionPractice);
  els.methodInput.addEventListener("change", updateDecisionPractice);
  $$('[data-run]').forEach((button) => button.addEventListener("click", () => runStep(Number(button.dataset.run))));
  $$(".step").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.step), true)));
  els.prevLesson.addEventListener("click", () => showStep(currentStep - 1, true));
  els.nextLesson.addEventListener("click", () => showStep(currentStep + 1, true));
  $("#resetButton").addEventListener("click", reset);
  els.inspectorHelpOpen.addEventListener("click", () => els.inspectorHelpDialog.showModal());
  els.inspectorHelpClose.addEventListener("click", () => els.inspectorHelpDialog.close());
  els.flowDialogClose.addEventListener("click", () => {
    els.flowDialog.close();
    const step = pendingDialogStep;
    pendingDialogStep = 0;
    completeStep(step);
  });
  els.flowDialog.addEventListener("cancel", (event) => {
    if (els.flowDialogClose.disabled) event.preventDefault();
  });
  window.addEventListener("message", (event) => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });

  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  updatePermissionChecklist();
  updateSelectorChoices();
  updateDecisionPractice();
  updateProgress();
  showStep(1);
  window.setTimeout(syncHeight, 100);
})();
