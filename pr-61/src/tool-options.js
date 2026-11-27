const toolbar = document.querySelector("#tool-options-toolbar");
function getContents() { return [...toolbar.querySelectorAll(".tool-options-content")]; }
const contentByTrigger = new Map([
  ['button[data-mode="select"]', "selection-controls"],
  ["#brush-mode", "brush-controls"],
  ["#roads-mode", "roads-controls"],
  ["#add-settlement", "placement-controls"],
  ["#add-mountain", "placement-controls"],
]);
let activeContent = null;
let activeTrigger = null;

export function showToolOptions(content, trigger = null) {
  const opening = toolbar.hidden;
  getContents().forEach(item => { item.hidden = item !== content; });
  toolbar.classList.toggle("animate-open", opening);
  toolbar.hidden = false;
  activeContent = content;
  activeTrigger = trigger;
  syncTriggerStates();
}

export function hideToolOptions(content) {
  if (activeContent !== content) return;
  content.hidden = true;
  toolbar.hidden = true;
  toolbar.classList.remove("animate-open");
  activeContent = null;
  activeTrigger = null;
  syncTriggerStates();
}

export function isToolOptionsVisible(content) {
  return !toolbar.hidden && activeContent === content;
}
function syncTriggerStates() {
  document.querySelectorAll('[aria-controls="tool-options-toolbar"], [aria-controls="brush-controls"], [aria-controls="roads-controls"], [aria-controls="selection-controls"]').forEach(trigger => {
    const open = activeTrigger === trigger;
    trigger.setAttribute("aria-expanded", String(open));
    if (trigger.id === "roads-mode" || trigger.id === "brush-mode" || trigger.matches("[data-placement]")) {
      trigger.setAttribute("aria-pressed", String(open));
    }
  });
}

document.addEventListener("click", event => {
  const trigger = event.target.closest('[data-mode="select"], [data-mode="brush"], [data-mode="pan"], [data-placement], #roads-mode');
  if (!trigger) return;
  if (trigger.matches('[data-mode="pan"]')) {
    hideToolOptions(activeContent);
    return;
  }
  const contentId = [...contentByTrigger].find(([selector]) => trigger.matches(selector))?.[1];
  const content = contentId ? document.querySelector(`#${contentId}`) : null;
  if (content) showToolOptions(content, trigger);
});
