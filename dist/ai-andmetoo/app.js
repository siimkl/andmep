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
const reviewNames = { accept: "Soovitus kinnitatud", correct: "Soovitus parandatud", human: "Ametnikule suunatud" };

const labelCases = [
  { id: "J-01", title: "Hiljutine töökaotus", pattern: "hiljutine töökaotus", fields: { profile: "Töösuhe lõppes kaks nädalat tagasi.", notes: "Inimene vajab abi töötuna registreerimisel.", barriers: "Töötuna registreerimine ja toetuste taotlemine on pooleli.", activity: "Iseteeninduses pole pärast töökaotust tegevust." }, expected: "fast", currentReason: "Hiljutine töökaotus ning pooleli olev registreerimine peatavad tööotsingu ja vajavad ametniku sihitud abi." },
  { id: "J-02", title: "Tavapärane tööotsing", pattern: "selge tavapärane vajadus", fields: { profile: "Oskused vastavad soovitud töökohtade nõuetele.", notes: "Inimene vajab tavapärast töövahenduse tuge.", barriers: "Dokumenteeritud takistused puuduvad.", activity: "Inimene kandideerib regulaarselt sobivatele töökohtadele." }, expected: "standard", currentReason: "Info on täielik ja kooskõlaline ning ükski nähtav takistus ei vaja kiiret sekkumist." },
  { id: "J-03", title: "Oluline info puudub", pattern: "puuduv info", fields: { profile: "Töösoov on märgitud, kuid oskuste väli on tühi.", notes: "Juhtumikirjeldus ei ütle, millist abi inimene vajab.", barriers: "— väärtus puudub", activity: "Üks sisselogimine viimase kuu jooksul." }, expected: "supplement", currentReason: "Takistuste väli on tühi ja juhtumikirjeldus ei anna otsustamiseks piisavalt infot." },
  { id: "J-04", title: "Koolitus on lõpetatud", pattern: "ajakohane positiivne muutus", fields: { profile: "Nõutud kutsetunnistus on lisatud sel kuul.", notes: "Oskused vastavad nüüd soovitud töökohtade nõuetele.", barriers: "Dokumenteeritud takistused puuduvad.", activity: "Inimene kandideerib sobivatele töökohtadele." }, expected: "self", currentReason: "Koolitus on lõpetatud, oskused vastavad nõuetele ja nähtavaid takistusi pole. Inimene saab tööotsingut iseseisvalt jätkata." },
  { id: "J-05", title: "Nõustajad ei ole ühel meelel", pattern: "nõustajate eriarvamus", fields: { profile: "Põhiandmed on ajakohased.", notes: "Üks nõustaja soovitab kiiret tuge, teine tavaplaani.", barriers: "Takistuse mõju pole üheselt kirjeldatud.", activity: "Iseteeninduse kasutus vastab tavapärasele mustrile." }, expected: "review", currentReason: "Nõustajate hinnangud on vastuolus ja takistuse mõju pole selge, seega vajab juhtum inimese ülevaatust." }
];

const outputCases = [
  { id: "V-01", title: "Hiljutine muutus", trainingIndex: 0, text: "Uue juhtumi profiil on aegunud, kuid nõustaja on dokumenteerinud hiljutise töökaotuse.", confidence: 62, expected: "human", impact: "Kui sarnane treeningjuhtum sai vale märgendi, võib mudel sama viga uue inimese puhul korrata.", baseline: "Tavaplaan" },
  { id: "V-02", title: "Oluline info puudub", trainingIndex: 2, text: "Uue juhtumi takistuste väli on tühi ja kirjeldus ei ütle, millist abi inimene vajab.", confidence: 81, expected: "accept", impact: "Kui puudulik juhtum sai treeningandmetes märgendi „Andmete täiendamine”, oskab mudel küsida lisainfot ega tee põhjendamatult kindlat teenusesoovitust.", baseline: "Tavaplaan" },
  { id: "V-03", title: "Selge tavapärane juhtum", trainingIndex: 1, text: "Uue juhtumi info on täielik, ajakohane ja kooskõlaline ning kiireks sekkumiseks pole põhjust.", confidence: 89, expected: "accept", impact: "Hea tavaplaani näide aitab mudelil vältida kõigi juhtumite põhjendamatut suunamist kiiresse sekkumisse.", baseline: "Tavaplaan" },
  { id: "V-04", title: "Vastuoluline piirjuhtum", trainingIndex: 4, text: "Uue juhtumi eksperdimärkused annavad erineva soovituse ja takistuse mõju pole selge.", confidence: 74, expected: "human", impact: "Kui eriarvamus muudeti treeningandmetes kunstlikult kindlaks märgendiks, õpib mudel ebakindlust varjama.", baseline: "Kiire tugi" }
];

const fieldNames = {
  profile: "Põhiandmed",
  notes: "Nõustaja kokkuvõte",
  barriers: "Dokumenteeritud takistused",
  activity: "Iseteeninduse tegevus"
};

const ruleNames = {
  activity: "kasuta iseteeninduse aktiivsust toevajaduse hinnanguna",
  current: "lähtu praegusest dokumenteeritud vajadusest ja märgendusjuhisest"
};

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
    if (state.missingPolicy === "average") return "Otsustamiseks vajalik info puudub. Kinnitatud reegel annab sellisele juhtumile vaikimisi märgendi „Tavaplaan”.";
    if (state.missingPolicy === "drop") return "Otsustamiseks vajalik info puudub. Kinnitatud reegel annab märgendi „Andmete täiendamine” ja suunab juhtumi andmeomanikule.";
    return "Otsustamiseks vajalik info puudub. Kinnitatud reegel jätab puuduvuse nähtavaks ja suunab juhtumi inimese ülevaatusele.";
  }
  if (state.labelRule === "activity") {
    return "Valitud reegel kasutab iseteeninduse aktiivsust toevajaduse asendustunnusena. Tegevuse hulk ei näita siiski, millist abi inimene tegelikult vajab.";
  }
  return item.currentReason;
}
function selectedFieldNames() { return [...state.sources].map(key => fieldNames[key]); }
function hasMissingInfoRoute() { return ["standard", "supplement", "review"].some(label => state.availableLabels.has(label)); }
function caseDataHtml(item) {
  return `<div class="case-data-grid">${[...state.sources].map(key => `<div><small>${fieldNames[key]}</small><p>${item.fields[key]}</p></div>`).join("")}</div>`;
}
function outputText(item) { return item.text; }

