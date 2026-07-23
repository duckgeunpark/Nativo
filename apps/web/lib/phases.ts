/**
 * 페이즈(1~5) 졸업 조건 정의 및 평가 — 순수 로직(테스트 대상).
 *
 * 근거(SLA 연구):
 *  - 어휘량↔CEFR (Milton & Alexiou 2009; Nation 2006): A2~2.5k · B1~3.25k · B2~4k · C1~5k 수용 어휘.
 *    덱이 언어당 단어 ~8.4k / 청크 ~1.4k 로 커서 5개 페이즈를 A2→C1+ 밴드에 절대 목표로 정렬.
 *  - 습관 형성 (Lally 2010): 자동성 중앙값 66일 → 초기 페이즈는 14일 스트릭으로 "습관 시작"을 게이트.
 *  - SRS (SM-2, 기존 COMPLETE_THRESHOLD=5): "노출"이 아니라 retention(반복 ≥5회 = 숙달)으로 측정.
 *  - 입력+산출 (Krashen i+1 / Swain output): 초기는 입력, 후기는 산출(roleplay·번역 점수)을 요구.
 *
 * 수치는 이 파일 상단 상수에서 한 곳으로 조정 가능.
 */

import type { Phase, PhaseConditions } from "@nativo/core";

/** 페이즈 라벨 — 화면 공용(루틴/통계 페이지에서 중복 정의하지 말 것). */
export const PHASE_LABEL: Record<Phase, string> = {
  1: "시작하기",
  2: "기초 다지기",
  3: "유창성 확장",
  4: "표현 다듬기",
  5: "고급 숙달",
};

export const PHASES: Phase[] = [1, 2, 3, 4, 5];

/** 페이즈별 숙달 단어 목표(누적). 스킬 점수 정규화에도 재사용. */
export const PHASE_WORD_TARGET: Record<Phase, number> = {
  1: 40,
  2: 300,
  3: 1000,
  4: 2500,
  5: 5000,
};

/** 페이즈별 숙달 청크 목표(누적). */
export const PHASE_CHUNK_TARGET: Record<Phase, number> = {
  1: 20,
  2: 80,
  3: 250,
  4: 600,
  5: 1000,
};

/** 습관 게이트: 초기 페이즈 스트릭 목표(일). Lally 2010 기반의 "습관 시작" 지점. */
export const PHASE_STREAK_TARGET = 14;

/** roleplay 세션 점수 집계. */
export interface RoleplayAgg {
  count: number;
  avgTotal: number;
  avgFluency: number;
  avgAccuracy: number;
  avgVocab: number;
  bestTotal: number;
}

/** translation 세션 점수 집계. */
export interface TranslationAgg {
  count: number;
  passedCount: number;
  avgTotal: number;
  avgAccuracy: number;
  avgNaturalness: number;
  avgNuance: number;
}

/** 페이즈 평가·스킬 진단에 쓰는 학습자 신호(기존 테이블에서 집계). */
export interface LearnerSignals {
  masteredWords: number; // flashcards repetitions>=5
  masteredChunks: number; // chunks review_count>=5
  currentStreak: number;
  longestStreak: number;
  studyDays: number;
  shadowingCompleted: number;
  readingCompleted: number;
  journalCount: number;
  roleplay: RoleplayAgg;
  translation: TranslationAgg;
}

interface ConditionDef {
  id: string;
  label: string;
  unit: string; // "일" | "개" | "점" | "회"
  target: number;
  value: (s: LearnerSignals) => number;
}

/**
 * 각 페이즈를 "졸업"하기 위한 조건.
 * 페이즈가 오를수록 산출(roleplay·번역) 요구가 추가된다. Phase 5 는 종착(진급 없음)이며
 * 여기 조건은 "졸업 완료" 배지용 목표로 표시된다.
 */
