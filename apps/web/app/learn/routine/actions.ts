"use server";

import type { DailyTaskId, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/** 오늘/어제 루틴 상태 조회 (날짜는 클라이언트 로컬 타임존 기준으로 전달). */
export async function getRoutineState(
  language: Language,
  today: string,
  yesterday: string,
): Promise<{ completed: DailyTaskId[]; yesterdayStreak: number }> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("daily_logs")
    .select("log_date, tasks_completed, streak_day")
    .eq("user_id", LOCAL_USER_ID)
    .eq("language", language)
    .in("log_date", [today, yesterday]);

  const list = (rows ?? []) as {
    log_date: string;
    tasks_completed: DailyTaskId[];
    streak_day: number;
  }[];
  const todayRow = list.find((r) => r.log_date === today);
  const yesterdayRow = list.find((r) => r.log_date === yesterday);
  return {
    completed: todayRow?.tasks_completed ?? [],
    yesterdayStreak: yesterdayRow?.streak_day ?? 0,
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
