"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  History,
  FileText,
  PlusCircle,
  LogOut,
  Radar,
  User,
  Settings,
  Globe
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCurrentUser, logout, AuthUser, resolveAvatarUrl } from "@/app/lib/auth";
import UserProfileModal from "@/app/components/UserProfileModal";
import AuthModal from "@/app/components/AuthModal";
import NotificationBell from "@/app/components/NotificationBell";
import { CheckCircle2, Info } from "lucide-react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string, type: "success" | "info" } | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser);
    
    const handleOpenAuth = () => setIsAuthOpen(true);
    window.addEventListener("open-auth-modal", handleOpenAuth);
    
    const handleToast = (e: any) => {
       setToast(e.detail);
       setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener("show-toast", handleToast);
    
    return () => {
      window.removeEventListener("open-auth-modal", handleOpenAuth);
      window.removeEventListener("show-toast", handleToast);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.dispatchEvent(new CustomEvent("show-toast", { detail: { type: "info", text: "已安全退出登录" } }));
  };

  const navItems = [
    { name: "新面试", href: "/start", icon: PlusCircle },
    { name: "当前会话", href: "/chat", icon: MessageSquare },
    { name: "面试历史", href: "/history", icon: History },
    { name: "评估报告", href: "/report", icon: FileText },
    { name: "面经广场", href: "/square", icon: Globe },
  ];

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 overflow-hidden font-sans selection:bg-cyan-100">
      {/* Sidebar - Dark Modern Theme */}
      <aside className="w-64 bg-[#0F1117] border-r border-slate-800/60 flex flex-col items-stretch transition-all duration-300">
        <Link href="/" className="px-5 py-6 flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity w-fit">
          <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-1.5 rounded-xl text-white shadow-lg shadow-cyan-500/20">
            <Radar size={22} className="stroke-[2.5]" />
          </div>
          <span className="font-bold text-slate-50 tracking-wide text-[17px]">Interview Copilot</span>
        </Link>

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? "bg-[#1E212B] text-slate-100 font-medium shadow-sm border border-white/5" 
                    : "text-slate-400 hover:bg-[#1E212B]/70 hover:text-slate-200"
                  }`}
              >
                <Icon size={18} className={isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300 transition-colors"} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Notification Bell + User profile */}
        <div className="p-4 border-t border-slate-800/80 mt-auto space-y-3">
          {user && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-500 font-medium">消息通知</span>
              <NotificationBell />
            </div>
          )}
          {user ? (
            <div className="flex items-center justify-between group bg-[#161922] p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 overflow-hidden flex-1 text-left relative group/btn" title="点击设置实名资料">
                {user.avatar_url ? (
                  <img src={resolveAvatarUrl(user.avatar_url)} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                )}
                <div className="overflow-hidden pr-2">
                  <p className="text-[13px] font-medium text-slate-200 truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition flex border border-white/10 rounded-xl items-center justify-center backdrop-blur-sm">
                   <Settings size={16} className="text-white" />
                </div>
              </button>
              <button 
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-400 transition-colors px-1"
                title="退出登录"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors text-sm font-medium">
              登录 / 注册
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative h-full flex flex-col bg-white">
        <div key={user ? "auth" : "guest"} className="flex-1 h-full w-full overflow-hidden relative">
           {children}
        </div>
      </main>
      
      {/* Global Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-5 animate-v7-toast">
          <div className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3.5 text-sm shadow-2xl text-white">
            {toast.type === "success" ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Info size={18} className="text-sky-400" />}
            {toast.text}
          </div>
        </div>
      )}
      {/* User Profile Modal */}
      {user && (
        <UserProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={user} 
          onUserUpdate={setUser} 
        />
      )}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onSuccess={(u) => { 
          setUser(u); 
          setIsAuthOpen(false); 
          window.dispatchEvent(new CustomEvent("auth-success", { detail: u })); 
        }} 
      />
    </div>
  );
}
