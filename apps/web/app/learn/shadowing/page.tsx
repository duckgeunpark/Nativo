import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AddVideoForm } from "./AddVideoForm";

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
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">쉐도잉</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            좋아하는 YouTube 영상을 따라 말하며 발음·리듬을 훈련하세요.
          </p>
        </header>

        <div className="mb-8">
          <AddVideoForm />
        </div>

        {list.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((v) => (
              <li key={v.id}>
                <Link href={`/learn/shadowing/${v.id}`}>
                  <Card className="overflow-hidden transition-colors hover:bg-secondary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        v.thumbnail_url ??
                        `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`
                      }
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                    <CardContent className="p-3">
                      <p className="line-clamp-2 text-sm font-medium">
                        {v.title ?? "제목 없는 영상"}
                      </p>
                      {(v.last_position_sec ?? 0) > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {v.completed ? "완료" : `${Math.floor((v.last_position_sec ?? 0) / 60)}분 지점부터 이어보기`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              위에 YouTube 링크를 붙여넣어 첫 영상을 추가하세요.
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
