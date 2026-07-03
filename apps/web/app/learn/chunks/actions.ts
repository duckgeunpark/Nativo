"use server";

import { createClient } from "@/lib/supabase/server";
import { chunkReviewUpdate, chunkReviewUpdateGraded } from "@/lib/chunk-review";

/**
 * 청크 복습 결과를 저장한다. (단일 사용자 로컬 모드)
 * correct === null 이면 무채점(뒤집기), 아니면 정/오답 채점.
 */
export async function gradeChunk(
  chunkId: string,
  reviewCount: number,
  correct: boolean | null,
): Promise<{ ok: boolean; error?: string }> {
  const update =
    correct === null
      ? chunkReviewUpdate(reviewCount)
      : chunkReviewUpdateGraded(reviewCount, correct);
  const supabase = createClient();
  const { error } = await supabase.from("chunks").update(update).eq("id", chunkId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
