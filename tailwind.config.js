/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}',   // ✅ components, layouts, pages
    './public/**/*.html',
    './pages/**/*.{astro,html}',                      // ✅ ensure top-level pages are included
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A2D60',
        accent: '#D7BC23',
      },
    },
  },
  plugins: [],
};
