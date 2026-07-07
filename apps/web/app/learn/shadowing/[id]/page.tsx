import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { fetchTranscript } from "@/lib/youtube";
import { ShadowingPlayer } from "./ShadowingPlayer";

export default async function ShadowingVideoPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <SupabaseNotice />
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: video } = await supabase
    .from("shadowing_videos")
    .select(
      "id, youtube_video_id, title, language, last_position_sec, total_watch_sec, transcript",
    )
    .eq("id", params.id)
    .single();

  if (!video) notFound();

  // 저장해 둔 자막이 있으면 그대로 사용, 없으면 자동 수집을 한 번 시도(대개 실패 → 빈 배열).
  const stored = video.transcript ?? [];
  const transcript =
    stored.length > 0
      ? stored
      : await fetchTranscript(video.youtube_video_id, video.language).catch(() => []);

  return (
    <AppShell>
      <main className="container max-w-6xl py-8">
        <Link
          href="/learn/shadowing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden /> 쉐도잉 목록
        </Link>
        <h1 className="mb-4 mt-2 line-clamp-2 font-display text-xl font-bold tracking-tight">
          {video.title ?? "쉐도잉"}
        </h1>
        <ShadowingPlayer
          id={video.id}
          videoId={video.youtube_video_id}
          language={video.language}
          startSec={video.last_position_sec ?? 0}
          initialWatchSec={video.total_watch_sec ?? 0}
          transcript={transcript}
        />
      </main>
    </AppShell>
  );
}
