"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Briefcase,
  FileText,
  LogOut,
  Loader2,
  UserRound,
  CheckCircle2,
  Info,
  Sparkles,
  ArrowLeft,
  Clock3,
  Radar,
  Layers3,
  Cpu,
  ScanSearch,
} from "lucide-react";
import axios from "axios";
import {
  AuthUser,
  buildAuthHeaders,
  fetchCurrentUser,
  loginUser,
  logout,
  resolveAvatarUrl,
  registerUser,
  sendRegisterCode,
} from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

type AuthMode = "login" | "register";
type TopNotice = { id: number; text: string; type: "success" | "info" } | null;
type SuccessModal = { open: boolean; message: string };

const startTips = [
  "建议填写完整 JD，追问会更贴近真实岗位",
  "简历请上传 PDF，系统会结合简历内容提问",
  "单次最多 15 轮，结束后自动生成评估报告",
];

const capabilityCards = [
  {
    title: "动态追问链路",
    desc: "根据你的回答继续深挖，不走固定题库。",
    icon: Layers3,
  },
  {
    title: "岗位语境评估",
    desc: "把 JD、简历、回答放在同一语境评估。",
    icon: ScanSearch,
  },
  {
    title: "结构化改进建议",
    desc: "输出可执行的优化点，而不只是评分。",
    icon: Cpu,
  },
];

const quickMeta = [
  { label: "最多轮次", value: "15" },
  { label: "耗时", value: "≈10min" },
  { label: "输出", value: "评估报告" },
];

