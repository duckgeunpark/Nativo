"use client";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * anon key 사용 → RLS로 본인 행만 접근.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@nativo/core";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
