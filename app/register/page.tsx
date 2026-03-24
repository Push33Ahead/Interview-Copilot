"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { fetchCurrentUser, registerUser, sendRegisterCode } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await fetchCurrentUser();
      if (active && current) router.replace("/");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const onSendCode = async () => {
    if (sendingCode || countdown > 0) return;
    setErrorMsg("");
    setSuccessMsg("");
    if (!email.trim()) {
      setErrorMsg("请先输入邮箱");
      return;
    }
    setSendingCode(true);
    const result = await sendRegisterCode(email);
    setSendingCode(false);
    if (!result.ok) {
      setErrorMsg(result.message);
      return;
    }
    setCountdown(60);
    setSuccessMsg("验证码已发送，请检查邮箱");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("两次密码输入不一致");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("请输入昵称");
      return;
    }
    if (!verificationCode.trim()) {
      setErrorMsg("请输入邮箱验证码");
      return;
    }

    setLoading(true);
    const result = await registerUser({ name, email, password, verificationCode });
    setLoading(false);

    if (!result.ok) {
      setErrorMsg(result.message);
      return;
    }

    setSuccessMsg("注册成功，正在跳转登录...");
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800">注册账号</h1>
        <p className="text-slate-500 mt-2 mb-8">创建账号后即可开始模拟面试。</p>
        {errorMsg && <p className="mb-4 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2">{errorMsg}</p>}
        {successMsg && <p className="mb-4 text-sm rounded-lg bg-green-50 text-green-700 border border-green-200 px-3 py-2">{successMsg}</p>}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-700 mb-2">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入昵称"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2">邮箱验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="请输入 6 位验证码"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={onSendCode}
                disabled={sendingCode || countdown > 0}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:text-slate-400 disabled:border-slate-200"
              >
                {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中..." : "发送验证码"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-700 mb-2">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          已有账号？{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            去登录
          </Link>
        </p>
      </div>
    </main>
  );
}
