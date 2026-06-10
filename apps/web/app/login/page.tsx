import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { LoginButtons } from "./LoginButtons";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Nativo</h1>
        <p className="mt-2 text-sm text-neutral-600">로그인하고 학습을 이어가세요</p>
      </div>

      {isSupabaseConfigured() ? <LoginButtons /> : <SupabaseNotice />}
    </main>
  );
}
