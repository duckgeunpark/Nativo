import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { getScenario, buildSystemPrompt } from "@/lib/roleplay";
import type { Language } from "@nativo/core";

const LANGS = ["english", "spanish", "japanese"];

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
    scenarioId?: string;
    language?: string;
    messages?: { role?: string; content?: string }[];
  } | null;

  const scenario = body?.scenarioId ? getScenario(body.scenarioId) : undefined;
  const language = body?.language;
  if (!scenario || typeof language !== "string" || !LANGS.includes(language)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const history = Array.isArray(body?.messages) ? body.messages : [];
  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(scenario, language as Language) },
    ...history.slice(-20).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? "").slice(0, 1000),
    })),
  ];
  if (history.length === 0) {
    chatMessages.push({ role: "user", content: "Start the role-play and greet me first, in character." });
  }

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      max_tokens: 200,
      temperature: 0.8,
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
