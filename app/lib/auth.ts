import axios from "axios";
import { API_BASE_URL } from "./api";

export interface AuthUser {
  name: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
  target_role?: string;
  work_experience_years?: number;
  desired_city?: string;
  expected_salary?: string;
  skills?: string[];
  bio?: string;
}

export interface ReportHistoryItem {
  id: string;
  score: number;
  overall_summary: string;
  job_title: string;
  created_at: string;
}

export function resolveAvatarUrl(url?: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw}`;
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter((x) => x.trim().length > 0);
  if (typeof value === "string" && value.trim()) return value.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

const CURRENT_USER_KEY = "aii_current_user";
const AUTH_TOKEN_KEY = "aii_auth_token";

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
    return {
      name: String(parsed.name),
      email: String(parsed.email),
      avatar_url: parsed.avatar_url ? String(parsed.avatar_url) : undefined,
      created_at: parsed.created_at ? String(parsed.created_at) : undefined,
      target_role: parsed.target_role ? String(parsed.target_role) : undefined,
      work_experience_years: Number(parsed.work_experience_years || 0),
      desired_city: parsed.desired_city ? String(parsed.desired_city) : undefined,
      expected_salary: parsed.expected_salary ? String(parsed.expected_salary) : undefined,
      skills: parseSkills(parsed.skills),
      bio: parsed.bio ? String(parsed.bio) : undefined,
    };
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

export function buildAuthHeaders(): Record<string, string> {
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
      headers: buildAuthHeaders(),
      timeout: 10000,
    });

    if (response.data?.code !== 200 || !response.data?.data) {
      clearSession();
      return null;
    }

    const user: AuthUser = {
      name: String(response.data.data.name || ""),
      email: String(response.data.data.email || ""),
      avatar_url: response.data.data.avatar_url ? String(response.data.data.avatar_url) : undefined,
      created_at: response.data.data.created_at ? String(response.data.data.created_at) : undefined,
      target_role: response.data.data.target_role ? String(response.data.data.target_role) : undefined,
      work_experience_years: Number(response.data.data.work_experience_years || 0),
      desired_city: response.data.data.desired_city ? String(response.data.data.desired_city) : undefined,
      expected_salary: response.data.data.expected_salary ? String(response.data.data.expected_salary) : undefined,
      skills: parseSkills(response.data.data.skills),
      bio: response.data.data.bio ? String(response.data.data.bio) : undefined,
    };

    if (isBrowser()) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
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
      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        {},
        {
          headers: buildAuthHeaders(),
          timeout: 10000,
        }
      );
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
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/register`,
      {
        name,
        email,
        password,
        verification_code: verificationCode,
      },
      { timeout: 15000 }
    );

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
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/send-register-code`,
      { email },
      { timeout: 15000 }
    );
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
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email,
        password,
      },
      { timeout: 15000 }
    );

    if (response.data?.code !== 200 || !response.data?.data) {
      return { ok: false, message: "登录失败，请稍后重试" };
    }

    const token = String(response.data.data.token || "");
    const user: AuthUser = {
      name: String(response.data.data.user?.name || ""),
      email: String(response.data.data.user?.email || ""),
      avatar_url: response.data.data.user?.avatar_url ? String(response.data.data.user.avatar_url) : undefined,
      created_at: response.data.data.user?.created_at ? String(response.data.data.user.created_at) : undefined,
      target_role: response.data.data.user?.target_role ? String(response.data.data.user.target_role) : undefined,
      work_experience_years: Number(response.data.data.user?.work_experience_years || 0),
      desired_city: response.data.data.user?.desired_city ? String(response.data.data.user.desired_city) : undefined,
      expected_salary: response.data.data.user?.expected_salary ? String(response.data.data.user.expected_salary) : undefined,
      skills: parseSkills(response.data.data.user?.skills),
      bio: response.data.data.user?.bio ? String(response.data.data.user.bio) : undefined,
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

export async function updateProfile(input: {
  name?: string;
  target_role?: string;
  work_experience_years?: number;
  desired_city?: string;
  expected_salary?: string;
  skills?: string[];
  bio?: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/auth/profile`,
      {
        name: input.name,
        target_role: input.target_role,
        work_experience_years: input.work_experience_years,
        desired_city: input.desired_city,
        expected_salary: input.expected_salary,
        skills: input.skills,
        bio: input.bio,
      },
      {
        headers: buildAuthHeaders(),
        timeout: 15000,
      }
    );

    if (response.data?.code !== 200 || !response.data?.data) {
      return { ok: false, message: "资料更新失败" };
    }

    const user: AuthUser = {
      name: String(response.data.data.name || ""),
      email: String(response.data.data.email || ""),
      avatar_url: response.data.data.avatar_url ? String(response.data.data.avatar_url) : undefined,
      created_at: response.data.data.created_at ? String(response.data.data.created_at) : undefined,
      target_role: response.data.data.target_role ? String(response.data.data.target_role) : undefined,
      work_experience_years: Number(response.data.data.work_experience_years || 0),
      desired_city: response.data.data.desired_city ? String(response.data.data.desired_city) : undefined,
      expected_salary: response.data.data.expected_salary ? String(response.data.data.expected_salary) : undefined,
      skills: parseSkills(response.data.data.skills),
      bio: response.data.data.bio ? String(response.data.data.bio) : undefined,
    };

    if (isBrowser()) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }

    return { ok: true, user };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "资料更新失败")
      : "资料更新失败";
    return { ok: false, message };
  }
}

