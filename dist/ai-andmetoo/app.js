const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const metricMeta = {
  data: { label: "Andmekvaliteet", short: "andmete katvus" },
  output: { label: "Väljundite usaldusväärsus", short: "väljundite kontroll" },
  bias: { label: "Kallutatuse ohjamine", short: "kallutatuse ohjamine" },
  labor: { label: "Inimtöö nähtavus", short: "inimtöö nähtavus" },
  control: { label: "Organisatsiooniline kontroll", short: "organisatsiooniline kontroll" }
};

const labelNames = { fast: "Kiire tugi", standard: "Tavaplaan", self: "Iseseisev jätkamine", supplement: "Andmete täiendamine", review: "Inimese ülevaatus" };
const reviewNames = { accept: "Kasutatav", correct: "Vajab parandamist", human: "Hinnanguks pole piisavalt infot" };

const labelCases = [
  { id: "T-101", title: "Tööotsija T-101", pattern: "hiljutine töökaotus", fields: { profile: "Registris on aktiivne tööotsija. Töösuhe lõppes kaks nädalat tagasi.", notes: "Töötuna registreerimine vajab lõpuleviimist.", barriers: "Registreerimine ja toetuste taotlemine on pooleli.", activity: "Pärast töösuhte lõppu pole iseteeninduses tegevust.", freshness: "Kirjet kontrolliti pärast töösuhte lõppu." }, expected: "fast", currentReason: "Hiljutine töökaotus ning pooleli olev registreerimine takistavad tööotsingu alustamist ja vajavad ametniku sihitud abi." },
  { id: "T-102", title: "Tööotsija T-102", pattern: "selge tavapärane vajadus", fields: { profile: "Registris olevad oskused vastavad soovitud töökohtade nõuetele.", notes: "Märgitud on tavapärase töövahenduse toe vajadus.", barriers: "Dokumenteeritud takistused puuduvad.", activity: "Tööotsija kandideerib regulaarselt sobivatele töökohtadele.", freshness: "Töösoov ja toevajadus kinnitati eelmisel nädalal." }, expected: "standard", currentReason: "Registriinfo on täielik ja kooskõlaline ning ükski nähtav takistus ei vaja kiiret sekkumist." },
  { id: "T-103", title: "Tööotsija T-103", pattern: "puuduv registriinfo", fields: { profile: "Töösoov on märgitud, kuid oskuste väli on tühi.", notes: "Toe vajadust pole registris kirjeldatud.", barriers: "— väärtus puudub", activity: "Üks sisselogimine viimase kuu jooksul.", freshness: "Töösoovi uuendati sel kuul. Takistuste info kontrollimise aeg puudub." }, expected: "supplement", currentReason: "Takistuste väli ja toe vajaduse kirjeldus puuduvad, mistõttu ei ole kindla soovituse andmiseks piisavalt infot." },
  { id: "T-104", title: "Tööotsija T-104", pattern: "ajakohane positiivne muutus", fields: { profile: "Nõutud kutsetunnistus lisati registrisse sel kuul.", notes: "Oskused vastavad nüüd soovitud töökohtade nõuetele.", barriers: "Dokumenteeritud takistused puuduvad.", activity: "Tööotsija kandideerib sobivatele töökohtadele.", freshness: "Profiili kontrolliti pärast kutsetunnistuse lisamist." }, expected: "self", currentReason: "Koolitus on lõpetatud, registriandmed on ajakohased ja nähtavaid takistusi pole. Tööotsija saab tööotsingut iseseisvalt jätkata." },
  { id: "T-105", title: "Tööotsija T-105", pattern: "vastuolulised eksperdihinnangud", fields: { profile: "Registri põhiandmed on ajakohased.", notes: "Kaks nõustajat on sisestanud erineva soovituse: kiire tugi ja tavaplaan.", barriers: "Takistuse mõju pole registris üheselt kirjeldatud.", activity: "Iseteeninduse kasutus vastab tavapärasele mustrile.", freshness: "Mõlemad nõustajad vaatasid kirje üle sel nädalal." }, expected: "review", currentReason: "Nõustajate hinnangud on vastuolus ja takistuse mõju pole selge, seega peab soovituse üle vaatama ametnik." }
];

const outputCases = [
  {
    id: "T-201", title: "Tööotsija T-201", trainingIndex: 0, confidence: 62, baseline: "standard",
    text: "Pärast hiljutist töökaotust leidis tööotsija sobivad tööpakkumised ja kandideerib neile ise. Registreerimise takistus on lahendatud ja nõustaja kinnitas, et lisatuge pole vaja.",
    referenceLabel: "self",
    reason: "Tööotsija saab tööotsingut iseseisvalt jätkata. Varasem takistus on lahendatud."
  },
  {
    id: "T-202", title: "Tööotsija T-202", trainingIndex: 2, confidence: 81, baseline: "standard",
    text: "Takistuste väli on tühi ja registrikirjeldus ei ütle, millist abi tööotsija vajab. Juhise järgi tuleb sellise kirje andmeid enne toe soovitamist täiendada.",
    referenceLabel: "supplement",
    reason: "Registriinfo on puudulik. Juhis ütleb, et enne toe valimist tuleb andmeid täiendada."
  },
  {
    id: "T-203", title: "Tööotsija T-203", trainingIndex: 1, confidence: 89, baseline: "standard",
    text: "Ajakohase ja täieliku registriinfo järgi vajab tööotsija tavapärast töövahenduse tuge. Kiiret sekkumist vajavaid takistusi pole kirjeldatud.",
    referenceLabel: "standard",
    reason: "Registris on kirjas tavapärane toevajadus ja kiireks sekkumiseks pole põhjust."
  },
  {
    id: "T-204", title: "Tööotsija T-204", trainingIndex: 4, confidence: 74, baseline: "fast",
    text: "Hindaja näeb tööotsija tunnust ja mudeli soovitust. Hindamisvaates on registriandmed varjatud ning eksperdi võrdlushinnang pole kättesaadav.",
    referenceLabel: null,
    reason: "Hindajal on vaja registriandmeid või eksperdi võrdlushinnangut, et otsustada, kas soovitus sobib."
  }
];

const reviewPolicyFeedback = {
  every: { style: "good", text: "Iga kasutatud soovituse hindamine aitab leida ka kõrge kindlusega vigu. See nõuab ametnikelt rohkem aega." },
  sample: { style: "good", text: "Regulaarne esinduslik valim aitab korduvaid vigu leida väiksema töömahuga. Oluline on, et valim kataks eri olukordi." },
  confidence: { style: "warn", text: "Viga võib esineda ka kõrge kindlusega soovituses. Ainult madala kindlusega väljundite hindamisel jäävad sellised vead märkamata." },
  complaint: { style: "warn", text: "Kaebused annavad teada osa vigadest. Korduvad probleemid võivad jääda pikaks ajaks märkamata, kui muud tagasisidet ei koguta." }
};

