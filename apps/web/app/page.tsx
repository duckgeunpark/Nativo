import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/**
 * 루트 진입점 (단일 사용자 로컬 모드 — 로그인 없음).
 * 온보딩 완료(카드 보유) 여부로 대시보드/온보딩을 분기한다.
 * (항상 즉시 redirect 하므로 아래 UI는 DB 초기화 지연 등 예외 상황의 폴백으로만 노출된다.)
 */
export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <span className="font-display text-3xl font-bold text-primary">Nativo</span>
        <SupabaseNotice />
      </main>
    );
  }

  const supabase = createClient();
  const { count } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", LOCAL_USER_ID);

  redirect((count ?? 0) > 0 ? "/dashboard" : "/onboarding");
}
