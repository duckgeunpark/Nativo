import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_USER_ID } from "@/lib/db";
import { extractPdfText } from "@/lib/pdf";
import { paginateText } from "@/lib/paginate";

export const runtime = "nodejs";
export const maxDuration = 60;

const LANGS = ["english", "spanish", "japanese"];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

/** PDF 업로드 → 텍스트 추출 → 페이지 분할 → documents 저장. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const langRaw = form?.get("language");
  const language: Language =
    typeof langRaw === "string" && LANGS.includes(langRaw)
      ? (langRaw as Language)
      : "english";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    return NextResponse.json({ error: "PDF 파일만 올릴 수 있어요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일이 너무 큽니다(최대 25MB)." }, { status: 400 });
  }

  let text = "";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    text = await extractPdfText(buf);
  } catch {
    return NextResponse.json(
      { error: "PDF 텍스트를 읽지 못했어요. 다른 파일을 시도해 주세요." },
      { status: 422 },
    );
  }

  const pages = paginateText(text);
  if (pages.length === 0) {
    return NextResponse.json(
      { error: "텍스트가 없어요. 스캔 이미지 PDF는 지원하지 않습니다." },
      { status: 422 },
    );
  }

  const title = file.name.replace(/\.pdf$/i, "").slice(0, 200) || "내 문서";
  const supabase = createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({ user_id: LOCAL_USER_ID, title, language, pages, total_pages: pages.length })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "저장 실패" },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: data.id });
}
