/** @type {import('tailwindcss').Config} */
export default {
  important: '.doc-gen',
  content: [
    './src/features/finance/invoiceGenerator/**/*.{js,jsx}',
    './src/features/finance/proformaGenerator/**/*.{js,jsx}',
    './src/features/finance/documentGenerator/**/*.{js,jsx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
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
        invoice: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        signature: ['"Segoe Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};
