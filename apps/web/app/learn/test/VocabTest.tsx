"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";
import {
  PHASE1,
  evaluatePhase1,
  isPhase1Complete,
  type Phase1Conditions,
} from "@/lib/phase";

export interface QuizCard {
  word: string;
  meaning: string;
}

interface Question {
  word: string;
  options: string[];
  correct: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function buildQuestions(pool: QuizCard[]): Question[] {
  const picked = shuffle(pool).slice(0, PHASE1.TEST_QUESTION_COUNT);
  return picked.map((card) => {
    const distractors = shuffle(pool.filter((c) => c.meaning !== card.meaning))
      .slice(0, PHASE1.TEST_CHOICES - 1)
      .map((c) => c.meaning);
    const options = shuffle([card.meaning, ...distractors]);
    return { word: card.word, options, correct: options.indexOf(card.meaning) };
  });
}

export function VocabTest({ pool, language }: { pool: QuizCard[]; language: Language }) {
  const router = useRouter();
  const [questions] = useState<Question[]>(() => buildQuestions(pool));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = questions.length;
  const question = questions[index];

  function choose(optionIndex: number) {
    if (selected !== null || !question) return;
    setSelected(optionIndex);
    if (optionIndex === question.correct) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  if (finished) {
    const scorePct = Math.round((score / total) * 100);
    return <Result scorePct={scorePct} language={language} router={router} />;
  }

  if (!question) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <span>
          {index + 1} / {total}
        </span>
        <span>점수 {score}</span>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-3xl font-bold">{question.word}</h2>
        <p className="mt-2 text-sm text-neutral-500">알맞은 뜻을 고르세요</p>
      </div>

      <div className="mt-6 space-y-3">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correct;
          const isPicked = i === selected;
          let cls = "border-neutral-200 bg-white hover:bg-neutral-50";
          if (selected !== null) {
            if (isCorrect) cls = "border-green-400 bg-green-50 text-green-800";
            else if (isPicked) cls = "border-red-400 bg-red-50 text-red-800";
            else cls = "border-neutral-200 bg-white opacity-60";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={selected !== null}
              onClick={() => choose(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          type="button"
          onClick={next}
          className="mt-6 w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-800"
        >
          {index + 1 >= total ? "결과 보기" : "다음"}
        </button>
      )}
    </div>
  );
}

function Result({
  scorePct,
  language,
  router,
}: {
  scorePct: number;
  language: Language;
  router: ReturnType<typeof useRouter>;
}) {
  const passed = scorePct >= PHASE1.REQUIRED_TEST_SCORE;
  const [conditions, setConditions] = useState<Phase1Conditions | null>(null);
  const [loadingCond, setLoadingCond] = useState(false);
  const [graduating, setGraduating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkGraduation() {
    setLoadingCond(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { count: cardCount } = await supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("language", language);

    const { data: streakRow } = await supabase
      .from("daily_logs")
      .select("streak_day")
      .eq("user_id", user.id)
      .eq("language", language)
      .order("streak_day", { ascending: false })
      .limit(1)
      .maybeSingle();

    setConditions(
      evaluatePhase1({
        cardCount: cardCount ?? 0,
        bestStreak: streakRow?.streak_day ?? 0,
        testScore: scorePct,
      }),
    );
    setLoadingCond(false);
  }

  async function graduate() {
    if (!conditions) return;
    setGraduating(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error: upsertError } = await supabase.from("phase_completions").upsert(
      {
        user_id: user.id,
        language,
        phase: 1,
        conditions_met: {
          flashcard_count: conditions.cards.current ?? 0,
          streak_days: conditions.streak.current ?? 0,
          vocab_test_score: scorePct,
        },
        final_score: scorePct,
      },
      { onConflict: "user_id,language,phase" },
    );

    if (upsertError) {
      setGraduating(false);
      setError(`졸업 처리 실패: ${upsertError.message}`);
      return;
    }

    await supabase.from("users").update({ current_phase: 2 }).eq("id", user.id);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <p className="text-5xl">{passed ? "🎯" : "💪"}</p>
      <p className="mt-3 text-2xl font-bold">{scorePct}점</p>
      <p className="mt-1 text-sm text-neutral-600">
        {passed
          ? `합격선 ${PHASE1.REQUIRED_TEST_SCORE}점을 넘었어요!`
          : `합격선 ${PHASE1.REQUIRED_TEST_SCORE}점에 미치지 못했어요.`}
      </p>

      {passed && conditions === null && (
        <button
          type="button"
          onClick={checkGraduation}
          disabled={loadingCond}
          className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
        >
          {loadingCond ? "확인 중…" : "Phase 1 졸업 조건 확인"}
        </button>
      )}

      {conditions && (
        <div className="mt-6 space-y-2 text-left text-sm">
          <ConditionRow label="플래시카드" c={conditions.cards} unit="개" />
          <ConditionRow label="루틴 스트릭" c={conditions.streak} unit="일" />
          <ConditionRow label="단어 테스트" c={conditions.test} unit="점" />

          {isPhase1Complete(conditions) ? (
            <button
              type="button"
              onClick={graduate}
              disabled={graduating}
              className="mt-4 w-full rounded-lg bg-brand px-4 py-3 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
            >
              {graduating ? "졸업 처리 중…" : "🎓 Phase 1 졸업하고 Phase 2 잠금 해제"}
            </button>
          ) : (
            <p className="mt-3 text-center text-neutral-500">
              아직 충족하지 못한 조건이 있어요. 계속 학습해 보세요!
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ConditionRow({
  label,
  c,
  unit,
}: {
  label: string;
  c: { met: boolean; current: number | null; required: number };
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2">
      <span>{label}</span>
      <span className={c.met ? "text-green-600" : "text-neutral-500"}>
        {c.met ? "✓ " : ""}
        {c.current ?? 0}/{c.required}
        {unit}
      </span>
    </div>
  );
}
