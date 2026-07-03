"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";

/** 업로드한 읽기 문서 삭제. */
export async function deleteDocument(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", LOCAL_USER_ID);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/learn/reading");
  return { ok: true };
}
