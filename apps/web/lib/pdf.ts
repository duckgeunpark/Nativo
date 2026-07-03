/**
 * PDF 텍스트 추출 (서버 전용).
 *
 * pdf-parse v1 의 디버그 모드(번들러에서 테스트 PDF 를 읽으려다 실패)를 피하려고
 * 내부 구현(lib/pdf-parse.js)을 직접 import 한다.
 */

import pdfParse from "pdf-parse/lib/pdf-parse.js";

/** PDF 버퍼 → 전체 텍스트. 추출 실패 시 throw. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return typeof data?.text === "string" ? data.text : "";
}
