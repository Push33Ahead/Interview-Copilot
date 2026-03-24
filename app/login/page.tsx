"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { fetchCurrentUser, loginUser } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg("");

    setLoading(true);
    const result = await loginUser({ email, password });
    setLoading(false);

    if (!result.ok) {
      setErrorMsg(result.message);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_flash_notice", JSON.stringify({
        text: `登录成功，欢迎回来，${result.user.name}`,
        type: "success"
      }));
    }
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-slate-800">登录账号</h1>
        <p className="text-slate-500 mt-2 mb-8">登录后即可开始 AI 模拟面试。</p>
        {errorMsg && <p className="mb-4 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2">{errorMsg}</p>}

        <form onSubmit={onSubmit} className="space-y-5">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          还没有账号？{" "}
          <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            立即注册
          </Link>
        </p>
      </div>
    </main>
  );
}
