"use server";

import type { ReviewChoice } from "@nativo/utils";
import { createClient } from "@/lib/supabase/server";
import { reviewUpdate, type StudyCard } from "@/lib/flashcards";

/**
 * 카드 복습 결과(SRS)를 저장한다. (단일 사용자 로컬 모드)
 * SRS 계산은 서버에서 reviewUpdate 로 수행해 클라이언트 입력을 신뢰하지 않는다.
 */
export async function gradeFlashcard(
  card: StudyCard,
  choice: ReviewChoice,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("flashcards")
    .update(reviewUpdate(card, choice))
    .eq("id", card.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
