"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReviewChoice } from "@nativo/utils";
import { createClient } from "@/lib/supabase/client";
import { reviewUpdate, type StudyCard } from "@/lib/flashcards";
import { speak } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HeartToggle } from "./dictionary/HeartToggle";
import { addToMyWords, removeFromMyWords } from "./dictionary/actions";

type Mode = "flip" | "mc" | "production" | "dictation";

const MODES: { value: Mode; label: string }[] = [
  { value: "flip", label: "뒤집기" },
  { value: "mc", label: "객관식" },
  { value: "production", label: "주관식" },
  { value: "dictation", label: "받아쓰기" },
];

const norm = (s: string) => s.trim().toLowerCase();

/** 복습 등급 기록 콜백. */
type GradeFn = (choice: ReviewChoice) => void;

/** 현재 카드를 '내 단어'에 담는 하트. (담기 전용 — 진행과 무관) */
function CardHeart({ card }: { card: StudyCard }) {
  return (
    <HeartToggle
      initialActive={card.source !== "curated"}
      onAdd={() =>
        addToMyWords({
          language: card.language,
          word: card.word,
          meaning: card.meaning,
          pronunciation: card.pronunciation,
          example_1: card.example_1,
          part_of_speech: card.part_of_speech,
          difficulty: card.difficulty,
        })
      }
      onRemove={() => removeFromMyWords({ language: card.language, word: card.word })}
    />
  );
}

/** 다음 진행 버튼. (내 단어 담기는 카드 상단의 하트로 분리) */
function NextBar({
  choice,
  saving,
  disabled,
  onGrade,
}: {
  choice: ReviewChoice;
  saving: boolean;
  disabled?: boolean;
  onGrade: GradeFn;
}) {
  return (
    <Button
      type="button"
      className="w-full"
      disabled={saving || disabled}
      onClick={() => onGrade(choice)}
    >
      다음
    </Button>
  );
}

