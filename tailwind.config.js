/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          600: '#2c3e50',
          700: '#1a2634',
          800: '#0f1623',
          900: '#070b11',
        },
      },
    },
  },
  plugins: [],
} 