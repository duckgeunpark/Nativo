/**
 * OpenAI 설정/클라이언트 (서버 전용). 키 없으면 기능을 안내로 degrade.
 *
 * 키 우선순위: 설정 페이지에서 저장한 개인 키(httpOnly 쿠키) > 서버 환경변수.
 * 쿠키는 서버 액션(app/settings/actions.ts)에서만 쓰고 지운다.
 */
import OpenAI from "openai";
import { cookies } from "next/headers";

/** 개인 API 키 쿠키 이름 — httpOnly 라 클라이언트 JS 에서는 읽을 수 없다. */
export const OPENAI_KEY_COOKIE = "openai_api_key";

/** 현재 요청에서 사용할 API 키 (개인 키 우선, 없으면 환경변수). */
export function getOpenAIKey(): string | undefined {
  let userKey: string | undefined;
  try {
    userKey = cookies().get(OPENAI_KEY_COOKIE)?.value?.trim() || undefined;
  } catch {
    // 요청 컨텍스트 밖(빌드 타임 등)에서는 쿠키 접근 불가 → 환경변수만 사용
  }
  return userKey ?? (process.env.OPENAI_API_KEY || undefined);
}

export function isOpenAIConfigured(): boolean {
  return Boolean(getOpenAIKey());
}

export function openaiClient(): OpenAI {
  return new OpenAI({ apiKey: getOpenAIKey() });
}