const fieldNames = {
  profile: "Põhiandmed",
  notes: "Nõustaja kokkuvõte",
  barriers: "Dokumenteeritud takistused",
  activity: "Iseteeninduse tegevus",
  freshness: "Andmete kontrollimise aeg"
};

const requiredLabelCount = Object.keys(labelNames).length;
const requiredFieldCount = Object.keys(fieldNames).length;

function requiredFieldsForRule() {
  if (state.labelRule === "activity") return ["activity"];
  return ["notes", "barriers"];
}
function requiredInfoMissing(item) {
  return requiredFieldsForRule().some(key => String(item.fields[key] || "").startsWith("—"));
}
function idealLabel(item) {
  if (requiredInfoMissing(item)) {
    if (state.missingPolicy === "average") return "standard";
    if (state.missingPolicy === "drop") return "supplement";
    return "review";
  }
  return item.expected;
}
function labelReason(item) {
  if (requiredInfoMissing(item)) {
    if (state.missingPolicy === "average") return "Soovituseks vajalik registriinfo puudub. Kinnitatud reegel annab sellisele kirjele vaikimisi märgendi „Tavaplaan”.";
    if (state.missingPolicy === "drop") return "Soovituseks vajalik registriinfo puudub. Kinnitatud reegel annab märgendi „Andmete täiendamine” ja saadab kirje andmeomanikule.";
    return "Soovituseks vajalik registriinfo puudub. Kinnitatud reegel jätab puuduvuse nähtavaks ja suunab soovituse ametniku ülevaatusele.";
  }
  if (state.labelRule === "activity") {
    return "Valitud reegel kasutab iseteeninduse aktiivsust toevajaduse asendustunnusena. Tegevuse hulk ei näita siiski, millist abi inimene tegelikult vajab.";
  }
  return item.currentReason;
}
function selectedFieldNames() { return [...state.sources].map(key => fieldNames[key]); }
function caseDataHtml(item) {
  return `<div class="case-data-grid">${[...state.sources].map(key => `<div><small>${fieldNames[key]}</small><p>${item.fields[key]}</p></div>`).join("")}</div>`;
}

const stageCopy = {
  1: "Andmed ja märgendusjuhis",
  2: "Treeningkirjete märgendamine",
  3: "Soovituste hindamine",
  4: "Paranduskava koostamine"
};

const state = {
  currentStage: 1,
  maxUnlocked: 1,
  completed: new Set(),
  availableLabels: new Set(),
  sources: new Set(),
  missingPolicy: "",
  audit: "",
  labelRule: "",
  disagreement: "",
  labels: [],
  pendingLabel: null,
  intervention: "",
  reviews: [],
  pendingReview: null,
  ownership: { data: "", rules: "", monitor: "", docs: "" },
  cadence: "",
  appeal: "",
  assets: new Set()
};

function clamp(value) { return Math.max(8, Math.min(92, Math.round(value))); }

function calculateScores() {
  const s = { data: 38, output: 37, bias: 34, labor: 28, control: 26 };
  const sourceEffects = {
    profile: { data: 8, output: 4, bias: 1, labor: 2 },
    notes: { data: 12, output: 10, bias: 7, labor: 7 },
    barriers: { data: 13, output: 11, bias: 9, labor: 8 },
    activity: { data: 9, output: 5, bias: -7, labor: -2 }
  };
  state.sources.forEach(key => Object.entries(sourceEffects[key] ?? {}).forEach(([metric, value]) => { s[metric] += value; }));
  if (state.sources.size >= 3) { s.data += 4; s.bias += 3; }

  const missingEffects = {
    drop: { data: 10, output: 5, bias: 7, labor: 9 },
    average: { data: -3, output: -4, bias: -5, labor: 1 },
    guess: { data: -6, output: -7, bias: -8, labor: 0 }
  };
  const auditEffects = {
    overall: { data: 2, bias: 0, labor: 1 },
    technical: { data: 3, bias: 0, labor: 2 },
    coverage: { data: 9, bias: 18, labor: 10 }
  };
  [missingEffects[state.missingPolicy], auditEffects[state.audit]].filter(Boolean).forEach(effect => Object.entries(effect).forEach(([metric, value]) => { s[metric] += value; }));

  const ruleEffects = {
    current: { output: 10, bias: 7, labor: 5 },
    activity: { output: 4, bias: -8, labor: -2 }
  };
  const disagreementEffects = {
    first: { output: -5, bias: -6, labor: -1 },
    both: { output: -8, bias: -4, labor: 1 },
    expert: { output: 8, bias: 6, labor: 8 }
  };
  [ruleEffects[state.labelRule], disagreementEffects[state.disagreement]].filter(Boolean).forEach(effect => Object.entries(effect).forEach(([metric, value]) => { s[metric] += value; }));
  if (state.labels.length) {
    const unique = new Set(state.labels).size;
    const reviewCount = state.labels.filter(value => value === "review").length;
    s.output += unique >= 2 ? 4 : -6;
    s.bias += unique >= 2 ? 3 : -5;
    s.output += reviewCount * 1.2;
    s.bias += reviewCount * 1.4;
    s.labor += reviewCount * 2;
  }

  const interventionEffects = {
    every: { output: 14, bias: 12, labor: 12 },
    sample: { output: 9, bias: 8, labor: 6 },
    confidence: { output: 1, bias: -4, labor: 2 },
    complaint: { output: -8, bias: -10, labor: -2 }
  };
  if (interventionEffects[state.intervention]) Object.entries(interventionEffects[state.intervention]).forEach(([metric, value]) => { s[metric] += value; });
  state.reviews.forEach((review, index) => {
    if (review === expectedReview(outputCases[index])) { s.output += 4; s.bias += 3; }
    else if (review === "human") { s.output += 2; s.bias += 2; s.labor += 3; }
    else { s.output -= 3; s.bias -= 2; }
    if (review === "correct") s.labor += 2;
  });

  const ownerEffects = {
    internal: { control: 8, labor: 5 },
    shared: { control: 5, labor: 3 },
    vendor: { control: -6, labor: -3 },
    none: { control: -12, labor: -5 }
  };
  Object.values(state.ownership).filter(Boolean).forEach(owner => Object.entries(ownerEffects[owner]).forEach(([metric, value]) => { s[metric] += value; }));
  const cadenceEffects = {
    complaint: { control: -7, output: -5, bias: -3 },
    annual: { control: 3, output: 2, bias: 2, labor: 2 },
    quarterly: { control: 9, output: 7, bias: 5, labor: 5 }
  };
  if (cadenceEffects[state.cadence]) Object.entries(cadenceEffects[state.cadence]).forEach(([metric, value]) => { s[metric] += value; });
  const appealEffects = {
    helpdesk: { control: -4, output: -2, bias: -4, labor: -1 },
    vendor: { control: -2, output: 1, bias: 1, labor: 1 },
    owned: { control: 8, output: 4, bias: 7, labor: 5 }
  };
  if (appealEffects[state.appeal]) Object.entries(appealEffects[state.appeal]).forEach(([metric, value]) => { s[metric] += value; });
  s.control += state.assets.size * 6;
  s.labor += state.assets.size * 2;
  if (state.assets.size === 3) s.control += 4;

  Object.keys(s).forEach(key => { s[key] = clamp(s[key]); });
  return s;
}

