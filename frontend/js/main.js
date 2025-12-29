import { route } from "./core/router.js";
import { initializeTheme } from "./state/theme.js";

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  route();
});
