(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const TOTAL_STEPS = 4;
  const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const GEMINI_MODEL = "gemini-3.6-flash";

  const metadataSample = `{
  "title": "PA111: Keskmine brutokuupalk",
  "variables": [
    { "code": "Näitaja", "values": ["GR_W_AVG", "..."] },
    { "code": "Tegevusala", "values": ["TOTAL", "..."] },
    { "code": "Vaatlusperiood", "values": ["2024Q2", "2025Q2", "2026Q2", "..."] }
  ]
}`;

  const metadataOptions = {
    indicators: [
      ["GR_W_AVG", "Keskmine brutokuupalk, eurot"],
      ["NR_EMPL", "Töötajate arv"],
      ["GR_W_D1", "Brutokuupalga I detsiil, eurot"],
      ["GR_W_D2", "Brutokuupalga II detsiil, eurot"],
      ["GR_W_D3", "Brutokuupalga III detsiil, eurot"],
      ["GR_W_D4", "Brutokuupalga IV detsiil, eurot"],
      ["GR_W_D5", "Brutokuupalga mediaan (V detsiil), eurot"],
      ["GR_W_D6", "Brutokuupalga VI detsiil, eurot"],
      ["GR_W_D7", "Brutokuupalga VII detsiil, eurot"],
      ["GR_W_D8", "Brutokuupalga VIII detsiil, eurot"],
      ["GR_W_D9", "Brutokuupalga IX detsiil, eurot"],
      ["GR_W_AVG_SM", "Keskmise brutokuupalga muutus võrreldes eelmise aasta sama perioodiga, %"]
    ],
    activities: [
      ["TOTAL", "Kokku – kõik tegevusalad"],
      ["A", "Põllumajandus, metsamajandus ja kalapüük"],
      ["B", "Mäetööstus"],
      ["C", "Töötlev tööstus"],
      ["D", "Elektrienergia, gaasi, auru ja konditsioneeritud õhuga varustamine"],
      ["E", "Veevarustus; kanalisatsioon; jäätme- ja saastekäitlus"],
      ["F", "Ehitus"],
      ["G", "Hulgi- ja jaekaubandus; mootorsõidukite ja mootorrataste remont"],
      ["H", "Veondus ja laondus"],
      ["I", "Majutus ja toitlustus"],
      ["J", "Info ja side"],
      ["K", "Finants- ja kindlustustegevus"],
      ["L", "Kinnisvaraalane tegevus"],
      ["M", "Kutse-, teadus- ja tehnikaalane tegevus"],
      ["N", "Haldus- ja abitegevused"],
      ["O", "Avalik haldus ja riigikaitse; kohustuslik sotsiaalkindlustus"],
      ["P", "Haridus"],
      ["Q", "Tervishoid ja sotsiaalhoolekanne"],
      ["R", "Kunst, meelelahutus ja vaba aeg"],
      ["S", "Muud teenindavad tegevused"]
    ],
    periods: [
      ["2021Q1", "I kv"], ["2021Q2", "II kv"], ["2021Q3", "III kv"], ["2021Q4", "IV kv"],
      ["2022Q1", "I kv"], ["2022Q2", "II kv"], ["2022Q3", "III kv"], ["2022Q4", "IV kv"],
      ["2023Q1", "I kv"], ["2023Q2", "II kv"], ["2023Q3", "III kv"], ["2023Q4", "IV kv"],
      ["2024Q1", "I kv"], ["2024Q2", "II kv"], ["2024Q3", "III kv"], ["2024Q4", "IV kv"],
      ["2025Q1", "I kv"], ["2025Q2", "II kv"], ["2025Q3", "III kv"], ["2025Q4", "IV kv"],
      ["2026Q1", "I kv"], ["2026Q2", "II kv"]
    ]
  };
  const defaultPeriods = new Set(["2024Q2", "2025Q2", "2026Q2"]);
  const officialWages = Object.freeze({ "2024Q2": 2007, "2025Q2": 2126, "2026Q2": 2243 });

  const runLabels = [
    "Ava tabeli kirjeldus (GET)",
    "Kinnita andmevalik",
    "Saada Statistikaameti päring (POST)",
    "Käivita Gemini näidispäring"
  ];
  const completedLabels = [
    "Tabeli kirjeldus on avatud",
    "Andmevalik on kinnitatud",
    "Statistikaameti vastus on avatud",
    "Mudeli näidisvastus on avatud"
  ];

  let currentStep = 1;
  let completed = 0;
  let running = false;
  let selectedData = null;
  const els = {
    progressValue: $("#progressValue"),
    progressText: $("#progressText"),
    progressBar: $("#progressBar"),
    completedCount: $("#completedCount"),
    labGrid: $(".lab-grid"),
    stageTitle: $("#stageTitle"),
    stageCard: $("#stageCard"),
    statusChip: $("#statusChip"),
    statusText: $("#statusText"),
    responseContext: $("#responseContext"),
    responseContextLabel: $("#responseContextLabel"),
    responseContextText: $("#responseContextText"),
    consoleOutput: $("#consoleOutput"),
    consoleBadge: $("#consoleBadge"),
    terminalTitle: $("#terminalTitle"),
    currentStepLabel: $("#currentStepLabel"),
    prevLesson: $("#prevLesson"),
    nextLesson: $("#nextLesson"),
    flowMap: $("#flowMap"),
    flowPackage: $("#flowPackage"),
    flowApi: $("#flowApi"),
    flowMethodLabel: $("#flowMethodLabel"),
    flowApiRole: $("#flowApiRole"),
    flowApiName: $("#flowApiName"),
    postResponseOutput: $("#postResponseOutput"),
    dataSummary: $("#dataSummary"),
    dataSourceNote: $("#dataSourceNote"),
    dataTableCaption: $("#dataTableCaption"),
    dataRows: $("#dataRows"),
    dataComparison: $("#dataComparison"),
    modelInputPreview: $("#modelInputPreview"),
    modelResult: $("#modelResult"),
    modelAnswer: $("#modelAnswer"),
    selectionFields: $("#selectionFields"),
    indicatorSelect: $("#indicatorSelect"),
    activitySelect: $("#activitySelect"),
    periodOptions: $("#periodOptions"),
    selectionMath: $("#selectionMath"),
    valueCount: $("#valueCount"),
    selectionFeedback: $("#selectionFeedback"),
    selectionAction: $("#selectionAction"),
    modelGuide: $("#modelGuide"),
    sequenceExercise: $("#sequenceExercise"),
    practiceSuite: $("#practiceSuite"),
    flowDialog: $("#flowDialog"),
    dialogFlowStage: $("#dialogFlowStage"),
    dialogFlowStatus: $("#dialogFlowStatus"),
    flowDialogResult: $("#flowDialogResult"),
    flowDialogClose: $("#flowDialogClose"),
    dialogApiName: $("#dialogApiName"),
    dialogServiceIcon: $("#dialogServiceIcon"),
    dialogServiceRole: $("#dialogServiceRole"),
    dialogServiceName: $("#dialogServiceName"),
    dialogServiceAction: $("#dialogServiceAction")
  };

  function syncHeight() {
    const params = new URLSearchParams(location.search);
    if (window.self === window.top && params.get("embed") !== "1" && params.get("embedMode") !== "1") return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: "simfluence:resize", height }, "*");
    window.parent.postMessage({ type: "resize", height }, "*");
  }

  function setResultPanelVisible(visible) {
    els.stageCard.hidden = !visible;
    els.labGrid.classList.toggle("result-pending", !visible);
    syncHeight();
  }

  function alignResponseWithLesson(step) {
    const desktop = window.matchMedia("(min-width: 1001px)").matches;
    const lesson = $(`[data-lesson="${step}"]`);
    const target = desktop && lesson ? lesson : els.stageCard;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setResponseContext(label, message, kind = "neutral") {
    els.responseContextLabel.textContent = label;
    els.responseContextText.textContent = message;
    els.responseContext.className = `response-context ${kind}`;
  }

  function populateSelectionOptions() {
    const fillSelect = (select, options) => {
      select.replaceChildren(...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${label} · ${value}`;
        return option;
      }));
    };
    fillSelect(els.indicatorSelect, metadataOptions.indicators);
    fillSelect(els.activitySelect, metadataOptions.activities);

    const years = new Map();
    metadataOptions.periods.forEach(([value, label]) => {
      const year = value.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push([value, label]);
    });
    els.periodOptions.replaceChildren(...[...years].map(([year, periods]) => {
      const group = document.createElement("div");
      group.className = "period-year";
      const heading = document.createElement("b");
      heading.textContent = year;
      const grid = document.createElement("div");
      grid.className = "period-year-grid";
      periods.forEach(([value, label]) => {
        const item = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = value;
        input.checked = defaultPeriods.has(value);
        const text = document.createElement("span");
        text.className = "period-label";
        text.textContent = label;
        item.append(input, text);
        grid.append(item);
      });
      group.append(heading, grid);
      return group;
    }));
  }

  function selectedPeriods() {
    return $$("input[type='checkbox']:checked", els.periodOptions).map((input) => input.value);
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

  function fullPostRequest() {
    return [
      "POST https://andmed.stat.ee/api/v1/et/stat/PA111",
      "Content-Type: application/json",
      "Accept: application/json",
      "",
      JSON.stringify(requestBody(), null, 2)
    ].join("\n");
  }

  function updateRequestPreview() {
    const count = selectedPeriods().length;
    els.selectionMath.textContent = `1 × 1 × ${count}`;
    els.valueCount.textContent = `= ${count} ${count === 1 ? "väärtus" : "väärtust"}`;
    $("#code2").textContent = fullPostRequest();
    els.selectionFeedback.className = `selection-feedback ${count ? "" : "error"}`.trim();
    els.selectionFeedback.textContent = count ? "" : "Vali vähemalt üks vaatlusperiood.";
    syncHeight();
  }

  function indicatorUnit() {
    if (els.indicatorSelect.value === "NR_EMPL") return "töötajat";
    if (els.indicatorSelect.value === "GR_W_AVG_SM") return "%";
    return "€";
  }

  function simulatedValue(period) {
    const indicator = els.indicatorSelect.value;
    if (indicator === "GR_W_AVG" && els.activitySelect.value === "TOTAL" && Object.hasOwn(officialWages, period)) {
      return officialWages[period];
    }
    const activityIndex = metadataOptions.activities.findIndex(([code]) => code === els.activitySelect.value);
    const year = Number(period.slice(0, 4));
    const quarter = Number(period.slice(-1));
    const timeIndex = (year - 2024) * 4 + quarter - 2;
    if (indicator === "NR_EMPL") return 100000 + timeIndex * 700 + activityIndex * 1200;
    if (indicator === "GR_W_AVG_SM") return Number((5.2 + timeIndex * 0.08 - activityIndex * 0.05).toFixed(1));
    const wageBase = {
      GR_W_AVG: 2007, GR_W_D1: 1150, GR_W_D2: 1320, GR_W_D3: 1490, GR_W_D4: 1660,
      GR_W_D5: 1840, GR_W_D6: 2030, GR_W_D7: 2260, GR_W_D8: 2570, GR_W_D9: 3100
    }[indicator] || 2007;
    return Math.max(1, Math.round(wageBase + timeIndex * 35 + activityIndex * 12));
  }

  function formatValue(value) {
    const [whole, fraction] = String(value).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return fraction ? `${grouped},${fraction}` : grouped;
  }

  function formatPeriod(period, inSentence = false) {
    const quarters = { Q1: "I", Q2: "II", Q3: "III", Q4: "IV" };
    const year = period.slice(0, 4);
    const quarter = quarters[period.slice(4)];
    return inSentence ? `${year}. aasta ${quarter} kvartalis` : `${year} ${quarter} kv`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function usesOfficialValues(periods) {
    return els.indicatorSelect.value === "GR_W_AVG"
      && els.activitySelect.value === "TOTAL"
      && periods.every((period) => Object.hasOwn(officialWages, period));
  }

  function linkedPostResponse(data, { indicator, activity, unit, periods, values }) {
    let insideValues = false;
    let valueIndex = 0;

    return JSON.stringify(data, null, 2).split("\n").map((line) => {
      const trimmed = line.trim();
      if (trimmed === '"value": [') {
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
          const hint = `${formatValue(values[index])} ${unit} · ${indicator} · ${activity} · ${periods[index]}`;
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
    }).join("\n");
  }

  function toggleResultLinks(index, active) {
    els.postResponseOutput
      .querySelectorAll(`[data-result-index="${index}"], .request-code-shared`)
      .forEach((item) => item.classList.toggle("is-linked", active));
  }

  function captureSelectedData() {
    const periods = selectedPeriods();
    const values = periods.map(simulatedValue);
    const unit = indicatorUnit();
    const first = values[0];
    const last = values.at(-1);
    const hasComparison = periods.length > 1;
    return {
      periods, values, unit,
      indicator: els.indicatorSelect.value,
      indicatorName: els.indicatorSelect.selectedOptions[0].textContent.split(" · ")[0],
      activity: els.activitySelect.value,
      activityName: els.activitySelect.selectedOptions[0].textContent.split(" · ")[0],
      official: usesOfficialValues(periods),
      changeUnit: unit === "%" ? "protsendipunkti" : unit,
      change: hasComparison ? Number((last - first).toFixed(1)) : null,
      relativeChange: hasComparison && unit !== "%" && first !== 0
        ? Number(((last / first - 1) * 100).toFixed(1))
        : null
    };
  }

  function signed(value) {
    return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatValue(Math.abs(value))}`;
  }

  function formattedChange(data) {
    const relative = data.relativeChange === null ? "" : ` (${signed(data.relativeChange)}%)`;
    return `${signed(data.change)} ${data.changeUnit}${relative}`;
  }

  function renderSelectedData(data) {
    const { periods, values, unit, indicator, activity, official } = data;
    const response = {
      version: "2.0",
      class: "dataset",
      label: "PA111 näidisvastus",
      id: ["Näitaja", "Tegevusala", "Vaatlusperiood"],
      size: [1, 1, periods.length],
      dimension: {
        Näitaja: { category: { index: [indicator] } },
        Tegevusala: { category: { index: [activity] } },
        Vaatlusperiood: { category: { index: periods } }
      },
      value: values
    };
    els.postResponseOutput.innerHTML = `<code>${linkedPostResponse(response, data)}</code>`;
    els.dataSourceNote.textContent = official
      ? "Väärtused pärinevad Statistikaameti tabelist PA111."
      : "Vastus sisaldab õppimiseks loodud näidisväärtusi.";
    els.dataTableCaption.textContent = `${data.indicatorName}. ${data.activityName}.`;
    const rows = periods.map((period, index) => {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = formatPeriod(period);
      row.append(heading);
      row.insertCell().textContent = `${formatValue(values[index])} ${unit}`;
      return row;
    });
    els.dataRows.replaceChildren(...rows);
    els.dataComparison.textContent = data.change === null
      ? "Muutuse arvutamiseks on vaja vähemalt kaht perioodi."
      : `Muutus esimesest valitud perioodist viimaseni on ${formattedChange(data)}.`;
    els.dataSummary.hidden = false;
  }

  function renderModelInput(data) {
    const task = data.change === null
      ? "Kirjelda valitud perioodi väärtust ja selgita, mida oleks vaja ajas muutumise hindamiseks."
      : "Sõnasta kahe lausega ainult etteantud arvudel põhinev järeldus esimese ja viimase perioodi kohta.";
    const source = data.official ? "Statistikaameti tabel PA111" : "Harjutuse näidisandmed";
    const input = {
      ulesanne: task,
      allikas: source,
      naitaja: data.indicatorName,
      tegevusala: data.activityName,
      perioodid: data.periods,
      vaartused: data.values,
      uhik: data.unit,
      muutus: data.change,
      muutuse_uhik: data.changeUnit,
      suhteline_muutus_protsentides: data.relativeChange
    };
    els.modelInputPreview.textContent = JSON.stringify(input, null, 2);
    $("#code4").textContent = [
      `perioodid <- c(${data.periods.map((period) => JSON.stringify(period)).join(", ")})`,
      `vaartused <- c(${data.values.join(", ")})`,
      `uhik <- ${JSON.stringify(data.unit)}`,
      "esimene <- vaartused[1]",
      "viimane <- tail(vaartused, 1)",
      "vordlus <- length(vaartused) >= 2",
      "muutus <- if (vordlus) round(viimane - esimene, 1) else NA_real_",
      "suhteline <- if (vordlus && uhik != \"%\" && esimene != 0) {",
      "  round((viimane / esimene - 1) * 100, 1)",
      "} else NA_real_",
      "",
      "sisend <- jsonlite::toJSON(list(",
      `  ulesanne = ${JSON.stringify(task)},`,
      `  allikas = ${JSON.stringify(source)},`,
      `  naitaja = ${JSON.stringify(data.indicatorName)},`,
      `  tegevusala = ${JSON.stringify(data.activityName)},`,
      "  perioodid = I(perioodid), vaartused = I(vaartused), uhik = uhik,",
      `  muutus = muutus, muutuse_uhik = ${JSON.stringify(data.changeUnit)},`,
      "  suhteline_muutus_protsentides = suhteline",
      "), auto_unbox = TRUE, na = \"null\")",
      "",
      "voti <- Sys.getenv(\"GEMINI_API_KEY\")",
      "stopifnot(nzchar(voti))",
      `vastus <- httr2::request(${JSON.stringify(GEMINI_ENDPOINT)}) |>`,
      "  httr2::req_headers_redacted(\"x-goog-api-key\" = voti) |>",
      `  httr2::req_body_json(list(model = ${JSON.stringify(GEMINI_MODEL)},`,
      "    input = as.character(sisend), store = FALSE)) |>",
      "  httr2::req_perform() |>",
      "  httr2::resp_body_json(simplifyVector = FALSE)"
    ].join("\n");
  }

  function modelResponse(data) {
    const indicator = data.indicatorName.split(", ")[0];
    const activity = data.activity === "TOTAL" ? "kõik tegevusalad" : data.activityName;
    const subject = `${indicator} (${activity})`;
    const first = formatPeriod(data.periods[0], true);
    const firstValue = formatValue(data.values[0]);
    const last = formatPeriod(data.periods.at(-1), true);
    const lastValue = formatValue(data.values.at(-1));
    const text = data.change === null
      ? `${subject} oli ${first} ${firstValue} ${data.unit}. Muutuse hindamiseks on vaja vähemalt kaht perioodi.`
      : `${subject} oli ${first} ${firstValue} ${data.unit} ja ${last} ${lastValue} ${data.unit}. Muutus oli ${formattedChange(data)}.`;
    els.modelAnswer.textContent = text;
    els.modelResult.hidden = false;
    return {
      id: "interaction_demo",
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text }] }]
    };
  }

  function updateProgress() {
    const labels = ["1. Tabeli kirjeldus", "2. Andmevalik", "3. Andmepäring", "4. Mudeli päring ja vastus", "Põhiülesanne lõpetatud"];
    const percent = Math.round((completed / TOTAL_STEPS) * 100);
    els.progressValue.textContent = `${percent}%`;
    els.progressText.textContent = labels[completed];
    els.progressBar.style.width = `${percent}%`;
    els.completedCount.textContent = completed;
    $$(".step").forEach((step) => {
      const number = Number(step.dataset.step);
      step.classList.toggle("done", number <= completed);
      step.disabled = number > completed + 1;
    });
  }

  function showStep(step, scroll = false) {
    if (step < 1 || step > TOTAL_STEPS || step > completed + 1 || running) return;
    currentStep = step;
    const visibleLesson = step === 3 ? 2 : step;
    $$(".lesson-panel").forEach((panel) => {
      const number = Number(panel.dataset.lesson);
      panel.hidden = number > visibleLesson;
      panel.classList.toggle("active", number === visibleLesson);
      panel.classList.toggle("completed", number <= completed && (number < visibleLesson || number === TOTAL_STEPS));
    });
    if (step === 2) {
      els.selectionAction.dataset.run = "2";
      els.selectionAction.classList.remove("orange");
      els.selectionAction.disabled = completed >= 2;
      els.selectionAction.querySelector("span").textContent = completed >= 2 ? completedLabels[1] : runLabels[1];
    } else if (step === 3) {
      els.selectionAction.dataset.run = "3";
      els.selectionAction.classList.add("orange");
      els.selectionAction.disabled = completed >= 3;
      els.selectionAction.querySelector("span").textContent = completed >= 3 ? completedLabels[2] : runLabels[2];
    }
    $$(".step").forEach((item) => {
      const active = Number(item.dataset.step) === step;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    els.currentStepLabel.textContent = `SAMM ${step} / ${TOTAL_STEPS}`;
    els.prevLesson.disabled = step === 1;
    els.nextLesson.disabled = step >= completed + 1 || step === TOTAL_STEPS;
    const aiStep = step === 4;
    els.flowMethodLabel.textContent = aiStep ? "POST" : "GET / POST";
    els.flowApiRole.textContent = aiStep ? "AI TEENUS" : "ANDMEALLIKAS";
    els.flowApiName.textContent = aiStep ? "Gemini API" : "PA111 API";
    els.flowPackage.classList.toggle("active", completed >= 1);
    els.flowApi.classList.toggle("active", completed >= 2);
    if (scroll) alignResponseWithLesson(step);
    syncHeight();
  }

  function showResponsePanel(panelId) {
    $$(".workspace-panel").forEach((panel) => { panel.hidden = panel.id !== panelId; });
    syncHeight();
  }

  const dialogConfigs = {
    1: {
      method: "GET",
      api: "Statistikaameti API",
      icon: "PA",
      serviceRole: "ANDMEALLIKAS",
      service: "Tabel PA111",
      serviceAction: "Tabeli kirjeldus ja valikud",
      processing: "API koostab tabeli kirjelduse",
      result: "GET-vastus sisaldab tabeli kirjeldust ja valikukoode.",
      close: "Vaata tabeli kirjeldust"
    },
    3: {
      method: "POST",
      api: "Statistikaameti API",
      icon: "PA",
      serviceRole: "ANDMEALLIKAS",
      service: "Tabel PA111",
      serviceAction: "Valitud andmete allikas",
      processing: "API koostab vastuse tabeli PA111 põhjal",
      result: "POST-vastus sisaldab valitud näitaja ja perioodide väärtusi.",
      close: "Vaata andmeid ja arvutust"
    },
    4: {
      method: "POST",
      api: "Gemini API",
      icon: "AI",
      serviceRole: "VASTUSE KOOSTAJA",
      service: "Keelemudel",
      serviceAction: "Koostab selgituse",
      processing: "Keelemudel koostab vastuse",
      result: "Gemini näidisvastus sisaldab andmetel põhinevat selgitust.",
      close: "Võrdle selgitust lähteandmetega"
    }
  };

  function openFlowDialog(config) {
    els.dialogFlowStatus.textContent = `${config.method}-päring on teel`;
    els.flowDialogResult.textContent = "";
    els.flowDialogResult.className = "";
    els.dialogApiName.textContent = config.api;
    els.dialogServiceIcon.textContent = config.icon;
    els.dialogServiceRole.textContent = config.serviceRole;
    els.dialogServiceName.textContent = config.service;
    els.dialogServiceAction.textContent = config.serviceAction;
    els.flowDialogClose.disabled = true;
    els.flowDialogClose.querySelector("span").textContent = "Päring on töötlemisel";
    els.dialogFlowStage.classList.remove("sending", "returning");
    $$(".dialog-node", els.dialogFlowStage).forEach((node) => node.classList.remove("flow-active"));
    if (!els.flowDialog.open) els.flowDialog.showModal();
  }

  function completeFlowDialog(config) {
    els.dialogFlowStatus.textContent = "200 OK";
    els.flowDialogResult.textContent = config.result;
    els.flowDialogResult.className = "success";
    els.flowDialogClose.querySelector("span").textContent = config.close;
    els.flowDialogClose.disabled = false;
    els.flowDialogClose.focus({ preventScroll: true });
  }

  async function animateDialogFlow(config) {
    const stage = els.dialogFlowStage;
    const nodes = $$(".dialog-node", stage);
    const activate = (index) => nodes.forEach((node, nodeIndex) => node.classList.toggle("flow-active", nodeIndex === index));
    stage.classList.remove("sending", "returning");
    void stage.offsetWidth;

    activate(0);
    els.dialogFlowStatus.textContent = "R saadab päringu";
    stage.classList.add("sending");
    await wait(800);

    activate(1);
    els.dialogFlowStatus.textContent = "Päring jõuab API otspunkti";
    await wait(800);

    activate(2);
    els.dialogFlowStatus.textContent = config.processing;
    await wait(800);

    stage.classList.remove("sending");
    void stage.offsetWidth;
    stage.classList.add("returning");
    els.dialogFlowStatus.textContent = "Vastus liigub tagasi";
    await wait(900);

    activate(1);
    await wait(450);
    activate(0);
    els.dialogFlowStatus.textContent = "R saab vastuse";
    await wait(450);

    stage.classList.remove("returning");
    nodes.forEach((node) => node.classList.remove("flow-active"));
  }

  async function animateFlow(config) {
    els.flowPackage.classList.add("active");
    openFlowDialog(config);
    els.flowMap.classList.add("sending");
    await animateDialogFlow(config);
    els.flowMap.classList.remove("sending");
    els.flowApi.classList.add("active");
  }

  function setPracticeLocked(locked) {
    [els.sequenceExercise, els.practiceSuite].forEach((section) => {
      section.classList.toggle("locked", locked);
      section.inert = locked;
      if (locked) section.setAttribute("aria-disabled", "true");
      else section.removeAttribute("aria-disabled");
    });
  }

  async function runStep(step) {
    if (running || step !== currentStep || step !== completed + 1) return;
    if ((step === 2 || step === 3) && selectedPeriods().length === 0) {
      els.selectionFeedback.className = "selection-feedback error";
      els.selectionFeedback.textContent = "Vali vähemalt üks vaatlusperiood.";
      return;
    }
    const button = $(`[data-run="${step}"]`);
    if (step === 2) {
      completed = step;
      updateProgress();
      showStep(3);
      return;
    }
    running = true;
    if (step === 4) els.modelGuide.hidden = true;
    if (step === 1) {
      setResultPanelVisible(true);
      els.stageCard.classList.remove("awaiting-response");
      els.stageCard.removeAttribute("aria-disabled");
    }
    if (step === 3) {
      selectedData = captureSelectedData();
      els.selectionFields.disabled = true;
      els.selectionFeedback.textContent = "Uue andmevaliku saab teha praktikumi uuesti alustades.";
    }
    button.disabled = true;
    const config = dialogConfigs[step];
    els.statusChip.className = "status-chip running";
    els.statusText.textContent = "Päring on töötlemisel";
    await animateFlow(config);
    els.statusChip.className = "status-chip success";
    els.statusText.textContent = "Vastus saabus";
    els.consoleBadge.textContent = "200 OK";
    els.consoleBadge.className = "success";

    if (step === 1) {
      els.terminalTitle.textContent = "metaandmed.json";
      els.consoleOutput.textContent = metadataSample;
      setResponseContext("GET-VASTUSE VÄLJAVÕTE", "Väli values loetleb tabeli valikukoodid, mida kasutatakse POST-päringus.", "metadata");
      showResponsePanel("consolePanel");
    }
    if (step === 3) {
      renderSelectedData(selectedData);
      renderModelInput(selectedData);
      setResponseContext("STATISTIKAAMETI POST-VASTUS", "Välja value arvud on perioodikoodidega samas järjekorras.", "data");
      showResponsePanel("jsonPanel");
      els.modelGuide.hidden = false;
    }
    if (step === 4) {
      els.terminalTitle.textContent = "gemini-vastus.json";
      els.consoleOutput.textContent = JSON.stringify(modelResponse(selectedData), null, 2);
      setResponseContext("GEMINI POST-VASTUS", "Väljal steps on mudeli vastus. Tekst on väljal content.", "data");
      showResponsePanel("consolePanel");
      setPracticeLocked(false);
    }

    completed = step;
    button.querySelector("span").textContent = completedLabels[step - 1];
    updateProgress();
    running = false;
    showStep(Math.min(step + 1, TOTAL_STEPS));
    completeFlowDialog(config);
    syncHeight();
  }

  const sequenceCorrectOrder = ["trigger", "source", "transform", "ai", "output"];
  const sequenceInitialOrder = ["source", "output", "trigger", "ai", "transform"];
  let draggedSequenceBlock = null;

  function sequenceBlocks() {
    return $$(".sequence-block", $("#sequenceStack"));
  }

  function updateSequenceExercise() {
    const blocks = sequenceBlocks();
    let positionsCorrect = 0;
    let choicesCorrect = 0;

    blocks.forEach((block, index) => {
      const select = $("select", block);
      const positionCorrect = block.dataset.flowKey === sequenceCorrectOrder[index];
      const choiceCorrect = select.value === select.dataset.answer;
      if (positionCorrect) positionsCorrect += 1;
      if (choiceCorrect) choicesCorrect += 1;
      $(".block-order", block).textContent = String(index + 1);
      block.classList.toggle("position-correct", positionCorrect);
      select.classList.toggle("choice-correct", choiceCorrect);
      select.classList.toggle("choice-wrong", Boolean(select.value) && !choiceCorrect);
      const upButton = $('[data-sequence-move="up"]', block);
      const downButton = $('[data-sequence-move="down"]', block);
      upButton.disabled = index === 0;
      downButton.disabled = index === blocks.length - 1;
    });

    const solved = positionsCorrect === sequenceCorrectOrder.length && choicesCorrect === sequenceCorrectOrder.length;
    const score = positionsCorrect + choicesCorrect;
    $("#sequenceState").textContent = `${positionsCorrect} / 5 õiges kohas · ${choicesCorrect} / 5 valikut`;
    $("#sequenceProgress").style.width = `${score * 10}%`;

    const feedback = $("#sequenceFeedback");
    feedback.hidden = positionsCorrect !== 5;
    feedback.className = `sequence-feedback ${solved ? "complete" : "choices"}`;
    feedback.querySelector("span").textContent = solved ? "✓" : "2";
    feedback.querySelector("b").textContent = solved ? "Töövoog on valmis" : "Järjestus on õige";
    feedback.querySelector("p").textContent = solved
      ? "Kasutajale kuvatakse tõlgendus koos lähteandmetega, et ta saaks väiteid kontrollida."
      : "Lõpetamiseks tuleb valida iga sammu juurde sobiv tegevus.";
    syncHeight();
  }

  function moveSequenceBlock(block, direction) {
    const stack = $("#sequenceStack");
    if (direction === "up" && block.previousElementSibling) stack.insertBefore(block, block.previousElementSibling);
    if (direction === "down" && block.nextElementSibling) stack.insertBefore(block.nextElementSibling, block);
    updateSequenceExercise();
  }

  function resetSequenceExercise() {
    const stack = $("#sequenceStack");
    const byKey = Object.fromEntries(sequenceBlocks().map((block) => [block.dataset.flowKey, block]));
    sequenceInitialOrder.forEach((key) => stack.append(byKey[key]));
    sequenceBlocks().forEach((block) => {
      $("select", block).value = "";
      block.classList.remove("dragging", "drop-target");
    });
    updateSequenceExercise();
  }

  const plannerFields = [
    "useCaseInput",
    "environmentInput",
    "triggerInput",
    "sourceInput",
    "sensitivityInput",
    "aiRoleInput",
    "modelInput",
    "formatInput",
    "visualInput",
    "controlInput",
    "fallbackInput"
  ];

  function plannerValue(id) {
    return $(`#${id}`).value.trim();
  }

  function plannerLabel(id, fallback) {
    const select = $(`#${id}`);
    return select.value ? select.selectedOptions[0].textContent.trim() : fallback;
  }

  const workflowProfiles = {
    statistics: {
      roles: ["explain", "detect"],
      sources: ["statistics-api", "database-api", "csv"],
      visuals: ["kpi", "chart", "table", "summary"],
      environments: ["r", "python", "web", "workflow", "sheets", "backend"],
      triggers: ["button", "schedule", "new-data", "batch"]
    },
    survey: {
      roles: ["classify", "summarize", "detect"],
      sources: ["form", "csv", "database-api"],
      visuals: ["chart", "table", "summary"],
      environments: ["r", "python", "web", "workflow", "sheets", "backend"],
      triggers: ["button", "schedule", "new-data", "form", "batch"]
    },
    documents: {
      roles: ["extract", "summarize", "classify", "translate"],
      sources: ["documents", "email", "database-api"],
      visuals: ["table", "summary", "json"],
      environments: ["python", "web", "workflow", "backend"],
      triggers: ["button", "schedule", "new-data", "batch"]
    },
    support: {
      roles: ["classify", "draft", "summarize", "translate", "detect"],
      sources: ["crm", "email", "form", "database-api"],
      visuals: ["notification", "table", "summary", "json"],
      environments: ["python", "web", "workflow", "backend"],
      triggers: ["button", "schedule", "new-data", "form", "batch"]
    },
    meetings: {
      roles: ["summarize", "extract"],
      sources: ["documents", "email", "database-api"],
      visuals: ["summary", "table", "json"],
      environments: ["python", "web", "workflow", "backend"],
      triggers: ["button", "schedule", "new-data", "batch"]
    },
    content: {
      roles: ["draft", "translate", "summarize"],
      sources: ["database-api", "csv", "documents"],
      visuals: ["summary", "table", "json"],
      environments: ["python", "web", "workflow", "sheets", "backend"],
      triggers: ["button", "schedule", "new-data", "form", "batch"]
    }
  };

  const roleFormats = {
    explain: ["json", "schema", "text", "markdown"],
    classify: ["json", "schema", "table"],
    extract: ["json", "schema", "table"],
    summarize: ["text", "markdown", "json", "schema"],
    draft: ["text", "markdown"],
    translate: ["text", "markdown", "json", "schema"],
    detect: ["json", "schema", "table"]
  };

  const visualFormats = {
    kpi: ["json", "schema"],
    chart: ["json", "schema"],
    table: ["json", "schema", "table"],
    notification: ["json", "schema", "text"],
    summary: ["text", "markdown", "json", "schema"],
    json: ["json", "schema"]
  };

  const sourceEnvironments = {
    "statistics-api": ["r", "python", "web", "workflow", "sheets", "backend"],
    "database-api": ["r", "python", "web", "workflow", "sheets", "backend"],
    csv: ["r", "python", "web", "workflow", "sheets", "backend"],
    form: ["r", "python", "web", "workflow", "sheets", "backend"],
    email: ["python", "web", "workflow", "backend"],
    documents: ["python", "web", "workflow", "backend"],
    crm: ["python", "web", "workflow", "backend"]
  };

  const sourceTriggers = {
    "statistics-api": ["button", "schedule"],
    "database-api": ["button", "schedule", "new-data"],
    csv: ["button", "schedule", "batch"],
    form: ["button", "schedule", "new-data", "form"],
    email: ["button", "schedule", "new-data"],
    documents: ["button", "schedule", "new-data", "batch"],
    crm: ["button", "schedule", "new-data"]
  };

  function intersectPlannerOptions(...groups) {
    const activeGroups = groups.filter(Boolean);
    if (!activeGroups.length) return null;
    return activeGroups.slice(1).reduce((result, group) => result.filter((value) => group.includes(value)), [...activeGroups[0]]);
  }

  function plannerValueAllowed(value, allowed) {
    return !value || !allowed || allowed.includes(value);
  }

  function restrictPlannerSelect(id, allowed) {
    const select = $(`#${id}`);
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && allowed && !allowed.includes(option.value));
    });
    if (!plannerValueAllowed(select.value, allowed)) select.value = "";
  }

  function plannerCompatibility(values) {
    const profile = workflowProfiles[values.useCaseInput];
    return {
      profile,
      roles: profile?.roles || null,
      sources: profile?.sources || null,
      visuals: profile?.visuals || null,
      environments: intersectPlannerOptions(profile?.environments, sourceEnvironments[values.sourceInput]),
      triggers: intersectPlannerOptions(profile?.triggers, sourceTriggers[values.sourceInput]),
      formats: intersectPlannerOptions(roleFormats[values.aiRoleInput], visualFormats[values.visualInput]),
      models: values.environmentInput === "sheets" ? ["gemini", "openai", "anthropic", "azure"] : null
    };
  }

  function updatePlannerAvailability() {
    const values = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    const compatibility = plannerCompatibility(values);
    restrictPlannerSelect("sourceInput", compatibility.sources);
    restrictPlannerSelect("aiRoleInput", compatibility.roles);
    restrictPlannerSelect("visualInput", compatibility.visuals);

    const refreshedValues = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    const refreshedCompatibility = plannerCompatibility(refreshedValues);
    restrictPlannerSelect("environmentInput", refreshedCompatibility.environments);
    restrictPlannerSelect("triggerInput", refreshedCompatibility.triggers);
    restrictPlannerSelect("formatInput", refreshedCompatibility.formats);
    restrictPlannerSelect("modelInput", refreshedCompatibility.models);
  }

  function plannerOptionList(id, values) {
    const labels = values.slice(0, 3).map((value) => $(`#${id} option[value="${value}"]`).textContent.trim());
    if (labels.length < 2) return labels[0] || "sobiv valik";
    return `${labels.slice(0, -1).join(", ")} või ${labels.at(-1)}`;
  }

  function updateQuality(values) {
    const compatibility = plannerCompatibility(values);
    const profile = compatibility.profile;
    const roleFits = plannerValueAllowed(values.aiRoleInput, compatibility.roles);
    const sourceFits = plannerValueAllowed(values.sourceInput, compatibility.sources);
    const visualFits = plannerValueAllowed(values.visualInput, compatibility.visuals);
    const environmentFits = plannerValueAllowed(values.environmentInput, compatibility.environments);
    const triggerFits = plannerValueAllowed(values.triggerInput, compatibility.triggers);
    const modelFits = plannerValueAllowed(values.modelInput, compatibility.models);
    const roleFormatFits = !values.aiRoleInput || !values.formatInput || roleFormats[values.aiRoleInput].includes(values.formatInput);
    const visualFormatFits = !values.visualInput || !values.formatInput || visualFormats[values.visualInput].includes(values.formatInput);

    let clarity = (values.useCaseInput ? 5 : 0) + (values.aiRoleInput ? 8 : 0) + (values.formatInput ? 6 : 0) + (values.visualInput ? 6 : 0);
    if (!roleFits) clarity -= 7;
    if (!sourceFits) clarity -= 5;
    if (!visualFits) clarity -= 4;
    if (!roleFormatFits) clarity -= 4;
    if (!visualFormatFits) clarity -= 4;
    clarity = Math.max(0, clarity);
    if (![roleFits, sourceFits, visualFits, roleFormatFits, visualFormatFits].every(Boolean)) clarity = Math.min(clarity, 9);

    let privacy = (values.sourceInput ? 3 : 0) + (values.modelInput ? 2 : 0);
    if (values.sensitivityInput === "public") privacy = (values.sourceInput ? 5 : 0) + 5 + (values.modelInput ? 5 : 0) + 10;
    if (values.sensitivityInput === "internal") {
      const serviceFit = values.modelInput === "local" ? 5 : values.modelInput === "azure" ? 3 : 0;
      privacy = (values.sourceInput ? 4 : 0) + 5 + (values.modelInput ? 4 : 0) + serviceFit;
    }
    if (values.sensitivityInput === "personal") privacy = (values.sourceInput ? 2 : 0) + 5 + (values.modelInput ? 2 : 0);
    if (values.sensitivityInput === "sensitive") privacy = (values.sourceInput ? 1 : 0) + 5 + (values.modelInput ? 1 : 0);

    const strongControl = ["approve", "facts", "owner"].includes(values.controlInput);
    const control = (values.controlInput ? 10 : 0) + (values.formatInput ? 5 : 0) + (strongControl ? 7 : values.controlInput ? 5 : 0) + (values.modelInput ? 3 : 0);
    let reliability = (values.fallbackInput ? 10 : 0) + (values.triggerInput ? 5 : 0) + (values.environmentInput ? 5 : 0) + (values.modelInput ? 5 : 0);
    if (!environmentFits) reliability -= 8;
    if (!triggerFits) reliability -= 7;
    if (!modelFits) reliability -= 5;
    reliability = Math.max(0, reliability);
    if (![environmentFits, triggerFits, modelFits].every(Boolean)) reliability = Math.min(reliability, 9);
    const dimensions = { clarity, privacy, control, reliability };
    Object.entries(dimensions).forEach(([key, score]) => {
      $(`#${key}Score`).textContent = String(score);
      $(`#${key}Bar`).style.width = `${score * 4}%`;
    });
    const total = Object.values(dimensions).reduce((sum, score) => sum + score, 0);
    const scoreElement = $("#qualityScore");
    scoreElement.textContent = String(total);
    scoreElement.parentElement.className = `quality-score ${total >= 85 ? "strong" : total >= 55 ? "developing" : "starting"}`;
    scoreElement.parentElement.style.setProperty("--quality", `${total}%`);

    const labels = { clarity: "selgus", privacy: "andmekaitse", control: "kontroll", reliability: "töökindlus" };
    const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0][0];
    let hint = `Järgmine arengukoht on ${labels[weakest]}.`;
    if (values.sensitivityInput === "sensitive") hint = "Eriliiki või väga tundlike isikuandmete korral ei piisa mudeliteenuse valimisest. Enne saatmist on vaja õiguslikku alust, andmete minimeerimist ja turvameetmete kontrolli.";
    else if (values.sensitivityInput === "personal") hint = "Isikuandmete korral kontrolli enne saatmist õiguslikku alust, andmete vajalikkust, teenuse lepingut, säilitamist ja ligipääse.";
    else if (!values.useCaseInput) hint = "Alusta kasutusjuhust: millise otsuse või tööetapi jaoks on tulemust vaja?";
    else if (!environmentFits) hint = `Valitud käituskeskkond ei sobi selle kasutusjuhu ja andmeallikaga. Sobib ${plannerOptionList("environmentInput", compatibility.environments)}.`;
    else if (!triggerFits) hint = `Valitud käivitaja ei sobi selle andmeallikaga. Sobib ${plannerOptionList("triggerInput", compatibility.triggers)}.`;
    else if (!modelFits) hint = "Google Sheetsi töövoog ei pääse tavaliselt asutuse lokaalsele mudeli-API-le. Vali ligipääsetav teenus või teine käituskeskkond.";
    else if (!values.aiRoleInput) hint = "Anna AI-le üks piiratud tegevus: liigita, eralda, võta kokku, tõlgi või selgita.";
    else if (!roleFits) hint = `Valitud AI ülesanne ei sobi hästi selle kasutusjuhuga. Loogilisem on ${plannerOptionList("aiRoleInput", profile.roles)}.`;
    else if (!sourceFits) hint = `Valitud andmeallikas ei sobi hästi selle kasutusjuhuga. Loogilisem on ${plannerOptionList("sourceInput", profile.sources)}.`;
    else if (!roleFormatFits) hint = `Valitud ülesanne vajab teistsugust vastuse vormingut. Sobib ${plannerOptionList("formatInput", roleFormats[values.aiRoleInput])}.`;
    else if (!visualFormatFits) hint = `Valitud kasutajavaadet ei saa sellest vormingust usaldusväärselt koostada. Sobib ${plannerOptionList("formatInput", visualFormats[values.visualInput])}.`;
    else if (!visualFits) hint = `Valitud kasutajavaade ei ole selle kasutusjuhu jaoks kõige selgem. Sobib ${plannerOptionList("visualInput", profile.visuals)}.`;
    else if (values.sensitivityInput === "internal" && ["gemini", "openai", "anthropic"].includes(values.modelInput)) hint = "Asutusesiseste andmete puhul kontrolli enne pilvteenuse kasutamist lepingut, säilitamist, kasutuspiirkonda ja ligipääse.";
    else if (total >= 90) hint = "Tugev visand. Katseta nüüd allpool üht tõrkeolukorda ja vaata, kas plaan peab vastu.";
    $("#qualityHint").textContent = hint;
    return total;
  }

  function renderStressTest(values) {
    const scenario = $("#stressInput").value;
    const result = $("#stressResult");
    let state = "pending";
    let title = "Vali testolukord";
    let text = "Siin näed, kas kavandatud kontroll ja varuplaan aitavad.";

    if (scenario === "rate-limit") {
      const ready = ["retry", "queue", "cache"].includes(values.fallbackInput);
      state = ready ? "good" : "warn";
      title = ready ? "Plaan peab vastu" : "Lisa tehniline varuplaan";
      text = ready ? "Valitud tõrkeplaan väldib päringu lõputut kordamist ja säilitab töövoo kontrolli." : "429 vastus vajab piiratud korduskatseid, järjekorda või viimast kontrollitud tulemust.";
    } else if (scenario === "invalid-output") {
      const structured = values.formatInput === "schema";
      const reviewed = ["approve", "facts", "owner", "exceptions"].includes(values.controlInput);
      state = structured && reviewed ? "good" : "warn";
      title = state === "good" ? "Viga avastatakse enne kasutamist" : "Vastus võib märkamatult edasi liikuda";
      text = state === "good" ? "JSON-skeem tuvastab vormivea ja inimkontroll püüab kinni sisulise vea." : "Kasuta struktureeritud skeemi ning määra, kes vigase või puuduliku vastuse üle vaatab.";
    } else if (scenario === "personal-data") {
      const declared = ["personal", "sensitive"].includes(values.sensitivityInput);
      state = "warn";
      title = "Peata saatmine ja hinda andmekaitset";
      text = declared
        ? "Risk on kavandis märgitud, kuid teenuse valik üksi ei anna saatmiseks luba. Kontrolli õiguslikku alust, minimeerimist, lepingut ja turvameetmeid."
        : "Ootamatu isikuinfo ei tohi mudelile edasi liikuda. Lisa tuvastus ja peatamine ning hinda andmete vajalikkust ja lubatud töötlemist.";
    } else if (scenario === "model-outage") {
      const ready = ["manual", "queue", "cache"].includes(values.fallbackInput);
      state = ready ? "good" : "warn";
      title = ready ? "Töö saab kontrollitult jätkuda" : "Töövoog jääb seisma";
      text = ready ? "Valitud varuplaan säilitab töö, kuni mudeliteenus taastub." : "Pelgalt veateavitus või korduskatse ei pruugi piisata. Määra käsitsi töö, järjekord või kontrollitud vahetulemus.";
    } else if (scenario === "low-confidence") {
      const reviewed = ["approve", "facts", "exceptions", "owner"].includes(values.controlInput);
      state = reviewed ? "good" : "warn";
      title = reviewed ? "Ebakindel tulemus jõuab inimeseni" : "Madal kindlus vajab eskaleerimist";
      text = reviewed ? "Valitud kontroll sobib ebakindlate juhtumite peatamiseks või ülevaatamiseks." : "Lisa reegel, mis suunab madala kindlusega vastused inimesele, mitte automaatsele kasutamisele.";
    }

    result.className = `stress-result ${state}`;
    result.querySelector("span").textContent = state === "good" ? "✓" : state === "warn" ? "!" : "○";
    result.querySelector("b").textContent = title;
    result.querySelector("p").textContent = text;
  }

  function updatePlannerPreview() {
    const values = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    const completedFields = Object.values(values).filter(Boolean).length;
    $("#plannerState").textContent = `${completedFields} / ${plannerFields.length} valikut`;
    $("#previewTrigger").textContent = [plannerLabel("useCaseInput", "Kasutusjuht valimata"), plannerLabel("triggerInput", "käivitus valimata"), plannerLabel("environmentInput", "keskkond valimata")].join(" · ");
    $("#previewSource").textContent = [plannerLabel("sourceInput", "Allikas valimata"), plannerLabel("sensitivityInput", "tundlikkus valimata")].join(" · ");
    $("#previewAi").textContent = [plannerLabel("modelInput", "Mudel valimata"), plannerLabel("aiRoleInput", "ülesanne määramata")].join(" · ");
    $("#previewOutput").textContent = [plannerLabel("formatInput", "Vorming valimata"), plannerLabel("visualInput", "vaade valimata")].join(" · ");
    $("#previewControl").textContent = [plannerLabel("controlInput", "Kontroll valimata"), plannerLabel("fallbackInput", "varuplaan valimata")].join(" · ");

    updateQuality(values);
    renderStressTest(values);
    syncHeight();
  }

  function resetPlanner() {
    $("#workflowPlanner").reset();
    $("#stressInput").value = "";
    updatePlannerAvailability();
    updatePlannerPreview();
  }

  function reset() {
    currentStep = 1;
    completed = 0;
    running = false;
    selectedData = null;
    if (els.flowDialog.open) els.flowDialog.close();
    setResultPanelVisible(false);
    els.selectionAction.dataset.run = "2";
    els.selectionAction.classList.remove("orange");
    $$("[data-run]").forEach((button) => {
      button.disabled = false;
      button.querySelector("span").textContent = runLabels[Number(button.dataset.run) - 1];
    });
    els.consoleOutput.textContent = JSON.stringify({ status: "Päringut pole veel saadetud" }, null, 2);
    els.terminalTitle.textContent = "vastus.json";
    els.consoleBadge.textContent = "—";
    els.consoleBadge.className = "neutral";
    setResponseContext("API VASTUS", "Vastus kuvatakse JSON-vormingus.");
    els.statusChip.className = "status-chip neutral";
    els.statusText.textContent = "Päringut pole veel saadetud";
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.dataSummary.hidden = true;
    els.modelResult.hidden = true;
    els.selectionFields.disabled = false;
    $(".r-example").open = false;
    els.flowPackage.classList.remove("active");
    els.flowApi.classList.remove("active");
    els.flowMap.classList.remove("sending", "returning");
    els.modelGuide.hidden = true;
    setPracticeLocked(true);
    els.indicatorSelect.selectedIndex = 0;
    els.activitySelect.selectedIndex = 0;
    $$('input[type="checkbox"]', els.periodOptions).forEach((input) => {
      input.checked = defaultPeriods.has(input.value);
    });
    updateRequestPreview();
    resetSequenceExercise();
    resetPlanner();
    showResponsePanel("consolePanel");
    updateProgress();
    showStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-run]").forEach((button) => button.addEventListener("click", () => runStep(Number(button.dataset.run))));
  els.selectionFields.addEventListener("change", updateRequestPreview);
  ["pointerover", "focusin"].forEach((type) => els.postResponseOutput.addEventListener(type, (event) => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, true);
  }));
  ["pointerout", "focusout"].forEach((type) => els.postResponseOutput.addEventListener(type, (event) => {
    const value = event.target.closest(".response-value");
    if (value) toggleResultLinks(value.dataset.resultIndex, false);
  }));
  $$(".step").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.step), true)));
  els.prevLesson.addEventListener("click", () => showStep(currentStep - 1, true));
  els.nextLesson.addEventListener("click", () => showStep(currentStep + 1, true));
  $("#resetButton").addEventListener("click", reset);
  $("#sequenceStack").addEventListener("dragstart", (event) => {
    const block = event.target.closest(".sequence-block");
    if (!block || event.target.closest("select, button")) {
      event.preventDefault();
      return;
    }
    draggedSequenceBlock = block;
    block.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", block.dataset.flowKey);
  });
  $("#sequenceStack").addEventListener("dragover", (event) => {
    if (!draggedSequenceBlock) return;
    event.preventDefault();
    const target = event.target.closest(".sequence-block");
    $$(".sequence-block.drop-target").forEach((block) => block.classList.remove("drop-target"));
    if (target && target !== draggedSequenceBlock) target.classList.add("drop-target");
  });
  $("#sequenceStack").addEventListener("drop", (event) => {
    if (!draggedSequenceBlock) return;
    event.preventDefault();
    const target = event.target.closest(".sequence-block");
    if (target && target !== draggedSequenceBlock) {
      const afterTarget = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
      target.parentElement.insertBefore(draggedSequenceBlock, afterTarget ? target.nextElementSibling : target);
    }
    updateSequenceExercise();
  });
  $("#sequenceStack").addEventListener("dragend", () => {
    sequenceBlocks().forEach((block) => block.classList.remove("dragging", "drop-target"));
    draggedSequenceBlock = null;
    updateSequenceExercise();
  });
  $("#sequenceStack").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sequence-move]");
    if (!button) return;
    const block = button.closest(".sequence-block");
    moveSequenceBlock(block, button.dataset.sequenceMove);
    button.focus({ preventScroll: true });
  });
  $("#sequenceStack").addEventListener("change", (event) => {
    if (event.target.matches("select")) updateSequenceExercise();
  });
  $("#resetSequence").addEventListener("click", resetSequenceExercise);
  plannerFields.forEach((id) => $(`#${id}`).addEventListener("change", () => {
    updatePlannerAvailability();
    updatePlannerPreview();
  }));
  $("#stressInput").addEventListener("change", () => {
    const values = Object.fromEntries(plannerFields.map((id) => [id, plannerValue(id)]));
    renderStressTest(values);
    syncHeight();
  });
  $("#clearWorkflow").addEventListener("click", resetPlanner);
  els.modelGuide.addEventListener("click", () => {
    const target = $("#model-request-title");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.flowDialogClose.addEventListener("click", () => els.flowDialog.close());
  els.flowDialog.addEventListener("close", () => {
    if (completed === 0 || running || els.flowDialog.open) return;
    els.stageCard.scrollTop = 0;
    els.stageTitle.focus({ preventScroll: true });
    els.stageCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.flowDialog.addEventListener("cancel", (event) => {
    if (els.flowDialogClose.disabled) event.preventDefault();
  });
  window.addEventListener("message", (event) => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("embed") === "1" || params.get("embedMode") === "1") document.body.classList.add("embed-mode");
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  populateSelectionOptions();
  updateRequestPreview();
  updateProgress();
  showStep(1);
  updateSequenceExercise();
  updatePlannerAvailability();
  updatePlannerPreview();
  window.setTimeout(syncHeight, 100);
})();
