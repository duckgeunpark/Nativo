"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { NuanceQuestion } from "@/lib/ai-nuance";

/**
 * AI 생성 뉘앙스 퀴즈 — 상황에 가장 알맞은 표현 고르기 + 해설.
 * (OpenAI 키 없으면 안내 메시지)
 */
export function NuanceQuiz() {
  const [questions, setQuestions] = useState<NuanceQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nuance/quiz", { method: "POST" });
      if (res.status === 503) {
        setError("뉘앙스 퀴즈는 OpenAI 키가 설정된 환경에서만 동작합니다.");
        return;
      }
      if (!res.ok) {
        setError("문제 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as { questions: NuanceQuestion[] };
      setQuestions(data.questions);
      setIndex(0);
      setPicked(null);
      setScore(0);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function pick(i: number) {
    if (picked !== null || !questions) return;
    setPicked(i);
    if (i === questions[index]!.answer) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  if (!questions) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-5xl">🎯</p>
          <div>
            <p className="font-semibold">뉘앙스 퀴즈</p>
            <p className="mt-1 text-sm text-muted-foreground">
              상황에 가장 자연스러운 표현을 고르며 원어민 감각을 길러요.
            </p>
          </div>
          <Button onClick={start} disabled={loading}>
            {loading ? "문제 만드는 중…" : "퀴즈 시작"}
          </Button>
          <ErrorBanner message={error} />
        </CardContent>
      </Card>
    );
  }

  const done = index >= questions.length;
  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-5xl">✅</p>
          <p className="mt-3 font-semibold">
            {questions.length}문제 중 {score}개 정답!
          </p>
          <div className="mt-5">
            <Button onClick={start} disabled={loading}>
              {loading ? "생성 중…" : "새 퀴즈"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const q = questions[index]!;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {index + 1} / {questions.length}
        </span>
        <span>정답 {score}</span>
      </div>
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-base font-medium">{q.prompt}</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {q.options.map((opt, i) => {
          let extra = "";
          if (picked !== null) {
            if (i === q.answer) extra = "border-success bg-success/10";
            else if (i === picked) extra = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              onClick={() => pick(i)}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left transition hover:bg-secondary disabled:hover:bg-transparent",
                extra,
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4">
          {q.explanation && (
            <p className="mb-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm">{q.explanation}</p>
          )}
          <Button onClick={next} className="w-full">
            {index + 1 >= questions.length ? "결과 보기" : "다음"}
          </Button>
        </div>
      )}
    </div>
  );
}
