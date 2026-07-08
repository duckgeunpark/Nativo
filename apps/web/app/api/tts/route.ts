import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured, openaiClient } from "@/lib/openai";

/** lib/prefs 의 AI_VOICES 와 일치해야 하는 허용 목소리 목록. */
const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

/**
 * gpt-4o-mini-tts 는 speed 파라미터 대신 instructions 로 말하기 방식을 조절한다.
 * 설정의 말하기 속도(0.8/1/1.2)를 지시문으로 변환.
 */
const PACE_INSTRUCTIONS: Record<string, string | undefined> = {
  "0.8": "Speak slowly and clearly, as if talking to a language learner.",
  "1": undefined,
  "1.2": "Speak at a slightly brisk, natural pace.",
};

/** 자연스러운 AI 음성(OpenAI TTS) 프록시 — 키는 서버에만 두고 mp3 를 돌려준다. */
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
    text?: unknown;
    voice?: unknown;
    rate?: unknown;
  } | null;

  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 600) : "";
  if (!text) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const voice = VOICES.includes(body?.voice as (typeof VOICES)[number])
    ? (body?.voice as (typeof VOICES)[number])
    : "nova";
  const instructions = PACE_INSTRUCTIONS[String(body?.rate ?? "1")];

  try {
    const speech = await openaiClient().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "mp3",
      ...(instructions ? { instructions } : {}),
    });
    const audio = await speech.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        // 같은 문장 재요청 대비 (POST 라 브라우저 캐시는 안 타지만 프록시/클라이언트 힌트용)
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
