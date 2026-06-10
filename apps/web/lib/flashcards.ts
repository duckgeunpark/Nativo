/**
 * 플래시카드 학습 공용 로직 (SRS 엔진 ↔ DB 컬럼 매핑).
 *
 * SRS 계산은 @nativo/utils 의 순수 함수(review)를 사용하고,
 * 여기서는 flashcards 테이블 컬럼명으로 변환만 담당한다.
 * (mobile 확장 시 packages/core 로 이전 예정 — 로드맵 Phase 3)
 */

import type { Flashcard, TablesUpdate } from "@nativo/core";
import { choiceToGrade, review, type ReviewChoice, type SrsState } from "@nativo/utils";

/** 학습 화면에 필요한 카드 필드(앞/뒤면 표시 + SRS 입력). */
export type StudyCard = Pick<
  Flashcard,
  | "id"
  | "word"
  | "meaning"
  | "meaning_en"
  | "pronunciation"
  | "example_1"
  | "example_2"
  | "part_of_speech"
  | "difficulty"
  | "language"
  | "ease_factor"
  | "interval_days"
  | "repetitions"
>;

/** StudyCard 가 그대로 select 되도록 컬럼 목록을 한 곳에서 관리. */
export const STUDY_CARD_COLUMNS =
  "id, word, meaning, meaning_en, pronunciation, example_1, example_2, part_of_speech, difficulty, language, ease_factor, interval_days, repetitions";

/** 카드 행에서 SRS 상태만 추출. */
function srsStateOf(card: StudyCard): SrsState {
  return {
    easeFactor: card.ease_factor,
    intervalDays: card.interval_days,
    repetitions: card.repetitions,
  };
}

/**
 * 복습 선택(어려움/보통/쉬움) → 다음 SRS 상태를 DB update 페이로드로 변환.
 * next_review_at 은 ISO 문자열로 직렬화.
 */
export function reviewUpdate(
  card: StudyCard,
  choice: ReviewChoice,
): TablesUpdate<"flashcards"> {
  const result = review(srsStateOf(card), choiceToGrade(choice));
  return {
    ease_factor: result.easeFactor,
    interval_days: result.intervalDays,
    repetitions: result.repetitions,
    last_grade: result.lastGrade,
    next_review_at: result.nextReviewAt.toISOString(),
  };
}
