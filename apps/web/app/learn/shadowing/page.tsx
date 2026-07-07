import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/states";
import { AddVideoForm } from "./AddVideoForm";
import { ShadowingListItem } from "./ShadowingListItem";

export default async function ShadowingPage() {
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

  const { data: videos } = await supabase
    .from("shadowing_videos")
    .select("id, title, thumbnail_url, youtube_video_id, last_position_sec, completed")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const list = videos ?? [];

  return (
    <AppShell>
      <main className="container max-w-4xl py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">쉐도잉</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            좋아하는 YouTube 영상을 따라 말하며 발음·리듬을 훈련하세요.
          </p>
        </header>

        <div className="mb-8">
          <AddVideoForm />
        </div>

        {list.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => (
              <li key={v.id}>
                <ShadowingListItem
                  id={v.id}
                  title={v.title}
                  thumbnailUrl={v.thumbnail_url}
                  youtubeVideoId={v.youtube_video_id}
                  lastPositionSec={v.last_position_sec ?? 0}
                  completed={v.completed}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="🎬"
            title="아직 추가한 영상이 없어요"
            description="위에 YouTube 링크를 붙여넣어 첫 영상을 추가하세요."
          />
        )}
      </main>
    </AppShell>
  );
}
