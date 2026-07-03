/**
 * (구) Supabase 미설정 안내 → 내장 DB 전환 후 표시되지 않는 폴백.
 *
 * 내장 DB 는 항상 사용 가능(`isSupabaseConfigured()` 는 항상 true)하므로
 * 이 컴포넌트는 렌더링되지 않는다. 여러 페이지의 가드 분기에서 import 만 유지하기 위한 스텁.
 */
export function SupabaseNotice() {
  return (
    <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
      데이터베이스를 초기화하는 중입니다…
    </div>
  );
}
