"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { completeOnboarding } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "english", label: "영어", flag: "🇺🇸" },
  { value: "spanish", label: "스페인어", flag: "🇪🇸" },
  { value: "japanese", label: "일본어", flag: "🇯🇵" },
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
      setError(`저장 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLanguage(opt.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-5 transition",
              language === opt.value
                ? "border-primary bg-accent ring-1 ring-primary"
                : "hover:bg-secondary",
            )}
          >
            <span className="text-3xl">{opt.flag}</span>
            <span className="text-sm font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button size="lg" disabled={saving} onClick={start}>
        {saving ? "준비 중…" : "시작하기"}
      </Button>
    </div>
  );
}
