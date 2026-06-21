/**
 * 학습 통계 집계(stats.ts) 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { aggregateStats, type DailyLogRow } from "./stats";

const TODAY = "2026-06-21";

describe("aggregateStats — 카운트", () => {
  it("총/완료 단어·청크 수를 임계값으로 센다", () => {
    const s = aggregateStats({
      flashcards: [{ repetitions: 5 }, { repetitions: 2 }, { repetitions: 9 }],
      chunks: [{ review_count: 5 }, { review_count: 0 }],
      dailyLogs: [],
      today: TODAY,
    });
    expect(s.totalWords).toBe(3);
    expect(s.completedWords).toBe(2); // repetitions>=5
    expect(s.totalChunks).toBe(2);
    expect(s.completedChunks).toBe(1);
  });
});

describe("aggregateStats — 스트릭", () => {
  it("오늘 기록이 있으면 그 streak_day 가 현재 스트릭", () => {
    const logs: DailyLogRow[] = [
      { log_date: "2026-06-19", study_minutes: 10, streak_day: 1 },
      { log_date: "2026-06-20", study_minutes: 10, streak_day: 2 },
      { log_date: "2026-06-21", study_minutes: 10, streak_day: 3 },
    ];
    const s = aggregateStats({ flashcards: [], chunks: [], dailyLogs: logs, today: TODAY });
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it("최근 기록이 어제면 현재 스트릭 유지", () => {
    const logs: DailyLogRow[] = [
      { log_date: "2026-06-20", study_minutes: 10, streak_day: 4 },
    ];
    const s = aggregateStats({ flashcards: [], chunks: [], dailyLogs: logs, today: TODAY });
    expect(s.currentStreak).toBe(4);
  });

  it("최근 기록이 이틀 전이면 스트릭 끊김(0)", () => {
    const logs: DailyLogRow[] = [
      { log_date: "2026-06-18", study_minutes: 10, streak_day: 7 },
    ];
    const s = aggregateStats({ flashcards: [], chunks: [], dailyLogs: logs, today: TODAY });
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(7); // 최장 기록은 유지
  });
});

describe("aggregateStats — 합계", () => {
  it("학습 시간 합과 학습일 수", () => {
    const logs: DailyLogRow[] = [
      { log_date: "2026-06-19", study_minutes: 15, streak_day: 1 },
      { log_date: "2026-06-20", study_minutes: 0, streak_day: 0 },
      { log_date: "2026-06-21", study_minutes: 30, streak_day: 2 },
    ];
    const s = aggregateStats({ flashcards: [], chunks: [], dailyLogs: logs, today: TODAY });
    expect(s.totalStudyMinutes).toBe(45);
    expect(s.studyDays).toBe(2); // minutes>0 또는 streak>0
  });

  it("빈 입력은 모두 0", () => {
    const s = aggregateStats({ flashcards: [], chunks: [], dailyLogs: [], today: TODAY });
    expect(s).toMatchObject({
      totalWords: 0,
      completedWords: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalStudyMinutes: 0,
      studyDays: 0,
    });
  });
});
