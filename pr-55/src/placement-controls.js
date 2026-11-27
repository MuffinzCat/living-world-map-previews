const placementFlyout = document.querySelector("#placement-controls");
const placementTitle = document.querySelector("#placement-title");
const settlementFields = document.querySelector("#settlement-fields");
const placementButtons = [...document.querySelectorAll("button[data-placement]")];
let activeButton = null;

function closePlacementFlyout() {
  placementFlyout.hidden = true;
  activeButton?.setAttribute("aria-expanded", "false");
  activeButton = null;
}

function openPlacementFlyout(button) {
  activeButton?.setAttribute("aria-expanded", "false");
  activeButton = button;
  const settlement = button.dataset.placement === "settlement";
  placementTitle.textContent = settlement ? "Place settlement" : "Place mountain";
  settlementFields.hidden = !settlement;
  button.parentElement.append(placementFlyout);
  placementFlyout.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

placementButtons.forEach(button => {
  button.addEventListener("click", () => openPlacementFlyout(button));
  new MutationObserver(() => {
    if (button === activeButton && button.getAttribute("aria-pressed") === "false") closePlacementFlyout();
  }).observe(button, { attributes: true, attributeFilter: ["aria-pressed"] });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !placementFlyout.hidden) {
    const returnFocus = activeButton;
    closePlacementFlyout();
    returnFocus?.focus();
  }
});
