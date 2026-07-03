"use client";

/**
 * (구) 브라우저용 Supabase 클라이언트 → 단일 사용자 로컬 모드 스텁.
 *
 * 내장 DB 는 서버에서만 동작하므로 브라우저에서는 DB 에 직접 접근하지 않는다.
 * DB 작업은 모두 서버 액션을 통해 수행한다. 이 스텁은 남은 인증 호출
 * (auth.getUser 등)만 고정 사용자로 응답하고, from() 은 사용 금지로 막는다.
 */

import { LOCAL_USER } from "@/lib/db/auth";

export function createClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: LOCAL_USER }, error: null };
      },
      async getSession() {
        return { data: { session: { user: LOCAL_USER } }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from() {
      throw new Error(
        "브라우저에서 DB 직접 접근은 불가합니다. 서버 액션을 통해 호출하세요.",
      );
    },
  };
}
