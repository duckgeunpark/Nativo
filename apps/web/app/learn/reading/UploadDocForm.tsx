"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@nativo/core";
import { Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

/** 내 PDF 업로드 → 서버에서 텍스트 추출 → 읽기 문서로 추가. drag/drop + 파일 선택 모두 지원. */
export function UploadDocForm({ language }: { language: Language }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    async (file: File) => {
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
    },
    [language, router],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (file) void upload(file);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="text-right">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-input bg-background hover:bg-secondary",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <UploadCloud className="h-4 w-4" aria-hidden />
        )}
        {uploading ? "업로드 중…" : dragOver ? "여기에 놓기" : "PDF 올리기"}
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">PDF · 최대 25MB</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
