"use server";

import type { TranscriptCue } from "@/lib/youtube";
import { createClient } from "@/lib/supabase/server";

/** 사용자가 직접 넣은 자막을 영상에 저장한다(다음 방문 시 재사용). */
export async function saveTranscript(
  id: string,
  cues: TranscriptCue[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shadowing_videos")
    .update({ transcript: cues.slice(0, 5000) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 쉐도잉 영상 진행도(마지막 위치·누적 시청)를 저장한다. */
export async function saveShadowingProgress(
  id: string,
  lastPositionSec: number,
  totalWatchSec: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shadowing_videos")
    .update({
      last_position_sec: Math.floor(lastPositionSec),
      total_watch_sec: Math.floor(totalWatchSec),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
