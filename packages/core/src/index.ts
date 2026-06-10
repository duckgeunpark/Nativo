/**
 * @nativo/core — web/mobile 공유 비즈니스 로직.
 *
 * 구성:
 *   types/    — DB 스키마 기반 TypeScript 타입 (단일 출처)
 *   supabase/ — 타입 적용 Supabase 클라이언트 팩토리
 *   (추후) api/    — OpenAI, TTS, 사전 API 호출
 *   (추후) stores/ — Zustand 전역 상태
 */

export * from "./types/index.js";
export * from "./supabase/client.js";
