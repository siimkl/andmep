(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const requestLanguage = $("#requestLanguage");
  const requestButton = $("#getMetadata");
  const requestError = $("#requestError");
  const flowDialog = $("#flowDialog");
  const flowStage = $("#dialogFlowStage");
  const flowStatus = $("#dialogFlowStatus");
  const flowClose = $("#flowDialogClose");
  const responsePart = $("#responsePart");
  const responseOutput = $("#responseOutput");
  const stageCard = $("#stageCard");
  const readingSection = $("#readingSection");
  const readingForm = $("#readingForm");
  const readingFeedback = $("#readingFeedback");
  const quizSection = $("#quizSection");
  const quizOptions = $("#quizOptions");
  const quizFeedback = $("#quizFeedback");
  const quizNext = $("#quizNext");

  const codeChecks = [
    { field: $("#indicatorCode"), code: "GR_W_AVG", variable: "Näitaja" },
    { field: $("#activityCode"), code: "TOTAL", variable: "Tegevusala" },
    { field: $("#periodCode"), code: "2026Q2", variable: "Vaatlusperiood" }
  ];
  const quiz = [
    {
      prompt: "Mida sisaldab tabeli PA111 GET-vastus?",
      options: ["Tabeli muutujad ja lubatud valikud", "Palga suurus igal kvartalil", "Andmetest koostatud joonis"],
      correct: 0,
      explanation: "See otspunkt tagastab metaandmed ehk tabeli kirjelduse, sealhulgas valikute koodid ja nimetused."
    },
    {
      prompt: "Mida ütleb olekukood 200 OK?",
      options: ["Kõik tabeli arvud on ajakohased", "Server töötles päringu edukalt", "Tabelis on 200 kirjet"],
      correct: 1,
      explanation: "Olekukood kirjeldab päringu tulemust. Vastuse sisu tuleb vaadata JSON-ist."
    },
    {
      prompt: "GET-päring tagastas 404 Not Found. Mida tasub kõigepealt kontrollida?",
      options: ["Kvartali palgaväärtust", "JSON-i taandeid", "Päringu aadressi ja tabeli tunnust"],
      correct: 2,
      explanation: "404 tähendab, et aadressilt ei leitud soovitud ressurssi. Näiteks võib aadressis olla vale tabeli tunnus."
    }
  ];

  const stepTitles = ["1. GET-päring", "2. Vastuse lugemine", "3. Lühitest"];
  let savedMetadata;
  let response = null;
  let pendingResponse = null;
  let running = false;
  let completedSteps = 0;
  let quizIndex = 0;
  let quizScore = 0;
  let answered = false;

  function endpoint(language) {
    return "https://andmed.stat.ee/api/v1/" + language + "/stat/PA111";
  }

  function updateRequest() {
    const address = endpoint(requestLanguage.value);
    $("#requestPath").textContent = new URL(address).pathname;
    $("#requestPreview").textContent = "GET " + address + "\nAccept: application/json";
    requestError.hidden = true;
  }

  function updateProgress() {
    const done = completedSteps === stepTitles.length;
    const active = completedSteps + 1;
    const progress = Math.round(completedSteps / stepTitles.length * 100) + "%";
    $("#progressValue").textContent = progress;
    $("#progressBar").style.width = progress;
    $("#progressText").textContent = done ? "Harjutus lõpetatud" : stepTitles[completedSteps];
    $("#completedCount").textContent = completedSteps;
    $("#currentStepLabel").textContent = done ? "3 / 3 SAMMU TEHTUD" : "SAMM " + active + " / 3";
    $$(".get-steps .step").forEach((step, index) => {
      const current = index === completedSteps && !done;
      step.classList.toggle("active", current);
      step.classList.toggle("done", index < completedSteps);
      step.firstElementChild.textContent = index < completedSteps ? "✓" : index + 1;
      if (current) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  async function loadSnapshots() {
    if (savedMetadata) return savedMetadata;
    const file = await fetch("pa111-metadata.json?v=1");
    if (!file.ok) throw new Error("Sample data unavailable");
    savedMetadata = await file.json();
    return savedMetadata;
  }

  function pauseAnimation() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
    return new Promise(resolve => window.setTimeout(resolve, 450));
  }

  async function sendGet() {
    if (running || flowDialog.open) return;
    const language = requestLanguage.value;
    running = true;
    requestButton.disabled = true;
    flowClose.disabled = true;
    requestError.hidden = true;
    $("#flowDialogResult").textContent = "";
    flowStatus.textContent = "Brauser saadab päringu";
    flowStage.classList.add("sending");
    flowDialog.showModal();

    try {
      const [metadata] = await Promise.all([loadSnapshots(), pauseAnimation()]);
      flowStage.classList.replace("sending", "returning");
      flowStatus.textContent = "API saadab vastuse";
      await pauseAnimation();
      pendingResponse = { address: endpoint(language), body: metadata[language] };
      flowStatus.textContent = "200 OK";
      $("#flowDialogResult").textContent = "Näidisvastus sisaldab tabeli PA111 pealkirja ja muutujaid.";
      flowClose.disabled = false;
      flowClose.focus();
    } catch {
      flowDialog.close();
      requestError.textContent = "Salvestatud näidisvastust ei õnnestunud laadida. Proovi päringut uuesti.";
      requestError.hidden = false;
    } finally {
      running = false;
      requestButton.disabled = false;
      flowStage.classList.remove("sending", "returning");
    }
  }

  function renderJson() {
    const variable = response.body.variables.find(item => item.code === responsePart.value);
    responseOutput.textContent = JSON.stringify(variable ?? response.body, null, 2);
    $("#responseFile").textContent = variable ? variable.code + " · JSON-i väljavõte" : "metaandmed.json";
    responseOutput.scrollTop = 0;
    responseOutput.scrollLeft = 0;
  }

  function revealResponse() {
    if (!pendingResponse) return;
    response = pendingResponse;
    pendingResponse = null;
    $("#responsePath").textContent = new URL(response.address).pathname;
    $("#liveResponse").href = response.address;
    responsePart.value = "";
    renderJson();
    stageCard.hidden = false;
    $(".lab-grid").classList.remove("result-pending");
    readingSection.hidden = false;
    completedSteps = Math.max(1, completedSteps);
    updateProgress();
    $("#responseTitle").focus({ preventScroll: true });
    stageCard.scrollIntoView({ block: "nearest" });
  }

  function checkCodes(event) {
    event.preventDefault();
    if (!response || completedSteps >= 2) return;
    const mismatches = codeChecks.filter(({ field, code }) => {
      const wrong = field.value !== code;
      field.setAttribute("aria-invalid", String(wrong));
      return wrong;
    });
    readingFeedback.hidden = false;
    readingFeedback.className = mismatches.length ? "feedback error" : "feedback success";
    if (mismatches.length) {
      const variables = mismatches.map(({ variable }) => "„" + variable + "”").join(", ");
      readingFeedback.textContent = "Vaata JSON-is uuesti järgmisi muutujaid: " + variables + ". Kood asub nimetusega samal kohal väljal values.";
      return;
    }
    readingFeedback.textContent = "Kõik kolm koodi vastavad tabeli kirjeldusele.";
    codeChecks.forEach(({ field }) => { field.disabled = true; });
    $("#checkCodes").disabled = true;
    quizSection.hidden = false;
    completedSteps = 2;
    updateProgress();
    renderQuestion();
  }

  function renderQuestion() {
    const question = quiz[quizIndex];
    answered = false;
    $("#quizCount").textContent = "Küsimus " + (quizIndex + 1) + " / " + quiz.length;
    $("#quizPrompt").textContent = question.prompt;
    quizFeedback.hidden = true;
    quizNext.hidden = true;
    quizOptions.replaceChildren(...question.options.map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.answer = String(index);
      button.textContent = option;
      return button;
    }));
  }

  function chooseAnswer(event) {
    const button = event.target.closest("[data-answer]");
    if (!button || answered || completedSteps !== 2) return;
    const question = quiz[quizIndex];
    const correct = Number(button.dataset.answer) === question.correct;
    answered = true;
    if (correct) quizScore++;
    [...quizOptions.children].forEach((option, index) => {
      option.disabled = true;
      option.classList.toggle("correct", index === question.correct);
    });
    if (!correct) button.classList.add("wrong");
    quizFeedback.className = correct ? "feedback success" : "feedback error";
    quizFeedback.textContent = (correct ? "Õige vastus. " : "Õige vastus on „" + question.options[question.correct] + "”. ") + question.explanation;
    quizFeedback.hidden = false;
    quizNext.textContent = quizIndex + 1 === quiz.length ? "Lõpeta lühitest" : "Järgmine küsimus";
    quizNext.hidden = false;
    quizNext.focus({ preventScroll: true });
  }

  function nextQuestion() {
    if (!answered || completedSteps !== 2) return;
    quizIndex++;
    if (quizIndex < quiz.length) {
      renderQuestion();
      $("#quizPrompt").focus();
      return;
    }
    completedSteps = 3;
    updateProgress();
    $("#quizQuestion").hidden = true;
    $("#quizSummary").hidden = false;
    $("#quizScore").textContent = "Lühitest on lõpetatud. Õigeid vastuseid " + quizScore + " / " + quiz.length + ".";
    $("#quizScore").focus();
  }

  function reset() {
    response = null;
    pendingResponse = null;
    completedSteps = 0;
    quizIndex = 0;
    quizScore = 0;
    answered = false;
    requestLanguage.value = "et";
    responsePart.value = "";
    responseOutput.textContent = "";
    stageCard.hidden = true;
    $(".lab-grid").classList.add("result-pending");
    readingSection.hidden = true;
    readingFeedback.hidden = true;
    readingForm.reset();
    codeChecks.forEach(({ field }) => {
      field.disabled = false;
      field.removeAttribute("aria-invalid");
    });
    $("#checkCodes").disabled = false;
    quizSection.hidden = true;
    $("#quizQuestion").hidden = false;
    $("#quizSummary").hidden = true;
    updateRequest();
    updateProgress();
    window.scrollTo({ top: 0 });
  }

  function syncHeight() {
    if (window.self === window.top && !embedded) return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "simfluence:resize", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }

  requestLanguage.addEventListener("change", updateRequest);
  requestButton.addEventListener("click", sendGet);
  flowClose.addEventListener("click", () => flowDialog.close());
  flowDialog.addEventListener("cancel", event => {
    if (running) event.preventDefault();
  });
  flowDialog.addEventListener("close", revealResponse);
  responsePart.addEventListener("change", renderJson);
  readingForm.addEventListener("submit", checkCodes);
  codeChecks.forEach(({ field }) => field.addEventListener("change", () => field.removeAttribute("aria-invalid")));
  quizOptions.addEventListener("click", chooseAnswer);
  quizNext.addEventListener("click", nextQuestion);
  $("#resetButton").addEventListener("click", reset);

  const params = new URLSearchParams(location.search);
  const embedded = params.get("embed") === "1" || params.get("embedMode") === "1";
  if (embedded) document.body.classList.add("embed-mode");
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  window.addEventListener("message", event => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });
})();
