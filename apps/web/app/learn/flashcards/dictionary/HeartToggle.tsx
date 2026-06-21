"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

export type ToggleResult = { ok: boolean; error?: string };

/**
 * '내 단어/내 청크' 찜 하트 토글 (범용 — add/remove 동작을 주입).
 * - active(보유): 꽉찬 ♥, 호버 시 빈 ♡, 클릭 시 제거
 * - 비활성: 빈 ♡, 호버 시 꽉찬 ♥, 클릭 시 추가
 * 표시는 `hover ? !active : active` (호버하면 클릭 결과를 미리 보여줌).
 */
export function HeartToggle({
  initialActive,
  onAdd,
  onRemove,
  onToggled,
}: {
  initialActive: boolean;
  onAdd: () => Promise<ToggleResult>;
  onRemove: () => Promise<ToggleResult>;
  /** 토글 성공 후 부모에 알림(예: 내 목록 탭에서 제거되면 행 삭제). */
  onToggled?: (active: boolean) => void;
}) {
  const [active, setActive] = useState(initialActive);
  const [hover, setHover] = useState(false);
  const [pending, setPending] = useState(false);

  const filled = hover ? !active : active;

  async function toggle() {
    if (pending) return;
    setPending(true);
    const res = active ? await onRemove() : await onAdd();
    setPending(false);
    if (!res.ok) {
      // 비차단: 하트는 그대로 두어(상태 유지) 사용자가 실패를 인지하게 한다.
      console.error("하트 토글 실패:", res.error ?? "처리 실패");
      return;
    }
    const next = !active;
    setActive(next);
    onToggled?.(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={active ? "내 목록에서 제거" : "내 목록에 추가"}
      aria-pressed={active}
      title={active ? "내 목록에서 제거" : "내 목록에 추가"}
      className="flex h-7 w-8 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:scale-110 disabled:opacity-50"
    >
      <Heart size={20} fill={filled ? "currentColor" : "none"} />
    </button>
  );
}
