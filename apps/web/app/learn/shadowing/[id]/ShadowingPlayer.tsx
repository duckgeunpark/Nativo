"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubePlayer } from "react-youtube";
import { Repeat } from "lucide-react";
import type { Language } from "@nativo/core";
import type { TranscriptCue } from "@/lib/youtube";
import { parseSubtitles } from "@/lib/subtitles";
import { saveShadowingProgress, saveTranscript } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  videoId: string;
  language: Language;
  startSec: number;
  initialWatchSec: number;
  transcript: TranscriptCue[];
}

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ShadowingPlayer({
  id,
  videoId,
  language,
  startSec,
  initialWatchSec,
  transcript,
}: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [current, setCurrent] = useState(0);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);

  // 자막: 저장본(props)으로 시작, 사용자가 직접 붙여넣으면 갱신
  const [cues, setCues] = useState<TranscriptCue[]>(transcript);
  const [editingSub, setEditingSub] = useState(transcript.length === 0);
  const [rawSub, setRawSub] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  /** yt-dlp 로 자막 자동 가져오기 (서버). 미설치면 설치 안내. */
  async function autoFetch() {
    setAutoLoading(true);
    setSubError(null);
    try {
      const res = await fetch("/api/shadowing/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, language }),
      });
      if (res.status === 503) {
        setSubError(
          "자동 가져오기는 yt-dlp 설치가 필요해요. yt-dlp 를 PATH 에 두면 됩니다. 우선 아래에 직접 붙여넣어도 돼요.",
        );
        return;
      }
      if (res.status === 404) {
        setSubError("이 영상의 자막을 찾지 못했어요(자동생성 자막도 없음). 직접 붙여넣어 주세요.");
        return;
      }
      if (!res.ok) {
        setSubError("자동 가져오기에 실패했어요. 직접 붙여넣어 주세요.");
        return;
      }
      const data = (await res.json()) as { cues?: TranscriptCue[] };
      const fetched = data.cues ?? [];
      if (fetched.length === 0) {
        setSubError("자막이 비어 있어요. 직접 붙여넣어 주세요.");
        return;
      }
      setCues(fetched);
      await saveTranscript(id, fetched);
      setEditingSub(false);
    } catch {
      setSubError("네트워크 오류가 발생했어요.");
    } finally {
      setAutoLoading(false);
    }
  }

  async function onSubFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawSub(await file.text());
    e.target.value = ""; // 같은 파일 다시 선택 가능하도록 초기화
  }

  async function applyTranscript() {
    const parsed = parseSubtitles(rawSub);
    if (parsed.length === 0) {
      setSubError("자막을 인식하지 못했어요. SRT / VTT 형식인지 확인해 주세요.");
      return;
    }
    setSavingSub(true);
    setSubError(null);
    setCues(parsed);
    const res = await saveTranscript(id, parsed);
    setSavingSub(false);
    if (!res.ok) {
      setSubError(res.error ?? "저장 실패");
      return;
    }
    setEditingSub(false);
    setRawSub("");
  }

  // 누적 시청 시간(초) — 재생 중일 때만 증가
  const watchedRef = useRef(initialWatchSec);

  // 현재 시간에 해당하는 자막 인덱스 (start <= t < 다음 start)
  const activeIdx = useMemo(() => {
    if (cues.length === 0) return -1;
    let lo = 0;
    let hi = cues.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((cues[mid]?.start ?? 0) <= current) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }, [current, cues]);

  // 활성 자막을 리스트 중앙으로 자동 스크롤
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx]);

  // --- 진행/누적 저장 ---
  const save = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    const pos = Math.floor(await player.getCurrentTime());
    await saveShadowingProgress(id, pos, watchedRef.current);
  }, [id]);

  // 매초 폴링: 현재 시간 표시 + A-B 루프 + 시청시간 누적
  useEffect(() => {
    const timer = setInterval(async () => {
      const player = playerRef.current;
      if (!player) return;
      const t = await player.getCurrentTime();
      setCurrent(t);
      if (playing) watchedRef.current += 1;

      if (looping && pointA !== null && pointB !== null && t >= pointB) {
        player.seekTo(pointA, true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [playing, looping, pointA, pointB]);

  // 주기적 저장 + 이탈 시 저장
  useEffect(() => {
    const timer = setInterval(() => void save(), 20000);
    return () => {
      clearInterval(timer);
      void save();
    };
  }, [save]);

  function onReady(e: { target: YouTubePlayer }) {
    playerRef.current = e.target;
  }

  function onStateChange(e: { data: number }) {
    setPlaying(e.data === 1); // 1 = playing
  }

  async function seekBy(delta: number) {
    const player = playerRef.current;
    if (!player) return;
    const t = await player.getCurrentTime();
    player.seekTo(Math.max(0, t + delta), true);
  }

  function seekTo(sec: number) {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(Math.max(0, sec), true);
    player.playVideo();
  }

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  function changeSpeed(rate: number) {
    setSpeed(rate);
    playerRef.current?.setPlaybackRate(rate);
  }

  async function markPoint(which: "a" | "b") {
    const player = playerRef.current;
    if (!player) return;
    const t = await player.getCurrentTime();
    if (which === "a") setPointA(t);
    else setPointB(t);
  }

  function clearLoop() {
    setPointA(null);
    setPointB(null);
    setLooping(false);
  }

  /** 자막 한 줄을 구간 반복으로 지정하고 재생. */
  function loopCue(idx: number) {
    const cue = cues[idx];
    if (!cue) return;
    const end =
      cue.dur > 0 ? cue.start + cue.dur : (cues[idx + 1]?.start ?? cue.start + 4);
    setPointA(cue.start);
    setPointB(end);
    setLooping(true);
    seekTo(cue.start);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      {/* 왼쪽: 영상 + 컨트롤 */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border bg-black">
          <YouTube
            videoId={videoId}
            onReady={onReady}
            onStateChange={onStateChange}
            className="aspect-video w-full"
            iframeClassName="h-full w-full"
            opts={{
              playerVars: {
                start: startSec,
                cc_load_policy: 1, // 자막 있으면 표시
                rel: 0,
                modestbranding: 1,
              },
            }}
          />
        </div>

        {/* 재생 컨트롤 */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => seekBy(-3)}>
            ◀ 3초
          </Button>
          <Button size="sm" onClick={togglePlay} className="min-w-20">
            {playing ? "❚❚ 정지" : "▶ 재생"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => seekBy(3)}>
            3초 ▶
          </Button>
        </div>

        {/* 속도 */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">속도</span>
          {SPEEDS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeSpeed(r)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                speed === r ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              {r}x
            </button>
          ))}
        </div>

        {/* A-B 구간 반복 */}
        <div className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">구간 반복 (A-B)</span>
            <span className="text-muted-foreground">현재 {fmt(current)}</span>
          </div>
          {pointA !== null && pointB !== null && (
            <p className="mb-2 text-xs text-muted-foreground">
              {fmt(pointA)} → {fmt(pointB)} 구간을 {looping ? "반복 중" : "반복 대기"}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => markPoint("a")}>
              A 지정 {pointA !== null && `(${fmt(pointA)})`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => markPoint("b")}>
              B 지정 {pointB !== null && `(${fmt(pointB)})`}
            </Button>
            <Button
              size="sm"
              variant={looping ? "default" : "secondary"}
              disabled={pointA === null || pointB === null}
              onClick={() => setLooping((v) => !v)}
            >
              {looping ? "반복 중" : "반복 시작"}
            </Button>
            {(pointA !== null || pointB !== null) && (
              <Button size="sm" variant="ghost" onClick={clearLoop}>
                초기화
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽: 시간별 자막 리스트 + 직접 입력 */}
      <aside className="flex max-h-[70vh] flex-col rounded-xl border">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
          <span className="font-medium">자막</span>
          <div className="flex items-center gap-2">
            {cues.length > 0 && (
              <span className="text-muted-foreground">{cues.length}줄</span>
            )}
            <button
              type="button"
              onClick={() => setEditingSub((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {editingSub ? "닫기" : cues.length > 0 ? "교체" : "자막 넣기"}
            </button>
          </div>
        </div>

        {editingSub ? (
          <div className="space-y-2 p-3">
            <Button
              size="sm"
              className="w-full"
              onClick={autoFetch}
              disabled={autoLoading}
            >
              {autoLoading ? "자동 가져오는 중…" : "⚡ 자막 자동 가져오기 (yt-dlp)"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">또는 직접 입력</p>
            <p className="text-xs text-muted-foreground">
              유튜브에서 <b>⋯ → 스크립트 표시</b>로 복사하거나 <b>.srt/.vtt</b> 파일을
              올려 붙여넣으세요.
            </p>
            <textarea
              value={rawSub}
              onChange={(e) => setRawSub(e.target.value)}
              rows={8}
              placeholder={
                "SRT / VTT / 유튜브 스크립트 붙여넣기\n\n예)\n00:00:01,000 --> 00:00:04,000\nHello world"
              }
              className="w-full resize-y rounded-lg border bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                📎 파일 선택(.srt/.vtt)
                <input
                  type="file"
                  accept=".srt,.vtt,.txt,text/plain"
                  className="hidden"
                  onChange={onSubFile}
                />
              </label>
              <Button size="sm" onClick={applyTranscript} disabled={savingSub || !rawSub.trim()}>
                {savingSub ? "적용 중…" : "자막 적용"}
              </Button>
            </div>
            {subError && <p className="text-xs text-destructive">{subError}</p>}
          </div>
        ) : cues.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            자막이 없습니다. 위 <b>자막 넣기</b>로 직접 추가할 수 있어요.
          </p>
        ) : (
          <ol className="flex-1 overflow-y-auto p-2">
            {cues.map((cue, i) => {
              const active = i === activeIdx;
              return (
                <li key={i} className="group flex items-stretch gap-1">
                  <button
                    type="button"
                    ref={active ? activeRef : null}
                    onClick={() => seekTo(cue.start)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      active ? "bg-primary/10 text-foreground" : "hover:bg-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "mr-2 align-top text-xs tabular-nums",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {fmt(cue.start)}
                    </span>
                    <span>{cue.text}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loopCue(i)}
                    aria-label="이 문장 반복"
                    title="이 문장 반복"
                    className="flex w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                  >
                    <Repeat size={14} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>
  );
}
