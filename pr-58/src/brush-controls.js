import { hideToolOptions, showToolOptions } from "./tool-options.js";

const brushButton = document.querySelector("#brush-mode");
const brushControls = document.querySelector("#brush-controls");
const modeButtons = [...document.querySelectorAll("button[data-mode]")];

function syncBrushToolbar() {
  const open = brushButton.getAttribute("aria-pressed") === "true";
  if (open) showToolOptions(brushControls);
  else hideToolOptions(brushControls);
  brushButton.setAttribute("aria-expanded", String(open));
}

modeButtons.forEach(button => {
  button.addEventListener("click", () => setTimeout(syncBrushToolbar));
});

document.querySelectorAll("button[data-placement]").forEach(button => {
  button.addEventListener("click", () => setTimeout(syncBrushToolbar));
});

new MutationObserver(syncBrushToolbar).observe(brushButton, {
  attributes: true,
  attributeFilter: ["aria-pressed"],
});

syncBrushToolbar();

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !brushControls.hidden) {
    document.querySelector('button[data-mode="pan"]')?.click();
    brushButton.focus();
  }
});
