/**
 * 서비스 전반에서 공유하는 도메인 리터럴 타입.
 *
 * DB는 이 값들을 TEXT 컬럼으로 저장한다(설계서 단순화 원칙).
 * 타입 안전성은 이 union으로 애플리케이션 레벨에서 보장한다.
 */

/** 지원 학습 언어. users.selected_language, 전 테이블 language 컬럼. */
export type Language = "english" | "spanish" | "japanese";
export const LANGUAGES: readonly Language[] = ["english", "spanish", "japanese"];

/** 학습 단계. users.current_phase, 1~5. */
export type Phase = 1 | 2 | 3 | 4 | 5;
export const PHASES: readonly Phase[] = [1, 2, 3, 4, 5];

/** CEFR 레벨. 카드 난이도/사용자 레벨/시나리오 레벨에 공용. */
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** 플래시카드 출처. flashcards.source. */
export type FlashcardSource = "curated" | "video" | "reading" | "manual";

/** Chunk 출처. chunks.source. */
export type ChunkSource = "curated" | "ai_generated" | "video" | "manual";

/** Chunk 카테고리. chunks.category. */
export type ChunkCategory = "daily" | "business" | "travel" | "social" | "custom";

/** 롤플레이 시나리오 카테고리. roleplay_scenarios.category. */
export type ScenarioCategory =
  | "daily"
  | "business"
  | "travel"
  | "social"
  | "professional";

/** 롤플레이 대화 모드. roleplay_sessions.mode. */
export type RoleplayMode = "guided" | "free" | "pressure";

/** 번역 방향. translation_sessions.direction. */
export type TranslationDirection = "to_korean" | "from_korean";

/** 원서 콘텐츠 유형. content_history.content_type. */
export type ContentType = "book" | "article" | "ai_generated";
