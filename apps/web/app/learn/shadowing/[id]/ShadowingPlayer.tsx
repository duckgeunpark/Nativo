"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTube, { type YouTubePlayer } from "react-youtube";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  videoId: string;
  startSec: number;
  initialWatchSec: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ShadowingPlayer({ id, videoId, startSec, initialWatchSec }: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [current, setCurrent] = useState(0);
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);

  // 누적 시청 시간(초) — 재생 중일 때만 증가
  const watchedRef = useRef(initialWatchSec);

  // --- 진행/누적 저장 ---
  const save = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    const pos = Math.floor(await player.getCurrentTime());
    const supabase = createClient();
    await supabase
      .from("shadowing_videos")
      .update({
        last_position_sec: pos,
        total_watch_sec: Math.floor(watchedRef.current),
      })
      .eq("id", id);
  }, [id]);

  // 매초 폴링: 현재 시간 표시 + A-B 루프 + 시청시간 누적 + 주기 저장
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
    }, 1000);
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

  return (
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
              speed === r
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary",
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPointA(null);
                setPointB(null);
                setLooping(false);
              }}
            >
              초기화
            </Button>
          )}
        </div>
      </div>

      <Recorder />
    </div>
  );
}

/** 따라 말하기 녹음 (Web Audio / MediaRecorder) — 내 발음 녹음 후 재생 비교. */
function Recorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("마이크 권한이 필요합니다.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-sm font-medium">따라 말하기 🎤</p>
      <div className="flex items-center gap-3">
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            ⏹ 녹음 정지
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={start}>
            🎤 녹음
          </Button>
        )}
        {audioUrl && (
          <audio controls src={audioUrl} className="h-9">
            <track kind="captions" />
          </audio>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
