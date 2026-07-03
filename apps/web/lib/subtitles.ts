/**
 * 자막 텍스트 파서 — SRT / WebVTT / 유튜브 "스크립트 표시" 복사본을
 * 시간별 큐 배열(TranscriptCue)로 변환한다. (순수 함수, 서버/클라이언트 공용)
 *
 * 유튜브가 서버측 자막 자동 수집(timedtext)을 막아서, 사용자가 자막을 직접
 * 붙여넣거나 .srt/.vtt 파일을 올리면 이 파서로 동기화해 보여준다.
 */

import type { TranscriptCue } from "./youtube";

/** "HH:MM:SS,mmm" / "MM:SS.mmm" / "M:SS" 등 다양한 타임스탬프 → 초. */
function parseTimestamp(raw: string): number {
  const s = raw.trim().replace(",", ".");
  const parts = s.split(":");
  if (parts.length === 0) return 0;
  let h = 0,
    m = 0,
    sec = 0;
  if (parts.length === 3) {
    h = Number(parts[0]) || 0;
    m = Number(parts[1]) || 0;
    sec = Number(parts[2]) || 0;
  } else if (parts.length === 2) {
    m = Number(parts[0]) || 0;
    sec = Number(parts[1]) || 0;
  } else {
    sec = Number(parts[0]) || 0;
  }
  return h * 3600 + m * 60 + sec;
}

/** VTT/HTML 태그 제거 + 엔티티 디코드 + 공백 정규화. */
function cleanLine(s: string): string {
  return s
    .replace(/<[^>]+>/g, "") // <c>, <00:00:01.000> 등 인라인 태그
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;
const CUE_LINE = new RegExp(`(${TS})\\s*-->\\s*(${TS})`);

/** SRT / WebVTT (… --> … 형식) 파싱. */
function parseCueBased(text: string): TranscriptCue[] {
  const lines = text.split("\n");
  const cues: TranscriptCue[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const m = line.match(CUE_LINE);
    if (!m) {
      i++;
      continue;
    }
    const start = parseTimestamp(m[1]!);
    const end = parseTimestamp(m[2]!);
    i++;
    const buf: string[] = [];
    let cur = lines[i];
    while (cur !== undefined && cur.trim() !== "" && !CUE_LINE.test(cur)) {
      buf.push(cur);
      i++;
      cur = lines[i];
    }
    const t = cleanLine(buf.join(" "));
    if (t) cues.push({ start, dur: Math.max(0, end - start), text: t });
  }
  return cues;
}

const ONLY_TS = new RegExp(`^(${TS})$`);
const INLINE_TS = new RegExp(`^(${TS})\\s+(.+)$`);

/** 유튜브 "스크립트 표시" 복사본(타임스탬프 + 다음 줄 텍스트) 파싱. */
function parseYouTubeTranscript(text: string): TranscriptCue[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const cues: TranscriptCue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = lines[i + 1];
    const only = line.match(ONLY_TS);
    if (only && next && !ONLY_TS.test(next) && !INLINE_TS.test(next)) {
      const t = cleanLine(next);
      if (t) {
        cues.push({ start: parseTimestamp(only[1]!), dur: 0, text: t });
        i++;
      }
      continue;
    }
    const inline = line.match(INLINE_TS);
    if (inline) {
      const t = cleanLine(inline[2]!);
      if (t) cues.push({ start: parseTimestamp(inline[1]!), dur: 0, text: t });
    }
  }
  // dur 없음 → 다음 큐 시작까지로 채움 (마지막은 4초)
  for (let i = 0; i < cues.length; i++) {
    const cur = cues[i]!;
    const nextCue = cues[i + 1];
    cur.dur = nextCue ? Math.max(0.5, nextCue.start - cur.start) : 4;
  }
  return cues;
}

/** 자막 원문(SRT/VTT/YT) → 시간순 정렬된 TranscriptCue[]. 인식 실패 시 빈 배열. */
export function parseSubtitles(raw: string): TranscriptCue[] {
  if (!raw || !raw.trim()) return [];
  const text = raw.replace(/\r\n?/g, "\n");
  const cues = text.includes("-->")
    ? parseCueBased(text)
    : parseYouTubeTranscript(text);
  return cues.sort((a, b) => a.start - b.start);
}
