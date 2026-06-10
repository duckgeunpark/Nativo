"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github";

export function LoginButtons() {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function signIn(provider: Provider) {
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setLoading(null);
      alert(`로그인 실패: ${error.message}`);
    }
    // 성공 시 OAuth 제공자로 리다이렉트되므로 상태 정리 불필요
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={loading !== null}
        className="rounded-lg border border-neutral-300 bg-white px-4 py-3 font-medium transition hover:bg-neutral-50 disabled:opacity-60"
      >
        {loading === "google" ? "이동 중…" : "Google로 계속하기"}
      </button>
      <button
        type="button"
        onClick={() => signIn("github")}
        disabled={loading !== null}
        className="rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading === "github" ? "이동 중…" : "GitHub로 계속하기"}
      </button>
    </div>
  );
}
