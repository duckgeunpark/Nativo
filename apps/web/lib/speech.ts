/**
 * 음성 입력 (Web Speech API — SpeechRecognition).
 *
 * 브라우저 내장(주로 Chrome 계열) — 키 불필요. 미지원 환경에서는 isRecognitionSupported()=false.
 * 음성 출력은 lib/tts.ts(speak)를 사용한다.
 */

import type { Language } from "@nativo/core";

const BCP47: Record<Language, string> = {
  english: "en-US",
  spanish: "es-ES",
  japanese: "ja-JP",
};

// 표준 타입에 아직 없는 SpeechRecognition 의 최소 형태만 선언.
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getCtor() !== null;
}

export interface RecognitionController {
  stop(): void;
}

/**
 * 한 번의 받아쓰기 세션을 시작한다.
 * @param onFinal 최종 인식 문장(말이 끝나면)
 * @param onInterim 중간 인식 결과(실시간 미리보기)
 * @param onEnd 인식 종료(자동/수동)
 */
export function startRecognition(
  language: Language,
  {
    onFinal,
    onInterim,
    onEnd,
  }: {
    onFinal: (text: string) => void;
    onInterim?: (text: string) => void;
    onEnd?: () => void;
  },
): RecognitionController | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = BCP47[language];
  rec.continuous = false;
  rec.interimResults = true;

  rec.onresult = (e) => {
    let interim = "";
    let final = "";
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (!res) continue;
      const text = res[0]?.transcript ?? "";
      if (res.isFinal) final += text;
      else interim += text;
    }
    if (interim && onInterim) onInterim(interim);
    if (final) onFinal(final.trim());
  };
  rec.onerror = () => {};
  rec.onend = () => onEnd?.();

  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}
