"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, Save, X, UserRound } from "lucide-react";
import { AuthUser, updateProfile, uploadAvatar, resolveAvatarUrl } from "@/app/lib/auth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  onUserUpdate: (u: AuthUser) => void;
}

export default function UserProfileModal({ isOpen, onClose, user, onUserUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name || "");
  const [targetRole, setTargetRole] = useState(user.target_role || "");
  const [workYears, setWorkYears] = useState(String(user.work_experience_years || 0));
  const [desiredCity, setDesiredCity] = useState(user.desired_city || "");
  const [expectedSalary, setExpectedSalary] = useState(user.expected_salary || "");
  const [skillsText, setSkillsText] = useState((user.skills || []).join(", "));
  const [bio, setBio] = useState(user.bio || "");

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(user.name || "");
    setTargetRole(user.target_role || "");
    setWorkYears(String(user.work_experience_years || 0));
    setDesiredCity(user.desired_city || "");
    setExpectedSalary(user.expected_salary || "");
    setSkillsText((user.skills || []).join(", "));
    setBio(user.bio || "");
    setMsg("");
  }, [user, isOpen]);

  if (!isOpen) return null;

  const onUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMsg("");
    const res = await uploadAvatar(file);
    setUploadingAvatar(false);
    e.target.value = "";

    if (!res.ok) {
      setMsg(`上传失败: ${res.message}`);
      return;
    }
    onUserUpdate(res.user);
    setMsg("头像已更新");
  };

  const onSaveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setMsg("");

    const skills = skillsText.split(",").map((x) => x.trim()).filter(Boolean);

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
      setMsg(`保存失败: ${res.message}`);
      return;
    }
    onUserUpdate(res.user);
    setMsg("资料已成功保存");
    setTimeout(onClose, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-v7-fade">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-v7-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">个人求职档案</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 grid sm:grid-cols-[140px_1fr] gap-8 max-h-[75vh] overflow-y-auto">
          <div className="flex flex-col items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-24 h-24 rounded-full border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shadow-sm"
              title="更换头像"
            >
              {user.avatar_url ? (
                <img src={resolveAvatarUrl(user.avatar_url)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <UserRound className="text-slate-400" size={40} />
              )}
              <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} />
              </div>
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              {uploadingAvatar ? "上传中..." : "点击更换头像"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUploadAvatar}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">昵称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">目标岗位</label>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="如：前端开发工程师" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">工作年限</label>
                <input type="number" min="0" value={workYears} onChange={(e) => setWorkYears(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">期望城市</label>
                <input value={desiredCity} onChange={(e) => setDesiredCity(e.target.value)} placeholder="如：北京" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">期望薪资</label>
                <input value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="如：20k-30k" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">核心技能（逗号分隔）</label>
              <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, Vue, Node.js" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">个人简介</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-black" />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className={`text-sm ${msg.includes("失败") ? "text-red-500" : "text-emerald-600"}`}>{msg}</span>
              <button
                onClick={onSaveProfile}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "保存中..." : "保存资料"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
