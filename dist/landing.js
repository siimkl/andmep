(() => {
  "use strict";
  const options = {
    api1: { label: "API 1 · Saada päring. Loe vastust.", button: "Alusta API 1 praktikumi" },
    api2: { label: "API 2 · Töötle API-andmeid RStudios", button: "Alusta API 2 praktikumi" },
    api3: { label: "API 3 · Ühenda tehisaru API oma rakendusega", button: "Alusta API 3 praktikumi" },
    kraapimine: { label: "Veebikraapimine · Muuda veebileht andmetabeliks", button: "Alusta veebikraapimise praktikumi" },
    "ai-andmetoo": { label: "AI andmetöö · Kes õpetab tehisaru?", button: "Alusta AI-andmetöö praktikumi" }
  };
  const radios = [...document.querySelectorAll('input[name="api-version"]')];
  const selectedLabel = document.querySelector("#selectedLabel");
  const startButton = document.querySelector("#startButton");

  function updateSelection(value) {
    const selected = options[value] || options.api1;
    selectedLabel.textContent = selected.label;
    startButton.href = `./${value}/`;
    startButton.querySelector("span").textContent = selected.button;
  }

  radios.forEach((radio) => radio.addEventListener("change", () => updateSelection(radio.value)));
  updateSelection(radios.find((radio) => radio.checked)?.value || "api1");
})();
