"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { Button } from "@/components/ui/button";

/** 내 PDF 업로드 → 서버에서 텍스트 추출 → 읽기 문서로 추가. */
export function UploadDocForm({ language }: { language: Language }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("language", language);
      const res = await fetch("/api/reading/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "업로드에 실패했어요.");
        return;
      }
      router.push(`/learn/reading/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "변환 중…" : "📄 내 PDF 올리기"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
