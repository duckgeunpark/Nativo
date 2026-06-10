/**
 * 서버(서버 컴포넌트 / Route Handler / 서버 액션)용 Supabase 클라이언트.
 * 쿠키 기반 세션. anon key 사용 (RLS 적용).
 *
 * service_role 이 필요한 작업(시나리오 system_prompt 조회, 비용 한도 검사 등)은
 * 별도 서버 전용 팩토리로 분리 예정 (@nativo/core createServiceSupabase).
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@nativo/core";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 호출된 경우 set 이 막힐 수 있음 →
          // 세션 갱신은 middleware 가 담당하므로 무시해도 안전.
        }
      },
    },
  });
}
