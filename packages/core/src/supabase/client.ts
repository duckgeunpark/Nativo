/**
 * 타입이 적용된 Supabase 클라이언트 (프레임워크 비의존).
 *
 * web/mobile 어디서나 재사용. Next.js의 쿠키 기반 SSR 클라이언트는
 * 이 타입(NativoClient)을 그대로 사용하되 생성만 apps/web 에서 @supabase/ssr 로 감싼다.
 *
 * 보안(설계서 7.1):
 *   - anon key 는 클라이언트 노출 가능 (RLS가 모든 테이블에 적용되어 있어야 안전)
 *   - service_role key 는 절대 클라이언트 번들에 포함 금지 → 서버 전용 팩토리에서만 사용
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.js";

/** 이 서비스의 모든 곳에서 쓰는 타입 적용 클라이언트. */
export type NativoClient = SupabaseClient<Database>;

/**
 * anon key 기반 클라이언트 생성 (브라우저/모바일 공용).
 * RLS에 의해 본인 행만 접근 가능.
 */
export function createBrowserSupabase(url: string, anonKey: string): NativoClient {
  return createClient<Database>(url, anonKey);
}

/**
 * service_role key 기반 클라이언트 생성 (서버 전용).
 * RLS를 우회하므로 절대 클라이언트 코드에서 호출하지 말 것.
 * (Next.js API Route / 서버 액션에서만)
 */
export function createServiceSupabase(url: string, serviceRoleKey: string): NativoClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
