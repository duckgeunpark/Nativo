/**
 * JSONB 컬럼에 들어가는 구조화된 페이로드 타입.
 *
 * DB에는 jsonb로 저장되지만, 애플리케이션에서는 이 타입으로 다뤄
 * 직렬화/역직렬화 경계를 명확히 한다.
 */

/** Postgres jsonb 와 호환되는 범용 JSON 값. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** 일일 루틴 체크리스트 완료 항목. daily_logs.tasks_completed. */
export type DailyTaskId =
  | "flashcard_review"
  | "youtube_listening"
  | "reading_aloud"
  | "hiragana_review"
  | "katakana_review"
  | "verb_conjugation";

/** 영작 일기 AI 첨삭 항목. writing_journal.corrections[]. */
export interface WritingCorrection {
  original: string;
  corrected: string;
  reason: string;
}

/** 쉐도잉 중 저장한 단어. shadowing_videos.saved_words[]. */
export interface SavedWord {
  word: string;
  timestamp: number; // 영상 내 초 단위 위치
  meaning?: string;
}

/** 쉐도잉 중 저장한 Chunk. shadowing_videos.saved_chunks[]. */
export interface SavedChunk {
  text: string;
  timestamp: number;
}

/** 시간별 자막 큐. shadowing_videos.transcript[]. (lib/youtube TranscriptCue 와 동일 구조) */
export interface TranscriptCue {
  start: number; // 초
  dur: number; // 초
  text: string;
}

/** 롤플레이 시나리오 미션 카드. roleplay_scenarios.mission_cards[]. */
export interface MissionCard {
  mission: string;
}

/** 대화 한 줄. roleplay_sessions.messages[]. */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO 8601
}

/** 롤플레이 세션 평가 피드백. roleplay_sessions.feedback. */
export interface RoleplayFeedback {
  good_points: string[];
  improvements: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  next_recommendation: string;
}

/** 번역 세션 평가 피드백. translation_sessions.feedback. */
export interface TranslationFeedback {
  good_points: string[];
  improvements: Array<{
    original: string;
    recommended: string;
    reason: string;
  }>;
}

/** 번역 중 클릭한 모르는 단어. translation_sessions.unknown_words[]. */
export interface UnknownWord {
  word: string;
  clicked_at: string; // ISO 8601
}

/** Phase 졸업 조건 달성 내역. phase_completions.conditions_met. */
export type PhaseConditions = Record<string, number | boolean>;

/** 월별 학습 통계. study_stats.monthly_stats. */
export type MonthlyStats = Record<
  string, // "2026-06"
  { minutes: number; sessions: number }
>;
