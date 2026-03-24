<<<<<<< HEAD
"use client";
=======
﻿"use client";

>>>>>>> master
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
<<<<<<< HEAD
import { fetchCurrentUser } from "../lib/auth";

// 🔴 请替换为你真实的服务器 IP
const API_BASE_URL = "http://121.41.208.145:8000";

// 定义后端返回的报告格式类型
interface ReportData {
  score: number;
  overall_summary: string;
  answer_improvements: { question: string; user_answer: string; suggestion: string; good_example: string }[];
  resume_optimizations: string[];
}

=======
import { buildAuthHeaders, fetchCurrentUser } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

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

>>>>>>> master
export default function ReportPage() {
  const router = useRouter();
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
<<<<<<< HEAD
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000))
      ]);
=======
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

>>>>>>> master
      if (!current) {
        setAuthCheckFailed(true);
        setErrorMsg("登录状态校验失败或超时，请重试");
        setLoading(false);
        setAuthChecked(true);
        return;
      }
      setAuthChecked(true);

      const sessionId = localStorage.getItem("interview_session_id");
      if (!sessionId) {
<<<<<<< HEAD
        setErrorMsg("找不到面试记录");
=======
        setErrorMsg("找不到面试会话记录，请返回首页重新开始");
>>>>>>> master
        router.push("/");
        setLoading(false);
        return;
      }

      try {
<<<<<<< HEAD
        // 评估接口可能耗时较长：提高超时，并在网络错误时重试一次
        const requestOnce = () => axios.post(`${API_BASE_URL}/api/evaluate`, {
          session_id: sessionId
        }, {
          signal: controller.signal,
          timeout: 180000
        });
=======
        const requestOnce = () =>
          axios.post(
            `${API_BASE_URL}/api/evaluate`,
            { session_id: sessionId },
            { signal: controller.signal, timeout: 180000, headers: buildAuthHeaders() }
          );

>>>>>>> master
        let response;
        try {
          response = await requestOnce();
        } catch (firstErr) {
          const first = firstErr as { code?: string; name?: string };
<<<<<<< HEAD
          const canceled = first?.code === "ERR_CANCELED" || first?.name === "CanceledError";
=======
          const canceled =
            first?.code === "ERR_CANCELED" || first?.name === "CanceledError";
>>>>>>> master
          if (canceled) throw firstErr;
          await new Promise((resolve) => setTimeout(resolve, 1200));
          response = await requestOnce();
        }

        if (!isActive) return;
<<<<<<< HEAD
        
        if (response?.data?.code === 200) {
          setReport(response.data.data);
        } else {
          setErrorMsg("生成报告失败，请稍后重试");
=======

        if (response?.data?.code === 200) {
          setReport(response.data.data);
        } else {
          const detailRaw = response?.data?.detail ?? response?.data?.message;
          const detail = extractDetailText(detailRaw);
          setErrorMsg(detail ? `生成失败：${detail}` : "生成报告失败，请稍后重试");
>>>>>>> master
        }
      } catch (error) {
        if (!isActive) return;
        const maybeError = error as { code?: string; name?: string };
<<<<<<< HEAD
        const isCanceled = maybeError?.code === "ERR_CANCELED" || maybeError?.name === "CanceledError";
        if (isCanceled) return;

        console.error(error);
        setErrorMsg("生成报告失败，请稍后重试");
=======
        const isCanceled =
          maybeError?.code === "ERR_CANCELED" || maybeError?.name === "CanceledError";
        if (isCanceled) return;

        console.error("evaluate error:", error);
        setErrorMsg(getEvaluateErrorMessage(error));
>>>>>>> master
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        正在检查登录状态...
      </div>
    );
  }

  if (authCheckFailed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">无法校验登录状态</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg}</p>
          <div className="mt-4 flex justify-center gap-2">
<<<<<<< HEAD
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100">
              重试
            </button>
            <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
=======
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
            >
              重试
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900"
            >
>>>>>>> master
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">正在生成深度评估报告</h2>
        <p className="text-gray-500 mt-2">AI 正在综合评估你的回答与简历，预计需要 15 秒左右...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
<<<<<<< HEAD
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">暂时无法展示报告</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg || "请返回首页重新发起一次面试流程。"}</p>
=======
        <div className="max-w-2xl w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">暂时无法展示报告</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg || "请返回首页重新发起面试流程。"}</p>

>>>>>>> master
          <button
            onClick={() => router.push("/")}
            className="mt-5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
<<<<<<< HEAD
        
        {/* 顶部总分卡片 */}
        <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">面试评估报告</h1>
          <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 border-blue-500">
            <span className="text-4xl font-black text-blue-600">{report.score}<span className="text-xl">分</span></span>
=======
        <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">面试评估报告</h1>
          <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 border-blue-500">
            <span className="text-4xl font-black text-blue-600">
              {report.score}
              <span className="text-xl">分</span>
            </span>
>>>>>>> master
          </div>
          <p className="text-gray-700 text-lg">{report.overall_summary}</p>
        </div>

<<<<<<< HEAD
        {/* 简历优化建议 */}
=======
>>>>>>> master
        <div className="bg-white p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" /> 简历优化建议
          </h2>
          <ul className="space-y-3">
            {report.resume_optimizations.map((opt, idx) => (
<<<<<<< HEAD
              <li key={idx} className="bg-orange-50 text-orange-800 p-4 rounded-lg text-sm">{opt}</li>
=======
              <li key={idx} className="bg-orange-50 text-orange-800 p-4 rounded-lg text-sm">
                {opt}
              </li>
>>>>>>> master
            ))}
          </ul>
        </div>

<<<<<<< HEAD
        {/* 问答复盘分析 */}
=======
>>>>>>> master
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
<<<<<<< HEAD
                  <strong>存在问题：</strong>{item.suggestion}
                </div>
                <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-100">
                  <strong>高分示范：</strong>{item.good_example}
=======
                  <strong>存在问题：</strong>
                  {item.suggestion}
                </div>
                <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-100">
                  <strong>高分示范：</strong>
                  {item.good_example}
>>>>>>> master
                </div>
              </div>
            ))}
          </div>
        </div>

<<<<<<< HEAD
        {/* 返回按钮 */}
        <div className="text-center pb-10">
          <button onClick={() => router.push("/")} className="bg-gray-800 hover:bg-gray-900 text-white px-8 py-3 rounded-lg shadow-md transition">
=======
        <div className="text-center pb-10">
          <button
            onClick={() => router.push("/")}
            className="bg-gray-800 hover:bg-gray-900 text-white px-8 py-3 rounded-lg shadow-md transition"
          >
>>>>>>> master
            返回首页，再面一次
          </button>
        </div>
      </div>
    </div>
  );
}
<<<<<<< HEAD
=======

>>>>>>> master
