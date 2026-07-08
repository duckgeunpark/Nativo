"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Volume2, CheckCircle2, XCircle, RotateCcw, PartyPopper } from "lucide-react";
import { type StudyChunk } from "@/lib/chunk-review";
import { gradeChunk } from "./actions";
import { addToMyChunks, removeFromMyChunks } from "./dictionary/actions";
import { speak } from "@/lib/tts";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";

type Mode = "flip" | "mc" | "production" | "nuance";

const MODES: { value: Mode; label: string }[] = [
  { value: "flip", label: "뒤집기" },
  { value: "mc", label: "객관식" },
  { value: "production", label: "주관식" },
  { value: "nuance", label: "뉘앙스" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** 채점 결과를 DB 에 반영하고 다음으로 넘기는 콜백. correct=null 이면 무채점(뒤집기). */
type AdvanceFn = (correct: boolean | null) => void;

function ChunkHeart({ chunk }: { chunk: StudyChunk }) {
  return (
    <HeartToggle
      initialActive={chunk.source === "manual"}
      onAdd={() =>
        addToMyChunks({
          language: chunk.language,
          expression: chunk.expression,
          translation_ko: chunk.translation_ko ?? chunk.expression,
          situation: chunk.situation,
          nuance: chunk.nuance,
          example_1: chunk.example_1,
          example_2: chunk.example_2,
          category: chunk.category,
          level: chunk.level,
        })
      }
      onRemove={() =>
        removeFromMyChunks({ language: chunk.language, expression: chunk.expression })
      }
    />
  );
}

export function ChunkReviewSession({ chunks }: { chunks: StudyChunk[] }) {
  const [mode, setMode] = useState<Mode>("flip");
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const translations = useMemo(
    () => [...new Set(chunks.map((c) => c.translation_ko).filter((t): t is string => !!t))],
    [chunks],
  );
  const expressions = useMemo(
    () => [...new Set(chunks.map((c) => c.expression))],
    [chunks],
  );
  const mcAvailable = translations.length >= 4;
  const nuanceAvailable = expressions.length >= 4;

  const chunk = chunks[index];
  const done = index >= chunks.length;

  const modeOptions: SegmentedTabOption[] = MODES.map((m) => ({
    value: m.value,
    label: m.label,
    disabled: (m.value === "mc" && !mcAvailable) || (m.value === "nuance" && !nuanceAvailable),
  }));

  async function advance(correct: boolean | null) {
    if (!chunk || saving) return;
    setSaving(true);
    setError(null);
    const res = await gradeChunk(chunk.id, chunk.review_count, correct);
    setSaving(false);
    if (!res.ok) {
      setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }
    setReviewed((n) => n + 1);
    setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setReviewed(0);
    setError(null);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PartyPopper className="h-7 w-7" aria-hidden />
          </span>
          <p className="font-semibold">{reviewed}개 청크 복습 완료!</p>
          <p className="text-sm text-muted-foreground">오늘의 청크 복습을 모두 끝냈어요.</p>
          <div className="mt-2 flex justify-center gap-2">
            <Button variant="outline" onClick={restart}>
              다시
            </Button>
            <Button asChild>
              <Link href="/learn/chunks/dictionary">내 청크 사전</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col items-center gap-2">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {index + 1} / {chunks.length}
        </p>
        <ProgressBar
          value={index}
          max={chunks.length}
          tone="primary"
          aria-label="복습 진행률"
          className="max-w-xs"
        />
      </div>

      <SegmentedTabs
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        options={modeOptions}
        aria-label="복습 모드"
        className="mb-5"
      />

      <ChunkRunner
        key={`${mode}-${index}`}
        chunk={chunk!}
        mode={mode}
        translations={translations}
        expressions={expressions}
        saving={saving}
        onAdvance={advance}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChunkRunner({
  chunk,
  mode,
  translations,
  expressions,
  saving,
  onAdvance,
}: {
  chunk: StudyChunk;
  mode: Mode;
  translations: string[];
  expressions: string[];
  saving: boolean;
  onAdvance: AdvanceFn;
}) {
  if (mode === "flip") return <FlipChunk chunk={chunk} saving={saving} onAdvance={onAdvance} />;
  if (mode === "mc")
    return (
      <McChunk chunk={chunk} translations={translations} saving={saving} onAdvance={onAdvance} />
    );
  if (mode === "nuance")
    return (
      <NuanceChunk
        chunk={chunk}
        expressions={expressions}
        saving={saving}
        onAdvance={onAdvance}
      />
    );
  return <ProductionChunk chunk={chunk} saving={saving} onAdvance={onAdvance} />;
}

function CategoryBadge({ chunk }: { chunk: StudyChunk }) {
  if (!chunk.category) return null;
  return <Badge variant="muted">{CATEGORY_LABEL[chunk.category] ?? chunk.category}</Badge>;
}

/** 표현 발음 듣기 아이콘 — 카드 클릭(뒤집기)과 겹치지 않게 전파를 막는다. */
function ChunkSpeaker({ chunk }: { chunk: StudyChunk }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(chunk.expression, chunk.language);
      }}
      aria-label="발음 듣기"
      className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Volume2 className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** 로직1 — 인식: 카드를 탭하면 앞(표현)↔뒤(뜻·상황·뉘앙스)로 뒤집힌다. 무채점 진행. */
function FlipChunk({
  chunk,
  saving,
  onAdvance,
}: {
  chunk: StudyChunk;
  saving: boolean;
  onAdvance: AdvanceFn;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    speak(chunk.expression, chunk.language);
  }, [chunk.id, chunk.expression, chunk.language]);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "카드 앞면(표현) 보기" : "카드 뒷면(뜻) 보기"}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="relative cursor-pointer select-none transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* 앞/뒤 공통 고정 높이 — 뒤집을 때 카드 크기가 출렁이지 않게 한다 */}
        <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 overflow-hidden px-6 py-10 text-center">
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {flipped ? "Back" : "Front"}
            </span>
            <CategoryBadge chunk={chunk} />
          </div>
          <div className="absolute right-4 top-4" onClick={(e) => e.stopPropagation()}>
            <ChunkHeart chunk={chunk} />
          </div>
          {flipped ? (
            <>
              <div className="flex max-w-full items-center justify-center gap-2">
                <p className="line-clamp-1 break-words text-xl font-bold">{chunk.expression}</p>
                <ChunkSpeaker chunk={chunk} />
              </div>
              <div className="w-full max-w-md space-y-1.5 rounded-lg bg-secondary/60 p-4 text-left text-sm">
                <p className="break-words text-lg font-semibold">{chunk.translation_ko}</p>
                {chunk.situation && (
                  <p className="break-words text-muted-foreground">상황: {chunk.situation}</p>
                )}
                {chunk.nuance && (
                  <p className="break-words text-muted-foreground">뉘앙스: {chunk.nuance}</p>
                )}
                {chunk.example_1 && (
                  <p className="line-clamp-2 break-words text-muted-foreground">
                    · {chunk.example_1}
                  </p>
                )}
                {chunk.example_2 && (
                  <p className="line-clamp-2 break-words text-muted-foreground">
                    · {chunk.example_2}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex max-w-full items-center justify-center gap-2">
              <p className="line-clamp-2 break-words text-[clamp(1.5rem,6vw,2.25rem)] font-bold leading-tight">
                {chunk.expression}
              </p>
              <ChunkSpeaker chunk={chunk} />
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4">
        <Button
          type="button"
          className="w-full"
          disabled={saving || !flipped}
          onClick={() => onAdvance(null)}
        >
          다음
        </Button>
      </div>
    </>
  );
}

/** 로직2 — 이해: 표현 → 한국어 뜻 객관식. */
function McChunk({
  chunk,
  translations,
  saving,
  onAdvance,
}: {
  chunk: StudyChunk;
  translations: string[];
  saving: boolean;
  onAdvance: AdvanceFn;
}) {
  const answer = chunk.translation_ko ?? "";
  const options = useMemo(() => {
    const distractors = shuffle(translations.filter((t) => t !== answer)).slice(0, 3);
    return shuffle([answer, ...distractors]);
  }, [chunk.id, translations, answer]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    speak(chunk.expression, chunk.language);
  }, [chunk.id, chunk.expression, chunk.language]);

  return (
    <>
      <Card>
        <CardContent className="relative flex flex-col items-center gap-2 py-8 text-center">
          <div className="absolute right-4 top-4">
            <ChunkHeart chunk={chunk} />
          </div>
          <CategoryBadge chunk={chunk} />
          <div className="flex max-w-full items-center justify-center gap-2">
            <h2 className="line-clamp-2 break-words text-[clamp(1.375rem,5vw,1.75rem)] font-bold">
              {chunk.expression}
            </h2>
            <ChunkSpeaker chunk={chunk} />
          </div>
          <p className="text-sm text-muted-foreground">알맞은 뜻을 고르세요</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const isAnswer = opt === answer;
          const isPicked = opt === picked;
          let extra = "";
          if (picked) {
            if (isAnswer) extra = "border-success bg-success/10";
            else if (isPicked) extra = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(opt)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent",
                extra,
              )}
            >
              <span className="line-clamp-2 break-words">{opt}</span>
              {picked && isAnswer && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
              )}
              {picked && isPicked && !isAnswer && (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4">
          <Button
            type="button"
            className="w-full"
            disabled={saving}
            onClick={() => onAdvance(picked === answer)}
          >
            다음
          </Button>
        </div>
      )}
    </>
  );
}

/** 로직3 — 생산: 상황/뜻 → 표현 주관식 입력. 오답 시 다시 시도 가능. */
function ProductionChunk({
  chunk,
  saving,
  onAdvance,
}: {
  chunk: StudyChunk;
  saving: boolean;
  onAdvance: AdvanceFn;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = norm(value) === norm(chunk.expression);

  function retry() {
    setChecked(false);
    setValue("");
  }

  return (
    <>
      <Card>
        <CardContent className="relative flex flex-col items-center gap-2 py-8 text-center">
          <div className="absolute right-4 top-4">
            <ChunkHeart chunk={chunk} />
          </div>
          <CategoryBadge chunk={chunk} />
          <h2 className="line-clamp-2 break-words text-[clamp(1.125rem,4.5vw,1.5rem)] font-bold">
            {chunk.translation_ko}
          </h2>
          {chunk.situation && (
            <p className="line-clamp-2 break-words text-sm text-muted-foreground">
              상황: {chunk.situation}
            </p>
          )}
          <p className="text-sm text-muted-foreground">이 상황의 표현을 입력하세요</p>
        </CardContent>
      </Card>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!checked) setChecked(true);
        }}
      >
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="표현 입력"
          disabled={checked}
        />
        {checked && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {correct ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="break-words">
              {correct ? "정답이에요" : `정답: ${chunk.expression}`}
            </span>
          </div>
        )}
        {checked ? (
          <div className="flex items-center gap-2">
            {!correct && (
              <Button type="button" variant="outline" className="flex-1" onClick={retry}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                다시 시도
              </Button>
            )}
            <Button
              type="button"
              className="flex-1"
              disabled={saving}
              onClick={() => onAdvance(correct)}
            >
              다음
            </Button>
          </div>
        ) : (
          <Button type="submit" className="w-full" disabled={saving || !value.trim()}>
            확인
          </Button>
        )}
      </form>
    </>
  );
}

