"use server";

import { revalidatePath } from "next/cache";
import type { Language, TablesInsert, WritingCorrection } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { countWords } from "@/lib/ai-writing";

const JOURNAL_PATH = "/learn/journal";

/**
 * 영작 일기 한 편을 저장(같은 날·언어는 덮어쓰기 — UNIQUE(user_id, entry_date, language)).
 * 첨삭 결과(summary/corrections)도 함께 저장한다.
 */
export async function saveJournalEntry(input: {
  language: Language;
  content: string;
  aiFeedback?: string | null;
  corrections?: WritingCorrection[];
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const content = input.content.trim();
  if (content.length < 1) return { ok: false, error: "내용이 비어 있습니다." };

  const payload: TablesInsert<"writing_journal"> = {
    user_id: user.id,
    language: input.language,
    entry_date: new Date().toISOString().slice(0, 10),
    content,
    ai_feedback: input.aiFeedback ?? null,
    corrections: input.corrections ?? [],
    word_count: countWords(content),
  };

  const { error } = await supabase
    .from("writing_journal")
    .upsert(payload, { onConflict: "user_id,entry_date,language" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(JOURNAL_PATH);
  return { ok: true };
}

/** 지난 일기 한 편 삭제. */
export async function deleteJournalEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("writing_journal")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(JOURNAL_PATH);
  return { ok: true };
}
