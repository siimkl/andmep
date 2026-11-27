(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

  const els = {
    progressValue: $("#progressValue"), progressText: $("#progressText"), progressBar: $("#progressBar"), completedCount: $("#completedCount"),
    currentStepLabel: $("#currentStepLabel"),
    resetButton: $("#resetButton"),
    labGrid: $(".lab-grid"), stageCard: $(".stage-card"), controlCard: $(".control-card"), flowStatus: $("#flowStatus"),
    flowDialog: $("#flowDialog"), dialogFlowStage: $("#dialogFlowStage"), dialogFlowStatus: $("#dialogFlowStatus"),
    flowDialogResult: $("#flowDialogResult"), flowDialogClose: $("#flowDialogClose"),
    responseContext: $("#responseContext"), responseContextLabel: $("#responseContextLabel"), responseContextText: $("#responseContextText"),
    responseOutput: $("#responseOutput"), terminalTitle: $("#terminalTitle"), statusBadge: $("#statusBadge"),
    getMetadata: $("#getMetadata"), selectionSection: $("#selectionSection"),
    selectionFields: $("#selectionFields"), indicatorSelect: $("#indicatorSelect"), activitySelect: $("#activitySelect"), periodOptions: $("#periodOptions"),
    selectionMath: $("#selectionMath"), valueCount: $("#valueCount"), sendSection: $("#sendSection"),
    sendFields: $("#sendFields"), requestPreview: $("#requestPreview"), sendRequest: $("#sendRequest"),
    requestFeedback: $("#requestFeedback"), rResult: $("#rResult"), rDataSource: $("#rDataSource"),
    rTableCaption: $("#rTableCaption"), rTableRows: $("#rTableRows"), rComparison: $("#rComparison"),
    rExampleCode: $("#rExampleCode"), validationSection: $("#validationSection"),
    validationFields: $("#validationFields"), checkScore: $("#checkScore"), takeaway: $("#takeaway"),
    practiceSuite: $(".practice-suite"), practiceCompleted: $("#practiceCompleted"), testMap: $("#testMap"),
    practiceCelebration: $("#practiceCelebration"), restartTests: $("#restartTests"),
    workflowKicker: $("#workflowKicker"), workflowRound: $("#workflowRound"),
    workflowBar: $("#workflowBar"), workflowQuestionNumber: $("#workflowQuestionNumber"), workflowPrompt: $("#workflowPrompt"),
    workflowOptions: $("#workflowOptions"), workflowFeedback: $("#workflowFeedback"), workflowNext: $("#workflowNext")
  };

  const initialState = () => ({
    metadata: false, successfulPost: false, responseViewed: false, checks: 0, currentStep: 1,
    xp: 0, awards: new Set(), completedTests: new Set(), unlockedTests: new Set(["workflow"]), activeTest: "workflow",
    workflow: { next: 0, complete: false },
    quizzes: {
      rcode: { index: 0, score: 0, locked: false, complete: false },
      url: { index: 0, score: 0, locked: false, complete: false },
      method: { index: 0, score: 0, locked: false, complete: false },
      detective: { index: 0, score: 0, locked: false, complete: false }
    }
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

  const workflowSteps = [
    "Laadi pxweb-pakett.",
    "Salvesta tabeli PA111 API aadress.",
    "Küsi GET-päringuga metaandmed.",
    "Koosta list()-iga soovitud andmete valik.",
    "Saada valik ja küsi POST-päringuga statistilised andmed.",
    "Muuda API vastus R-i andmetabeliks."
  ];

  const quizDefinitions = {
    rcode: {
      completion: "Päringu valikud koondatakse vektorisse. Vastuse tabeli ehitust näitab str() ja ridade arvu nrow().",
      rounds: [
        {
          prompt: "Milline R-i funktsioon koondab kolm perioodikoodi üheks valikuks?",
          options: ["list()", "c()", "View()", "nrow()"], correct: 1,
          why: "c() ühendab väärtused vektoriks: c(\"2024Q2\", \"2025Q2\", \"2026Q2\")."
        },
        {
          prompt: "Milline käsk ütleb, kas andmetabelis palgad on oodatud kolm rida?",
          options: ["names(palgad)", "str(palgad)", "nrow(palgad)", "View(url)"], correct: 2,
          why: "nrow(palgad) tagastab andmetabeli ridade arvu."
        },
        {
          prompt: "Milline käsk näitab korraga veerge, väärtuste näiteid ja andmetüüpe?",
          options: ["str(palgad)", "round(palgad)", "paste0(palgad)", "order(url)"], correct: 0,
          why: "str() annab kompaktse ülevaate objekti ülesehitusest ja veergude tüüpidest."
        },
        {
          prompt: "Päringus on 2 näitajat × 1 tegevusala × 3 perioodi. Mitu statistilist väärtust peab vastus sisaldama?",
          options: ["3", "5", "6", "9"], correct: 2,
          why: "Mõõtmete kombinatsioonid korrutatakse: 2 × 1 × 3 = 6 väärtust."
        }
      ]
    },
    url: {
      completion: "Päringu aadressis määravad koordinaadid asukoha ja forecast_days prognoosi pikkuse.",
      rounds: [
        {
          prompt: "Mis märk alustab URL-is päringuparameetrite osa?",
          options: ["?", "&", "#", "/"], correct: 0,
          why: "Küsimärk eraldab API otspunkti päringuparameetritest."
        },
        {
          prompt: "Mis märk eraldab URL-is latitude-, longitude- ja daily-parameetrid?",
          options: ["+", ":", "&", "="], correct: 2,
          why: "Märk & eraldab järjestikused parameetrid. Võrdusmärk seob parameetri selle väärtusega."
        },
        {
          prompt: "Milline koordinaadipaar viib Open‑Meteo päringu Tallinnasse?",
          options: ["58.38, 26.73", "59.44, 24.75", "57.78, 26.03", "60.17, 24.94"], correct: 1,
          why: "Latitude tähistab laiuskraadi ja longitude pikkuskraadi. Tallinna näites on need vastavalt 59.44 ja 24.75."
        },
        {
          prompt: "Milline URL-i osa küsib seitsme päeva prognoosi?",
          options: ["days=7", "forecast=week", "forecast_days=7", "daily=7"], correct: 2,
          why: "Open‑Meteo näites määrab päevade arvu parameeter forecast_days=7."
        }
      ]
    },
    method: {
      completion: "Meetodi valik sõltub andmemahust, ülesande korduvusest ja andmete kättesaadavusest.",
      rounds: [
        {
          prompt: "Vaja on kolme väärtust ühest veebitabelist ainult ühe korra.",
          options: ["Veebiliides / käsitsi", "Fail", "API", "Kraapimine"], correct: 0,
          why: "Kolme arvu leiab ühekordseks tööks hõlpsasti veebitabelist. Praktikumis illustreerivad samad arvud API-päringu ja R-i töötluse seost."
        },
        {
          prompt: "Suur andmestik on juba valmis CSV-failina saadaval.",
          options: ["Käsitsi", "Faili allalaadimine", "API", "Kraapimine"], correct: 1,
          why: "Kui sobiv fail on olemas, väldib allalaadimine tarbetut API-tööd."
        },
        {
          prompt: "Statistikat tuleb igal kuul sama skriptiga uuendada.",
          options: ["Käsitsi", "Ekraanipilt", "API", "PDF"], correct: 2,
          why: "API tugevus on sama päringu korratav ja automatiseeritav käivitamine."
        },
        {
          prompt: "API puudub, kuid vajalik avalik info on veebilehel nähtav.",
          options: ["Käsitsi alati", "Faili väljamõtlemine", "API", "Võimalusel kraapimine"], correct: 3,
          why: "Kraapimist võib kaaluda pärast kasutustingimuste ja eetiliste piiride kontrolli."
        },
        {
          prompt: "Kaks süsteemi peavad andmeid regulaarselt vahetama.",
          options: ["Käsitsi", "CSV e-postiga", "API", "Ekraanipildid"], correct: 2,
          why: "API abil saab sama andmevahetust regulaarselt korrata."
        }
      ]
    },
    detective: {
      completion: "Olekukood kirjeldab päringu tehnilist tulemust. Vastuses olevate arvude tähendus selgub andmete struktuurist ja kirjeldusest.",
      rounds: [
        {
          prompt: "API vastab „200 OK”. Mida saad kindlalt järeldada?",
          options: ["Andmed on sisuliselt õiged", "Päring õnnestus tehniliselt", "Ühik on euro", "Kõik perioodid saabusid"], correct: 1,
          why: "200 OK kinnitab tehnilist õnnestumist. Sisu, ühik ja perioodid vajavad eraldi kontrolli."
        },
        {
          prompt: "API vastab „404 Not Found”. Mida kontrollid esimesena?",
          options: ["Tabeli aadressi ja koodi", "Arvude keskmist", "Joonise värvi", "CSV eraldajat"], correct: 0,
          why: "404 tähendab, et küsitud ressurssi ei leitud. Esmalt tasub kontrollida otspunkti aadressi ja tabeli koodi."
        },
        {
          prompt: "API vastab „429 Too Many Requests”. Mis on mõistlik tegevus?",
          options: ["Saada kohe rohkem päringuid", "Oota ja vähenda päringusagedust", "Muuda kõik väärtused nulliks", "Kasuta 404 aadressi"], correct: 1,
          why: "429 tähendab päringulimiidi ületamist. Oota, järgi juhiseid ja aeglusta päringuid."
        },
        {
          prompt: "Miks kasutatakse Maailmapanga vastuses vastus_wb[[2]]?",
          options: ["Et valida vaatluste osa", "Et korrutada rahvaarv kahega", "Et valida teine riik", "Et muuta POST GET-iks"], correct: 0,
          why: "Maailmapanga JSON-vastuse esimene osa sisaldab metaandmeid ja teine vaatlusi."
        },
        {
          prompt: "Kas sama Open‑Meteo päring annab homme tingimata täpselt sama prognoosi?",
          options: ["Jah, API vastus ei muutu", "Ei, prognoos uueneb", "Jah, kui URL on sama", "Ainult RStudio otsustab"], correct: 1,
          why: "Ilmaprognoos uueneb. Sama päringu tulemus võib järgmisel päeval muutuda."
        },
        {
          prompt: "Mida kontrollid enne PA111 palgaväärtuste kasutamist?",
          options: ["Ainult olekukoodi", "Näitajat, ühikut, perioodi ja ajakohasust", "Ainult failinime", "Ainult ridade värvi"], correct: 1,
          why: "Sisuline kontroll seob väärtuse õige näitaja, ühiku, perioodi, allika ja uuendusajaga."
        }
      ]
    }
  };

  const quizHints = {
    rcode: [
      "Otsi funktsiooni, mis ühendab mitu väärtust üheks vektoriks.",
      "Küsimus on ridade arvus, mitte veergude nimedes ega tüüpides.",
      "Selle käsu nimi on lühend ingliskeelsest sõnast structure.",
      "Korruta iga mõõtme valikute arv: näitajad × tegevusalad × perioodid."
    ],
    url: [
      "See märk paikneb otspunkti ja esimese parameetri vahel.",
      "Võrdusmärk seob parameetri nime väärtusega. Parameetrite vahele käib teine märk.",
      "Esimene arv on põhjalaius. Teine arv on idapikkus.",
      "Parameetri nimi koosneb sõnadest forecast ja days."
    ],
    method: [
      "Mõtle, kas kolme arvu jaoks tasub enne automatiseerimist programmeerida.",
      "Kasuta esmalt juba olemasolevat sobivat andmeallikat.",
      "Korduvus ja automatiseerimine on ühe meetodi suurim tugevus.",
      "Kui ametlikku masinliidest pole, jääb üle veebilehe lubatud viisil lugemine.",
      "Regulaarne süsteemidevaheline andmevahetus vajab masinliidest."
    ],
    detective: [
      "Olekukood kirjeldab päringu tehnilist tulemust, mitte arvude tähendust.",
      "404 tähendab, et soovitud ressurssi ei leitud.",
      "429 viitab päringusageduse piirangule.",
      "Maailmapanga vastuse esimene osa on metaandmed, teine osa sisaldab vaatlusi.",
      "Ilmaprognoos on ajas uuenev hinnang.",
      "Hea kontroll seob arvu näitaja, ühiku, perioodi ja uuendusajaga."
    ]
  };

  const testOrder = ["workflow", "rcode", "url", "method", "detective"];

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
    const labels = {
      1: "1. Tabeli kirjeldus",
      2: "2. Andmevalik",
      3: "3. Andmepäring",
      4: completed ? "Põhiülesanne lõpetatud" : "4. Vastuse kontroll ja töötlus"
    };
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
          const period = periods[index];
          const hint = `${formatValue(values[index])} ${unit} · ${indicator} · ${activity} · ${period}`;
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
    const fillDesktopHeight = kind === "metadata" && window.matchMedia("(min-width: 1041px)").matches;
    const controlHeight = fillDesktopHeight ? els.controlCard.getBoundingClientRect().height : null;
    els.responseContextLabel.textContent = label;
    els.responseContextText.textContent = text;
    els.responseContext.className = `response-context ${kind}`;
    els.stageCard.classList.remove("response-neutral", "response-metadata", "response-data", "response-error");
    els.stageCard.classList.add(`response-${kind}`);
    els.stageCard.style.height = fillDesktopHeight ? `${controlHeight}px` : "";
  }
  function highlightNext(target = null) {
    $$(".is-next").forEach(item => item.classList.remove("is-next"));
    const guideTarget = target?.closest(".next-action-guide.contextual") || target;
    if (guideTarget) guideTarget.classList.add("is-next");
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
      highlightNext(els.workflowKicker);
      return;
    }
    setProgress(4);
    const firstCheck = $("#validationFields .check-card:not(:has(input:checked))") || $("#validationFields .check-card");
    highlightNext(firstCheck);
  }

  function resetValidation() {
    state.responseViewed = false;
    state.checks = 0;
    els.validationSection.classList.add("locked");
    els.validationSection.setAttribute("aria-disabled", "true");
    els.validationFields.disabled = true;
    $$("#validationFields input").forEach(input => { input.checked = false; });
    els.checkScore.textContent = "0/4";
    els.takeaway.hidden = true;
    setPracticeLocked(true);
  }

  function openFlowDialog(method) {
    els.flowStatus.textContent = "Päring käib…";
    els.dialogFlowStatus.textContent = `${method}-päring on teel`;
    els.flowDialogResult.textContent = "";
    els.flowDialogResult.className = "";
    els.flowDialogClose.disabled = true;
    els.flowDialogClose.querySelector("span").textContent = "Päring on töötlemisel";
    dialogTarget = null;
    if (!els.flowDialog.open) els.flowDialog.showModal();
  }

  function completeFlowDialog(method, target) {
    els.flowStatus.textContent = "Vastus saabus";
    els.dialogFlowStatus.textContent = "200 OK";
    els.flowDialogResult.textContent = method === "GET"
      ? "GET-vastus sisaldab tabeli kirjeldust ja valikuid."
      : "POST-vastus sisaldab valitud andmeid.";
    els.flowDialogResult.className = "success";
    els.flowDialogClose.querySelector("span").textContent = method === "GET" ? "Vaata tabeli kirjeldust" : "Vaata vastust ja R-i näidet";
    els.flowDialogClose.disabled = false;
    dialogTarget = target;
    els.flowDialogClose.focus({ preventScroll: true });
  }

  async function animateFlow(method) {
    openFlowDialog(method);
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
    setFlowStatus("API koostab vastuse tabeli PA111 põhjal");
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
    setFlowStatus("Vastus saabus");
  }

  async function loadMetadata() {
    if (els.getMetadata.disabled) return;
    setResultPanelVisible(true);
    els.stageCard.classList.remove("awaiting-response");
    els.stageCard.removeAttribute("aria-disabled");
    els.getMetadata.disabled = true;
    els.getMetadata.querySelector("span").textContent = "GET-päring on töötlemisel";
    highlightNext();
    await animateFlow("GET");
    showResponse(metadataResponse);
    els.terminalTitle.textContent = "metaandmed.json";
    setStatus("200 OK", "success");
    setResponseContext("GET-PÄRINGU VASTUS", "Väli values sisaldab valikute koode ja valueTexts nende nimetusi. POST-päringusse lähevad koodid.", "metadata");
    state.metadata = true;
    els.selectionSection.classList.remove("locked");
    els.selectionFields.disabled = false;
    els.sendSection.classList.remove("locked");
    els.sendFields.disabled = false;
    els.getMetadata.querySelector("span").textContent = "Tabeli kirjeldus on avatud";
    award("metadata", 15);
    setProgress(2);
    updateRequestPreview();
    highlightNext(els.selectionSection);
    completeFlowDialog("GET", els.responseContext);
  }

  function formatPeriod(period) {
    const quarters = { Q1: "I kv", Q2: "II kv", Q3: "III kv", Q4: "IV kv" };
    return `${period.slice(0, 4)} ${quarters[period.slice(4)]}`;
  }

  function indicatorUnit() {
    if (els.indicatorSelect.value === "NR_EMPL") return "töötajat";
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
    if (indicator === "NR_EMPL") return 100000 + timeIndex * 700 + activityIndex * 1200;
    if (indicator === "GR_W_AVG_SM") return Number((5.2 + timeIndex * .08 - activityIndex * .05).toFixed(1));
    const wageBase = {
      GR_W_AVG: 2007, GR_W_D1: 1150, GR_W_D2: 1320, GR_W_D3: 1490, GR_W_D4: 1660,
      GR_W_D5: 1840, GR_W_D6: 2030, GR_W_D7: 2260, GR_W_D8: 2570, GR_W_D9: 3100
    }[indicator] || 2007;
    return Math.max(1, Math.round(wageBase + timeIndex * 35 + activityIndex * 12));
  }

  function renderRResult(periods, values, officialValues) {
    const unit = indicatorUnit();
    const changeUnit = unit === "%" ? "protsendipunkti" : unit;
    const formatChange = difference => {
      const rounded = Number(difference.toFixed(1));
      const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
      return `${sign}${formatValue(Math.abs(rounded))} ${changeUnit}`;
    };
    const indicatorName = els.indicatorSelect.selectedOptions[0].textContent.split(" · ")[0];
    const activityName = els.activitySelect.selectedOptions[0].textContent.split(" · ")[0];
    els.rTableCaption.textContent = `${indicatorName}. ${activityName}.`;
    els.rDataSource.textContent = officialValues
      ? "Need palgaväärtused pärinevad Statistikaameti tabelist PA111."
      : "Vastus sisaldab õppimiseks loodud näidisväärtusi.";
    const rows = periods.map((period, index) => {
      const row = document.createElement("tr");
      const periodCell = document.createElement("th");
      periodCell.scope = "row";
      periodCell.textContent = formatPeriod(period);
      row.appendChild(periodCell);
      row.insertCell().textContent = `${formatValue(values[index])} ${unit}`;
      row.insertCell().textContent = index === 0 ? "—" : formatChange(values[index] - values[index - 1]);
      return row;
    });
    els.rTableRows.replaceChildren(...rows);
    els.rComparison.textContent = values.length === 1
      ? "Muutuse arvutamiseks on vaja vähemalt kaht perioodi."
      : `Muutus esimesest valitud perioodist viimaseni on ${formatChange(values.at(-1) - values[0])}.`;
    els.rExampleCode.textContent = [
      "andmed <- data.frame(",
      `  periood = c(${periods.map(period => JSON.stringify(period)).join(", ")}),`,
      `  vaartus = c(${values.join(", ")})`,
      ")",
      "andmed$muutus <- c(NA_real_, round(diff(andmed$vaartus), 1))",
      "print(andmed)"
    ].join("\n");
    els.rResult.hidden = false;
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
    els.sendRequest.querySelector("span").textContent = "POST-päring on töötlemisel";
    els.requestFeedback.hidden = true;
    els.rResult.hidden = true;
    state.successfulPost = false;
    resetValidation();
    setProgress(3);
    highlightNext();
    await animateFlow("POST");

    const periods = selectedPeriods();
    const values = periods.map(simulatedValue);
    const officialValues = usesOfficialPa111Values(periods);
    const postResponse = {
      version: "2.0",
      class: "dataset",
      label: "PA111 näidisvastus",
      id: ["Näitaja", "Tegevusala", "Vaatlusperiood"],
      size: [1, 1, periods.length],
      dimension: {
        Näitaja: { category: { index: [els.indicatorSelect.value] } },
        Tegevusala: { category: { index: [els.activitySelect.value] } },
        Vaatlusperiood: { category: { index: periods } }
      },
      value: values,
    };
    showPostResponse(postResponse, periods, values);
    renderRResult(periods, values, officialValues);
    setStatus("200 OK", "success");
    els.terminalTitle.textContent = "andmed.json";
    state.successfulPost = true;
    award("post", 25);
    els.sendRequest.disabled = false;
    els.sendRequest.querySelector("span").textContent = "Saada andmepäring uuesti";
    setResponseContext("POST-PÄRINGU VASTUS", "Välja value arvud on perioodikoodidega samas järjekorras. Arvule liikudes tõstetakse esile sellega seotud koodid.", "data");
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
      highlightNext(els.workflowKicker);
      window.setTimeout(() => els.workflowOptions.scrollIntoView({ behavior: "smooth", block: "center" }), 220);
    } else if (state.successfulPost) {
      setPracticeLocked(true);
      setProgress(4);
      const nextCheck = $("#validationFields .check-card:not(:has(input:checked))");
      highlightNext(nextCheck);
    }
    syncHeight();
  }

  function setPracticeLocked(locked) {
    els.practiceSuite.classList.toggle("locked", locked);
    if (locked) els.practiceSuite.setAttribute("aria-disabled", "true");
    else els.practiceSuite.removeAttribute("aria-disabled");
    els.practiceSuite.inert = locked;
    syncTestMap();
  }

  function updateQuestionVisual(question, numberLabel, index, total) {
    const toneClasses = ["question-tone-0", "question-tone-1", "question-tone-2", "question-tone-3", "question-tone-4"];
    numberLabel.textContent = `${index + 1} / ${total}`;
    question.classList.remove(...toneClasses, "question-updated");
    question.classList.add(toneClasses[index % toneClasses.length]);
    void question.offsetWidth;
    question.classList.add("question-updated");
  }

  function syncTestMap() {
    const suiteLocked = els.practiceSuite.classList.contains("locked");
    $$('button[data-open-test]', els.testMap).forEach((button, index) => {
      const id = button.dataset.openTest;
      const unlocked = state.unlockedTests.has(id) || state.completedTests.has(id);
      const complete = state.completedTests.has(id);
      const active = state.activeTest === id;
      button.disabled = suiteLocked || !unlocked;
      button.classList.toggle("active", active);
      button.classList.toggle("done", complete);
      button.classList.toggle("locked-step", !unlocked);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      const status = button.querySelector("small");
      status.textContent = complete ? "läbitud" : active ? "praegu" : unlocked ? "avatud" : "lukus";
      button.querySelector("span").textContent = complete ? "✓" : String(index + 1);
    });
  }

  function openTest(id, shouldScroll = true) {
    if (!state.unlockedTests.has(id) && !state.completedTests.has(id)) return;
    state.activeTest = id;
    $$(".practice-card", els.practiceSuite).forEach(card => {
      card.hidden = card.dataset.test !== id;
    });
    syncTestMap();
    if (shouldScroll) {
      $(`button[data-open-test="${id}"]`, els.testMap)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      window.setTimeout(() => $(`[data-test="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    }
    syncHeight();
  }

  function setTestFeedback(target, tone, title, message) {
    target.className = `test-feedback${tone ? ` ${tone}` : ""}`;
    const icon = document.createElement("span");
    icon.className = "feedback-icon";
    icon.textContent = tone === "good" ? "✓" : tone === "bad" ? "↻" : "i";
    const copy = document.createElement("span");
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("span");
    detail.textContent = message;
    copy.append(heading);
    if (message) copy.append(detail);
    target.replaceChildren(icon, copy);
  }

  function revealHint(id) {
    const quiz = state.quizzes[id];
    const ui = testElements(id);
    ui.hintPanel.textContent = quizHints[id][quiz.index];
    ui.hintPanel.hidden = false;
    ui.hint.textContent = "Vihje on kuvatud";
    ui.hint.disabled = true;
  }

  function testElements(id) {
    return {
      card: $(`[data-test="${id}"]`),
      kicker: $(`#${id}Kicker`), round: $(`#${id}Round`), score: $(`#${id}Score`),
      bar: $(`#${id}Bar`), questionNumber: $(`#${id}QuestionNumber`), prompt: $(`#${id}Prompt`),
      options: $(`#${id}Options`), feedback: $(`#${id}Feedback`), next: $(`#${id}Next`),
      hint: $(`#${id}Hint`), hintPanel: $(`#${id}HintPanel`)
    };
  }

  function markTestComplete(id) {
    if (state.completedTests.has(id)) return;
    state.completedTests.add(id);
    els.practiceCompleted.textContent = `${state.completedTests.size} / 5`;
    $(`[data-test="${id}"]`).classList.add("test-complete");
    award(`test-complete-${id}`, 15);
    const nextId = testOrder[testOrder.indexOf(id) + 1];
    if (nextId) state.unlockedTests.add(nextId);
    syncTestMap();
    if (state.completedTests.size === 5) {
      els.practiceCelebration.hidden = false;
      highlightNext();
    }
  }

  function resetWorkflowTest() {
    state.workflow.next = 0;
    state.workflow.complete = false;
    els.workflowRound.textContent = `0 / ${workflowSteps.length}`;
    els.workflowBar.style.width = "0%";
    els.workflowQuestionNumber.textContent = `1 / ${workflowSteps.length}`;
    els.workflowPrompt.textContent = "Millises järjekorras saab pxweb-iga koostada API-päringu ja teisendada vastuse tabeliks?";
    els.workflowFeedback.replaceChildren();
    els.workflowNext.hidden = true;
    $$("button[data-step]", els.workflowOptions).forEach(button => {
      button.disabled = false;
      button.classList.remove("placed", "wrong");
      button.querySelector("span").textContent = "?";
    });
  }

  function chooseWorkflowStep(event) {
    const button = event.target.closest("button[data-step]");
    if (!button || state.workflow.complete || button.classList.contains("placed")) return;
    const chosen = Number(button.dataset.step);
    if (chosen !== state.workflow.next) {
      button.classList.remove("wrong");
      void button.offsetWidth;
      button.classList.add("wrong");
      window.setTimeout(() => button.classList.remove("wrong"), 520);
      setTestFeedback(els.workflowFeedback, "bad", "See samm tuleb hiljem", workflowSteps[state.workflow.next]);
      return;
    }

    button.classList.add("placed");
    button.disabled = true;
    button.querySelector("span").textContent = String(chosen + 1);
    state.workflow.next += 1;
    const done = state.workflow.next === workflowSteps.length;
    els.workflowRound.textContent = `${state.workflow.next} / ${workflowSteps.length}`;
    els.workflowBar.style.width = `${(state.workflow.next / workflowSteps.length) * 100}%`;
    els.workflowQuestionNumber.textContent = `${Math.min(state.workflow.next + 1, workflowSteps.length)} / ${workflowSteps.length}`;

    if (done) {
      state.workflow.complete = true;
      els.workflowPrompt.textContent = "Kõik kuus tööetappi on järjestatud.";
      setTestFeedback(els.workflowFeedback, "good", "Töövoog on valmis", "GET-vastus annab valikute koodid. POST-vastusest saab koostada R-i andmetabeli.");
      els.workflowNext.hidden = false;
      markTestComplete("workflow");
    } else {
      setTestFeedback(els.workflowFeedback, "good", `Samm ${state.workflow.next} on paigas`);
    }
    syncHeight();
  }

  function renderQuiz(id) {
    const definition = quizDefinitions[id];
    const quiz = state.quizzes[id];
    const ui = testElements(id);
    const round = definition.rounds[quiz.index];
    ui.prompt.textContent = round.prompt;
    updateQuestionVisual(ui.prompt.closest(".test-question"), ui.questionNumber, quiz.index, definition.rounds.length);
    ui.round.textContent = `${quiz.index + 1} / ${definition.rounds.length}`;
    ui.score.textContent = `${quiz.score} ${quiz.score === 1 ? "õige" : "õiget"}`;
    ui.bar.style.width = `${(quiz.index / definition.rounds.length) * 100}%`;
    ui.feedback.replaceChildren();
    ui.next.hidden = true;
    delete ui.next.dataset.advanceTo;
    ui.next.textContent = quiz.index === definition.rounds.length - 1 ? "Lõpeta harjutus" : "Järgmine küsimus";
    quiz.locked = false;
    ui.hint.hidden = false;
    ui.hint.disabled = false;
    ui.hint.textContent = "Kuva vihje";
    ui.hintPanel.hidden = true;
    ui.hintPanel.textContent = "";
    const letters = ["A", "B", "C", "D"];
    const buttons = round.options.map((option, index) => {
      const answer = document.createElement("button");
      answer.type = "button";
      answer.dataset.answer = String(index);
      const key = document.createElement("b");
      key.className = "answer-key";
      key.textContent = letters[index];
      const value = document.createElement("span");
      value.textContent = option;
      answer.append(key, value);
      return answer;
    });
    ui.options.replaceChildren(...buttons);
  }

  function chooseQuizAnswer(event) {
    const button = event.target.closest("button[data-answer]");
    const id = event.currentTarget.closest("[data-test]")?.dataset.test;
    if (!button || !id || !quizDefinitions[id]) return;
    const quiz = state.quizzes[id];
    if (quiz.locked || quiz.complete) return;
    const definition = quizDefinitions[id];
    const round = definition.rounds[quiz.index];
    const selected = Number(button.dataset.answer);
    const correct = selected === round.correct;
    const ui = testElements(id);

    if (!correct) {
      button.disabled = true;
      button.classList.add("wrong");
      revealHint(id);
      setTestFeedback(ui.feedback, "bad", "See vastus ei sobi");
      syncHeight();
      return;
    }

    quiz.locked = true;
    quiz.score += 1;
    award(`${id}-${quiz.index}`, 5);
    $$("button[data-answer]", ui.options).forEach((item, index) => {
      item.disabled = true;
      if (index === round.correct) item.classList.add("correct");
    });
    ui.score.textContent = `${quiz.score} ${quiz.score === 1 ? "õige" : "õiget"}`;
    ui.bar.style.width = `${((quiz.index + 1) / definition.rounds.length) * 100}%`;
    setTestFeedback(ui.feedback, "good", "Õige vastus", round.why);
    ui.hint.hidden = true;
    ui.hintPanel.hidden = true;
    ui.next.hidden = false;
    ui.next.focus({ preventScroll: true });
    syncHeight();
  }

  function nextQuizRound(event) {
    const advanceTo = event.currentTarget.dataset.advanceTo;
    if (advanceTo) {
      delete event.currentTarget.dataset.advanceTo;
      openTest(advanceTo);
      return;
    }
    const id = event.currentTarget.closest("[data-test]")?.dataset.test;
    if (!id || !quizDefinitions[id]) return;
    const quiz = state.quizzes[id];
    const definition = quizDefinitions[id];
    if (!quiz.locked || quiz.complete) return;
    if (quiz.index < definition.rounds.length - 1) {
      quiz.index += 1;
      renderQuiz(id);
      return;
    }

    quiz.complete = true;
    const ui = testElements(id);
    ui.prompt.textContent = `Õigeid vastuseid ${quiz.score}/${definition.rounds.length}.`;
    setTestFeedback(ui.feedback, "good", "Harjutus tehtud", definition.completion);
    ui.hint.hidden = true;
    ui.hintPanel.hidden = true;
    markTestComplete(id);
    const nextId = testOrder[testOrder.indexOf(id) + 1];
    if (nextId) {
      ui.next.hidden = false;
      ui.next.dataset.advanceTo = nextId;
      ui.next.textContent = "Järgmine harjutus";
    } else {
      ui.next.hidden = true;
      window.setTimeout(() => els.practiceCelebration.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    }
    syncHeight();
  }

  function resetTests() {
    state.completedTests = new Set();
    state.unlockedTests = new Set(["workflow"]);
    state.activeTest = "workflow";
    state.workflow = { next: 0, complete: false };
    Object.keys(quizDefinitions).forEach(id => {
      state.quizzes[id] = { index: 0, score: 0, locked: false, complete: false };
    });
    els.practiceCompleted.textContent = "0 / 5";
    els.practiceCelebration.hidden = true;
    $$(".practice-card", els.practiceSuite).forEach(card => card.classList.remove("test-complete"));
    resetWorkflowTest();
    Object.keys(quizDefinitions).forEach(renderQuiz);
    openTest("workflow", false);
    syncTestMap();
  }

  function resetLab() {
    state = initialState();
    dialogTarget = null;
    if (els.flowDialog.open) els.flowDialog.close();
    setResultPanelVisible(false);
    els.stageCard.classList.add("awaiting-response");
    els.stageCard.setAttribute("aria-disabled", "true");
    els.selectionSection.classList.add("locked");
    els.selectionFields.disabled = true;
    els.sendSection.classList.add("locked");
    els.sendFields.disabled = true;
    resetValidation();
    $$("#selectionFields input[type='checkbox']").forEach(input => { input.checked = defaultPeriods.has(input.value); });
    els.indicatorSelect.selectedIndex = 0;
    els.activitySelect.selectedIndex = 0;
    els.getMetadata.disabled = false;
    els.getMetadata.querySelector("span").textContent = "Ava tabeli kirjeldus (GET)";
    els.sendRequest.querySelector("span").textContent = "Saada andmepäring (POST)";
    els.requestFeedback.hidden = true;
    els.rResult.hidden = true;
    els.terminalTitle.textContent = "vastus.json";
    setStatus("—", "neutral");
    setResponseContext("API VASTUS", "Vastus kuvatakse JSON-vormingus.");
    showResponse({ status: "Päringut pole veel saadetud" });
    els.flowStatus.textContent = "Päringut pole veel saadetud";
    updateRequestPreview();
    resetTests();
    setProgress(1);
    highlightNext(els.getMetadata);
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
  els.flowDialogClose.addEventListener("click", () => els.flowDialog.close());
  els.flowDialog.addEventListener("cancel", event => {
    if (els.flowDialogClose.disabled) event.preventDefault();
  });
  els.flowDialog.addEventListener("close", () => {
    if (!dialogTarget) return;
    const target = dialogTarget;
    dialogTarget = null;
    if (state.successfulPost) advanceToValidation();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.resetButton.addEventListener("click", resetLab);
  els.selectionFields.addEventListener("change", () => {
    updateRequestPreview();
    if (state.metadata && !state.successfulPost) highlightNext(els.sendRequest);
  });
  els.validationFields.addEventListener("change", updateChecks);
  els.workflowOptions.addEventListener("click", chooseWorkflowStep);
  els.workflowNext.addEventListener("click", () => openTest("rcode"));
  els.testMap.addEventListener("click", event => {
    const button = event.target.closest("button[data-open-test]");
    if (button) openTest(button.dataset.openTest);
  });
  $$(".quiz-options", els.practiceSuite).forEach(options => options.addEventListener("click", chooseQuizAnswer));
  $$(".next-question", els.practiceSuite).forEach(button => button.addEventListener("click", nextQuizRound));
  $$(".hint-button", els.practiceSuite).forEach(button => button.addEventListener("click", event => {
    const id = event.currentTarget.closest("[data-test]")?.dataset.test;
    if (id && state.quizzes[id] && !state.quizzes[id].locked) revealHint(id);
  }));
  els.restartTests.addEventListener("click", () => {
    resetTests();
    setPracticeLocked(false);
    els.testMap.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  window.addEventListener("message", event => {
    if (event.data?.type === "simfluence:measure" || event.data?.type === "measure") syncHeight();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("embed") === "1" || params.get("embedMode") === "1") document.body.classList.add("embed-mode");
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(document.body);
  populateSelectionOptions();
  updateRequestPreview();
  resetTests();
  setPracticeLocked(true);
  setProgress(1);
  highlightNext(els.getMetadata);
  window.setTimeout(syncHeight, 100);
})();
