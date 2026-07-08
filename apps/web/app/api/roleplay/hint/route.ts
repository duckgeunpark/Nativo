import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { getScenario, buildHintPrompt } from "@/lib/roleplay";
import type { Language } from "@nativo/core";

const LANGS = ["english", "spanish", "japanese"];

/** 대화 중 "이런 표현을 써보세요" 힌트 2-3개 생성. */
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
    custom?: { aiRole?: unknown; userMission?: unknown };
    language?: string;
    messages?: { role?: string; content?: string }[];
  } | null;

  const language = body?.language;
  if (typeof language !== "string" || !LANGS.includes(language)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const scenario = body?.scenarioId
    ? getScenario(body.scenarioId)
    : body?.custom &&
        typeof body.custom.aiRole === "string" &&
        typeof body.custom.userMission === "string"
      ? {
          aiRole: body.custom.aiRole.slice(0, 200),
          userMission: body.custom.userMission.slice(0, 300),
        }
      : undefined;
  if (!scenario) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const history = Array.isArray(body?.messages) ? body.messages : [];
  const transcript = history
    .slice(-20)
    .map((m) => `${m.role === "assistant" ? "PARTNER" : "LEARNER"}: ${String(m.content ?? "").slice(0, 1000)}`)
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildHintPrompt(scenario, language as Language) },
    {
      role: "user",
      content: transcript
        ? `Conversation so far:\n${transcript}`
        : "The conversation has not started yet. Suggest good opening expressions.",
    },
  ];

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 300,
      temperature: 0.6,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