export const PHASE_CONDITIONS: Record<Phase, ConditionDef[]> = {
  1: [
    { id: "streak", label: "루틴 스트릭", unit: "일", target: PHASE_STREAK_TARGET, value: (s) => s.longestStreak },
    { id: "words", label: "숙달 단어", unit: "개", target: PHASE_WORD_TARGET[1], value: (s) => s.masteredWords },
    { id: "chunks", label: "숙달 표현", unit: "개", target: PHASE_CHUNK_TARGET[1], value: (s) => s.masteredChunks },
    { id: "shadowing", label: "쉐도잉 완료", unit: "개", target: 1, value: (s) => s.shadowingCompleted },
  ],
  2: [
    { id: "studyDays", label: "누적 학습일", unit: "일", target: 30, value: (s) => s.studyDays },
    { id: "words", label: "숙달 단어", unit: "개", target: PHASE_WORD_TARGET[2], value: (s) => s.masteredWords },
    { id: "chunks", label: "숙달 표현", unit: "개", target: PHASE_CHUNK_TARGET[2], value: (s) => s.masteredChunks },
    { id: "roleplayFirst", label: "AI대화 점수", unit: "점", target: 60, value: (s) => s.roleplay.bestTotal },
  ],
  3: [
    { id: "words", label: "숙달 단어", unit: "개", target: PHASE_WORD_TARGET[3], value: (s) => s.masteredWords },
    { id: "chunks", label: "숙달 표현", unit: "개", target: PHASE_CHUNK_TARGET[3], value: (s) => s.masteredChunks },
    { id: "roleplayCount", label: "AI대화 횟수", unit: "회", target: 5, value: (s) => s.roleplay.count },
    { id: "roleplayTotal", label: "AI대화 평균", unit: "점", target: 70, value: (s) => s.roleplay.avgTotal },
    { id: "roleplayFluency", label: "말하기 유창성", unit: "점", target: 70, value: (s) => s.roleplay.avgFluency },
    { id: "translationPassed", label: "번역 통과", unit: "회", target: 3, value: (s) => s.translation.passedCount },
  ],
  4: [
    { id: "words", label: "숙달 단어", unit: "개", target: PHASE_WORD_TARGET[4], value: (s) => s.masteredWords },
    { id: "roleplayCount", label: "AI대화 횟수", unit: "회", target: 10, value: (s) => s.roleplay.count },
    { id: "roleplayTotal", label: "AI대화 평균", unit: "점", target: 78, value: (s) => s.roleplay.avgTotal },
    { id: "roleplayAccuracy", label: "말하기 정확도", unit: "점", target: 75, value: (s) => s.roleplay.avgAccuracy },
    { id: "roleplayVocab", label: "말하기 어휘", unit: "점", target: 75, value: (s) => s.roleplay.avgVocab },
    { id: "translationNat", label: "번역 자연스러움", unit: "점", target: 75, value: (s) => s.translation.avgNaturalness },
    { id: "translationNuance", label: "번역 뉘앙스", unit: "점", target: 70, value: (s) => s.translation.avgNuance },
    { id: "journal", label: "영작 일기", unit: "개", target: 5, value: (s) => s.journalCount },
  ],
  5: [
    { id: "words", label: "숙달 단어", unit: "개", target: PHASE_WORD_TARGET[5], value: (s) => s.masteredWords },
    { id: "roleplayTotal", label: "AI대화 평균", unit: "점", target: 85, value: (s) => s.roleplay.avgTotal },
    { id: "roleplayAccuracy", label: "말하기 정확도", unit: "점", target: 85, value: (s) => s.roleplay.avgAccuracy },
    { id: "roleplayFluency", label: "말하기 유창성", unit: "점", target: 85, value: (s) => s.roleplay.avgFluency },
    { id: "roleplayVocab", label: "말하기 어휘", unit: "점", target: 85, value: (s) => s.roleplay.avgVocab },
    { id: "translationTotal", label: "번역 평균", unit: "점", target: 85, value: (s) => s.translation.avgTotal },
  ],
};

export interface ConditionResult {
  id: string;
  label: string;
  unit: string;
  current: number;
  target: number;
  met: boolean;
  pct: number; // 0~100
}

export interface PhaseEvaluation {
  phase: Phase;
  conditions: ConditionResult[];
  metCount: number;
  total: number;
  allMet: boolean;
  /** 충족한 조건 비율(0~100) — "졸업까지" 헤드라인용. */
  progressPct: number;
}

/** 한 페이즈의 조건들을 신호로 평가. */
export function evaluatePhase(signals: LearnerSignals, phase: Phase): PhaseEvaluation {
  const defs = PHASE_CONDITIONS[phase];
  const conditions: ConditionResult[] = defs.map((d) => {
    const current = Math.round(d.value(signals));
    const met = current >= d.target;
    const pct = d.target > 0 ? Math.min(100, Math.round((current / d.target) * 100)) : 100;
    return { id: d.id, label: d.label, unit: d.unit, current, target: d.target, met, pct };
  });
  const metCount = conditions.filter((c) => c.met).length;
  const total = conditions.length;
  return {
    phase,
    conditions,
    metCount,
    total,
    allMet: total > 0 && metCount === total,
    progressPct: total > 0 ? Math.round((metCount / total) * 100) : 100,
  };
}

/** 졸업 기록(phase_completions.conditions_met)에 저장할 스냅샷. */
export function phaseConditionsSnapshot(signals: LearnerSignals, phase: Phase): PhaseConditions {
  const snap: PhaseConditions = {};
  for (const c of evaluatePhase(signals, phase).conditions) {
    snap[c.id] = c.current;
  }
  return snap;
}
