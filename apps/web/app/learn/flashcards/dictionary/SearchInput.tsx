"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * 전체 목록 검색창(디바운스 + 클리어 버튼 + IME 조합 중 자동 제출 방지).
 * 감싸는 <form method="get"> 의 서버 검색·페이지네이션 로직은 그대로 두고,
 * 입력 후 잠시 멈추면 폼을 자동 제출한다(폼이 없으면 조용히 무시).
 */
export function SearchInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 뒤로가기 등으로 URL 의 검색어가 바뀌면 입력값도 동기화.
  useEffect(() => setValue(defaultValue), [defaultValue]);

  function scheduleSubmit() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (composingRef.current) return;
      inputRef.current?.form?.requestSubmit();
    }, 450);
  }

  function clear() {
    setValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    inputRef.current?.focus();
    inputRef.current?.form?.requestSubmit();
  }

  return (
    <div className="relative min-w-40 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleSubmit();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          scheduleSubmit();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={value ? "pl-9 pr-9" : "pl-9"}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="검색어 지우기"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
