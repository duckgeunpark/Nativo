import { NextResponse } from "next/server";
import type { CefrLevel, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { buildChunkGenPrompt, parseGeneratedChunks } from "@/lib/ai-chunks";

const LANGS = ["english", "spanish", "japanese"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** 상황 입력 → AI 청크 10개 생성. (서버 전용, 키 없으면 503 degrade) */
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
    situation?: string;
    level?: string;
  } | null;

  const language = body?.language;
  const situation = typeof body?.situation === "string" ? body.situation.trim().slice(0, 200) : "";
  const level = (LEVELS.includes(body?.level ?? "") ? body!.level : "B1") as CefrLevel;

  if (typeof language !== "string" || !LANGS.includes(language) || situation.length < 2) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildChunkGenPrompt(language as Language, situation, level) },
        { role: "user", content: `Situation: ${situation}` },
      ],
      max_tokens: 1800,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const chunks = parseGeneratedChunks(raw);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "empty" }, { status: 502 });
    }
    return NextResponse.json({ chunks });
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
