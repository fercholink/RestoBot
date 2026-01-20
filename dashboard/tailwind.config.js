/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#ff4757",
        secondary: "#2f3542",
        accent: "#747d8c",
        success: "#2ed573",
        warning: "#ffa502",
        danger: "#ff4757",
      },
    },
  },
  plugins: [],
}
