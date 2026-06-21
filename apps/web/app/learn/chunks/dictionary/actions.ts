"use server";

import { revalidatePath } from "next/cache";
import type { CefrLevel, ChunkCategory, Language, TablesInsert } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";

const DICT_PATH = "/learn/chunks/dictionary";

export interface AddChunkInput {
  language: Language;
  expression: string;
  translation_ko: string;
  situation?: string | null;
  nuance?: string | null;
  example_1?: string | null;
  example_2?: string | null;
  category?: string | null;
  level?: string | null;
}

/**
 * 청크를 '내 청크'(source='manual')로 추가.
 * 이미 있으면 source 만 'manual' 로, 없으면 새로 insert.
 */
export async function addToMyChunks(
  input: AddChunkInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("chunks")
    .select("id")
    .eq("user_id", user.id)
    .eq("language", input.language)
    .eq("expression", input.expression)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("chunks")
      .update({ source: "manual" })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(DICT_PATH);
    return { ok: true };
  }

  const row: TablesInsert<"chunks"> = {
    user_id: user.id,
    language: input.language,
    expression: input.expression,
    translation_ko: input.translation_ko,
    situation: input.situation ?? null,
    nuance: input.nuance ?? null,
    example_1: input.example_1 ?? null,
    example_2: input.example_2 ?? null,
    category: (input.category as ChunkCategory | null) ?? null,
    level: (input.level as CefrLevel | null) ?? null,
    source: "manual",
  };
  const { error } = await supabase.from("chunks").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true };
}

/** AI 생성 청크를 '내 청크'로 일괄 저장(source='ai_generated'). 이미 있는 표현은 건너뛴다. */
export async function saveGeneratedChunks(input: {
  language: Language;
  chunks: Array<{
    expression: string;
    translation_ko: string;
    situation?: string | null;
    nuance?: string | null;
    example_1?: string | null;
    example_2?: string | null;
    category?: string | null;
    level?: string | null;
  }>;
}): Promise<{ ok: boolean; saved?: number; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (!Array.isArray(input.chunks) || input.chunks.length === 0) {
    return { ok: false, error: "저장할 청크가 없습니다." };
  }

  const { data: existingRows } = await supabase
    .from("chunks")
    .select("expression")
    .eq("user_id", user.id)
    .eq("language", input.language);
  const existing = new Set((existingRows ?? []).map((r) => r.expression.toLowerCase()));

  const rows: TablesInsert<"chunks">[] = input.chunks
    .filter((c) => c.expression && !existing.has(c.expression.toLowerCase()))
    .map((c) => ({
      user_id: user.id,
      language: input.language,
      expression: c.expression,
      translation_ko: c.translation_ko,
      situation: c.situation ?? null,
      nuance: c.nuance ?? null,
      example_1: c.example_1 ?? null,
      example_2: c.example_2 ?? null,
      category: (c.category as ChunkCategory | null) ?? null,
      level: (c.level as CefrLevel | null) ?? null,
      source: "ai_generated",
    }));

  if (rows.length === 0) return { ok: true, saved: 0 };

  const { error } = await supabase.from("chunks").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true, saved: rows.length };
}

/** 청크를 완전히 삭제(학습 기록 포함). RLS + user_id 조건으로 본인 것만. */
export async function deleteChunk(input: {
  id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("chunks")
    .delete()
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true };
}

/** '내 청크'에서 제거 = source 를 'curated' 로 (학습 청크로는 남음). */
export async function removeFromMyChunks(input: {
  language: Language;
  expression: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("chunks")
    .update({ source: "curated" })
    .eq("user_id", user.id)
    .eq("language", input.language)
    .eq("expression", input.expression);
  if (error) return { ok: false, error: error.message };
  revalidatePath(DICT_PATH);
  return { ok: true };
}
