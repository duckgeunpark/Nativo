"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language } from "@nativo/core";
import { User, BookOpen, Minus, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { saveSettings } from "./actions";
import {
  SESSION_SIZE,
  SESSION_MIN,
  SESSION_MAX,
  clampSize,
} from "@/lib/session-size";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: "english", label: "영어", flag: "🇺🇸" },
  { value: "spanish", label: "스페인어", flag: "🇪🇸" },
  { value: "japanese", label: "일본어", flag: "🇯🇵" },
];

const LEVELS: { value: CefrLevel; label: string }[] = [
  { value: "A1", label: "A1 입문" },
  { value: "A2", label: "A2 초급" },
  { value: "B1", label: "B1 중급" },
  { value: "B2", label: "B2 중상급" },
  { value: "C1", label: "C1 고급" },
  { value: "C2", label: "C2 원어민급" },
];

function setCookie(name: string, value: number) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

interface Initial {
  language: Language;
  level: CefrLevel;
  flashcardSize: number;
  chunkSize: number;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial.language);
  const [level, setLevel] = useState<CefrLevel>(initial.level);
  const [flashcardSize, setFlashcardSize] = useState(initial.flashcardSize);
  const [chunkSize, setChunkSize] = useState(initial.chunkSize);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      language !== initial.language ||
      level !== initial.level ||
      flashcardSize !== initial.flashcardSize ||
      chunkSize !== initial.chunkSize,
    [language, level, flashcardSize, chunkSize, initial],
  );

  async function save() {
    if (!dirty || state === "saving") return;
    setState("saving");
    setError(null);
    const res = await saveSettings({ language, level });
    if (!res.ok) {
      setState("error");
      setError(res.error ?? "알 수 없는 오류가 발생했어요.");
      return;
    }
    // 회당 학습량은 쿠키로(기기별)
    setCookie(SESSION_SIZE.flashcard.cookie, clampSize(flashcardSize, SESSION_SIZE.flashcard.default));
    setCookie(SESSION_SIZE.chunk.cookie, clampSize(chunkSize, SESSION_SIZE.chunk.default));
    setState("saved");
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            프로필
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">학습 언어</span>
            <SelectField
              value={language}
              onChange={(v) => {
                setLanguage(v as Language);
                setState("idle");
              }}
              options={LANGUAGES.map((l) => ({ value: l.value, label: `${l.flag} ${l.label}` }))}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">CEFR 레벨</span>
            <SelectField
              value={level}
              onChange={(v) => {
                setLevel(v as CefrLevel);
                setState("idle");
              }}
              options={LEVELS}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
            학습
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StepperField
            label="회당 플래시카드 수"
            hint={`권장 ${SESSION_MIN}~${SESSION_MAX}장 (복습 도래 카드는 제한 없이 모두 나와요)`}
            value={flashcardSize}
            onChange={(v) => {
              setFlashcardSize(v);
              setState("idle");
            }}
          />
          <StepperField
            label="회당 청크 수"
            hint={`권장 ${SESSION_MIN}~${SESSION_MAX}개 (복습 도래 청크는 제한 없이 모두 나와요)`}
            value={chunkSize}
            onChange={(v) => {
              setChunkSize(v);
              setState("idle");
            }}
          />
        </CardContent>
      </Card>

      {state === "saved" && !dirty && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          저장했어요.
        </div>
      )}
      {state === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          저장하지 못했어요{error ? `: ${error}` : ""}
        </div>
      )}

      {/* 모바일에서는 하단 고정, 데스크톱에서는 인라인 */}
      <div className="sticky bottom-16 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!dirty || state === "saving"}>
            {state === "saving" ? "저장 중…" : "변경사항 저장"}
          </Button>
          {dirty && state !== "saving" && (
            <span className="text-xs text-muted-foreground">저장하지 않은 변경사항이 있어요</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function StepperField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const atMin = value <= SESSION_MIN;
  const atMax = value >= SESSION_MAX;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          disabled={atMin}
          onClick={() => onChange(clampSize(value - 1, value))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-12 text-center text-sm font-medium tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          disabled={atMax}
          onClick={() => onChange(clampSize(value + 1, value))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
