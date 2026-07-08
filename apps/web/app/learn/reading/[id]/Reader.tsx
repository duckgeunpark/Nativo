"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Languages, Volume2, X } from "lucide-react";
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
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { speak } from "@/lib/tts";
import { cn } from "@/lib/utils";

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
  left: number;
  top: number;
  flip: boolean;
}

const LANG_ISO: Record<Language, string> = { english: "en", spanish: "es", japanese: "ja" };

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

/** 클릭한 단어 기준 사전 팝업 위치 — viewport 아래 공간이 부족하면 위로 반전. */
function popupPosition(rect: DOMRect) {
  const POPUP_W = 300;
  const POPUP_H_EST = 260;
  const margin = 10;
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < POPUP_H_EST && rect.top > POPUP_H_EST;
  const left = Math.min(Math.max(rect.left, margin), Math.max(margin, window.innerWidth - POPUP_W - margin));
  const top = flip ? rect.top - margin : rect.bottom + margin;
  return { left, top, flip };
}

/**
 * 읽기 + 번역 통합 화면.
 *   왼쪽: 원서 본문(세리프, 자동 줄바꿈/하이픈). 단어 클릭 = 근처 사전 팝업, 문장 드래그 = 오른쪽 번역 대상 선택.
 *   오른쪽: 선택한 문장을 한국어로 번역 → 기본 번역/AI 첨삭 모드 → 저장.
 *   데스크톱은 상단 고정 페이지 바, 모바일은 하단 고정 바(페이지 이동 + 진행률).
 */
