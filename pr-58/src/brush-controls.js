const brushButton = document.querySelector("#brush-mode");
const brushControls = document.querySelector("#brush-controls");

function syncBrushToolbar() {
  const open = brushButton.getAttribute("aria-pressed") === "true";
  brushControls.hidden = !open;
  brushButton.setAttribute("aria-expanded", String(open));
}

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
