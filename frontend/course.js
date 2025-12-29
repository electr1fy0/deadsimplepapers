const API_BASE = window.APP_CONFIG.API_BASE;

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializePapers();
  initializeCommandPalette();
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

function formatYear(year) {
  const y = parseInt(year, 10);
  if (isNaN(y)) return year;
  return `${y}-${String(y + 1).slice(-2)}`;
}

let allPapers = [];
let currentCourseCode = "";

async function initializePapers() {
  const urlParams = new URLSearchParams(window.location.search);
  const courseQuery = urlParams.get("course_title");
  const courseTitle = document.getElementById("course-title");

  if (courseQuery) {
    if (courseTitle) courseTitle.textContent = courseQuery;
    await fetchPapers(courseQuery);
  } else {
    if (courseTitle) courseTitle.textContent = "All Papers";
    await fetchPapers();
  }

  initializeFilters();
}

async function fetchPapers(course = "") {
  const courseSubtitle = document.getElementById("course-subtitle");
  const papersList = document.getElementById("papers-list");

  try {
    let url = `${API_BASE}/papers`;
    if (course) url += `?course_title=${encodeURIComponent(course)}`;

    const res = await fetch(url);
    allPapers = (await res.json()) || [];

    if (allPapers.length > 0 && allPapers[0].course_code) {
      currentCourseCode = allPapers[0].course_code;
      if (courseSubtitle) courseSubtitle.textContent = currentCourseCode;
    } else {
      if (courseSubtitle)
        courseSubtitle.textContent = `${allPapers.length} papers available`;
    }

    updateFilterCounts();
    renderPapers();
  } catch (err) {
    console.error("Failed to fetch papers:", err);
    if (papersList)
      papersList.innerHTML = '<li class="error">Failed to load papers</li>';
  }
}

function renderPapers() {
  const papersList = document.getElementById("papers-list");
  if (!papersList) return;

  const filters = getActiveFilters();
  const filtered = allPapers.filter((paper) => {
    const typeMatch =
      filters.type.length === 0 ||
      filters.type.includes(paper.type.toLowerCase());
    const yearMatch =
      filters.semester_name.length === 0 ||
      filters.semester_name.includes(paper.semester_name);
    const slotMatch =
      filters.slot.length === 0 ||
      filters.slot.includes(paper.slot.toLowerCase());
    return typeMatch && yearMatch && slotMatch;
  });

  papersList.innerHTML = "";
  filtered.forEach((paper, index) => {
    papersList.appendChild(createPaperListItem(paper, index));
  });
}

function getDonePapers() {
  try {
    return JSON.parse(localStorage.getItem("vitpapers_done")) || [];
  } catch {
    return [];
  }
}

function togglePaperDone(filename) {
  const done = getDonePapers();
  const index = done.indexOf(filename);
  if (index === -1) {
    done.push(filename);
  } else {
    done.splice(index, 1);
  }
  localStorage.setItem("vitpapers_done", JSON.stringify(done));
  return index === -1;
}

function createPaperListItem(paper, index) {
  const li = document.createElement("li");
  li.style.animationDelay = `${index * 30}ms`;
  li.style.cursor = "pointer";

  const isDone = getDonePapers().includes(paper.filename);
  if (isDone) li.classList.add("done");

  const checkIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
    `;
  const circleIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
        </svg>
    `;

  li.innerHTML = `
        <div class="checkbox-wrapper" title="${isDone ? "Mark as undone" : "Mark as done"}" onclick="event.stopPropagation()">
            ${isDone ? checkIcon : circleIcon}
        </div>
        <span class="paper-code">${paper.course_code || "—"}</span>
        <div class="paper-tags">
            <span class="paper-tag">${paper.slot.toUpperCase()}</span>
            <span class="paper-tag paper-tag-exam">${paper.type.toUpperCase()}</span>
            <span class="paper-tag">${formatYear(paper.semester_name)}</span>
        </div>
        <a href="${API_BASE}/download?filename=${encodeURIComponent(paper.filename)}" download class="download-btn" title="Download" onclick="event.stopPropagation()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 14.5L12 4.5M12 14.5C11.2998 14.5 9.99153 12.5057 9.5 12M12 14.5C12.7002 14.5 14.0085 12.5057 14.5 12" />
                <path d="M20 16.5C20 18.982 19.482 19.5 17 19.5H7C4.518 19.5 4 18.982 4 16.5" />
            </svg>
        </a>
    `;

  const toggleBtn = li.querySelector(".checkbox-wrapper");
  toggleBtn.addEventListener("click", () => {
    const newState = togglePaperDone(paper.filename);

    if (newState) {
      li.classList.add("done");
      toggleBtn.innerHTML = checkIcon;
      toggleBtn.title = "Mark as undone";
    } else {
      li.classList.remove("done");
      toggleBtn.innerHTML = circleIcon;
      toggleBtn.title = "Mark as done";
    }
  });

  li.onclick = () => {
    window.open(
      `${API_BASE}/download?filename=${encodeURIComponent(paper.filename)}`,
      "_blank",
    );
  };

  return li;
}

