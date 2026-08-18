import React, { useState } from 'react';
import { Mail, KeyRound, ArrowLeft, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const ForgotPasswordView: React.FC = () => {
  const { forgotPassword, setAuthView } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setSubmittedMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to process password reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToReset = () => {
    setAuthView('reset');
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
          <span>Forgot Password</span>
          <span className="text-[10px] sm:text-[11px] font-mono font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Recovery
          </span>
        </h1>
        <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
          Provide your registered account email to request a password reset token.
        </p>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-md text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {submittedMessage ? (
        <div id="forgot-password-success" className="space-y-3 font-mono text-xs animate-fadeIn">
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reset Request Processed</span>
            </div>
            <p className="text-xs text-[#E2E8F0] leading-relaxed">
              {submittedMessage}
            </p>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              If an account is associated with this email, use your reset token on the next screen to set a new password.
            </p>
          </div>

          <button
            id="forgot-password-proceed-btn"
            onClick={handleProceedToReset}
            className="w-full bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 cursor-pointer"
          >
            <span>ENTER RESET TOKEN</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <form id="forgot-password-form" onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
              Account Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="forgot-password-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.io"
                required
                className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 sm:py-2 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs"
              />
            </div>
          </div>

          <button
            id="forgot-password-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 sm:py-2.5 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4 stroke-[2.5]" />
                <span>SEND RESET REQUEST</span>
              </>
            )}
          </button>

          <div className="text-center">
            <button
              id="forgot-password-go-to-reset-btn"
              type="button"
              onClick={() => setAuthView('reset')}
              className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer font-mono"
            >
              Already have a reset token? Enter it here
            </button>
          </div>
        </form>
      )}

      <div className="pt-2 border-t border-[#22262E] text-center font-mono text-xs text-[#94A3B8]">
        Remembered your password?{' '}
        <button
          onClick={() => setAuthView('login')}
          className="text-[#38BDF8] font-bold hover:underline cursor-pointer"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};
