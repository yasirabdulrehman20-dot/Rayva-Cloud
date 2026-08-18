import React, { useState } from 'react';
import { KeyRound, Lock, ArrowLeft, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const ResetPasswordView: React.FC = () => {
  const { resetPassword, resetTokenInput, setAuthView } = useAuth();
  const [token, setToken] = useState(resetTokenInput || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Please enter your password reset token.');
      return;
    }
    if (!newPassword || newPassword.length < 12) {
      setError('New password must be at least 12 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token.trim(), newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div>
        <button
          onClick={() => setAuthView('login')}
          className="text-[11px] font-mono text-[#94A3B8] hover:text-[#38BDF8] flex items-center gap-1.5 mb-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h1 className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight flex items-center justify-between">
          <span>Reset Password</span>
          <span className="text-[10px] sm:text-[11px] font-mono font-normal text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            Set Password
          </span>
        </h1>
        <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
          Enter your security reset token and set a new password.
        </p>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-md text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {success ? (
        <div id="reset-password-success" className="space-y-3 font-mono text-xs animate-fadeIn">
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-md space-y-1.5 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <h2 className="text-sm font-bold text-white">Password Updated Successfully!</h2>
            <p className="text-xs text-[#94A3B8]">
              Your Rayva Cloud cluster account password has been changed. You can now sign in using your new credentials.
            </p>
          </div>

          <button
            id="reset-password-signin-btn"
            onClick={() => setAuthView('login')}
            className="w-full bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 px-4 rounded-md text-xs transition-all cursor-pointer"
          >
            SIGN IN NOW
          </button>
        </div>
      ) : (
        <form id="reset-password-form" onSubmit={handleSubmit} className="space-y-2.5 font-mono text-xs">
          <div>
            <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
              Reset Security Token
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="reset-password-token-input"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="e.g. rst-abc123xyz"
                required
                className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reset-password-new-input"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 12 characters"
                required
                className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-10 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
              />
              <button
                id="reset-password-toggle-new-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="reset-password-confirm-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
              />
            </div>
          </div>

          <button
            id="reset-password-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-1 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>SAVE NEW PASSWORD</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
