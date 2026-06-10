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
}

/** 루틴 30일 달성 = Phase 1 졸업 조건 중 하나. */
export const STREAK_GOAL_DAYS = 30;

const TEMPLATES: Record<Language, RoutineTask[]> = {
  english: [
    { id: "flashcard_review", label: "플래시카드 복습", minutes: 20 },
    { id: "youtube_listening", label: "영어 유튜브 듣기", minutes: 20 },
    { id: "reading_aloud", label: "영문 소리내어 읽기", minutes: 20 },
  ],
  spanish: [
    { id: "flashcard_review", label: "플래시카드 복습", minutes: 20 },
    { id: "verb_conjugation", label: "동사 변화표 연습", minutes: 15 },
    { id: "youtube_listening", label: "스페인어 유튜브 듣기", minutes: 20 },
  ],
  japanese: [
    { id: "hiragana_review", label: "히라가나 복습", minutes: 10 },
    { id: "katakana_review", label: "가타카나 복습", minutes: 10 },
    { id: "flashcard_review", label: "JLPT N5 단어 플래시카드", minutes: 20 },
    { id: "youtube_listening", label: "일본어 유튜브 듣기", minutes: 10 },
  ],
};

/** 해당 언어의 루틴 항목. */
export function getRoutineTasks(language: Language): RoutineTask[] {
  return TEMPLATES[language] ?? [];
}
