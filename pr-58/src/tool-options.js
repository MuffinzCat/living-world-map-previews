const toolbars = [...document.querySelectorAll(".tool-options-toolbar")];

function hideOtherToolbars(activeToolbar) {
  toolbars.forEach(toolbar => {
    if (toolbar === activeToolbar) return;
    toolbar.hidden = true;
    toolbar.classList.remove("is-open");
  });
}

export function showToolOptions(toolbar) {
  const switching = toolbar.dataset.switching === "true";
  delete toolbar.dataset.switching;
  hideOtherToolbars(toolbar);
  if (switching) toolbar.style.animation = "none";
  toolbar.hidden = false;
  toolbar.classList.add("is-open");
  if (switching) requestAnimationFrame(() => toolbar.style.removeProperty("animation"));
}

export function hideToolOptions(toolbar) {
  toolbar.hidden = true;
  toolbar.classList.remove("is-open");
}

document.addEventListener("click", event => {
  const trigger = event.target.closest("button[aria-controls]");
  const target = trigger && document.getElementById(trigger.getAttribute("aria-controls"));
  if (!target?.classList.contains("tool-options-toolbar")) return;
  const visibleToolbar = toolbars.find(toolbar => !toolbar.hidden);
  if (visibleToolbar && visibleToolbar !== target) target.dataset.switching = "true";
}, true);
