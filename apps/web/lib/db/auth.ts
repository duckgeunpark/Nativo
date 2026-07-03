/**
 * 인증 스텁 — 단일 사용자(로컬) 모드.
 *
 * 로그인/세션을 제거했으므로 항상 동일한 고정 사용자를 반환한다.
 * 기존 코드의 `supabase.auth.getUser()` / `getSession()` 호출과 호환되는 형태를 유지해
 * 호출부 수정을 최소화한다.
 */

/** 고정 단일 사용자 ID (users 테이블에 시드되는 유일한 행). */
export const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";
export const LOCAL_USER_EMAIL = "local@nativo.app";

export interface LocalUser {
  id: string;
  email: string;
}

export const LOCAL_USER: LocalUser = {
  id: LOCAL_USER_ID,
  email: LOCAL_USER_EMAIL,
};

/** Supabase auth 인터페이스의 사용 부분집합만 흉내내는 스텁. */
export const authStub = {
  async getUser() {
    return { data: { user: LOCAL_USER }, error: null };
  },
  async getSession() {
    return { data: { session: { user: LOCAL_USER } }, error: null };
  },
  async signOut() {
    return { error: null };
  },
};

export type AuthStub = typeof authStub;
