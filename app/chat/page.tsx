"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, User, Bot, StopCircle } from "lucide-react";
import axios from "axios";
import { fetchCurrentUser } from "../lib/auth";

// 🔴 请替换为你真实的服务器 IP
const API_BASE_URL = "http://121.41.208.145:8000";

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [turnCount, setTurnCount] = useState(1);
  const [loading, setLoading] = useState(false); // 控制大模型回复时的 loading 状态
  const [authChecked, setAuthChecked] = useState(false);
  const [authCheckFailed, setAuthCheckFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<number | null>(null);
  const msgIdRef = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化加载第一问
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await Promise.race([
          fetchCurrentUser(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000))
        ]);
        if (!active) return;
        if (!current) {
          setAuthCheckFailed(true);
          setErrorMsg("登录状态校验失败或超时，请重试");
          return;
        }

        const firstQ = localStorage.getItem("first_question");
        if (!firstQ) {
          setErrorMsg("缺少面试信息，请重新上传简历");
          router.push("/");
          return;
        }
        const firstMsg = { id: msgIdRef.current++, role: "ai" as const, content: firstQ };
        setMessages([firstMsg]);
        setLatestMsgId(firstMsg.id);
      } finally {
        if (active) setAuthChecked(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!latestMsgId) return;
    const t = setTimeout(() => setLatestMsgId(null), 800);
    return () => clearTimeout(t);
  }, [latestMsgId]);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        正在检查登录状态...
      </main>
    );
  }

  if (authCheckFailed) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800">无法进入面试会话</h2>
          <p className="text-sm text-gray-600 mt-2">{errorMsg || "登录状态校验失败，请返回首页重试。"}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100">
              重试
            </button>
            <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
              返回首页
            </button>
          </div>
        </div>
      </main>
    );
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setErrorMsg("");
    setInfoMsg("");

    const sessionId = localStorage.getItem("interview_session_id");
    const userText = input.trim();
    
    // 1. 立即在界面上显示用户的回答
    const userMsg = { id: msgIdRef.current++, role: "user" as const, content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLatestMsgId(userMsg.id);
    setInput("");
    setLoading(true);

    try {
      // 2. 调用真实的追问 API
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        session_id: sessionId,
        user_answer: userText
      });

      if (response.data.code === 200) {
        const { next_question, turn_count, is_finished } = response.data.data;
        
        // 3. 将 AI 的新问题追加到界面
        const aiMsg = { id: msgIdRef.current++, role: "ai" as const, content: next_question };
        setMessages((prev) => [...prev, aiMsg]);
        setLatestMsgId(aiMsg.id);
        setTurnCount(turn_count);

        // 4. 如果到达15轮限制，自动跳转评估页
        if (is_finished) {
          setInfoMsg("面试轮数已达上限，正在为你生成评估报告...");
          setTimeout(() => {
             router.push("/report");
          }, 2000);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("网络错误，未能获取面试官回复");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setShowFinishConfirm(true);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 顶部导航保留 */}
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-800">技术面进行中...</h1>
          <p className="text-sm text-gray-500">当前进度: {turnCount} / 15 轮</p>
        </div>
        <button onClick={handleFinish} className="flex items-center gap-2 text-red-600 hover:text-red-700 bg-red-50 px-4 py-2 rounded-lg transition">
          <StopCircle size={18} /> 结束并评估
        </button>
      </header>
      {(errorMsg || infoMsg) && (
        <div className="px-6 pt-4">
          {errorMsg && <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2">{errorMsg}</p>}
          {infoMsg && <p className="text-sm rounded-lg bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 mt-2">{infoMsg}</p>}
        </div>
      )}

      {/* 聊天记录 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`chat-avatar-pop w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === "ai" ? "bg-blue-600" : "bg-emerald-500"}`}>
              {msg.role === "ai" ? <Bot className="text-white" size={20} /> : <User className="text-white" size={20} />}
            </div>
            <div className={`max-w-[75%] p-4 rounded-2xl whitespace-pre-wrap ${msg.role === "user" ? "chat-bubble-right bg-emerald-500 text-white rounded-tr-sm" : "chat-bubble-left bg-white border border-gray-200 text-gray-800 shadow-sm rounded-tl-sm"} ${latestMsgId === msg.id ? "msg-highlight" : ""}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {/* Loading 动画展示 */}
        {loading && (
          <div className="flex gap-4">
            <div className="chat-avatar-pop w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Bot className="text-white" size={20} />
            </div>
            <div className="chat-bubble-left p-4 rounded-2xl bg-white border border-gray-200 flex items-center gap-2 text-gray-500">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="ml-1 text-sm">面试官思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* 底部输入框 */}
      <footer className="bg-white border-t p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex gap-4">
          <input
            type="text"
            className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-4 py-3 outline-none transition"
            placeholder={loading ? "请等待面试官提问..." : "输入你的回答..."}
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend} disabled={loading} className={`send-btn-ripple ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl px-6 flex items-center justify-center transition shadow-md`}>
            <Send size={20} />
          </button>
        </div>
      </footer>

      {showFinishConfirm && (
        <div className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl p-5">
            <h3 className="text-lg font-semibold text-slate-900">结束本轮面试？</h3>
            <p className="text-sm text-slate-600 mt-2">确认后将停止继续追问，并跳转到评估报告页。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowFinishConfirm(false);
                  router.push("/report");
                }}
                className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                确认结束
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
