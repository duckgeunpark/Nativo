/** AI 롤플레이 시나리오 정의 + 시스템 프롬프트 빌더. */

import type { Language } from "@nativo/core";

export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  category: string;
  aiRole: string; // AI가 맡는 역할 (한국어 안내)
  userMission: string; // 사용자 미션 (한국어 안내)
}

export const SCENARIOS: Scenario[] = [
  {
    id: "cafe",
    emoji: "☕",
    title: "카페에서 주문하기",
    category: "일상",
    aiRole: "카페 점원",
    userMission: "음료를 주문하고 커스텀(샷 추가 등)을 요청하기",
  },
  {
    id: "airport",
    emoji: "✈️",
    title: "공항 수하물 문제",
    category: "여행",
    aiRole: "항공사 카운터 직원",
    userMission: "초과 수하물 요금을 깎아보기",
  },
  {
    id: "refund",
    emoji: "🛍️",
    title: "환불 요청 (까다로운 직원)",
    category: "일상",
    aiRole: "환불을 꺼리는 매장 직원",
    userMission: "3일 된 제품을 환불받기",
  },
  {
    id: "interview",
    emoji: "💼",
    title: "취업 면접",
    category: "비즈니스",
    aiRole: "면접관",
    userMission: "자기소개와 강점을 어필하기",
  },
  {
    id: "smalltalk",
    emoji: "🙂",
    title: "처음 만난 사람과 스몰토크",
    category: "소셜",
    aiRole: "파티에서 처음 만난 사람",
    userMission: "공통 관심사를 찾아 대화를 이어가기",
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

/** GPT 시스템 프롬프트 (서버에서만 사용). */
export function buildSystemPrompt(scenario: Scenario, language: Language): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You are a friendly language-practice partner for a learner of ${lang}.`,
    `Role-play strictly in character as: ${scenario.aiRole}.`,
    `Speak ONLY in ${lang}. Keep replies short and natural (1-3 sentences), in character.`,
    `The learner's mission: ${scenario.userMission}.`,
    `Drive the scene forward and add mild, realistic friction so the conversation keeps going.`,
    `If the learner is stuck, switches to Korean, or makes a big mistake, gently help by offering a simpler ${lang} phrasing — but stay in character.`,
    `Never break character or mention you are an AI.`,
  ].join(" ");
}
