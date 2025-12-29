const API_BASE = window.APP_CONFIG.API_BASE;
document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializeCourseList();
  initializeUploadDialog();
});

function initializeTheme() {
  const currentTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const toggleBtn = document.getElementById("theme-toggle");

  if (currentTheme === "dark" || (!currentTheme && prefersDark.matches)) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const newTheme = document.body.classList.contains("dark-mode")
        ? "dark"
        : "light";
      localStorage.setItem("theme", newTheme);
    });
  }
}

let allCourses = [];

async function initializeCourseList() {
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
    window.location.href = `./course.html?course_title=${encodeURIComponent(course.course_title)}`;
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

function initializeUploadDialog() {
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