function initializeFilters() {
  const filterInputs = document.querySelectorAll(".chip input");

  filterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateFilterCounts();
      renderPapers();
    });
  });
}

function getActiveFilters() {
  const filters = { type: [], semester_name: [], slot: [] };
  document.querySelectorAll(".chip input:checked").forEach((input) => {
    if (input.name === "type") filters.type.push(input.value);
    if (input.name === "semester_name") filters.semester_name.push(input.value);
    if (input.name === "slot") filters.slot.push(input.value.toLowerCase());
  });
  return filters;
}

function updateFilterCounts() {
  const active = getActiveFilters();

  const countMatches = (predicate) => allPapers.filter(predicate).length;

  ["fat", "cat2", "cat1"].forEach((type) => {
    const count = countMatches((p) => {
      const yearMatch =
        active.semester_name.length === 0 ||
        active.semester_name.includes(p.semester_name);
      const slotMatch =
        active.slot.length === 0 || active.slot.includes(p.slot.toLowerCase());
      return p.type.toLowerCase() === type && yearMatch && slotMatch;
    });
    const el = document.getElementById(`count-${type}`);
    if (el) el.textContent = count;
  });

  ["2026", "2025", "2024", "2023", "2022"].forEach((year) => {
    const count = countMatches((p) => {
      const typeMatch =
        active.type.length === 0 || active.type.includes(p.type.toLowerCase());
      const slotMatch =
        active.slot.length === 0 || active.slot.includes(p.slot.toLowerCase());
      return p.semester_name === year && typeMatch && slotMatch;
    });
    const el = document.getElementById(`count-${year}`);
    if (el) el.textContent = count;
  });

  [
    "a1",
    "a2",
    "b1",
    "b2",
    "c1",
    "c2",
    "d1",
    "d2",
    "e1",
    "e2",
    "f1",
    "f2",
    "g1",
    "g2",
  ].forEach((slot) => {
    const count = countMatches((p) => {
      const typeMatch =
        active.type.length === 0 || active.type.includes(p.type.toLowerCase());
      const yearMatch =
        active.semester_name.length === 0 ||
        active.semester_name.includes(p.semester_name);
      return p.slot.toLowerCase() === slot && typeMatch && yearMatch;
    });
    const el = document.getElementById(`count-${slot}`);
    if (el) el.textContent = count;
  });
}

function initializeCommandPalette() {
  const dialog = document.getElementById("cmd-k-dialog");
  const input = document.getElementById("cmd-k-input");
  const resultsContainer = document.getElementById("cmd-k-results");
  const triggerBtn = document.getElementById("search-btn");

  if (!dialog) return;

  let courses = [];

  fetch(`${API_BASE}/courses`)
    .then((res) => res.json())
    .then((data) => {
      courses = data;
    })
    .catch((err) => console.error("Cmd+K: Failed to fetch courses", err));

  const open = () => {
    dialog.showModal();
    input.value = "";
    input.focus();
    renderResults();
  };

  const close = () => dialog.close();

  const renderResults = (query = "") => {
    let courseCount = 0;
    resultsContainer.innerHTML = "";
    const filtered = query
      ? courses.filter(
          (c) =>
            c.course_title.toLowerCase().includes(query.toLowerCase()) ||
            (c.course_code &&
              c.course_code.toLowerCase().includes(query.toLowerCase())),
        )
      : courses;

    filtered.forEach((course) => {
      if (courseCount < 5) resultsContainer.appendChild(createCmdKItem(course));
      courseCount++;
    });
  };

  const createCmdKItem = (course) => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.onclick = () =>
      (window.location.href = `/course.html?course_title=${encodeURIComponent(course.course_title)}`);

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
  };

  if (triggerBtn) triggerBtn.addEventListener("click", open);

  input.addEventListener("input", (e) => renderResults(e.target.value));

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (!dialog.open) open();
    }
    if (e.key === "Escape" && dialog.open) close();
  });

  input.closest("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const first = resultsContainer.querySelector("li");
    if (first) first.click();
  });

  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) close();
  });
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
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) close();
  });

  if (fileInput && fileNameDisplay) {
    fileInput.addEventListener("change", () => {
      fileNameDisplay.textContent =
        fileInput.files.length > 0 ? fileInput.files[0].name : "";
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
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
        } catch {}

        if (res.ok) {
          alert(data?.message || "Upload successful!");
          close();
          const urlParams = new URLSearchParams(window.location.search);
          fetchPapers(urlParams.get("course") || "");
        } else {
          alert("Upload failed: " + (data?.message || text));
        }
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}
