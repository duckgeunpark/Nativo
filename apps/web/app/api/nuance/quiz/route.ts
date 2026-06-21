import { NextResponse } from "next/server";
import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { buildNuancePrompt, parseNuanceQuiz } from "@/lib/ai-nuance";

const LANGS = ["english", "spanish", "japanese"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** 사용자 언어/레벨 기반 뉘앙스 퀴즈 생성. (서버 전용, 키 없으면 503) */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language, current_level")
    .eq("id", user.id)
    .single();

  const language = (LANGS.includes(profile?.selected_language ?? "")
    ? profile!.selected_language
    : "english") as Language;
  const level = (LEVELS.includes(profile?.current_level ?? "")
    ? profile!.current_level
    : "B1") as CefrLevel;

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildNuancePrompt(language, level) },
        { role: "user", content: "Generate the quiz now." },
      ],
      max_tokens: 1500,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const questions = parseNuanceQuiz(raw);
    if (questions.length === 0) {
      return NextResponse.json({ error: "empty" }, { status: 502 });
    }
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
