/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#09090b', // Deep rich black
                surface: '#18181b',    // Slightly lighter for cards
                primary: '#e4e4e7',    // High contrast text
                secondary: '#a1a1aa',  // Muted text
                accent: '#d4d4d8',     // Silver/Metallic accent
                border: '#27272a',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
