import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { fetchTranscriptViaYtDlp, ytDlpAvailable } from "@/lib/yt-dlp";

export const runtime = "nodejs";

const LANGS = ["english", "spanish", "japanese"];

/** yt-dlp 로 영상 자막 자동 추출. 미설치 시 503(no_ytdlp). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    videoId?: unknown;
    language?: unknown;
  } | null;

  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const language: Language =
    typeof body?.language === "string" && LANGS.includes(body.language)
      ? (body.language as Language)
      : "english";

  if (!(await ytDlpAvailable())) {
    return NextResponse.json({ error: "no_ytdlp" }, { status: 503 });
  }

  try {
    const cues = await fetchTranscriptViaYtDlp(videoId, language);
    if (cues.length === 0) {
      return NextResponse.json({ error: "no_subs" }, { status: 404 });
    }
    return NextResponse.json({ cues });
  } catch (err) {
    if (err instanceof Error && err.message === "no_ytdlp") {
      return NextResponse.json({ error: "no_ytdlp" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
