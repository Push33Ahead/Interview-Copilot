import axios from "axios";

export interface AuthUser {
  name: string;
  email: string;
}

const CURRENT_USER_KEY = "aii_current_user";
const AUTH_TOKEN_KEY = "aii_auth_token";
const API_BASE_URL = "http://121.41.208.145:8000";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCurrentUser(): AuthUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.name) return null;
    return { name: String(parsed.name), email: String(parsed.email) };
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getAuthToken();
}

export function getAuthToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setSession(user: AuthUser, token: string) {
  if (!isBrowser()) return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem("interview_session_id");
  localStorage.removeItem("first_question");
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: authHeaders(),
      timeout: 10000
    });
    if (response.data?.code !== 200 || !response.data?.data) {
      clearSession();
      return null;
    }

    const user = {
      name: String(response.data.data.name || ""),
      email: String(response.data.data.email || "")
    };
    if (isBrowser()) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // 仅在明确鉴权失败时清理登录态，网络抖动时保留本地态避免误伤
      if (status === 401 || status === 403) {
        clearSession();
        return null;
      }
      return getCurrentUser();
    }
    return getCurrentUser();
  }
}

export async function logout() {
  const token = getAuthToken();
  if (token) {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        headers: authHeaders(),
        timeout: 10000
      });
    } catch {
      // ignore network errors on logout, clear local state anyway
    }
  }
  clearSession();
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  verificationCode: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const verificationCode = input.verificationCode.trim();

  if (!name) return { ok: false, message: "请输入昵称" };
  if (!email) return { ok: false, message: "请输入邮箱" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "邮箱格式不正确" };
  }
  if (password.length < 6) {
    return { ok: false, message: "密码至少 6 位" };
  }
  if (!verificationCode) {
    return { ok: false, message: "请输入邮箱验证码" };
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      name,
      email,
      password,
      verification_code: verificationCode
    }, { timeout: 15000 });
    if (response.data?.code === 200) return { ok: true };
    return { ok: false, message: "注册失败，请稍后重试" };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "注册失败，请稍后重试")
      : "注册失败，请稍后重试";
    return { ok: false, message };
  }
}

export async function sendRegisterCode(emailInput: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { ok: false, message: "请输入邮箱" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "邮箱格式不正确" };
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/send-register-code`, {
      email
    }, { timeout: 15000 });
    if (response.data?.code === 200) return { ok: true };
    return { ok: false, message: "验证码发送失败，请稍后重试" };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "验证码发送失败，请稍后重试")
      : "验证码发送失败，请稍后重试";
    return { ok: false, message };
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, message: "请输入邮箱和密码" };
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email,
      password
    }, { timeout: 15000 });

    if (response.data?.code !== 200 || !response.data?.data) {
      return { ok: false, message: "登录失败，请稍后重试" };
    }
    const token = String(response.data.data.token || "");
    const user = {
      name: String(response.data.data.user?.name || ""),
      email: String(response.data.data.user?.email || "")
    };
    if (!token) return { ok: false, message: "登录失败：未获取到 token" };

    setSession(user, token);
    return { ok: true, user };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "登录失败，请稍后重试")
      : "登录失败，请稍后重试";
    return { ok: false, message };
  }
}
