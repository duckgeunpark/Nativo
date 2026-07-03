"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Language } from "@nativo/core";
import type { EnrichResult } from "@/app/api/enrich/route";
import type { TranslationEvaluation } from "@/lib/ai-translate";
import {
  addToMyWords,
  removeFromMyWords,
  isWordSaved,
} from "@/app/learn/flashcards/dictionary/actions";
import { saveTranslationSession } from "@/app/learn/translate/actions";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/states";
import { speak } from "@/lib/tts";

interface Props {
  text: string;
  language: Language;
  page?: number;
  total?: number;
  prevHref?: string | null;
  nextHref?: string | null;
}

interface Lookup {
  word: string;
  loading: boolean;
  fields: Partial<EnrichResult>;
  saved: boolean;
}

const cleanWord = (raw: string) => raw.replace(/^[^\p{L}'-]+|[^\p{L}'-]+$/gu, "");

const SOURCE_LABEL: Record<NonNullable<EnrichResult["source"]>, string> = {
  dictionary: "전체 사전",
  ai: "AI 검색",
  none: "",
};

/** 본문을 문단(빈 줄) → 문장 단위로 분리. 학습용이라 약어 과분할은 허용. */
function splitParagraphs(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((para) =>
      para
        .split(/(?<=[.!?。！？])\s+(?=[\p{Lu}"'(¿¡\p{L}])/u)
        .map((s) => s.trim())
        .filter(Boolean),
    );
}

/**
 * 읽기 + 번역 통합 화면.
 *   왼쪽: 원서 본문. 단어 클릭 = 사전(뜻 보기·카드 담기), 문장 클릭 = 오른쪽 번역 대상 선택.
 *   오른쪽: 선택한 문장을 한국어로 번역 → AI 평가(정확/자연/뉘앙스) → 저장.
 */
export function Reader({ text, language, page, total, prevHref, nextHref }: Props) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // 드래그로 선택한 텍스트 위에 띄우는 "번역하기" 버튼 (없으면 null)
  const [selBtn, setSelBtn] = useState<{ x: number; y: number; text: string } | null>(null);

  const paragraphs = useMemo(() => splitParagraphs(text), [text]);

  async function onWordClick(raw: string) {
    // 드래그(선택)가 진행 중이면 사전을 띄우지 않는다 → 단어 클릭/문장 선택 충돌 방지
    if ((window.getSelection()?.toString().trim().length ?? 0) > 0) return;
    const word = cleanWord(raw);
    if (!word) return;
    setLookup({ word, loading: true, fields: {}, saved: false });
    speak(word, language);
    const [fields, saved] = await Promise.all([
      fetchEnrich(word, language),
      isWordSaved(word, language).catch(() => false),
    ]);
    setLookup({ word, loading: false, fields, saved });
  }

  /** 드래그가 끝나면 선택 영역을 읽어 "번역하기" 버튼 위치를 잡는다. */
  function captureSelection() {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? "";
    if (t.length < 2 || !sel || sel.rangeCount === 0) {
      setSelBtn(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelBtn(null);
      return;
    }
    setSelBtn({
      x: Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80),
      y: Math.max(rect.top - 8, 48),
      text: t.replace(/\s+/g, " "),
    });
  }

  function confirmSelection() {
    if (!selBtn) return;
    setSelected(selBtn.text);
    setSelBtn(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 왼쪽: 읽기 */}
      <section>
        {total ? (
          <div className="sticky top-14 z-20 mb-3 flex items-center justify-between gap-2 rounded-lg border bg-background/95 px-2 py-1.5 backdrop-blur">
            {prevHref ? (
              <Link
                href={prevHref}
                className="rounded-md px-3 py-1 text-sm font-medium hover:bg-secondary"
              >
                ← 이전
              </Link>
            ) : (
              <span className="px-3 py-1 text-sm text-muted-foreground/40">← 이전</span>
            )}
            <span className="text-xs text-muted-foreground">
              {page} / {total} 쪽
            </span>
            {nextHref ? (
              <Link
                href={nextHref}
                className="rounded-md px-3 py-1 text-sm font-medium hover:bg-secondary"
              >
                다음 →
              </Link>
            ) : (
              <span className="px-3 py-1 text-sm text-muted-foreground/40">다음 →</span>
            )}
          </div>
        ) : null}
        <p className="mb-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          💡 <b>단어</b>를 누르면 뜻이 나오고, 번역할 부분을 <b>드래그</b>하면 뜨는{" "}
          <b>번역하기</b> 버튼을 누르세요.
        </p>
        <article
          onMouseUp={captureSelection}
          onTouchEnd={captureSelection}
          className="text-[1.05rem] leading-8"
        >
          {paragraphs.map((sentences, pi) => (
            <p key={pi} className="mb-4 break-words">
              {sentences.map((sentence, si) => (
                <span key={si}>
                  {sentence.split(/(\s+)/).map((tok, ti) =>
                    /\s+/.test(tok) || !cleanWord(tok) ? (
                      tok
                    ) : (
                      <span
                        key={ti}
                        onClick={() => onWordClick(tok)}
                        className="cursor-pointer rounded hover:bg-primary/20"
                      >
                        {tok}
                      </span>
                    ),
                  )}{" "}
                </span>
              ))}
            </p>
          ))}
        </article>
      </section>

      {/* 오른쪽: 번역 */}
      <section className="lg:sticky lg:top-20 lg:self-start">
        {selected ? (
          <TranslatePanel key={selected} original={selected} language={language} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              왼쪽에서 번역할 부분을 <b>드래그</b>한 뒤 <b>번역하기</b>를 누르세요.
            </CardContent>
          </Card>
        )}
      </section>

      {/* 드래그 선택 위에 뜨는 "번역하기" 버튼 */}
      {selBtn && (
        <button
          type="button"
          // 선택이 풀리지 않도록 mousedown 기본동작 차단 후 onClick 처리
          onMouseDown={(e) => e.preventDefault()}
          onClick={confirmSelection}
          style={{ position: "fixed", left: selBtn.x, top: selBtn.y, transform: "translate(-50%, -100%)" }}
          className="z-50 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          ✍ 번역하기
        </button>
      )}

      {/* 단어 사전 팝업 (하단 고정) */}
      {lookup && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg">
          <div className="container max-w-2xl py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{lookup.word}</p>
                  <button
                    type="button"
                    onClick={() => speak(lookup.word, language)}
                    aria-label="발음 듣기"
                  >
                    🔊
                  </button>
                  {lookup.fields.pronunciation && (
                    <span className="text-sm text-muted-foreground">
                      {lookup.fields.pronunciation}
                    </span>
                  )}
                  {!lookup.loading && lookup.fields.source && lookup.fields.source !== "none" && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {SOURCE_LABEL[lookup.fields.source]}
                    </span>
                  )}
                </div>
                {lookup.loading ? (
                  <p className="mt-1 text-sm text-muted-foreground">찾는 중…</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lookup.fields.meaning ??
                      "뜻 정보를 찾지 못했어요 (그래도 하트로 담을 수 있어요)."}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!lookup.loading && (
                  <HeartToggle
                    key={lookup.word}
                    initialActive={lookup.saved}
                    onAdd={() =>
                      addToMyWords({
                        language,
                        word: lookup.word,
                        meaning: lookup.fields.meaning ?? lookup.word,
                        pronunciation: lookup.fields.pronunciation ?? null,
                        example_1: lookup.fields.example_1 ?? null,
                        part_of_speech: lookup.fields.part_of_speech ?? null,
                      })
                    }
                    onRemove={() => removeFromMyWords({ language, word: lookup.word })}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setLookup(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 선택한 원문 문장을 번역 → AI 평가 → 저장하는 오른쪽 패널. */
function TranslatePanel({ original, language }: { original: string; language: Language }) {
  const [translation, setTranslation] = useState("");
  const [evaluation, setEvaluation] = useState<TranslationEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const ready = translation.trim().length >= 1;

  async function evaluate() {
    if (loading || !ready) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/translate/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, original, translation: translation.trim() }),
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
    const res = await saveTranslationSession({
      language,
      original,
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
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">원문</label>
              <button
                type="button"
                onClick={() => speak(original, language)}
                aria-label="원문 듣기"
                className="text-muted-foreground hover:text-foreground"
              >
                🔊
              </button>
            </div>
            <p className="rounded-lg bg-secondary/40 p-3 text-sm leading-6">{original}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">내 번역 (한국어)</label>
            <textarea
              autoFocus
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="이 문장을 자연스러운 한국어로 번역해 보세요…"
              rows={4}
              className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={evaluate} disabled={loading || !ready}>
              {loading ? "평가 중…" : "AI 평가"}
            </Button>
            <Button onClick={save} disabled={saving || !ready}>
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
                className={
                  evaluation.passed
                    ? "rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success"
                    : "rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground"
                }
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

/** enrich API 호출 — 전체 사전 1차 검색 → 없으면 AI. */
async function fetchEnrich(
  word: string,
  language: Language,
): Promise<Partial<EnrichResult>> {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, language }),
    });
    return res.ok ? ((await res.json()) as Partial<EnrichResult>) : {};
  } catch {
    return {};
  }
}
