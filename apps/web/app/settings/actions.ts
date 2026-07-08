"use server";

import { cookies } from "next/headers";
import OpenAI from "openai";
import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { OPENAI_KEY_COOKIE } from "@/lib/openai";
import { LOCAL_USER_ID } from "@/lib/db";

/** 학습 언어·레벨·닉네임 저장 (단일 사용자 로컬 모드). */
export async function saveSettings(input: {
  language: Language;
  level: CefrLevel;
  displayName?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim().slice(0, 40) : "";
  const { error } = await supabase
    .from("users")
    .update({
      selected_language: input.language,
      current_level: input.level,
      display_name: displayName || null,
    })
    .eq("id", LOCAL_USER_ID);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * 개인 OpenAI API 키 저장 — 유효성 확인 후 httpOnly 쿠키에 보관.
 * 저장된 키는 서버 환경변수 키보다 우선 적용된다 (lib/openai.getOpenAIKey).
 */
export async function saveApiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (key ?? "").trim();
  if (!trimmed.startsWith("sk-") || trimmed.length < 20) {
    return { ok: false, error: "올바른 형식이 아니에요. OpenAI 키는 sk- 로 시작해요." };
  }

  // 저장 전에 실제로 동작하는 키인지 확인 (models.list 는 과금 없음)
  try {
    await new OpenAI({ apiKey: trimmed }).models.list();
  } catch {
    return { ok: false, error: "키 확인에 실패했어요. 키가 유효한지 확인해주세요." };
  }

  cookies().set(OPENAI_KEY_COOKIE, trimmed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

/** 개인 API 키 삭제 — 이후에는 서버 환경변수 키(있다면)로 동작. */
export async function clearApiKey(): Promise<{ ok: boolean }> {
  cookies().delete(OPENAI_KEY_COOKIE);
  return { ok: true };
}
