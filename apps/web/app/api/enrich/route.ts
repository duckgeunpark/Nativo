import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { enrichWord } from "@/lib/dictionary";

const LANGUAGES = ["english", "spanish", "japanese"];

/** 단어 뜻 보강 프록시 (외부 사전 API를 서버에서 호출 → CORS 회피). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { word?: unknown; language?: unknown }
    | null;
  const word = typeof body?.word === "string" ? body.word.trim() : "";
  const language = body?.language;

  if (!word || typeof language !== "string" || !LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const fields = await enrichWord(word, language as Language);
  return NextResponse.json(fields);
}
