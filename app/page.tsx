import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Radar, ShieldCheck, Sparkles, Workflow, FileBadge2, LineChart, MessageSquareText } from "lucide-react";

const quickStats = [
  { value: "15", label: "最多追问轮数" },
  { value: "10min", label: "一次完整模拟" },
  { value: "4", label: "维度评估输出" },
];

const pillars = [
  {
    icon: MessageSquareText,
    title: "动态追问",
    desc: "根据你的每轮回答实时追问，避免固定题库的套路化练习。",
  },
  {
    icon: LineChart,
    title: "结构化反馈",
    desc: "给出评分、薄弱点拆解和可执行改进建议，不只给一句评价。",
  },
  {
    icon: FileBadge2,
    title: "简历联动",
    desc: "结合岗位 JD 与简历内容评估回答贴合度，提前暴露风险项。",
  },
];

const flow = [
  { step: "01", title: "上传简历", text: "提交 PDF 简历并填写岗位 JD。" },
  { step: "02", title: "开始模拟", text: "AI 面试官进入多轮技术追问。" },
  { step: "03", title: "查看报告", text: "生成可复盘的评估和优化建议。" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f3f4f6] text-slate-900 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(120,143,255,0.24)_0%,_rgba(120,143,255,0)_64%)]" />
        <div style={{ "--d": "600ms" } as CSSProperties} className="anim-float absolute right-[-10rem] top-[18rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.20)_0%,_rgba(56,189,248,0)_68%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-slate-800">
            <Radar size={16} className="text-sky-600" />
            Interview Copilot
          </div>
          <Link href="/start" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
            开始模拟
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div style={{ "--d": "120ms" } as CSSProperties} className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            <Sparkles size={14} className="text-sky-600" />
            Interview Training Platform
          </div>

          <h1 style={{ "--d": "200ms" } as CSSProperties} className="anim-fade-up mt-6 text-4xl font-semibold leading-tight sm:text-6xl">
            把每次模拟面试，
            <br />
            做成可进化的能力系统。
          </h1>

          <p style={{ "--d": "280ms" } as CSSProperties} className="anim-fade-up mt-6 max-w-xl text-base text-slate-600 sm:text-lg">
            Interview Copilot 用真实面试节奏训练表达、深挖技术细节，并输出结构化复盘报告，
            让你在真正面试前，先完成一次高质量预演。
          </p>

          <div style={{ "--d": "360ms" } as CSSProperties} className="anim-fade-up mt-8 flex flex-wrap items-center gap-3">
            <Link href="/start" className="btn-shine inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700">
              进入模拟入口
              <ArrowRight size={15} />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              了解流程
            </a>
          </div>
        </div>

        <div style={{ "--d": "260ms" } as CSSProperties} className="anim-fade-up relative">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-700 p-5 text-white">
              <p className="text-xs text-slate-300">Live Interview Session</p>
              <p className="mt-2 text-lg font-medium">后端工程师 · 深度追问模式</p>
              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3">Q: 解释一下你在高并发场景下的缓存一致性方案。</div>
                <div className="rounded-xl bg-sky-400/20 p-3">A: 使用延时双删 + 消息队列兜底，按业务容忍度做最终一致。</div>
                <div className="rounded-xl bg-white/10 p-3">追问: 如果 Redis 故障切换期间发生写入，如何避免脏读？</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:p-7">
          {quickStats.map((item, idx) => (
            <div key={item.label} style={{ "--d": `${120 + idx * 120}ms` } as CSSProperties} className="anim-fade-up rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
              <p className="text-3xl font-semibold text-slate-900">{item.value}</p>
              <p className="mt-1 text-sm text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-8 flex items-center gap-2 text-slate-500">
          <ShieldCheck size={16} />
          <span className="text-sm">核心能力</span>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <article key={item.title} style={{ "--d": `${180 + idx * 120}ms` } as CSSProperties} className="anim-fade-up group rounded-3xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                <div className="inline-flex rounded-xl bg-slate-900 p-2 text-white">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white sm:p-10">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Workflow size={16} />
            使用流程
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {flow.map((item, idx) => (
              <div key={item.step} style={{ "--d": `${200 + idx * 120}ms` } as CSSProperties} className="anim-fade-up rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="text-xs text-slate-300">STEP {item.step}</p>
                <h3 className="mt-2 text-lg font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/start" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200">
              现在开始模拟
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
