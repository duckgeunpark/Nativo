"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddVideoForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/shadowing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

    if (!res.ok || !data.id) {
      setLoading(false);
      setError(data.error ?? "추가에 실패했습니다.");
      return;
    }
    router.push(`/learn/shadowing/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube 링크 붙여넣기 (youtube.com / youtu.be)"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "추가 중…" : "추가"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
