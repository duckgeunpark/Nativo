/**
 * 서버(서버 컴포넌트 / Route Handler / 서버 액션)용 DB 클라이언트.
 *
 * 과거 Supabase(쿠키 세션/RLS) → 현재 내장 DB(libSQL/SQLite) 어댑터로 대체.
 * import 경로(`@/lib/supabase/server`)는 호출부 호환을 위해 유지한다.
 *
 * noStore(): 과거엔 createServerClient 가 cookies() 를 읽어 자동 동적 렌더였으나
 * 내장 DB 는 쿠키를 쓰지 않아 Next 가 정적 프리렌더로 굳혀 DB 변경이 반영되지 않는다.
 * 이를 막기 위해 DB 클라이언트를 만들 때 정적 캐시를 명시적으로 opt-out 한다.
 */

import { unstable_noStore as noStore } from "next/cache";
import { createClient as createDbClient } from "@/lib/db";

export function createClient() {
  noStore();
  return createDbClient();
}
