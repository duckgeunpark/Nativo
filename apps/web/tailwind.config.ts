import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 브랜드 컬러 (임시) — 추후 packages/ui 디자인 토큰으로 이전
        brand: {
          DEFAULT: "#4f46e5",
          fg: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
