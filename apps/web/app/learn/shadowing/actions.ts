"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/** 쉐도잉 영상을 목록에서 삭제(학습 기록 포함). */
export async function deleteShadowingVideo(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shadowing_videos")
    .delete()
    .eq("id", id)
    .eq("user_id", LOCAL_USER_ID);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/learn/shadowing");
  return { ok: true };
}
