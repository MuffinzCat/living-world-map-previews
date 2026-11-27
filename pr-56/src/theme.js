const STORAGE_KEY = "living-world-map-theme";
const root = document.documentElement;
const toggle = document.querySelector("#theme-toggle");

function currentTheme() {
  return root.dataset.theme === "dark" ? "dark" : "light";
}

function updateToggle() {
  const dark = currentTheme() === "dark";
  toggle.setAttribute("aria-pressed", String(dark));
  toggle.textContent = dark ? "Light interface" : "Dark interface";
  toggle.setAttribute("aria-label", `Use ${dark ? "light" : "dark"} interface theme`);
}

function setTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  updateToggle();
}

toggle.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
updateToggle();
