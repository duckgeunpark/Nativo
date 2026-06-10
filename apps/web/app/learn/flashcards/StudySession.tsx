"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReviewChoice } from "@nativo/utils";
import { createClient } from "@/lib/supabase/client";
import { reviewUpdate, type StudyCard } from "@/lib/flashcards";
import { speak } from "@/lib/tts";

interface Props {
  cards: StudyCard[];
}

const CHOICES: { value: ReviewChoice; label: string; cls: string }[] = [
  { value: "hard", label: "어려움", cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  { value: "good", label: "보통", cls: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { value: "easy", label: "쉬움", cls: "bg-green-100 text-green-700 hover:bg-green-200" },
];

export function StudySession({ cards }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card = cards[index];
  const done = index >= cards.length;

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
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <p className="text-4xl">✅</p>
        <p className="mt-3 font-semibold">{reviewed}개 카드 복습 완료!</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
        >
          대시보드로
        </Link>
      </div>
    );
  }

  // done=false 이면 card 는 항상 존재
  const current = card!;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <span>
          {index + 1} / {cards.length}
        </span>
        <span>복습 {reviewed}</span>
      </div>

      <div className="min-h-64 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <h2 className="text-center text-3xl font-bold">{current.word}</h2>
          <button
            type="button"
            onClick={() => speak(current.word, current.language)}
            aria-label="발음 듣기"
            className="text-2xl transition hover:scale-110"
          >
            🔊
          </button>
        </div>

        {flipped ? (
          <div className="mt-6 space-y-3 border-t border-neutral-100 pt-6 text-sm">
            {current.pronunciation && (
              <p className="text-neutral-500">{current.pronunciation}</p>
            )}
            <p className="text-lg font-medium">{current.meaning}</p>
            {current.meaning_en && (
              <p className="text-neutral-600">{current.meaning_en}</p>
            )}
            <div className="flex gap-2 text-xs text-neutral-500">
              {current.part_of_speech && (
                <span className="rounded bg-neutral-100 px-2 py-0.5">
                  {current.part_of_speech}
                </span>
              )}
              {current.difficulty && (
                <span className="rounded bg-neutral-100 px-2 py-0.5">
                  {current.difficulty}
                </span>
              )}
            </div>
            {(current.example_1 || current.example_2) && (
              <ul className="mt-2 space-y-1 text-neutral-600">
                {current.example_1 && <li>· {current.example_1}</li>}
                {current.example_2 && <li>· {current.example_2}</li>}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-neutral-400">
            뜻을 떠올린 뒤 카드를 뒤집으세요
          </p>
        )}
      </div>

      <div className="mt-6">
        {flipped ? (
          <div className="grid grid-cols-3 gap-3">
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={saving}
                onClick={() => grade(c.value)}
                className={`rounded-lg px-4 py-3 font-medium transition disabled:opacity-50 ${c.cls}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-800"
          >
            카드 뒤집기
          </button>
        )}
      </div>
    </div>
  );
}
