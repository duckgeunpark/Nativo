/**
 * Supabase(PostgREST) 쿼리 빌더의 **실제 사용 부분집합**을 libSQL 위에 재현한 어댑터.
 *
 * 지원: from/select/insert/update/delete/upsert,
 *       eq·neq·gt·gte·lt·lte·in·not, order·limit·range, single·maybeSingle,
 *       select(_, { count, head }), returns<T>(), 그리고 await(thenable).
 *
 * 타입: from<K>() 가 Tables<K>(Row) 로 결과를 추론시켜 호출부의 타입 안전성을 유지한다.
 */

import { randomUUID } from "node:crypto";
import type { InValue, Row } from "@libsql/client";
import { ensureReady, getDb } from "./client";
import { boolCols, jsonCols, nowIso, UPDATED_AT_TABLES } from "./meta";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Op = "select" | "insert" | "update" | "delete" | "upsert";
interface Filter {
  col: string;
  op: string; // "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not"
  value: unknown;
}

export interface QueryResult<T> {
  data: T;
  error: { message: string } | null;
  count: number | null;
}

/** single()/maybeSingle() 결과 형태(단건 또는 null). */
export interface SingleQuery<R> extends PromiseLike<QueryResult<R | null>> {}
/** returns<T>() 로 캐스팅된 결과 형태. */
export interface CastQuery<T> extends PromiseLike<QueryResult<T>> {}

const SQL_OPS: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

/** 컬럼 값 → libSQL 인자(InValue)로 직렬화. undefined 는 "생략"을 의미. */
function serialize(table: string, col: string, value: unknown): InValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (jsonCols(table).includes(col)) return JSON.stringify(value);
  if (boolCols(table).includes(col)) return value ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as InValue;
}

/** 필터 비교값 직렬화 (스칼라만). */
function serializeScalar(table: string, col: string, value: unknown): InValue {
  if (value === null || value === undefined) return null;
  if (boolCols(table).includes(col)) return value ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as InValue;
}

/** DB Row → 도메인 객체 (JSON parse, 0/1 → boolean). */
function deserialize(table: string, columns: string[], row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const js = jsonCols(table);
  const bs = boolCols(table);
  for (const c of columns) {
    let v = (row as any)[c];
    if (v !== null && v !== undefined) {
      if (js.includes(c) && typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch {
          /* 원본 유지 */
        }
      } else if (bs.includes(c)) {
        v = Boolean(v);
      } else if (typeof v === "bigint") {
        v = Number(v);
      }
    }
    out[c] = v;
  }
  return out;
}

