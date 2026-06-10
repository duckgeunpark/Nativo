import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
