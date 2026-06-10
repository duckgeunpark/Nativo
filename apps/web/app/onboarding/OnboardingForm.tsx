"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";
import { seedDefaultDeck } from "@/lib/seed";
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

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ selected_language: language })
      .eq("id", user.id);
    if (updateError) {
      setSaving(false);
      setError(`저장 실패: ${updateError.message}`);
      return;
    }

    // 선택 언어의 기본 단어장 자동 채우기 (실패해도 진행)
    try {
      await seedDefaultDeck(supabase, user.id, language);
    } catch {
      // 무시
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