function calculateWorkload() {
  let hours = 8;
  if (state.sources.has("interviews")) hours += 5;
  if (state.audit === "technical") hours += 1;
  if (state.audit === "coverage") hours += 5;
  if (state.missingPolicy === "drop") hours += 3;
  if (state.disagreement === "expert") hours += 4;
  if (state.intervention === "every") hours += 7;
  if (state.intervention === "sample") hours += 4;
  if (state.intervention === "confidence") hours += 2;
  if (state.intervention === "complaint") hours += 1;
  if (state.appeal === "owned") hours += 3;
  if (state.appeal === "vendor") hours += 1;
  hours += state.reviews.filter(value => value === "human").length * 2;
  hours += Object.values(state.ownership).filter(value => value === "internal").length;
  return hours;
}

function radarPoints(scores) {
  const center = [130, 130];
  const vertices = [[130,20],[235,96],[195,219],[65,219],[25,96]];
  return [scores.data, scores.output, scores.bias, scores.labor, scores.control].map((score, index) => {
    const ratio = score / 100;
    return `${(center[0] + (vertices[index][0] - center[0]) * ratio).toFixed(1)},${(center[1] + (vertices[index][1] - center[1]) * ratio).toFixed(1)}`;
  }).join(" ");
}

function weakestAndStrongest(scores) {
  const ordered = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  return { weakest: ordered[0], strongest: ordered.at(-1) };
}

function consequences(scores) {
  const list = [];
  if (!state.sources.size) list.push(["ANDMED", "Andmeallikad on veel valimata. Lähteandmed määravad, milliseid kogemusi süsteem üldse näeb."]);
  else if (state.sources.has("digital") && !state.sources.has("interviews")) list.push(["ANDMED", "Digijälg suurendab mahtu, kuid mitte-digitaalsed kogemused võivad jääda nähtamatuks."]);
  else if (state.sources.has("interviews")) list.push(["ANDMED", "Intervjuud lisavad konteksti, kuid nõuavad nähtavat eksperdi- ja märgendustööd."]);
  else list.push(["ANDMED", "Valitud allikad suurendavad katvust, kuid iga allika tekkeloogika vajab eraldi kontrolli."]);

  if (!state.labelRule) list.push(["KATEGOORIAD", "Märgistusreegel on määramata. Sama registrikirje võib eri märgendajate käes saada erineva tähenduse."]);
  else if (state.disagreement === "expert") list.push(["KATEGOORIAD", "Eriarvamus lahendatakse põhjendatud eksperdiotsusega ja juhise ebaselgus dokumenteeritakse."]);
  else list.push(["KATEGOORIAD", "Ühine märgendusjuhis aitab sarnaseid registrikirjeid ühtmoodi märgendada."]);

  if (!state.intervention) list.push(["VÄLJUND", "Kvaliteedimärke talletamise viis on veel määramata."]);
  else if (state.intervention === "every") list.push(["VÄLJUND", "Iga kasutatud soovitus saab kvaliteedimärke ja põhjenduse, millest tekib arendusmeeskonnale pidev tagasisidevoog."]);
  else if (state.intervention === "sample") list.push(["VÄLJUND", "Esinduslik valim aitab leida korduvaid vigu, kuid ei anna tagasisidet iga üksiku soovituse kohta."]);
  else if (state.intervention === "confidence") list.push(["VÄLJUND", "Mudeli kindlus ei võrdu kvaliteediga: ainult madala kindlusega väljundite hindamine jätab enesekindlad vead nähtamatuks."]);
  else list.push(["VÄLJUND", "Ainult kaebustest tekkiv tagasiside jõuab arendusmeeskonnani hilja ega näita vigade tegelikku ulatust."]);

  if (state.currentStage === 4 || state.completed.has(4)) {
    const vendorCount = Object.values(state.ownership).filter(value => value === "vendor" || value === "none").length;
    if (vendorCount >= 2) list[2] = ["KONTROLL", "Olulised teadmised on määramata või tarnija käes; süsteemi muutmine võib muutuda sõltuvuseks."];
    else if (state.appeal !== "owned") list[2] = ["VAIDLUSTAMINE", "Vea parandamise tee ei jõua selgelt tagasi seire ja andmete parandamiseni."];
    else list[2] = ["KONTROLL", "Vastutus, vaidlustamine ja paranduste logi moodustavad toimiva tagasisideahela."];
  }
  return list.slice(0, 3);
}

function calculateLabelMetrics() {
  const counts = Object.fromEntries(Object.keys(labelNames).map(key => [key, state.labels.filter(value => value === key).length]));
  return {
    ...counts,
    aligned: state.labels.filter((value, index) => value === idealLabel(labelCases[index])).length
  };
}

function labelPatternRows() {
  return state.labels.map((choice, index) => {
    const item = labelCases[index];
    const ideal = idealLabel(item);
    const aligned = choice === ideal;
    const note = aligned ? "" : `<small>Juhise järgi sobiks „${labelNames[ideal]}”.</small>`;
    return `<article class="learned-pattern ${aligned ? "good" : "warn"}"><span>${item.id}</span><div><b>${labelNames[choice]}</b><small>${item.pattern}</small>${note}</div></article>`;
  });
}

function updateImpact() {
  const metrics = calculateLabelMetrics();
  const total = state.labels.length;
  $("#impactNextStep").hidden = !(state.currentStage === 2 && state.completed.has(2));
  Object.keys(labelNames).forEach(key => {
    $(`#${key}LabelCount`).textContent = metrics[key];
  });
  $("#labeledFact").textContent = `${total} / ${labelCases.length}`;
  $("#categoryFact").textContent = `${metrics.aligned} / ${total}`;
  $("#learnedPatterns").innerHTML = labelPatternRows().join("");
}

