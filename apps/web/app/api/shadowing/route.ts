import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractVideoId, fetchYouTubeMeta } from "@/lib/youtube";

/** YouTube URL 추가: 도메인 검증 → video id 추출 → oEmbed 제목/썸네일 → 저장. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "유효한 YouTube URL이 아닙니다." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language")
    .eq("id", user.id)
    .single();
  const language = profile?.selected_language ?? "english";

  const meta = await fetchYouTubeMeta(videoId);

  const { data, error } = await supabase
    .from("shadowing_videos")
    .insert({
      user_id: user.id,
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      youtube_video_id: videoId,
      title: meta.title,
      thumbnail_url: meta.thumbnailUrl,
      language,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
