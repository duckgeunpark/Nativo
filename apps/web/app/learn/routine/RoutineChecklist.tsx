"use client";

import { useEffect, useState } from "react";
import type { DailyTaskId, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";
import { STREAK_GOAL_DAYS, type RoutineTask } from "@/lib/routine";

/** 로컬 타임존 기준 YYYY-MM-DD (offsetDays 만큼 가감). */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  language: Language;
  phase: number;
  tasks: RoutineTask[];
}

export function RoutineChecklist({ language, phase, tasks }: Props) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<DailyTaskId>>(new Set());
  const [yesterdayStreak, setYesterdayStreak] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data: rows } = await supabase
        .from("daily_logs")
        .select("log_date, tasks_completed, streak_day")
        .eq("user_id", user.id)
        .eq("language", language)
        .in("log_date", [localDate(0), localDate(-1)]);

      if (!active) return;
      const todayRow = rows?.find((r) => r.log_date === localDate(0));
      const yesterdayRow = rows?.find((r) => r.log_date === localDate(-1));
      setCompleted(new Set(todayRow?.tasks_completed ?? []));
      setYesterdayStreak(yesterdayRow?.streak_day ?? 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [language]);

  const isComplete = tasks.length > 0 && tasks.every((t) => completed.has(t.id));
  const studyMinutes = tasks
    .filter((t) => completed.has(t.id))
    .reduce((sum, t) => sum + t.minutes, 0);
  const currentStreak = isComplete ? yesterdayStreak + 1 : yesterdayStreak;

  async function toggle(id: DailyTaskId) {
    if (saving) return;
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);
    await save(next);
  }

  async function save(set: Set<DailyTaskId>) {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const completedIds = tasks.map((t) => t.id).filter((id) => set.has(id));
    const complete = completedIds.length === tasks.length && tasks.length > 0;
    const minutes = tasks
      .filter((t) => set.has(t.id))
      .reduce((sum, t) => sum + t.minutes, 0);

    const payload: TablesInsert<"daily_logs"> = {
      user_id: user.id,
      log_date: localDate(0),
      phase,
      language,
      tasks_completed: completedIds,
      study_minutes: minutes,
      streak_day: complete ? yesterdayStreak + 1 : 0,
    };

    const { error: upsertError } = await supabase
      .from("daily_logs")
      .upsert(payload, { onConflict: "user_id,log_date,language" });

    setSaving(false);
    if (upsertError) setError(`저장 실패: ${upsertError.message}`);
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-neutral-100" />;
  }

  return (
    <div>
      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="오늘 학습" value={`${studyMinutes}분`} />
        <Stat label="현재 스트릭" value={`${currentStreak}일`} />
        <Stat label="목표" value={`${STREAK_GOAL_DAYS}일`} />
      </section>

      <ul className="space-y-3">
        {tasks.map((task) => {
          const checked = completed.has(task.id);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => toggle(task.id)}
                disabled={saving}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                  checked
                    ? "border-green-300 bg-green-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                      checked
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-neutral-300"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className={checked ? "line-through opacity-60" : ""}>
                    {task.label}
                  </span>
                </span>
                <span className="text-sm text-neutral-500">{task.minutes}분</span>
              </button>
            </li>
          );
        })}
      </ul>

      {isComplete && (
        <p className="mt-6 rounded-lg bg-green-50 p-4 text-center text-sm font-medium text-green-700">
          🎉 오늘의 루틴 완료! 스트릭 {currentStreak}일째
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
