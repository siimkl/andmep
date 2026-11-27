(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const TOTAL_STEPS = 5;

  const stepTitles = [
    "Andmeallika hindamine",
    "HTML ja selektorid",
    "Esimese lehe andmed",
    "Kahe lehe ühendamine",
    "Tulemuse kontroll"
  ];

  const completedLabels = [
    "Allika hinnang on kinnitatud",
    "Selektorid kinnitatud",
    "Esimese lehe näidis on avatud",
    "Kahe lehe näidis on avatud",
    "Näidisandmed on kontrollitud"
  ];

  const initialLabels = [
    "Kinnita allika hinnang",
    "Kinnita selektorid",
    "Kuva esimese lehe näidis",
    "Kuva kahe lehe näidis",
    "Kontrolli näidisandmeid"
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
    3: { endpoint: "/page/1/", action: "Leiab tsitaadi ja autori", close: "Vaata esimese lehe näidist" },
    4: { endpoint: "/page/1/ ja /page/2/", action: "Ühendab kahe lehe read", close: "Vaata kahe lehe näidist" }
  };

  const decisionAnswers = {
    few: { method: "manual", title: "Sobib käsitsi kopeerimine", text: "Kolme väärtuse ühekordseks kogumiseks piisab enamasti veebilehelt kopeerimisest." },
    file: { method: "file", title: "Sobib ametlik CSV-fail", text: "Valmis failist saab andmed tabelina otse sisse lugeda." },
    api: { method: "api", title: "Sobib dokumenteeritud API", text: "Dokumentatsioon kirjeldab, milliselt aadressilt ja milliste parameetritega andmeid küsida." },
    static: { method: "rvest", title: "Sobib veebikraapimine R-is", text: "Korduvaid HTML-kirjeid saab koguda skriptiga. Enne kraapimist tuleb veenduda, et veebilehte tohib selleks kasutada." },
    restricted: { method: "stop", title: "Esmalt on vaja volitust", text: "Siseveebi andmete kogumise, säilitamise ja edastamise tingimused tuleb volituse andjaga kokku leppida." }
  };

  const els = {
    progressValue: $("#progressValue"), progressText: $("#progressText"), progressBar: $("#progressBar"),
    completedCount: $("#completedCount"), currentStepLabel: $("#currentStepLabel"), labGrid: $(".lab-grid"), stageCard: $("#stageCard"),
    statusChip: $("#statusChip"), statusText: $("#statusText"), responseContext: $("#responseContext"),
    dataPanel: $("#dataPanel"), resultRows: $("#resultRows"), rowCount: $("#rowCount"), pageCount: $("#pageCount"),
    missingCount: $("#missingCount"), duplicateCount: $("#duplicateCount"), tableState: $("#tableState"),
    qualityResults: $("#qualityResults"),
    permissionChecklist: $("#permissionChecklist"), permissionFeedback: $("#permissionFeedback"),
    selectorFields: $("#selectorFields"), selectorFeedback: $("#selectorFeedback"),
    prevLesson: $("#prevLesson"), nextLesson: $("#nextLesson"),
    practiceSuite: $("#practiceSuite"), scenarioInput: $("#scenarioInput"), methodInput: $("#methodInput"),
    decisionPreview: $("#decisionPreview"), inspectorHelpOpen: $("#inspectorHelpOpen"),
    inspectorHelpDialog: $("#inspectorHelpDialog"), inspectorHelpClose: $("#inspectorHelpClose"),
    flowDialog: $("#flowDialog"),
    dialogFlowStage: $("#dialogFlowStage"), dialogFlowStatus: $("#dialogFlowStatus"), dialogApiName: $("#dialogApiName"),
    dialogServiceAction: $("#dialogServiceAction"), flowDialogClose: $("#flowDialogClose")
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
    els.progressText.textContent = completed === TOTAL_STEPS
      ? "Põhiülesanne lõpetatud"
      : `${completed + 1}. ${stepTitles[completed]}`;
    $$(".step").forEach((button) => {
      const step = Number(button.dataset.step);
      button.classList.toggle("done", step <= completed);
      button.disabled = step > completed + 1;
    });
  }

  function showStep(step, manual = false) {
    if (running || step < 1 || step > TOTAL_STEPS || step > completed + 1) return;
    currentStep = step;
    $$(".lesson-panel").forEach((panel) => {
      const active = Number(panel.dataset.lesson) === step;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    $$(".step").forEach((button) => {
      const active = Number(button.dataset.step) === step;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    els.currentStepLabel.textContent = `SAMM ${step} / ${TOTAL_STEPS}`;
    els.prevLesson.disabled = step === 1;
    els.nextLesson.disabled = step === TOTAL_STEPS || step >= completed + 1;
    setResultPanelVisible(step >= 3 && completed >= 3);
    if (manual) $(".control-card").scrollIntoView({ behavior: "smooth", block: "start" });
    syncHeight();
  }

  function setStatus(text) {
    els.stageCard.classList.remove("awaiting-response");
    els.stageCard.removeAttribute("aria-disabled");
    els.statusChip.className = "status-chip success";
    els.statusText.textContent = text;
  }

  function setContext(text) {
    els.responseContext.textContent = text;
    els.responseContext.hidden = !text;
    els.responseContext.className = "response-context success";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function renderRows(count) {
    const rows = sampleRows.slice(0, count);
    const fullFields = count === 20;
    const previewRows = fullFields ? [1, 2].flatMap((page) => rows.filter((row) => row.page === page).slice(0, 4)) : rows.slice(0, 5);
    $$(".source-column", els.dataPanel).forEach((column) => { column.hidden = !fullFields; });
    els.resultRows.innerHTML = previewRows.map((row) => {
      const sourceCells = fullFields
        ? `<td role="cell"><span class="row-label" aria-hidden="true">Märksõnad </span>${escapeHtml(row.tags)}</td>
           <td role="cell"><span class="row-label" aria-hidden="true">Leht </span><a href="https://quotes.toscrape.com/page/${row.page}/" target="_blank" rel="noopener noreferrer" aria-label="Harjutusveebi lehekülg ${row.page} (avaneb uuel vahelehel)">${row.page}</a></td>`
        : "";
      return `<tr role="row"><td role="cell">${escapeHtml(row.quote)}</td><td role="cell">${escapeHtml(row.author)}</td>${sourceCells}</tr>`;
    }).join("");
    els.rowCount.textContent = String(rows.length);
    els.pageCount.textContent = String(new Set(rows.map((row) => row.page)).size);
    els.tableState.textContent = `Näidatud ${previewRows.length} / ${rows.length} kirjet`;
    els.dataPanel.hidden = false;
  }

  function renderQuality() {
    const missing = sampleRows.filter((row) => !row.quote?.trim() || !row.author?.trim()).length;
    const duplicate = sampleRows.length - new Set(sampleRows.map((row) => row.quote)).size;
    const firstPage = sampleRows.filter((row) => row.page === 1).length;
    const secondPage = sampleRows.filter((row) => row.page === 2).length;
    els.missingCount.textContent = String(missing);
    els.duplicateCount.textContent = String(duplicate);
    els.qualityResults.textContent = `Esimese lehe näidises on ${firstPage} kirjet ja teise lehe näidises ${secondPage} kirjet.`;
    els.qualityResults.hidden = false;
  }

  function applyStepResult(step) {
    if (step === 3) {
      setResultPanelVisible(true);
      setStatus("Esimese lehe näidis");
      setContext("Selektor .quote valib HTML-ist tsitaadiplokid. Iga plokk annab tabelisse ühe rea.");
      renderRows(10);
    } else if (step === 4) {
      setStatus("Kahe lehe näidis");
      setContext("Eelvaate leheküljenumber avab vastava allikalehe uuel vahelehel.");
      renderRows(20);
    } else if (step === 5) {
      setStatus("Näidisandmed on kontrollitud");
      setContext("Kirjete arvu, puuduvate väljade ja korduste näitajad on arvutatud brauseri näidisandmetest.");
      renderRows(20);
      renderQuality();
    }
  }

  function completeStep(step) {
    applyStepResult(step);
    completed = step;
    const button = $(`[data-run="${step}"]`);
    button.disabled = true;
    button.querySelector("span").textContent = completedLabels[step - 1];
    if (step === 1) els.permissionChecklist.disabled = true;
    if (step === 2) $$("select", els.selectorFields).forEach((select) => { select.disabled = true; });
    if (step === TOTAL_STEPS) {
      $(`[data-lesson="${step}"]`).classList.add("completed");
      els.practiceSuite.classList.remove("locked");
      els.practiceSuite.removeAttribute("aria-disabled");
      els.practiceSuite.inert = false;
    }
    updateProgress();
    running = false;
    showStep(Math.min(step + 1, TOTAL_STEPS));
    syncHeight();
  }

  function openFlowDialog(step) {
    const config = dialogConfigs[step];
    pendingDialogStep = step;
    running = true;
    els.dialogApiName.textContent = config.endpoint;
    els.dialogServiceAction.textContent = config.action;
    els.dialogFlowStatus.textContent = "Valmistab päringut ette";
    els.flowDialogClose.disabled = true;
    els.flowDialogClose.querySelector("span").textContent = "Koostatakse näidistabelit";
    els.dialogFlowStage.classList.remove("sending", "returning");
    els.flowDialog.showModal();
    window.setTimeout(() => {
      els.dialogFlowStage.classList.add("sending");
      els.dialogFlowStatus.textContent = "Veebiserver tagastab HTML-i";
    }, 250);
    window.setTimeout(() => {
      els.dialogFlowStage.classList.remove("sending");
      els.dialogFlowStage.classList.add("returning");
      els.dialogFlowStatus.textContent = "R seob väljad kirjeteks";
    }, 1250);
    window.setTimeout(() => {
      els.dialogFlowStage.classList.remove("returning");
      els.dialogFlowStatus.textContent = "Näidistabel on valmis";
      els.flowDialogClose.querySelector("span").textContent = config.close;
      els.flowDialogClose.disabled = false;
      els.flowDialogClose.focus({ preventScroll: true });
    }, 2200);
  }

  function runStep(step) {
    if (running || step !== currentStep || step !== completed + 1) return;
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
    els.permissionFeedback.textContent = `${checked}/${inputs.length} asjaolu läbi vaadatud.`;
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
      ? "Kõik neli selektorit sobivad näite HTML-iga."
      : selected === 4
        ? "Vähemalt üks selektor valib vale elemendi. Näite HTML-is tähistab klass quote kogu kirjet."
        : `${selected}/4 selektorit valitud.`;
    $('[data-run="2"]').disabled = !correct;
  }

  function updateDecisionPractice() {
    const scenario = els.scenarioInput.value;
    const method = els.methodInput.value;
    const answer = decisionAnswers[scenario];
    els.decisionPreview.hidden = !answer || !method;
    if (els.decisionPreview.hidden) return;
    const correct = answer.method === method;
    els.decisionPreview.className = `decision-preview ${correct ? "good" : "warn"}`;
    els.decisionPreview.querySelector(":scope > span").textContent = correct ? "✓" : "!";
    els.decisionPreview.querySelector("h3").textContent = answer.title;
    els.decisionPreview.querySelector("p").textContent = answer.text;
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
    els.permissionChecklist.disabled = false;
    $$("select", els.selectorFields).forEach((select) => {
      select.value = "";
      select.disabled = false;
    });
    $(".export-example").open = false;
    els.scenarioInput.value = "";
    els.methodInput.value = "";
    els.practiceSuite.classList.add("locked");
    els.practiceSuite.setAttribute("aria-disabled", "true");
    els.practiceSuite.inert = true;
    setResultPanelVisible(false);
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.statusChip.className = "status-chip neutral";
    els.statusText.textContent = "Kraapimist pole veel käivitatud";
    setContext("");
    els.missingCount.textContent = "—";
    els.duplicateCount.textContent = "—";
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
  els.flowDialogClose.addEventListener("click", () => els.flowDialog.close());
  els.flowDialog.addEventListener("close", () => {
    const step = pendingDialogStep;
    if (!step) return;
    pendingDialogStep = 0;
    completeStep(step);
    $("#result-title").focus({ preventScroll: true });
    els.stageCard.scrollIntoView({ behavior: "smooth", block: "start" });
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
