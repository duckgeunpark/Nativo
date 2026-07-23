"use server";

import type { DailyTaskId, Language, Phase, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";
import { getLearnerSignals } from "@/lib/learner-signals";
import { evaluatePhase, phaseConditionsSnapshot, type PhaseEvaluation } from "@/lib/phases";
import { computeSkillProfile, type SkillProfile } from "@/lib/skills";

/**
 * 오늘/어제 루틴 상태 + 최근 7일 완료 태스크 수 조회(주간 스트릭 달력용).
 * 날짜는 클라이언트 로컬 타임존 기준으로 전달된다. weekDates 는 오래된순→오늘순 7개.
 */
export async function getRoutineState(
  language: Language,
  today: string,
  yesterday: string,
  weekDates: string[],
): Promise<{
  completed: DailyTaskId[];
  yesterdayStreak: number;
  week: Record<string, number>;
}> {
  const supabase = createClient();
  const dates = Array.from(new Set([today, yesterday, ...weekDates]));
  const { data: rows } = await supabase
    .from("daily_logs")
    .select("log_date, tasks_completed, streak_day")
    .eq("user_id", LOCAL_USER_ID)
    .eq("language", language)
    .in("log_date", dates);

  const list = (rows ?? []) as {
    log_date: string;
    tasks_completed: DailyTaskId[];
    streak_day: number;
  }[];
  const todayRow = list.find((r) => r.log_date === today);
  const yesterdayRow = list.find((r) => r.log_date === yesterday);

  const week: Record<string, number> = {};
  for (const d of weekDates) {
    week[d] = list.find((r) => r.log_date === d)?.tasks_completed?.length ?? 0;
  }

  return {
    completed: todayRow?.tasks_completed ?? [],
    yesterdayStreak: yesterdayRow?.streak_day ?? 0,
    week,
  };
}

/** 오늘 루틴 진행 저장(upsert). */
export async function saveDailyRoutine(input: {
  language: Language;
  logDate: string;
  tasksCompleted: DailyTaskId[];
  studyMinutes: number;
  streakDay: number;
}): Promise<{ ok: boolean; error?: string }> {
  const payload: TablesInsert<"daily_logs"> = {
    user_id: LOCAL_USER_ID,
    log_date: input.logDate,
    phase: 1, // daily_logs.phase 는 NOT NULL (Phase 개념 제거 후 상수 유지)
    language: input.language,
    tasks_completed: input.tasksCompleted,
    study_minutes: input.studyMinutes,
    streak_day: input.streakDay,
  };
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_logs")
    .upsert(payload, { onConflict: "user_id,log_date,language" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface RoutineProgress {
  currentPhase: Phase;
  /** 이번 호출에서 진급한 최종 페이즈(진급 없었으면 null) → 축하 트리거. */
  advancedTo: Phase | null;
  evaluation: PhaseEvaluation;
  skillProfile: SkillProfile;
}

/**
 * 현재 페이즈 조건을 평가해 충족 시 자동 진급(+ phase_completions 기록)한 뒤,
 * (진급 후) 현재 페이즈의 조건 평가와 스킬 프로필을 돌려준다.
 *
 * - 여러 페이즈를 한 번에 충족하면 연속 진급(루프). Phase 5 는 종착(진급 없음).
 * - 멱등: phase_completions 는 UNIQUE(user,lang,phase) 로 upsert, current_phase 는
 *   기대 페이즈에서만 올려 동시 호출/재호출에도 중복 진급하지 않는다.
 * - 페이지 로드와 루틴 완료 직후 양쪽에서 호출하는 단일 진입점.
 */
export async function checkAndAdvancePhase(
  language: Language,
  today: string,
): Promise<RoutineProgress> {
  const supabase = createClient();
  const signals = await getLearnerSignals(language, today);

  const { data: profile } = await supabase
    .from("users")
    .select("current_phase")
    .eq("id", LOCAL_USER_ID)
    .single();

  let phase = (profile?.current_phase ?? 1) as Phase;
  let advancedTo: Phase | null = null;

  while (phase < 5) {
    if (!evaluatePhase(signals, phase).allMet) break;

    const completion: TablesInsert<"phase_completions"> = {
      user_id: LOCAL_USER_ID,
      language,
      phase,
      conditions_met: phaseConditionsSnapshot(signals, phase),
      final_score: signals.roleplay.avgTotal > 0 ? Math.round(signals.roleplay.avgTotal) : null,
    };
    await supabase
      .from("phase_completions")
      .upsert(completion, { onConflict: "user_id,language,phase" });

    const next = (phase + 1) as Phase;
    // 기대 페이즈에서만 올려 이중 진급 방지
    await supabase
      .from("users")
      .update({ current_phase: next })
      .eq("id", LOCAL_USER_ID)
      .eq("current_phase", phase);

    advancedTo = next;
    phase = next;
  }

  return {
    currentPhase: phase,
    advancedTo,
    evaluation: evaluatePhase(signals, phase),
    skillProfile: computeSkillProfile(signals, phase),
  };
}
