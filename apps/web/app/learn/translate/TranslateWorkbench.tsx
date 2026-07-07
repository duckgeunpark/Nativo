"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/states";
import { countWords } from "@/lib/ai-writing";
import { cn } from "@/lib/utils";
import type { TranslationEvaluation } from "@/lib/ai-translate";
import { saveTranslationSession } from "./actions";

const MAX_CHARS = 5000;
const TEXTAREA_CLASS =
  "w-full min-h-[120px] max-h-[280px] overflow-y-auto resize-none rounded-lg border bg-background p-3 text-sm outline-none focus:ring-1 focus:ring-primary";

/**
 * 번역가 모드 — 원문을 붙여넣고 한국어로 번역 → AI 평가(정확/자연/뉘앙스) → 저장.
 * (OpenAI 키 없으면 평가 없이 저장만 가능)
 */
export function TranslateWorkbench({ language }: { language: Language }) {
  const router = useRouter();
  const [original, setOriginal] = useState("");
  const [translation, setTranslation] = useState("");
  const [evaluation, setEvaluation] = useState<TranslationEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const ready = original.trim().length >= 2 && translation.trim().length >= 1;

  async function evaluate() {
    if (loading || !ready) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/translate/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, original: original.trim(), translation: translation.trim() }),
      });
      if (res.status === 503) {
        setError("AI 평가는 OpenAI 키가 설정된 환경에서만 동작합니다. 평가 없이 저장은 가능해요.");
        return;
      }
      if (!res.ok) {
        setError("평가에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setEvaluation((await res.json()) as TranslationEvaluation);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (saving || !ready) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const res = await saveTranslationSession({
      language,
      original: original.trim(),
      translation: translation.trim(),
      scores: evaluation
        ? {
            total: evaluation.score_total,
            accuracy: evaluation.score_accuracy,
            naturalness: evaluation.score_naturalness,
            nuance: evaluation.score_nuance,
            passed: evaluation.passed,
          }
        : null,
      feedback: evaluation?.feedback ?? null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "저장 실패");
      return;
    }
    setSavedMsg("번역을 저장했어요.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">원문 (학습 언어)</label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {countWords(original)} 단어
              </span>
            </div>
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value.slice(0, MAX_CHARS))}
              placeholder="번역할 원문을 붙여넣으세요…"
              className={TEXTAREA_CLASS}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">내 번역 (한국어)</label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {countWords(translation)} 단어
              </span>
            </div>
            <textarea
              value={translation}
              onChange={(e) => setTranslation(e.target.value.slice(0, MAX_CHARS))}
              placeholder="자연스러운 한국어로 번역해 보세요…"
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={evaluate} disabled={loading || !ready}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {loading ? "평가 중…" : "AI 평가"}
            </Button>
            <Button onClick={save} disabled={saving || !ready}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
          <ErrorBanner message={error} />
          {savedMsg && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{savedMsg}</p>
          )}
        </CardContent>
      </Card>

      {evaluation && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">📊 평가 결과</p>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  evaluation.passed ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                {evaluation.score_total}점 {evaluation.passed ? "· 합격" : ""}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <ScoreCell label="정확성" value={evaluation.score_accuracy} max={40} />
              <ScoreCell label="자연스러움" value={evaluation.score_naturalness} max={30} />
              <ScoreCell label="뉘앙스" value={evaluation.score_nuance} max={30} />
            </div>
            {evaluation.feedback.good_points.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-success">잘한 점</p>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                  {evaluation.feedback.good_points.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.feedback.improvements.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">개선 제안</p>
                <ul className="space-y-2">
                  {evaluation.feedback.improvements.map((it, i) => (
                    <li key={i} className="rounded-lg border p-3 text-sm">
                      <p className="text-muted-foreground">{it.original}</p>
                      <p className="font-medium text-success">→ {it.recommended}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{it.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreCell({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="rounded-lg border py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">
        {value}
        <span className="text-xs text-muted-foreground"> / {max}</span>
      </p>
    </div>
  );
}
