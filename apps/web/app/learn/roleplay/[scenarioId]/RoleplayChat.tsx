"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  scenarioId: string;
  language: Language;
  configured: boolean;
}

export function RoleplayChat({ scenarioId, language, configured }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function callApi(history: Msg[]): Promise<string | null> {
    const res = await fetch("/api/roleplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, language, messages: history }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    return data.reply ?? null;
  }

  // 첫 진입 시 AI가 먼저 인사
  useEffect(() => {
    if (!configured || startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    void callApi([]).then((reply) => {
      if (reply) setMessages([{ role: "assistant", content: reply }]);
      setLoading(false);
    });
  }, [configured]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const reply = await callApi(next);
    if (reply) setMessages([...next, { role: "assistant", content: reply }]);
    setLoading(false);
  }

  if (!configured) {
    return (
      <div className="rounded-xl border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        OpenAI 키가 설정되면 이 화면에서 AI와 대화할 수 있어요.
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary",
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
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="대화를 입력하세요…"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          보내기
        </Button>
      </form>
    </div>
  );
}
