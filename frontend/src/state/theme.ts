export function initializeTheme(): void {
    const currentTheme: string | null = localStorage.getItem("theme");
    const prefersDark: MediaQueryList = window.matchMedia(
        "(prefers-color-scheme: dark)",
    );
    const toggleBtn: HTMLElement | null = document.getElementById("theme-toggle");

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
