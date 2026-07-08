/**
 * 발음 듣기 (TTS).
 *
 * 기본 엔진은 자연스러운 AI 음성(OpenAI, /api/tts 서버 프록시) — 목소리 11종.
 * 설정에서 브라우저 내장(Web Speech API)으로 바꿀 수 있고,
 * AI 음성 실패(키 미설정·네트워크 오류) 시에도 브라우저 음성으로 폴백한다.
 *
 * 말하기 속도·목소리는 설정 페이지에서 저장한 기기별 값(lib/prefs)을 따른다.
 */

import type { Language } from "@nativo/core";
import {
  getAiVoice,
  getTtsEngine,
  getTtsRate,
  getTtsVoiceURI,
  type AiVoice,
  type TtsEngine,
} from "@/lib/prefs";

const BCP47: Record<Language, string> = {
  english: "en-US",
  spanish: "es-ES",
  japanese: "ja-JP",
};

/** 언어별 BCP47 접두어 (브라우저 목소리 필터링용). */
const LANG_PREFIX: Record<Language, string> = {
  english: "en",
  spanish: "es",
  japanese: "ja",
};

/** 설정 미리 듣기 등에서 저장 전 값으로 재생할 때 쓰는 오버라이드. */
export interface SpeakOverrides {
  engine?: TtsEngine;
  aiVoice?: AiVoice;
  rate?: number;
  /** 브라우저 엔진용 목소리 (SpeechSynthesisVoice.voiceURI). */
  voiceURI?: string | null;
}

// --- AI 음성 (서버 프록시) ---

/** 같은 문장 반복 재생 시 API 비용을 아끼기 위한 클라이언트 캐시. */
const audioCache = new Map<string, string>(); // key → blob URL
const AUDIO_CACHE_MAX = 40;

let currentAudio: HTMLAudioElement | null = null;
/** 키 미설정(503) 확인 후에는 세션 내내 브라우저 엔진으로만 재생. */
let aiUnavailable = false;

function stopPlayback(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

async function fetchAiAudio(text: string, voice: AiVoice, rate: number): Promise<string | null> {
  const key = `${voice}|${rate}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, rate }),
  });
  if (res.status === 503) {
    aiUnavailable = true;
    return null;
  }
  if (!res.ok) return null;

  const url = URL.createObjectURL(await res.blob());
  if (audioCache.size >= AUDIO_CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest) {
      const oldUrl = audioCache.get(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioCache.delete(oldest);
    }
  }
  audioCache.set(key, url);
  return url;
}

async function speakAi(text: string, voice: AiVoice, rate: number): Promise<boolean> {
  try {
    const url = await fetchAiAudio(text, voice, rate);
    if (!url) return false;
    const audio = new Audio(url);
    currentAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

// --- 브라우저 음성 (Web Speech API) ---

/** 해당 학습 언어로 발화 가능한 브라우저 목소리 목록. voiceschanged 이후 호출해야 채워진다. */
export function getVoicesFor(language: Language): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(LANG_PREFIX[language]));
}

function speakBrowser(
  text: string,
  language: Language,
  rate: number,
  voiceURI: string | null,
): void {
  if (!isSpeechSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47[language];
  utterance.rate = rate;
  if (voiceURI) {
    const voice = getVoicesFor(language).find((v) => v.voiceURI === voiceURI);
    if (voice) utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}

// --- 공개 API ---

/** 텍스트를 해당 언어 음성으로 읽어준다. 미지원 환경에서는 조용히 무시. */
export function speak(text: string, language: Language, overrides?: SpeakOverrides): void {
  if (typeof window === "undefined" || !text) return;
  stopPlayback(); // 이전 발화 중단

  const engine = overrides?.engine ?? getTtsEngine();
  const rate = overrides?.rate ?? getTtsRate();
  const browserVoiceURI =
    overrides?.voiceURI !== undefined ? overrides.voiceURI : getTtsVoiceURI(language);

  if (engine === "ai" && !aiUnavailable) {
    const voice = overrides?.aiVoice ?? getAiVoice();
    void speakAi(text, voice, rate).then((ok) => {
      if (!ok) speakBrowser(text, language, rate, browserVoiceURI);
    });
    return;
  }
  speakBrowser(text, language, rate, browserVoiceURI);
}

/** 현재 환경에서 브라우저 TTS 가능 여부. (AI 음성은 서버 프록시라 항상 시도 가능) */
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
