"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Loader2, Sparkles, X, CheckCircle2, Info } from "lucide-react";
import axios from "axios";
import { AuthUser, buildAuthHeaders, fetchCurrentUser } from "@/app/lib/auth";
import { API_BASE_URL } from "@/app/lib/api";

type TopNotice = { id: number; text: string; type: "success" | "info" } | null;

export default function StartPage() {
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [formError, setFormError] = useState("");
  const [topNotice, setTopNotice] = useState<TopNotice>(null);

  const pendingStartRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (!active) return;
      setCurrentUser(user);
      setAuthChecked(true);
    });

    const onAuthSuccess = (e: any) => {
      setCurrentUser(e.detail);
      if (pendingStartRef.current) {
        pendingStartRef.current = false;
        // Small delay to ensure state and modal logic clear
        setTimeout(() => triggerStart(e.detail), 300);
      }
    };
    window.addEventListener("auth-success", onAuthSuccess);

    return () => {
      active = false;
      window.removeEventListener("auth-success", onAuthSuccess);
    };
  }, []);

  const isFormValid = useMemo(() => {
    return !!jobTitle.trim() && !!jobDescription.trim() && !!file;
  }, [jobTitle, jobDescription, file]);

  const showNotice = (text: string, type: "success" | "info" = "info", duration = 2000) => {
    const id = Date.now();
    setTopNotice({ id, text, type });
    setTimeout(() => {
      setTopNotice((prev) => (prev?.id === id ? null : prev));
    }, duration);
  };

  const triggerStart = async (user?: AuthUser | null) => {
    setFormError("");
    if (!isFormValid) {
      showNotice("请填写完整岗位信息并上传简历", "info");
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
      setFormError(`初始化失败：${response.data?.message || "服务异常"}`);
    } catch (error: any) {
      setFormError(`初始化失败：${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!isFormValid) {
      showNotice("需提供岗位名称、JD 及 PDF 简历", "info");
      return;
    }
    if (!currentUser) {
      pendingStartRef.current = true;
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }
    await triggerStart();
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  if (!authChecked) {
    return (
      <main className="h-full flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin text-slate-300" size={32} />
      </main>
    );
  }

  return (
    <main className="h-full overflow-y-auto text-slate-900 relative flex flex-col items-center pt-[15vh] px-4 font-sans selection:bg-black selection:text-white animate-v7-fade" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
      {/* Vivid Ambient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[5%] right-[5%] w-[50%] h-[40%] rounded-full bg-gradient-to-b from-indigo-200/50 via-sky-200/20 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "9s" }} />
        <div className="absolute bottom-[5%] left-[0%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-cyan-200/40 via-teal-200/15 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "11s" }} />
      </div>
      {topNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-5 animate-v7-toast">
          <div className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3.5 text-sm shadow-2xl text-white">
            {topNotice.type === "success" ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Info size={18} className="text-sky-400" />}
            {topNotice.text}
          </div>
        </div>
      )}

      {/* Hero Greeting */}
      <div className="text-center mb-10 w-full max-w-3xl">
        <h1 className="text-4xl md:text-[2.75rem] font-semibold tracking-tight text-slate-900 mb-4 inline-flex items-center justify-center gap-3 w-full">
          准备好面试了吗？
        </h1>
        <p className="text-lg md:text-xl text-slate-500 font-light max-w-lg mx-auto leading-relaxed">
          描述你的理想工作，附上简历，<br className="hidden sm:block" />我们帮你拿下面试。
        </p>
      </div>

      {/* AI Command Center Input */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 p-2 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.1)] focus-within:shadow-[0_8px_40px_rgb(0,0,0,0.1)] focus-within:border-slate-300 group">
        <div className="p-3 sm:p-5 flex flex-col gap-4">
          
          {/* Job Title Input */}
          <input
            type="text"
            placeholder="岗位名称 ( 例如：高级系统架构师 )"
            className="w-full bg-transparent text-xl md:text-2xl font-medium text-slate-900 placeholder:text-slate-300 outline-none border-0 px-2 tracking-tight transition-all"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />

          <div className="h-px w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 my-1 rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>

          {/* JD Input */}
          <textarea
            rows={1}
            placeholder="粘贴对应的职位描述 (JD)，以便 AI 考官量身定制面试策略..."
            className="w-full bg-transparent text-base md:text-[17px] text-slate-700 placeholder:text-slate-400 outline-none border-0 px-2 resize-none min-h-[50px] max-h-[40vh] leading-relaxed overflow-hidden transition-all"
            value={jobDescription}
            onChange={autoResize}
            style={{ minHeight: '50px' }}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:px-4 sm:pb-3 mt-4 gap-4">
          {/* Left Attachment Area */}
          <div className="w-full sm:w-auto">
            <input
              type="file"
              id="resume-upload"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected && selected.type !== "application/pdf") {
                  showNotice("仅支持上传 PDF 格式简历", "info");
                } else {
                  setFile(selected || null);
                }
              }}
            />
            {file ? (
              <div className="inline-flex items-center gap-2 bg-slate-50 text-slate-800 px-4 py-2 rounded-full text-sm font-medium border border-slate-200/60 shadow-sm max-w-full">
                <Paperclip size={16} className="text-slate-500 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-xs">{file.name}</span>
                <button onClick={() => setFile(null)} className="ml-1 text-slate-400 hover:text-slate-700 rounded-full p-0.5 hover:bg-slate-200 transition shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label
                htmlFor="resume-upload"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 cursor-pointer transition px-4 py-2 rounded-full hover:bg-slate-50 font-medium"
              >
                <Paperclip size={18} />
                <span className="text-sm hidden sm:inline">附加简历 (PDF)</span>
                <span className="text-sm sm:hidden">附加简历</span>
              </label>
            )}
          </div>

          {/* Right Action Area */}
          <button
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-3.5 sm:py-3 rounded-full font-medium transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 shadow-lg shadow-black/10"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} className={isFormValid ? "text-white" : "text-white/50"} />
            )}
            <span className="text-[15px]">{loading ? "初始化中..." : "开启模拟"}</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="mt-8 animate-v7-modal">
           <p className="text-red-500 text-sm flex items-center gap-1.5 bg-red-50 px-5 py-2.5 rounded-full border border-red-100 font-medium shadow-sm">
             <Info size={16} /> {formError}
           </p>
        </div>
      )}

      {/* Contextual Hints */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-3 text-slate-400 text-sm max-w-2xl px-4 font-medium tracking-wide">
        <span className="inline-flex items-center gap-1.5 text-slate-500"><Sparkles size={14} /> 纯动态追问架构</span>
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>深度简历解析</span>
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>专业评估打分</span>
      </div>
    </main>
  );
}
