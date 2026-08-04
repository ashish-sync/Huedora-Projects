/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/features/auth/lamp-login/**/*.{js,jsx}',
    './src/features/auth/LoginPage.jsx',
    './src/features/finance/invoiceGenerator/**/*.{js,jsx}',
    './src/features/finance/proformaGenerator/**/*.{js,jsx}',
    './src/features/finance/documentGenerator/**/*.{js,jsx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        huedora: {
          blue: '#0005B2',
          'blue-hover': '#00048f',
        },
        invoice: {
          navy: '#0f3b6d',
          'navy-dark': '#0a2d54',
          accent: '#1e5a9a',
          line: '#d7dee8',
          panel: '#f4f7fb',
          muted: '#5f6b7a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        invoice: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        signature: ['"Great Vibes"', 'cursive'],
      },
      transitionDuration: {
        400: '400ms',
        500: '500ms',
        600: '600ms',
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
