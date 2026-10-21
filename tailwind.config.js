/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#effaf8', 100: '#d6f2ec', 200: '#aee4d9', 300: '#7bcfc0', 400: '#47b3a3',
          500: '#2a9888', 600: '#1f7a6e', 700: '#1c625a', 800: '#1a4f49', 900: '#18423d',
        },
      },
    },
  },
  plugins: [],
};
