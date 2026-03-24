"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserRound, Save, Clock3, BarChart3, Camera } from "lucide-react";
import {
  AuthUser,
  fetchCurrentUser,
  fetchMyReports,
  resolveAvatarUrl,
  updateProfile,
  uploadAvatar,
  type ReportHistoryItem,
} from "../lib/auth";

export default function HistoryPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);

  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [workYears, setWorkYears] = useState("0");
  const [desiredCity, setDesiredCity] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [bio, setBio] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await fetchCurrentUser();
      if (!active) return;
      if (!current) {
        router.push("/");
        return;
      }

      setUser(current);
      setName(current.name || "");
      setTargetRole(current.target_role || "");
      setWorkYears(String(current.work_experience_years || 0));
      setDesiredCity(current.desired_city || "");
      setExpectedSalary(current.expected_salary || "");
      setSkillsText((current.skills || []).join(", "));
      setBio(current.bio || "");

      const historyRes = await fetchMyReports();
      if (!active) return;
      if (historyRes.ok) {
        setReports(historyRes.reports);
      } else {
        setMsg(historyRes.message);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const onUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMsg("");
    const res = await uploadAvatar(file);
    setUploadingAvatar(false);
    e.target.value = "";

    if (!res.ok) {
      setMsg(res.message);
      return;
    }

    setUser(res.user);
    setMsg("头像已更新");
  };

  const onSaveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setMsg("");

    const skills = skillsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const res = await updateProfile({
      name,
      target_role: targetRole,
      work_experience_years: Number(workYears || 0),
      desired_city: desiredCity,
      expected_salary: expectedSalary,
      skills,
      bio,
    });

    setSaving(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    setUser(res.user);
    setMsg("资料已更新");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        正在加载用户中心...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/start" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 hover:bg-white text-sm">
              <ArrowLeft size={14} /> 返回开始页
            </Link>
            <h1 className="text-2xl font-semibold">用户中心</h1>
          </div>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">求职档案</h2>
          <div className="grid md:grid-cols-[120px_1fr] gap-5 items-start">
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-24 h-24 rounded-full border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center"
                title="点击上传头像"
              >
                {user?.avatar_url ? (
                  <img src={resolveAvatarUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="text-slate-500" size={36} />
                )}
                <span className="absolute inset-0 bg-black/35 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Camera size={16} />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUploadAvatar}
              />
              <p className="text-xs text-slate-500 mt-2 text-center">{uploadingAvatar ? "上传中..." : "点击头像上传"}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">昵称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">目标岗位</label>
                  <input
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="如：后端工程师"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">工作年限</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={workYears}
                    onChange={(e) => setWorkYears(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">期望城市</label>
                  <input
                    value={desiredCity}
                    onChange={(e) => setDesiredCity(e.target.value)}
                    placeholder="如：杭州"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">期望薪资</label>
                  <input
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="如：25k-35k"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">核心技能（逗号分隔）</label>
                <input
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="React, TypeScript, Redis"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">个人简介</label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 resize-none"
                />
              </div>
              <button
                onClick={onSaveProfile}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save size={14} /> {saving ? "保存中..." : "保存资料"}
              </button>
              {msg && <p className="text-sm text-slate-600">{msg}</p>}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">历史评估</h2>
          {reports.length === 0 ? (
            <p className="text-slate-500 text-sm">还没有评估记录，先去完成一场模拟面试吧。</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <article key={r.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{r.job_title || "未命名岗位"}</p>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{r.overall_summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="inline-flex items-center gap-1 text-sky-700 font-semibold"><BarChart3 size={14} /> {r.score} 分</p>
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500 mt-1"><Clock3 size={12} /> {r.created_at}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
