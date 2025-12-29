export function initializeTheme() {
    const currentTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const toggleBtn = document.getElementById("theme-toggle");
    if (currentTheme === "dark" || (!currentTheme && prefersDark.matches)) {
        document.body.classList.add("dark-mode");
    }
    else {
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
