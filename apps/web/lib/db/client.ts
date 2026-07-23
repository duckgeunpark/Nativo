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

  // roleplay_sessions.scenario_id 의 FK(→roleplay_scenarios) 제거.
  // 시나리오 마스터 테이블이 비어 있어 FK 가 세션 저장을 막았다. 기존 DB 는
  // 테이블을 재생성해 제약만 떼어낸다(데이터 보존, FK 가 남아 있을 때만 1회 실행).
  await dropRoleplayScenarioFk(db);

  // 단일 사용자 시드 (이미 있으면 무시)
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
    args: [LOCAL_USER_ID, LOCAL_USER_EMAIL, "Me"],
  });
}

/**
 * roleplay_sessions 의 scenario_id → roleplay_scenarios FK 제거.
 * FK 가 아직 남아 있는 기존 DB 에서만 테이블을 재생성한다(멱등, 데이터 보존).
 * SQLite 는 ALTER 로 FK 를 못 떼므로 새 테이블 복사 방식을 사용한다.
 */
async function dropRoleplayScenarioFk(db: Client): Promise<void> {
  const info = await db.execute(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'roleplay_sessions'`,
  );
  const ddl = String((info.rows[0] as { sql?: string } | undefined)?.sql ?? "");
  if (!/REFERENCES\s+roleplay_scenarios/i.test(ddl)) return; // 이미 제거됨

  await db.execute(`PRAGMA foreign_keys = OFF`);
  await db.executeMultiple(`
    CREATE TABLE roleplay_sessions_new (
      id              TEXT PRIMARY KEY,
      user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
      scenario_id     TEXT,
      language        TEXT NOT NULL,
      level           TEXT NOT NULL,
      mode            TEXT NOT NULL,
      messages        TEXT NOT NULL DEFAULT '[]',
      score_total     INTEGER,
      score_fluency   INTEGER,
      score_accuracy  INTEGER,
      score_vocab     INTEGER,
      passed          INTEGER DEFAULT 0,
      feedback        TEXT,
      new_flashcards  TEXT DEFAULT '[]',
      duration_sec    INTEGER,
      exchange_count  INTEGER,
      evaluated_at    TEXT,
      created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    INSERT INTO roleplay_sessions_new SELECT * FROM roleplay_sessions;
    DROP TABLE roleplay_sessions;
    ALTER TABLE roleplay_sessions_new RENAME TO roleplay_sessions;
    CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_user
      ON roleplay_sessions(user_id, language, passed);
  `);
  await db.execute(`PRAGMA foreign_keys = ON`);
}
