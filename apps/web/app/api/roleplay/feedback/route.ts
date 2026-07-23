import { NextResponse } from "next/server";
import type OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";
import { getScenario, buildFeedbackPrompt } from "@/lib/roleplay";
import type { Language } from "@nativo/core";

const LANGS = ["english", "spanish", "japanese"];

/** 역할극 종료 후 모국어 피드백 생성 (표현별 평가 + 분야별 점수). */
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
  if (history.length === 0) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const transcript = history
    .map((m) => `${m.role === "assistant" ? "PARTNER" : "LEARNER"}: ${String(m.content ?? "").slice(0, 1000)}`)
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildFeedbackPrompt(scenario, language as Language) },
    { role: "user", content: `Conversation transcript:\n${transcript}` },
  ];

  try {
    const completion = await openaiClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 900,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    // 세션 기록 저장 → 말하기 "최근 활동"에 노출. 저장 실패해도 피드백 응답은 유지.
    const scores = (parsed as { scores?: Record<string, number | undefined> }).scores;
    await supabase
      .from("roleplay_sessions")
      .insert({
        user_id: user.id,
        scenario_id: body?.scenarioId ?? null,
        language,
        level: "normal",
        mode: body?.scenarioId ? "scenario" : "custom",
        messages: history,
        score_total: scores?.total ?? null,
        score_fluency: scores?.fluency ?? null,
        score_accuracy: scores?.accuracy ?? null,
        score_vocab: scores?.vocab ?? null,
        passed: (scores?.total ?? 0) >= 70,
        feedback: parsed,
        exchange_count: history.filter((m) => m.role === "user").length,
        evaluated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("roleplay_sessions insert failed:", error.message);
      });

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
