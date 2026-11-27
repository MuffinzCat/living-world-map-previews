import "./history-controls.js";
import { isToolOptionsVisible } from "./tool-options.js";

const brushButton = document.querySelector("#brush-mode");
const brushControls = document.querySelector("#brush-controls");
const modeButtons = [...document.querySelectorAll("button[data-mode]")];

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && isToolOptionsVisible(brushControls)) {
    document.querySelector('button[data-mode="pan"]')?.click();
    brushButton.focus();
  }
});
