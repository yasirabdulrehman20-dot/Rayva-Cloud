import React from 'react';
import { Cloud, ShieldCheck, Terminal, Server, Cpu } from 'lucide-react';
import { RayvaLogo } from '../RayvaLogo';
import { useAuth } from '../../context/AuthContext.tsx';
import { LoginView } from './LoginView.tsx';
import { SignUpView } from './SignUpView.tsx';
import { ForgotPasswordView } from './ForgotPasswordView.tsx';
import { ResetPasswordView } from './ResetPasswordView.tsx';
import { VerifyEmailModal } from './VerifyEmailModal.tsx';

export const AuthLayout: React.FC = () => {
  const { authView, isVerificationModalOpen, closeVerificationModal } = useAuth();

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col justify-between bg-[#0A0B0E] text-[#E2E8F0] font-sans selection:bg-[#38BDF8] selection:text-black relative"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.12) 0%, transparent 60%),
          radial-gradient(circle at 85% 85%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
          linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px',
      }}
    >
      {/* Floating Verification Modal - Rendered ONLY when isVerificationModalOpen === true */}
      {isVerificationModalOpen === true && (
        <VerifyEmailModal
          isOpen={isVerificationModalOpen}
          onClose={closeVerificationModal}
        />
      )}

      {/* Top Header Bar */}
      <header className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between border-b border-[#22262E]/60 bg-[#0A0B0E]/80 backdrop-blur-md w-full">
        <div className="flex items-center gap-3 min-w-0">
          <RayvaLogo size={28} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-sm tracking-wider text-white whitespace-nowrap">RAYVA CLOUD</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 whitespace-nowrap">
                v2.4 SECURE
              </span>
            </div>
            <span className="text-[10px] text-[#94A3B8] font-mono block truncate">Distributed Job Scheduler &amp; Control Plane</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 md:gap-4 text-xs font-mono text-[#94A3B8] flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-[#12141A] px-2.5 py-1 rounded border border-[#22262E] whitespace-nowrap">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nodes: <strong className="text-white">Active</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#12141A] px-2.5 py-1 rounded border border-[#22262E] whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>TLS 1.3 Encryption</span>
          </div>
        </div>
      </header>

      {/* Main Form Center Box */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-2 sm:py-3.5 w-full">
        <div className="w-full max-w-[448px]">
          {/* Top Security Status Indicator */}
          <div className="mb-1.5 flex items-center justify-between px-1 font-mono text-[11px] text-[#94A3B8] gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Terminal className="w-3.5 h-3.5 text-[#38BDF8] flex-shrink-0" />
              <span className="truncate font-bold tracking-wider">CLUSTER ACCESS GATEWAY</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 font-bold flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>

          {/* Card Frame */}
          <div className="bg-[#12141A] border border-[#22262E] border-t-2 border-t-[#38BDF8] rounded-lg shadow-2xl p-4 sm:p-5 backdrop-blur-xl w-full">
            {(authView === 'login' || authView === 'verify') && <LoginView />}
            {authView === 'signup' && <SignUpView />}
            {authView === 'forgot' && <ForgotPasswordView />}
            {authView === 'reset' && <ResetPasswordView />}
          </div>

          {/* Footer Quote / Notice */}
          <div className="mt-1.5 text-center font-mono text-[10px] text-[#94A3B8]/70 flex items-center justify-center gap-1.5 px-1">
            <Cpu className="w-3 h-3 text-[#38BDF8] flex-shrink-0" />
            <span className="leading-tight">Rayva Cloud Resource-Aware Scheduler • Cryptographically Verified Operations</span>
          </div>
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-2.5 border-t border-[#22262E]/60 bg-[#0A0B0E]/90 text-[11px] font-mono text-[#94A3B8] flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-start min-w-0">
          <span className="whitespace-nowrap">&copy; {new Date().getFullYear()} Rayva Cloud Systems. All rights reserved.</span>
          <span className="text-[#22262E] hidden md:inline">|</span>
          <span className="text-[#94A3B8] font-sans text-[10px] hidden md:inline whitespace-nowrap">
            Developed by <span className="text-slate-200 font-semibold">Abdul Rehman Yasir</span>
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-[10px] flex-wrap justify-center sm:justify-end flex-shrink-0">
          <span className="text-[#94A3B8] font-sans md:hidden whitespace-nowrap">
            Developed by <span className="text-slate-200 font-semibold">Abdul Rehman Yasir</span>
          </span>
          <span className="text-emerald-400 whitespace-nowrap">● Auth Service Status: Operational</span>
          <span className="text-[#38BDF8] whitespace-nowrap">● SHA-256 Hash Chain: Active</span>
        </div>
      </footer>
    </div>
  );
};
