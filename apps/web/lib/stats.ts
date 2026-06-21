/**
 * 학습 통계 집계 — 기존 테이블(flashcards/chunks/daily_logs)에서 즉시 계산하는 순수 로직.
 *
 * study_stats 테이블에 누적값을 따로 쓰지 않고, 조회 시점에 원본에서 산출한다.
 * (집계 불일치/마이그레이션 없이 항상 정확. 데이터가 커지면 캐싱/머티리얼라이즈로 전환 가능.)
 */

import { COMPLETE_THRESHOLD } from "./flashcards";
import { CHUNK_COMPLETE_THRESHOLD } from "./chunk-review";

export interface DailyLogRow {
  log_date: string; // YYYY-MM-DD
  study_minutes: number;
  streak_day: number;
}

export interface StudyStats {
  totalWords: number;
  completedWords: number;
  totalChunks: number;
  completedChunks: number;
  /** 오늘까지 이어진 연속 학습일(끊겼으면 0). */
  currentStreak: number;
  /** 역대 최장 연속일. */
  longestStreak: number;
  totalStudyMinutes: number;
  /** 기록이 있는 학습일 수. */
  studyDays: number;
}

/** YYYY-MM-DD 에서 days 만큼 뺀 날짜 문자열(UTC 기준 단순 계산). */
function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function aggregateStats(input: {
  flashcards: { repetitions: number }[];
  chunks: { review_count: number }[];
  dailyLogs: DailyLogRow[];
  today: string; // YYYY-MM-DD
}): StudyStats {
  const { flashcards, chunks, dailyLogs, today } = input;

  const completedWords = flashcards.filter((c) => c.repetitions >= COMPLETE_THRESHOLD).length;
  const completedChunks = chunks.filter(
    (c) => c.review_count >= CHUNK_COMPLETE_THRESHOLD,
  ).length;

  const longestStreak = dailyLogs.reduce((max, l) => Math.max(max, l.streak_day), 0);
  const totalStudyMinutes = dailyLogs.reduce((sum, l) => sum + (l.study_minutes || 0), 0);
  const studyDays = dailyLogs.filter((l) => l.study_minutes > 0 || l.streak_day > 0).length;

  // 현재 스트릭: 가장 최근 기록일이 오늘 또는 어제면 그 값, 아니면 끊긴 것(0).
  const yesterday = shiftDate(today, -1);
  const latest = dailyLogs
    .slice()
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))[0];
  const currentStreak =
    latest && (latest.log_date === today || latest.log_date === yesterday)
      ? latest.streak_day
      : 0;

  return {
    totalWords: flashcards.length,
    completedWords,
    totalChunks: chunks.length,
    completedChunks,
    currentStreak,
    longestStreak,
    totalStudyMinutes,
    studyDays,
  };
}
