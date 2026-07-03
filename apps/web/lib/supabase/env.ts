/**
 * (구) Supabase 환경 변수 게이트 → 내장 DB 전환 후 항상 구성됨으로 처리.
 *
 * 내장 DB 는 외부 키 없이 동작하므로 별도 설정이 필요 없다.
 * 호출부 호환을 위해 함수 시그니처만 유지한다.
 */

/** 내장 DB 는 항상 사용 가능하므로 true. */
export function isSupabaseConfigured(): boolean {
  return true;
}
