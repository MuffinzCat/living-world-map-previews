const brushButton = document.querySelector("#brush-mode");
const brushControls = document.querySelector("#brush-controls");

function setBrushFlyout(open) {
  brushControls.hidden = !open;
  brushButton.setAttribute("aria-expanded", String(open));
}

document.querySelectorAll("button[data-mode]").forEach(button => {
  button.addEventListener("click", () => setBrushFlyout(button === brushButton));
});
document.querySelectorAll("button[data-placement]").forEach(button => {
  button.addEventListener("click", () => setBrushFlyout(false));
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !brushControls.hidden) {
    setBrushFlyout(false);
    brushButton.focus();
  }
});
