import { navigate } from "../core/router.js";
import { renderDialog } from "../components/dialog.js";
import { API_BASE } from "../core/config.js";

interface Paper {
  filename: string;
  course_code: string;
  slot: string;
  exam_type: string;
  semester_name: string;
}

interface Course {
  course_title: string;
  course_code?: string;
  paper_count: number;
}

interface Filters {
  exam_type: string[];
  semester_name: string[];
  slot: string[];
}

function formatYear(year: string): string {
  const y = parseInt(year, 10);
  if (isNaN(y)) return year;
  return `${y}-${String(y + 1).slice(-2)}`;
}

let allPapers: Paper[] = [];
let currentCourseCode = "";

async function initializePapers(): Promise<void> {
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

async function fetchPapers(course = ""): Promise<void> {
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

function renderPapers(): void {
  const papersList = document.getElementById("papers-list");
  if (!papersList) return;

  const filters = getActiveFilters();
  const filtered = allPapers.filter((paper) => {
    const typeMatch =
      filters.exam_type.length === 0 ||
      filters.exam_type.includes(paper.exam_type.toLowerCase());
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

function getDonePapers(): string[] {
  try {
    return JSON.parse(localStorage.getItem("vitpapers_done") || "[]");
  } catch {
    return [];
  }
}

function togglePaperDone(filename: string): boolean {
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

function createPaperListItem(paper: Paper, index: number): HTMLLIElement {
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
            <span class="paper-tag paper-tag-exam">${paper.exam_type.toUpperCase()}</span>
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
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const newState = togglePaperDone(paper.filename);

      if (newState) {
        li.classList.add("done");
        toggleBtn.innerHTML = checkIcon;
      } else {
        li.classList.remove("done");
        toggleBtn.innerHTML = circleIcon;
      }
    });
  }

  li.onclick = () => {
    window.open(
      `${API_BASE}/download?filename=${encodeURIComponent(paper.filename)}`,
      "_blank"
    );
  };

  return li;
}

function initializeFilters(): void {
  const filterInputs = document.querySelectorAll(".chip input");

  filterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateFilterCounts();
      renderPapers();
    });
  });
}

function getActiveFilters(): Filters {
  const filters: Filters = { exam_type: [], semester_name: [], slot: [] };
  document
    .querySelectorAll<HTMLInputElement>(".chip input:checked")
    .forEach((input) => {
      if (input.name === "exam_type") filters.exam_type.push(input.value);
      if (input.name === "semester_name")
        filters.semester_name.push(input.value);
      if (input.name === "slot") filters.slot.push(input.value.toLowerCase());
    });
  return filters;
}

function updateFilterCounts(): void {
  const active = getActiveFilters();

  const countMatches = (predicate: (p: Paper) => boolean) =>
    allPapers.filter(predicate).length;

  ["fat", "cat2", "cat1"].forEach((type) => {
    const count = countMatches((p) => {
      const yearMatch =
        active.semester_name.length === 0 ||
        active.semester_name.includes(p.semester_name);
      const slotMatch =
        active.slot.length === 0 || active.slot.includes(p.slot.toLowerCase());
      return p.exam_type.toLowerCase() === type && yearMatch && slotMatch;
    });
    const el = document.getElementById(`count-${type}`);
    if (el) el.textContent = count.toString();
  });

  ["2026", "2025", "2024", "2023", "2022"].forEach((year) => {
    const count = countMatches((p) => {
      const typeMatch =
        active.exam_type.length === 0 ||
        active.exam_type.includes(p.exam_type.toLowerCase());
      const slotMatch =
        active.slot.length === 0 || active.slot.includes(p.slot.toLowerCase());
      return p.semester_name === year && typeMatch && slotMatch;
    });
    const el = document.getElementById(`count-${year}`);
    if (el) el.textContent = count.toString();
  });

  [
    "a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2",
    "e1", "e2", "f1", "f2", "g1", "g2"
  ].forEach((slot) => {
    const count = countMatches((p) => {
      const typeMatch =
        active.exam_type.length === 0 ||
        active.exam_type.includes(p.exam_type.toLowerCase());
      const yearMatch =
        active.semester_name.length === 0 ||
        active.semester_name.includes(p.semester_name);
      return p.slot.toLowerCase() === slot && typeMatch && yearMatch;
    });
    const el = document.getElementById(`count-${slot}`);
    if (el) el.textContent = count.toString();
  });
}

function initializeCommandPalette(): void {
  const dialog = document.getElementById("cmd-k-dialog") as HTMLDialogElement | null;
  const input = document.getElementById("cmd-k-input") as HTMLInputElement | null;
  const resultsContainer = document.getElementById("cmd-k-results");
  const triggerBtn = document.getElementById("search-btn");

  if (!dialog || !input || !resultsContainer) return;

  let courses: Course[] = [];

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
            c.course_code.toLowerCase().includes(query.toLowerCase()))
      )
      : courses;

    filtered.forEach((course) => {
      if (courseCount < 5) resultsContainer.appendChild(createCmdKItem(course));
      courseCount++;
    });
  };

  const createCmdKItem = (course: Course): HTMLLIElement => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.onclick = () =>
      navigate(
        `/course?course_title=${encodeURIComponent(course.course_title)}`
      );

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

  input.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    renderResults(target.value);
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (!dialog.open) open();
    }
    if (e.key === "Escape" && dialog.open) close();
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      close();
    }
  });
}

