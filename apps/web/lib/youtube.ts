/**
 * YouTube URL 처리 (설계서 7.4: 도메인 화이트리스트 후 video id만 추출).
 * 임의 URL을 그대로 iframe src에 넣지 않는다.
 */

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
