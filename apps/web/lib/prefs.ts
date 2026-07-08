/**
 * 기기별 사용자 환경설정 (localStorage).
 *
 * 음성(TTS)과 AI 대화 스타일은 기기·브라우저에 따라 최적값이 달라
 * DB 마이그레이션 없이 localStorage 에 저장한다 (회당 학습량 쿠키와 같은 취지).
 * 이 모듈은 클라이언트 전용 — 서버에서 호출되면 기본값을 돌려준다.
 */

import type { Language } from "@nativo/core";

// --- 음성 (TTS) ---

/** AI 응답 자동 음성 재생 기본값. */
const AUTO_SPEAK_KEY = "tts_auto_speak";
/** 말하기 속도 (SpeechSynthesisUtterance.rate). */
const RATE_KEY = "tts_rate";
/** 언어별 선택 목소리 (SpeechSynthesisVoice.voiceURI) — 브라우저 엔진용. */
const voiceKey = (language: Language) => `tts_voice_${language}`;
/** 음성 엔진: 자연스러운 AI 음성(OpenAI, 서버 프록시) 또는 브라우저 내장. */
const ENGINE_KEY = "tts_engine";
/** AI 음성 엔진의 목소리 이름 (모든 언어 공용 — 다국어 목소리). */
const AI_VOICE_KEY = "tts_ai_voice";

export type TtsEngine = "ai" | "browser";

/** OpenAI TTS(gpt-4o-mini-tts) 목소리 목록 — 서버 라우트의 허용 목록과 일치해야 한다. */
export const AI_VOICES = [
  { value: "nova", label: "Nova · 여성, 활기찬" },
  { value: "shimmer", label: "Shimmer · 여성, 또렷한" },
  { value: "coral", label: "Coral · 여성, 밝은" },
  { value: "sage", label: "Sage · 여성, 차분한" },
  { value: "alloy", label: "Alloy · 중성, 무난한" },
  { value: "echo", label: "Echo · 남성, 차분한" },
  { value: "onyx", label: "Onyx · 남성, 깊고 낮은" },
  { value: "ash", label: "Ash · 남성, 따뜻한" },
  { value: "ballad", label: "Ballad · 남성, 부드러운" },
  { value: "verse", label: "Verse · 남성, 표현력 있는" },
  { value: "fable", label: "Fable · 영국식, 이야기하듯" },
] as const;

export type AiVoice = (typeof AI_VOICES)[number]["value"];

export const DEFAULT_AI_VOICE: AiVoice = "nova";

export const TTS_RATES = [
  { value: 0.8, label: "느리게" },
  { value: 1, label: "보통" },
  { value: 1.2, label: "빠르게" },
] as const;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAutoSpeak(): boolean {
  return storage()?.getItem(AUTO_SPEAK_KEY) !== "off";
}

export function setAutoSpeak(on: boolean): void {
  storage()?.setItem(AUTO_SPEAK_KEY, on ? "on" : "off");
}

export function getTtsRate(): number {
  const raw = Number(storage()?.getItem(RATE_KEY));
  return TTS_RATES.some((r) => r.value === raw) ? raw : 1;
}

export function setTtsRate(rate: number): void {
  storage()?.setItem(RATE_KEY, String(rate));
}

export function getTtsVoiceURI(language: Language): string | null {
  return storage()?.getItem(voiceKey(language)) ?? null;
}

export function setTtsVoiceURI(language: Language, voiceURI: string | null): void {
  const s = storage();
  if (!s) return;
  if (voiceURI) s.setItem(voiceKey(language), voiceURI);
  else s.removeItem(voiceKey(language));
}

export function getTtsEngine(): TtsEngine {
  return storage()?.getItem(ENGINE_KEY) === "browser" ? "browser" : "ai";
}

export function setTtsEngine(engine: TtsEngine): void {
  storage()?.setItem(ENGINE_KEY, engine);
}

export function getAiVoice(): AiVoice {
  const raw = storage()?.getItem(AI_VOICE_KEY);
  return AI_VOICES.some((v) => v.value === raw) ? (raw as AiVoice) : DEFAULT_AI_VOICE;
}

export function setAiVoice(voice: AiVoice): void {
  storage()?.setItem(AI_VOICE_KEY, voice);
}

// --- AI 대화 스타일 ---

export type ReplyLength = "short" | "normal";
export type ReplyDifficulty = "match" | "challenge";

export interface RoleplayStyle {
  length: ReplyLength;
  difficulty: ReplyDifficulty;
}

const RP_LENGTH_KEY = "rp_reply_length";
const RP_DIFFICULTY_KEY = "rp_difficulty";

export function getRoleplayStyle(): RoleplayStyle {
  const s = storage();
  const length = s?.getItem(RP_LENGTH_KEY);
  const difficulty = s?.getItem(RP_DIFFICULTY_KEY);
  return {
    length: length === "short" ? "short" : "normal",
    difficulty: difficulty === "challenge" ? "challenge" : "match",
  };
}

export function setRoleplayStyle(style: RoleplayStyle): void {
  const s = storage();
  if (!s) return;
  s.setItem(RP_LENGTH_KEY, style.length);
  s.setItem(RP_DIFFICULTY_KEY, style.difficulty);
}
