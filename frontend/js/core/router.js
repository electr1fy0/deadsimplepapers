import { renderHome } from "../pages/home.js";
import { renderCourse } from "../pages/course.js";

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
}

window.addEventListener("popstate", () => {
  route();
});