function invalidateFrom(stage) {
  let changed = false;
  [...state.completed].forEach(value => { if (value >= stage) { state.completed.delete(value); changed = true; } });
  if (stage <= 2) {
    state.reviews = [];
    state.pendingReview = null;
  }
  if (changed) {
    state.maxUnlocked = Math.min(state.maxUnlocked, stage);
    $("#resultSection").hidden = true;
    showToast("Muutsid varasemat valikut. Vaata mõjutatud etapid üle ja kinnita need uuesti.");
  }
  updateNavigation();
}

function stageValid(stage) {
  if (stage === 1) {
    return state.availableLabels.size === requiredLabelCount && state.sources.size === requiredFieldCount
      && state.missingPolicy === "drop" && state.audit === "coverage"
      && state.labelRule === "current" && state.disagreement === "expert";
  }
  if (stage === 2) return state.labels.length === labelCases.length && !state.pendingLabel;
  if (stage === 3) return state.completed.has(2) && state.intervention && state.reviews.length === outputCases.length && !state.pendingReview;
  if (stage === 4) return Object.values(state.ownership).every(Boolean) && state.cadence && state.appeal && state.assets.size >= 2;
  return false;
}

function updateStage1Feedback() {
  const feedback = $("#stage1Feedback");
  const ready = stageValid(1);
  const answered = state.availableLabels.size === requiredLabelCount && state.sources.size === requiredFieldCount
    && state.labelRule && state.missingPolicy && state.disagreement && state.audit;
  feedback.hidden = !answered;
  feedback.className = ready ? "decision-feedback good" : "decision-feedback warn";
  feedback.textContent = ready ? "Juhis on kinnitamiseks valmis." : "Vähemalt üks juhise valik vajab täpsustamist.";
  $('[data-complete="1"]').disabled = !ready;
}

function renderLabelCase() {
  const container = $("#labelCase");
  const actions = $("#labelActions");
  const explanation = $("#labelExplanation");
  $("#labelProgress").textContent = `${state.labels.length} / ${labelCases.length} märgendatud`;
  const feedback = $("#stage2Feedback");
  feedback.hidden = true;
  if (state.pendingLabel) {
    const { index, choice } = state.pendingLabel;
    const item = labelCases[index];
    container.innerHTML = `<div class="case-top"><span>${item.id} · ${index + 1}/${labelCases.length}</span><b>VALISID: ${labelNames[choice]}</b></div><h4>${item.title}</h4>${caseDataHtml(item)}<div class="case-meta"><span>${selectedFieldNames().length} nähtavat välja</span></div>`;
    actions.hidden = true;
    explanation.hidden = false;
    const ideal = idealLabel(item);
    const idealAvailable = state.availableLabels.has(ideal);
    const aligned = choice === ideal;
    if (!idealAvailable) {
      explanation.dataset.result = "missing";
      $("#labelExplanationStatus").textContent = "MÄRGEND PUUDUB JUHISEST";
      $("#labelExplanationTitle").textContent = `Vajalik märgend: „${labelNames[ideal]}”`;
      $("#labelExplanationText").textContent = `Sinu valik: „${labelNames[choice]}”. ${labelReason(item)} Vajalikku märgendit ei saanud valida.`;
    } else if (aligned) {
      explanation.dataset.result = "correct";
      $("#labelExplanationStatus").textContent = "ÕIGE MÄRGEND";
      $("#labelExplanationTitle").textContent = `Õige vastus: „${labelNames[ideal]}”`;
      $("#labelExplanationText").textContent = labelReason(item);
    } else {
      explanation.dataset.result = "incorrect";
      $("#labelExplanationStatus").textContent = "VALE MÄRGEND";
      $("#labelExplanationTitle").textContent = `Õige vastus: „${labelNames[ideal]}”`;
      $("#labelExplanationText").textContent = `Sinu valik: „${labelNames[choice]}”. ${labelReason(item)} Jätkamisel lisatakse vale märgend treeningandmetesse.`;
    }
    $("#nextLabelCase").textContent = state.labels.length === labelCases.length ? "Lõpeta märgendamine" : "Järgmine treeningkirje";
  } else if (state.labels.length === labelCases.length) {
    const aligned = calculateLabelMetrics().aligned;
    container.innerHTML = `<h4>Märgendus on kinnitamiseks valmis</h4><div class="case-meta"><button class="inline-reset" type="button" data-relabel>Märgenda kirjed uuesti</button></div>`;
    feedback.hidden = state.completed.has(2) || aligned === labelCases.length;
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Osa märgendeid erineb juhisest. Kinnitamisel salvestatakse sinu valitud märgendid.";
    actions.hidden = true;
    explanation.hidden = true;
    $$("#labelActions button").forEach(button => { button.disabled = true; button.classList.remove("selected"); });
  } else {
    const item = labelCases[state.labels.length];
    container.innerHTML = `<div class="case-top"><span>${item.id} · ${state.labels.length + 1}/${labelCases.length}</span><b>MÄRGENDAMISÜLESANNE</b></div><h4>${item.title}</h4>${caseDataHtml(item)}<p class="case-prompt">Milline märgend sobib märgendusjuhise järgi?</p><div class="case-meta"><span>${selectedFieldNames().length} nähtavat välja</span></div>`;
    actions.hidden = false;
    explanation.hidden = true;
    const labelingReady = Boolean(state.labelRule && state.disagreement);
    $$("#labelActions button").forEach(button => { button.disabled = !labelingReady; button.classList.remove("selected"); });
  }
}

function simulatedSuggestion(item) {
  return state.labels[item.trainingIndex] ?? item.baseline;
}

function expectedReview(item, suggestion = simulatedSuggestion(item)) {
  if (item.referenceLabel === null) return "human";
  return suggestion === item.referenceLabel ? "accept" : "correct";
}

function outputCaseHtml(item, index, suggestion) {
  return `<div class="case-top"><span>${item.id} · ${index + 1}/${outputCases.length}</span><b>KONTROLLKIRJE</b></div>
    <h4>${item.title}</h4><p>${item.text}</p>
    <div class="output-recommendation"><span>NÄIDISSOOVITUS</span><strong>${labelNames[suggestion]}</strong>
      <div class="confidence-ring"><small>NÄITLIK KINDLUS</small><b>${item.confidence}%</b></div>
    </div>`;
}

