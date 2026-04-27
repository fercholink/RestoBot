/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Airbnb Cereal VF"', 'Circular', '-apple-system', 'system-ui', 'Roboto', 'sans-serif'],
            },
            colors: {
                primary: "#ff385c", // Airbnb Rausch
                'primary-active': "#e00b41",
                secondary: "#222222", // Airbnb Ink
                accent: "#6a6a6a", // Airbnb Muted
                success: "#00a699", // Airbnb Teal (often used for success states)
                warning: "#ffb400",
                danger: "#c13515", // Airbnb Error
                canvas: "#ffffff",
                'surface-soft': "#f7f7f7",
                'surface-strong': "#f2f2f2",
                hairline: "#dddddd"
            },
            borderRadius: {
                'sm': '8px',
                'md': '14px',
                'lg': '20px',
                'xl': '32px',
                'full': '9999px',
            },
            boxShadow: {
                'airbnb': 'rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0',
            }
        },
    },
    plugins: [],
}
