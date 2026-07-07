"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessagesSquare, Sparkles, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { NuanceQuestion } from "@/lib/ai-nuance";

const STORAGE_KEY = "nativo.nuance.session.v1";

interface Session {
  questions: NuanceQuestion[];
  index: number;
  score: number;
  picked: number | null;
  /** 오답을 낸 문제의 인덱스 — 완료 후 "약점 복습"에 사용. */
  wrong: number[];
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(session: Session | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * AI 생성 뉘앙스 퀴즈 — 상황에 가장 알맞은 표현 고르기 + 해설.
 * 인트로 / 진행 / 완료 3상태를 같은 카드 컨테이너 안에서 전환하며, 진행 상태는 새로고침해도 유지된다.
 * (OpenAI 키 없으면 안내 메시지)
 */
export function NuanceQuiz() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 새로고침 시 진행 중이던 세션 복원
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  function update(next: Session | null) {
    setSession(next);
    persist(next);
  }

  async function start(only?: NuanceQuestion[]) {
    if (loading) return;
    if (only && only.length > 0) {
      update({ questions: only, index: 0, score: 0, picked: null, wrong: [] });
      return;
    }
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
      update({ questions: data.questions, index: 0, score: 0, picked: null, wrong: [] });
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function pick(i: number) {
    if (!session || session.picked !== null) return;
    const correct = i === session.questions[session.index]!.answer;
    update({
      ...session,
      picked: i,
      score: correct ? session.score + 1 : session.score,
      wrong: correct ? session.wrong : [...session.wrong, session.index],
    });
  }

  function next() {
    if (!session) return;
    update({ ...session, picked: null, index: session.index + 1 });
  }

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    );
  }

  // ── 인트로 ────────────────────────────────────────────
  if (!session) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessagesSquare className="h-8 w-8" aria-hidden />
          </span>
          <div>
            <p className="font-display text-xl font-bold">Nuance matters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              상황에 가장 자연스러운 표현을 고르며 원어민 감각을 길러요.
            </p>
          </div>
          <ul className="grid w-full max-w-xs gap-2 text-left text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-primary/70" aria-hidden /> 실전 상황 기반 문제
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary/70" aria-hidden /> 미묘한 뉘앙스 차이
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary/70" aria-hidden /> 즉각적인 해설
            </li>
          </ul>
          <Button onClick={() => start()} disabled={loading} size="lg" className="w-full max-w-xs">
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {loading ? "문제 만드는 중…" : "퀴즈 시작"}
          </Button>
          <ErrorBanner message={error} />
        </CardContent>
      </Card>
    );
  }

  const { questions, index, score, picked, wrong } = session;
  const done = index >= questions.length;

  // ── 완료 ────────────────────────────────────────────
  if (done) {
    const accuracy = questions.length ? Math.round((score / questions.length) * 100) : 0;
    const wrongQuestions = wrong.map((i) => questions[i]!).filter(Boolean);
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <div>
            <p className="font-display text-xl font-bold">완료!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {questions.length}문제 중 <b>{score}</b>개 정답
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <div className="rounded-lg border py-3">
              <p className="text-xs text-muted-foreground">정답 수</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">
                {score}
                <span className="text-xs text-muted-foreground"> / {questions.length}</span>
              </p>
            </div>
            <div className="rounded-lg border py-3">
              <p className="text-xs text-muted-foreground">정확도</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-highlight">{accuracy}%</p>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            {wrongQuestions.length > 0 && (
              <Button onClick={() => start(wrongQuestions)} variant="outline" className="w-full">
                틀린 문제 {wrongQuestions.length}개 다시 풀기
              </Button>
            )}
            <Button onClick={() => start()} disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {loading ? "생성 중…" : "새 퀴즈"}
            </Button>
          </div>
          <ErrorBanner message={error} />
        </CardContent>
      </Card>
    );
  }

  // ── 진행 ────────────────────────────────────────────
  const q = questions[index]!;
  return (
    <div>
      <div className="sticky top-16 z-10 mb-3 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-3 py-2 backdrop-blur lg:top-4">
        <span className="shrink-0 text-sm text-muted-foreground">
          {index + 1} / {questions.length}
        </span>
        <ProgressBar value={index} max={questions.length} tone="highlight" className="flex-1" />
        <span className="shrink-0 text-sm font-medium">정답 {score}</span>
      </div>
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-base font-medium">{q.prompt}</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          const revealed = picked !== null;
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => pick(i)}
              className={cn(
                "flex w-full items-start justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm leading-relaxed transition hover:bg-secondary disabled:hover:bg-transparent",
                revealed && isAnswer && "border-success bg-success/10",
                revealed && isPicked && !isAnswer && "border-destructive bg-destructive/10",
              )}
            >
              <span className="min-w-0 break-words">{opt}</span>
              {revealed && isAnswer && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> 정답
                </span>
              )}
              {revealed && isPicked && !isAnswer && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                  <XCircle className="h-4 w-4" aria-hidden /> 오답
                </span>
              )}
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
