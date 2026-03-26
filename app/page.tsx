"use client";

import Link from "next/link";
import { ArrowRight, Radar, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect } from "react";
import AuthModal from "@/app/components/AuthModal";
import { fetchCurrentUser, AuthUser } from "@/app/lib/auth";

export default function HomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string, type: "success" | "info" } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser);

    const handleToast = (e: any) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 3000);
    };

    // Listen to success directly from auth modal embedded globally or here
    const handleAuthSuccess = (e: any) => {
      if (e.detail?.name) setUser(e.detail);
    };
    window.addEventListener("auth-success", handleAuthSuccess);
    window.addEventListener("show-toast", handleToast);
    return () => {
      window.removeEventListener("show-toast", handleToast);
      window.removeEventListener("auth-success", handleAuthSuccess);
    }
  }, []);

  return (
    <main className="min-h-screen bg-black text-white selection:bg-white/30 font-sans animate-v7-fade">
      {/* Global Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-5 animate-v7-toast">
          <div className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm shadow-2xl text-black">
            {toast.type === "success" ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Info size={18} className="text-sky-500" />}
            {toast.text}
          </div>
        </div>
      )}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2 tracking-widest text-white/90">
            <Radar size={16} />
            INTERVIEW COPILOT
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-white/80 text-sm font-light hidden sm:inline-block">你好，{user.name}</span>
              <Link href="/start" className="text-white/80 transition hover:text-white font-medium flex items-center gap-1.5 bg-white/10 px-4 py-1.5 rounded-full hover:bg-white/20">
                进入控制台 <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="text-white/80 transition hover:text-white">
              登录 / 注册
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center pt-14 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,transparent_50%)] pointer-events-none blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-30 bg-[radial-gradient(circle,rgba(110,231,183,1)_0%,transparent_60%)] pointer-events-none blur-[100px] mix-blend-screen"></div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-white mb-6 leading-[1.1] anim-fade-up">
            重新定义技术面试。
          </h1>
          <p className="text-xl md:text-2xl text-white/60 font-light max-w-2xl mb-12 anim-fade-up" style={{ animationDelay: '100ms' }}>
            更聪明的 AI，呈现更真实的场景。不仅是练习，更是进化。
          </p>

          <div className="anim-fade-up" style={{ animationDelay: '200ms' }}>
            <Link href="/start" className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-8 py-4 text-lg font-medium transition hover:scale-105 active:scale-95">
              立即开始体验
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Cinematic Bottom Gradient */}
        <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-black to-transparent pointer-events-none fade-out" />
      </section>

      {/* Feature Section 1 */}
      <section className="bg-black py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 relative aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center">
            {/* Abstract visual representing dynamic logic */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="w-64 h-64 border border-white/20 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 border border-emerald-400/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-full blur-2xl opacity-40"></div>
                <div className="absolute font-mono text-sm tracking-widest text-emerald-300">DYNAMIC</div>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
              突破题库套路。<br /><span className="text-white/40">真正懂你的回答。</span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed max-w-lg font-light">
              Interview Copilot 抛弃了传统的僵化题库。它会倾听你的回答，捕捉技术细节，像资深面试官一样进行深度追问。每一次反问，都在挖掘你的真实边界。
            </p>
          </div>
        </div>
      </section>

      {/* Feature Section 2 */}
      <section className="bg-[#050505] py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
              简历与 JD 融合。<br /><span className="text-white/40">靶向诊断能力。</span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed max-w-lg font-light">
              你的经历独一无二。上传简历与目标岗位 JD，系统会根据两者之间的契合度，量身定制每一个问题，确保演练始终聚焦于最具价值的核心考点。
            </p>
          </div>
          <div className="relative aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-tr from-white/5 to-transparent border border-white/5 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0,rgba(255,255,255,0.05)_0%,transparent_50%)]"></div>
            <div className="flex flex-col gap-4 w-3/4">
              <div className="h-12 w-full bg-white/10 rounded-xl border border-white/10 flex items-center px-4">
                <div className="h-2 w-1/3 bg-white/30 rounded-full"></div>
              </div>
              <div className="h-12 w-[85%] bg-white/5 rounded-xl border border-white/5 flex items-center px-4">
                <div className="h-2 w-1/2 bg-white/20 rounded-full"></div>
              </div>
              <div className="h-24 w-full bg-sky-500/10 rounded-xl border border-sky-500/20 flex flex-col justify-center px-4 gap-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400/10 to-transparent -translate-x-[100%] animate-[shineSweep_3s_infinite]"></div>
                <div className="h-2 w-1/4 bg-sky-400/60 rounded-full"></div>
                <div className="h-2 w-3/4 bg-sky-400/40 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 3 */}
      <section className="bg-black py-40 px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-white">
            不留遗憾的评估复盘。
          </h2>
          <p className="text-xl text-white/50 font-light">
            我们不仅给出一个分数。我们为你拆解每一题的表现，指出思维盲区，并提供高分参考范例，让你的能力在每一次复盘中得到实质性跃迁。
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-black py-32 px-6 border-t border-white/10">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
            准备好迎接下一次面试了吗？
          </h2>
          {user ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-xl text-white/50 font-light">你好，{user.name}，控制台已经为您准备就绪。</p>
              <Link href="/start" className="inline-flex items-center justify-center rounded-full bg-white text-black px-10 py-5 text-xl font-medium transition hover:scale-105">
                立刻开始 <ArrowRight size={20} className="ml-2" />
              </Link>
            </div>
          ) : (
            <div className="pt-2">
              <Link href="/start" className="inline-flex items-center justify-center rounded-full bg-white text-black px-10 py-5 text-xl font-medium transition hover:scale-105 relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                <span className="relative z-10 group-hover:text-white transition-colors">登录系统并启航</span>
                <ArrowRight size={20} className="relative z-10 ml-2 group-hover:text-white transition-colors" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => { window.location.href = "/start"; }}
      />
    </main>
  );
}
