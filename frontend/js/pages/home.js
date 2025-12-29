import { renderDialog } from "../components/dialog.js";
import { navigate } from "../core/router.js";
import { initializeTheme } from "../state/theme.js";

const API_BASE = window.APP_CONFIG.API_BASE;

let allCourses = [];

export async function initializeCourseList() {
  const searchInput = document.getElementById("search-bar");

  await fetchCourses();

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }
}

async function fetchCourses() {
  try {
    const res = await fetch(`${API_BASE}/courses`);
    allCourses = await res.json();
    renderCourses(allCourses);
  } catch (err) {
    console.error("Failed to fetch courses:", err);
    const list = document.getElementById("matched-courses");
    if (list) list.innerHTML = '<li class="error">Failed to load courses</li>';
  }
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();

  if (!query) {
    renderCourses(allCourses);
    return;
  }

  const filtered = allCourses.filter(
    (c) =>
      c.course_title.toLowerCase().includes(query) ||
      (c.course_code && c.course_code.toLowerCase().includes(query)),
  );
  renderCourses(filtered);
}

function renderCourses(courses) {
  let itemCount = 0;
  const list = document.getElementById("matched-courses");
  if (!list) return;

  list.innerHTML = "";
  courses.forEach((course) => {
    if (itemCount < 5) list.appendChild(createCourseListItem(course));
    itemCount++;
  });
}

function createCourseListItem(course) {
  const li = document.createElement("li");
  li.style.cursor = "pointer";

  li.onclick = () => {
    navigate(`/course?course_title=${encodeURIComponent(course.course_title)}`);
  };

  const codeTag = course.course_code
    ? `<span class="course-code">${course.course_code}</span>`
    : "";

  li.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.5 16.9286V10C20.5 6.22876 20.5 4.34315 19.3284 3.17157C18.1569 2 16.2712 2 12.5 2H11.5C7.72876 2 5.84315 2 4.67157 3.17157C3.5 4.34315 3.5 6.22876 3.5 10V19.5" />
            <path d="M20.5 17H6C4.61929 17 3.5 18.1193 3.5 19.5C3.5 20.8807 4.61929 22 6 22H20.5" />
            <path d="M20.5 22C19.1193 22 18 20.8807 18 19.5C18 18.1193 19.1193 17 20.5 17" />
        </svg>
        <span class="course-name">${course.course_title}</span>
        ${codeTag}
        <small class="paper-count">${course.paper_count}</small>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" />
        </svg>
    `;

  return li;
}

export function initializeUploadDialog() {
  const triggerBtn = document.getElementById("upload-btn");
  const dialog = document.getElementById("upload-dialog");
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("file");
  const fileNameDisplay = document.querySelector(".fileName");
  const cancelBtn = document.querySelector(".cancel-btn");

  if (!dialog) return;

  const open = () => dialog.showModal();
  const close = () => {
    dialog.close();
    if (form) form.reset();
    if (fileNameDisplay) fileNameDisplay.textContent = "";
  };

  if (triggerBtn) triggerBtn.addEventListener("click", open);
  if (cancelBtn) cancelBtn.addEventListener("click", close);

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      close();
    }
  });

  if (fileInput && fileNameDisplay) {
    fileInput.addEventListener("change", () => {
      fileNameDisplay.textContent =
        fileInput.files.length > 0 ? fileInput.files[0].name : "";
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => handleUpload(e, form, close));
  }
}

async function handleUpload(e, form, closeCallback) {
  e.preventDefault();

  const submitBtn = form.querySelector(".confirm-btn");
  const originalText = submitBtn.textContent;
  const formData = new FormData(form);

  try {
    submitBtn.textContent = "Processing...";
    submitBtn.disabled = true;

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (res.ok) {
      alert(data?.message || "Upload successful!");
      closeCallback();
      fetchCourses();
    } else {
      alert("Upload failed: " + (data?.message || text));
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("Error: " + err.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

let cleanup = null;

export function renderHome() {
  const app = document.getElementById("app");
  if (cleanup) cleanup();

  app.innerHTML = `

    <header>
              <!-- File Upload button -->
              <button type="button" id="upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 14.5L12 4.5M12 4.5L15 7.5M12 4.5L9 7.5" />
                      <path d="M20 16.5C20 18.982 19.482 19.5 17 19.5H7C4.518 19.5 4 18.982 4 16.5" </svg>
                          <span>Submit</span>
              </button>
              <!-- Dark Mode toggle -->
              <button type="button" id="theme-toggle" title="Toggle theme">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                      class="sun-icon">
                      <circle cx="12" cy="12" r="4" />
                      <path
                          d="M12 2V4M12 20V22M4 12H2M22 12H20M19.778 4.222L17.556 6.444M6.444 17.556L4.222 19.778M4.222 4.222L6.444 6.444M17.556 17.556L19.778 19.778" />
                  </svg>
              </button>
          </header>

          <!-- Upload dialog -->
          <dialog id="upload-dialog">

          </dialog>
          <div class="main-ui">
              <h1>Dead Simple Papers</h1>
              <h2>VIT Previous Year Papers without the noise.</h2>
              <div id="search-area">
                  <form action="/search">
                      <fieldset>
                          <!-- Search Bar -->
                          <div class="search-bar-container">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
                                  fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                                  stroke-linejoin="round">
                                  <path d="M17.5 17.5L22 22" />
                                  <path
                                      d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z" />
                              </svg>
                              <input type="text" name="course" placeholder="Search courses..." id="search-bar" />
                          </div>
                      </fieldset>
                  </form>
                  <ol id="matched-courses"></ol>
              </div>
          </div>`;

  initializeCourseList();
  initializeUploadDialog();
  renderDialog();
  initializeTheme();
}
