/**
 * 일일 학습 루틴 템플릿 (설계서 Phase 1 기능 4).
 * 언어 + Phase 에 따라 체크리스트 항목이 달라진다.
 *
 * task id 는 @nativo/core 의 DailyTaskId 와 일치 → daily_logs.tasks_completed 에 저장.
 */

import type { DailyTaskId, Language } from "@nativo/core";

export interface RoutineTask {
  id: DailyTaskId;
  label: string;
  minutes: number;
  /** 바로 학습하러 갈 모듈 경로 (없으면 링크 없이 체크만). */
  href?: string;
}

/** 루틴 30일 달성 = Phase 1 졸업 조건 중 하나. */
export const STREAK_GOAL_DAYS = 30;

// 4개 모듈 ↔ DailyTaskId(고정 enum) 매핑 — id는 템플릿 내에서 유일해야 한다.
//   flashcard_review→플래시카드 · verb_conjugation→청크 · youtube_listening→쉐도잉 · reading_aloud→읽기
const CORE_ROUTINE: RoutineTask[] = [
  { id: "flashcard_review", label: "플래시카드 복습", minutes: 15, href: "/learn/flashcards" },
  { id: "verb_conjugation", label: "청크 복습", minutes: 15, href: "/learn/chunks" },
  { id: "youtube_listening", label: "유튜브 쉐도잉", minutes: 15, href: "/learn/shadowing" },
  { id: "reading_aloud", label: "원서 읽기", minutes: 15, href: "/learn/reading" },
];

const TEMPLATES: Record<Language, RoutineTask[]> = {
  english: CORE_ROUTINE,
  spanish: CORE_ROUTINE,
  japanese: CORE_ROUTINE,
};

/** 해당 언어의 루틴 항목. */
export function getRoutineTasks(language: Language): RoutineTask[] {
  return TEMPLATES[language] ?? [];
}
