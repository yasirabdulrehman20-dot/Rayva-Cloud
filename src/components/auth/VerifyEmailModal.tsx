import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, KeyRound, Copy, Check, ServerOff, X, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VerifyEmailModal: React.FC<VerifyEmailModalProps> = ({ isOpen, onClose }) => {
  const {
    verifyEmail,
    demoActivate,
    resendVerification,
    verificationTokenInput,
    setVerificationTokenInput,
    unverifiedEmail,
    setUnverifiedEmail,
    devVerificationToken,
    emailServiceConfigured,
    isDemoMode,
    demoActivationTicket,
  } = useAuth();

  const [token, setToken] = useState(verificationTokenInput || '');
  const [emailForResend, setEmailForResend] = useState(unverifiedEmail || '');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoActivating, setDemoActivating] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);

  // Sync token and email if context changes
  useEffect(() => {
    if (verificationTokenInput) {
      setToken(verificationTokenInput);
    }
  }, [verificationTokenInput]);

  useEffect(() => {
    if (unverifiedEmail) {
      setEmailForResend(unverifiedEmail);
    }
  }, [unverifiedEmail]);

  // Reset local form error and state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      setResendStatus(null);
      if (verificationTokenInput) {
        setToken(verificationTokenInput);
      }
      if (unverifiedEmail) {
        setEmailForResend(unverifiedEmail);
      }
    }
  }, [isOpen, verificationTokenInput, unverifiedEmail]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Please enter your email verification token.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmail(trimmedToken);
      setSuccessMessage(res.message || 'Email verified successfully. You can now log in.');
      setVerificationTokenInput('');
      
      // Auto close after successful verification with clear feedback
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify email. The token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoActivate = async () => {
    setError(null);
    setSuccessMessage(null);
    setDemoActivating(true);

    try {
      const res = await demoActivate(unverifiedEmail);
      setSuccessMessage(res.message || 'Demo account activated successfully. You can now log in.');
      setVerificationTokenInput('');

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Demo activation failed. Please try signing up again.');
    } finally {
      setDemoActivating(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendStatus(null);

    const targetEmail = (emailForResend || unverifiedEmail || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid email address to request a new verification token.');
      return;
    }

    setResendLoading(true);
    try {
      const res = await resendVerification(targetEmail);
      setResendStatus(res.message || 'If an account exists and requires verification, instructions have been generated.');
      if (res.devVerificationToken) {
        setToken(res.devVerificationToken);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request new verification instructions.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCopyDevToken = (tokenToCopy: string) => {
    navigator.clipboard.writeText(tokenToCopy);
    setCopied(true);
    setToken(tokenToCopy);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToSignIn = () => {
    onClose();
  };

  // Determine whether demo activation flow applies (demo mode enabled and SMTP not configured)
  const isDemoActivationAvailable = isDemoMode && emailServiceConfigured === false;

  return (
    <div
      id="verification-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-modal-title"
    >
      <div
        id="verification-modal-card"
        className="w-full max-w-[460px] bg-[#12141A] border border-[#22262E] border-t-2 border-t-[#38BDF8] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 sm:p-5 text-[#E2E8F0] font-sans relative transform transition-all animate-scaleUp"
      >
        {/* Close / X Button */}
        <button
          id="verification-modal-close-btn"
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-[#1E222D] transition-colors cursor-pointer"
          aria-label="Close verification modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="pr-8 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30">
              Account Activation
            </span>
            {isDemoActivationAvailable && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Demo Mode
              </span>
            )}
          </div>
          <h2
            id="verification-modal-title"
            className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight"
          >
            Verify Your Email
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-1 leading-relaxed">
            Your account needs to be verified before you can access Rayva Cloud.
          </p>
        </div>

        {/* Highlighted Non-Editable Email Badge if available */}
        {unverifiedEmail && (
          <div
            id="unverified-email-badge"
            className="mb-3 p-2 bg-[#0A0B0E] border border-[#22262E] rounded-md font-mono text-xs flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              <span className="text-[#94A3B8] text-[11px] truncate">Target Account:</span>
              <span className="text-white font-bold text-[11px] truncate">{unverifiedEmail}</span>
            </div>
            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
              Pending
            </span>
          </div>
        )}

        {/* Demo Mode Notice: Clear and professional explanation */}
        {isDemoActivationAvailable ? (
          <div
            id="modal-demo-mode-notice"
            className="mb-3 p-2.5 bg-slate-900/90 border border-[#38BDF8]/30 rounded-md font-mono text-xs space-y-1.5"
          >
            <div className="flex items-center gap-1.5 text-[#38BDF8] font-bold text-[10px] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Public Demo Instance
            </div>
            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
              Email delivery is unavailable on this demo instance. Demo accounts can be activated instantly.
            </p>
          </div>
        ) : emailServiceConfigured === false ? (
          <div
            id="modal-email-offline-notice"
            className="mb-3 p-2.5 bg-slate-900/90 border border-amber-500/30 rounded-md font-mono text-xs space-y-1"
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
              <ServerOff className="w-3.5 h-3.5" /> Email delivery is currently unavailable on this instance.
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Live SMTP email delivery is offline. If you have been issued a security token, enter it below to activate your account.
            </p>
          </div>
        ) : null}

        {/* Development/Demo Token Helper (Non-Production dev only) */}
        {devVerificationToken && !isDemoActivationAvailable && !successMessage && (
          <div
            id="modal-dev-token-helper"
            className="mb-3 p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-md font-mono text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Non-Production Simulated Token
              </span>
              <button
                id="modal-apply-dev-token-btn"
                type="button"
                onClick={() => handleCopyDevToken(devVerificationToken)}
                className="text-[10px] text-amber-300 hover:text-white flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded cursor-pointer transition-colors font-bold"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Applied to Input' : 'Use Token'}
              </button>
            </div>
            <p className="text-[10px] text-[#94A3B8] break-all">
              Token: <code className="text-amber-200 font-mono bg-black/40 px-1 py-0.5 rounded">{devVerificationToken}</code>
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            id="modal-verify-error-msg"
            className="mb-3 p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-md text-rose-300 text-xs font-mono flex items-start gap-2 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Success message */}
        {successMessage ? (
          <div id="modal-verify-success-container" className="space-y-3 font-mono text-xs animate-fadeIn">
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-md space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Account Activated</span>
              </div>
              <p className="text-xs text-[#E2E8F0] leading-relaxed">
                {successMessage}
              </p>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Your operator credentials are now fully active. Returning to sign in...
              </p>
            </div>

            <button
              id="modal-proceed-to-signin-btn"
              type="button"
              onClick={handleBackToSignIn}
              className="w-full bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 cursor-pointer"
            >
              <span>RETURN TO SIGN IN</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {/* Demo Mode Direct Activation Action */}
            {isDemoActivationAvailable ? (
              <div className="space-y-2">
                <button
                  id="modal-demo-activate-btn"
                  type="button"
                  onClick={handleDemoActivate}
                  disabled={demoActivating}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2.5 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {demoActivating ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>ACTIVATE DEMO ACCOUNT</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-[#94A3B8]/70">
                  Activates your public operator account instantly for this demo session.
                </p>
              </div>
            ) : (
              /* Token Submission Form (only when real email delivery configured or non-demo manual token mode) */
              <form id="modal-verify-token-form" onSubmit={handleVerify} className="space-y-3">
                <div>
                  <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider mb-1">
                    Verification Token
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="modal-verification-token-input"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="vfy-xxxxxxxxxxxxxxxxxxxxxxxx"
                      required
                      className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-2 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]/70 mt-1">
                    Cryptographic single-use token expiring in 24 hours.
                  </p>
                </div>

                <button
                  id="modal-verify-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold py-2 sm:py-2.5 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>VERIFY EMAIL</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Resend Verification Section (only shown when real email service configured) */}
            {emailServiceConfigured && (
              <div className="pt-2.5 border-t border-[#22262E]">
                {!showResendForm ? (
                  <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                    <span>Need a new token?</span>
                    <button
                      id="modal-show-resend-form-btn"
                      type="button"
                      onClick={() => setShowResendForm(true)}
                      className="text-[#38BDF8] hover:underline cursor-pointer flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend Verification
                    </button>
                  </div>
                ) : (
                  <form id="modal-resend-verification-form" onSubmit={handleResend} className="space-y-2 pt-1 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="block text-[#94A3B8] font-bold uppercase text-[10px] tracking-wider">
                        Resend Verification
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowResendForm(false)}
                        className="text-[10px] text-[#94A3B8] hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="modal-resend-email-input"
                        type="email"
                        value={emailForResend}
                        onChange={(e) => setEmailForResend(e.target.value)}
                        placeholder="registered-email@company.io"
                        required
                        className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-md pl-9 pr-3 py-1.5 text-[#E2E8F0] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition-all text-xs font-mono"
                      />
                    </div>

                    {resendStatus && (
                      <div id="modal-resend-status-msg" className="p-2 bg-emerald-950/40 border border-emerald-500/40 rounded text-emerald-300 text-[10px] leading-relaxed">
                        {resendStatus}
                      </div>
                    )}

                    <button
                      id="modal-resend-submit-btn"
                      type="submit"
                      disabled={resendLoading}
                      className="w-full bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#38BDF8]/30 font-bold py-1.5 px-3 rounded text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {resendLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Send New Token</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Back to Sign In footer */}
            <div className="pt-2 border-t border-[#22262E] flex items-center justify-between text-xs font-mono">
              <button
                id="modal-back-to-signin-btn"
                type="button"
                onClick={handleBackToSignIn}
                className="text-[#94A3B8] hover:text-[#38BDF8] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>

              <button
                id="modal-footer-close-btn"
                type="button"
                onClick={onClose}
                className="text-[#94A3B8] hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
