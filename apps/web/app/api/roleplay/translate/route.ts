import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { buildQuickTranslatePrompt } from "@/lib/roleplay";
import type { Language } from "@nativo/core";

const LANGS = ["english", "spanish", "japanese"];

/** 대화 중 빠른 번역: 한국어 → 학습 언어 (자연스러운 구어체). */
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
    text?: unknown;
  } | null;

  const language = body?.language;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (typeof language !== "string" || !LANGS.includes(language) || !text) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildQuickTranslatePrompt(language as Language) },
    { role: "user", content: text },
  ];

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { translation?: unknown };
    return NextResponse.json({
      translation: typeof parsed.translation === "string" ? parsed.translation : "",
    });
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
