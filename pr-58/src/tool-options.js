const toolbars = [...document.querySelectorAll(".tool-options-toolbar")];
let visibleToolbar = toolbars.find(toolbar => !toolbar.hidden) ?? null;

function hideOtherToolbars(activeToolbar) {
  toolbars.forEach(toolbar => {
    if (toolbar === activeToolbar) return;
    toolbar.hidden = true;
    toolbar.classList.remove("is-open", "animate-open");
  });
}

export function showToolOptions(toolbar) {
  const switching = visibleToolbar !== null && visibleToolbar !== toolbar;
  hideOtherToolbars(toolbar);
  toolbar.classList.toggle("animate-open", !switching && toolbar.hidden);
  toolbar.hidden = false;
  toolbar.classList.add("is-open");
  visibleToolbar = toolbar;
}

export function hideToolOptions(toolbar) {
  toolbar.hidden = true;
  toolbar.classList.remove("is-open", "animate-open");
  if (visibleToolbar === toolbar) visibleToolbar = null;
}
