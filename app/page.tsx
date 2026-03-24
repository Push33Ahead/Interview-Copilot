"use client";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
  ShieldCheck,
  Sparkles,
  BarChart3
} from "lucide-react";
import axios from "axios";
import { AuthUser, fetchCurrentUser, loginUser, logout, registerUser, sendRegisterCode } from "./lib/auth";

const API_BASE_URL = "http://121.41.208.145:8000";

type AuthMode = "login" | "register";
type TopNotice = { id: number; text: string; type: "success" | "info" } | null;
type SuccessModal = { open: boolean; message: string };

export default function Home() {
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
    const timer = setInterval(() => setCountdown((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const isFormValid = useMemo(() => {
    return !!jobTitle.trim() && !!jobDescription.trim() && !!file;
  }, [jobTitle, jobDescription, file]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setFormError("仅支持上传 PDF 格式的简历");
        return;
      }
      setFile(selectedFile);
      setFormError("");
    }
  };

  const startInterview = async () => {
    setFormError("");
    if (!isFormValid) {
      setFormError("请填写完整信息并上传简历");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("job_title", jobTitle);
    formData.append("job_description", jobDescription);
    formData.append("resume", file as File);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/init-interview`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (response.data.code === 200) {
        const { session_id, first_question } = response.data.data;
        localStorage.setItem("interview_session_id", session_id);
        localStorage.setItem("first_question", first_question);
        router.push("/chat");
        return;
      }
      const msg = response.data?.message || response.data?.detail || "服务暂时不可用";
      setFormError("初始化失败: " + msg);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
        setFormError(`初始化失败: ${detail}`);
      } else {
        setFormError("请求服务器失败，请检查服务器是否启动、8000端口是否放行");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isFormValid) {
      setFormError("请填写完整信息并上传简历");
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
    showSuccessModal("已退出登录", 1500);
    setCurrentUser(null);
    setIsLoggingOut(false);
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setAuthError("");
    setAuthSuccess("");

    setAuthSubmitting(true);
    const result = await loginUser({
      email: loginEmail,
      password: loginPassword
    });
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
      verificationCode: registerVerificationCode
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
      <main className="min-h-screen flex items-center justify-center text-slate-500">
        正在加载首页...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0,_#f8fafc_35%,_#f8fafc_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="anim-float absolute -top-20 -left-20 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div style={{ "--d": "900ms" } as CSSProperties} className="anim-float absolute top-24 right-0 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200/70 anim-fade-up">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-tight text-slate-900">Interview Copilot</div>
          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700 px-3 py-2 rounded-lg bg-white border border-slate-200">
                  <UserRound size={16} />
                  <span>{currentUser.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="px-3 py-2 rounded-lg text-sm border border-slate-300 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 min-w-[88px] justify-center"
                >
                  {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  {isLoggingOut ? "退出中..." : "退出"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal("login")}
                  className="px-3 py-2 rounded-lg text-sm border border-slate-300 hover:bg-slate-100"
                >
                  登录
                </button>
                <button
                  onClick={() => openAuthModal("register")}
                  className="px-3 py-2 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800"
                >
                  注册
                </button>
              </>
            )}
          </div>
        </div>
        {topNotice && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div
              key={topNotice.id}
              className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                topNotice.type === "success"
                  ? "toast-success bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "toast-animated bg-sky-50 text-sky-700 border-sky-200"
              }`}
            >
              <span className="toast-icon-pop">
                {topNotice.type === "success" ? <CheckCircle2 size={16} /> : <Info size={16} />}
              </span>
              <span>{topNotice.text}</span>
            </div>
          </div>
        )}
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-16 pb-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
          <div>
            <div style={{ "--d": "80ms" } as CSSProperties} className="anim-fade-up inline-flex items-center gap-2 rounded-full bg-cyan-100 text-cyan-800 px-3 py-1 text-sm">
              <Sparkles size={16} />
              模拟真实技术面流程
            </div>
            <h1 style={{ "--d": "160ms" } as CSSProperties} className="anim-fade-up mt-5 text-4xl lg:text-5xl font-bold leading-tight text-slate-900">
              用一场可复盘的
              <span className="text-cyan-700"> AI 模拟面试</span>
              ，提前发现短板
            </h1>
            <p style={{ "--d": "260ms" } as CSSProperties} className="anim-fade-up mt-5 text-slate-600 max-w-2xl text-lg">
              上传简历、填写岗位 JD，系统自动发起多轮追问并生成结构化评估报告。
            </p>
            <div style={{ "--d": "340ms" } as CSSProperties} className="anim-fade-up mt-8 grid sm:grid-cols-3 gap-3">
              <div className="anim-float rounded-xl bg-white border border-slate-200 p-4 transition duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <ShieldCheck size={18} className="text-cyan-700" />
                <p className="mt-2 text-sm font-medium">实时追问</p>
                <p className="text-xs text-slate-500 mt-1">按你的回答动态追问</p>
              </div>
              <div style={{ "--d": "600ms" } as CSSProperties} className="anim-float rounded-xl bg-white border border-slate-200 p-4 transition duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <BarChart3 size={18} className="text-cyan-700" />
                <p className="mt-2 text-sm font-medium">评分报告</p>
                <p className="text-xs text-slate-500 mt-1">输出可执行优化建议</p>
              </div>
              <div style={{ "--d": "1200ms" } as CSSProperties} className="anim-float rounded-xl bg-white border border-slate-200 p-4 transition duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <Sparkles size={18} className="text-cyan-700" />
                <p className="mt-2 text-sm font-medium">快速准备</p>
                <p className="text-xs text-slate-500 mt-1">10 分钟完成一次演练</p>
              </div>
            </div>
          </div>

          <div style={{ "--d": "220ms" } as CSSProperties} className="anim-fade-up bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900">开始模拟面试</h2>
            <p className="text-slate-500 mt-2 mb-6">填写岗位信息并上传 PDF 简历</p>
            {formError && <p className="mb-4 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2">{formError}</p>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Briefcase size={18} /> 面试岗位
                </label>
                <input
                  type="text"
                  placeholder="例如：前端开发工程师"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <FileText size={18} /> 岗位需求 (JD)
                </label>
                <textarea
                  rows={4}
                  placeholder="请粘贴岗位职责和技能要求..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none transition resize-none"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">上传简历 (.pdf)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition bg-slate-50/70">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600">
                      {file ? <span className="text-cyan-700 font-semibold">{file.name}</span> : "点击或拖拽上传 PDF 简历"}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-shine w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-200"
              >
                {loading ? "正在解析简历并初始化面试..." : "开始模拟面试"}
              </button>

              {!currentUser && (
                <p className="text-xs text-slate-500">
                  提交后会先弹出登录/注册框，验证成功后自动继续。
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {successModal.open && (
        <div className="anim-fade-in fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="anim-pop-in w-full max-w-sm bg-white rounded-2xl border border-emerald-200 shadow-2xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center toast-icon-pop">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">操作成功</h3>
            <p className="mt-2 text-sm text-slate-600">{successModal.message}</p>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="anim-fade-in fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="anim-pop-in w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`px-3 py-1.5 text-sm rounded-md ${authMode === "login" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
                >
                  登录
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`px-3 py-1.5 text-sm rounded-md ${authMode === "register" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
                >
                  注册
                </button>
              </div>
              <button onClick={closeAuthModal} className="text-slate-500 hover:text-slate-800 text-sm">
                关闭
              </button>
            </div>
            {authError && <p className="mb-4 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2">{authError}</p>}
            {authSuccess && <p className="mb-4 text-sm rounded-lg bg-green-50 text-green-700 border border-green-200 px-3 py-2">{authSuccess}</p>}

            {authMode === "login" ? (
              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">密码</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3"
                >
                  {authSubmitting ? "登录中..." : "登录并继续"}
                </button>
              </form>
            ) : (
              <form onSubmit={submitRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-700 mb-2">昵称</label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="请输入昵称"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">密码</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">确认密码</label>
                  <input
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">邮箱验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={registerVerificationCode}
                      onChange={(e) => setRegisterVerificationCode(e.target.value)}
                      placeholder="请输入 6 位验证码"
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={onSendRegisterCode}
                      disabled={sendingCode || countdown > 0}
                      className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:text-slate-400 disabled:border-slate-200"
                    >
                      {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中..." : "发送验证码"}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white font-semibold py-3"
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
