import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/**
 * 루트 진입점 (단일 사용자 로컬 모드 — 로그인 없음).
 * 온보딩 완료(카드 보유) 여부로 대시보드/온보딩을 분기한다.
 */
export default async function HomePage() {
  const supabase = createClient();
  const { count } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", LOCAL_USER_ID);

  redirect((count ?? 0) > 0 ? "/dashboard" : "/onboarding");
}
