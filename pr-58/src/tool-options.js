const toolbars = [...document.querySelectorAll(".tool-options-toolbar")];
let visibleToolbar = toolbars.find(toolbar => !toolbar.hidden) ?? null;
let pendingSwitchTarget = null;

function hideOtherToolbars(activeToolbar) {
  toolbars.forEach(toolbar => {
    if (toolbar === activeToolbar) return;
    toolbar.hidden = true;
    toolbar.classList.remove("is-open", "animate-open");
  });
}

export function showToolOptions(toolbar) {
  const switching = pendingSwitchTarget === toolbar;
  pendingSwitchTarget = null;
  hideOtherToolbars(toolbar);
  toolbar.classList.toggle("animate-open", !switching && toolbar.hidden);
  toolbar.hidden = false;
  toolbar.classList.add("is-open");
  visibleToolbar = toolbar;
}

export function hideToolOptions(toolbar) {
  toolbar.hidden = true;
  toolbar.classList.remove("is-open", "animate-open");
  if (visibleToolbar === toolbar && pendingSwitchTarget === null) visibleToolbar = null;
}

document.addEventListener("click", event => {
  const trigger = event.target.closest("button[aria-controls]");
  const target = trigger && document.getElementById(trigger.getAttribute("aria-controls"));
  if (!target?.classList.contains("tool-options-toolbar")) return;
  if (visibleToolbar && visibleToolbar !== target) pendingSwitchTarget = target;
}, true);
