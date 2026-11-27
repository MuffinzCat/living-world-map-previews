const brushButton = document.querySelector("#brush-mode");
const brushControls = document.querySelector("#brush-controls");
const modeButtons = [...document.querySelectorAll("button[data-mode]")];

function syncBrushToolbar() {
  const open = brushButton.getAttribute("aria-pressed") === "true";
  brushControls.toggleAttribute("hidden", !open);
  brushControls.classList.toggle("is-open", open);
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
  if (event.key === "Escape" && brushControls.classList.contains("is-open")) {
    document.querySelector('button[data-mode="pan"]')?.click();
    brushButton.focus();
  }
});
