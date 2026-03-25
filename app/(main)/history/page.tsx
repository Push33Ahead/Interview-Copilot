"use client";

import { useEffect, useState } from "react";
import { Clock3, BarChart3, Loader2, ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { fetchMyReports, deleteReport, type ReportHistoryItem } from "@/app/lib/auth";

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [msg, setMsg] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    
    const res = await deleteReport(id);
    setDeletingId(null);
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== id));
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "记录已永久删除" } }));
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: res.message } }));
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setConfirmDeleteId(id);
  };

  useEffect(() => {
    let active = true;
    fetchMyReports().then(res => {
      if (!active) return;
      if (res.ok) setReports(res.reports);
      else {
        if (res.message?.includes("Authorization") || res.message?.includes("不在")) {
           setMsg("请先登录以查看您的面试历史记录。");
        } else {
           setMsg(res.message);
        }
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <main className="h-full bg-[#FAFAFA] flex flex-col gap-4 items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-sm font-medium">正在加载历史记录...</span>
      </main>
    );
  }

  return (
    <main className="h-full overflow-y-auto bg-[#FAFAFA] text-slate-900 py-16 px-6 lg:px-12 animate-v7-fade">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">面试历史</h1>
          <p className="text-sm text-slate-500">所有的历史模拟面试评估均保存在此，温故而知新。</p>
        </header>

        {msg && <p className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3">{msg}</p>}

        {msg.includes("登录") ? (
          <div className="text-center py-24 border border-slate-200 border-dashed rounded-3xl bg-white shadow-sm flex flex-col items-center">
            <p className="text-slate-500 font-medium tracking-wide">访问被拒绝</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">您需要登录系统才能查看您的专属面试记录</p>
            <button onClick={() => window.dispatchEvent(new CustomEvent("open-auth-modal"))} className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              去登录系统
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-24 border border-slate-200 border-dashed rounded-3xl bg-white shadow-sm flex flex-col items-center">
            <p className="text-slate-500 font-medium tracking-wide">还没有任何纪录</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">先去完成一场模拟面试吧</p>
            <Link href="/start" className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              去开启新面试 <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {reports.map((r) => (
              <Link key={r.id} href={`/report?id=${r.id}`} className="group relative border border-slate-200 rounded-[2rem] p-6 bg-white hover:shadow-2xl hover:shadow-sky-500/10 hover:border-sky-200 transition-all cursor-pointer overflow-hidden flex flex-col">
                <p className="font-semibold text-[17px] text-slate-900 mb-2 truncate group-hover:text-sky-600 transition-colors z-10">{r.job_title || "未命名岗位"}</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-6 line-clamp-2 z-10 flex-1">{r.overall_summary || "暂无评估总结"}</p>
                
                <div className="flex items-center justify-between border-t border-slate-100 pt-5 z-10">
                  <span className="inline-flex items-center gap-1.5 text-sky-700 font-semibold bg-sky-50 px-3 py-1.5 rounded-full text-xs transition group-hover:bg-sky-100">
                    <BarChart3 size={14} /> {r.score} 分
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Clock3 size={13} /> {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  <button 
                    onClick={(e) => handleDeleteClick(e, r.id)}
                    disabled={deletingId === r.id}
                    className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="删除记录"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-v7-fade">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-v7-modal">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">删除面试记录</h3>
              <p className="text-sm text-slate-500 mb-6">确定要永久删除这条档案吗？删除后将无法恢复。</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition"
                >
                  取消
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition shadow-sm shadow-red-500/20"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
