/**
 * 내장 DB(libSQL/SQLite) 연결 + 1회 초기화.
 *
 * - 기본: 로컬 파일 `apps/web/.data/nativo.db`
 * - 배포 전환 시: TURSO_DATABASE_URL/TURSO_AUTH_TOKEN 만 설정하면 Turso 클라우드로 동작
 *
 * 최초 쿼리 전에 ensureReady() 가 스키마(db/schema.sql)를 적용하고
 * 단일 사용자 1행을 시드한다. (idempotent — 매 부팅 안전)
 */

import { createClient as createLibsql, type Client } from "@libsql/client";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from "./auth";

let client: Client | null = null;
let readyPromise: Promise<void> | null = null;

/** 스키마 변경 이후 기존 DB에 적용할 idempotent ALTER 목록. */
const MIGRATIONS: string[] = [
  `ALTER TABLE shadowing_videos ADD COLUMN transcript TEXT DEFAULT '[]'`,
];

/** 연결 설정 결정: Turso 우선, 없으면 로컬 파일. */
function resolveConfig(): { url: string; authToken?: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  // 로컬 파일 (.data 디렉터리 보장)
  const dataDir = join(process.cwd(), ".data");
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {
    // 이미 존재 등 — 무시
  }
  const file = join(dataDir, "nativo.db");
  return { url: `file:${file}` };
}

/** libSQL 클라이언트 싱글톤. */
export function getDb(): Client {
  if (!client) {
    client = createLibsql(resolveConfig());
  }
  return client;
}

/** 스키마 적용 + 단일 사용자 시드 (최초 1회, 캐시된 promise). */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = init().catch((err) => {
      // 실패 시 다음 호출에서 재시도할 수 있도록 캐시 해제
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

async function init(): Promise<void> {
  const db = getDb();
  const schemaPath = join(process.cwd(), "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  await db.executeMultiple(schema);

  // 가벼운 마이그레이션: 기존 DB에 누락된 컬럼 추가 (이미 있으면 에러 무시)
  for (const stmt of MIGRATIONS) {
    try {
      await db.execute(stmt);
    } catch {
      // 컬럼이 이미 존재 → 무시
    }
  }

  // 단일 사용자 시드 (이미 있으면 무시)
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
    args: [LOCAL_USER_ID, LOCAL_USER_EMAIL, "Me"],
  });
}
