"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CefrLevel, Language } from "@nativo/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/ui/states";
import { CATEGORY_LABEL } from "@/lib/chunks";
import type { GeneratedChunk } from "@/lib/ai-chunks";
import { saveGeneratedChunks } from "./actions";

/**
 * 상황을 입력하면 AI가 청크 10개를 생성해 미리보기 → '모두 저장'으로 내 청크에 담는다.
 * (OpenAI 키 없으면 503 → 안내 메시지)
 */
export function ChunkGenerator({
  language,
  level,
}: {
  language: Language;
  level: CefrLevel;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedChunk[] | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function generate() {
    if (loading || situation.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/chunks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, situation: situation.trim(), level }),
      });
      if (res.status === 503) {
        setError("AI 생성은 OpenAI 키가 설정된 환경에서만 동작합니다.");
        return;
      }
      if (!res.ok) {
        setError("생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as { chunks: GeneratedChunk[] };
      setResult(data.chunks);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    if (!result || saving) return;
    setSaving(true);
    setError(null);
    const res = await saveGeneratedChunks({ language, chunks: result });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "저장 실패");
      return;
    }
    setSavedMsg(`${res.saved ?? 0}개를 내 청크에 담았어요.`);
    setResult(null);
    setSituation("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-lg border border-dashed px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
      >
        ✨ AI로 상황별 청크 생성
      </button>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">✨ AI 청크 생성</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            닫기
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          상황을 입력하면 그 상황에서 원어민이 쓰는 표현 10개를 만들어 드려요.
        </p>
        <div className="flex gap-2">
          <Input
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="예: 호텔에서 체크인할 때"
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
          <Button onClick={generate} disabled={loading || situation.trim().length < 2}>
            {loading ? "생성 중…" : "생성"}
          </Button>
        </div>

        <ErrorBanner message={error} />
        {savedMsg && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{savedMsg}</p>
        )}

        {result && (
          <div className="space-y-2">
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {result.map((c, i) => (
                <li key={`${c.expression}-${i}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.expression}</span>
                    {c.category && (
                      <Badge variant="muted">
                        {CATEGORY_LABEL[c.category] ?? c.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.translation_ko}</p>
                  {c.nuance && (
                    <p className="mt-0.5 text-xs text-muted-foreground">뉘앙스: {c.nuance}</p>
                  )}
                </li>
              ))}
            </ul>
            <Button onClick={saveAll} disabled={saving} className="w-full">
              {saving ? "저장 중…" : `${result.length}개 모두 내 청크에 담기`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
