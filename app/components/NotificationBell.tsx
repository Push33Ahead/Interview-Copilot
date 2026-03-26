"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Heart, MessageSquare, FileCheck, X, CheckCheck } from "lucide-react";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, Notification } from "@/app/lib/auth";
import { useRouter } from "next/navigation";

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className = "" }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const res = await fetchNotifications();
    if (res.ok) setNotifications(res.notifications);
    setLoading(false);
  }, []);

  // Poll every 30s for new notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Reload when auth changes
  useEffect(() => {
    const handler = () => setTimeout(loadNotifications, 1000);
    window.addEventListener("auth-success", handler);
    return () => window.removeEventListener("auth-success", handler);
  }, [loadNotifications]);

  const handleOpen = () => {
    setIsOpen(true);
    loadNotifications();
  };

  const handleClickNotif = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart size={16} className="text-red-400 fill-red-400" />;
      case "comment": return <MessageSquare size={16} className="text-cyan-400" />;
      case "report": return <FileCheck size={16} className="text-emerald-400" />;
      default: return <Bell size={16} className="text-slate-400" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <>
      {/* Bell Trigger */}
      <button
        onClick={handleOpen}
        className={`relative p-2 rounded-xl hover:bg-white/10 transition-all group ${className}`}
        title="消息通知"
      >
        <Bell size={18} className="text-slate-400 group-hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center ring-2 ring-[#0F1117] animate-pulse" style={{ animationDuration: "2s" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay + Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[180] bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md z-[190] flex animate-v7-fade">
            <div className="ml-auto h-full w-full max-w-md bg-white shadow-2xl flex flex-col" style={{ animation: "slideInRight 0.3s ease-out" }}>
              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">消息通知</h2>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} 条未读
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-slate-400 hover:text-cyan-500 transition-colors px-2 py-1 rounded-lg hover:bg-cyan-50 font-medium flex items-center gap-1"
                    >
                      <CheckCheck size={14} /> 全部已读
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-cyan-500 animate-spin"></div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Bell size={40} className="mb-3 opacity-20" />
                    <p className="font-medium">暂无消息通知</p>
                    <p className="text-xs mt-1">有人点赞或评论你的面经时，将在这里提醒你</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map(notif => (
                      <button
                        key={notif.id}
                        onClick={() => handleClickNotif(notif)}
                        className={`w-full text-left px-6 py-4 hover:bg-slate-50/80 transition-all flex gap-3.5 group relative ${!notif.is_read ? "bg-cyan-50/30" : ""}`}
                      >
                        {/* Unread dot */}
                        {!notif.is_read && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500"></div>
                        )}
                        
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.type === "like" ? "bg-red-50" :
                          notif.type === "comment" ? "bg-cyan-50" :
                          notif.type === "report" ? "bg-emerald-50" : "bg-slate-50"
                        }`}>
                          {getIcon(notif.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-relaxed ${!notif.is_read ? "text-slate-800 font-semibold" : "text-slate-600"}`}>
                            {notif.body}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 font-medium">{timeAgo(notif.created_at)}</p>
                        </div>

                        {/* Arrow hint */}
                        {notif.link && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 self-center">
                            →
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <style jsx global>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </>
  );
}