function renderOutputCase() {
  const container = $("#outputCase");
  const actions = $("#reviewActions");
  const explanation = $("#reviewExplanation");
  $("#reviewProgress").textContent = `${state.reviews.length} / ${outputCases.length} hinnatud`;
  if (state.pendingReview) {
    const { index, choice } = state.pendingReview;
    const item = outputCases[index];
    const suggestion = simulatedSuggestion(item);
    const expected = expectedReview(item, suggestion);
    const matches = choice === expected;
    container.innerHTML = outputCaseHtml(item, index, suggestion) +
      `<div class="quality-result"><small>SINU HINNANG</small><b>${reviewNames[choice]}</b></div>`;
    actions.hidden = true;
    explanation.hidden = false;
    explanation.dataset.result = matches ? "correct" : "incorrect";
    $("#reviewExplanationStatus").textContent = matches ? "HINNANG SOBIB" : "VAATA HINNANG ÜLE";
    $("#reviewExplanationTitle").textContent = matches ? reviewNames[expected] : `Vali hinnanguks „${reviewNames[expected]}”`;
    $("#reviewExplanationText").textContent = item.reason;
    const training = labelCases[item.trainingIndex];
    $("#reviewOrigin").textContent = `Näidissoovitus põhineb treeningkirjele ${training.id} määratud märgendil „${labelNames[suggestion]}”.`;
    $("#reviewReference").hidden = expected !== "correct";
    $("#reviewReferenceLabel").textContent = expected === "correct" ? labelNames[item.referenceLabel] : "";
    $("#nextReviewCase").textContent = state.reviews.length === outputCases.length ? "Vaata hinnangute kokkuvõtet" : "Järgmine kontrollkirje";
  } else if (state.reviews.length === outputCases.length) {
    const summary = Object.keys(reviewNames).map(key => `${reviewNames[key]}: ${state.reviews.filter(value => value === key).length}`).join(" · ");
    const aligned = outputCases.filter((item, index) => state.reviews[index] === expectedReview(item)).length;
    container.innerHTML = `<div class="case-top"><span>HINDAMINE VALMIS</span><b>${outputCases.length} väljundit</b></div>
      <h4>Kontrollkirjete hinnangud</h4><p>${summary}</p>
      <p>Harjutuse kontrolliga kattus ${aligned} / ${outputCases.length} sinu hinnangust.</p>
      <div class="case-meta"><button class="inline-reset" type="button" data-rereview>Hinda väljundeid uuesti</button></div>`;
    actions.hidden = true;
    explanation.hidden = true;
    $$("#reviewActions button").forEach(button => { button.disabled = true; button.classList.remove("selected"); });
  } else {
    const index = state.reviews.length;
    const item = outputCases[index];
    container.innerHTML = outputCaseHtml(item, index, simulatedSuggestion(item));
    actions.hidden = false;
    explanation.hidden = true;
    $$("#reviewActions button").forEach(button => { button.disabled = !state.completed.has(2); });
  }
}

function updateStage4() {
  const ready = stageValid(4);
  $('[data-complete="4"]').disabled = !ready;
  const feedback = $("#stage4Feedback");
  feedback.hidden = !ready;
  if (!ready) return;
  const externalOrUnassigned = Object.values(state.ownership).some(value => value === "vendor" || value === "none");
  const weakAppeal = state.appeal !== "owned";
  feedback.className = externalOrUnassigned || weakAppeal ? "decision-feedback warn" : "decision-feedback good";
  feedback.textContent = externalOrUnassigned ? "Vähemalt üks ülesanne jääb ainult arenduspartnerile või vastutajata."
    : weakAppeal ? "Valitud vaidlustamise kord jätab lahtiseks, kuidas amet vea parandamist jälgib."
      : "Paranduskava on kinnitamiseks valmis.";
}

function updateRuleAvailability() {
  const activityAvailable = state.sources.has("activity");
  const currentAvailable = state.sources.has("notes") && state.sources.has("barriers");
  const standardAvailable = state.availableLabels.has("standard");
  const supplementAvailable = state.availableLabels.has("supplement");
  const options = {
    activity: activityAvailable,
    current: currentAvailable
  };
  Object.entries(options).forEach(([value, available]) => {
    $(`#labelRule option[value="${value}"]`).disabled = !available;
  });
  const selected = $("#labelRule").value;
  if (selected && !options[selected]) {
    $("#labelRule").value = "";
    state.labels = [];
    state.pendingLabel = null;
  }
  const dependentOptions = [
    ["#missingPolicy option[value=\"drop\"]", supplementAvailable],
    ["#missingPolicy option[value=\"average\"]", standardAvailable]
  ];
  dependentOptions.forEach(([selector, available]) => { $(selector).disabled = !available; });
  if ($("#missingPolicy").value === "drop" && !supplementAvailable) $("#missingPolicy").value = "";
  if ($("#missingPolicy").value === "average" && !standardAvailable) $("#missingPolicy").value = "";
  const ruleSelect = $("#labelRule");
  const ruleNote = $("#ruleAvailability");
  const rule = ruleSelect.value;
  ruleSelect.setAttribute("aria-invalid", String(Boolean(rule && rule !== "current")));
  ruleSelect.dataset.valid = String(rule === "current");
  if (rule === "activity") {
    ruleNote.className = "availability-note warn";
    ruleNote.textContent = "Aktiivsuse hulk võib anda toevajadusest eksitava pildi. Lähtu märgendusjuhisest.";
  } else if (rule === "current") {
    ruleNote.className = "availability-note good";
    ruleNote.textContent = "Õige valik. Lähtu märgendi määramisel märgendusjuhisest.";
  } else {
    ruleNote.className = "availability-note";
    ruleNote.textContent = currentAvailable
      ? "Ühine märgendusjuhis aitab sarnaseid kirjeid ühtmoodi märgendada."
      : "Õige reegli kasutamiseks vali andmeväljad „Nõustaja kokkuvõte” ja „Dokumenteeritud takistused”.";
  }
}

function updateAuditAvailability() {
  const auditSelect = $("#representationAudit");
  const auditNote = $("#auditAvailability");
  const audit = auditSelect.value;
  auditSelect.setAttribute("aria-invalid", String(Boolean(audit && audit !== "coverage")));
  auditSelect.dataset.valid = String(audit === "coverage");
  if (audit === "overall") {
    auditNote.className = "availability-note warn";
    auditNote.textContent = "Koguarv üksi ei näita, milliste tööotsijate registrikirjed on treeningvalimist puudu.";
  } else if (audit === "technical") {
    auditNote.className = "availability-note warn";
    auditNote.textContent = "Täidetud lahtrid ei näita, kas erinevad piirkonnad, keeled ja teeninduskanalid on valimis esindatud.";
  } else if (audit === "coverage") {
    auditNote.className = "availability-note good";
    auditNote.textContent = "Õige: see kontroll näitab nii valimi katvust kui ka kohti, kus otsustamiseks vajalik info puudub.";
  } else {
    auditNote.className = "availability-note";
    auditNote.textContent = "Kontroll peab näitama nii valimi katvust kui ka kohti, kus otsustamiseks vajalik info puudub.";
  }
}

