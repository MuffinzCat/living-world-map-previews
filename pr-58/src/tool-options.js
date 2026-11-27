const toolbar = document.querySelector("#tool-options-toolbar");
const contents = [...toolbar.querySelectorAll(".tool-options-content")];
const brushContent = document.querySelector("#brush-controls");
const placementContent = document.querySelector("#placement-controls");
let activeContent = null;

export function showToolOptions(content) {
  const opening = toolbar.hidden;
  contents.forEach(item => { item.hidden = item !== content; });
  toolbar.classList.toggle("animate-open", opening);
  toolbar.hidden = false;
  activeContent = content;
}

export function hideToolOptions(content) {
  if (activeContent !== content) return;
  content.hidden = true;
  toolbar.hidden = true;
  toolbar.classList.remove("animate-open");
  activeContent = null;
}

export function isToolOptionsVisible(content) {
  return !toolbar.hidden && activeContent === content;
}

document.addEventListener("click", event => {
  const trigger = event.target.closest("#brush-mode, button[data-placement]");
  if (!trigger) return;
  showToolOptions(trigger.id === "brush-mode" ? brushContent : placementContent);
});
