/**
 * 학습자 신호 집계(서버) — 기존 테이블에서 페이즈 평가·스킬 진단용 신호를 조립한다.
 *
 * 순수 평가 로직(phases.ts / skills.ts)에 넘길 LearnerSignals 를 만든다.
 * 단일 사용자(LOCAL_USER_ID) 로컬 모드. 스트릭/학습일은 stats.aggregateStats 재사용.
 */

import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";
import { COMPLETE_THRESHOLD } from "./flashcards";
import { CHUNK_COMPLETE_THRESHOLD } from "./chunk-review";
import { aggregateStats, type DailyLogRow } from "./stats";
import type { LearnerSignals } from "./phases";

/** null 을 제외한 평균(없으면 0). */
function avg(nums: (number | null | undefined)[]): number {
  const v = nums.filter((n): n is number => typeof n === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export async function getLearnerSignals(language: Language, today: string): Promise<LearnerSignals> {
  const supabase = createClient();

  const [fc, ch, logs, shadow, reading, journal, rp, tr] = await Promise.all([
    supabase.from("flashcards").select("repetitions").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase.from("chunks").select("review_count").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase.from("daily_logs").select("log_date, study_minutes, streak_day").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase.from("shadowing_videos").select("completed").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase.from("content_history").select("completed").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase.from("writing_journal").select("id").eq("user_id", LOCAL_USER_ID).eq("language", language),
    supabase
      .from("roleplay_sessions")
      .select("score_total, score_fluency, score_accuracy, score_vocab")
      .eq("user_id", LOCAL_USER_ID)
      .eq("language", language),
    supabase
      .from("translation_sessions")
      .select("score_total, score_accuracy, score_naturalness, score_nuance, passed")
      .eq("user_id", LOCAL_USER_ID)
      .eq("language", language),
  ]);

  const flashcards = (fc.data ?? []) as { repetitions: number }[];
  const chunks = (ch.data ?? []) as { review_count: number }[];
  const dailyLogs = (logs.data ?? []) as DailyLogRow[];
  const shadowRows = (shadow.data ?? []) as { completed: boolean }[];
  const readingRows = (reading.data ?? []) as { completed: boolean }[];
  const journalRows = (journal.data ?? []) as { id: string }[];
  const rpRows = (rp.data ?? []) as {
    score_total: number | null;
    score_fluency: number | null;
    score_accuracy: number | null;
    score_vocab: number | null;
  }[];
  const trRows = (tr.data ?? []) as {
    score_total: number | null;
    score_accuracy: number | null;
    score_naturalness: number | null;
    score_nuance: number | null;
    passed: boolean;
  }[];

  const stats = aggregateStats({ flashcards, chunks, dailyLogs, today });

  return {
    masteredWords: flashcards.filter((c) => c.repetitions >= COMPLETE_THRESHOLD).length,
    masteredChunks: chunks.filter((c) => c.review_count >= CHUNK_COMPLETE_THRESHOLD).length,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    studyDays: stats.studyDays,
    shadowingCompleted: shadowRows.filter((r) => r.completed).length,
    readingCompleted: readingRows.filter((r) => r.completed).length,
    journalCount: journalRows.length,
    roleplay: {
      count: rpRows.length,
      avgTotal: avg(rpRows.map((r) => r.score_total)),
      avgFluency: avg(rpRows.map((r) => r.score_fluency)),
      avgAccuracy: avg(rpRows.map((r) => r.score_accuracy)),
      avgVocab: avg(rpRows.map((r) => r.score_vocab)),
      bestTotal: rpRows.reduce((m, r) => Math.max(m, r.score_total ?? 0), 0),
    },
    translation: {
      count: trRows.length,
      passedCount: trRows.filter((r) => r.passed).length,
      avgTotal: avg(trRows.map((r) => r.score_total)),
      avgAccuracy: avg(trRows.map((r) => r.score_accuracy)),
      avgNaturalness: avg(trRows.map((r) => r.score_naturalness)),
      avgNuance: avg(trRows.map((r) => r.score_nuance)),
    },
  };
}