function updateProcedureAvailability() {
  const missingSelect = $("#missingPolicy");
  const missingFeedback = $("#missingPolicyFeedback");
  const missing = missingSelect.value;
  const supplementAvailable = state.availableLabels.has("supplement");
  missingSelect.setAttribute("aria-invalid", String(Boolean(missing && missing !== "drop")));
  missingSelect.dataset.valid = String(missing === "drop");
  if (!supplementAvailable) {
    missingFeedback.className = "availability-note warn";
    missingFeedback.textContent = "Õige tegevuse valimiseks lisa märgend „Andmete täiendamine”.";
  } else if (missing === "average") {
    missingFeedback.className = "availability-note warn";
    missingFeedback.textContent = "Puuduv väärtus tähendab „teadmata”, mitte „takistust pole”. Tavaplaani ei saa selle põhjal põhjendada.";
  } else if (missing === "guess") {
    missingFeedback.className = "availability-note warn";
    missingFeedback.textContent = "Oletus muudaks puuduliku info põhjendamatult kindlaks otsuseks. Vajalik info tuleb enne lisada.";
  } else if (missing === "drop") {
    missingFeedback.className = "availability-note good";
    missingFeedback.textContent = "Õige: registrikirje saab märgendi „Andmete täiendamine” ja mudel ei anna enne info lisamist kindlat toevajaduse soovitust.";
  } else {
    missingFeedback.className = "availability-note";
    missingFeedback.textContent = "Puuduliku info põhjal ei tohi teha kindlat toevajaduse otsust.";
  }

  const disagreementSelect = $("#disagreementPolicy");
  const disagreementFeedback = $("#disagreementFeedback");
  const disagreement = disagreementSelect.value;
  disagreementSelect.setAttribute("aria-invalid", String(Boolean(disagreement && disagreement !== "expert")));
  disagreementSelect.dataset.valid = String(disagreement === "expert");
  if (disagreement === "first") {
    disagreementFeedback.className = "availability-note warn";
    disagreementFeedback.textContent = "Esimese valiku eelistamine ei lahenda eriarvamuse põhjust ega paranda juhist.";
  } else if (disagreement === "both") {
    disagreementFeedback.className = "availability-note warn";
    disagreementFeedback.textContent = "Sama registrikirje kahe vastukäiva märgendiga muudaks treeningandmed vastuoluliseks.";
  } else if (disagreement === "expert") {
    disagreementFeedback.className = "availability-note good";
    disagreementFeedback.textContent = "Õige: valdkonnaspetsialist teeb põhjendatud lõppotsuse ja ebaselge koha saab juhises parandada.";
  } else {
    disagreementFeedback.className = "availability-note";
    disagreementFeedback.textContent = "Treeningandmetesse peab jõudma üks põhjendatud märgend, mitte lahendamata vastuolu.";
  }
}

function updateAvailableLabelUI() {
  Object.keys(labelNames).forEach(key => {
    const available = state.availableLabels.has(key);
    $$(`[data-guide-label="${key}"]`).forEach(element => { element.hidden = !available; });
    const action = $(`#labelActions [data-label="${key}"]`);
    if (action) action.hidden = !available;
  });
}

function updateControls() {
  updateRuleAvailability();
  updateAvailableLabelUI();
  state.missingPolicy = $("#missingPolicy").value;
  state.audit = $("#representationAudit").value;
  state.labelRule = $("#labelRule").value;
  state.disagreement = $("#disagreementPolicy").value;
  state.intervention = $("#interventionRule").value;
  state.cadence = $("#maintenanceCadence").value;
  state.appeal = $("#appealPolicy").value;
  updateAuditAvailability();
  updateProcedureAvailability();
  updateStage1Feedback();
  const policyFeedback = reviewPolicyFeedback[state.intervention];
  const stage3Feedback = $("#stage3Feedback");
  stage3Feedback.hidden = !policyFeedback;
  stage3Feedback.className = policyFeedback ? `decision-feedback ${policyFeedback.style}` : "decision-feedback";
  stage3Feedback.textContent = policyFeedback?.text ?? "";
  renderLabelCase();
  renderOutputCase();
  updateStage4();
  updateImpact();
  updateFocusState();
}

function updateFocusState() {
  const labelingConfirmed = state.completed.has(2);
  const confirmLabeling = $('[data-complete="2"]');
  confirmLabeling.disabled = labelingConfirmed || !stageValid(2);
  confirmLabeling.querySelector("span").textContent = labelingConfirmed ? "Märgendus kinnitatud" : "Kinnita märgendus";

  const reviewConfirmed = state.completed.has(3);
  const confirmReview = $('[data-complete="3"]');
  confirmReview.disabled = reviewConfirmed || !stageValid(3);
  confirmReview.querySelector("span").textContent = reviewConfirmed ? "Kvaliteedihinnangud kinnitatud" : "Kinnita kvaliteedihinnangud";

  const stageDone = state.completed.has(state.currentStage);
  const summaryActive = state.currentStage === 2 && labelingConfirmed;
  $("#impactCard").hidden = !summaryActive;
  $(".lab-grid").classList.toggle("impact-pending", !summaryActive);

  const controlCard = $(".control-card");
  controlCard.inert = summaryActive;
  controlCard.classList.toggle("summary-inactive", summaryActive);
  controlCard.classList.toggle("focus-active", !stageDone);

  const taskCue = $("#activeTaskCue");
  taskCue.hidden = state.currentStage !== 1 || stageDone;
  taskCue.querySelector("b").textContent = `Märgendid ${state.availableLabels.size}/${requiredLabelCount} · andmeväljad ${state.sources.size}/${requiredFieldCount}`;
}

