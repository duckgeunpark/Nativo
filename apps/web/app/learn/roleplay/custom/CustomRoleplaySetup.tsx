"use client";

import { useState } from "react";
import type { Language } from "@nativo/core";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
        <div className="mb-4 rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <p>
            <span className="text-muted-foreground">상대: </span>
            {started.aiRole}
          </p>
          <p>
            <span className="text-muted-foreground">미션: </span>
            {started.userMission}
          </p>
        </div>
        <RoleplayChat
          custom={started}
          info={{ aiRole: started.aiRole, userMission: started.userMission }}
          language={language}
          configured={configured}
        />
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
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
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
      <Button
        type="submit"
        disabled={!ready || !configured}
        className="bg-highlight text-highlight-foreground hover:bg-highlight/90"
      >
        대화 시작
      </Button>
      {!configured && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-2 py-3 text-sm text-muted-foreground">
            <Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            OpenAI 키가 설정되면 커스텀 상황으로 대화할 수 있어요.
          </CardContent>
        </Card>
      )}
    </form>
  );
}
