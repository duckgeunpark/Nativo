/** Supabase 환경 변수 접근 + 설정 여부 판별. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 키가 아직 없을 때(개발 초기) 앱이 죽지 않도록 안내 화면으로 분기하기 위한 플래그. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
