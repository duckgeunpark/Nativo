"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";
import {
  SESSION_SIZE,
  SESSION_MIN,
  SESSION_MAX,
  clampSize,
} from "@/lib/session-size";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function SettingsForm({
  initial,
}: {
  initial: {
    language: Language;
    level: CefrLevel;
    flashcardSize: number;
    chunkSize: number;
  };
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial.language);
  const [level, setLevel] = useState<CefrLevel>(initial.level);
  const [flashcardSize, setFlashcardSize] = useState(String(initial.flashcardSize));
  const [chunkSize, setChunkSize] = useState(String(initial.chunkSize));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ selected_language: language, current_level: level })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      alert(`저장 실패: ${error.message}`);
      return;
    }
    // 회당 학습량은 쿠키로(기기별)
    setCookie(SESSION_SIZE.flashcard.cookie, clampSize(Number(flashcardSize), SESSION_SIZE.flashcard.default));
    setCookie(SESSION_SIZE.chunk.cookie, clampSize(Number(chunkSize), SESSION_SIZE.chunk.default));
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-medium">학습 언어</h2>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-4 transition",
                language === opt.value
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "hover:bg-secondary",
              )}
            >
              <span className="text-2xl">{opt.flag}</span>
              <span className="text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">내 레벨</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          레벨에 맞춰 ±1단계 난이도 위주로 학습합니다.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLevel(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition",
                level === opt.value
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "hover:bg-secondary",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">회당 학습량</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          한 번에 새로 소개할 문제 수입니다. ({SESSION_MIN}~{SESSION_MAX}, 복습 도래 카드는 제한 없이 모두 나옵니다.)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">플래시카드</span>
            <Input
              type="number"
              min={SESSION_MIN}
              max={SESSION_MAX}
              value={flashcardSize}
              onChange={(e) => setFlashcardSize(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">청크</span>
            <Input
              type="number"
              min={SESSION_MIN}
              max={SESSION_MAX}
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
        {saved && <span className="text-sm text-success">✓ 저장됨</span>}
      </div>
    </div>
  );
}
