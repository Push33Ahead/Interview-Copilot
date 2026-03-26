"use client";

import { useEffect, useState } from "react";
import { Search, Plus, MessageSquare, Heart, Eye, UserRound, Globe, Filter } from "lucide-react";
import Link from "next/link";
import { fetchPosts, SquarePost, fetchCurrentUser, AuthUser } from "@/app/lib/auth";
import CreatePostModal from "@/app/components/CreatePostModal";
import AuthModal from "@/app/components/AuthModal";

type TabType = "all" | "mine";

export default function SquarePage() {
  const [posts, setPosts] = useState<SquarePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<TabType>("all");

  const loadPosts = async (q: string = "") => {
    setLoading(true);
    const { ok, posts } = await fetchPosts(q);
    if (ok) setPosts(posts);
    setLoading(false);
  };

  useEffect(() => {
    fetchCurrentUser().then(setUser);
    loadPosts();
    const handleAuth = (e: any) => setUser(e.detail);
    window.addEventListener("auth-success", handleAuth);
    return () => window.removeEventListener("auth-success", handleAuth);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadPosts(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleCreateClick = () => {
    if (!user) setIsAuthOpen(true);
    else setIsCreateOpen(true);
  };

  const filteredPosts = tab === "mine" && user
    ? posts.filter(p => p.author_email === user.email)
    : posts;

  return (
    <main className="h-full flex flex-col relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
      {/* Strong Ambient Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[15%] right-[5%] w-[60%] h-[55%] rounded-full bg-gradient-to-b from-cyan-200/60 via-sky-200/30 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-[50%] -left-[15%] w-[55%] h-[50%] rounded-full bg-gradient-to-tr from-indigo-200/50 via-violet-200/20 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "10s" }} />
        <div className="absolute bottom-[5%] right-[20%] w-[30%] h-[30%] rounded-full bg-gradient-to-tl from-emerald-200/30 to-transparent blur-[60px]" />
      </div>

      {/* Header */}
      <div className="bg-white/60 backdrop-blur-2xl border-b border-white/50 px-8 py-8 shrink-0 relative z-10 shadow-[0_1px_20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1.5 flex items-center gap-3">
                🌐 面经广场
              </h1>
              <p className="text-slate-500 font-light text-sm">探索真实面试经历，分享经验，共同进化。</p>
            </div>
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 text-white px-6 py-3 font-medium transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:scale-[1.02] active:scale-95"
            >
              <Plus size={18} />发布面经
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索公司、岗位或关键字... 例如『字节跳动 前端』"
              className="w-full rounded-2xl border-none bg-white/80 backdrop-blur-md ring-1 ring-slate-200/50 py-3.5 pl-12 pr-6 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-cyan-400 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Tab Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab("all")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === "all" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800"}`}
            >
              全部面经
            </button>
            <button
              onClick={() => {
                if (!user) { setIsAuthOpen(true); return; }
                setTab("mine");
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === "mine" ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800"}`}
            >
              <Filter size={14} /> 我的发布
            </button>
          </div>
        </div>
      </div>

      {/* Post List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
        <div className="max-w-full">
          {loading ? (
            <div className="flex flex-col gap-5 w-full">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-3xl bg-white/50 animate-pulse border border-white/50"></div>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Globe className="w-16 h-16 mb-4 opacity-30" />
              <p className="font-medium">
                {tab === "mine" ? "您还没有发布过面经，去发一篇吧！" : query ? "没有找到符合条件的面经记录" : "大厅空空如也，来发布第一篇面经吧！"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 w-full">
              {filteredPosts.map((post, idx) => (
                <Link
                  key={post.id}
                  href={`/square/${post.id}`}
                  className="group flex flex-col bg-white/70 backdrop-blur-lg rounded-3xl p-6 border border-white/60 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] hover:bg-white/90 transition-all duration-500 relative overflow-hidden"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-cyan-300/10 via-sky-300/5 to-transparent pointer-events-none rounded-bl-full group-hover:from-cyan-300/20 transition-all duration-500"></div>
                  
                  <div className="flex items-center gap-3 mb-3 relative z-10">
                    {post.author_avatar ? (
                      <img src={`http://121.41.208.145:8000${post.author_avatar}`} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm bg-slate-100" alt="avatar" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-400 flex items-center justify-center text-white ring-2 ring-white shadow-sm shrink-0">
                        <UserRound size={18} />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{post.author_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{new Date(post.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="mb-3 relative z-10">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-cyan-600 transition-colors duration-300 mb-2 line-clamp-1">
                      {post.company} <span className="text-slate-300 font-light mx-1">|</span> {post.role}
                    </h3>
                    <p className="text-sm text-slate-600/80 line-clamp-2 leading-relaxed">
                      {post.content_snippet || post.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4 relative z-10">
                    {post.tags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="text-cyan-600 text-sm font-semibold">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center gap-6 text-sm font-medium text-slate-400 pt-3 border-t border-slate-100/50 relative z-10">
                    <div className="flex items-center gap-1.5"><Eye size={15} className="opacity-70"/> {post.views_count}</div>
                    <div className="flex items-center gap-1.5"><MessageSquare size={15} className="opacity-70"/> {post.comments_count}</div>
                    <div className="flex items-center gap-1.5"><Heart size={15} className="opacity-70"/> {post.likes_count}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreatePostModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onSuccess={() => {
          setIsCreateOpen(false);
          loadPosts(query);
        }} 
      />
      
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          setIsAuthOpen(false);
          if (tab !== "mine") setIsCreateOpen(true);
        }}
      />
    </main>
  );
}
