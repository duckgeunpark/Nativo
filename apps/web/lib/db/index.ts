/**
 * 내장 DB 어댑터 진입점 — Supabase 클라이언트의 드롭인 대체.
 *
 * 사용:
 *   const db = createClient();
 *   const { data, error } = await db.from("flashcards").select("*").eq("user_id", id);
 *   const { data: { user } } = await db.auth.getUser();
 *
 * 서버 전용(node:fs / libSQL). 클라이언트 컴포넌트에서 직접 import 하지 말 것
 * (대신 서버 액션을 통해 호출).
 */

import type { Database, Tables } from "@nativo/core";
import { authStub } from "./auth";
import { QueryBuilder } from "./query-builder";

type TableName = keyof Database["public"]["Tables"];

export function createClient() {
  return {
    from<K extends TableName>(table: K): QueryBuilder<Tables<K>> {
      return new QueryBuilder<Tables<K>>(table);
    },
    auth: authStub,
  };
}

export type LocalDbClient = ReturnType<typeof createClient>;
export { LOCAL_USER, LOCAL_USER_ID } from "./auth";
