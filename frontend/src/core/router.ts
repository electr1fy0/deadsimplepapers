import { renderHome } from "../pages/home.js";
import { renderCourse } from "../pages/course.js";
import { initializeTheme } from "../state/theme.js";

type RouteFunction = () => void;

const routes: Record<string, RouteFunction> = {
  "/": renderHome,
  "/course": renderCourse,
};

export function navigate(path: string): void {
  window.history.pushState({}, "", path);
  route();
}

export function route(): void {
  const path: string = window.location.pathname;
  const render: RouteFunction = routes[path] || routes["/"];
  render();
  initializeTheme();
}

window.addEventListener("popstate", () => {
  route();
});
