/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        influencer: "#ec4899",
        salon: "#0ea5e9",
      },
      boxShadow: {
        card: "0 2px 12px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
