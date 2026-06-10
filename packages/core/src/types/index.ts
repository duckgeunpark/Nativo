/** @nativo/core 타입 공개 표면. */

export * from "./enums.js";
export * from "./json.js";
export * from "./database.js";

import type { Tables } from "./database.js";

/**
 * 도메인 모델 단축 별칭 (Row 기준).
 * 화면/스토어/API에서 테이블 Row를 의미 있는 이름으로 사용.
 */
export type User = Tables<"users">;
export type Flashcard = Tables<"flashcards">;
export type DailyLog = Tables<"daily_logs">;
export type Chunk = Tables<"chunks">;
export type WritingJournalEntry = Tables<"writing_journal">;
export type ShadowingVideo = Tables<"shadowing_videos">;
export type RoleplayScenario = Tables<"roleplay_scenarios">;
export type RoleplaySession = Tables<"roleplay_sessions">;
export type TranslationSession = Tables<"translation_sessions">;
export type PhaseCompletion = Tables<"phase_completions">;
export type StudyStats = Tables<"study_stats">;
export type ContentHistoryEntry = Tables<"content_history">;

/**
 * 클라이언트에 안전하게 노출 가능한 시나리오(민감 컬럼 system_prompt 제거).
 * 설계서 2.8 보안 요구사항: 클라이언트는 system_prompt 없이 조회.
 */
export type PublicRoleplayScenario = Omit<RoleplayScenario, "system_prompt">;