export class QueryBuilder<R = any> implements PromiseLike<QueryResult<R[]>> {
  private op: Op = "select";
  private columns = "*";
  private rows: Record<string, unknown>[] = [];
  private updates: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private orders: { col: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private wantReturning = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private countMode = false;
  private headMode = false;
  private conflictCols: string[] = [];

  constructor(private readonly table: string) {}

  // --- 작업 종류 -------------------------------------------------------------
  select(columns = "*", opts?: { count?: string; head?: boolean }): this {
    if (this.op === "select") this.columns = columns || "*";
    else this.wantReturning = true; // 쓰기 후 RETURNING
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.op = "update";
    this.updates = values;
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): this {
    this.op = "upsert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.conflictCols = (opts?.onConflict ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  // --- 필터 ------------------------------------------------------------------
  eq(col: string, value: unknown): this {
    this.filters.push({ col, op: "=", value });
    return this;
  }
  neq(col: string, value: unknown): this {
    this.filters.push({ col, op: "!=", value });
    return this;
  }
  gt(col: string, value: unknown): this {
    this.filters.push({ col, op: ">", value });
    return this;
  }
  gte(col: string, value: unknown): this {
    this.filters.push({ col, op: ">=", value });
    return this;
  }
  lt(col: string, value: unknown): this {
    this.filters.push({ col, op: "<", value });
    return this;
  }
  lte(col: string, value: unknown): this {
    this.filters.push({ col, op: "<=", value });
    return this;
  }
  in(col: string, values: unknown[]): this {
    this.filters.push({ col, op: "in", value: values });
    return this;
  }
  /** Supabase .not(col, operator, value). 현재는 "is null 아님"과 동등 연산만 사용. */
  not(col: string, operator: string, value: unknown): this {
    this.filters.push({ col, op: "not", value: { operator, value } });
    return this;
  }

  // --- 수정자 ----------------------------------------------------------------
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  single(): SingleQuery<R> {
    this.singleMode = "single";
    return this as unknown as SingleQuery<R>;
  }
  maybeSingle(): SingleQuery<R> {
    this.singleMode = "maybe";
    return this as unknown as SingleQuery<R>;
  }
  /** 타입 캐스팅 전용 (런타임 동작 없음). */
  returns<U>(): CastQuery<U> {
    return this as unknown as CastQuery<U>;
  }

  // --- 실행(thenable) --------------------------------------------------------
  then<TR1 = QueryResult<R[]>, TR2 = never>(
    onfulfilled?: ((value: QueryResult<R[]>) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return this.execute().then(onfulfilled as any, onrejected);
  }

  private buildWhere(): { sql: string; args: InValue[] } {
    if (this.filters.length === 0) return { sql: "", args: [] };
    const parts: string[] = [];
    const args: InValue[] = [];
    for (const f of this.filters) {
      if (f.op === "in") {
        const arr = (f.value as unknown[]) ?? [];
        if (arr.length === 0) {
          parts.push("0 = 1"); // 빈 IN → 항상 거짓 (Supabase 동작과 동일)
          continue;
        }
        parts.push(`${f.col} IN (${arr.map(() => "?").join(", ")})`);
        for (const v of arr) args.push(serializeScalar(this.table, f.col, v));
      } else if (f.op === "not") {
        const { operator, value } = f.value as { operator: string; value: unknown };
        if (operator === "is" && value === null) {
          parts.push(`${f.col} IS NOT NULL`);
        } else {
          const sqlOp = SQL_OPS[operator] ?? "=";
          parts.push(`NOT (${f.col} ${sqlOp} ?)`);
          args.push(serializeScalar(this.table, f.col, value));
        }
      } else {
        parts.push(`${f.col} ${f.op} ?`);
        args.push(serializeScalar(this.table, f.col, f.value));
      }
    }
    return { sql: ` WHERE ${parts.join(" AND ")}`, args };
  }

  private returningClause(): string {
    return this.wantReturning ? ` RETURNING ${this.columns}` : "";
  }

  private finalizeRows(table: string, rs: { columns: string[]; rows: Row[] }): any {
    const cols = rs.columns;
    const list = rs.rows.map((r) => deserialize(table, cols, r));
    if (this.singleMode === "single") {
      if (list.length === 1) return { data: list[0], error: null };
      return {
        data: null,
        error: { message: `single(): expected 1 row, got ${list.length}` },
      };
    }
    if (this.singleMode === "maybe") {
      if (list.length <= 1) return { data: list[0] ?? null, error: null };
      return { data: null, error: { message: `maybeSingle(): got ${list.length} rows` } };
    }
    return { data: list, error: null };
  }

  private async execute(): Promise<QueryResult<any>> {
    try {
      await ensureReady();
      const db = getDb();
      const table = this.table;

      // ---- SELECT -----------------------------------------------------------
      if (this.op === "select") {
        const where = this.buildWhere();
        let count: number | null = null;
        if (this.countMode) {
          const cres = await db.execute({
            sql: `SELECT COUNT(*) AS cnt FROM ${table}${where.sql}`,
            args: where.args,
          });
          count = Number((cres.rows[0] as any).cnt);
          if (this.headMode) return { data: null, error: null, count };
        }
        let sql = `SELECT ${this.columns} FROM ${table}${where.sql}`;
        if (this.orders.length > 0) {
          sql +=
            " ORDER BY " +
            this.orders.map((o) => `${o.col} ${o.ascending ? "ASC" : "DESC"}`).join(", ");
        }
        if (this.limitN !== null) sql += ` LIMIT ${this.limitN}`;
        if (this.offsetN !== null) sql += ` OFFSET ${this.offsetN}`;
        const rs = await db.execute({ sql, args: where.args });
        return { ...this.finalizeRows(table, rs), count };
      }

      // ---- DELETE -----------------------------------------------------------
      if (this.op === "delete") {
        const where = this.buildWhere();
        const rs = await db.execute({
          sql: `DELETE FROM ${table}${where.sql}${this.returningClause()}`,
          args: where.args,
        });
        if (this.wantReturning) return { ...this.finalizeRows(table, rs), count: null };
        return { data: null, error: null, count: null };
      }

      // ---- UPDATE -----------------------------------------------------------
      if (this.op === "update") {
        const values = { ...this.updates };
        if (UPDATED_AT_TABLES.has(table)) values.updated_at = nowIso();
        const setCols: string[] = [];
        const setArgs: InValue[] = [];
        for (const [col, raw] of Object.entries(values)) {
          const v = serialize(table, col, raw);
          if (v === undefined) continue;
          setCols.push(`${col} = ?`);
          setArgs.push(v);
        }
        const where = this.buildWhere();
        const rs = await db.execute({
          sql: `UPDATE ${table} SET ${setCols.join(", ")}${where.sql}${this.returningClause()}`,
          args: [...setArgs, ...where.args],
        });
        if (this.wantReturning) return { ...this.finalizeRows(table, rs), count: null };
        return { data: null, error: null, count: null };
      }

      // ---- INSERT / UPSERT (행별 실행) --------------------------------------
      const returned: Row[] = [];
      let lastColumns: string[] = [];
      for (const raw of this.rows) {
        const row = { ...raw };
        if (row.id === undefined || row.id === null) row.id = randomUUID();
        if (this.op === "upsert" && UPDATED_AT_TABLES.has(table)) row.updated_at = nowIso();

        const cols: string[] = [];
        const args: InValue[] = [];
        for (const [col, val] of Object.entries(row)) {
          const v = serialize(table, col, val);
          if (v === undefined) continue;
          cols.push(col);
          args.push(v);
        }
        const placeholders = cols.map(() => "?").join(", ");
        let sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;

        if (this.op === "upsert") {
          const updatable = cols.filter(
            (c) => c !== "id" && !this.conflictCols.includes(c),
          );
          const conflict = this.conflictCols.join(", ");
          sql +=
            updatable.length > 0
              ? ` ON CONFLICT(${conflict}) DO UPDATE SET ${updatable
                  .map((c) => `${c} = excluded.${c}`)
                  .join(", ")}`
              : ` ON CONFLICT(${conflict}) DO NOTHING`;
        }
        sql += this.returningClause();

        const rs = await db.execute({ sql, args });
        if (this.wantReturning) {
          lastColumns = rs.columns;
          for (const r of rs.rows) returned.push(r);
        }
      }

      if (this.wantReturning) {
        return {
          ...this.finalizeRows(table, { columns: lastColumns, rows: returned }),
          count: null,
        };
      }
      return { data: null, error: null, count: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message }, count: null };
    }
  }
}
