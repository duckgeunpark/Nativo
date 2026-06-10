"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";

const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "english", label: "영어", flag: "🇺🇸" },
  { value: "spanish", label: "스페인어", flag: "🇪🇸" },
  { value: "japanese", label: "일본어", flag: "🇯🇵" },
];

const LEVEL_OPTIONS: CefrLevel[] = ["A2", "B1", "B2", "C1"];

interface Props {
  initial: {
    selectedLanguage: Language;
    currentLevel: CefrLevel;
    occupation: string;
    interests: string[];
  };
}

export function OnboardingForm({ initial }: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial.selectedLanguage);
  const [level, setLevel] = useState<CefrLevel>(initial.currentLevel);
  const [occupation, setOccupation] = useState(initial.occupation);
  const [interests, setInterests] = useState(initial.interests.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!occupation.trim()) {
      setError("직업/역할을 입력해 주세요 (맞춤 시나리오에 사용됩니다).");
      return;
    }

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
      .update({
        selected_language: language,
        current_level: level,
        occupation: occupation.trim(),
        interests: interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })
      .eq("id", user.id);

    if (updateError) {
      setSaving(false);
      setError(`저장 실패: ${updateError.message}`);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">학습 언어</legend>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-4 transition ${
                language === opt.value
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <span className="text-2xl">{opt.flag}</span>
              <span className="text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-medium">
        현재 레벨
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as CefrLevel)}
          className="rounded-lg border border-neutral-300 px-3 py-2 font-normal"
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        직업 / 역할
        <input
          type="text"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          placeholder="예: 소프트웨어 엔지니어"
          className="rounded-lg border border-neutral-300 px-3 py-2 font-normal"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        관심사 (쉼표로 구분)
        <input
          type="text"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="예: 여행, 게임, 비즈니스"
          className="rounded-lg border border-neutral-300 px-3 py-2 font-normal"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "저장 중…" : "시작하기"}
      </button>
    </form>
  );
}
