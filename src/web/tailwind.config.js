/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pump: {
          primary: '#FF6B35',
          secondary: '#1A1A2E',
          accent: '#00D9FF',
          dark: '#0F0F1A',
          light: '#F5F5F7',
        },
      },
    },
  },
  plugins: [],
}
