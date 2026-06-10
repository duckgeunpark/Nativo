"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function AddCardForm({ language }: { language: Language }) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [example1, setExample1] = useState("");
  const [difficulty, setDifficulty] = useState<CefrLevel | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      setError("단어와 뜻은 필수입니다.");
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

    const payload: TablesInsert<"flashcards"> = {
      user_id: user.id,
      language,
      word: word.trim(),
      meaning: meaning.trim(),
      pronunciation: pronunciation.trim() || null,
      example_1: example1.trim() || null,
      difficulty: difficulty || null,
      source: "manual",
    };

    const { error: insertError } = await supabase.from("flashcards").insert(payload);

    if (insertError) {
      setSaving(false);
      setError(`저장 실패: ${insertError.message}`);
      return;
    }

    router.push("/learn/flashcards");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="단어 *">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="vulnerable"
        />
      </Field>

      <Field label="뜻 *">
        <input
          type="text"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="취약한, 상처받기 쉬운"
        />
      </Field>

      <Field label="발음 기호">
        <input
          type="text"
          value={pronunciation}
          onChange={(e) => setPronunciation(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="/ˈvʌlnərəbl/"
        />
      </Field>

      <Field label="예문">
        <input
          type="text"
          value={example1}
          onChange={(e) => setExample1(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="Children are vulnerable to cold weather."
        />
      </Field>

      <Field label="난이도">
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as CefrLevel | "")}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "저장 중…" : "카드 저장"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
