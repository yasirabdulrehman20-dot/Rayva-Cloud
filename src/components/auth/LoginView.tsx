import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const LoginView: React.FC = () => {
  const { login, setAuthView } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight flex items-center justify-between">
          <span>Authenticate Session</span>
          <span className="text-[10px] sm:text-[11px] font-mono font-normal text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded border border-[#38BDF8]/20">
            Sign In
          </span>
        </h1>
        <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
          Enter your credentials to access the Rayva Cloud cluster console.
        </p>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-md text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      <form id="login-form" onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
        <div>
          <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@organization.com"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 sm:py-2 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider">
              Password
            </label>
            <button
              id="login-forgot-password-link"
              type="button"
              onClick={() => setAuthView('forgot')}
              className="text-[10px] text-[#38BDF8] hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-10 py-1.5 sm:py-2 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
            />
            <button
              id="login-toggle-password-btn"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8] hover:text-[#E2E8F0] text-xs">
            <input
              id="login-remember-me-checkbox"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded bg-[#0A0B0E] border-[#22262E] text-[#38BDF8] focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Remember session on this node</span>
          </label>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full mt-1 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 sm:py-2.5 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>SIGN IN TO RAYVA CLOUD</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-2 border-t border-[#22262E] text-center font-mono text-xs text-[#94A3B8]">
        Don't have an account?{' '}
        <button
          id="login-signup-link"
          onClick={() => setAuthView('signup')}
          className="text-[#38BDF8] font-bold hover:underline cursor-pointer"
        >
          Sign Up for Free
        </button>
      </div>
    </div>
  );
};
