"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Suspense } from "react";
import { buildAuthHeaders, fetchCurrentUser } from "@/app/lib/auth";
import { API_BASE_URL } from "@/app/lib/api";

interface ReportData {
  score: number;
  overall_summary: string;
  answer_improvements: {
    question: string;
    user_answer: string;
    suggestion: string;
    good_example: string;
  }[];
  resume_optimizations: string[];
}

function extractDetailText(detailRaw: unknown): string {
  if (typeof detailRaw === "string") return detailRaw.trim();
  if (detailRaw && typeof detailRaw === "object" && "message" in detailRaw) {
    const v = (detailRaw as { message?: unknown }).message;
    if (typeof v === "string") return v.trim();
  }
  return "";
}

function getEvaluateErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "生成报告失败，请稍后重试";

  const status = error.response?.status;
  const detailRaw = error.response?.data?.detail ?? error.response?.data?.message;
  const detail = extractDetailText(detailRaw);

  if (!status && error.message === "Network Error") {
    return "网络错误：请求未到达后端（常见于 HTTP/HTTPS 混用、CORS 或后端不可达）。";
  }
  if (status === 404) {
    return "评估会话不存在或已过期（默认 2 小时），请返回首页重新开始面试。";
  }
  if (status === 408 || error.code === "ECONNABORTED") {
    return "评估请求超时，请重试。";
  }
  if (status === 500 && detail) {
    return `评估服务异常：${detail}`;
  }
  if (status && detail) {
    return `生成失败（HTTP ${status}）：${detail}`;
  }
  if (status) {
    return `生成失败（HTTP ${status}），请稍后重试`;
  }
  if (detail) {
    return `生成失败：${detail}`;
  }
  return "生成报告失败，请稍后重试";
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authCheckFailed, setAuthCheckFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchReport = async () => {
      const current = await Promise.race([
        fetchCurrentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

      if (!current) {
        setAuthCheckFailed(true);
        setErrorMsg("登录状态校验失败或超时，请重试");
        setLoading(false);
        setAuthChecked(true);
        return;
      }
      setAuthChecked(true);

      const sessionId = localStorage.getItem("interview_session_id");
      if (!urlId && !sessionId) {
        setErrorMsg("找不到面试会话记录，请前往「新面试」发起");
        setLoading(false);
        return;
      }

      try {
        const requestOnce = () => {
          if (urlId) {
            return axios.get(`${API_BASE_URL}/api/reports/${urlId}`, {
              signal: controller.signal, timeout: 15000, headers: buildAuthHeaders()
            });
          }
          return axios.post(
            `${API_BASE_URL}/api/evaluate`,
            { session_id: sessionId },
            { signal: controller.signal, timeout: 180000, headers: buildAuthHeaders() }
          );
        };

        let response;
        try {
          response = await requestOnce();
        } catch (firstErr) {
          const first = firstErr as { code?: string; name?: string };
          const canceled =
            first?.code === "ERR_CANCELED" || first?.name === "CanceledError";
          if (canceled) throw firstErr;
          await new Promise((resolve) => setTimeout(resolve, 1200));
          response = await requestOnce();
        }

        if (!isActive) return;

        if (response?.data?.code === 200) {
          const payload = response.data.data;
          const actualReport = payload.report ? payload.report : payload;
          setReport(actualReport);
          if (!urlId) {
            // Prevent duplicated evaluations by clearing active session
            localStorage.removeItem("interview_session_id");
            localStorage.removeItem("first_question");
          }
        } else {
          const detailRaw = response?.data?.detail ?? response?.data?.message;
          const detail = extractDetailText(detailRaw);
          setErrorMsg(detail ? `生成失败：${detail}` : "生成报告失败，请稍后重试");
        }
      } catch (error) {
        if (!isActive) return;
        const maybeError = error as { code?: string; name?: string };
        const isCanceled =
          maybeError?.code === "ERR_CANCELED" || maybeError?.name === "CanceledError";
        if (isCanceled) return;

        console.error("evaluate error:", error);
        setErrorMsg(getEvaluateErrorMessage(error));
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchReport();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [router]);

  if (!authChecked && loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-cyan-500 animate-spin"></div>
          <span className="text-sm font-medium">正在检查登录状态...</span>
        </div>
      </div>
    );
  }

  if (authCheckFailed) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">无法校验登录状态</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">正在生成深度评估报告</h2>
        <p className="text-slate-400 mt-2 text-sm">AI 正在综合评估你的回答与简历，预计需要 15 秒左右...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">暂时无法展示报告</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg || "暂无面试评估报告。"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-10 px-6 lg:px-12 relative animate-v7-fade" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[5%] right-[5%] w-[50%] h-[40%] rounded-full bg-gradient-to-b from-indigo-200/45 via-sky-200/15 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "9s" }} />
        <div className="absolute bottom-[5%] left-[0%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-cyan-200/35 via-teal-200/10 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "11s" }} />
      </div>
      <div className="space-y-8 relative z-10">
        <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">面试评估报告</h1>
          <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 border-blue-500">
            <span className="text-4xl font-black text-blue-600">
              {report.score}
              <span className="text-xl">分</span>
            </span>
          </div>
          <p className="text-gray-700 text-lg">{report.overall_summary}</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" /> 简历优化建议
          </h2>
          <ul className="space-y-3">
            {report.resume_optimizations.map((opt, idx) => (
              <li key={idx} className="bg-orange-50 text-orange-800 p-4 rounded-lg text-sm">
                {opt}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <CheckCircle className="text-emerald-500" /> 逐题回答复盘
          </h2>
          <div className="space-y-6">
            {report.answer_improvements.map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-6 bg-gray-50">
                <p className="font-semibold text-gray-800 mb-2">Q: {item.question}</p>
                <p className="text-gray-600 text-sm mb-4">你的回答: {item.user_answer}</p>
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-2 border border-red-100">
                  <strong>存在问题：</strong>
                  {item.suggestion}
                </div>
                <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-100">
                  <strong>高分示范：</strong>
                  {item.good_example}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pb-10">
          <button
            onClick={() => router.push("/start")}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl shadow-md transition"
          >
            开启一场新面试
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="h-full bg-slate-50 flex items-center justify-center text-slate-500 animate-v7-fade">加载中...</div>}>
      <ReportContent />
    </Suspense>
  );
}