const stageCopy = {
  1: { title: "Vali andmed ja määra nõuded", story: "<b>Andmete valik eelneb märgendamisele.</b> Valitud väljad ja juhis määravad, mida märgendaja saab põhjendatult otsustada ning mida mudel hiljem õppida saab." },
  2: { title: "Märgenda juhtumid", story: "<b>Iga märgendatud juhtum lisatakse mudeli treeningandmetesse.</b> Hästi põhjendatud märgend tugineb nähtavale infole ja ühtsele juhisele. Kui kindlat otsust ei saa teha, peab ebakindlus jääma nähtavaks." },
  3: { title: "Kontrolli mudeli soovitusi", story: "<b>Mudel kordab sinu märgendites tekkinud mustreid.</b> Võrdle uusi soovitusi varasema mudeliga ja kontrolli, kas need põhinevad asjakohasel infol." },
  4: { title: "Paranda märgendusprotsessi", story: "<b>Mudeli viga võib alata märgendist.</b> Paranduse põhjus peab jõudma tagasi juhisesse, piirjuhtumitesse ja andmestiku järgmisse versiooni." }
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
  state.sources.forEach(key => Object.entries(sourceEffects[key]).forEach(([metric, value]) => { s[metric] += value; }));
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
    low: { output: 2, bias: -2, labor: 1 },
    medium: { output: 10, bias: 7, labor: 8 },
    group: { output: 14, bias: 16, labor: 13 },
    none: { output: -12, bias: -18, labor: -10 }
  };
  if (interventionEffects[state.intervention]) Object.entries(interventionEffects[state.intervention]).forEach(([metric, value]) => { s[metric] += value; });
  state.reviews.forEach((review, index) => {
    if (review === outputCases[index].expected) { s.output += 4; s.bias += 3; }
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
  if (state.intervention === "medium") hours += 4;
  if (state.intervention === "group") hours += 7;
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

  if (!state.labelRule) list.push(["KATEGOORIAD", "Märgistusreegel on määramata. Sama juhtum võib eri inimeste käes saada erineva tähenduse."]);
  else if (state.disagreement === "expert") list.push(["KATEGOORIAD", "Eriarvamus lahendatakse põhjendatud eksperdiotsusega ja juhise ebaselgus dokumenteeritakse."]);
  else list.push(["KATEGOORIAD", "Praegust vajadust arvestav reegel lisab konteksti, kuid vajab dokumenteeritud eksperditööd."]);

  if (!state.intervention) list.push(["VÄLJUND", "Inimese sekkumise piir on veel määramata."]);
  else if (state.intervention === "none") list.push(["VÄLJUND", "Automaatne rakendamine vähendab nähtavat tööd, kuid jätab vea avastamise teenuse kasutajale."]);
  else list.push(["VÄLJUND", `Ülevaatusreegel kasvatab töökoormust, kuid loob koha vigade ja ebakindluse avastamiseks.`]);

  if (state.currentStage === 4 || state.completed.has(4)) {
    const vendorCount = Object.values(state.ownership).filter(value => value === "vendor" || value === "none").length;
    if (vendorCount >= 2) list[2] = ["KONTROLL", "Olulised teadmised on määramata või tarnija käes; süsteemi muutmine võib muutuda sõltuvuseks."];
    else if (state.appeal !== "owned") list[2] = ["VAIDLUSTAMINE", "Vea parandamise tee ei jõua selgelt tagasi seire ja andmete parandamiseni."];
    else list[2] = ["KONTROLL", "Vastutus, vaidlustamine ja paranduste logi moodustavad toimiva tagasisideahela."];
  }
  return list.slice(0, 3);
}

function baselineSuggestion(item) {
  return item.baseline;
}

function calculateLabelMetrics() {
  const counts = Object.fromEntries(Object.keys(labelNames).map(key => [key, state.labels.filter(value => value === key).length]));
  const changedOutputs = state.labels.length
    ? outputCases.filter((item, index) => baselineSuggestion(item) !== simulatedSuggestion(item, index)).length
    : 0;
  return {
    ...counts,
    changedOutputs,
    humanActions: state.reviews.filter(value => value === "human" || value === "correct").length,
    categories: new Set(state.labels).size,
    aligned: state.labels.filter((value, index) => value === idealLabel(labelCases[index])).length
  };
}

function labelPatternRows() {
  return state.labels.map((choice, index) => ({ choice, index })).slice(-5).map(({ choice, index }) => {
    const item = labelCases[index];
    const ideal = idealLabel(item);
    const aligned = choice === ideal;
    const unavailable = !state.availableLabels.has(ideal);
    const note = aligned ? "" : unavailable ? ` — vajalik märgend „${labelNames[ideal]}” puudub juhisest` : ` — juhendi järgi sobiks „${labelNames[ideal]}”`;
    return `<article class="learned-pattern ${aligned ? "good" : "warn"}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${item.pattern}</b><small>seostub sinu treeningandmetes märgendiga „${labelNames[choice]}”${note}</small></div></article>`;
  });
}

function updateImpact() {
  const metrics = calculateLabelMetrics();
  const total = state.labels.length;
  $("#impactStatus").textContent = `${total} / ${labelCases.length} märgendatud`;
  Object.keys(labelNames).forEach(key => {
    const available = state.availableLabels.has(key);
    $(`[data-label-bar="${key}"]`).hidden = !available;
    $(`#${key}LabelCount`).textContent = metrics[key];
    $(`[data-label-bar="${key}"] i span`).style.width = `${(metrics[key] / labelCases.length) * 100}%`;
  });
  $("#labeledFact").textContent = `${total} / ${labelCases.length}`;
  $("#categoryFact").textContent = `${metrics.aligned} / ${total}`;
  $("#ambiguityFact").textContent = metrics.review + metrics.supplement;

  let distributionText = state.completed.has(1)
    ? `Märgendaja näeb ${state.sources.size} andmevälja, saab kasutada ${state.availableLabels.size} märgendit ja järgib reeglit „${ruleNames[state.labelRule]}”. Treeningandmetesse pole veel ühtegi juhtumit lisatud.`
    : "Esmalt vali, millised andmeväljad ja milline juhis märgendajale antakse.";
  if (total && total < labelCases.length) distributionText = `Märgendasid ${total}/${labelCases.length} juhtumit. Neist ${metrics.aligned} vastab harjutuse juhendile. Iga uus märgend muudab mustrit, mida mudel õpib.`;
  if (total === labelCases.length) {
    const dominant = Object.entries(labelNames).map(([key, label]) => [key, label, metrics[key]]).sort((a, b) => b[2] - a[2])[0];
    distributionText = dominant[2] >= 3
      ? `Märgend „${dominant[1]}” esineb ${dominant[2]}/${labelCases.length} näites. Seetõttu kipub mudel seda sarnastes olukordades sagedamini soovitama. Juhendile vastas ${metrics.aligned}/${labelCases.length} märgendit.`
      : `Andmestikus on ${metrics.categories} erinevat märgendit. Juhendile vastas ${metrics.aligned}/${labelCases.length} märgendit. Mudel õpib siiski ka ekslikest märgenditest.`;
  }
  $("#distributionSummary").textContent = distributionText;

  const patterns = labelPatternRows();
  $("#learnedPatterns").innerHTML = patterns.length
    ? `${patterns.join("")}<article class="learned-pattern warn"><span>!</span><div><b>Seos ei tõesta põhjust</b><small>Mudel näeb koos esinevaid tunnuseid ja märgendeid, mitte inimese tegelikku vajadust.</small></div></article>`
    : '<div class="empty-pattern">Märgenda esimene juhtum. Siin näed, millise seose loob mudel juhtumi tunnuste ja sinu valitud märgendi vahel.</div>';

  $("#changedOutputCount").textContent = `${metrics.changedOutputs} / ${outputCases.length} muutunud`;
  $("#modelOutputGrid").innerHTML = total
    ? outputCases.map((item, index) => {
        const before = baselineSuggestion(item);
        const after = simulatedSuggestion(item, index);
        const changed = before !== after;
        const humanDecision = state.reviews[index] ? `<p><b>Inimese kontroll:</b> ${reviewNames[state.reviews[index]]}</p>` : "";
        return `<article class="model-impact-card"><div class="model-case-head"><span>${item.id}</span><b>${item.title}</b></div><div class="model-comparison"><div><small>VARASEM MUDEL</small><strong>${before}</strong></div><div class="${changed ? "changed" : ""}"><small>SINU TREENINGANDMETEGA</small><strong>${after}</strong></div></div><p>${state.labels[item.trainingIndex] ? `Soovitus järgib sinu treeningandmete kõige sarnasemat märgendatud juhtumit ${labelCases[item.trainingIndex].id}.` : "Sarnast juhtumit pole veel treeningandmetesse lisatud, seega kuvatakse varasema mudeli soovitus."}</p>${humanDecision}</article>`;
      }).join("")
    : '<article class="model-impact-card waiting">Mudeli soovituste võrdlus avaneb pärast esimest märgendit.</article>';

  if (!total) {
    $("#latestLabelImpact").classList.remove("active");
    $("#latestLabelImpact").innerHTML = "<span>ALUSTA MÄRGENDAMISEST</span><p>Kui märgendad esimese juhtumi, näed siin kohe, kuidas see muudab õppeandmestikku ja mudeli järgmisi soovitusi.</p>";
  } else {
    const index = total - 1;
    const item = labelCases[index];
    const changedList = outputCases.map((output, outputIndex) => baselineSuggestion(output) !== simulatedSuggestion(output, outputIndex) ? output.id : null).filter(Boolean);
    $("#latestLabelImpact").classList.add("active");
    const ideal = idealLabel(item);
    const aligned = state.labels[index] === ideal;
    const unavailable = !state.availableLabels.has(ideal);
    const alignmentText = aligned
      ? "Märgend vastab kinnitatud juhisele."
      : unavailable
        ? `Selle juhtumi jaoks vajalik märgend „${labelNames[ideal]}” puudub juhisest, seega lisati treeningandmetesse kompromissmärgend.`
        : `Kinnitatud juhise järgi sobiks märgend „${labelNames[ideal]}”. Praegune valik õpetab mudelile teistsuguse seose.`;
    $("#latestLabelImpact").innerHTML = `<span>VIIMASE MÄRGENDI MÕJU · ${item.id}</span><p>Juhtum „${item.title}” sai märgendi <b>${labelNames[state.labels[index]]}</b> ja lisati mudeli treeningandmetesse. ${alignmentText} ${changedList.length ? `Mõju on juba näha testjuhtumites ${changedList.join(", ")}.` : "Ükski testjuhtumi soovitus pole veel muutunud."}</p>`;
  }
}

function invalidateFrom(stage) {
  let changed = false;
  [...state.completed].forEach(value => { if (value >= stage) { state.completed.delete(value); changed = true; } });
  if (stage <= 2) {
    state.reviews = [];
    state.pendingReview = null;
  }
  if (changed) {
    $("#resultSection").hidden = true;
    showToast("Muutsid varasemat valikut. Vaata mõjutatud etapid üle ja kinnita need uuesti.");
  }
  updateNavigation();
}

function stageValid(stage) {
  if (stage === 1) return state.availableLabels.size >= 2 && hasMissingInfoRoute() && state.sources.size >= 2 && state.missingPolicy === "drop" && state.audit === "coverage" && state.labelRule === "current" && state.disagreement === "expert";
  if (stage === 2) return state.labels.length === labelCases.length && !state.pendingLabel;
  if (stage === 3) return state.intervention && state.reviews.length === outputCases.length && !state.pendingReview;
  if (stage === 4) return Object.values(state.ownership).every(Boolean) && state.cadence && state.appeal && state.assets.size >= 2;
  return false;
}

function updateStage1Feedback() {
  const feedback = $("#stage1Feedback");
  if (state.availableLabels.size < 2) {
    feedback.className = "decision-feedback";
    feedback.textContent = `Vali veel ${2 - state.availableLabels.size} ${2 - state.availableLabels.size === 1 ? "märgend" : "märgendit"}. Märgendite loetelu määrab, milliseid erinevusi saab andmestikus talletada.`;
  } else if (!hasMissingInfoRoute()) {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Lisa vähemalt üks märgend puuduliku info käsitlemiseks: „Tavaplaan”, „Andmete täiendamine” või „Inimese ülevaatus”. Ilma selleta ei saa puuduliku juhtumi kohta järjepidevat otsust teha.";
  } else if (state.sources.size < 2) {
    feedback.className = "decision-feedback";
    feedback.textContent = `Vali samast andmestikust veel ${2 - state.sources.size} väli. Märgendaja ei saa arvestada infoga, mida märgendusfailis pole.`;
  } else if (!state.labelRule) {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Andmeväljad on valitud. Vali reegel, mis lähtub inimese praegusest dokumenteeritud vajadusest ja ühisest märgendusjuhisest.";
  } else if (state.labelRule !== "current") {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Iseteeninduse aktiivsus ei näita inimese toevajadust. Uus märgend peab põhinema praegusel dokumenteeritud olukorral ja märgendusjuhisel.";
  } else if (!state.missingPolicy || !state.disagreement || !state.audit) {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Vali veel, kuidas käsitleda puuduvat infot ja märgendajate eriarvamusi ning kuidas märgendusvalimit kontrollida.";
  } else if (state.missingPolicy !== "drop") {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Puuduliku info põhjal ei saa teha kindlat toevajaduse otsust. Suuna juhtum info täiendamisele.";
  } else if (state.disagreement !== "expert") {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Märgendajate eriarvamus tuleb lahendada põhjendatud eksperdiotsusega ja juhise ebaselgus dokumenteerida.";
  } else if (state.audit !== "coverage") {
    feedback.className = "decision-feedback warn";
    feedback.textContent = state.audit === "overall"
      ? "Juhtumite koguarv ei näita, kas mõni piirkond, keelerühm või teeninduskanal on valimist puudu."
      : "Täidetud lahtrid ei näita, kas valim katab erinevaid piirkondi, keeli ja teeninduskanaleid. Kontrolli korraga nii katvust kui ka puuduvaid väärtusi.";
  } else {
    const missingCoreLabels = ["fast", "standard"].filter(label => !state.availableLabels.has(label));
    const uncertaintyHidden = !state.availableLabels.has("review");
    const risky = missingCoreLabels.length || uncertaintyHidden || state.missingPolicy !== "drop" || state.disagreement !== "expert";
    feedback.className = risky ? "decision-feedback warn" : "decision-feedback good";
    if (missingCoreLabels.length) {
      feedback.textContent = `Juhisest puudub märgend „${labelNames[missingCoreLabels[0]]}”. Seda vajavad juhtumid tuleb suunata ülevaatusele või paigutada mõnda teise kategooriasse.`;
    } else if (uncertaintyHidden) {
      feedback.textContent = "Juhisest puudub märgend „Inimese ülevaatus”. Puudulikele ja vastuolulistele juhtumitele tuleb seetõttu anda kindel märgend või need märgendamisest eemaldada.";
    } else {
      feedback.textContent = risky
        ? "Andmed ja juhis on valmis, kuid valitud nõue võib anda puudulikule või vastuolulisele juhtumile põhjendamatult kindla märgendi."
        : "Märgendid, andmeväljad ja juhis on valmis. Järgmises etapis tohib märgendaja kasutada ainult seda infot, mida juhtumikaardil näeb.";
    }
  }
  $('[data-complete="1"]').disabled = !stageValid(1);
}

function renderLabelCase() {
  const container = $("#labelCase");
  const actions = $("#labelActions");
  const explanation = $("#labelExplanation");
  $("#labelProgress").textContent = `${state.labels.length} / ${labelCases.length} märgendatud`;
  $("#stage2Feedback").hidden = Boolean(state.pendingLabel);
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
    $("#nextLabelCase").textContent = state.labels.length === labelCases.length ? "Vaata märgenduse kokkuvõtet" : "Jätka järgmise juhtumiga";
  } else if (state.labels.length === labelCases.length) {
    const counts = Object.keys(labelNames).map(key => `${labelNames[key]}: ${state.labels.filter(value => value === key).length}`).join(" · ");
    const aligned = calculateLabelMetrics().aligned;
    container.innerHTML = `<div class="case-top"><span>MÄRGENDUS VALMIS</span><b>${labelCases.length} juhtumit</b></div><h4>${aligned}/${labelCases.length} märgendit vastas kinnitatud juhendile</h4><p>${counts}</p><div class="case-meta"><button class="inline-reset" type="button" data-relabel>Märgenda juhtumid uuesti</button></div>`;
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
  $('[data-complete="2"]').disabled = !stageValid(2);
}

function simulatedSuggestion(item, index) {
  const learnedLabel = state.labels[item.trainingIndex];
  if (learnedLabel) return labelNames[learnedLabel];
  return baselineSuggestion(item);
}

function renderOutputCase() {
  const container = $("#outputCase");
  const actions = $("#reviewActions");
  const explanation = $("#reviewExplanation");
  $("#reviewProgress").textContent = `${state.reviews.length} / ${outputCases.length} hinnatud`;
  if (state.pendingReview) {
    const { index, choice } = state.pendingReview;
    const item = outputCases[index];
    const suggestion = simulatedSuggestion(item, index);
    container.innerHTML = `<div class="case-top"><span>${item.id} · ${index + 1}/${outputCases.length}</span><b>${reviewNames[choice]}</b></div><h4>${item.title}</h4><p>${outputText(item)}</p><div class="output-recommendation"><span>MUDELI SOOVITUS · SINU MÄRGENDITE PÕHJAL</span><strong>${suggestion}</strong><div class="confidence-ring">${item.confidence}%</div></div>`;
    actions.hidden = true;
    explanation.hidden = false;
    const actionMeaning = {
      accept: "Soovitust kinnitades võtad selle eest vastutuse sina, mitte kindlusprotsent.",
      correct: "Parandus aitab seda juhtumit. Et sama viga ei korduks, lisa paranduse põhjus seirelogisse.",
      human: "Ametniku ülevaatus jätab ebakindluse nähtavaks, kuid selleks peab olema selge vastutaja ja tähtaeg."
    };
    $("#reviewExplanationTitle").textContent = reviewNames[choice];
    $("#reviewExplanationText").textContent = `${actionMeaning[choice]} ${item.impact}`;
    $("#nextReviewCase").textContent = state.reviews.length === outputCases.length ? "Vaata soovituste kokkuvõtet" : "Jätka järgmise soovitusega";
  } else if (state.reviews.length === outputCases.length) {
    const summary = Object.keys(reviewNames).map(key => `${reviewNames[key]}: ${state.reviews.filter(value => value === key).length}`).join(" · ");
    container.innerHTML = `<div class="case-top"><span>KONTROLL VALMIS</span><b>4 soovitust</b></div><h4>Ametniku otsused</h4><p>${summary}</p><div class="case-meta"><button class="inline-reset" type="button" data-rereview>Hinda soovitusi uuesti</button></div>`;
    actions.hidden = true;
    explanation.hidden = true;
    $$("#reviewActions button").forEach(button => { button.disabled = true; button.classList.remove("selected"); });
  } else {
    const item = outputCases[state.reviews.length];
    const suggestion = simulatedSuggestion(item, state.reviews.length);
    container.innerHTML = `<div class="case-top"><span>${item.id} · ${state.reviews.length + 1}/${outputCases.length}</span><b>TESTJUHTUM</b></div><h4>${item.title}</h4><p>${outputText(item)}</p><div class="output-recommendation"><span>MUDELI SOOVITUS · SINU MÄRGENDITE PÕHJAL</span><strong>${suggestion}</strong><div class="confidence-ring">${item.confidence}%</div></div><div class="impact-label"><b>KEDA MÕJUTAB?</b><span>${item.impact}</span></div>`;
    actions.hidden = false;
    explanation.hidden = true;
    $$("#reviewActions button").forEach(button => { button.disabled = false; button.classList.remove("selected"); });
  }
  $('[data-complete="3"]').disabled = !stageValid(3);
}

function updateStage4() {
  const unassigned = Object.values(state.ownership).filter(value => !value).length;
  const button = $('[data-complete="4"]');
  button.disabled = !stageValid(4);
  const feedback = $("#stage4Feedback");
  if (unassigned) {
    feedback.className = "decision-feedback";
    feedback.textContent = `Määra veel ${unassigned} vastutusala. Valik „amet ja arenduspartner ühiselt” eeldab ka kirjalikku rollijaotust.`;
  } else if (!state.cadence || !state.appeal || state.assets.size < 2) {
    feedback.className = "decision-feedback warn";
    feedback.textContent = "Vastutajad on määratud. Vali veel ülevaatamise sagedus, vaidlustamise kord ja vähemalt kaks materjali, mis jäävad ametile.";
  } else {
    const vendorCount = Object.values(state.ownership).filter(value => value === "vendor" || value === "none").length;
    const weakAppeal = state.appeal !== "owned";
    feedback.className = vendorCount || weakAppeal ? "decision-feedback warn" : "decision-feedback good";
    feedback.textContent = vendorCount ? "Valikud on tehtud, kuid vähemalt üks oluline teadmine jääb ainult arenduspartneri kätte või vastutajata." : weakAppeal ? "Valikud on tehtud, kuid vaidlustamise kord ei seo vigu selgelt ameti seire- ja parandustööga." : "Valikud on tehtud. Vastutus, vaidlustamise kord ja töö jätkamiseks vajalikud teadmised moodustavad terviku.";
  }
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
    ruleNote.textContent = "Aktiivsuse hulk ei näita, millist tuge inimene vajab. Kasuta praegust dokumenteeritud vajadust ja ühist märgendusjuhist.";
  } else if (rule === "current") {
    ruleNote.className = "availability-note good";
    ruleNote.textContent = "Õige: uus märgend põhineb praegusel dokumenteeritud infol ja kõigile märgendajatele ühisel juhisel.";
  } else {
    ruleNote.className = "availability-note";
    ruleNote.textContent = currentAvailable
      ? "Vali reegel, mis kasutab tänast dokumenteeritud vajadust. Iseteeninduse aktiivsus võib olla ainult taustainfo."
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
    auditNote.textContent = "Koguarv üksi ei näita, kelle juhtumid on valimist puudu.";
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
    missingFeedback.textContent = "Õige: juhtum saab märgendi „Andmete täiendamine” ja toevajadust ei otsustata enne info lisamist.";
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
    disagreementFeedback.textContent = "Sama juhtum kahe vastukäiva märgendiga muudaks treeningandmed vastuoluliseks.";
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

function updateLabelingBrief() {
  const brief = $("#labelingBrief");
  if (!brief) return;
  const fields = selectedFieldNames();
  const labels = Object.keys(labelNames).filter(key => state.availableLabels.has(key)).map(key => labelNames[key]);
  brief.innerHTML = fields.length
    ? `<span>KINNITATUD LÄHTEÜLESANNE</span><p><b>Lubatud märgendid:</b> ${labels.join(", ") || "määramata"}. <b>Nähtavad väljad:</b> ${fields.join(", ")}. <b>Reegel:</b> ${ruleNames[state.labelRule] || "määramata"}. <b>Puuduv info:</b> juhtum märgendatakse andmete täiendamiseks ja suunatakse info täiendamisele. Märgendaja tohib kasutada ainult kaardil kuvatud infot.</p>`
    : "";
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
  updateLabelingBrief();
  updateStage1Feedback();
  $("#stage2Feedback").className = stageValid(2) ? "decision-feedback good" : "decision-feedback";
  if (stageValid(2)) $("#stage2Feedback").textContent = `${calculateLabelMetrics().aligned}/${labelCases.length} märgendit vastab kinnitatud juhendile. Mudel õpib siiski kõigist viiest märgendist, ka ekslikest.`;
  $("#stage3Feedback").className = stageValid(3) ? "decision-feedback good" : "decision-feedback";
  if (stageValid(3)) $("#stage3Feedback").textContent = "Soovitused on üle vaadatud. Ülevaatuse reegel muudab mudeli ebakindluse nähtavaks ametniku tööks.";
  renderLabelCase();
  renderOutputCase();
  updateStage4();
  updateImpact();
  updateFocusState();
}

function updateFocusState() {
  const impactLocked = state.labels.length < labelCases.length;
  const impactCard = $("#impactCard");
  const impactPending = state.currentStage === 1 || (state.currentStage === 2 && impactLocked);
  impactCard.hidden = impactPending;
  $(".lab-grid").classList.toggle("impact-pending", impactPending);
  impactCard.classList.toggle("is-muted", impactLocked);
  impactCard.classList.toggle("is-labeling-locked", impactLocked);
  impactCard.setAttribute("aria-disabled", String(impactLocked));
  const impactLockedNotice = $("#impactLockedNotice");
  impactLockedNotice.hidden = !impactLocked;
  if (impactLocked) {
    const labelingStarted = state.completed.has(1);
    impactLockedNotice.querySelector("span").textContent = labelingStarted
      ? "MÕJUVADE AVANEB PÄRAST 5 MÄRGENDIT"
      : "MÕJUVADE POLE VEEL AVATUD";
    impactLockedNotice.querySelector("p").textContent = labelingStarted
      ? `Märgendasid ${state.labels.length}/${labelCases.length} juhtumit. Pärast viiendat märgendit näed, milliseid seoseid mudel sinu loodud treeningandmetest õpib ja kuidas tema soovitused muutuvad.`
      : "Kinnita esmalt andmed ja märgendusjuhis. Seejärel märgenda viis juhtumit.";
  }

  const stageDone = state.completed.has(state.currentStage);
  $(".control-card").classList.toggle("focus-active", !stageDone);
  $("#activeTaskCue").hidden = stageDone;
  if (stageDone) return;

  let title = "Tee järgmine valik";
  let detail = "Jätka selles paneelis. Siin on kõik selle etapi valikud.";
  if (state.currentStage === 1) {
    if (state.availableLabels.size < 2) {
      title = "Vali vähemalt 2 märgendit";
      detail = "Märgendid määravad, milliseid otsuseid saab märgendaja teha.";
    } else if (!hasMissingInfoRoute()) {
      title = "Lisa puuduliku info jaoks sobiv märgend";
      detail = "Vali „Tavaplaan”, „Andmete täiendamine” või „Inimese ülevaatus”.";
    } else if (state.sources.size < 2) {
      const remaining = 2 - state.sources.size;
      title = `Vali veel ${remaining} ${remaining === 1 ? "andmeväli" : "andmevälja"}`;
    }
    else if (!state.labelRule || state.labelRule !== "current") title = "Vali praegusel vajadusel põhinev märgendusreegel";
    else if (!state.missingPolicy || state.missingPolicy !== "drop") title = "Vali puuduliku info korral andmete täiendamine";
    else if (!state.disagreement || state.disagreement !== "expert") title = "Vali eriarvamuse lahendamiseks põhjendatud eksperdiotsus";
    else if (!state.audit) title = "Vali märgendusvalimi kontroll";
    else if (state.audit !== "coverage") title = "Vali kontroll, mis näitab valimi katvust ja puuduvaid andmeid";
    else title = "Kinnita andmed ja märgendusjuhis";
    if (impactLocked && state.availableLabels.size >= 2) detail = "Mõjuvaade avaneb pärast viie juhtumi märgendamist.";
  } else if (state.currentStage === 2) {
    if (state.pendingLabel) title = "Vaata tagasisidet ja jätka järgmise juhtumiga";
    else if (state.labels.length === labelCases.length) title = "Kinnita viie juhtumi märgendus";
    else title = `Märgenda juhtum ${state.labels.length + 1}/${labelCases.length}`;
    detail = impactLocked
      ? "Kasuta ainult juhtumikaardil nähtavat infot ja kinnitatud juhist. Mõjuvaade avaneb pärast viiendat märgendit."
      : "Kõik viis juhtumit on märgendatud. Vaata nüüd mõjuvaadet ja kinnita märgendus.";
  } else if (state.currentStage === 3) {
    if (!state.intervention) title = "Vali, millal ametnik peab soovituse üle vaatama";
    else if (state.pendingReview) title = "Vaata tagasisidet ja jätka järgmise soovitusega";
    else if (state.reviews.length === outputCases.length) title = "Kinnita soovituste kontroll";
    else title = `Hinda mudeli soovitust ${state.reviews.length + 1}/${outputCases.length}`;
    detail = "Kontrolli soovitust, selle alust ja mõju inimesele.";
  } else if (state.currentStage === 4) {
    const unassigned = Object.values(state.ownership).filter(value => !value).length;
    if (unassigned) title = `Määra veel ${unassigned} vastutusala`;
    else if (!state.cadence || !state.appeal || state.assets.size < 2) title = "Lõpeta jälgimise ja parandamise valikud";
    else title = "Koosta märgenduse kokkuvõte";
    detail = "Määra, kuidas vigu jälgitakse ja nende põhjal märgendusjuhist parandatakse.";
  }
  $("#activeTaskCue b").textContent = title;
  $("#activeTaskCue small").textContent = detail;
}

function updateNavigation() {
  $$(".step").forEach(button => {
    const stage = Number(button.dataset.step);
    button.disabled = stage > state.maxUnlocked;
    button.classList.toggle("active", stage === state.currentStage);
    button.classList.toggle("done", state.completed.has(stage));
    button.toggleAttribute("aria-current", stage === state.currentStage);
  });
  $$(".decision-stage").forEach(section => {
    const active = Number(section.dataset.stage) === state.currentStage;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  $("#stageCounter").textContent = `ETAPP ${state.currentStage} / 4`;
  $("#storyIndex").textContent = String(state.currentStage).padStart(2, "0");
  $("#storyText").innerHTML = stageCopy[state.currentStage].story;
  $("#progressText").textContent = state.completed.size === 4 ? "Märgenduse tulemus valmis" : stageCopy[state.currentStage].title;
  const progress = state.completed.size * 25;
  $("#progressValue").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#completedCount").textContent = state.completed.size;
  $("#previousStage").disabled = state.currentStage === 1;
  $("#nextStage").disabled = state.currentStage >= state.maxUnlocked || state.currentStage === 4;
  $("#lessonDots").innerHTML = [1,2,3,4].map(value => `<i class="${value === state.currentStage ? "active" : state.completed.has(value) ? "done" : ""}"></i>`).join("");
  updateFocusState();
}

function showStage(stage, shouldScroll = true) {
  if (stage > state.maxUnlocked) return;
  state.currentStage = stage;
  updateNavigation();
  updateImpact();
  if (shouldScroll) $(".stepper").scrollIntoView({ behavior: "smooth", block: "start" });
}

const dialogMessages = {
  1: { start: "Valis märgendid, andmed ja reegli", middle: "Valikutest sai märgendaja lähteülesanne", end: "Õpib nende põhjal loodud treeningandmetest", insight: "" },
  2: { start: "Märgendas viis juhtumit", middle: "Märgendatud juhtumitest said treeningandmed", end: "Õppis seoseid andmete ja soovituste vahel", insight: "Mudel ei tea, milline märgend oli ekslik. Ta õpib kõigist treeningandmetesse lisatud juhtumitest, mistõttu märgendaja järjepidevus mõjutab otseselt mudeli hilisemaid soovitusi." },
  3: { start: "Kontrollis nelja soovitust", middle: "Soovitused kinnitati, parandati või suunati ülevaatusele", end: "Vead ja ebakindlus muutusid nähtavaks", insight: "Soovituse parandamisest on pikemalt kasu siis, kui vea põhjus seotakse algse märgendi ja märgendusjuhisega." },
  4: { start: "Määras vastutajad ja parandamise korra", middle: "Vead seoti juhise ja õppeandmetega", end: "Järgmist versiooni saab vigade põhjal parandada", insight: "Juhise versioon, piirjuhtumite põhjendused ja kontrollitud testjuhtumid aitavad sama vea järgmises andme- või mudeliversioonis uuesti üles leida." }
};

function completeStage(stage) {
  if (!stageValid(stage)) return;
  state.completed.add(stage);
  if (stage < 4) state.maxUnlocked = Math.max(state.maxUnlocked, stage + 1);
  updateNavigation();
  updateImpact();
  const message = { ...dialogMessages[stage] };
  if (stage === 1) {
    const fields = selectedFieldNames();
    const labels = Object.keys(labelNames).filter(key => state.availableLabels.has(key)).map(key => labelNames[key]);
    message.middle = `Märgendaja saab kasutada ${labels.length} märgendit ja ${fields.length} andmevälja`;
    message.insight = `Valisid märgendid: ${labels.join(", ")}. Märgendajale kuvatakse väljad: ${fields.join(", ")}. Ta peab järgima reeglit „${ruleNames[state.labelRule]}”. Puuduvat märgendit ega juhtumikaardilt välja jäetud infot ei saa mudel hiljem õppida.`;
  }
  $("#dialogStage").textContent = `${stage} / 4`;
  $("#dialogStart").textContent = message.start;
  $("#dialogMiddle").textContent = message.middle;
  $("#dialogEnd").textContent = message.end;
  $("#dialogInsight").textContent = message.insight;
  $("#dialogContinue span").textContent = stage === 4 ? "Vaata märgenduse tulemust" : "Jätka järgmise etapiga";
  $("#impactDialog").dataset.completedStage = stage;
  $("#impactDialog").showModal();
  if (stage === 4) renderResults();
}

function renderResults() {
  const metrics = calculateLabelMetrics();
  const dominant = Object.entries(labelNames).map(([key, label]) => [key, label, metrics[key]]).sort((a, b) => b[2] - a[2])[0];
  let title = "Mitmekesine ja ebakindlust säilitav märgendus";
  if (metrics.aligned <= 2) title = "Märgendus õpetab mudelile juhisega vastuolulisi seoseid";
  else if (dominant[2] >= 3) title = "Ühe kategooria poole kaldu märgendus";
  else if (metrics.review + metrics.supplement === 0) title = "Kindel märgendus, mis peidab piirjuhtumeid";
  else if (metrics.categories < 3) title = "Kitsas märgendus, millest puudub üks võimalik soovitus";
  $("#profileTitle").textContent = title;
  const selectedCounts = Object.keys(labelNames)
    .filter(key => state.availableLabels.has(key))
    .map(key => `${metrics[key]} „${labelNames[key]}”`);
  $("#profileText").textContent = `Märgendasid viis juhtumit: ${selectedCounts.join(", ")}. Kinnitatud juhendile vastas ${metrics.aligned}/${labelCases.length} märgendit. Sinu loodud treeningandmed muutsid varasema mudeliga võrreldes ${metrics.changedOutputs}/4 testsoovitust.`;
  const tags = [
    `${labelCases.length} treeningandmetesse lisatud juhtumit`,
    `${state.availableLabels.size} kasutatavat märgendit`,
    `${metrics.aligned}/${labelCases.length} juhisega kooskõlas`,
    `${metrics.changedOutputs}/4 mudeli soovitust muutus`,
    `${metrics.review} ülevaatusele ja ${metrics.supplement} täiendamisele`,
    state.appeal === "owned" ? "parandus jõuab seirelogisse" : "tagasisideahel vajab täpsustamist"
  ];
  $("#profileTags").innerHTML = tags.map(value => `<span>${value}</span>`).join("");
  const attentionCount = metrics.review + metrics.supplement;
  const tradeoffs = [
    ["1", "Juhise järjepidevus", metrics.aligned === labelCases.length ? "Kasutasid kinnitatud juhist kõigi juhtumite puhul järjepidevalt. See ei tõesta, et juhis ise on hea, kuid teeb andmestiku tähenduse kontrollitavaks." : `${labelCases.length - metrics.aligned} märgendit erines kinnitatud juhendist. Mudel ei oska neid eksimuseks pidada, vaid õpib neist samamoodi nagu teistest näidetest.`],
    ["2", "Ebakindluse säilitamine", attentionCount ? `${metrics.supplement} juhtumit vajab andmete täiendamist ja ${metrics.review} ametniku ülevaatust. Nii ei muutu puudulik või vastuoluline info põhjendamatult kindlaks teenuseotsuseks.` : "Kõik juhtumid said kindla teenusemärgendi. See teeb andmestiku lihtsamaks, kuid peidab puuduliku ja vastuolulise info."],
    ["3", "Märgendist soovituseni", `${metrics.changedOutputs}/4 testsoovitust muutus sinu märgendite mõjul. See näitab, kuidas andmetöö võib muuta mudeli käitumist ka mudeli ehitust muutmata.`],
    ["4", "Parandus jõuab treeningandmetesse", state.appeal === "owned" ? "Vaidlustatud soovituse põhjus jõuab seirelogisse ning võib muuta juhist, testjuhtumeid ja andmestiku järgmist versiooni." : "Üksik viga võib saada lahenduse, kuid selle põhjus ei pruugi järgmisse märgendusvooru jõuda."]
  ];
  $("#tradeoffList").innerHTML = tradeoffs.map(([index, heading, text]) => `<article><span>${index}</span><div><b>${heading}</b><p>${text}</p></div></article>`).join("");
  const interventionNames = { low: "kindlus alla 50%", medium: "kindlus või vastuolu", group: "kindlus, vastuolu või rühmapõhine veamuster", none: "soovituse kasutamine ilma eelkontrollita" };
  const appealNames = { helpdesk: "üldine infokanal", vendor: "arenduspartnerile saadetav veateade", owned: "ameti vaidlustamise ja parandamise kord" };
  const disagreementNames = { first: "esimese märgendaja valik", both: "kaks vastukäivat märgendit", expert: "valdkonnaspetsialisti põhjendatud lõppotsus" };
  const missingNames = { drop: "puudulik juhtum suunatakse info täiendamisele", average: "puuduliku info korral kasutatakse vaikimisi tavaplaani", guess: "puuduliku info põhjal valitakse tõenäolisim märgend" };
  const auditNames = { overall: "ainult juhtumite koguarv", technical: "ainult täidetud lahtrid", coverage: "piirkonna, keele, kanali ja puuduvate andmete kontroll" };
  const internalOwners = Object.values(state.ownership).filter(value => value === "internal" || value === "shared").length;
  $("#traceFlow").innerHTML = [
    ["1 · ANDMED + JUHIS", selectedFieldNames().join(", "), `Märgendid: ${Object.keys(labelNames).filter(key => state.availableLabels.has(key)).map(key => labelNames[key]).join(", ")}; ${missingNames[state.missingPolicy]}; ${ruleNames[state.labelRule]}`],
    ["2 · MÄRGENDAMISTÖÖ", `${metrics.aligned}/${labelCases.length} juhisega kooskõlas`, `${state.labels.length} treeningandmetesse lisatud juhtumit; ${disagreementNames[state.disagreement]}`],
    ["3 · SOOVITUS", interventionNames[state.intervention], `${state.reviews.length} soovitust hinnatud; ametnikule suunati ${state.reviews.filter(value => value === "human").length}`],
    ["4 · KONTROLL", `Amet osaleb ${internalOwners}/4 vastutusala töös`, appealNames[state.appeal]]
  ].map(([step, heading, detail]) => `<article><span>${step}</span><b>${heading}</b><small>${detail}</small></article>`).join("");
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
$("#interventionRule").addEventListener("change", () => { invalidateFrom(3); updateControls(); });
[$("#maintenanceCadence"), $("#appealPolicy")].forEach(select => select.addEventListener("change", () => { invalidateFrom(4); updateControls(); }));

$("#labelActions").addEventListener("click", event => {
  const button = event.target.closest("button[data-label]");
  if (!button || button.disabled || state.pendingLabel) return;
  invalidateFrom(2);
  const index = state.labels.length;
  const choice = button.dataset.label;
  const item = labelCases[index];
  const ideal = idealLabel(item);
  const idealAvailable = state.availableLabels.has(ideal);
  state.labels.push(choice);
  state.pendingLabel = { index, choice };
  const message = !idealAvailable
    ? `Juhisest puudub vajalik märgend „${labelNames[ideal]}”.`
    : choice === ideal
      ? `Õige märgend: „${labelNames[ideal]}”.`
      : `Vale märgend. Õige vastus: „${labelNames[ideal]}”; sinu valik: „${labelNames[choice]}”.`;
  $("#stage2Feedback").textContent = message;
  updateControls();
});

$("#nextLabelCase").addEventListener("click", () => {
  state.pendingLabel = null;
  if (state.labels.length < labelCases.length) $("#stage2Feedback").textContent = `Märgenda juhtum ${state.labels.length + 1}/${labelCases.length}. Kasuta kaardil näidatud kinnitatud reeglit.`;
  updateControls();
  $("#labelCase").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#undoLabelChoice").addEventListener("click", () => {
  if (!state.pendingLabel) return;
  state.labels.pop();
  state.pendingLabel = null;
  $("#stage2Feedback").textContent = "Vali sellele juhtumile uus märgend. Kasuta ainult kaardil nähtavat infot ja kinnitatud juhist.";
  updateControls();
});

$("#labelCase").addEventListener("click", event => {
  if (!event.target.closest("[data-relabel]")) return;
  invalidateFrom(2); state.labels = []; state.pendingLabel = null; updateControls();
});

$("#reviewActions").addEventListener("click", event => {
  const button = event.target.closest("button[data-review]");
  if (!button || button.disabled || state.pendingReview) return;
  invalidateFrom(3);
  const index = state.reviews.length;
  const choice = button.dataset.review;
  state.reviews.push(choice);
  state.pendingReview = { index, choice };
  const ideal = outputCases[index].expected;
  $("#stage3Feedback").textContent = choice === ideal ? "See valik vastab juhtumi peamisele kontrollivajadusele." : choice === "human" ? "Ametnikule suunamine jätab ebakindluse nähtavaks, kuid kasvatab töömahtu." : "See valik võib olla põhjendatud. Säilita põhjendus ja jälgi, kas sama viga kordub sarnaste juhtumite puhul.";
  updateControls();
});

$("#nextReviewCase").addEventListener("click", () => {
  state.pendingReview = null;
  updateControls();
  $("#outputCase").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#outputCase").addEventListener("click", event => {
  if (!event.target.closest("[data-rereview]")) return;
  invalidateFrom(3); state.reviews = []; state.pendingReview = null; renderOutputCase(); updateImpact();
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

$("#dialogContinue").addEventListener("click", () => {
  const stage = Number($("#impactDialog").dataset.completedStage);
  $("#impactDialog").close();
  if (stage < 4) showStage(stage + 1);
  else $("#resultSection").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#resetButton").addEventListener("click", resetSimulation);

updateNavigation();
updateControls();
