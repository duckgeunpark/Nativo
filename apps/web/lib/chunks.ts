/**
 * 청크 공용 타입/라벨. (실제 청크 데이터는 chunk-db: data/chunk-db/{lang}.json)
 */

import type { CefrLevel, ChunkCategory } from "@nativo/core";

export interface SeedChunk {
  expression: string;
  translation_ko: string;
  situation?: string;
  nuance?: string;
  example_1?: string;
  example_2?: string;
  category: ChunkCategory;
  level?: CefrLevel;
}

export const CATEGORY_LABEL: Record<string, string> = {
  daily: "일상",
  business: "비즈니스",
  travel: "여행",
  social: "소셜",
  custom: "직접",
};
