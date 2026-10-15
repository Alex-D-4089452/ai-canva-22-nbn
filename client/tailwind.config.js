/** @type {import('tailwindcss').Config} */
export default {
  // The landing page ships a light + dark theme: the `dark` class is toggled on
  // the landing root (system preference by default, ☀️/🌙 toggle in the nav).
  // The app chrome stays light-only, so scoping the variant to a class is safe.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f1f5f9",
      },
    },
  },
  plugins: [],
};
