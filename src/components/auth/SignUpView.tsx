import React, { useState } from 'react';
import { User, Mail, Lock, ShieldCheck, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

const ROLES = [
  'DevOps Engineer',
  'Site Reliability Engineer',
  'Cloud Architect',
  'Infrastructure Engineer',
];

export const SignUpView: React.FC = () => {
  const { signup, setAuthView } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('DevOps Engineer');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    if (pass.length < 12) return { score: 1, label: 'Weak (Min 12 chars)', color: 'bg-rose-500' };
    if (pass.length >= 16 || (pass.length >= 12 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass))) {
      return { score: 3, label: 'Strong Security', color: 'bg-emerald-400' };
    }
    return { score: 2, label: 'Good Length (12+ chars)', color: 'bg-amber-400' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password, role);
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight flex items-center justify-between">
          <span>Create Account</span>
          <span className="text-[10px] sm:text-[11px] font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Sign Up
          </span>
        </h1>
        <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
          Register a new operator profile to access Rayva Cloud controls.
        </p>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-md text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      <form id="signup-form" onSubmit={handleSubmit} className="space-y-2.5 font-mono text-xs">
        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <User className="w-4 h-4" />
            </div>
            <input
              id="signup-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            Work Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="signup-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.io"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            System Role
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <select
              id="signup-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-[#12141A] text-white">
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="signup-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 12 characters (spaces & symbols allowed)"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-10 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
            <button
              id="signup-toggle-password-btn"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {password && (
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <div className={`h-1 w-12 rounded-full ${strength.color}`} />
                <span className="text-[#94A3B8]">{strength.label}</span>
              </div>
              {password.length >= 12 && <span className="text-emerald-400 font-bold">✓ Valid length</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="signup-confirm-password-input"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
          </div>
          {confirmPassword && password !== confirmPassword && (
            <span className="text-[10px] text-rose-400 block mt-1">Passwords do not match</span>
          )}
          {confirmPassword && password === confirmPassword && (
            <span className="text-[10px] text-emerald-400 block mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Passwords match
            </span>
          )}
        </div>

        <button
          id="signup-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>CREATE RAYVA CLOUD ACCOUNT</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-2 border-t border-[#22262E] text-center font-mono text-xs text-[#94A3B8]">
        Already have an account?{' '}
        <button
          id="signup-signin-link"
          onClick={() => setAuthView('login')}
          className="text-[#38BDF8] font-bold hover:underline cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
