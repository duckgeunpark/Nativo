/**
 * DeepL 번역 클라이언트 (서버 전용). 키 없으면 조용히 degrade(단어 조회는 사전 API로).
 *
 * 키 우선순위: 설정 페이지에서 저장한 개인 키(httpOnly 쿠키) > 서버 환경변수.
 * (lib/openai.ts 의 OpenAI 키 관리와 동일한 방식.)
 *
 * DeepL은 "사전"이 아니라 "번역기"라 단어를 넣으면 번역 한 줄만 준다.
 * 그래서 한국어 뜻(meaning)에만 쓰고, 발음/예문/품사는 사전 API(dictionary.ts)가 채운다.
 */

import { cookies } from "next/headers";
import type { Language } from "@nativo/core";

/** 개인 DeepL 키 쿠키 이름 — httpOnly 라 클라이언트 JS 에서는 읽을 수 없다. */
export const DEEPL_KEY_COOKIE = "deepl_api_key";

/** 학습 언어 → DeepL 소스 언어 코드. */
const SOURCE_LANG: Record<Language, string> = {
  english: "EN",
  spanish: "ES",
  japanese: "JA",
};

/** 현재 요청에서 사용할 DeepL 키 (개인 키 우선, 없으면 환경변수). */
export function getDeepLKey(): string | undefined {
  let userKey: string | undefined;
  try {
    userKey = cookies().get(DEEPL_KEY_COOKIE)?.value?.trim() || undefined;
  } catch {
    // 요청 컨텍스트 밖(빌드 타임 등)에서는 쿠키 접근 불가 → 환경변수만 사용
  }
  return userKey ?? (process.env.DEEPL_API_KEY || undefined);
}

export function isDeepLConfigured(): boolean {
  return Boolean(getDeepLKey());
}

/**
 * DeepL API 엔드포인트 결정.
 * 무료 키는 ":fx" 로 끝난다(api-free), 유료 키는 그렇지 않다(api).
 */
export function deeplEndpoint(key: string): string {
  const base = key.trim().endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  return `${base}/v2/translate`;
}

/** DeepL usage 엔드포인트(키 검증용, 과금 없음). */
export function deeplUsageEndpoint(key: string): string {
  const base = key.trim().endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  return `${base}/v2/usage`;
}

interface DeepLResponse {
  translations?: { text?: string; detected_source_language?: string }[];
}

/**
 * 단어/짧은 텍스트를 한국어로 번역. 키가 없거나 실패하면 null.
 * @param language 원문 언어(학습 언어) — DeepL source_lang 힌트로 사용.
 */
export async function translateToKorean(
  text: string,
  language: Language,
): Promise<string | null> {
  const key = getDeepLKey();
  const value = text.trim();
  if (!key || !value) return null;

  try {
    const res = await fetch(deeplEndpoint(key), {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [value],
        target_lang: "KO",
        source_lang: SOURCE_LANG[language],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DeepLResponse;
    const out = data.translations?.[0]?.text?.trim();
    return out || null;
  } catch {
    return null; // 네트워크/타임아웃 등 — 번역 실패해도 사전 API 로 폴백
  }
}

/**
 * 키가 실제로 동작하는지 usage 엔드포인트로 확인(과금 없음). 설정 저장 전 검증용.
 */
export async function verifyDeepLKey(key: string): Promise<boolean> {
  const trimmed = key.trim();
  if (!trimmed) return false;
  try {
    const res = await fetch(deeplUsageEndpoint(trimmed), {
      headers: { Authorization: `DeepL-Auth-Key ${trimmed}` },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
