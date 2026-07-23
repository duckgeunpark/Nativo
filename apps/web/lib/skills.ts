/**
 * 스킬별 진단 + "부족한 부분" 보강 추천 — 순수 로직(테스트 대상).
 *
 * 각 스킬을 0~100 으로 정규화하고 가장 약한 스킬을 찾아, 루틴 화면의 "오늘의 보강"
 * 카드와 해당 태스크 강조에 쓸 추천을 만든다. 점수 목표는 현재 페이즈 기준으로 스케일.
 */

import type { DailyTaskId } from "@nativo/core";
import type { Phase } from "@nativo/core";
import { PHASE_CHUNK_TARGET, PHASE_STREAK_TARGET, PHASE_WORD_TARGET, type LearnerSignals } from "./phases";

export type SkillId = "vocab" | "chunks" | "listening" | "reading" | "speaking" | "writing" | "habit";

export interface SkillScore {
  id: SkillId;
  label: string;
  score: number; // 0~100
  /** 매칭되는 핵심 루틴 태스크(있으면 체크리스트에서 강조). */
  taskId?: DailyTaskId;
  href: string;
}

export interface Recommendation {
  skillId: SkillId;
  taskId?: DailyTaskId;
  title: string;
  reason: string;
  ctaLabel: string;
  href: string;
}

export interface SkillProfile {
  skills: SkillScore[];
  weakest: SkillScore;
  recommendation: Recommendation;
}

const clamp100 = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/** 목표 대비 비율(0~100). 목표가 0이면 100. */
function ratio(current: number, target: number): number {
  return target > 0 ? clamp100((current / target) * 100) : 100;
}

const REC_COPY: Record<SkillId, { title: string; reason: string; ctaLabel: string }> = {
  vocab: { title: "어휘 보강이 필요해요", reason: "숙달한 단어가 목표에 못 미쳐요. 플래시카드로 채워보세요.", ctaLabel: "플래시카드" },
  chunks: { title: "표현 보강이 필요해요", reason: "자주 쓰는 청크 복습이 부족해요. 청크로 표현을 늘려요.", ctaLabel: "청크 복습" },
  listening: { title: "듣기 보강이 필요해요", reason: "쉐도잉이 부족해요. 영상을 따라 말하며 귀를 열어요.", ctaLabel: "쉐도잉" },
  reading: { title: "읽기 보강이 필요해요", reason: "원서 읽기 진도가 더뎌요. 오늘 한 챕터 읽어봐요.", ctaLabel: "원서 읽기" },
  speaking: { title: "말하기 보강이 필요해요", reason: "AI대화 연습이 부족해요. 실전 회화로 산출을 늘려요.", ctaLabel: "AI 대화" },
  writing: { title: "쓰기·번역 보강이 필요해요", reason: "번역·영작 연습이 부족해요. 번역가 모드로 표현력을 키워요.", ctaLabel: "번역가 모드" },
  habit: { title: "매일 루틴이 열쇠예요", reason: "스트릭이 짧아요. 오늘 루틴부터 완료해 흐름을 이어가요.", ctaLabel: "루틴 계속" },
};

/**
 * 스킬 프로필 산출. 약한 스킬 우선순위(동점 시 앞선 것)로 결정적 선택.
 * 순서는 초심자에게 가장 실행 가능한 행동(어휘)부터 두었다.
 */
export function computeSkillProfile(signals: LearnerSignals, phase: Phase): SkillProfile {
  const t = signals.translation;
  const r = signals.roleplay;

  const writingScore =
    t.count > 0 ? t.avgTotal : signals.journalCount > 0 ? clamp100(signals.journalCount * 20) : 0;

  const skills: SkillScore[] = [
    { id: "vocab", label: "어휘", score: ratio(signals.masteredWords, PHASE_WORD_TARGET[phase]), taskId: "flashcard_review", href: "/learn/flashcards" },
    { id: "chunks", label: "표현", score: ratio(signals.masteredChunks, PHASE_CHUNK_TARGET[phase]), taskId: "verb_conjugation", href: "/learn/chunks" },
    { id: "listening", label: "듣기", score: ratio(signals.shadowingCompleted, 5), taskId: "youtube_listening", href: "/learn/shadowing" },
    { id: "reading", label: "읽기", score: ratio(signals.readingCompleted, 3), taskId: "reading_aloud", href: "/learn/reading" },
    { id: "speaking", label: "말하기", score: r.count > 0 ? clamp100(r.avgTotal) : 0, href: "/learn/roleplay" },
    { id: "writing", label: "쓰기·번역", score: clamp100(writingScore), href: "/learn/translate" },
    { id: "habit", label: "습관", score: ratio(signals.currentStreak, PHASE_STREAK_TARGET), href: "/learn/routine" },
  ];

  // 가장 낮은 점수(동점이면 배열 앞선 스킬). skills 는 항상 비어있지 않다.
  const weakest = skills.reduce((min, s) => (s.score < min.score ? s : min));

  const copy = REC_COPY[weakest.id];
  return {
    skills,
    weakest,
    recommendation: {
      skillId: weakest.id,
      taskId: weakest.taskId,
      title: copy.title,
      reason: copy.reason,
      ctaLabel: copy.ctaLabel,
      href: weakest.href,
    },
  };
}
