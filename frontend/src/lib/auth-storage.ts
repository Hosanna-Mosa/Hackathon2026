export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type StoredAuth = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "drishyamitra_auth";
export const AUTH_STORAGE_EVENT = "drishyamitra-auth-changed";

const hasWindow = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isValidStoredAuth = (value: unknown): value is StoredAuth => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cast = value as Partial<StoredAuth>;
  return (
    typeof cast.token === "string" &&
    cast.token.trim().length > 0 &&
    !!cast.user &&
    typeof cast.user.id === "string" &&
    cast.user.id.trim().length > 0 &&
    typeof cast.user.name === "string" &&
    typeof cast.user.email === "string"
  );
};

export const getStoredAuth = (): StoredAuth | null => {
  if (!hasWindow()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isValidStoredAuth(parsed)) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
};

export const saveStoredAuth = (value: StoredAuth) => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
};

export const clearStoredAuth = () => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
};

export const getAuthToken = () => getStoredAuth()?.token || "";