function updateNavigation() {
  $$(".step").forEach(button => {
    const stage = Number(button.dataset.step);
    button.disabled = stage > state.maxUnlocked;
    button.classList.toggle("active", stage === state.currentStage);
    button.classList.toggle("done", state.completed.has(stage));
    if (stage === state.currentStage) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $$(".decision-stage").forEach(section => {
    const active = Number(section.dataset.stage) === state.currentStage;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  if (state.currentStage === 2 || state.currentStage === 3) {
    const progress = $(`[data-stage="${state.currentStage}"] .case-progress`);
    const guide = $("#labelGuide");
    if (progress.previousElementSibling !== guide) {
      progress.before(guide);
      guide.open = state.currentStage === 2;
    }
  }
  $("#stageCounter").textContent = `ETAPP ${state.currentStage} / 4`;
  $("#progressText").textContent = state.completed.size === 4 ? "Harjutus lõpetatud" : `${state.currentStage}. ${stageCopy[state.currentStage]}`;
  const progress = state.completed.size * 25;
  $("#progressValue").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#completedCount").textContent = state.completed.size;
  $("#previousStage").disabled = state.currentStage === 1;
  $("#nextStage").disabled = state.currentStage >= state.maxUnlocked || state.currentStage === 4;
  updateFocusState();
}

function showStage(stage, shouldScroll = true) {
  if (stage > state.maxUnlocked) return;
  state.currentStage = stage;
  if (stage === 3) renderOutputCase();
  updateNavigation();
  updateImpact();
  if (shouldScroll) $(".stepper").scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusImpactSummary() {
  const card = $("#impactCard");
  card.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

const dialogMessages = {
  1: {
    title: "Andmete ja juhise kokkuvõte",
    startLabel: "ANDMEVÄLJAD",
    start: "Märgendaja näeb iga kirje juures viit välja.",
    middleLabel: "MÄRGENDID",
    middle: "Valida saab viie märgendi vahel.",
    endLabel: "JÄRGMINE ETAPP",
    end: "Kinnitatud juhise järgi märgendatakse viis kirjet.",
    continueText: "Märgendamise juurde"
  },
  2: {
    title: "Märgendus kinnitatud",
    startLabel: "TREENINGKIRJED",
    start: "Valisid viiele kirjele märgendi.",
    middleLabel: "TREENINGANDMED",
    middle: "Valitud märgendid jäävad selles harjutuses treeningkirjete juurde.",
    endLabel: "KONTROLLKIRJED",
    end: "Nende põhjal kuvatakse näidissoovitused.",
    continueText: "Märgenduse kokkuvõtte juurde",
    sections: [
      { title: "Märgendusvea mõju", text: "Kui treeningkirje sai juhisest erineva märgendi, ilmub see märgend ka seotud kontrollkirje soovitusena." }
    ]
  },
  4: {
    title: "Paranduskava kinnitatud",
    startLabel: "VASTUTUS",
    start: "Valisid, kelle ülesanne on juhist ja andmeid hallata.",
    middleLabel: "PARANDUSKAVA",
    middle: "Määrasid ülevaatamise sageduse ja vaidlustamise korra.",
    endLabel: "KONTROLLMATERJALID",
    end: "Valisid materjalid, mille alusel saab parandusi kontrollida.",
    continueText: "Paranduskava juurde",
    sections: [
      {
        title: "Kuidas kontrollida parandust?",
        text: "Hindamisel leitud vea põhjal saab koostada kontrollkirje. Sama kirje abil saab järgmises versioonis kontrollida, kas viga kordub."
      },
    ]
  }
};

function confirmedRuleSection(select) {
  return {
    title: select.labels[0].querySelector("span").textContent,
    text: select.selectedOptions[0].textContent,
    confirmed: true
  };
}

function renderDialogInsight(sections) {
  const content = sections.map(({ title, text, items, confirmed }) => {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.append(heading);
    if (items) {
      const list = document.createElement("ul");
      items.forEach(item => {
        const entry = document.createElement("li");
        entry.textContent = item;
        list.append(entry);
      });
      section.append(list);
    } else {
      const paragraph = document.createElement("p");
      if (confirmed) paragraph.className = "dialog-rule-selected";
      paragraph.textContent = text;
      section.append(paragraph);
    }
    return section;
  });
  $("#dialogInsight").replaceChildren(...content);
}

function completeStage(stage) {
  if (!stageValid(stage)) return;
  state.completed.add(stage);
  if (stage < 4) state.maxUnlocked = Math.max(state.maxUnlocked, stage + 1);
  if (stage === 3) {
    showStage(4, false);
    $("#stage4Title").focus({ preventScroll: true });
    requestAnimationFrame(() => {
      $(".control-card").scrollIntoView({ behavior: "instant", block: "start" });
    });
    return;
  }
  updateNavigation();
  updateImpact();

  const message = { ...dialogMessages[stage] };
  if (stage === 1) {
    const fields = selectedFieldNames();
    const labels = Object.keys(labelNames).filter(key => state.availableLabels.has(key)).map(key => labelNames[key]);
    message.sections = [
      { title: "Valitud märgendid", items: labels },
      { title: "Märgendajale nähtavad väljad", items: fields },
      confirmedRuleSection($("#missingPolicy")),
      confirmedRuleSection($("#labelRule")),
      confirmedRuleSection($("#disagreementPolicy")),
      confirmedRuleSection($("#representationAudit"))
    ];
  }
  $("#dialogTitle").textContent = message.title;
  $("#dialogStage").textContent = `${stage} / 4`;
  $("#dialogStartLabel").textContent = message.startLabel;
  $("#dialogStart").textContent = message.start;
  $("#dialogMiddleLabel").textContent = message.middleLabel;
  $("#dialogMiddle").textContent = message.middle;
  $("#dialogEndLabel").textContent = message.endLabel;
  $("#dialogEnd").textContent = message.end;
  renderDialogInsight(message.sections);
  $("#dialogContinue span").textContent = message.continueText;
  const dialog = $("#impactDialog");
  dialog.dataset.completedStage = stage;
  dialog.showModal();
  if (stage === 1) {
    $("#dialogTitle").focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  if (stage === 4) renderResults();
}

function renderResults() {
  const metrics = calculateLabelMetrics();
  const alignedReviews = outputCases.filter((item, index) => state.reviews[index] === expectedReview(item)).length;
  const tradeoffs = [
    ["Märgenduse vastavus juhisele", `Kinnitatud juhisele vastas ${metrics.aligned} märgendit ${labelCases.length}-st.`],
    ["Puudulik või vastuoluline info", `Sinu märgendite järgi vajab andmete täiendamist ${metrics.supplement} kirjet ning inimese ülevaatust ${metrics.review} kirjet.`],
    ["Kontrollkirjete hinnangud", `Harjutuse kontrolliga kattus ${alignedReviews} hinnangut ${outputCases.length}-st.`],
    ["Vaidlustusest paranduse kavandamiseni", state.appeal === "owned"
      ? "Sinu valitud korras lisatakse parandus seirelogisse. Logi põhjal saab otsustada, mida juhises, treeningandmetes või kontrollkirjetes muuta."
      : "Sinu valitud kord jätab lahtiseks, kuidas jõuab vaidlustuse põhjus ameti seirelogisse ja järgmisse märgendusvooru."]
  ];
  $("#tradeoffList").innerHTML = tradeoffs.map(([heading, text]) => `<article><b>${heading}</b><p>${text}</p></article>`).join("");

  const choices = $$("#ownershipGrid select, #maintenanceCadence, #appealPolicy").map(confirmedRuleSection);
  choices.push({
    title: "Säilitatavad materjalid",
    text: $$("#exitAssets input:checked").map(input => input.closest("label").querySelector("b").textContent).join(", ")
  });
  $("#planSummary").replaceChildren(...choices.map(({ title, text }) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = title;
    description.textContent = text;
    row.append(term, description);
    return row;
  }));
  $("#resultSection").hidden = false;
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function resetSimulation() {
  state.currentStage = 1;
  state.maxUnlocked = 1;
  state.completed.clear();
  state.availableLabels.clear();
  state.sources.clear();
  state.missingPolicy = ""; state.audit = ""; state.labelRule = ""; state.disagreement = "";
  state.labels = []; state.pendingLabel = null; state.intervention = ""; state.reviews = []; state.pendingReview = null;
  state.ownership = { data: "", rules: "", monitor: "", docs: "" };
  state.cadence = ""; state.appeal = ""; state.assets.clear();
  $$('input[type="checkbox"], input[type="radio"]').forEach(input => { input.checked = false; });
  $$('select').forEach(select => { select.selectedIndex = 0; });
  $("#resultSection").hidden = true;
  updateNavigation(); updateControls();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#sourceChoices").addEventListener("change", event => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  event.target.checked ? state.sources.add(event.target.value) : state.sources.delete(event.target.value);
  state.labels = [];
  state.pendingLabel = null;
  invalidateFrom(1); updateControls();
});

$("#availableLabelChoices").addEventListener("change", event => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  event.target.checked ? state.availableLabels.add(event.target.value) : state.availableLabels.delete(event.target.value);
  state.labels = [];
  state.pendingLabel = null;
  invalidateFrom(1);
  updateControls();
});

[$("#missingPolicy"), $("#representationAudit")].forEach(select => select.addEventListener("change", () => {
  state.labels = []; state.pendingLabel = null; invalidateFrom(1); updateControls();
}));
$("#labelRule").addEventListener("change", () => {
  invalidateFrom(1);
  state.labels = [];
  state.pendingLabel = null;
  updateControls();
});
$("#disagreementPolicy").addEventListener("change", () => {
  state.labels = []; state.pendingLabel = null; invalidateFrom(1); updateControls();
});
$("#interventionRule").addEventListener("change", () => {
  invalidateFrom(3);
  updateControls();
});
[$("#maintenanceCadence"), $("#appealPolicy")].forEach(select => select.addEventListener("change", () => { invalidateFrom(4); updateControls(); }));

$("#labelActions").addEventListener("click", event => {
  const button = event.target.closest("button[data-label]");
  if (!button || button.disabled || state.pendingLabel) return;
  invalidateFrom(2);
  const index = state.labels.length;
  const choice = button.dataset.label;
  state.labels.push(choice);
  state.pendingLabel = { index, choice };
  updateControls();
});

$("#nextLabelCase").addEventListener("click", () => {
  state.pendingLabel = null;
  updateControls();
  $("#labelCase").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#undoLabelChoice").addEventListener("click", () => {
  if (!state.pendingLabel) return;
  state.labels.pop();
  state.pendingLabel = null;
  updateControls();
});

function restartLabeling() {
  state.labels = [];
  state.pendingLabel = null;
  invalidateFrom(2);
  updateControls();
}

$("#labelCase").addEventListener("click", event => {
  if (event.target.closest("[data-relabel]")) restartLabeling();
});

$("#reviewActions").addEventListener("click", event => {
  const button = event.target.closest("button[data-review]");
  if (!button || button.disabled || state.pendingReview) return;
  invalidateFrom(3);
  const index = state.reviews.length;
  const choice = button.dataset.review;
  state.reviews.push(choice);
  state.pendingReview = { index, choice };
  updateControls();
});

$("#undoReviewChoice").addEventListener("click", () => {
  if (!state.pendingReview) return;
  state.reviews.pop();
  state.pendingReview = null;
  updateControls();
  $("#reviewActions button").focus({ preventScroll: true });
});

$("#nextReviewCase").addEventListener("click", () => {
  state.pendingReview = null;
  updateControls();
  $("#outputCase").scrollIntoView({ behavior: "smooth", block: "center" });
});

function restartReviews() {
  state.reviews = [];
  state.pendingReview = null;
  invalidateFrom(3);
  updateControls();
}

$("#outputCase").addEventListener("click", event => {
  if (event.target.closest("[data-rereview]")) restartReviews();
});

$("#ownershipGrid").addEventListener("change", event => {
  if (!event.target.matches("select[data-owner]")) return;
  state.ownership[event.target.dataset.owner] = event.target.value;
  invalidateFrom(4); updateControls();
});

$("#exitAssets").addEventListener("change", event => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  event.target.checked ? state.assets.add(event.target.value) : state.assets.delete(event.target.value);
  invalidateFrom(4); updateControls();
});

$$('[data-complete]').forEach(button => button.addEventListener("click", () => completeStage(Number(button.dataset.complete))));
$$('.step').forEach(button => button.addEventListener("click", () => showStage(Number(button.dataset.step))));
$("#previousStage").addEventListener("click", () => showStage(Math.max(1, state.currentStage - 1)));
$("#nextStage").addEventListener("click", () => showStage(Math.min(state.maxUnlocked, state.currentStage + 1)));
$("#continueFromImpact").addEventListener("click", () => showStage(state.currentStage + 1));
$("#retryFromImpact").addEventListener("click", () => {
  if ($("#impactNextStep").hidden) return;
  restartLabeling();
  showStage(2);
  $('[data-step="2"]').focus({ preventScroll: true });
});

$("#dialogContinue").addEventListener("click", () => {
  const stage = Number($("#impactDialog").dataset.completedStage);
  $("#impactDialog").close();
  if (stage === 2) focusImpactSummary();
  else if (stage < 4) showStage(stage + 1);
  else $("#resultSection").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#resetButton").addEventListener("click", resetSimulation);

updateNavigation();
updateControls();
