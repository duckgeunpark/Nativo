"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/states";
import { cn } from "@/lib/utils";

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
      setError(data.error ?? "가져오기에 실패했어요. 링크를 확인해 주세요.");
      return;
    }
    router.push(`/learn/shadowing/${data.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <label htmlFor="youtube-url" className="text-sm font-semibold">
        YouTube URL
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="youtube-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube 링크 붙여넣기 (youtube.com / youtu.be)"
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !url.trim()}
          className={cn(
            "shrink-0 bg-highlight text-highlight-foreground hover:bg-highlight/90",
          )}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> 가져오는 중…
            </>
          ) : (
            "가져오기"
          )}
        </Button>
      </div>
      <ErrorBanner message={error} className="mt-3" />
    </form>
  );
}
