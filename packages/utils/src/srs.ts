/**
 * SM-2 간격 반복(Spaced Repetition) 알고리즘.
 *
 * SuperMemo-2 (1987) 기반. Anki 등이 사용하는 표준 구현.
 * DB의 flashcards 테이블 필드(ease_factor, interval_days, repetitions,
 * last_grade, next_review_at)와 1:1로 매핑된다.
 *
 * 이 모듈은 순수 함수만 포함한다(시간/DB 의존성 없음) → 단위 테스트가 쉽다.
 */

/** SM-2 채점 등급. 0(완전 망각) ~ 5(완벽). */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

/** UI의 3버튼(어려움/보통/쉬움)을 SM-2 등급으로 매핑. */
export type ReviewChoice = "hard" | "good" | "easy";

/** 학습 카드의 SRS 상태(스케줄링에 필요한 최소 필드). */
export interface SrsState {
  /** 난이도 계수. 최소 1.3. 기본 2.5. */
  easeFactor: number;
  /** 다음 복습까지의 간격(일). */
  intervalDays: number;
  /** 연속 정답(grade >= 3) 횟수. 오답 시 0으로 리셋. */
  repetitions: number;
}

/** SM-2 계산 결과. 다음 복습 일자까지 포함. */
export interface SrsResult extends SrsState {
  /** 마지막 채점 등급(DB의 last_grade). */
  lastGrade: Grade;
  /** 다음 복습 예정 시각(now + intervalDays). */
  nextReviewAt: Date;
}

/** ease_factor 하한. SM-2 표준값. */
export const MIN_EASE_FACTOR = 1.3;
/** 신규 카드 기본 ease_factor. */
export const DEFAULT_EASE_FACTOR = 2.5;

/** 정답으로 간주하는 최소 등급. */
const PASSING_GRADE = 3;

/** 신규 카드의 초기 SRS 상태. */
export function initialSrsState(): SrsState {
  return {
    easeFactor: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
  };
}

/** 3버튼 UI 선택을 SM-2 등급으로 변환. */
export function choiceToGrade(choice: ReviewChoice): Grade {
  switch (choice) {
    case "hard":
      return 2; // 정답선(3) 미만 → 다시 학습
    case "good":
      return 4;
    case "easy":
      return 5;
  }
}

/**
 * 새 ease_factor 계산.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * 하한 1.3로 클램프(상한은 두지 않음 — 표준 SM-2).
 */
function nextEaseFactor(easeFactor: number, grade: Grade): number {
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  return Math.max(MIN_EASE_FACTOR, easeFactor + delta);
}

/**
 * SM-2 한 단계 진행.
 *
 * @param state 현재 카드의 SRS 상태
 * @param grade 이번 복습 채점(0~5)
 * @param now   기준 시각(기본: 현재) — 테스트 주입용
 * @returns 갱신된 상태 + nextReviewAt
 */
export function review(state: SrsState, grade: Grade, now: Date = new Date()): SrsResult {
  const easeFactor = nextEaseFactor(state.easeFactor, grade);

  let repetitions: number;
  let intervalDays: number;

  if (grade < PASSING_GRADE) {
    // 오답 → 처음부터 다시(내일 복습)
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(state.intervalDays * easeFactor);
    }
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lastGrade: grade,
    nextReviewAt: addDays(now, intervalDays),
  };
}

/** now에 일수를 더한 새 Date 반환(원본 불변). */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
