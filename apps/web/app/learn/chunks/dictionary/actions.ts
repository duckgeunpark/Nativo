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
