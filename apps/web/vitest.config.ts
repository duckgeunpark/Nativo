import { defineConfig } from "vitest/config";

// lib 의 순수/통합 단위테스트만 노드 환경에서 돌린다.
// (RSC/tsx 컴포넌트는 제외 — 빌드 파이프라인이 별도로 검증)
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