function initializeUploadDialog(): void {
  const triggerBtn = document.getElementById("upload-btn");
  const dialog = document.getElementById("upload-dialog") as HTMLDialogElement | null;
  const form = document.getElementById("upload-form") as HTMLFormElement | null;
  const fileInput = document.getElementById("file") as HTMLInputElement | null;
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
        fileInput.files && fileInput.files.length > 0 ? fileInput.files[0].name : "";
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector(".confirm-btn") as HTMLButtonElement;
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
        let data: { message?: string } | null = null;
        try {
          data = JSON.parse(text);
        } catch { }

        if (res.ok) {
          alert(data?.message || "Upload successful!");
          close();
          const urlParams = new URLSearchParams(window.location.search);
          fetchPapers(urlParams.get("course_title") || "");
        } else {
          alert("Upload failed: " + (data?.message || text));
        }
      } catch (err) {
        alert("Error: " + (err as Error).message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

export function renderCourse(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="course-page">
    <header>
        <button type="button" id="upload-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 14.5L12 4.5M12 4.5L15 7.5M12 4.5L9 7.5" />
                <path d="M20 16.5C20 18.982 19.482 19.5 17 19.5H7C4.518 19.5 4 18.982 4 16.5" />
            </svg>
            <span>Submit</span>
        </button>
        <button type="button" id="search-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.5 17.5L22 22" />
                <path
                    d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z" />
            </svg>
            <span id="cmd-icon">Search</span>
        </button>
        <button type="button" id="theme-toggle" title="Toggle theme">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path
                    d="M12 2V4M12 20V22M4 12H2M22 12H20M19.778 4.222L17.556 6.444M6.444 17.556L4.222 19.778M4.222 4.222L6.444 6.444M17.556 17.556L19.778 19.778" />
            </svg>
        </button>
    </header>

    <dialog id="upload-dialog"></dialog>

    <dialog id="cmd-k-dialog">
        <div id="search-area">
            <form action="/search">
                <fieldset>
                    <div class="search-bar-container">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
                            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17.5 17.5L22 22" />
                            <path
                                d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z" />
                        </svg>
                        <input type="text" name="course" placeholder="Search courses..." id="cmd-k-input" />
                    </div>
                </fieldset>
            </form>
            <ol id="cmd-k-results"></ol>
        </div>
    </dialog>

    <div class="main-ui">
        <a href="/" id="back-link">← Back</a>
        <h1 id="course-title">Loading...</h1>
        <h2 id="course-subtitle">Dead Simple Papers</h2>

        <div class="filters">
            <div class="filter-row">
                <span class="filter-label">Type</span>
                <div class="filter-chips">
                    <label class="chip"><input type="checkbox" name="exam_type" value="cat1" /><span>CAT 1 <small
                                id="count-cat1">0</small></span></label>
                    <label class="chip"><input type="checkbox" name="exam_type" value="cat2" /><span>CAT 2 <small
                                id="count-cat2">0</small></span></label>
                    <label class="chip"><input type="checkbox" name="exam_type" value="fat" /><span>FAT <small
                                id="count-fat">0</small></span></label>
                </div>
            </div>
            <div class="filter-row">
                <span class="filter-label">Semester</span>
                <div class="filter-chips">
                    <label class="chip">
                        <input type="checkbox" name="semester_name" value="2026" /><span>2026-27
                            <small id="count-2026">0</small></span></label>
                    <label class="chip">
                        <input type="checkbox" name="semester_name" value="2025" /><span>2025-26
                            <small id="count-2025">0</small></span></label>
                    <label class="chip"><input type="checkbox" name="semester_name" value="2024" /><span>2024-25 <small
                                id="count-2024">0</small></span></label>
                    <label class="chip"><input type="checkbox" name="semester_name" value="2023" /><span>2023-24 <small
                                id="count-2023">0</small></span></label>
                    <label class="chip"><input type="checkbox" name="semester_name" value="2022" /><span>2022-23 <small
                                id="count-2022">0</small></span></label>
                </div>
            </div>
            <div class="filter-row">
                <span class="filter-label">Slot</span>
                <div class="filter-chips filter-chips-wrap">
                    <label class="chip chip-sm">
                        <input type="checkbox" name="slot" value="a1" />
                        <span>A1 <small id="count-a1">0</small></span>
                    </label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="a2" /><span>A2 <small
                                id="count-a2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="b1" /><span>B1 <small
                                id="count-b1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="b2" /><span>B2 <small
                                id="count-b2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="c1" /><span>C1 <small
                                id="count-c1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="c2" /><span>C2 <small
                                id="count-c2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="d1" /><span>D1 <small
                                id="count-d1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="d2" /><span>D2 <small
                                id="count-d2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="e1" /><span>E1 <small
                                id="count-e1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="e2" /><span>E2 <small
                                id="count-e2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="f1" /><span>F1 <small
                                id="count-f1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="f2" /><span>F2 <small
                                id="count-f2">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="g1" /><span>G1 <small
                                id="count-g1">0</small></span></label>
                    <label class="chip chip-sm"><input type="checkbox" name="slot" value="g2" /><span>G2 <small
                                id="count-g2">0</small></span></label>
                </div>
            </div>
        </div>

        <ol id="papers-list"></ol>
        </div>
    </div>
    `;

  const backLink = document.querySelector("#back-link");
  if (backLink) {
    backLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigate("/");
    });
  }

  initializePapers();
  initializeCommandPalette();
  initializeUploadDialog();
  renderDialog();
}