export async function uploadAvatar(file: File): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  if (!file) return { ok: false, message: "请选择图片文件" };
  if (!file.type.startsWith("image/")) return { ok: false, message: "仅支持图片文件" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "头像大小不能超过 5MB" };

  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/avatar`, formData, {
      headers: buildAuthHeaders(),
      timeout: 20000,
    });

    if (response.data?.code !== 200 || !response.data?.data) {
      return { ok: false, message: "头像上传失败" };
    }

    const user: AuthUser = {
      name: String(response.data.data.name || ""),
      email: String(response.data.data.email || ""),
      avatar_url: response.data.data.avatar_url ? String(response.data.data.avatar_url) : undefined,
      created_at: response.data.data.created_at ? String(response.data.data.created_at) : undefined,
      target_role: response.data.data.target_role ? String(response.data.data.target_role) : undefined,
      work_experience_years: Number(response.data.data.work_experience_years || 0),
      desired_city: response.data.data.desired_city ? String(response.data.data.desired_city) : undefined,
      expected_salary: response.data.data.expected_salary ? String(response.data.data.expected_salary) : undefined,
      skills: parseSkills(response.data.data.skills),
      bio: response.data.data.bio ? String(response.data.data.bio) : undefined,
    };

    if (isBrowser()) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    return { ok: true, user };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "头像上传失败")
      : "头像上传失败";
    return { ok: false, message };
  }
}

export async function fetchMyReports(): Promise<{ ok: true; reports: ReportHistoryItem[] } | { ok: false; message: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/reports`, {
      headers: buildAuthHeaders(),
      timeout: 15000,
    });

    if (response.data?.code !== 200 || !Array.isArray(response.data?.data)) {
      return { ok: false, message: "获取历史评估失败" };
    }

    const reports: ReportHistoryItem[] = response.data.data.map((item: any) => ({
      id: String(item.id || ""),
      score: Number(item.score || 0),
      overall_summary: String(item.overall_summary || ""),
      job_title: String(item.job_title || ""),
      created_at: String(item.created_at || ""),
    }));

    return { ok: true, reports };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.detail || "获取历史评估失败")
      : "获取历史评估失败";
    return { ok: false, message };
  }
}

export async function deleteReport(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/reports/${id}`, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) {
      return { ok: true };
    }
    return { ok: false, message: "删除失败" };
  } catch (error) {
    const detail = axios.isAxiosError(error) ? String(error.response?.data?.detail || "") : "";
    return { ok: false, message: detail ? `删除失败：${detail}` : "删除失败" };
  }
}

// ==========================================
// Interview Experience Square (面经广场) API
// ==========================================

export interface SquarePost {
  id: string;
  author_email: string;
  author_name: string;
  author_avatar: string;
  company: string;
  role: string;
  content: string;
  content_snippet?: string;
  tags: string[];
  created_at: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
}

export interface SquareComment {
  id: string;
  post_id: string;
  author_email: string;
  author_name: string;
  author_avatar: string;
  content: string;
  reply_to?: string;
  reply_to_name?: string;
  created_at: string;
}

export async function fetchPosts(query: string = ""): Promise<{ ok: boolean; posts: SquarePost[]; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/posts`, {
      params: { q: query, limit: 100 },
      timeout: 10000,
    });
    if (response.data?.code === 200) {
      return { ok: true, posts: response.data.data || [] };
    }
    return { ok: false, posts: [] };
  } catch (error) {
    return { ok: false, posts: [], message: "获取面经列表失败" };
  }
}

