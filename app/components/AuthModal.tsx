"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { loginUser, registerUser, sendRegisterCode, AuthUser } from "@/app/lib/auth";

type AuthMode = "login" | "register";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerVerificationCode, setRegisterVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (isOpen) {
      setAuthError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setAuthError("");
    setAuthSubmitting(true);
    const result = await loginUser({ email: loginEmail, password: loginPassword });
    setAuthSubmitting(false);
    if (!result.ok) {
      setAuthError(result.message);
      return;
    }
    
    // Dispatch global success toast
    window.dispatchEvent(new CustomEvent("show-toast", { 
      detail: { text: `登录成功，欢迎回来 ${result.user.name}`, type: "success" } 
    }));
    
    onSuccess(result.user);
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setAuthError("");
    if (registerPassword !== registerConfirmPassword) return setAuthError("两次密码输入不一致");
    setAuthSubmitting(true);
    const result = await registerUser({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
      verificationCode: registerVerificationCode,
    });
    setAuthSubmitting(false);
    if (!result.ok) return setAuthError(result.message);
    setAuthMode("login");
    setLoginEmail(registerEmail);
    setLoginPassword("");
    setAuthError("注册成功，请登录");
  };

  const onSendRegisterCode = async () => {
    if (sendingCode || countdown > 0) return;
    setAuthError("");
    if (!registerEmail.trim()) return setAuthError("请先输入邮箱");
    setSendingCode(true);
    const result = await sendRegisterCode(registerEmail);
    setSendingCode(false);
    if (!result.ok) return setAuthError(result.message);
    setCountdown(60);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-v7-fade">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl relative animate-v7-modal text-slate-900 font-sans">
        <button
          onClick={() => !authSubmitting && onClose()}
          className="absolute top-6 right-6 text-sm text-slate-400 hover:text-slate-900 transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-2xl font-semibold text-slate-900 mb-6 tracking-tight">
          {authMode === "login" ? "欢迎回来" : "创建账号"}
        </h3>

        {authError && (
          <p className="mb-6 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600 border border-red-100">{authError}</p>
        )}

        {authMode === "login" ? (
          <form onSubmit={submitLogin} className="space-y-4">
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="邮箱" required className="w-full rounded-xl bg-slate-50 px-4 py-3.5 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="密码" required className="w-full rounded-xl bg-slate-50 px-4 py-3.5 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <button type="submit" disabled={authSubmitting} className="w-full mt-2 rounded-xl bg-black py-4 text-[15px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {authSubmitting ? "处理中..." : "登录系统"}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setAuthMode("register"); setAuthError(""); }} className="text-sm font-medium text-slate-500 hover:text-black transition">
                没有账号？点击注册
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="space-y-4">
            <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="昵称" required className="w-full rounded-xl bg-slate-50 px-4 py-3 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <input type="email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="邮箱" required className="w-full rounded-xl bg-slate-50 px-4 py-3 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <div className="flex gap-2">
              <input type="text" value={registerVerificationCode} onChange={(e) => setRegisterVerificationCode(e.target.value)} placeholder="验证码" required className="flex-1 min-w-0 rounded-xl bg-slate-50 px-4 py-3 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
              <button type="button" onClick={onSendRegisterCode} disabled={sendingCode || countdown > 0} className="shrink-0 rounded-xl bg-slate-100 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50">
                {countdown > 0 ? `${countdown}s` : sendingCode ? "..." : "获取"}
              </button>
            </div>
            <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="密码" required className="w-full rounded-xl bg-slate-50 px-4 py-3 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <input type="password" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)} placeholder="确认密码" required className="w-full rounded-xl bg-slate-50 px-4 py-3 text-[15px] outline-none transition-all ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-black" />
            <button type="submit" disabled={authSubmitting} className="w-full mt-2 rounded-xl bg-black py-4 text-[15px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {authSubmitting ? "处理中..." : "注册并验证"}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }} className="text-sm font-medium text-slate-500 hover:text-black transition">
                已有账号？点击登录
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
