/**
 * 매 요청마다 Supabase 세션 쿠키를 갱신하고 보호 라우트 접근을 막는다.
 * @supabase/ssr 권장 패턴.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@nativo/core";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** 인증이 필요한 경로 prefix. */
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/learn"];

export async function updateSession(request: NextRequest) {
  // 키가 아직 없으면 인증을 건너뛰고 그대로 통과 (개발 초기 대응)
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 는 토큰을 검증하므로 반드시 호출 (getSession 만으로는 불충분)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