export default function StartPage() {
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerVerificationCode, setRegisterVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [topNotice, setTopNotice] = useState<TopNotice>(null);
  const [successModal, setSuccessModal] = useState<SuccessModal>({ open: false, message: "" });

  useEffect(() => {
    let active = true;
    (async () => {
      const user = await fetchCurrentUser();
      if (!active) return;
      setCurrentUser(user);
      setAuthChecked(true);

      if (typeof window !== "undefined") {
        const flashRaw = sessionStorage.getItem("auth_flash_notice");
        if (flashRaw) {
          try {
            const flash = JSON.parse(flashRaw) as { text?: string; type?: "success" | "info" };
            if (flash?.text) {
              if ((flash.type || "success") === "success") {
                showSuccessModal(flash.text, 1600);
              } else {
                showTopNotice(flash.text, "info", 1600);
              }
            }
          } catch {
            showSuccessModal("登录成功", 1600);
          }
          sessionStorage.removeItem("auth_flash_notice");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const isFormValid = useMemo(() => {
    return !!jobTitle.trim() && !!jobDescription.trim() && !!file;
  }, [jobTitle, jobDescription, file]);

  const showTopNotice = (text: string, type: "success" | "info" = "info", duration = 1600) => {
    const id = Date.now();
    setTopNotice({ id, text, type });
    setTimeout(() => {
      setTopNotice((prev) => (prev && prev.id === id ? null : prev));
    }, duration);
  };

  const showSuccessModal = (message: string, duration = 1500) => {
    setSuccessModal({ open: true, message });
    setTimeout(() => {
      setSuccessModal((prev) => (prev.open ? { open: false, message: "" } : prev));
    }, duration);
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthSuccess("");
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    if (authSubmitting) return;
    setShowAuthModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setFormError("仅支持上传 PDF 格式简历");
      return;
    }
    setFile(selected);
    setFormError("");
  };

  const startInterview = async () => {
    setFormError("");

    if (!isFormValid) {
      setFormError("请填写完整岗位信息并上传简历");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("job_title", jobTitle);
    formData.append("job_description", jobDescription);
    formData.append("resume", file as File);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/init-interview`, formData, {
        headers: {
          ...buildAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data?.code === 200) {
        const { session_id, first_question } = response.data.data;
        localStorage.setItem("interview_session_id", session_id);
        localStorage.setItem("first_question", first_question);
        router.push("/chat");
        return;
      }

      const msg = response.data?.message || response.data?.detail || "服务暂时不可用";
      setFormError(`初始化失败：${msg}`);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
        setFormError(`初始化失败：${detail}`);
      } else {
        setFormError("请求失败，请检查后端服务和网络连接");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isFormValid) {
      setFormError("请填写完整岗位信息并上传简历");
      return;
    }

    if (!currentUser) {
      setPendingStart(true);
      openAuthModal("login");
      return;
    }

    await startInterview();
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    showTopNotice("正在退出登录...", "info", 1300);
    await logout();
    showSuccessModal("已退出登录", 1400);
    setCurrentUser(null);
    setIsLoggingOut(false);
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;

    setAuthError("");
    setAuthSuccess("");
    setAuthSubmitting(true);

    const result = await loginUser({ email: loginEmail, password: loginPassword });
    setAuthSubmitting(false);

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setAuthSuccess("登录成功");
    showSuccessModal(`登录成功，欢迎回来，${result.user.name}`, pendingStart ? 900 : 1600);
    setCurrentUser(result.user);
    setShowAuthModal(false);

    if (pendingStart) {
      showTopNotice("登录成功，正在初始化面试...", "info", 1200);
      setPendingStart(false);
      await new Promise((resolve) => setTimeout(resolve, 700));
      await startInterview();
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;

    setAuthError("");
    setAuthSuccess("");

    if (registerPassword !== registerConfirmPassword) {
      setAuthError("两次密码输入不一致");
      return;
    }
    if (!registerName.trim()) {
      setAuthError("请输入昵称");
      return;
    }
    if (!registerVerificationCode.trim()) {
      setAuthError("请输入邮箱验证码");
      return;
    }

    setAuthSubmitting(true);
    const result = await registerUser({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
      verificationCode: registerVerificationCode,
    });
    setAuthSubmitting(false);

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setAuthSuccess("注册成功，请登录");
    setAuthMode("login");
    setLoginEmail(registerEmail);
    setLoginPassword("");
  };

  const onSendRegisterCode = async () => {
    if (sendingCode || countdown > 0) return;
    setAuthError("");
    setAuthSuccess("");

    if (!registerEmail.trim()) {
      setAuthError("请先输入邮箱");
      return;
    }

    setSendingCode(true);
    const result = await sendRegisterCode(registerEmail);
    setSendingCode(false);

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setCountdown(60);
    setAuthSuccess("验证码已发送，请检查邮箱");
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-300">
        正在加载开始页...
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b1020] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.25),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(129,140,248,0.24),transparent_32%),linear-gradient(to_bottom,#090e1d,#0b1020_45%,#0f172a)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div style={{ "--d": "500ms" } as CSSProperties} className="anim-float absolute right-[-8rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.24)_0%,rgba(56,189,248,0)_70%)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Radar size={16} className="text-sky-300" />
            <span className="text-sm font-medium tracking-[0.16em] uppercase">Interview Copilot</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              <ArrowLeft size={14} /> 返回首页
            </Link>

            {currentUser ? (
              <>
                <div className="relative hidden sm:block group">
                  <Link
                    href="/history"
                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                    title="进入用户中心"
                  >
                    {currentUser.avatar_url ? (
                      <img src={resolveAvatarUrl(currentUser.avatar_url)} alt={currentUser.name} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-white/15 flex items-center justify-center">
                        <UserRound size={14} />
                      </span>
                    )}
                    <span>{currentUser.name}</span>
                  </Link>
                  <div className="pointer-events-none absolute right-0 top-[calc(100%+10px)] w-72 rounded-2xl border border-white/15 bg-[#0f172a]/95 p-4 text-xs text-slate-200 opacity-0 shadow-2xl shadow-black/40 transition duration-200 group-hover:opacity-100">
                    <p className="text-sm font-semibold text-white">{currentUser.name}</p>
                    <p className="mt-1 text-slate-400">{currentUser.email}</p>
                    <div className="mt-3 space-y-1">
                      <p>目标岗位：{currentUser.target_role || "未填写"}</p>
                      <p>工作年限：{currentUser.work_experience_years || 0} 年</p>
                      <p>期望城市：{currentUser.desired_city || "未填写"}</p>
                      <p>期望薪资：{currentUser.expected_salary || "未填写"}</p>
                    </div>
                    <p className="mt-3 text-slate-300 line-clamp-2">
                      {currentUser.bio || "点击头像进入用户中心，完善你的求职档案。"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="inline-flex min-w-[92px] items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                  {isLoggingOut ? "退出中" : "退出"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal("login")}
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                >
                  登录
                </button>
                <button
                  onClick={() => openAuthModal("register")}
                  className="rounded-full bg-white px-4 py-2 text-sm text-slate-900 transition hover:bg-slate-200"
                >
                  注册
                </button>
              </>
            )}
          </div>
        </div>

        {topNotice && (
          <div className="mx-auto max-w-6xl px-5 pb-3">
            <div
              key={topNotice.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                topNotice.type === "success"
                  ? "toast-success border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
                  : "toast-animated border-sky-500/40 bg-sky-500/20 text-sky-100"
              }`}
            >
              <span className="toast-icon-pop">
                {topNotice.type === "success" ? <CheckCircle2 size={16} /> : <Info size={16} />}
              </span>
              {topNotice.text}
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 pt-14 lg:grid-cols-[0.95fr_1.05fr]">
        <aside style={{ "--d": "120ms" } as CSSProperties} className="anim-fade-up h-fit rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
            <Sparkles size={14} /> Start Simulation
          </div>

          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white">
            开始一场更像
            <br />
            真实现场的技术面
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            填写岗位与 JD，上传简历后，系统会动态追问你的技术细节，并输出可复盘的评估报告。
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {quickMeta.map((meta) => (
              <div key={meta.label} className="rounded-2xl border border-white/15 bg-black/20 p-3 text-center">
                <p className="text-lg font-semibold text-white">{meta.value}</p>
                <p className="mt-1 text-xs text-slate-300">{meta.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/15 bg-black/20 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white">
              <Clock3 size={15} className="text-sky-300" /> 开始前建议
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {startTips.map((tip) => (
                <li key={tip} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            {capabilityCards.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-white/10 p-1.5 text-sky-200">
                      <Icon size={14} />
                    </div>
                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </aside>

        <div style={{ "--d": "220ms" } as CSSProperties} className="anim-fade-up rounded-3xl border border-slate-200/70 bg-[#f8fafc] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.35)] sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">填写面试信息</h2>
          <p className="mt-2 text-sm text-slate-600">支持中文/英文 JD，简历仅支持 PDF。</p>

          {formError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Briefcase size={16} /> 面试岗位
              </label>
              <input
                type="text"
                placeholder="例如：前端开发工程师"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileText size={16} /> 岗位需求（JD）
              </label>
              <textarea
                rows={6}
                placeholder="请粘贴岗位职责、任职要求、技术栈等信息..."
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">上传简历（.pdf）</label>
              <label className="group flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white transition hover:border-cyan-400 hover:bg-cyan-50/40">
                <UploadCloud className="mb-3 h-10 w-10 text-slate-400 transition group-hover:text-cyan-600" />
                <p className="text-sm text-slate-600">
                  {file ? <span className="font-medium text-cyan-700">{file.name}</span> : "点击或拖拽上传 PDF 简历"}
                </p>
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-shine w-full rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-slate-600 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
            >
              {loading ? "正在解析简历并初始化面试..." : "开始模拟面试"}
            </button>

            {!currentUser && (
              <p className="text-xs text-slate-600">
                未登录时点击开始会先拉起登录/注册，验证成功后自动继续。
              </p>
            )}
          </form>
        </div>
      </section>

      {successModal.open && (
        <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <div className="anim-pop-in w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xl">
            <div className="toast-icon-pop mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">操作成功</h3>
            <p className="mt-2 text-sm text-slate-600">{successModal.message}</p>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="anim-fade-in fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="anim-pop-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`rounded-md px-3 py-1.5 text-sm ${authMode === "login" ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}
                >
                  登录
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`rounded-md px-3 py-1.5 text-sm ${authMode === "register" ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}
                >
                  注册
                </button>
              </div>
              <button onClick={closeAuthModal} className="text-sm text-slate-500 hover:text-slate-800">
                关闭
              </button>
            </div>

            {authError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</p>
            )}
            {authSuccess && (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {authSuccess}
              </p>
            )}

            {authMode === "login" ? (
              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-700">邮箱</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-700">密码</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-400"
                >
                  {authSubmitting ? "登录中..." : "登录并继续"}
                </button>
              </form>
            ) : (
              <form onSubmit={submitRegister} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-700">昵称</label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="请输入昵称"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-700">邮箱</label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-700">密码</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-700">确认密码</label>
                  <input
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-700">邮箱验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={registerVerificationCode}
                      onChange={(e) => setRegisterVerificationCode(e.target.value)}
                      placeholder="请输入 6 位验证码"
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={onSendRegisterCode}
                      disabled={sendingCode || countdown > 0}
                      className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:border-slate-200 disabled:text-slate-400"
                    >
                      {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中..." : "发送验证码"}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-slate-400"
                >
                  {authSubmitting ? "注册中..." : "注册账号"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}







