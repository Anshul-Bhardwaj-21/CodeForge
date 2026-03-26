/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-page': '#0f172a',
        'bg-surface': '#111827',
        'border-subtle': '#1f2937',
        'text-primary': '#e5e7eb',
        'text-muted': '#9ca3af',
        'accent-blue': '#3b82f6',
        'accent-green': '#22c55e',
        'accent-yellow': '#eab308',
        'accent-red': '#ef4444',
        'accent-orange': '#f97316',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
