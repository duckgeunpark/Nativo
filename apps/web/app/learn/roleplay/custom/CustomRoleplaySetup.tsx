"use client";

import { useState } from "react";
import type { Language } from "@nativo/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleplayChat } from "../[scenarioId]/RoleplayChat";

interface Props {
  language: Language;
  configured: boolean;
}

/** 사용자가 상황(상대 역할)·목표(미션)를 입력해 직접 역할극을 만든다. */
export function CustomRoleplaySetup({ language, configured }: Props) {
  const [aiRole, setAiRole] = useState("");
  const [userMission, setUserMission] = useState("");
  const [started, setStarted] = useState<{ aiRole: string; userMission: string } | null>(
    null,
  );

  if (started) {
    return (
      <>
        <div className="mb-4 rounded-lg border bg-secondary/40 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">상대: </span>
            {started.aiRole}
          </p>
          <p>
            <span className="text-muted-foreground">미션: </span>
            {started.userMission}
          </p>
        </div>
        <RoleplayChat custom={started} language={language} configured={configured} />
      </>
    );
  }

  const ready = aiRole.trim().length > 0 && userMission.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) setStarted({ aiRole: aiRole.trim(), userMission: userMission.trim() });
      }}
      className="space-y-4 rounded-xl border p-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="aiRole">AI가 맡을 역할 (상황)</Label>
        <Input
          id="aiRole"
          value={aiRole}
          onChange={(e) => setAiRole(e.target.value)}
          placeholder="예: 까다로운 부동산 중개인"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="userMission">나의 목표 (미션)</Label>
        <Input
          id="userMission"
          value={userMission}
          onChange={(e) => setUserMission(e.target.value)}
          placeholder="예: 월세를 5만원 깎아서 계약하기"
        />
      </div>
      <Button type="submit" disabled={!ready || !configured}>
        대화 시작
      </Button>
      {!configured && (
        <p className="text-sm text-muted-foreground">
          OpenAI 키가 설정되면 커스텀 상황으로 대화할 수 있어요.
        </p>
      )}
    </form>
  );
}
