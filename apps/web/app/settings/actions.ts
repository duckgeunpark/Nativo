"use server";

import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/** 학습 언어·레벨 저장 (단일 사용자 로컬 모드). */
export async function saveSettings(input: {
  language: Language;
  level: CefrLevel;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ selected_language: input.language, current_level: input.level })
    .eq("id", LOCAL_USER_ID);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
