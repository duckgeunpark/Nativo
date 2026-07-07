"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { AlertCircle, Loader2 } from "lucide-react";
import { completeOnboarding } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS: {
  value: Language;
  label: string;
  glyph: string;
  tint: string;
}[] = [
  { value: "english", label: "영어", glyph: "A", tint: "bg-primary/10 text-primary" },
  { value: "spanish", label: "스페인어", glyph: "ñ", tint: "bg-highlight/10 text-highlight" },
  { value: "japanese", label: "일본어", glyph: "あ", tint: "bg-secondary text-secondary-foreground" },
];

export function OnboardingForm({ initial }: { initial: { selectedLanguage: Language } }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial.selectedLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSaving(true);
    setError(null);

    const res = await completeOnboarding(language);
    if (!res.ok) {
      setSaving(false);
      setError(res.error ? `저장에 실패했어요: ${res.error}` : "저장에 실패했어요.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {LANGUAGE_OPTIONS.map((opt) => {
          const selected = language === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-selected={selected}
              disabled={saving}
              onClick={() => setLanguage(opt.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 sm:flex-col sm:gap-2 sm:py-6 sm:text-center",
                selected
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-semibold",
                  opt.tint,
                )}
              >
                {opt.glyph}
              </span>
              <span className="flex-1 font-medium sm:flex-none">{opt.label}</span>
              <span
                aria-hidden
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 sm:order-last",
                  selected ? "border-primary" : "border-input",
                )}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </span>
          <button
            type="button"
            onClick={start}
            className="shrink-0 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            다시 시도
          </button>
        </div>
      )}

      <Button size="lg" disabled={saving || !language} onClick={start}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            준비 중…
          </>
        ) : (
          "시작하기"
        )}
      </Button>
    </div>
  );
}
