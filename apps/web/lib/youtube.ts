/**
 * YouTube URL 처리 (설계서 7.4: 도메인 화이트리스트 후 video id만 추출).
 * 임의 URL을 그대로 iframe src에 넣지 않는다.
 */

import type { Language } from "@nativo/core";

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** 허용 도메인 검증 후 11자 video id 추출. 실패 시 null. */
export function extractVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;

  let id: string | null = null;
  if (url.hostname.endsWith("youtu.be")) {
    id = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else if (url.pathname.startsWith("/embed/")) {
    id = url.pathname.split("/")[2] ?? null;
  } else if (url.pathname.startsWith("/shorts/")) {
    id = url.pathname.split("/")[2] ?? null;
  }

  return id && VIDEO_ID_RE.test(id) ? id : null;
}

export interface YouTubeMeta {
  title: string | null;
  thumbnailUrl: string;
}

/** oEmbed 로 제목/썸네일 조회 (키 불필요). 서버에서 호출. */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return { title: null, thumbnailUrl };
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return {
      title: data.title ?? null,
      thumbnailUrl: data.thumbnail_url ?? thumbnailUrl,
    };
  } catch {
    return { title: null, thumbnailUrl };
  }
}

/** 자막 한 줄 (시간별). */
export interface TranscriptCue {
  start: number; // 초
  dur: number; // 초
  text: string;
}

const LANG_CODE: Record<Language, string> = {
  english: "en",
  spanish: "es",
  japanese: "ja",
};

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string; // "asr" = 자동생성
}

/**
 * 영상 자막을 다운로드해 시간별 큐 배열로 반환 (키 불필요, 서버 전용).
 *
 * 1) watch 페이지 HTML 에서 captionTracks(자막 트랙 목록) 추출
 * 2) 사용자 언어 우선으로 트랙 선택 → baseUrl(timedtext XML) 다운로드
 * 3) XML 파싱 → 엔티티 디코드
 * 자막이 없거나 차단되면 빈 배열.
 */
export async function fetchTranscript(
  videoId: string,
  language: Language,
): Promise<TranscriptCue[]> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1", // EU 동의 페이지 우회
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const m = html.match(/"captionTracks":(\[.*?\])/s);
    if (!m?.[1]) return [];
    const tracks = JSON.parse(m[1]) as CaptionTrack[];
    if (tracks.length === 0) return [];

    const want = LANG_CODE[language];
    const track =
      tracks.find((t) => t.languageCode === want && t.kind !== "asr") ??
      tracks.find((t) => t.languageCode === want) ??
      tracks.find((t) => t.kind !== "asr") ??
      tracks[0];
    if (!track?.baseUrl) return [];

    // timedtext 는 포맷에 따라 빈 응답을 주기도 해서 여러 포맷을 차례로 시도.
    const base = track.baseUrl;
    const candidates = [
      `${base}&fmt=json3`,
      `${base}&fmt=srv3`,
      base,
    ];
    for (const url of candidates) {
      const res = await fetch(url, {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text) continue;
      const cues = url.includes("fmt=json3")
        ? parseJson3(text)
        : parseTimedText(text);
      if (cues.length > 0) return cues;
    }
    return [];
  } catch {
    return [];
  }
}

/** json3 포맷({events:[{tStartMs,dDurationMs,segs:[{utf8}]}]}) → 큐 배열. */
function parseJson3(raw: string): TranscriptCue[] {
  try {
    const data = JSON.parse(raw) as {
      events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
    };
    const cues: TranscriptCue[] = [];
    for (const ev of data.events ?? []) {
      const text = (ev.segs ?? [])
        .map((s) => s.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      cues.push({
        start: (ev.tStartMs ?? 0) / 1000,
        dur: (ev.dDurationMs ?? 0) / 1000,
        text,
      });
    }
    return cues;
  } catch {
    return [];
  }
}

/** timedtext XML(<text start=".." dur="..">…</text> 또는 srv3 <p t=".." d="..">) → 큐 배열. */
function parseTimedText(xml: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];

  // 구형: <text start="초" dur="초">…</text>
  const reText = /<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = reText.exec(xml)) !== null) {
    const text = cleanCaption(m[3] ?? "");
    if (text) cues.push({ start: Number(m[1]) || 0, dur: Number(m[2]) || 0, text });
  }
  if (cues.length > 0) return cues;

  // srv3: <p t="밀리초" d="밀리초">…</p>
  const reP = /<p t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = reP.exec(xml)) !== null) {
    const text = cleanCaption((m[3] ?? "").replace(/<s[^>]*>/g, "").replace(/<\/s>/g, ""));
    if (text) cues.push({ start: (Number(m[1]) || 0) / 1000, dur: (Number(m[2]) || 0) / 1000, text });
  }
  return cues;
}

/** 자막 텍스트 정리(태그 제거 + 엔티티 디코드 + 공백 정규화). */
function cleanCaption(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** XML/HTML 엔티티 디코드 (자막에 흔한 것만). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
