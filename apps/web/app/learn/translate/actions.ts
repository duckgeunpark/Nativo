"use server";

import { revalidatePath } from "next/cache";
import type { Language, TablesInsert, TranslationFeedback } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";

const TRANSLATE_PATH = "/learn/translate";

/** 번역가 모드 세션 한 건 저장(원문 + 내 번역 + 평가). */
export async function saveTranslationSession(input: {
  language: Language;
  original: string;
  translation: string;
  scores?: {
    total: number;
    accuracy: number;
    naturalness: number;
    nuance: number;
    passed: boolean;
  } | null;
  feedback?: TranslationFeedback | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (input.original.trim().length < 1 || input.translation.trim().length < 1) {
    return { ok: false, error: "원문과 번역을 모두 입력해 주세요." };
  }

  const payload: TablesInsert<"translation_sessions"> = {
    user_id: user.id,
    language: input.language,
    direction: "to_korean",
    original_text: input.original.trim().slice(0, 5000),
    user_translation: input.translation.trim().slice(0, 5000),
    score_total: input.scores?.total ?? null,
    score_accuracy: input.scores?.accuracy ?? null,
    score_naturalness: input.scores?.naturalness ?? null,
    score_nuance: input.scores?.nuance ?? null,
    passed: input.scores?.passed ?? false,
    feedback: input.feedback ?? null,
    evaluated_at: input.scores ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("translation_sessions").insert(payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath(TRANSLATE_PATH);
  return { ok: true };
}
