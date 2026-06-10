import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth 콜백. 제공자에서 돌아온 code 를 세션으로 교환한 뒤 분기.
 * 신규 사용자는 온보딩(언어 선택)으로, 기존 사용자는 대시보드로.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);

      // 온보딩 완료 여부 판단: occupation 이 비어 있으면 첫 로그인으로 간주
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("occupation")
          .eq("id", user.id)
          .single();
        const target = profile?.occupation ? "/dashboard" : "/onboarding";
        return NextResponse.redirect(`${origin}${target}`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
