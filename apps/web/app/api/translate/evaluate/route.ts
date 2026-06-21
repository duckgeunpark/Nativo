import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { buildTranslatePrompt, parseTranslationEvaluation } from "@/lib/ai-translate";

const LANGS = ["english", "spanish", "japanese"];

/** 번역가 모드 평가 — 원문 + 내 번역 → 점수/피드백. (서버 전용, 키 없으면 503) */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    language?: string;
    original?: string;
    translation?: string;
  } | null;

  const language = body?.language;
  const original = typeof body?.original === "string" ? body.original.trim().slice(0, 3000) : "";
  const translation =
    typeof body?.translation === "string" ? body.translation.trim().slice(0, 3000) : "";

  if (
    typeof language !== "string" ||
    !LANGS.includes(language) ||
    original.length < 2 ||
    translation.length < 1
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildTranslatePrompt(language as Language) },
        {
          role: "user",
          content: `Original (${language}):\n${original}\n\nLearner's Korean translation:\n${translation}`,
        },
      ],
      max_tokens: 1100,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    return NextResponse.json(parseTranslationEvaluation(raw));
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
