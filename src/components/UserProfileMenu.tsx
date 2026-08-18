import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { User, LogOut, ShieldCheck, ChevronDown, Edit2, Check, X, Sparkles, Key, Database } from 'lucide-react';

interface UserProfileMenuProps {
  onOpenDbRecovery?: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ onOpenDbRecovery }) => {
  const { user, logout, updateProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editRole, setEditRole] = useState(user?.role || 'DevOps Engineer');
  const [saving, setSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'MC';

  const handleStartEdit = () => {
    setEditName(user.name);
    setEditRole(user.role);
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setSaving(true);
    try {
      await updateProfile(editName.trim(), editRole);
      setIsEditing(false);
      setEditSuccess(true);
      setTimeout(() => setEditSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to update profile:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Navbar Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-2 rounded bg-[#0A0B0E] hover:bg-[#1A1D26] border border-[#22262E] transition-all cursor-pointer group"
        title="User Account & Security"
      >
        <div className="w-6 h-6 rounded bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-mono font-black text-[10px] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          {initials}
        </div>
        <div className="hidden xl:flex flex-col text-left leading-tight">
          <span className="text-xs font-mono font-bold text-[#E2E8F0] group-hover:text-white transition-colors">
            {user.name}
          </span>
          <span className="text-[9px] font-mono text-[#94A3B8]">{user.role}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#12141A] border border-[#22262E] rounded-md shadow-2xl z-50 p-4 font-sans text-xs animate-fadeIn space-y-3">
          {/* Top User Info Card */}
          <div className="bg-[#0A0B0E] border border-[#22262E] p-3 rounded-md relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 to-indigo-500" />
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-mono font-black text-sm flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-bold text-white text-xs truncate">{user.name}</h3>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                    ONLINE
                  </span>
                </div>
                <p className="text-[10px] text-[#94A3B8] font-mono truncate">{user.email}</p>
                <div className="mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#38BDF8]" />
                  <span className="text-[10px] font-mono font-bold text-[#38BDF8]">{user.role}</span>
                </div>
              </div>
            </div>

            {editSuccess && (
              <div className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 p-1.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3 h-3" /> Profile updated successfully!
              </div>
            )}
          </div>

          {/* Edit Profile Form or Quick Profile Details */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-2.5 font-mono text-xs bg-[#0A0B0E] p-3 rounded border border-[#22262E]">
              <div className="flex items-center justify-between text-white font-bold text-[11px] border-b border-[#22262E] pb-1">
                <span>Edit Profile</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[#94A3B8] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="block text-[9px] text-[#94A3B8] uppercase font-bold mb-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#12141A] border border-[#22262E] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] text-[#94A3B8] uppercase font-bold mb-1">Role Title</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[#12141A] border border-[#22262E] rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
                >
                  <option value="Cluster Admin">Cluster Admin</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                  <option value="Site Reliability Engineer">Site Reliability Engineer</option>
                  <option value="Cloud Architect">Cloud Architect</option>
                  <option value="Infrastructure Engineer">Infrastructure Engineer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-1 bg-[#22262E] text-[#94A3B8] hover:text-white rounded text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-2 py-1 bg-[#38BDF8] text-black font-bold rounded text-[10px] hover:bg-sky-300 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 font-mono text-[11px] text-[#94A3B8]">
              <div className="flex items-center justify-between px-1">
                <span>Session Security:</span>
                <span className="text-white font-bold flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" /> Active Token
                </span>
              </div>
              <div className="flex items-center justify-between px-1">
                <span>Member Since:</span>
                <span className="text-white font-bold">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Session'}
                </span>
              </div>

              <button
                onClick={handleStartEdit}
                className="w-full py-1.5 px-2 bg-[#0A0B0E] hover:bg-[#1A1D26] text-[#E2E8F0] border border-[#22262E] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Edit Account Details</span>
              </button>

              {onOpenDbRecovery && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDbRecovery();
                  }}
                  className="w-full py-1.5 px-2 bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-500/40 hover:border-sky-400 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs font-bold"
                  title="Detect malformed database files, view backups, and recover database"
                >
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  <span>Database Recovery Utility</span>
                </button>
              )}

              {/* About Platform / Developer Credit */}
              <div className="bg-[#0A0B0E] p-2.5 rounded border border-[#22262E] space-y-1 font-mono text-[10px]">
                <div className="flex items-center justify-between text-[#E2E8F0] font-bold">
                  <span>Rayva Cloud Engine</span>
                  <span className="text-[#38BDF8] text-[9px] bg-[#38BDF8]/10 px-1 py-0.2 rounded border border-[#38BDF8]/30">v2.4</span>
                </div>
                <div className="text-[#94A3B8] font-sans text-[11px]">
                  Developed by <span className="text-white font-semibold">Abdul Rehman Yasir</span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[#22262E]" />

          {/* Logout Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>SIGN OUT OF RAYVA CLOUD</span>
          </button>
        </div>
      )}
    </div>
  );
};
