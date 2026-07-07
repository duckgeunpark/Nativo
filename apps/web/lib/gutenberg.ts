/**
 * Project Gutenberg (gutendex.com) — 저작권 만료 원서. 무료, 키 불필요.
 * 책 검색 + 본문 텍스트 페이지네이션.
 */

import type { Language } from "@nativo/core";

const LANG_ISO: Record<Language, string> = {
  english: "en",
  spanish: "es",
  japanese: "ja",
};

export interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

interface GutendexList {
  results?: GutenbergBook[];
}

export interface BookSearchResult {
  books: GutenbergBook[];
  /** true면 네트워크/API 오류로 실패 — "결과 없음"과 구분해서 보여준다. */
  failed: boolean;
}

/** 언어/검색어로 책 목록 조회 (인기순). */
export async function searchBooks(
  language: Language,
  query: string,
): Promise<BookSearchResult> {
  const params = new URLSearchParams({ languages: LANG_ISO[language] });
  if (query.trim()) params.set("search", query.trim());
  try {
    const res = await fetch(`https://gutendex.com/books?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { books: [], failed: true };
    const data = (await res.json()) as GutendexList;
    return { books: (data.results ?? []).slice(0, 24), failed: false };
  } catch {
    return { books: [], failed: true };
  }
}

/** 단일 책 메타. */
export async function getBook(id: string): Promise<GutenbergBook | null> {
  try {
    const res = await fetch(`https://gutendex.com/books/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GutenbergBook;
  } catch {
    return null;
  }
}

/** 책에서 plain text 포맷 URL 추출. */
export function plainTextUrl(book: GutenbergBook): string | null {
  const formats = book.formats ?? {};
  const key =
    Object.keys(formats).find((k) => k.startsWith("text/plain")) ?? null;
  return key ? formats[key] ?? null : null;
}

/** Gutenberg 라이선스 머리말/꼬리말 제거. */
function stripBoilerplate(text: string): string {
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  let body = text;
  if (start !== -1) {
    const nl = text.indexOf("\n", start);
    body = text.slice(nl === -1 ? start : nl + 1);
  }
  if (end !== -1) {
    const endRel = body.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
    if (endRel !== -1) body = body.slice(0, endRel);
  }
  return body.trim();
}

export interface BookText {
  pages: string[];
  total: number;
}

/** 본문을 단락 기준으로 ~pageSize 글자 페이지로 분할. */
export async function fetchBookPages(
  url: string,
  pageSize = 1800,
): Promise<BookText> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return { pages: [], total: 0 };
    const raw = await res.text();
    const body = stripBoilerplate(raw);

    const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim());
    const pages: string[] = [];
    let buf = "";
    for (const p of paragraphs) {
      if (!p) continue;
      if (buf.length + p.length > pageSize && buf) {
        pages.push(buf.trim());
        buf = "";
      }
      buf += p + "\n\n";
    }
    if (buf.trim()) pages.push(buf.trim());

    return { pages, total: pages.length };
  } catch {
    return { pages: [], total: 0 };
  }
}
