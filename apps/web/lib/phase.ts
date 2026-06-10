/**
 * Phase 졸업 조건 평가 (설계서 Phase별 졸업 조건).
 * 현재는 Phase 1 만 구현. (이후 Phase 2~5 동일 패턴 확장)
 */

/** Phase 1 졸업 기준값. */
export const PHASE1 = {
  REQUIRED_CARDS: 1000,
  REQUIRED_STREAK: 30,
  REQUIRED_TEST_SCORE: 70,
  TEST_QUESTION_COUNT: 100,
  TEST_CHOICES: 4,
} as const;

/** 단일 졸업 조건의 충족 상태. */
export interface Condition {
  met: boolean;
  current: number | null;
  required: number;
}

export interface Phase1Conditions {
  cards: Condition;
  streak: Condition;
  test: Condition;
}

/** Phase 1 진행 수치(테스트 점수는 응시 전이면 null). */
export interface Phase1Progress {
  cardCount: number;
  bestStreak: number;
  testScore: number | null;
}

/** 세 조건의 충족 여부를 계산. */
export function evaluatePhase1(p: Phase1Progress): Phase1Conditions {
  return {
    cards: {
      met: p.cardCount >= PHASE1.REQUIRED_CARDS,
      current: p.cardCount,
      required: PHASE1.REQUIRED_CARDS,
    },
    streak: {
      met: p.bestStreak >= PHASE1.REQUIRED_STREAK,
      current: p.bestStreak,
      required: PHASE1.REQUIRED_STREAK,
    },
    test: {
      met: p.testScore !== null && p.testScore >= PHASE1.REQUIRED_TEST_SCORE,
      current: p.testScore,
      required: PHASE1.REQUIRED_TEST_SCORE,
    },
  };
}

/** 모든 조건 충족 여부. */
export function isPhase1Complete(c: Phase1Conditions): boolean {
  return c.cards.met && c.streak.met && c.test.met;
}
