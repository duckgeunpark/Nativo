/** Supabase 키가 아직 없을 때 보여주는 안내 (개발 초기 전용). */
export function SupabaseNotice() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="mb-2 font-semibold">⚙️ Supabase 설정이 필요합니다</p>
      <p className="leading-relaxed">
        <code className="rounded bg-amber-100 px-1">.env.local</code> 에{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> 과{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를
        넣으면 로그인과 데이터 연동이 활성화됩니다. (<code>.env.example</code> 참고)
      </p>
    </div>
  );
}
