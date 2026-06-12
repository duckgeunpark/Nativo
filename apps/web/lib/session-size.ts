/**
 * 회당 학습 문제 수(새로 투입할 단어/청크 수) 사용자 설정.
 * 서버 컴포넌트가 바로 읽도록 쿠키에 저장한다(기기별). 마이그레이션 불필요.
 * 이 모듈은 next/headers 를 쓰지 않아 클라이언트에서도 import 가능.
 */

export const SESSION_SIZE = {
  flashcard: { cookie: "fc_session_size", default: 60 },
  chunk: { cookie: "chunk_session_size", default: 30 },
} as const;

export type SessionKind = keyof typeof SESSION_SIZE;

export const SESSION_MIN = 5;
export const SESSION_MAX = 200;

export function clampSize(n: number, def: number): number {
  if (!Number.isFinite(n)) return def;
  return Math.min(SESSION_MAX, Math.max(SESSION_MIN, Math.round(n)));
}

/** 쿠키 값(문자열) → 유효한 세션 크기. 없거나 잘못되면 기본값. */
export function parseSessionCookie(raw: string | undefined, def: number): number {
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) ? clampSize(n, def) : def;
}
