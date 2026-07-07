import type { Metadata } from "next";
import { Noto_Sans_KR, Playfair_Display, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";

/* 본문: 산세리프 (한글 포함) */
const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

/* 헤딩·워드마크: 에디토리얼 세리프 (라틴 → Playfair, 한글 → 나눔명조 폴백) */
const displayLatin = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-latin",
  display: "swap",
});

const displayKr = Nanum_Myeongjo({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nativo — Speak your way to native",
  description: "5단계 Phase 기반 언어 학습 플랫폼 (영어 / 스페인어 / 일본어)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${sans.variable} ${displayLatin.variable} ${displayKr.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
