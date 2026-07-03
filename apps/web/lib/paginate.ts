/**
 * 긴 본문을 읽기 좋은 페이지 단위(~글자수)로 분할. (Gutenberg/PDF 공용)
 */

/** 본문을 단락 기준 ~pageSize 글자 페이지 배열로 분할. 초과 단락은 잘라 채운다. */
export function paginateText(body: string, pageSize = 1800): string[] {
  const parts = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const pages: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) pages.push(buf.trim());
    buf = "";
  };

  for (let p of parts) {
    // 한 단락이 페이지보다 길면 잘라서 채운다
    while (p.length > pageSize) {
      flush();
      pages.push(p.slice(0, pageSize).trim());
      p = p.slice(pageSize);
    }
    if (buf.length + p.length > pageSize) flush();
    buf += p + "\n\n";
  }
  flush();
  return pages;
}
