"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type StudyChunk } from "@/lib/chunk-review";
import { gradeChunk } from "./actions";
import { addToMyChunks, removeFromMyChunks } from "./dictionary/actions";
import { speak } from "@/lib/tts";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
        <CardContent className="py-12 text-center">
          <p className="text-5xl">✅</p>
          <p className="mt-3 font-semibold">{reviewed}개 청크 복습 완료!</p>
          <div className="mt-5 flex justify-center gap-2">
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          {MODES.map((m) => {
            const disabled =
              (m.value === "mc" && !mcAvailable) || (m.value === "nuance" && !nuanceAvailable);
            return (
              <button
                key={m.value}
                type="button"
                disabled={disabled}
                onClick={() => setMode(m.value)}
                title={disabled ? "이 모드는 청크 4개 이상 필요" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40",
                  mode === m.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <span className="text-sm text-muted-foreground">
          {index + 1} / {chunks.length}
        </span>
      </div>

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
  return (
    <div className="flex justify-end px-4 pt-3">
      <Badge variant="muted">{CATEGORY_LABEL[chunk.category] ?? chunk.category}</Badge>
    </div>
  );
}

/** 로직1 — 인식: 표현 탭=발음 / 하단 탭=뜻·상황·뉘앙스. 무채점 진행. */
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
      <Card>
        <CardContent className="min-h-56 p-0">
          <CategoryBadge chunk={chunk} />
          <button
            type="button"
            onClick={() => speak(chunk.expression, chunk.language)}
            aria-label="발음 듣기"
            className="flex w-full items-center justify-center gap-3 px-6 pb-4 pt-2 transition hover:bg-secondary/20"
          >
            <span className="text-2xl font-bold">{chunk.expression}</span>
            <span className="text-xl">🔊</span>
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label="뜻 보기"
            className="block min-h-24 w-full select-none border-t px-6 py-6 text-left transition hover:bg-secondary/30"
          >
            {flipped ? (
              <div className="space-y-2 text-sm">
                <p className="text-lg font-medium">{chunk.translation_ko}</p>
                {chunk.situation && (
                  <p className="text-muted-foreground">상황: {chunk.situation}</p>
                )}
                {chunk.nuance && <p className="text-muted-foreground">뉘앙스: {chunk.nuance}</p>}
                {chunk.example_1 && <p className="text-muted-foreground">· {chunk.example_1}</p>}
                {chunk.example_2 && <p className="text-muted-foreground">· {chunk.example_2}</p>}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">탭하여 뜻 보기</p>
            )}
          </button>
        </CardContent>
      </Card>
      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={saving || !flipped}
          onClick={() => onAdvance(null)}
        >
          다음
        </Button>
        <ChunkHeart chunk={chunk} />
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
        <CardContent className="py-8 text-center">
          <CategoryBadge chunk={chunk} />
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-2xl font-bold">{chunk.expression}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">알맞은 뜻을 고르세요</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          let extra = "";
          if (picked) {
            if (opt === answer) extra = "border-success bg-success/10";
            else if (opt === picked) extra = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(opt)}
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
      {picked && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={saving}
            onClick={() => onAdvance(picked === answer)}
          >
            다음
          </Button>
          <ChunkHeart chunk={chunk} />
        </div>
      )}
    </>
  );
}

/** 로직3 — 생산: 상황/뜻 → 표현 주관식 입력. */
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

  return (
    <>
      <Card>
        <CardContent className="py-8 text-center">
          <CategoryBadge chunk={chunk} />
          <h2 className="text-xl font-bold">{chunk.translation_ko}</h2>
          {chunk.situation && (
            <p className="mt-2 text-sm text-muted-foreground">상황: {chunk.situation}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">이 상황의 표현을 입력하세요</p>
          {checked && (
            <p
              className={cn(
                "mt-4 text-base font-semibold",
                correct ? "text-success" : "text-destructive",
              )}
            >
              {correct ? "✓ 정답" : `✗ 정답: ${chunk.expression}`}
            </p>
          )}
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
        {checked ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={saving}
              onClick={() => onAdvance(correct)}
            >
              다음
            </Button>
            <ChunkHeart chunk={chunk} />
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
        <CardContent className="py-8 text-center">
          <CategoryBadge chunk={chunk} />
          <p className="text-sm text-muted-foreground">이 상황에 가장 알맞은 표현은?</p>
          <h2 className="mt-2 text-lg font-semibold">{prompt}</h2>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          let extra = "";
          if (picked) {
            if (opt === chunk.expression) extra = "border-success bg-success/10";
            else if (opt === picked) extra = "border-destructive bg-destructive/10";
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
                "w-full rounded-lg border px-4 py-3 text-left transition hover:bg-secondary disabled:hover:bg-transparent",
                extra,
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={saving}
            onClick={() => onAdvance(picked === chunk.expression)}
          >
            다음
          </Button>
          <ChunkHeart chunk={chunk} />
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
