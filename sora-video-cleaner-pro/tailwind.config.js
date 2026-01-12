/** @type {import('tailwindcss').Config} */
export default {
  // 这里的 pattern 改为了 **/*，表示扫描所有子文件夹
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