export function StudySession({ cards }: { cards: StudyCard[] }) {
  const [mode, setMode] = useState<Mode>("flip");
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const uniqueMeanings = useMemo(
    () => [...new Set(cards.map((c) => c.meaning))],
    [cards],
  );
  const mcAvailable = uniqueMeanings.length >= 4;

  const card = cards[index];
  const done = index >= cards.length;

  // 모드 전환 — 진행 위치(index)·진행 수는 유지하고 출제 방식만 바꾼다.
  function changeMode(next: Mode) {
    setMode(next);
  }

  // 처음부터 다시 — 현재 모드 유지, 위치만 초기화.
  function restart() {
    setIndex(0);
    setReviewed(0);
  }

  // choice 로 복습 기록 후 다음 카드로. (내 단어 담기는 카드의 하트로 분리)
  async function grade(choice: ReviewChoice) {
    if (!card || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("flashcards")
      .update(reviewUpdate(card, choice))
      .eq("id", card.id);
    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    setReviewed((n) => n + 1);
    setIndex((i) => i + 1);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          {MODES.map((m) => {
            const disabled = m.value === "mc" && !mcAvailable;
            return (
              <button
                key={m.value}
                type="button"
                disabled={disabled}
                onClick={() => changeMode(m.value)}
                title={disabled ? "객관식은 카드 4개 이상 필요" : undefined}
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
        {!done && (
          <span className="text-sm text-muted-foreground">
            {index + 1} / {cards.length}
          </span>
        )}
      </div>

      {done ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-5xl">✅</p>
            <p className="mt-3 font-semibold">{reviewed}개 학습 완료!</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={restart}>
                다시
              </Button>
              <Button asChild>
                <Link href="/dashboard">홈으로</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <CardRunner
          key={`${mode}-${index}`}
          card={card!}
          mode={mode}
          meanings={uniqueMeanings}
          saving={saving}
          onGrade={grade}
        />
      )}
    </div>
  );
}

function CardRunner({
  card,
  mode,
  meanings,
  saving,
  onGrade,
}: {
  card: StudyCard;
  mode: Mode;
  meanings: string[];
  saving: boolean;
  onGrade: GradeFn;
}) {
  if (mode === "flip") return <FlipCard card={card} saving={saving} onGrade={onGrade} />;
  if (mode === "mc")
    return <McCard card={card} meanings={meanings} saving={saving} onGrade={onGrade} />;
  return <TypeCard card={card} mode={mode} saving={saving} onGrade={onGrade} />;
}

function Speaker({ card }: { card: StudyCard }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // 카드 클릭(뒤집기)으로 전파 방지
        speak(card.word, card.language);
      }}
      aria-label="발음 듣기"
      className="text-2xl transition hover:scale-110"
    >
      🔊
    </button>
  );
}

/** 로직1 — 인식: 상단(단어) 탭=발음 / 하단 탭=뜻 보기, '다음'으로 넘어감. */
function FlipCard({
  card,
  saving,
  onGrade,
}: {
  card: StudyCard;
  saving: boolean;
  onGrade: GradeFn;
}) {
  const [flipped, setFlipped] = useState(false);
  // 새 단어가 나오면 한 번 읽어준다.
  useEffect(() => {
    speak(card.word, card.language);
  }, [card.id, card.word, card.language]);
  return (
    <>
      <div className="mb-2 flex justify-end">
        <CardHeart card={card} />
      </div>
      <Card>
        <CardContent className="min-h-56 p-0">
          {/* 상단: 단어 — 탭하면 발음 듣기 */}
          <button
            type="button"
            onClick={() => speak(card.word, card.language)}
            aria-label="발음 듣기"
            className="flex w-full items-center justify-center gap-3 px-6 pt-8 pb-4 transition hover:bg-secondary/20"
          >
            <span className="text-3xl font-bold">{card.word}</span>
            <span className="text-xl">🔊</span>
          </button>
          {/* 하단: 탭하면 뜻 보기/숨기기 */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label="뜻 보기"
            className="block min-h-24 w-full select-none border-t px-6 py-6 text-left transition hover:bg-secondary/30"
          >
            {flipped ? (
              <div className="space-y-2 text-sm">
                {card.pronunciation && (
                  <p className="text-muted-foreground">{card.pronunciation}</p>
                )}
                <p className="text-lg font-medium">{card.meaning}</p>
                {card.meaning_en && <p className="text-muted-foreground">{card.meaning_en}</p>}
                {card.example_1 && <p className="text-muted-foreground">· {card.example_1}</p>}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">탭하여 뜻 보기</p>
            )}
          </button>
        </CardContent>
      </Card>
      <div className="mt-4">
        <NextBar choice="good" saving={saving} disabled={!flipped} onGrade={onGrade} />
      </div>
    </>
  );
}

/** 로직2 — 이해: 단어 → 뜻 객관식. */
function McCard({
  card,
  meanings,
  saving,
  onGrade,
}: {
  card: StudyCard;
  meanings: string[];
  saving: boolean;
  onGrade: GradeFn;
}) {
  const options = useMemo(() => {
    const distractors = shuffle(meanings.filter((m) => m !== card.meaning)).slice(0, 3);
    return shuffle([card.meaning, ...distractors]);
  }, [card, meanings]);
  const [picked, setPicked] = useState<string | null>(null);
  // 새 단어가 나오면 한 번 읽어준다.
  useEffect(() => {
    speak(card.word, card.language);
  }, [card.id, card.word, card.language]);

  return (
    <>
      <div className="mb-2 flex justify-end">
        <CardHeart card={card} />
      </div>
      <Card>
        <CardContent className="py-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-3xl font-bold">{card.word}</h2>
            <Speaker card={card} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">알맞은 뜻을 고르세요</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          let cls = "";
          if (picked) {
            if (opt === card.meaning) cls = "border-success bg-success/10";
            else if (opt === picked) cls = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(opt)}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left transition hover:bg-secondary disabled:hover:bg-transparent",
                cls,
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4">
          <NextBar
            choice={picked === card.meaning ? "good" : "hard"}
            saving={saving}
            onGrade={onGrade}
          />
        </div>
      )}
    </>
  );
}

/** 로직3/4 — 생산/청취: 뜻 또는 음성 → 단어 입력. */
function TypeCard({
  card,
  mode,
  saving,
  onGrade,
}: {
  card: StudyCard;
  mode: Mode;
  saving: boolean;
  onGrade: GradeFn;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = norm(value) === norm(card.word);

  useEffect(() => {
    if (mode === "dictation") speak(card.word, card.language);
  }, [mode, card]);

  return (
    <>
      <div className="mb-2 flex justify-end">
        <CardHeart card={card} />
      </div>
      <Card>
        <CardContent className="py-8 text-center">
          {mode === "dictation" ? (
            <div className="flex items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">잘 듣고 받아쓰세요</p>
              <Speaker card={card} />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">{card.meaning}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                이 뜻의 단어를 입력하세요
              </p>
            </>
          )}
          {checked && (
            <p className={cn("mt-4 text-lg font-semibold", correct ? "text-success" : "text-destructive")}>
              {correct ? "✓ 정답" : `✗ 정답: ${card.word}`}
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
          placeholder="단어 입력"
          disabled={checked}
        />
        {checked ? (
          <NextBar choice={correct ? "good" : "hard"} saving={saving} onGrade={onGrade} />
        ) : (
          <Button type="submit" className="w-full" disabled={saving || !value.trim()}>
            확인
          </Button>
        )}
      </form>
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
