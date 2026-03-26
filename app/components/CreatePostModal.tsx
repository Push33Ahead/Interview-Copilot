"use client";

import { useState } from "react";
import { X, SendHorizontal, Building2, Briefcase } from "lucide-react";
import { createPost } from "@/app/lib/auth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onSuccess }: Props) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!company.trim() || !role.trim() || !content.trim()) {
      setMsg("公司、岗位及面经内容为必填项");
      return;
    }

    setSubmitting(true);
    setMsg("");
    
    // Extract max 5 tags
    const tags = tagsText
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    const res = await createPost({
      company,
      role,
      content,
      tags
    });

    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.message || "发帖失败");
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "面经发布成功！" } }));
      setCompany("");
      setRole("");
      setContent("");
      setTagsText("");
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-v7-fade">
      <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-v7-modal flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            🚀 撰写经验分享 / 记录面经
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-1.5 ml-1">
                <Building2 size={14} /> 面试公司
              </label>
              <input 
                value={company} 
                onChange={e => setCompany(e.target.value)}
                placeholder="如：腾讯、字节跳动、Apple" 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-1.5 ml-1">
                <Briefcase size={14} /> 面试岗位
              </label>
              <input 
                value={role} 
                onChange={e => setRole(e.target.value)}
                placeholder="如：前端架构师、高级产品经理" 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
              />
            </div>
          </div>

          <div className="space-y-1 mt-2">
            <label className="text-sm font-medium text-slate-600 ml-1">
              详细面经 / 问题记录
            </label>
            <textarea 
              rows={10}
              value={content} 
              onChange={e => setContent(e.target.value)}
              placeholder="分享面试流程、遇到的技术问题、算法题，或者你总结的经验教训..." 
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600 ml-1">
              标签集合 (最多5个，空格分隔)
            </label>
            <input 
              value={tagsText} 
              onChange={e => setTagsText(e.target.value)}
              placeholder="如：校招 前端 React 大厂" 
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" 
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-red-500 text-sm font-medium">{msg}</span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-black px-8 py-3 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50 hover:shadow-lg hover:shadow-black/20"
          >
            {submitting ? "正在发布..." : "立刻发布"}
            <SendHorizontal size={16} className={submitting ? "animate-pulse" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
