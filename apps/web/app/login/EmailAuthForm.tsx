"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "signin" | "signup";

export function EmailAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자 이상 비밀번호를 입력하세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      // 이메일 확인이 꺼져 있으면 즉시 세션 생성 → 온보딩으로
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      setMessage(
        "확인 이메일을 보냈어요. (Supabase → Authentication → Email 에서 'Confirm email'을 끄면 바로 로그인됩니다)",
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
        autoComplete="email"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호 (6자 이상)"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />

      {message && <p className="text-sm text-destructive">{message}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "처리 중…" : mode === "signup" ? "회원가입" : "로그인"}
      </Button>

      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-muted-foreground"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setMessage(null);
        }}
      >
        {mode === "signin" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
      </Button>
    </form>
  );
}
