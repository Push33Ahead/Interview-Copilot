"use client";

import { useEffect, useState, use, useRef } from "react";
import { fetchPostDetail, fetchPostComments, createPostComment, togglePostLike, getPostLikeStatus, deletePost, deleteComment, SquarePost, SquareComment, fetchCurrentUser, AuthUser } from "@/app/lib/auth";
import { UserRound, Clock, Eye, Heart, MessageSquare, ArrowLeft, Send, Trash2, X, MoreHorizontal, ChevronDown, ChevronUp, Share2, Bookmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthModal from "@/app/components/AuthModal";

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const postId = unwrappedParams.id;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [post, setPost] = useState<SquarePost | null>(null);
  const [comments, setComments] = useState<SquareComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [activeReplyInput, setActiveReplyInput] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    fetchCurrentUser().then(setUser);
    Promise.all([
      fetchPostDetail(postId),
      fetchPostComments(postId),
      getPostLikeStatus(postId)
    ]).then(([detailRes, commentsRes, liked]) => {
      if (detailRes.ok && detailRes.post) {
        setPost(detailRes.post);
        setLikeCount(detailRes.post.likes_count || 0);
      }
      if (commentsRes.ok) setComments(commentsRes.comments);
      setIsLiked(liked);
      setLoading(false);
    });
  }, [postId]);

  // Click on a comment's author name = set reply target and focus input
  const handleReplyTo = (comment: SquareComment) => {
    if (!user) return setIsAuthOpen(true);
    setReplyTarget({ id: comment.id, name: comment.author_name });
    inputRef.current?.focus();
  };

  const handleLike = async () => {
    if (!user) return setIsAuthOpen(true);
    const origLiked = isLiked;
    const origCount = likeCount;
    setIsLiked(!origLiked);
    setLikeCount(origLiked ? Math.max(0, origCount - 1) : origCount + 1);
    const res = await togglePostLike(postId);
    if (!res.ok) { setIsLiked(origLiked); setLikeCount(origCount); }
    else {
      if (res.is_liked !== undefined) setIsLiked(res.is_liked);
      if (res.likes_count !== undefined) setLikeCount(res.likes_count);
    }
  };

  const handleComment = async () => {
    if (!user) return setIsAuthOpen(true);
    if (!commentText.trim()) return;
    setSubmitting(true);
    const res = await createPostComment(postId, commentText, replyTarget?.id, replyTarget?.name);
    setSubmitting(false);
    if (res.ok && res.comment) {
      setComments(prev => [...prev, res.comment!]);
      setCommentText("");
      setReplyTarget(null);
      // 只在添加顶层评论时增加 comments_count，回复不增加
      const isReply = res.comment?.reply_to && res.comment.reply_to !== "";
      if (!isReply) {
        setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
      }
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "评论成功！" } }));
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: res.message } }));
    }
  };

  const handleDeletePost = async () => {
    setConfirmDeletePost(false);
    const res = await deletePost(postId);
    if (res.ok) {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "帖子已删除" } }));
      router.push("/square");
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: res.message } }));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setConfirmDeleteCommentId(null);
    const res = await deleteComment(postId, commentId);
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      // 只在删除顶层评论时减少 comments_count，删除回复不减少
      const comment = comments.find(c => c.id === commentId);
      const isReply = comment?.reply_to && comment.reply_to !== "";
      if (!isReply) {
        setPost(prev => prev ? { ...prev, comments_count: Math.max(0, prev.comments_count - 1) } : prev);
      }
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "评论已删除" } }));
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: res.message } }));
    }
  };

  // 弹出输入框提交评论
  const handlePopupComment = async (targetCommentId: string, content: string) => {
    if (!user) return setIsAuthOpen(true);
    if (!content.trim()) return;
    setSubmitting(true);
    const targetComment = comments.find(c => c.id === targetCommentId);
    const res = await createPostComment(postId, content, targetCommentId, targetComment?.author_name);
    setSubmitting(false);
    if (res.ok && res.comment) {
      setComments(prev => [...prev, res.comment!]);
      // 只在添加顶层评论时增加 comments_count，回复不增加
      const isReply = res.comment?.reply_to && res.comment.reply_to !== "";
      if (!isReply) {
        setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
      }
      setActiveReplyInput(null);
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "success", text: "评论成功！" } }));
    } else {
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: res.message } }));
    }
  };

  // Separate top-level comments from replies
  const topLevelComments = comments.filter(c => !c.reply_to || c.reply_to === "");
  const getReplies = (parentId: string) => comments.filter(c => c.reply_to === parentId);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div
        className="h-full flex items-center justify-center relative overflow-hidden animate-v7-fade-in"
        style={{ animationDuration: '0.2s' }}
      >
        <div className="flex flex-col items-center gap-4 text-slate-400">
           <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-cyan-500 animate-spin"></div>
           <p className="font-medium text-sm">载入面经中...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
        <p className="text-slate-500 font-medium">面经不存在或已被删除</p>
        <Link href="/square" className="text-cyan-600 font-semibold hover:underline">返回广场</Link>
      </div>
    );
  }

  const isAuthor = user?.email === post.author_email;

  // Render a single comment row (used for both top-level and replies)
  const renderComment = (c: SquareComment, isReply = false) => {

    return (
      <div key={c.id} id={c.id} className={`flex gap-3 animate-v7-fade ${isReply ? "" : ""}`}>
        {c.author_avatar ? (
          <img src={`http://121.41.208.145:8000${c.author_avatar}`} className={`${isReply ? "w-7 h-7" : "w-9 h-9"} rounded-full object-cover ring-1 ring-slate-100 bg-slate-100 shrink-0 mt-0.5`} alt="" />
        ) : (
          <div className={`${isReply ? "w-7 h-7" : "w-9 h-9"} rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center text-slate-400 shrink-0 mt-0.5`}>
            <UserRound size={isReply ? 13 : 16} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {/* Click anywhere on comment to reply */}
            <button
              onClick={() => handleReplyTo(c)}
              className="font-bold text-slate-800 text-sm hover:text-cyan-600 transition-colors cursor-pointer"
            >
              {c.author_name}
            </button>
            {c.reply_to_name && (
              <span className="text-xs text-slate-400">
                回复 <span className="text-cyan-500 font-medium">{c.reply_to_name}</span>
              </span>
            )}
            <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
            {user?.email === c.author_email && (
              <button
                onClick={() => setConfirmDeleteCommentId(c.id)}
                className="text-slate-400 hover:text-red-400 transition-colors ml-auto opacity-70 hover:opacity-100"
                title="删除"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <p className="text-slate-600 text-base whitespace-pre-wrap leading-relaxed mt-1">{c.content}</p>

          {/* Reply indicator and interaction */}
          <div className="flex items-center gap-3 mt-2">
            {/* Click anywhere on comment to reply */}
            <button
              onClick={() => handleReplyTo(c)}
              className="text-xs text-slate-400 hover:text-cyan-500 transition-colors"
            >
              回复
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="h-full flex flex-col overflow-hidden relative" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafbff 40%, #f0fffe 70%, #f5f3ff 100%)" }}>
      {/* Ambient */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[15%] right-[5%] w-[55%] h-[45%] rounded-full bg-gradient-to-b from-cyan-200/50 via-sky-200/20 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "8s", animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)" }} />
        <div className="absolute bottom-[5%] -left-[10%] w-[45%] h-[50%] rounded-full bg-gradient-to-tr from-indigo-200/40 via-violet-200/15 to-transparent blur-[80px] animate-pulse" style={{ animationDuration: "10s", animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)" }} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 relative z-10">
        {/* Sticky Header with modern design */}
        <div className="bg-white/60 backdrop-blur-2xl sticky top-0 z-20 border-b border-white/50 px-6 py-4 shadow-[0_1px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <Link href="/square" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all bg-white/60 px-4 py-2 rounded-xl text-sm font-medium hover:bg-white hover:shadow-sm transform hover:scale-105 transition-transform duration-200">
              <ArrowLeft size={16} /> 面经广场
            </Link>
            {isAuthor && (
              <div className="relative">
                <button onClick={() => setShowPostMenu(!showPostMenu)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-xl transition-all duration-200 transform hover:scale-110">
                  <MoreHorizontal size={20} />
                </button>
                {showPostMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowPostMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-v7-modal transform transition-all duration-300 scale-100">
                      <button onClick={() => { setShowPostMenu(false); setConfirmDeletePost(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium transform hover:scale-105 transition-transform duration-200">
                        <Trash2 size={15} /> 删除帖子
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 lg:px-12 py-8 w-full animate-v7-fade">
          {/* Single column layout - article and comments stacked vertically */}
          <div className="flex flex-col gap-6">
            {/* Article with enhanced modern design */}
            <article className="bg-white/70 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_2px_30px_rgba(0,0,0,0.05)] p-6 md:p-8 relative overflow-hidden transform transition-all duration-500 hover:shadow-[0_4px_40px_rgba(0,0,0,0.08]">
              <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-cyan-200/15 via-sky-200/10 to-transparent pointer-events-none rounded-bl-full"></div>
              <div className="flex items-center gap-4 mb-6 relative z-10 transform transition-all duration-300 hover:scale-102">
                {post.author_avatar ? (
                  <img src={`http://121.41.208.145:8000${post.author_avatar}`} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-md bg-slate-100 transition-all duration-300 hover:ring-3 hover:ring-cyan-200" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-400 flex items-center justify-center text-white ring-2 ring-white shadow-md shrink-0 transition-all duration-300 hover:ring-3 hover:ring-cyan-200">
                    <UserRound size={20} />
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-800 text-base transition-colors duration-200 hover:text-cyan-600">{post.author_name}</div>
                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-1 font-medium">
                    <span className="flex items-center gap-1"><Clock size={14}/> {timeAgo(post.created_at)}</span>
                    <span className="flex items-center gap-1"><Eye size={14}/> {post.views_count}</span>
                  </div>
                </div>
              </div>

              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-4 tracking-tight relative z-10 transition-all duration-300 hover:text-cyan-600">
                {post.company} <span className="text-slate-300 mx-1">/</span> {post.role}
              </h1>

              <div className="flex flex-wrap gap-1.5 mb-6 relative z-10">
                {post.tags.map((tag, i) => (
                  <span key={i} className="text-cyan-600 text-sm font-semibold transition-all duration-200 hover:scale-110 hover:bg-cyan-50 px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>

              <div className="relative z-10 text-slate-700 leading-[1.85] text-[15px] transition-all duration-300 hover:text-slate-800">
                {post.content.split("\n").map((line, i) => (
                  <p key={i} className="min-h-[1em] whitespace-pre-wrap transition-all duration-300 hover:text-slate-800">{line}</p>
                ))}
              </div>
            </article>

            {/* Modern Comments Section */}
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl border border-white/60 shadow-[0_2px_30px_rgba(0,0,0,0.05)]" style={{ marginTop: '20px' }}>
              {/* Comment Header with modern design */}
              <div className="px-6 py-5 border-b border-slate-100/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare size={18} className="text-cyan-500" />
                  评论 <span className="text-slate-400 text-sm font-medium">({post.comments_count})</span>
                </h3>
              </div>

              {/* Comment List - scrollable with modern design */}
              <div className="px-6 py-4 space-y-4 custom-scrollbar">
                {topLevelComments.length === 0 && comments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    还没有人评论，快来抢沙发~
                  </div>
                ) : (
                  topLevelComments.map(c => {
                    const replies = getReplies(c.id);
                    return (
                      <div key={c.id} className="space-y-0">
                        {/* Modern top-level comment with enhanced design */}
                        <div className="flex gap-3 p-4 hover:bg-gray-50 rounded-2xl transition-all duration-200">
                          {c.author_avatar ? (
                            <img src={`http://121.41.208.145:8000${c.author_avatar}`} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm bg-slate-100" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-400 flex items-center justify-center text-white ring-2 ring-white shadow-sm shrink-0">
                              <UserRound size={16} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <button
                                onClick={() => handleReplyTo(c)}
                                className="font-bold text-slate-800 text-sm hover:text-cyan-600 transition-colors cursor-pointer"
                              >
                                {c.author_name}
                              </button>
                              <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                              {user?.email === c.author_email && (
                                <button
                                  onClick={() => setConfirmDeleteCommentId(c.id)}
                                  className="text-slate-400 hover:text-red-400 transition-colors ml-auto opacity-70 hover:opacity-100"
                                  title="删除"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                            <p className="text-slate-600 text-base whitespace-pre-wrap leading-relaxed mt-1">{c.content}</p>

                            {/* Modern interaction buttons */}
                            <div className="flex items-center gap-4 mt-3">
                              <button
                                onClick={() => handleReplyTo(c)}
                                className="text-xs text-slate-400 hover:text-cyan-500 transition-colors flex items-center gap-1"
                              >
                                <MessageSquare size={12} />
                                回复
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Nested replies with expand/collapse functionality */}
                        {replies.length > 0 && (
                          <div className="ml-12 mt-2 space-y-3 pl-4 border-l-2 border-slate-100">
                            {/* Expand button if replies are collapsed */}
                            {activeReplyInput !== c.id && (
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <button
                                  onClick={() => setActiveReplyInput(c.id)}
                                  className="text-cyan-500 hover:text-cyan-600 font-medium flex items-center gap-1"
                                >
                                  <ChevronDown size={12} />
                                  展开回复 ({replies.length})
                                </button>
                              </div>
                            )}

                            {/* Show all replies when expanded */}
                            {activeReplyInput === c.id && (
                              <>
                                {replies.map(r => renderComment(r, true))}
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                                  <button
                                    onClick={() => setActiveReplyInput(null)}
                                    className="text-cyan-500 hover:text-cyan-600 font-medium flex items-center gap-1"
                                  >
                                    <ChevronUp size={12} />
                                    收起回复
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {/* Show "orphan" replies that don't have a parent (in case of data inconsistency) */}
                {comments.filter(c => c.reply_to && c.reply_to !== "" && !topLevelComments.some(t => t.id === c.reply_to) && !comments.some(p => p.id === c.reply_to)).map(c => renderComment(c))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Bottom Action Bar */}
      <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur-2xl border-t border-white/50 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={handleLike}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${isLiked ? "text-red-500 scale-110" : "text-gray-500 hover:text-red-500"}`}
            >
              <Heart size={24} className={`transition-transform duration-300 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-xs font-medium">{likeCount}</span>
            </button>

            <button
              onClick={() => setReplyTarget({ id: '', name: '' })}
              className="flex flex-col items-center gap-1 transition-all duration-300 text-gray-500 hover:text-cyan-500"
            >
              <MessageSquare size={24} />
              <span className="text-xs font-medium">评论</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              <Share2 size={20} />
            </button>
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              <Bookmark size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Modern Comment Input - appears when replying */}
      {replyTarget && (
        <div className="absolute bottom-20 w-full bg-white/90 backdrop-blur-2xl border-t border-white/50 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30 animate-v7-slide-up">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder={user ? (replyTarget ? `回复 ${replyTarget.name}...` : "写下你的评论...") : "登录后方可参与交流"}
                className="w-full h-11 bg-white/70 border border-gray-200 rounded-full pl-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all placeholder:text-gray-400"
              />
              <button
                onClick={handleComment}
                disabled={submitting || (!commentText.trim() && !!user)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white flex items-center justify-center hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-30 shadow-sm"
              >
                <Send size={14} />
              </button>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Post Modal */}
      {confirmDeletePost && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-v7-fade">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-v7-modal">
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5 text-red-500"><Trash2 size={26} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">删除面经帖子</h3>
              <p className="text-sm text-slate-500 mb-7">帖子及其所有评论将被永久删除，此操作不可撤销。</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeletePost(false)} className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition">取消</button>
                <button onClick={handleDeletePost} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-medium hover:bg-red-600 transition shadow-lg shadow-red-500/20">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Comment Modal */}
      {confirmDeleteCommentId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-v7-fade">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-v7-modal">
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5 text-orange-500"><Trash2 size={26} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">删除评论</h3>
              <p className="text-sm text-slate-500 mb-7">确认删除这条评论吗？此操作不可撤销。</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteCommentId(null)} className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition">取消</button>
                <button onClick={() => handleDeleteComment(confirmDeleteCommentId)} className="flex-1 px-4 py-3 rounded-2xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition shadow-lg shadow-orange-500/20">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={(u) => { setUser(u); setIsAuthOpen(false); }} />
    </main>
  );
}
