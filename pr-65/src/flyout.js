const flyout = document.querySelector("#json-flyout");
const openButton = document.querySelector("#open-json");
const closeButton = document.querySelector("#close-json");
const applyButton = document.querySelector("#apply-json");
const map = document.querySelector("#map");
const mapFrame = document.querySelector(".map-frame");

function openFlyout() {
  flyout.show();
  document.body.classList.add("json-flyout-open");
  openButton.setAttribute("aria-expanded", "true");
  document.querySelector("#world-data").focus();
}

function closeFlyout() {
  flyout.close();
  document.body.classList.remove("json-flyout-open");
  openButton.setAttribute("aria-expanded", "false");
  openButton.focus();
}

function updateMapAspectRatio() {
  const values = map.getAttribute("viewBox")?.split(/\s+/).map(Number);
  if (!values || values.length !== 4 || !values[2] || !values[3]) return;
  mapFrame.style.setProperty("--map-aspect", `${values[2]} / ${values[3]}`);
}

openButton.addEventListener("click", openFlyout);
closeButton.addEventListener("click", closeFlyout);
applyButton.addEventListener("click", () => {
  updateMapAspectRatio();
  closeFlyout();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && flyout.open) {
    event.preventDefault();
    closeFlyout();
  }
});

new MutationObserver(updateMapAspectRatio).observe(map, { attributes: true, attributeFilter: ["viewBox"] });
updateMapAspectRatio();
