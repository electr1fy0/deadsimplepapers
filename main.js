courses = [
  "Data Structures and Algorithms",
  "Operating Systems",
  "Computer Networks",
  "Computer Architecture and Organization",
];

function createListItem(text) {
  const li = document.createElement("li");

  li.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 24 24"
         width="16" height="16"
         fill="none"
         stroke="#141B34"
         stroke-width="1.5"
         stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M8 2V18" />
      <path d="M20 22H6C4.89543 22 4 21.1046 4 20M4 20C4 18.8954 4.89543 18 6 18H20V6C20 4.11438 20 3.17157 19.4142 2.58579C18.8284 2 17.8856 2 16 2H10C7.17157 2 5.75736 2 4.87868 2.87868C4 3.75736 4 5.17157 4 8V20Z" />
      <path d="M19.5 18C19.5 18 18.5 18.7628 18.5 20C18.5 21.2372 19.5 22 19.5 22" />
    </svg>

    <span>${text}</span>

    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 24 24"
         width="16" height="16"
         fill="none"
         stroke="currentColor"
         stroke-width="1.5"
         stroke-linecap="round"
         stroke-linejoin="round">
      <path d="M18.5 12L4.99997 12" />
      <path d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6" />
    </svg>
  `;

  return li;
}

input = document.getElementById("search-bar");
list = document.getElementById("matched-courses");

list.innerHTML = "";
input.addEventListener("input", () => {
  const query = input.value.toLowerCase();

  const currentItems = Array.from(list.children).map(
    (li) => li.querySelector("span").textContent,
  );

  courses.forEach((course) => {
    const matches = course.toLowerCase().includes(query);
    const alreadyShown = currentItems.includes(course);

    if (matches && !alreadyShown) {
      list.appendChild(createListItem(course));
      console.log("match:", course);
    }

    if (!matches && alreadyShown) {
      const itemToRemove = Array.from(list.children).find(
        (li) => li.querySelector("span").textContent === course,
      );
      itemToRemove.remove();
    }
  });
});

const fileInput = document.getElementById("file");
const fileName = document.querySelector(".file-name");

fileInput.addEventListener("change", () => {
  fileName.textContent =
    fileInput.files.length > 0 ? fileInput.files[0].name : "No files selected";
});