/** 로직4 — 뉘앙스: 상황 설명 → 알맞은 표현 고르기(원어민 감각). */
function NuanceChunk({
  chunk,
  expressions,
  saving,
  onAdvance,
}: {
  chunk: StudyChunk;
  expressions: string[];
  saving: boolean;
  onAdvance: AdvanceFn;
}) {
  const prompt = chunk.situation || chunk.nuance || chunk.translation_ko || "";
  const options = useMemo(() => {
    const distractors = shuffle(expressions.filter((e) => e !== chunk.expression)).slice(0, 3);
    return shuffle([chunk.expression, ...distractors]);
  }, [chunk.id, chunk.expression, expressions]);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardContent className="relative flex flex-col items-center gap-2 py-8 text-center">
          <div className="absolute right-4 top-4">
            <ChunkHeart chunk={chunk} />
          </div>
          <CategoryBadge chunk={chunk} />
          <p className="text-sm text-muted-foreground">이 상황에 가장 알맞은 표현은?</p>
          <h2 className="line-clamp-3 break-words text-lg font-semibold">{prompt}</h2>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const isAnswer = opt === chunk.expression;
          const isPicked = opt === picked;
          let extra = "";
          if (picked) {
            if (isAnswer) extra = "border-success bg-success/10";
            else if (isPicked) extra = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => {
                setPicked(opt);
                speak(opt, chunk.language);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent",
                extra,
              )}
            >
              <span className="line-clamp-2 break-words">{opt}</span>
              {picked && isAnswer && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
              )}
              {picked && isPicked && !isAnswer && (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4">
          <Button
            type="button"
            className="w-full"
            disabled={saving}
            onClick={() => onAdvance(picked === chunk.expression)}
          >
            다음
          </Button>
        </div>
      )}
    </>
  );
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