export function Reader({ text, language, page, total, prevHref, nextHref }: Props) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // 드래그로 선택한 텍스트 위에 띄우는 "번역하기" 버튼 (없으면 null)
  const [selBtn, setSelBtn] = useState<{ x: number; y: number; text: string } | null>(null);
  // 사용법 안내 토스트 — 세션당 한 번만 잠깐 보여주고 자동으로 사라짐
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("reader-tip-seen")) return;
    sessionStorage.setItem("reader-tip-seen", "1");
    setShowTip(true);
  }, []);

  // 숨김 타이머는 별도 effect로 — Strict Mode의 이중 실행에서 타이머가 유실되지 않도록
  useEffect(() => {
    if (!showTip) return;
    const t = setTimeout(() => setShowTip(false), 6000);
    return () => clearTimeout(t);
  }, [showTip]);

  const paragraphs = useMemo(() => splitParagraphs(text), [text]);

  // 페이지 이동 시 팝업/선택 상태 정리
  useEffect(() => {
    setLookup(null);
    setSelBtn(null);
    setSelected(null);
  }, [page]);

  // 스크롤 시 사전 팝업/번역 버튼 닫기
  useEffect(() => {
    function close() {
      setLookup(null);
      setSelBtn(null);
    }
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  async function onWordClick(raw: string, e: React.MouseEvent<HTMLSpanElement>) {
    // 드래그(선택)가 진행 중이면 사전을 띄우지 않는다 → 단어 클릭/문장 선택 충돌 방지
    if ((window.getSelection()?.toString().trim().length ?? 0) > 0) return;
    const word = cleanWord(raw);
    if (!word) return;
    const pos = popupPosition(e.currentTarget.getBoundingClientRect());
    setLookup({ word, loading: true, fields: {}, saved: false, ...pos });
    speak(word, language);
    const [fields, saved] = await Promise.all([
      fetchEnrich(word, language),
      isWordSaved(word, language).catch(() => false),
    ]);
    setLookup((prev) => (prev && prev.word === word ? { ...prev, loading: false, fields, saved } : prev));
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
      y: Math.max(rect.top - 10, 56),
      text: t.replace(/\s+/g, " "),
    });
  }

  function confirmSelection() {
    if (!selBtn) return;
    setSelected(selBtn.text);
    setSelBtn(null);
    window.getSelection()?.removeAllRanges();
  }

  const progressPct = total ? Math.min(100, Math.round((( page ?? 1) / total) * 100)) : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* 왼쪽: 읽기 */}
      <section className="min-w-0">
        <article
          lang={LANG_ISO[language]}
          onMouseUp={captureSelection}
          onTouchEnd={captureSelection}
          className="font-display text-[1.1rem] leading-8 [hyphens:auto] [overflow-wrap:anywhere]"
        >
          {paragraphs.map((sentences, pi) => (
            <p key={pi} className="mb-4">
              {sentences.map((sentence, si) => (
                <span key={si}>
                  {sentence.split(/(\s+)/).map((tok, ti) =>
                    /\s+/.test(tok) || !cleanWord(tok) ? (
                      tok
                    ) : (
                      <span
                        key={ti}
                        onClick={(e) => onWordClick(tok, e)}
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
        {/* 데스크톱 페이지 이동 바 — 본문을 다 읽고 만나도록 본문 아래에 배치 */}
        {total ? (
          <div className="mt-6 hidden items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5 lg:flex">
            {prevHref ? (
              <Link
                href={prevHref}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
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
                className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-medium hover:bg-secondary"
              >
                다음 <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span className="px-3 py-1 text-sm text-muted-foreground/40">다음 →</span>
            )}
          </div>
        ) : null}
      </section>

      {/* 오른쪽: 번역 패널 (데스크톱에서 좌측 구분선으로 시각적 분리) */}
      <section className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:border-l lg:pl-8">
        {selected ? (
          <TranslatePanel key={selected} original={selected} language={language} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Languages className="h-6 w-6 text-muted-foreground/60" aria-hidden />
              왼쪽에서 번역할 부분을 <b>드래그</b>한 뒤 <b>번역하기</b>를 누르세요.
            </CardContent>
          </Card>
        )}
      </section>

      {/* 사용법 안내 토스트 — 세션당 한 번, 6초 뒤 자동으로 사라짐 */}
      {showTip && (
        <div
          role="status"
          className="fixed left-1/2 top-16 z-40 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-lg border bg-popover/95 px-3 py-2 text-center text-xs text-popover-foreground shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-2 lg:top-6"
        >
          💡 <b>단어</b>를 누르면 뜻이 나오고, 번역할 부분을 <b>드래그</b>하면 뜨는{" "}
          <b>번역하기</b> 버튼을 누르세요.
        </div>
      )}

      {/* 드래그 선택 위에 뜨는 "번역하기" 플로팅 버튼 — 선택 영역이 있을 때만 노출 */}
      {selBtn && (
        <button
          type="button"
          // 선택이 풀리지 않도록 mousedown 기본동작 차단 후 onClick 처리
          onMouseDown={(e) => e.preventDefault()}
          onClick={confirmSelection}
          style={{ position: "fixed", left: selBtn.x, top: selBtn.y, transform: "translate(-50%, -100%)" }}
          className="z-50 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-highlight px-3.5 py-2 text-sm font-medium text-highlight-foreground shadow-lg transition hover:opacity-90"
        >
          <Languages className="h-4 w-4" aria-hidden /> 번역하기
        </button>
      )}

      {/* 단어 사전 팝업 — 클릭한 단어 근처, viewport 밖이면 위로 반전 */}
      {lookup && (
        <div
          role="dialog"
          aria-label={`${lookup.word} 사전`}
          style={{
            position: "fixed",
            left: lookup.left,
            top: lookup.top,
            transform: lookup.flip ? "translateY(-100%)" : undefined,
          }}
          className="z-50 w-[300px] max-w-[calc(100vw-20px)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{lookup.word}</p>
                <button
                  type="button"
                  onClick={() => speak(lookup.word, language)}
                  aria-label="발음 듣기"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {lookup.fields.pronunciation && (
                <span className="text-sm text-muted-foreground">{lookup.fields.pronunciation}</span>
              )}
              {!lookup.loading && lookup.fields.source && lookup.fields.source !== "none" && (
                <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {SOURCE_LABEL[lookup.fields.source]}
                </span>
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
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          {lookup.loading ? (
            <p className="mt-2 text-sm text-muted-foreground">찾는 중…</p>
          ) : (
            <p className="mt-2 max-h-40 overflow-y-auto text-sm text-muted-foreground">
              {lookup.fields.meaning ?? "뜻 정보를 찾지 못했어요 (그래도 하트로 담을 수 있어요)."}
            </p>
          )}
        </div>
      )}

      {/* 모바일 하단 고정 바 — 페이지 이동 + 진행률 */}
      {total ? (
        <div
          className="fixed inset-x-0 z-30 border-t bg-card/95 px-3 py-2 backdrop-blur lg:hidden"
          // 하단 탭바(AppShell, 3.25rem + safe-area) 바로 위에 틈 없이 붙인다
          style={{ bottom: "calc(3.25rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {page} / {total} 쪽
            </span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <ProgressBar value={progressPct} tone="highlight" className="mb-2" />
          <div className="flex items-center justify-between gap-2">
            {prevHref ? (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={prevHref}>
                  <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="flex-1" disabled>
                <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
              </Button>
            )}
            {nextHref ? (
              <Button asChild size="sm" className="flex-1">
                <Link href={nextHref}>
                  다음 <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="flex-1" disabled>
                끝까지 읽었어요 🎉
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type TranslateMode = "basic" | "ai";

/** 선택한 원문 문장을 번역 → 저장하는 오른쪽 패널. 기본 번역/AI 첨삭 두 모드로 나뉜다. */
function TranslatePanel({ original, language }: { original: string; language: Language }) {
  const [mode, setMode] = useState<TranslateMode>("basic");
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
        setError("AI 첨삭은 OpenAI 키가 설정된 환경에서만 동작합니다. 첨삭 없이 저장은 가능해요.");
        return;
      }
      if (!res.ok) {
        setError("첨삭에 실패했어요. 잠시 후 다시 시도해 주세요.");
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
      <SegmentedTabs
        aria-label="번역 모드"
        value={mode}
        onValueChange={(v) => setMode(v as TranslateMode)}
        options={[
          { value: "basic", label: "기본 번역" },
          { value: "ai", label: "AI 첨삭" },
        ]}
      />
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
                <Volume2 className="h-4 w-4" aria-hidden />
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
            {mode === "ai" && (
              <Button variant="outline" onClick={evaluate} disabled={loading || !ready}>
                {loading ? "첨삭 중…" : "AI 평가"}
              </Button>
            )}
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

      {mode === "ai" && evaluation && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">📊 평가 결과</p>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  evaluation.passed
                    ? "bg-success/10 text-success"
                    : "bg-secondary text-muted-foreground",
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
