import React, { useState, useEffect } from 'react';
import { SystemStatus, SchedulerStrategyType } from '../shared/types.js';
import {
  PlaySquare,
  Plus,
  RefreshCw,
  Cpu,
  GitBranch,
  AlertTriangle,
  Wrench,
  Activity,
  Moon,
  Sun,
  Database,
  Pause,
  Play,
} from 'lucide-react';
import { UserProfileMenu } from './UserProfileMenu.tsx';

interface NavbarProps {
  status: SystemStatus | null;
  onOpenQuickSubmit: () => void;
  onRefresh: () => void;
  onChangeStrategy: (strat: SchedulerStrategyType) => void;
  onToggleMaintenance?: (enabled: boolean) => void;
  canManageMaintenance?: boolean;
  onOpenHealthReport?: () => void;
  onExportBundleJson?: () => void;
  onExportBundlePdf?: () => void;
  onOpenSnapshots?: () => void;
  onOpenDbRecovery?: () => void;
  isAutoRefresh?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  onOpenQuickSubmit,
  onRefresh,
  onChangeStrategy,
  onToggleMaintenance,
  canManageMaintenance = false,
  onOpenHealthReport,
  onExportBundleJson,
  onExportBundlePdf,
  onOpenSnapshots,
  onOpenDbRecovery,
  isAutoRefresh = true,
  onToggleAutoRefresh,
}) => {
  const isMaintenance = Boolean(status?.maintenanceMode);
  
  const [isLightMode, setIsLightMode] = useState(() => {
    return document.documentElement.classList.contains('theme-light');
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, [isLightMode]);

  return (
    <header className="min-h-[48px] py-1.5 md:py-0 px-3 md:px-4 bg-[#12141A] border-b border-[#22262E] flex flex-wrap md:flex-nowrap items-center justify-between shrink-0 font-sans gap-2 transition-all">
      {/* Left controls & status elements */}
      <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 md:gap-3 min-w-0">
        {/* Active Strategy Selector */}
        <div className="flex items-center gap-1.5 bg-[#0A0B0E] px-2 py-1 rounded border border-[#22262E] text-xs shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span className="text-[#94A3B8] font-mono text-[11px] uppercase tracking-wide hidden sm:inline">Strategy:</span>
          <select
            value={status?.activeStrategy || 'RESOURCE_AWARE'}
            onChange={(e) => onChangeStrategy(e.target.value as SchedulerStrategyType)}
            className="bg-transparent text-[#E2E8F0] font-mono font-bold text-xs focus:outline-none cursor-pointer max-w-[110px] sm:max-w-none truncate"
          >
            <option value="RESOURCE_AWARE" className="bg-[#12141A] text-[#E2E8F0]">
              Resource Aware
            </option>
            <option value="ROUND_ROBIN" className="bg-[#12141A] text-[#E2E8F0]">
              Round Robin
            </option>
            <option value="LEAST_LOADED" className="bg-[#12141A] text-[#E2E8F0]">
              Least Loaded
            </option>
            <option value="PRIORITY" className="bg-[#12141A] text-[#E2E8F0]">
              Priority Driven
            </option>
            <option value="PREDICTIVE_AI" className="bg-[#12141A] text-[#E2E8F0]">
              Predictive AI
            </option>
          </select>
        </div>

        {/* Maintenance Mode Toggle Switch */}
        {canManageMaintenance && <div
          onClick={() => onToggleMaintenance?.(!isMaintenance)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono transition-all cursor-pointer select-none shrink-0 ${
            isMaintenance
              ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              : 'bg-[#0A0B0E] border-[#22262E] text-[#94A3B8] hover:border-[#38BDF8]/40 hover:text-[#E2E8F0]'
          }`}
          title={isMaintenance ? 'Maintenance Mode is ACTIVE (Job submissions suspended)' : 'Click to enable Maintenance Mode'}
        >
          <Wrench className={`w-3.5 h-3.5 transition-transform ${isMaintenance ? 'text-amber-400 rotate-12' : 'text-[#94A3B8]'}`} />
          <span className="text-[11px] font-bold uppercase tracking-wide hidden md:inline">
            Maintenance
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isMaintenance}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isMaintenance ? 'bg-amber-500' : 'bg-[#22262E]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                isMaintenance ? 'translate-x-3 bg-black' : 'translate-x-0 bg-[#94A3B8]'
              }`}
            />
          </button>
        </div>}

        {/* Cluster Metric Pills */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono shrink-0">
          <div
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 text-[11px] transition-all ${
              (status?.systemCpuUsage || 0) >= 90
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'bg-[#0A0B0E] border-[#22262E] text-[#E2E8F0]'
            }`}
          >
            <Cpu className={`w-3.5 h-3.5 ${(status?.systemCpuUsage || 0) >= 90 ? 'text-rose-400' : 'text-[#38BDF8]'}`} />
            <span className={(status?.systemCpuUsage || 0) >= 90 ? 'text-rose-300' : 'text-[#94A3B8]'}>CPU:</span>
            <span className={(status?.systemCpuUsage || 0) >= 90 ? 'text-rose-400 font-extrabold' : 'text-[#38BDF8] font-bold'}>
              {status?.systemCpuUsage || 0}%
            </span>
          </div>

          <div
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 text-[11px] transition-all ${
              (status?.systemRamUsage || 0) >= 90
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'bg-[#0A0B0E] border-[#22262E] text-[#E2E8F0]'
            }`}
          >
            <span className={(status?.systemRamUsage || 0) >= 90 ? 'text-rose-300' : 'text-[#94A3B8]'}>RAM:</span>
            <span className={(status?.systemRamUsage || 0) >= 90 ? 'text-rose-400 font-extrabold' : 'text-purple-400 font-bold'}>
              {status?.systemRamUsage || 0}%
            </span>
          </div>

          {((status?.systemCpuUsage || 0) >= 90 || (status?.systemRamUsage || 0) >= 90) && (
            <div className="bg-rose-500 text-black px-2.5 py-1 rounded font-extrabold flex items-center gap-1.5 animate-bounce text-[10px] tracking-wider uppercase">
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>ALERT &gt;90% LOAD</span>
            </div>
          )}

          {status?.simulationActive && (
            <div className="bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30 text-amber-400 flex items-center gap-1.5 animate-pulse text-[10px] font-bold">
              <PlaySquare className="w-3 h-3" />
              <span>SIMULATION ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Right controls: Theme, Refresh, Submit CTA, User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsLightMode(!isLightMode)}
          className="p-1.5 text-[#94A3B8] hover:text-white bg-[#0A0B0E] hover:bg-[#22262E] rounded border border-[#22262E] transition-colors cursor-pointer shrink-0"
          title={isLightMode ? "Switch to High Density Dark Mode" : "Switch to High Contrast Light Mode"}
        >
          {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Consolidated Live Status & Refresh Control Group */}
        <div className="flex items-center rounded border border-[#22262E] bg-[#0A0B0E] p-0.5 text-xs font-mono shrink-0">
          {onToggleAutoRefresh && (
            <button
              onClick={() => onToggleAutoRefresh(!isAutoRefresh)}
              className={`live-button flex items-center gap-2 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer select-none border ${
                isAutoRefresh
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-100 border-emerald-500/40 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                  : 'text-amber-300 hover:text-amber-100 bg-amber-950/80 hover:bg-amber-900/80 border-amber-500/60 hover:border-amber-400 shadow-sm'
              }`}
              title={
                isAutoRefresh
                  ? 'Auto-Refresh ACTIVE (2s interval). Click to pause auto-updates for manual inspection.'
                  : 'Auto-Refresh PAUSED for manual inspection. Click to resume live auto-updates.'
              }
            >
              <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                {isAutoRefresh && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isAutoRefresh
                      ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      : 'bg-amber-400'
                  }`}
                />
              </span>
              <span className="tracking-wider text-[11px] font-bold hidden sm:inline">
                {isAutoRefresh ? 'LIVE' : 'PAUSED'}
              </span>
              {isAutoRefresh ? (
                <Pause className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Play className="w-3 h-3 text-amber-300 fill-amber-300 shrink-0" />
              )}
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1 text-[#94A3B8] hover:text-white hover:bg-[#22262E] rounded transition-colors cursor-pointer border-l border-[#22262E] ml-0.5 px-1.5"
            title="Manual refresh cluster state now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Submit Job Primary CTA */}
        <button
          onClick={onOpenQuickSubmit}
          className="flex items-center gap-1 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold px-2.5 py-1.5 rounded text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          title="Submit a new job to the Rayva Cluster"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="hidden sm:inline">SUBMIT JOB</span>
        </button>

        {/* User Account & Profile Menu */}
        <div className="border-l border-[#22262E] pl-1.5 sm:pl-2 shrink-0">
          <UserProfileMenu onOpenDbRecovery={onOpenDbRecovery} />
        </div>
      </div>
    </header>
  );
};

