import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { buildWritingPrompt, parseWritingFeedback } from "@/lib/ai-writing";

const LANGS = ["english", "spanish", "japanese"];

/** 영작 일기 AI 첨삭 생성. (서버 전용, 키 없으면 503 degrade) */
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
    content?: string;
  } | null;

  const language = body?.language;
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 4000) : "";

  if (typeof language !== "string" || !LANGS.includes(language) || content.length < 5) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildWritingPrompt(language as Language) },
        { role: "user", content },
      ],
      max_tokens: 1200,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    return NextResponse.json(parseWritingFeedback(raw));
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
