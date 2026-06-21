"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/states";
import { countWords, type WritingFeedback } from "@/lib/ai-writing";
import { saveJournalEntry } from "./actions";

/**
 * 영작 일기 작성 → AI 첨삭 요청 → 첨삭 확인 후 저장.
 * (OpenAI 키 없으면 첨삭 없이 저장만 가능)
 */
export function JournalEditor({ language }: { language: Language }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function requestFeedback() {
    if (loading || content.trim().length < 5) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/journal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, content: content.trim() }),
      });
      if (res.status === 503) {
        setError("AI 첨삭은 OpenAI 키가 설정된 환경에서만 동작합니다. 첨삭 없이 저장은 가능해요.");
        return;
      }
      if (!res.ok) {
        setError("첨삭 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setFeedback((await res.json()) as WritingFeedback);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (saving || content.trim().length < 1) return;
    setSaving(true);
    setError(null);
    const res = await saveJournalEntry({
      language,
      content: content.trim(),
      aiFeedback: feedback?.summary ?? null,
      corrections: feedback?.corrections ?? [],
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "저장 실패");
      return;
    }
    setSavedMsg("오늘의 일기를 저장했어요.");
    setContent("");
    setFeedback(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘 있었던 일을 학습 언어로 적어 보세요…"
            rows={7}
            className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{countWords(content)} 단어</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={requestFeedback}
                disabled={loading || content.trim().length < 5}
              >
                {loading ? "첨삭 중…" : "AI 첨삭"}
              </Button>
              <Button onClick={save} disabled={saving || content.trim().length < 1}>
                {saving ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
          <ErrorBanner message={error} />
          {savedMsg && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{savedMsg}</p>
          )}
        </CardContent>
      </Card>

      {feedback && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium">✍️ 첨삭 결과</p>
            {feedback.summary && (
              <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">{feedback.summary}</p>
            )}
            {feedback.corrections.length > 0 ? (
              <ul className="space-y-2">
                {feedback.corrections.map((c, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <p className="text-destructive line-through">{c.original}</p>
                    <p className="font-medium text-success">{c.corrected}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">고칠 부분이 거의 없어요. 잘 썼어요! 🎉</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
