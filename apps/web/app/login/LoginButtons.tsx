"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn("google")}
        disabled={loading !== null}
      >
        {loading === "google" ? "이동 중…" : "Google로 계속하기"}
      </Button>
      <Button
        type="button"
        onClick={() => signIn("github")}
        disabled={loading !== null}
        className="bg-neutral-900 text-white hover:bg-neutral-800"
      >
        {loading === "github" ? "이동 중…" : "GitHub로 계속하기"}
      </Button>
    </div>
  );
}
