/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'SF Mono'", "Monaco", "'Cascadia Code'", "monospace"],
      },
      colors: {
        primary: "#4F46E5",
        "primary-hover": "#4338CA",
        "primary-light": "#EEF2FF",
        "primary-dark": "#3730A3",
        surface: "#FFFFFF",
        "surface-dark": "#1E293B",
        "bg-dark": "#0F172A",
        accent: {
          emerald: "#10B981",
          amber: "#F59E0B",
          rose: "#F43F5E",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "slide-down": "slideDown 0.35s ease-out",
      },
    },
  },
  plugins: [],
}
