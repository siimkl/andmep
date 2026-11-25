(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

  const els = {
    progressValue: $("#progressValue"), progressText: $("#progressText"), progressBar: $("#progressBar"), completedCount: $("#completedCount"),
    currentStepLabel: $("#currentStepLabel"),
    resetButton: $("#resetButton"),
    labGrid: $(".lab-grid"), stageCard: $(".stage-card"), controlCard: $(".control-card"), flowStatus: $("#flowStatus"), storyIndex: $("#storyIndex"), storyText: $("#storyText"),
    flowDialog: $("#flowDialog"), flowDialogKicker: $("#flowDialogKicker"), dialogFlowStage: $("#dialogFlowStage"), dialogFlowStatus: $("#dialogFlowStatus"),
    flowDialogResult: $("#flowDialogResult"), flowDialogClose: $("#flowDialogClose"),
    responseContext: $("#responseContext"), responseContextLabel: $("#responseContextLabel"), responseContextText: $("#responseContextText"),
    responseOutput: $("#responseOutput"), terminalTitle: $("#terminalTitle"), statusBadge: $("#statusBadge"),
    getMetadata: $("#getMetadata"), selectionSection: $("#selectionSection"),
    selectionFields: $("#selectionFields"), indicatorSelect: $("#indicatorSelect"), activitySelect: $("#activitySelect"), periodOptions: $("#periodOptions"),
    selectionMath: $("#selectionMath"), valueCount: $("#valueCount"), sendSection: $("#sendSection"),
    sendFields: $("#sendFields"), requestPreview: $("#requestPreview"), sendRequest: $("#sendRequest"),
    requestFeedback: $("#requestFeedback"), resultViz: $("#resultViz"), chartTitle: $("#chartTitle"),
    barChart: $("#barChart"), chartInsight: $("#chartInsight"), validationSection: $("#validationSection"),
    validationFields: $("#validationFields"), checkScore: $("#checkScore"), takeaway: $("#takeaway"),
    practiceSuite: $(".practice-suite"),
    decoderRound: $("#decoderRound"), decoderBar: $("#decoderBar"), decoderScore: $("#decoderScore"), decoderPrompt: $("#decoderPrompt"),
    decoderKicker: $("#decoderKicker"), decoderQuestionNumber: $("#decoderQuestionNumber"),
    decoderHint: $("#decoderHint"), decoderOptions: $("#decoderOptions"), methodScenario: $("#methodScenario"),
    methodRound: $("#methodRound"), methodBar: $("#methodBar"), methodScore: $("#methodScore"),
    methodKicker: $("#methodKicker"), methodQuestionNumber: $("#methodQuestionNumber"),
    methodOptions: $("#methodOptions"), methodFeedback: $("#methodFeedback"),
    conceptRound: $("#conceptRound"), conceptBar: $("#conceptBar"), conceptScore: $("#conceptScore"),
    conceptKicker: $("#conceptKicker"), conceptQuestionNumber: $("#conceptQuestionNumber"),
    conceptPrompt: $("#conceptPrompt"), conceptOptions: $("#conceptOptions"), conceptFeedback: $("#conceptFeedback")
  };

  const initialState = () => ({
    metadata: false, successfulPost: false, responseViewed: false, checks: 0, currentStep: 1,
    xp: 0, awards: new Set(), methodRound: 0, methodScore: 0,
    methodLocked: false, decoderRound: 0, decoderScore: 0, decoderLocked: false,
    conceptRound: 0, conceptScore: 0, conceptLocked: false
  });
  let state = initialState();
  let dialogTarget = null;

  const metadataResponse = {
    title: "PA111: KESKMINE BRUTOKUUPALK, MEDIAAN, DETSIILID JA TÖÖTAJATE ARV TEGEVUSALARÜHMA (EMTAK 2008) JÄRGI (KVARTALID)",
    variables: [
      {
        code: "Näitaja",
        text: "Näitaja",
        values: ["GR_W_AVG", "NR_EMPL", "GR_W_D1", "GR_W_D2", "GR_W_D3", "GR_W_D4", "GR_W_D5", "GR_W_D6", "GR_W_D7", "GR_W_D8", "GR_W_D9", "GR_W_AVG_SM"],
        valueTexts: [
          "Keskmine brutokuupalk, eurot",
          "Töötajate arv",
          "Brutokuupalga I detsiil, eurot",
          "Brutokuupalga II detsiil, eurot",
          "Brutokuupalga III detsiil, eurot",
          "Brutokuupalga IV detsiil, eurot",
          "Brutokuupalga mediaan (V detsiil), eurot",
          "Brutokuupalga VI detsiil, eurot",
          "Brutokuupalga VII detsiil, eurot",
          "Brutokuupalga VIII detsiil, eurot",
          "Brutokuupalga IX detsiil, eurot",
          "Keskmise brutokuupalga muutus võrreldes eelmise aasta sama perioodiga, %"
        ]
      },
      {
        code: "Tegevusala",
        text: "Tegevusala",
        values: ["TOTAL", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"],
        valueTexts: [
          "Kokku – kõik tegevusalad",
          "Põllumajandus, metsamajandus ja kalapüük",
          "Mäetööstus",
          "Töötlev tööstus",
          "Elektrienergia, gaasi, auru ja konditsioneeritud õhuga varustamine",
          "Veevarustus; kanalisatsioon; jäätme- ja saastekäitlus",
          "Ehitus",
          "Hulgi- ja jaekaubandus; mootorsõidukite ja mootorrataste remont",
          "Veondus ja laondus",
          "Majutus ja toitlustus",
          "Info ja side",
          "Finants- ja kindlustustegevus",
          "Kinnisvaraalane tegevus",
          "Kutse-, teadus- ja tehnikaalane tegevus",
          "Haldus- ja abitegevused",
          "Avalik haldus ja riigikaitse; kohustuslik sotsiaalkindlustus",
          "Haridus",
          "Tervishoid ja sotsiaalhoolekanne",
          "Kunst, meelelahutus ja vaba aeg",
          "Muud teenindavad tegevused"
        ],
        elimination: true
      },
      {
        code: "Vaatlusperiood",
        text: "Vaatlusperiood",
        values: ["2021Q1", "2021Q2", "2021Q3", "2021Q4", "2022Q1", "2022Q2", "2022Q3", "2022Q4", "2023Q1", "2023Q2", "2023Q3", "2023Q4", "2024Q1", "2024Q2", "2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2"],
        valueTexts: [
          "2021 I kvartal", "2021 II kvartal", "2021 III kvartal", "2021 IV kvartal",
          "2022 I kvartal", "2022 II kvartal", "2022 III kvartal", "2022 IV kvartal",
          "2023 I kvartal", "2023 II kvartal", "2023 III kvartal", "2023 IV kvartal",
          "2024 I kvartal", "2024 II kvartal", "2024 III kvartal", "2024 IV kvartal",
          "2025 I kvartal", "2025 II kvartal", "2025 III kvartal", "2025 IV kvartal",
          "2026 I kvartal", "2026 II kvartal"
        ],
        time: true
      }
    ]
  };
  const defaultPeriods = new Set(["2024Q2", "2025Q2", "2026Q2"]);
  const officialPa111Wages = Object.freeze({
    "2024Q2": 2007,
    "2025Q2": 2126,
    "2026Q2": 2243
  });

  const methodRounds = [
    { text: "Vaja on kolme väärtust ühest veebitabelist.", correct: "manual", why: "Väikese ühekordse ülesande puhul on kõige lihtsam kasutada veebitabelit." },
    { text: "Suur andmestik on juba CSV-failina saadaval.", correct: "file", why: "Kui valmis fail on olemas, on kõige lihtsam see alla laadida." },
    { text: "Statistikat tuleb igal kuul automaatselt uuendada.", correct: "api", why: "API sobib, sest sama päringut saab automaatselt korrata." },
    { text: "API puudub, kuid vajalik avalik info on veebilehel nähtav.", correct: "scrape", why: "Kui API-t pole, võib kaaluda kraapimist. Enne kontrolli kasutustingimusi." },
    { text: "Kaks süsteemi peavad andmeid regulaarselt vahetama.", correct: "api", why: "API abil saavad süsteemid omavahel andmeid vahetada." }
  ];

  const decoderRounds = [
    { prompt: "Päringu JSON on vigases vormingus.", code: "400", why: "400 tähendab, et päringu sisus on viga." },
    { prompt: "Ligipääsutunnus puudub või ei kehti.", code: "401", why: "401 puhul kontrolli ligipääsutunnust." },
    { prompt: "Aadressis nimetatud tabelit ei leitud.", code: "404", why: "404 puhul kontrolli aadressi ja tabeli koodi." },
    { prompt: "Klient saadab liiga palju päringuid liiga kiiresti.", code: "429", why: "429 tähendab, et päringuid on liiga palju. Proovi hiljem uuesti." }
  ];

  const conceptRounds = [
    {
      prompt: "Mida saad teada GET-päringuga tabelile PA111?",
      options: ["Palgaandmed kohe", "Tabeli muutujad ja valikud", "Ainult failinime", "RStudio joonise"],
      correct: 1,
      why: "GET-vastus kirjeldab tabeli muutujaid ja lubatud valikuid."
    },
    {
      prompt: "Kus määrad POST-päringus näitaja, tegevusala ja perioodid?",
      options: ["Aadressis", "Päringu kehas", "Olekukoodis", "Vastuse päises"],
      correct: 1,
      why: "Soovitud andmevalikud kirjeldatakse POST-päringu JSON-kehas."
    },
    {
      prompt: "Mida kinnitab vastuse olekukood 200 OK?",
      options: ["Andmed on kindlasti õiged", "Päring õnnestus tehniliselt", "Ühik on alati euro", "Kõik aastad on olemas"],
      correct: 1,
      why: "200 OK kinnitab tehnilist õnnestumist, mitte andmete sisulist õigsust."
    },
    {
      prompt: "Mida teha enne API-st saadud andmete kasutamist?",
      options: ["Kontrollida sisu, ühikut ja tähendust", "Vaadata ainult olekukoodi", "Eemaldada metaandmed", "Asendada POST GET-päringuga"],
      correct: 0,
      why: "Enne kasutamist kontrolli alati vastuse sisu, ühikut, tähendust ja ajakohasust."
    }
  ];

  function populateSelectionOptions() {
    const [indicator, activity, period] = metadataResponse.variables;
    const fillSelect = (select, variable) => {
      const options = variable.values.map((value, index) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${variable.valueTexts[index]} · ${value}`;
        return option;
      });
      select.replaceChildren(...options);
    };
    fillSelect(els.indicatorSelect, indicator);
    fillSelect(els.activitySelect, activity);

    const years = new Map();
    period.values.forEach((value, index) => {
      const year = value.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push({ value, text: period.valueTexts[index].replace(`${year} `, "") });
    });
    const groups = [...years].map(([year, periods]) => {
      const group = document.createElement("div");
      group.className = "period-year";
      const heading = document.createElement("b");
      heading.textContent = year;
      const grid = document.createElement("div");
      grid.className = "period-year-grid";
      periods.forEach(periodItem => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = periodItem.value;
        input.checked = defaultPeriods.has(periodItem.value);
        const text = document.createElement("span");
        text.className = "period-label";
        text.textContent = periodItem.text.replace("kvartal", "kv");
        label.append(input, text);
        grid.append(label);
      });
      group.append(heading, grid);
      return group;
    });
    els.periodOptions.replaceChildren(...groups);
  }

  function selectedPeriods() {
    return $$("#selectionFields input[type='checkbox']:checked").map(input => input.value);
  }

  function requestBody() {
    return {
      query: [
        { code: "Näitaja", selection: { filter: "item", values: [els.indicatorSelect.value] } },
        { code: "Tegevusala", selection: { filter: "item", values: [els.activitySelect.value] } },
        { code: "Vaatlusperiood", selection: { filter: "item", values: selectedPeriods() } }
      ],
      response: { format: "json-stat2" }
    };
  }

  function award(key, points) {
    if (state.awards.has(key)) return;
    state.awards.add(key);
    state.xp = Math.min(100, state.xp + points);
  }

  function updateRequestPreview() {
    const count = selectedPeriods().length;
    els.selectionMath.textContent = `1 × 1 × ${count}`;
    els.valueCount.textContent = `= ${count} ${count === 1 ? "väärtus" : "väärtust"}`;
    const address = "https://andmed.stat.ee/api/v1/et/stat/PA111";
    const headers = ["Content-Type: application/json", "Accept: application/json"];
    els.requestPreview.textContent = [
      `POST ${address}`,
      ...headers,
      "",
      JSON.stringify(requestBody(), null, 2)
    ].join("\n");
  }

  function setProgress(step, completed = false) {
    state.currentStep = step;
    els.currentStepLabel.textContent = `SAMM ${step} / 4`;
    const percent = step === 1 ? 0 : step === 2 ? 25 : step === 3 ? 50 : completed ? 100 : 75;
    const labels = { 1: "Küsi metaandmed", 2: "Vali andmed", 3: "Küsi andmed", 4: completed ? "Kontroll tehtud" : "Kontrolli vastust" };
    els.progressValue.textContent = `${percent}%`;
    els.progressText.textContent = labels[step];
    els.progressBar.style.width = `${percent}%`;
    els.completedCount.textContent = completed ? "4" : String(Math.max(0, step - 1));
    $$(".step").forEach(item => {
      const n = Number(item.dataset.step);
      const done = n < step || (completed && n === 4);
      item.classList.toggle("active", n === step && !completed);
      item.classList.toggle("done", done);
      if (n === step && !completed) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      item.firstElementChild.textContent = done ? "✓" : n;
    });
    syncHeight();
  }

  function setStory(index, html) {
    els.storyIndex.textContent = String(index).padStart(2, "0");
    els.storyText.innerHTML = html;
  }
  function setResultPanelVisible(visible) {
    els.stageCard.hidden = !visible;
    els.labGrid.classList.toggle("result-pending", !visible);
    syncHeight();
  }
  function setStatus(code, kind) { els.statusBadge.textContent = code; els.statusBadge.className = kind; }
  function showResponse(data) { els.responseOutput.textContent = JSON.stringify(data, null, 2); }
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  function showPostResponse(data, periods, values) {
    const indicator = els.indicatorSelect.value;
    const activity = els.activitySelect.value;
    const unit = indicatorUnit();
    let insideValues = false;
    let valueIndex = 0;

    const responseLines = JSON.stringify(data, null, 2).split("\n").map(line => {
      const trimmed = line.trim();
      if (trimmed === '"values": [') {
        insideValues = true;
        return escapeHtml(line);
      }
      if (insideValues && /^\],?$/.test(trimmed)) {
        insideValues = false;
        return escapeHtml(line);
      }

      if (insideValues) {
        const valueMatch = line.match(/^(\s*)(-?\d+(?:\.\d+)?)(,?)$/);
        if (valueMatch) {
          const index = valueIndex++;
          const period = periods[index];
          const hint = `API tagastas: ${formatValue(values[index])} ${unit} · ${indicator} · ${activity} · ${period}`;
          return `${escapeHtml(valueMatch[1])}<span class="response-value" tabindex="0" data-result-index="${index}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}">${escapeHtml(valueMatch[2])}</span>${valueMatch[3]}`;
        }
      }

      const codeMatch = line.match(/^(\s*)"([^"]+)"(,?)$/);
      if (codeMatch) {
        const code = codeMatch[2];
        const periodIndex = periods.indexOf(code);
        if (code === indicator || code === activity) {
          return `${escapeHtml(codeMatch[1])}<span class="response-code request-code-shared" title="Päringus valitud kood">&quot;${escapeHtml(code)}&quot;</span>${codeMatch[3]}`;
        }
        if (periodIndex !== -1) {
          return `${escapeHtml(codeMatch[1])}<span class="response-code" data-result-index="${periodIndex}" title="Päringus valitud periood">&quot;${escapeHtml(code)}&quot;</span>${codeMatch[3]}`;
        }
      }
      return escapeHtml(line);
    });

    els.responseOutput.innerHTML = `<code>${responseLines.join("\n")}</code>`;
  }

  function toggleResultLinks(index, active) {
    els.responseOutput
      .querySelectorAll(`[data-result-index="${index}"], .request-code-shared`)
      .forEach(item => item.classList.toggle("is-linked", active));
  }
  function setResponseContext(label, text, kind = "neutral") {
    const fillDesktopHeight = (kind === "metadata" || kind === "data") && window.matchMedia("(min-width: 1041px)").matches;
    const controlHeight = fillDesktopHeight ? els.controlCard.getBoundingClientRect().height : null;
    els.responseContextLabel.textContent = label;
    els.responseContextText.textContent = text;
    els.responseContext.className = `response-context ${kind}`;
    els.stageCard.classList.remove("response-neutral", "response-metadata", "response-data", "response-error");
    els.stageCard.classList.add(`response-${kind}`);
    els.stageCard.style.height = fillDesktopHeight ? `${controlHeight}px` : "";
  }
  function setGuide(_text, target, _buttonText = "Näita kohta") {
    $$(".next-target").forEach(item => item.classList.remove("next-target"));
    const guideTarget = target?.closest(".next-action-guide.contextual") || target;
    if (guideTarget) guideTarget.classList.add("next-target");
    syncHeight();
  }

  function hideGuide(target = null) {
    $$(".next-target").forEach(item => item.classList.remove("next-target"));
    const guideTarget = target?.closest(".next-action-guide.contextual") || target;
    if (guideTarget) guideTarget.classList.add("next-target");
    syncHeight();
  }

  function advanceToValidation() {
    if (!state.successfulPost) return;
    if (!state.responseViewed) {
      state.responseViewed = true;
      els.validationSection.classList.remove("locked");
      els.validationSection.removeAttribute("aria-disabled");
      els.validationFields.disabled = false;
    }
    if (state.checks === 4) {
      setProgress(4, true);
      setStory(4, "<b>Vastus on vaadatud ja kontrollitud.</b> Järgmisena harjuta API olekukoode.");
      setGuide("Vastus on kontrollitud. Järgmisena harjuta olekukoode", els.decoderKicker, "Näita testi");
      return;
    }
    setProgress(4);
    setStory(4, "<b>Vastus on vaadatud.</b> Nüüd kontrolli vastuse sisu ja tähendust.");
    const firstCheck = $("#validationFields .check-card:not(:has(input:checked))") || $("#validationFields .check-card");
    setGuide("Nüüd kontrolli vastuse sisu ja tähendust", firstCheck, "Alusta kontrolli");
  }

  function openFlowDialog(method) {
    els.flowDialogKicker.textContent = `SINU ${method}-PÄRING LIIGUB`;
    els.flowStatus.textContent = "Päring käib…";
    els.dialogFlowStatus.textContent = "Valmistab päringut ette";
    els.flowDialogResult.innerHTML = `<b>${method}-päring on teel.</b> Vastus pole veel saabunud.`;
    els.flowDialogResult.className = "";
    els.flowDialogClose.disabled = true;
    els.flowDialogClose.querySelector("span").textContent = "Oota vastust…";
    dialogTarget = null;
    if (!els.flowDialog.open) els.flowDialog.showModal();
  }

  function completeFlowDialog(method, target) {
    els.flowStatus.textContent = "Vastus käes";
    els.dialogFlowStatus.textContent = "200 OK · Vastus on käes";
    els.flowDialogResult.innerHTML = method === "GET"
      ? "<b>200 OK.</b> Teenus saatis tabeli kirjelduse ja valikud kliendile tagasi."
      : "<b>200 OK.</b> Teenus saatis andmed kliendile tagasi.";
    els.flowDialogResult.className = "success";
    els.flowDialogClose.querySelector("span").textContent = method === "GET" ? "Vaata saadud metaandmeid" : "Vaata saadud vastust";
    els.flowDialogClose.disabled = false;
    dialogTarget = target;
    els.flowDialogClose.focus({ preventScroll: true });
  }

  async function animateFlow(label, dialogMethod = null) {
    if (dialogMethod) openFlowDialog(dialogMethod);
    const stages = [{ stage: els.dialogFlowStage, status: els.dialogFlowStatus }];
    const flows = stages.map(({ stage, status }) => ({
      stage,
      status,
      nodes: [$(".client-node", stage), $(".api-node", stage), $(".service-node", stage)]
    }));
    const activate = index => flows.forEach(flow => {
      flow.nodes.forEach((node, nodeIndex) => node.classList.toggle("flow-active", nodeIndex === index));
    });
    const setFlowStatus = text => flows.forEach(flow => { flow.status.textContent = text; });

    flows.forEach(flow => {
      flow.stage.classList.remove("returning", "sending");
      flow.nodes.forEach(node => node.classList.remove("flow-active"));
      void flow.stage.offsetWidth;
    });

    activate(0);
    setFlowStatus("Klient saadab päringu");
    flows.forEach(flow => flow.stage.classList.add("sending"));
    await wait(800);

    activate(1);
    setFlowStatus("Päring jõuab API otspunkti");
    await wait(800);

    activate(2);
    setFlowStatus("Teenus töötleb päringut");
    await wait(800);

    flows.forEach(flow => {
      flow.stage.classList.remove("sending");
      void flow.stage.offsetWidth;
      flow.stage.classList.add("returning");
    });
    setFlowStatus("Vastus liigub tagasi");
    await wait(900);

    activate(1);
    await wait(450);
    activate(0);
    setFlowStatus("Klient saab vastuse");
    await wait(450);

    flows.forEach(flow => {
      flow.stage.classList.remove("returning");
      flow.nodes.forEach(node => node.classList.remove("flow-active"));
    });
    setFlowStatus("Vastus käes");
  }

  async function loadMetadata() {
    if (els.getMetadata.disabled) return;
    setResultPanelVisible(true);
    els.stageCard.classList.remove("awaiting-response");
    els.stageCard.removeAttribute("aria-disabled");
    els.getMetadata.disabled = true;
    els.getMetadata.querySelector("span").textContent = "API töötleb…";
    setStory(1, "<b>Klient saadab GET-päringu.</b> Aadress osutab tabelile PA111. Päringu keha pole vaja.");
    hideGuide(els.getMetadata);
    await animateFlow("GET liigub", "GET");
    showResponse(metadataResponse);
    els.terminalTitle.textContent = "metaandmed.json";
    setStatus("200 OK", "success");
    setResponseContext("GET-PÄRINGU VASTUS", "Teenuselt päringu tulemusena saadud täielikud metaandmed. Keri JSON-i sees, et näha kõiki väärtusi.", "metadata");
    setStory(2, "<b>Teenuselt päringu tulemusena saadud vastus sisaldab metaandmeid.</b> Need kirjeldavad tabeli muutujaid ja valikuid. Palgaandmeid siin veel ei ole.");
    state.metadata = true;
    els.selectionSection.classList.remove("locked");
    els.selectionFields.disabled = false;
    els.sendSection.classList.remove("locked");
    els.sendFields.disabled = false;
    els.getMetadata.querySelector("span").textContent = "Metaandmed saadud";
    award("metadata", 15);
    setProgress(2);
    updateRequestPreview();
    setGuide("Vali soovitud andmed", els.selectionSection, "Näita valikuid");
    completeFlowDialog("GET", els.responseContext);
  }

  function formatPeriod(period) {
    const quarters = { Q1: "I kv", Q2: "II kv", Q3: "III kv", Q4: "IV kv" };
    return `${period.slice(0, 4)} ${quarters[period.slice(4)]}`;
  }

  function indicatorUnit() {
    if (els.indicatorSelect.value === "NR_EMPL") return "tuh";
    if (els.indicatorSelect.value === "GR_W_AVG_SM") return "%";
    return "€";
  }

  function formatValue(value) {
    const [whole, fraction] = String(value).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return fraction ? `${grouped},${fraction}` : grouped;
  }

  function usesOfficialPa111Values(periods) {
    return els.indicatorSelect.value === "GR_W_AVG"
      && els.activitySelect.value === "TOTAL"
      && periods.every(period => Object.hasOwn(officialPa111Wages, period));
  }

  function simulatedValue(period) {
    const indicator = els.indicatorSelect.value;
    if (indicator === "GR_W_AVG" && els.activitySelect.value === "TOTAL" && Object.hasOwn(officialPa111Wages, period)) {
      return officialPa111Wages[period];
    }
    const activityIndex = metadataResponse.variables[1].values.indexOf(els.activitySelect.value);
    const year = Number(period.slice(0, 4));
    const quarter = Number(period.slice(-1));
    const timeIndex = (year - 2024) * 4 + quarter - 2;
    if (indicator === "NR_EMPL") return Number((100 + timeIndex * .7 + activityIndex * 1.2).toFixed(1));
    if (indicator === "GR_W_AVG_SM") return Number((5.2 + timeIndex * .08 - activityIndex * .05).toFixed(1));
    const wageBase = {
      GR_W_AVG: 2007, GR_W_D1: 1150, GR_W_D2: 1320, GR_W_D3: 1490, GR_W_D4: 1660,
      GR_W_D5: 1840, GR_W_D6: 2030, GR_W_D7: 2260, GR_W_D8: 2570, GR_W_D9: 3100
    }[indicator] || 2007;
    return Math.max(1, Math.round(wageBase + timeIndex * 35 + activityIndex * 12));
  }

  function renderChart(periods, values) {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const unit = indicatorUnit();
    els.barChart.innerHTML = periods.map((period, index) => {
      const height = 45 + (values[index] / max) * 50;
      const label = formatPeriod(period);
      const display = `${formatValue(values[index])} ${unit}`;
      return `<div class="chart-column"><span class="chart-value">${display}</span><i class="chart-bar" style="--bar-height:${height}%"></i><span class="chart-label">${label}</span></div>`;
    }).join("");
    const change = max === min ? "Väärtused on võrdsed" : `Vastuse väärtuste vahe: ${Number((max - min).toFixed(1))} ${unit}`;
    els.chartTitle.textContent = els.indicatorSelect.selectedOptions[0].textContent.split(" · ")[0];
    els.chartInsight.innerHTML = `<span>↗</span><b>${change}.</b> Muutus on nähtav. Enne järeldust kontrolli näitaja tähendust.`;
    els.resultViz.hidden = false;
  }

  async function sendPost() {
    if (els.sendRequest.disabled) return;
    if (!selectedPeriods().length) {
      els.requestFeedback.hidden = false;
      els.requestFeedback.className = "feedback error";
      els.requestFeedback.textContent = "Vali vähemalt üks vaatlusperiood.";
      return;
    }

    els.sendRequest.disabled = true;
    els.sendRequest.querySelector("span").textContent = "API töötleb…";
    els.requestFeedback.hidden = true;
    els.resultViz.hidden = true;
    setProgress(3);
    setStory(3, "<b>POST-päring saadab sinu valiku JSON-vormingus.</b> API tagastab valikule vastavad andmed.");
    setGuide("POST-päring liigub. Jälgi klienti, otspunkti ja teenust", null, "Päring liigub");
    await animateFlow("POST liigub", "POST");

    const periods = selectedPeriods();
    const values = periods.map(simulatedValue);
    const officialValues = usesOfficialPa111Values(periods);
    const postResponse = {
      class: "dataset", label: officialValues ? "PA111 vastus" : "Näitlik vastus",
      id: ["Näitaja", "Tegevusala", "Vaatlusperiood"],
      size: [1, 1, periods.length],
      dimension: {
        Näitaja: { category: { index: [els.indicatorSelect.value] } },
        Tegevusala: { category: { index: [els.activitySelect.value] } },
        Vaatlusperiood: { category: { index: periods } }
      },
      values,
      note: officialValues
        ? "PA111 ametliku tabeli kontrollväärtused"
        : "Õppeandmed — mitte ametlik statistika"
    };
    showPostResponse(postResponse, periods, values);
    renderChart(periods, values);
    setStatus("200 OK", "success");
    els.terminalTitle.textContent = "andmed.json";
    els.requestFeedback.hidden = false;
    els.requestFeedback.className = "feedback success";
    els.requestFeedback.innerHTML = "<b>Päring õnnestus tehniliselt.</b> Vaata nüüd, millised andmed API tagastas.";
    setStory(3, "<b>POST-päringu vastus on käes.</b> Vaata esmalt JSON-vastust ja saadud väärtusi.");
    state.successfulPost = true;
    award("post", 25);
    els.sendRequest.disabled = false;
    els.sendRequest.querySelector("span").textContent = "Saada POST-päring uuesti";
    setResponseContext("POST-PÄRINGU VASTUS", "Värvilised arvud on API tagastatud väärtused. Liigu arvule, et näha, milliste päringukoodidega see seotud on.", "data");
    setGuide("Vaata kõigepealt POST-päringu vastust", els.responseContext, "Näita vastust");
    completeFlowDialog("POST", els.responseContext);
    syncHeight();
  }

  function updateChecks() {
    state.checks = $$("#validationFields input:checked").length;
    els.checkScore.textContent = `${state.checks}/4`;
    const done = state.checks === 4;
    els.takeaway.hidden = !done;
    if (done) {
      setPracticeLocked(false);
      award("validation", 25);
      setProgress(4, true);
      setStory(4, "<b>Sisu ja tähendus on kontrollitud.</b> Järgmisena harjuta API olekukoode.");
      setGuide("Kontroll on tehtud. Järgmisena harjuta olekukoode", els.decoderKicker, "Näita testi");
      window.setTimeout(() => els.decoderOptions.scrollIntoView({ behavior: "smooth", block: "center" }), 220);
    } else if (state.successfulPost) {
      setProgress(4);
      const nextCheck = $("#validationFields .check-card:not(:has(input:checked))");
      setGuide(`Kontrollitud ${state.checks}/4. Jätka järgmise küsimusega`, nextCheck, "Näita järgmist");
    }
    syncHeight();
  }

  function setPracticeLocked(locked) {
    els.practiceSuite.classList.toggle("locked", locked);
    if (locked) els.practiceSuite.setAttribute("aria-disabled", "true");
    else els.practiceSuite.removeAttribute("aria-disabled");
    $$("button", els.practiceSuite).forEach(button => { button.disabled = locked; });
  }

  function updateQuestionVisual(question, numberLabel, index, total) {
    const toneClasses = ["question-tone-0", "question-tone-1", "question-tone-2", "question-tone-3", "question-tone-4"];
    numberLabel.textContent = `${index + 1} / ${total}`;
    question.classList.remove(...toneClasses, "question-updated");
    question.classList.add(toneClasses[index % toneClasses.length]);
    void question.offsetWidth;
    question.classList.add("question-updated");
  }

  function renderDecoderRound() {
    const round = decoderRounds[state.decoderRound];
    els.decoderPrompt.textContent = round.prompt;
    updateQuestionVisual(els.decoderPrompt.closest(".test-question"), els.decoderQuestionNumber, state.decoderRound, decoderRounds.length);
    els.decoderRound.textContent = `${state.decoderRound + 1} / ${decoderRounds.length}`;
    els.decoderBar.style.width = `${((state.decoderRound + 1) / decoderRounds.length) * 100}%`;
    els.decoderScore.textContent = `${state.decoderScore} ${state.decoderScore === 1 ? "õige" : "õiget"}`;
    els.decoderHint.className = "test-feedback";
    els.decoderHint.textContent = "Vali kõige sobivam olekukood.";
    state.decoderLocked = false;
    $$('button', els.decoderOptions).forEach(button => {
      button.disabled = false;
      button.classList.remove("correct", "wrong");
    });
    setGuide(`Olekukood ${state.decoderRound + 1}/4. Vali olukorrale sobiv kood`, els.decoderKicker, "Näita küsimust");
  }

  function chooseDecoder(event) {
    const button = event.target.closest("button[data-code]");
    if (!button || state.decoderLocked) return;
    state.decoderLocked = true;
    const round = decoderRounds[state.decoderRound];
    const correct = button.dataset.code === round.code;
    if (correct) {
      state.decoderScore += 1;
      award(`decoder-${state.decoderRound}`, 5);
    }
    $$('button', els.decoderOptions).forEach(item => {
      item.disabled = true;
      if (item.dataset.code === round.code) item.classList.add("correct");
    });
    if (!correct) button.classList.add("wrong");
    els.decoderScore.textContent = `${state.decoderScore} ${state.decoderScore === 1 ? "õige" : "õiget"}`;
    els.decoderHint.className = `test-feedback ${correct ? "good" : "bad"}`;
    els.decoderHint.textContent = `${correct ? "Õige." : "Vaata õiget vastust."} ${round.why}`;
    window.setTimeout(() => {
      if (state.decoderRound < decoderRounds.length - 1) {
        state.decoderRound += 1;
        renderDecoderRound();
      } else {
        els.decoderPrompt.textContent = `Harjutus tehtud: ${state.decoderScore}/${decoderRounds.length} õiget`;
        els.decoderHint.className = "test-feedback good";
        els.decoderHint.textContent = "Olekukood näitab, mida järgmisena kontrollida.";
        setGuide("Olekukoodid on tehtud. Järgmisena vali olukorrale sobiv meetod", els.methodKicker, "Näita testi");
      }
      syncHeight();
    }, 1800);
  }

  function renderMethodRound() {
    const round = methodRounds[state.methodRound];
    els.methodScenario.textContent = round.text;
    updateQuestionVisual(els.methodScenario.closest(".test-question"), els.methodQuestionNumber, state.methodRound, methodRounds.length);
    els.methodRound.textContent = `${state.methodRound + 1} / ${methodRounds.length}`;
    els.methodBar.style.width = `${((state.methodRound + 1) / methodRounds.length) * 100}%`;
    els.methodScore.textContent = `${state.methodScore} ${state.methodScore === 1 ? "punkt" : "punkti"}`;
    els.methodFeedback.className = "method-feedback";
    els.methodFeedback.textContent = "Tee valik, et saada kohe tagasisidet.";
    state.methodLocked = false;
    $$('button', els.methodOptions).forEach(button => {
      button.disabled = false;
      button.classList.remove("correct", "wrong");
    });
    setGuide(`Meetodi valik ${state.methodRound + 1}/5. Vali olukorrale sobiv meetod`, els.methodKicker, "Näita küsimust");
  }

  function chooseMethod(event) {
    const button = event.target.closest("button[data-method]");
    if (!button || state.methodLocked) return;
    state.methodLocked = true;
    const round = methodRounds[state.methodRound];
    const correct = button.dataset.method === round.correct;
    if (correct) {
      state.methodScore += 1;
      award(`method-${state.methodRound}`, 5);
    }
    $$('button', els.methodOptions).forEach(item => {
      item.disabled = true;
      if (item.dataset.method === round.correct) item.classList.add("correct");
    });
    if (!correct) button.classList.add("wrong");
    els.methodScore.textContent = `${state.methodScore} ${state.methodScore === 1 ? "punkt" : "punkti"}`;
    els.methodFeedback.className = `method-feedback ${correct ? "good" : "bad"}`;
    els.methodFeedback.textContent = `${correct ? "Õige." : "Mõtle veel."} ${round.why}`;
    window.setTimeout(() => {
      if (state.methodRound < methodRounds.length - 1) {
        state.methodRound += 1;
        renderMethodRound();
      } else {
        els.methodScenario.textContent = `Harjutus tehtud: ${state.methodScore}/${methodRounds.length} õiget valikut.`;
        els.methodFeedback.className = "method-feedback good";
        els.methodFeedback.textContent = "Vali meetod ülesande, andmemahu ja korduvuse järgi.";
        setGuide("Meetodi valik on tehtud. Järgmisena testi API mõistmist", els.conceptKicker, "Näita kolmandat testi");
      }
      syncHeight();
    }, 1700);
  }

  function renderConceptRound() {
    const round = conceptRounds[state.conceptRound];
    els.conceptPrompt.textContent = round.prompt;
    updateQuestionVisual(els.conceptPrompt.closest(".test-question"), els.conceptQuestionNumber, state.conceptRound, conceptRounds.length);
    els.conceptRound.textContent = `${state.conceptRound + 1} / ${conceptRounds.length}`;
    els.conceptBar.style.width = `${((state.conceptRound + 1) / conceptRounds.length) * 100}%`;
    els.conceptScore.textContent = `${state.conceptScore} ${state.conceptScore === 1 ? "õige" : "õiget"}`;
    els.conceptFeedback.className = "concept-feedback test-feedback";
    els.conceptFeedback.textContent = "Vali üks vastus.";
    state.conceptLocked = false;
    $$("button", els.conceptOptions).forEach((button, index) => {
      button.disabled = false;
      button.classList.remove("correct", "wrong");
      button.querySelector("span").textContent = round.options[index];
    });
    setGuide(`API mõistmine ${state.conceptRound + 1}/${conceptRounds.length}. Vali parim vastus`, els.conceptKicker, "Näita küsimust");
  }

  function chooseConcept(event) {
    const button = event.target.closest("button[data-answer]");
    if (!button || state.conceptLocked) return;
    state.conceptLocked = true;
    const round = conceptRounds[state.conceptRound];
    const correct = Number(button.dataset.answer) === round.correct;
    if (correct) {
      state.conceptScore += 1;
      award(`concept-${state.conceptRound}`, 5);
    }
    $$("button", els.conceptOptions).forEach((item, index) => {
      item.disabled = true;
      if (index === round.correct) item.classList.add("correct");
    });
    if (!correct) button.classList.add("wrong");
    els.conceptScore.textContent = `${state.conceptScore} ${state.conceptScore === 1 ? "õige" : "õiget"}`;
    els.conceptFeedback.className = `concept-feedback test-feedback ${correct ? "good" : "bad"}`;
    els.conceptFeedback.textContent = `${correct ? "Õige." : "Vaata õiget vastust."} ${round.why}`;
    window.setTimeout(() => {
      if (state.conceptRound < conceptRounds.length - 1) {
        state.conceptRound += 1;
        renderConceptRound();
      } else {
        els.conceptPrompt.textContent = `Kolm testi tehtud. Skoor: ${state.conceptScore}/${conceptRounds.length}.`;
        els.conceptFeedback.className = "concept-feedback test-feedback good";
        els.conceptFeedback.textContent = "Oskad eristada metaandmeid, päringu keha, olekukoodi ja sisulist kontrolli.";
        setGuide("Kõik kolm testi on tehtud. Võid alustada algusest", els.resetButton, "Alusta algusest");
      }
      syncHeight();
    }, 1800);
  }

  function resetLab() {
    state = initialState();
    if (els.flowDialog.open) els.flowDialog.close();
    dialogTarget = null;
    setResultPanelVisible(false);
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.selectionSection.classList.add("locked");
    els.selectionFields.disabled = true;
    els.sendSection.classList.add("locked");
    els.sendFields.disabled = true;
    els.validationSection.classList.add("locked");
    els.validationSection.setAttribute("aria-disabled", "true");
    els.validationFields.disabled = true;
    $$("#selectionFields input[type='checkbox']").forEach(input => { input.checked = defaultPeriods.has(input.value); });
    $$("#validationFields input").forEach(input => { input.checked = false; });
    els.indicatorSelect.selectedIndex = 0;
    els.activitySelect.selectedIndex = 0;
    els.getMetadata.disabled = false;
    els.getMetadata.querySelector("span").textContent = "Küsi metaandmed";
    els.sendRequest.querySelector("span").textContent = "Saada POST-päring";
    els.requestFeedback.hidden = true;
    els.resultViz.hidden = true;
    els.takeaway.hidden = true;
    els.checkScore.textContent = "0/4";
    els.terminalTitle.textContent = "vastus.json";
    setStatus("—", "neutral");
    setResponseContext("API VASTUS", "Pärast päringu saatmist näed siin teenuselt saadud vastust.");
    showResponse({ status: "Päringut pole veel saadetud" });
    setStory(1, "<b>Alusta tabeli kirjeldusest.</b> GET-päring näitab, milliseid andmeid saab küsida.");
    els.flowStatus.textContent = "Päringut pole veel saadetud";
    updateRequestPreview();
    renderDecoderRound();
    renderMethodRound();
    renderConceptRound();
    setPracticeLocked(true);
    setProgress(1);
    hideGuide(els.getMetadata);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncHeight() {
    const params = new URLSearchParams(location.search);
    if (window.self === window.top && params.get("embed") !== "1" && params.get("embedMode") !== "1") return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "simfluence:resize", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }

  els.getMetadata.addEventListener("click", loadMetadata);
  els.sendRequest.addEventListener("click", sendPost);
  els.responseOutput.addEventListener("pointerover", event => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, true);
  });
  els.responseOutput.addEventListener("pointerout", event => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, false);
  });
  els.responseOutput.addEventListener("focusin", event => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, true);
  });
  els.responseOutput.addEventListener("focusout", event => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, false);
  });
  els.flowDialogClose.addEventListener("click", () => {
    const viewingPostResponse = state.successfulPost && dialogTarget === els.responseContext;
    els.flowDialog.close();
    window.setTimeout(() => dialogTarget?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    if (viewingPostResponse) window.setTimeout(advanceToValidation, 3200);
  });
  els.resetButton.addEventListener("click", resetLab);
  els.selectionFields.addEventListener("change", () => {
    updateRequestPreview();
    if (state.metadata && !state.successfulPost) setGuide("Saada valitud andmete POST-päring", els.sendRequest, "Näita nuppu");
  });
  els.validationFields.addEventListener("change", updateChecks);
  els.decoderOptions.addEventListener("click", chooseDecoder);
  els.methodOptions.addEventListener("click", chooseMethod);
  els.conceptOptions.addEventListener("click", chooseConcept);
  window.addEventListener("message", event => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("embed") === "1" || params.get("embedMode") === "1") document.body.classList.add("embed-mode");
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  populateSelectionOptions();
  updateRequestPreview();
  renderDecoderRound();
  renderMethodRound();
  renderConceptRound();
  setPracticeLocked(true);
  setProgress(1);
  hideGuide(els.getMetadata);
  window.setTimeout(syncHeight, 100);
})();
