import { redirect } from "next/navigation";
import Link from "next/link";
import { Mic, MessageCircle, ChevronRight, Play } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { SCENARIOS } from "@/lib/roleplay";
import { Card, CardContent } from "@/components/ui/card";

export default async function SpeakingHubPage() {
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

  const [shadowRes, roleplayRes] = await Promise.all([
    supabase
      .from("shadowing_videos")
      .select("id, title, thumbnail_url, youtube_video_id, last_position_sec, completed")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("roleplay_sessions")
      .select("id, scenario_id, mode, score_total, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const shadow = shadowRes.data;
  const roleplay = roleplayRes.data;
  const roleplayTitle = roleplay
    ? (SCENARIOS.find((s) => s.id === roleplay.scenario_id)?.title ?? "커스텀 대화")
    : null;

  return (
    <AppShell>
      <main className="container py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">말하기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            실전 같은 연습으로 유창함과 자신감을 키워요.
          </p>
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">바로 가기</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EntryCard
              icon={Mic}
              title="쉐도잉"
              description="영상을 따라 말하며 발음·리듬을 훈련해요"
              href="/learn/shadowing"
            />
            <EntryCard
              icon={MessageCircle}
              title="AI 대화"
              description="상황극으로 실전 회화를 연습해요"
              href="/learn/roleplay"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">최근 활동</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shadow ? (
              <Link
                href={`/learn/shadowing/${shadow.id}`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full overflow-hidden transition-colors hover:bg-secondary/50">
                  <div className="relative aspect-video w-full bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        shadow.thumbnail_url ??
                        `https://i.ytimg.com/vi/${shadow.youtube_video_id}/hqdefault.jpg`
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/90 text-primary">
                        <Play className="h-4 w-4" aria-hidden />
                      </span>
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <p className="line-clamp-1 font-medium">{shadow.title ?? "제목 없는 영상"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(shadow.last_position_sec ?? 0) > 0
                        ? `${Math.floor((shadow.last_position_sec ?? 0) / 60)}분 지점부터 이어보기`
                        : "쉐도잉 이어하기"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <NullStateCard
                icon={Mic}
                title="쉐도잉"
                description="아직 추가한 영상이 없어요. 좋아하는 영상을 추가해 시작해보세요."
                href="/learn/shadowing"
              />
            )}

            {roleplay ? (
              <Link
                href="/learn/roleplay"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors hover:bg-secondary/50">
                  <CardContent className="flex h-full flex-col justify-center gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{roleplayTitle}</p>
                      {roleplay.score_total !== null && (
                        <span className="text-lg font-semibold text-highlight">
                          {roleplay.score_total}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {roleplay.created_at.slice(0, 10)} · 다시 연습하기
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <NullStateCard
                icon={MessageCircle}
                title="AI 대화"
                description="아직 연습한 대화가 없어요. 상황을 골라 첫 대화를 시작해보세요."
                href="/learn/roleplay"
              />
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function EntryCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof Mic;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}

function NullStateCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof Mic;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full border-dashed transition-colors hover:bg-secondary/50">
        <CardContent className="flex h-full flex-col items-start justify-center gap-2 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
