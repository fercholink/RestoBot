/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#ff4757", // Original Red
                secondary: "#2f3542", // Original Dark Grey
                accent: "#747d8c", // Original Grey
                success: "#2ed573",
                warning: "#ffa502",
                danger: "#ff4757",
            },
        },
    },
    plugins: [],
}
