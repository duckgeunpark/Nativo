/**
 * 테이블별 컬럼 메타데이터.
 *
 * SQLite 에는 배열/JSONB/BOOLEAN 네이티브 타입이 없어 모두 TEXT/INTEGER 로 저장한다.
 * 어댑터는 이 메타맵을 보고 읽을 때 역직렬화(JSON.parse / 0·1→boolean),
 * 쓸 때 직렬화(JSON.stringify / boolean→0·1)한다.
 */

/** JSON(배열/객체)으로 저장되는 컬럼 — 읽기 시 parse, 쓰기 시 stringify. */
export const JSON_COLUMNS: Record<string, readonly string[]> = {
  users: ["interests"],
  daily_logs: ["tasks_completed"],
  writing_journal: ["corrections", "used_chunks"],
  shadowing_videos: ["saved_words", "saved_chunks", "transcript"],
  roleplay_scenarios: ["mission_cards"],
  roleplay_sessions: ["messages", "feedback", "new_flashcards"],
  translation_sessions: ["feedback", "unknown_words", "new_flashcards"],
  phase_completions: ["conditions_met"],
  study_stats: ["monthly_stats"],
  documents: ["pages"],
};

/** INTEGER(0/1)로 저장되는 boolean 컬럼 — 읽기 시 Boolean 으로 변환. */
export const BOOLEAN_COLUMNS: Record<string, readonly string[]> = {
  shadowing_videos: ["completed"],
  roleplay_sessions: ["passed"],
  translation_sessions: ["passed"],
  content_history: ["completed"],
};

/** updated_at 컬럼을 가진 테이블 — UPDATE/UPSERT 시 현재 시각 자동 주입. */
export const UPDATED_AT_TABLES = new Set([
  "users",
  "shadowing_videos",
  "study_stats",
]);

export function jsonCols(table: string): readonly string[] {
  return JSON_COLUMNS[table] ?? [];
}

export function boolCols(table: string): readonly string[] {
  return BOOLEAN_COLUMNS[table] ?? [];
}

/** 현재 시각 ISO8601 (스키마 DEFAULT strftime 과 동일 포맷). */
export function nowIso(): string {
  return new Date().toISOString();
}
