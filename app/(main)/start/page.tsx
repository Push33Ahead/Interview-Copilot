"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Loader2, Sparkles, X, CheckCircle2, Info, Building2, GraduationCap } from "lucide-react";
import axios from "axios";
import { AuthUser, buildAuthHeaders, fetchCurrentUser, initInterview, InterviewType } from "@/app/lib/auth";
import { API_BASE_URL } from "@/app/lib/api";

type TopNotice = { id: number; text: string; type: "success" | "info" } | null;

export default function StartPage() {
  const router = useRouter();

  // 面试类型
  const [interviewType, setInterviewType] = useState<InterviewType>("enterprise");

  // 企业面试字段
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // 考研面试字段
  const [schoolName, setSchoolName] = useState("");
  const [majorName, setMajorName] = useState("");

  // 共同字段
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
        setTimeout(() => triggerStart(e.detail), 300);
      }
    };
    window.addEventListener("auth-success", onAuthSuccess);

    return () => {
      active = false;
      window.removeEventListener("auth-success", onAuthSuccess);
    };
  }, []);

  // 表单验证
  const isFormValid = useMemo(() => {
    const hasResume = !!file;
    if (interviewType === "enterprise") {
      return !!companyName.trim() && !!jobTitle.trim() && !!jobDescription.trim() && hasResume;
    } else {
      return !!schoolName.trim() && !!majorName.trim() && hasResume;
    }
  }, [interviewType, companyName, jobTitle, jobDescription, schoolName, majorName, file]);

  // 类型切换时清空表单
  const handleTypeChange = (type: InterviewType) => {
    setInterviewType(type);
    setFormError("");
    // 清空对方类型的字段
    if (type === "enterprise") {
      setSchoolName("");
      setMajorName("");
    } else {
      setCompanyName("");
      setJobTitle("");
      setJobDescription("");
    }
  };

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
      showNotice("请填写完整信息并上传简历", "info");
      return;
    }

    setLoading(true);

    try {
      const result = await initInterview({
        interviewType,
        resume: file!,
        // 企业面试
        companyName: interviewType === "enterprise" ? companyName : undefined,
        jobTitle: interviewType === "enterprise" ? jobTitle : undefined,
        jobDescription: interviewType === "enterprise" ? jobDescription : undefined,
        // 考研面试
        schoolName: interviewType === "postgraduate" ? schoolName : undefined,
        majorName: interviewType === "postgraduate" ? majorName : undefined,
      });

      if (result.ok) {
        localStorage.setItem("interview_session_id", result.sessionId);
        localStorage.setItem("first_question", result.firstQuestion);
        localStorage.setItem("interview_type", interviewType);
        router.push("/chat");
        return;
      }
      setFormError(result.message);
    } catch (error: any) {
      const errorMsg = error?.message || String(error) || "服务异常";
      setFormError(`初始化失败：${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!isFormValid) {
      showNotice("请填写完整信息并上传简历", "info");
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
    <main className="h-full overflow-y-auto text-slate-900 relative flex flex-col items-center pt-[12vh] px-4 font-sans selection:bg-black selection:text-white animate-v7-fade" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
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
      <div className="text-center mb-8 w-full max-w-3xl">
        <h1 className="text-4xl md:text-[2.75rem] font-semibold tracking-tight text-slate-900 mb-4 inline-flex items-center justify-center gap-3 w-full">
          准备好面试了吗？
        </h1>
        <p className="text-lg md:text-xl text-slate-500 font-light max-w-lg mx-auto leading-relaxed">
          选择面试类型，填写相关信息，我们帮你拿下面试。
        </p>
      </div>

      {/* Interview Type Selector */}
      <div className="w-full max-w-3xl mb-6">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-1.5 shadow-sm border border-slate-200/60 inline-flex">
          <button
            onClick={() => handleTypeChange("enterprise")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              interviewType === "enterprise"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Building2 size={18} />
            企业面试
          </button>
          <button
            onClick={() => handleTypeChange("postgraduate")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              interviewType === "postgraduate"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <GraduationCap size={18} />
            考研面试
          </button>
        </div>
      </div>

      {/* AI Command Center Input */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 p-2 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.1)] focus-within:shadow-[0_8px_40px_rgb(0,0,0,0.1)] focus-within:border-slate-300 group">
        <div className="p-3 sm:p-5 flex flex-col gap-4">
          
          {interviewType === "enterprise" ? (
            // 企业面试表单
            <>
              <input
                type="text"
                placeholder="企业名称 (例如：字节跳动、阿里巴巴)"
                className="w-full bg-transparent text-xl md:text-2xl font-medium text-slate-900 placeholder:text-slate-300 outline-none border-0 px-2 tracking-tight transition-all"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <div className="h-px w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 my-1 rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>

              <input
                type="text"
                placeholder="岗位名称 (例如：高级前端工程师)"
                className="w-full bg-transparent text-lg md:text-xl font-medium text-slate-900 placeholder:text-slate-300 outline-none border-0 px-2 tracking-tight transition-all"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />

              <div className="h-px w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 my-1 rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>

              <textarea
                rows={1}
                placeholder="粘贴对应的职位描述 (JD)，以便 AI 考官量身定制面试策略..."
                className="w-full bg-transparent text-base md:text-[17px] text-slate-700 placeholder:text-slate-400 outline-none border-0 px-2 resize-none min-h-[50px] max-h-[40vh] leading-relaxed overflow-hidden transition-all"
                value={jobDescription}
                onChange={autoResize}
                style={{ minHeight: '50px' }}
              />
            </>
          ) : (
            // 考研面试表单
            <>
              <input
                type="text"
                placeholder="学校名称 (例如：清华大学、北京大学)"
                className="w-full bg-transparent text-xl md:text-2xl font-medium text-slate-900 placeholder:text-slate-300 outline-none border-0 px-2 tracking-tight transition-all"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />

              <div className="h-px w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 my-1 rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>

              <input
                type="text"
                placeholder="专业名称 (例如：计算机科学与技术)"
                className="w-full bg-transparent text-lg md:text-xl font-medium text-slate-900 placeholder:text-slate-300 outline-none border-0 px-2 tracking-tight transition-all"
                value={majorName}
                onChange={(e) => setMajorName(e.target.value)}
              />

              <div className="h-px w-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 my-1 rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>

              <div className="px-2 py-3 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 leading-relaxed">
                  💡 考研面试将重点考察：专业基础知识、科研潜力、学术兴趣、学习能力和研究生规划。
                </p>
              </div>
            </>
          )}
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
        <span>智能面经推荐</span>
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        <span>专业评估打分</span>
      </div>
    </main>
  );
}
