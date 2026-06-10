import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // 키가 있으면 로그인 상태에 따라 분기, 없으면 랜딩만 노출
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Nativo</h1>
        <p className="mt-3 text-lg text-neutral-600">Speak your way to native.</p>
        <p className="mt-1 text-sm text-neutral-500">
          5단계 Phase로 영어 · 스페인어 · 일본어를 원어민처럼.
        </p>
      </div>

      <Link
        href="/login"
        className="rounded-lg bg-brand px-6 py-3 font-medium text-brand-fg transition hover:opacity-90"
      >
        시작하기
      </Link>
    </main>
  );
}
