import { renderHome } from "../pages/home.js";
import { renderCourse } from "../pages/course.js";
import { initializeTheme } from "../state/theme.js";

const routes = {
  "/": renderHome,
  "/course": renderCourse,
};

export function navigate(path) {
  window.history.pushState({}, "", path);
  route();
}

export function route() {
  const path = window.location.pathname;
  const render = routes[path] || routes["/"];
  render();
  initializeTheme();
}

window.addEventListener("popstate", () => {
  route();
});
