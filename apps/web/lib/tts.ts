/**
 * 발음 듣기 (TTS).
 *
 * 현재는 브라우저 내장 Web Speech API(SpeechSynthesis)를 사용 — 키 불필요.
 * Google Cloud TTS 키가 준비되면 서버 프록시(API Route)로 교체 예정.
 */

import type { Language } from "@nativo/core";

const BCP47: Record<Language, string> = {
  english: "en-US",
  spanish: "es-ES",
  japanese: "ja-JP",
};

/** 텍스트를 해당 언어 음성으로 읽어준다. 미지원 환경에서는 조용히 무시. */
export function speak(text: string, language: Language): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47[language];
  window.speechSynthesis.cancel(); // 이전 발화 중단
  window.speechSynthesis.speak(utterance);
}

/** 현재 환경에서 TTS 가능 여부. */
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