export async function createPost(data: { company: string; role: string; content: string; tags: string[] }) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/posts`, data, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) return { ok: true, post: response.data.data as SquarePost };
    return { ok: false, message: "发帖失败" };
  } catch (error) {
    const detail = axios.isAxiosError(error) ? String(error.response?.data?.detail || "") : "";
    return { ok: false, message: detail || "发帖请求失败" };
  }
}

export async function deletePost(post_id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/posts/${post_id}`, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) return { ok: true };
    return { ok: false, message: "删除失败" };
  } catch (error) {
    const detail = axios.isAxiosError(error) ? String(error.response?.data?.detail || "") : "";
    return { ok: false, message: detail || "删除帖子失败" };
  }
}

export async function fetchPostDetail(post_id: string): Promise<{ ok: boolean; post?: SquarePost; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/posts/${post_id}`, { timeout: 10000 });
    if (response.data?.code === 200) return { ok: true, post: response.data.data };
    return { ok: false, message: "获取帖子详情失败" };
  } catch {
    return { ok: false, message: "请求详情失败" };
  }
}

export async function togglePostLike(post_id: string): Promise<{ ok: boolean; likes_count?: number; is_liked?: boolean; message?: string }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/posts/${post_id}/like`, {}, {
      headers: buildAuthHeaders(),
      timeout: 5000,
    });
    if (response.data?.code === 200) {
      return { ok: true, likes_count: response.data.data.likes_count, is_liked: response.data.data.is_liked };
    }
    return { ok: false, message: "操作失败" };
  } catch {
    return { ok: false, message: "点赞失败，请确已登录" };
  }
}

export async function getPostLikeStatus(post_id: string): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/posts/${post_id}/like-status`, {
      headers: buildAuthHeaders(),
      timeout: 5000,
    });
    return !!response.data?.data?.is_liked;
  } catch {
    return false;
  }
}

export async function fetchPostComments(post_id: string): Promise<{ ok: boolean; comments: SquareComment[] }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/posts/${post_id}/comments`, { timeout: 8000 });
    if (response.data?.code === 200) return { ok: true, comments: response.data.data || [] };
    return { ok: false, comments: [] };
  } catch {
    return { ok: false, comments: [] };
  }
}

export async function createPostComment(post_id: string, content: string, reply_to?: string, reply_to_name?: string): Promise<{ ok: boolean; comment?: SquareComment; message?: string }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/posts/${post_id}/comments`, { content, reply_to: reply_to || "", reply_to_name: reply_to_name || "" }, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) return { ok: true, comment: response.data.data };
    return { ok: false, message: "评论失败" };
  } catch (error) {
    const detail = axios.isAxiosError(error) ? String(error.response?.data?.detail || "") : "";
    return { ok: false, message: detail || "无法发布评论，请确已登录" };
  }
}

export async function deleteComment(post_id: string, comment_id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/posts/${post_id}/comments/${comment_id}`, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) return { ok: true };
    return { ok: false, message: "删除评论失败" };
  } catch (error) {
    const detail = axios.isAxiosError(error) ? String(error.response?.data?.detail || "") : "";
    return { ok: false, message: detail || "删除评论失败" };
  }
}

// ==========================================
// Notification System
// ==========================================
export interface Notification {
  id: string;
  type: "like" | "comment" | "report" | string;
  title: string;
  body: string;
  link: string;
  actor_name: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<{ ok: boolean; notifications: Notification[] }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/notifications`, {
      headers: buildAuthHeaders(),
      timeout: 10000,
    });
    if (response.data?.code === 200) return { ok: true, notifications: response.data.data || [] };
    return { ok: false, notifications: [] };
  } catch {
    return { ok: false, notifications: [] };
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await axios.post(`${API_BASE_URL}/api/notifications/${notifId}/read`, {}, {
      headers: buildAuthHeaders(),
      timeout: 5000,
    });
  } catch { /* silent */ }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await axios.post(`${API_BASE_URL}/api/notifications/read-all`, {}, {
      headers: buildAuthHeaders(),
      timeout: 5000,
    });
  } catch { /* silent */ }
}
