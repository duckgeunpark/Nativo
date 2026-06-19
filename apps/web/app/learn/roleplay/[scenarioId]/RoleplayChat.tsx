"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import type { Language } from "@nativo/core";
import {
  MISSION_COMPLETE_TOKEN,
  type RoleplayCoachFeedback,
} from "@/lib/roleplay";
import { speak, isSpeechSupported } from "@/lib/tts";
import {
  isRecognitionSupported,
  startRecognition,
  type RecognitionController,
} from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  /** 정적 시나리오 ID 또는 커스텀 상황 중 하나. */
  scenarioId?: string;
  custom?: { aiRole: string; userMission: string };
  language: Language;
  configured: boolean;
}

type EndReason = "mission" | "manual";

export function RoleplayChat({ scenarioId, custom, language, configured }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState<EndReason | null>(null);
  const [feedback, setFeedback] = useState<RoleplayCoachFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const startedRef = useRef(false);
  const recRef = useRef<RecognitionController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const voiceInSupported = isRecognitionSupported();
  const voiceOutSupported = isSpeechSupported();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, feedback]);

  async function callApi(history: Msg[]): Promise<string | null> {
    const res = await fetch("/api/roleplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, custom, language, messages: history }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    return data.reply ?? null;
  }

  /** AI 응답 처리: 미션 완료 토큰 감지 → 제거 후 종료. */
  function handleReply(reply: string, history: Msg[]) {
    const done = reply.includes(MISSION_COMPLETE_TOKEN);
    const clean = reply.replace(MISSION_COMPLETE_TOKEN, "").trim();
    setMessages([...history, { role: "assistant", content: clean }]);
    if (autoSpeak && clean) speak(clean, language);
    if (done) endSession("mission", [...history, { role: "assistant", content: clean }]);
  }

  // 첫 진입 시 AI가 먼저 인사
  useEffect(() => {
    if (!configured || startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    void callApi([]).then((reply) => {
      if (reply) handleReply(reply, []);
      setLoading(false);
    });
  }, [configured]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading || ended) return;

    // /end 커맨드 → 즉시 종료
    if (text.toLowerCase() === "/end") {
      setInput("");
      endSession("manual", messages);
      return;
    }

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const reply = await callApi(next);
    if (reply) handleReply(reply, next);
    setLoading(false);
  }

  function endSession(reason: EndReason, history: Msg[]) {
    stopListening();
    setEnded(reason);
    void requestFeedback(history);
  }

  async function requestFeedback(history: Msg[]) {
    if (history.filter((m) => m.role === "user").length === 0) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/roleplay/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, custom, language, messages: history }),
      });
      if (res.ok) setFeedback((await res.json()) as RoleplayCoachFeedback);
    } finally {
      setFeedbackLoading(false);
    }
  }

  // --- 음성 입력 ---
  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }
    const ctrl = startRecognition(language, {
      onInterim: (t) => setInput(t),
      onFinal: (t) => {
        setListening(false);
        recRef.current = null;
        if (t) void send(t);
      },
      onEnd: () => setListening(false),
    });
    if (ctrl) {
      recRef.current = ctrl;
      setListening(true);
    }
  }

  function stopListening() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  useEffect(() => () => stopListening(), []);

  if (!configured) {
    return (
      <div className="rounded-xl border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        OpenAI 키가 설정되면 이 화면에서 AI와 대화할 수 있어요.
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border">
      {/* 상단 바: 음성 출력 토글 + 종료 */}
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {ended ? "대화 종료됨" : "대화 중 · /end 로 종료"}
        </span>
        <div className="flex items-center gap-2">
          {voiceOutSupported && (
            <button
              type="button"
              onClick={() => setAutoSpeak((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary"
              title={autoSpeak ? "음성 응답 끄기" : "음성 응답 켜기"}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          {!ended && messages.some((m) => m.role === "user") && (
            <button
              type="button"
              onClick={() => endSession("manual", messages)}
              className="rounded-md border px-2 py-1 text-muted-foreground hover:bg-secondary"
            >
              종료 & 피드백
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              {m.content}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speak(m.content, language)}
                  className="ml-2 align-middle opacity-70 hover:opacity-100"
                  aria-label="발음 듣기"
                >
                  🔊
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary px-4 py-2 text-sm text-muted-foreground">
              …
            </div>
          </div>
        )}

        {ended && (
          <div className="rounded-xl border bg-muted/40 p-4 text-center text-sm">
            {ended === "mission" ? (
              <p className="font-semibold text-success">🎉 목표를 달성했습니다!</p>
            ) : (
              <p className="font-medium text-muted-foreground">대화를 종료했습니다.</p>
            )}
          </div>
        )}

        {feedbackLoading && (
          <p className="text-center text-sm text-muted-foreground">피드백을 작성하는 중…</p>
        )}
        {feedback && <FeedbackPanel feedback={feedback} />}

        <div ref={endRef} />
      </div>

      {!ended && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2 border-t p-3"
        >
          {voiceInSupported && (
            <Button
              type="button"
              variant={listening ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleListening}
              disabled={loading}
              aria-label={listening ? "음성 입력 중지" : "음성으로 말하기"}
              title={listening ? "음성 입력 중지" : "음성으로 말하기"}
            >
              {listening ? <Square size={18} /> : <Mic size={18} />}
            </Button>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "듣고 있어요…" : "대화를 입력하세요… (/end 로 종료)"}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            보내기
          </Button>
        </form>
      )}
    </div>
  );
}

/** 종료 후 피드백 카드: 분야별 점수 + 표현별 평가 (모국어). */
function FeedbackPanel({ feedback }: { feedback: RoleplayCoachFeedback }) {
  const { scores, summary, expressions, next_recommendation } = feedback;
  const ratingStyle: Record<string, string> = {
    좋음: "bg-success/15 text-success",
    어색: "bg-amber-100 text-amber-800",
    개선: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4 text-left">
      <div>
        <p className="text-sm font-semibold">총평</p>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["총점", scores?.total],
          ["유창성", scores?.fluency],
          ["정확성", scores?.accuracy],
          ["어휘", scores?.vocab],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg bg-secondary p-2">
            <p className="text-lg font-bold">{val ?? "–"}</p>
            <p className="text-xs text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      {expressions?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">표현별 평가</p>
          {expressions.map((e, i) => (
            <div key={i} className="rounded-lg border p-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium",
                    ratingStyle[e.rating] ?? "bg-secondary",
                  )}
                >
                  {e.rating}
                </span>
                <span className="min-w-0 break-words">{e.original}</span>
              </div>
              {e.comment && <p className="mt-1 text-muted-foreground">{e.comment}</p>}
              {e.suggestion && (
                <p className="mt-1">
                  <span className="text-muted-foreground">→ </span>
                  {e.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {next_recommendation && (
        <div>
          <p className="text-sm font-semibold">다음 연습 추천</p>
          <p className="mt-1 text-sm text-muted-foreground">{next_recommendation}</p>
        </div>
      )}
    </div>
  );
}
