import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, youtube_video_id, title, last_position_sec, total_watch_sec")
    .eq("id", params.id)
    .single();

  if (!video) notFound();

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-8">
        <Link
          href="/learn/shadowing"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 쉐도잉 목록
        </Link>
        <h1 className="mb-4 mt-2 line-clamp-2 text-lg font-bold">
          {video.title ?? "쉐도잉"}
        </h1>
        <ShadowingPlayer
          id={video.id}
          videoId={video.youtube_video_id}
          startSec={video.last_position_sec ?? 0}
          initialWatchSec={video.total_watch_sec ?? 0}
        />
      </main>
    </>
  );
}
