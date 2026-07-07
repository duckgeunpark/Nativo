"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Volume2, Eye, EyeOff, CheckCircle2, XCircle, RotateCcw, PartyPopper } from "lucide-react";
import type { ReviewChoice } from "@nativo/utils";
import { type StudyCard } from "@/lib/flashcards";
import { gradeFlashcard } from "./actions";
import { speak } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui/segmented-tabs";
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
  className,
}: {
  choice: ReviewChoice;
  saving: boolean;
  disabled?: boolean;
  onGrade: GradeFn;
  className?: string;
}) {
  return (
    <Button
      type="button"
      className={cn("w-full", className)}
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
  const [error, setError] = useState<string | null>(null);

  const uniqueMeanings = useMemo(
    () => [...new Set(cards.map((c) => c.meaning))],
    [cards],
  );
  const mcAvailable = uniqueMeanings.length >= 4;

  const card = cards[index];
  const done = index >= cards.length;

  const modeOptions: SegmentedTabOption[] = MODES.map((m) => ({
    value: m.value,
    label: m.label,
    disabled: m.value === "mc" && !mcAvailable,
  }));

  // 모드 전환 — 진행 위치(index)·진행 수는 유지하고 출제 방식만 바꾼다.
  function changeMode(next: string) {
    setMode(next as Mode);
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
    setError(null);
    const res = await gradeFlashcard(card, choice);
    setSaving(false);
    if (!res.ok) {
      setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }
    setReviewed((n) => n + 1);
    setIndex((i) => i + 1);
  }

  return (
    <div>
      {!done && (
        <div className="mb-5 flex flex-col items-center gap-2">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {index + 1} / {cards.length}
          </p>
          <ProgressBar
            value={index}
            max={cards.length}
            tone="primary"
            aria-label="학습 진행률"
            className="max-w-xs"
          />
        </div>
      )}

      {!done && (
        <SegmentedTabs
          value={mode}
          onValueChange={changeMode}
          options={modeOptions}
          aria-label="학습 모드"
          className="mb-5"
        />
      )}

      {done ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PartyPopper className="h-7 w-7" aria-hidden />
            </span>
            <p className="font-semibold">{reviewed}개 학습 완료!</p>
            <p className="text-sm text-muted-foreground">오늘의 플래시카드를 모두 끝냈어요.</p>
            <div className="mt-2 flex justify-center gap-2">
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
        <>
          <CardRunner
            key={`${mode}-${index}`}
            card={card!}
            mode={mode}
            meanings={uniqueMeanings}
            saving={saving}
            onGrade={grade}
          />
          <ErrorBanner message={error} className="mt-4" />
        </>
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

/** 로직1 — 인식: 단어·발음·예문은 항상 보이고, 뜻만 탭해서 확인 후 '다음'으로 넘어감. */
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
      <Card className="relative">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 overflow-hidden px-6 py-10 text-center">
          <div className="absolute right-4 top-4">
            <CardHeart card={card} />
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {flipped ? "Back" : "Front"}
          </span>
          <div className="max-w-full space-y-2">
            <p className="line-clamp-2 break-words text-[clamp(1.5rem,6vw,2.25rem)] font-bold leading-tight">
              {card.word}
            </p>
            {card.pronunciation && (
              <p className="text-sm text-muted-foreground">{card.pronunciation}</p>
            )}
          </div>
          {card.example_1 && (
            <p className="line-clamp-2 max-w-md break-words text-sm text-muted-foreground">
              {card.example_1}
            </p>
          )}
          {flipped && (
            <div className="w-full max-w-md space-y-1 rounded-lg bg-secondary/60 p-4 text-left">
              <p className="text-xs font-medium text-muted-foreground">뜻</p>
              <p className="line-clamp-3 break-words text-lg font-semibold">{card.meaning}</p>
              {card.meaning_en && (
                <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                  {card.meaning_en}
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {flipped ? "뜻이 표시됨" : "탭하여 뜻 보기"}
          </p>
        </CardContent>
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => speak(card.word, card.language)}>
          <Volume2 className="h-4 w-4" aria-hidden />
          듣기
        </Button>
        <Button type="button" variant="outline" onClick={() => setFlipped((f) => !f)}>
          {flipped ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {flipped ? "뜻 숨기기" : "뜻 보기"}
        </Button>
      </div>
      <div className="mt-3">
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
      <Card>
        <CardContent className="relative flex flex-col items-center gap-2 py-8 text-center">
          <div className="absolute right-4 top-4">
            <CardHeart card={card} />
          </div>
          <div className="flex items-center justify-center gap-3">
            <h2 className="line-clamp-2 break-words text-[clamp(1.5rem,5vw,1.875rem)] font-bold">
              {card.word}
            </h2>
            <Speaker card={card} />
          </div>
          <p className="text-sm text-muted-foreground">알맞은 뜻을 고르세요</p>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const isAnswer = opt === card.meaning;
          const isPicked = opt === picked;
          let cls = "";
          if (picked) {
            if (isAnswer) cls = "border-success bg-success/10";
            else if (isPicked) cls = "border-destructive bg-destructive/10";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(opt)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent",
                cls,
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

/** 로직3/4 — 생산/청취: 뜻 또는 음성 → 단어 입력. 오답 시 다시 시도 가능. */
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

  function retry() {
    setChecked(false);
    setValue("");
  }

  return (
    <>
      <Card>
        <CardContent className="relative flex flex-col items-center gap-2 py-8 text-center">
          <div className="absolute right-4 top-4">
            <CardHeart card={card} />
          </div>
          {mode === "dictation" ? (
            <div className="flex items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">잘 듣고 받아쓰세요</p>
              <Speaker card={card} />
            </div>
          ) : (
            <>
              <h2 className="line-clamp-2 break-words text-[clamp(1.25rem,4.5vw,1.75rem)] font-bold">
                {card.meaning}
              </h2>
              <p className="text-sm text-muted-foreground">이 뜻의 단어를 입력하세요</p>
            </>
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
            <span className="break-words">{correct ? "정답이에요" : `정답: ${card.word}`}</span>
          </div>
        )}
        {checked ? (
          <div className="flex gap-2">
            {!correct && (
              <Button type="button" variant="outline" className="flex-1" onClick={retry}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                다시 시도
              </Button>
            )}
            <NextBar
              choice={correct ? "good" : "hard"}
              saving={saving}
              onGrade={onGrade}
              className="flex-1"
            />
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

function Speaker({ card }: { card: StudyCard }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(card.word, card.language);
      }}
      aria-label="발음 듣기"
      className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Volume2 className="h-5 w-5" aria-hidden />
    </button>
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
