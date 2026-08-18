import React, { useState } from 'react';
import { SystemStatus, WorkerNodeData, Job, SystemLog } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import {
  Cpu,
  Server,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlaySquare,
  ArrowRight,
  TrendingUp,
  X,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface DashboardViewProps {
  status: SystemStatus | null;
  workers: WorkerNodeData[];
  jobs: Job[];
  logs: SystemLog[];
  user?: any;
  onNavigate: (tab: any) => void;
  onViewJob: (job: Job) => void;
  onViewWorker: (worker: WorkerNodeData) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  workers,
  jobs,
  logs,
  user,
  onNavigate,
  onViewJob,
  onViewWorker,
}) => {
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [isStressLoading, setIsStressLoading] = useState(false);

  const isAdmin = user?.role === 'Cluster Admin';

  const activeJobsCount = isAdmin
    ? (status?.activeJobs || 0)
    : jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED' || j.status === 'SCHEDULING').length;

  const queuedJobsCount = isAdmin
    ? (status?.queuedJobs || 0)
    : jobs.filter((j) => j.status === 'QUEUED' || j.status === 'RETRYING').length;

  const completedJobsCount = isAdmin
    ? (status?.completedJobs || 0)
    : jobs.filter((j) => j.status === 'COMPLETED').length;

  const failedJobsCount = isAdmin
    ? (status?.failedJobs || 0)
    : jobs.filter((j) => j.status === 'FAILED').length;

  const recentJobs = jobs.slice(0, 8);
  const recentLogs = logs.slice(0, 6);

  const cpuUsage = status?.systemCpuUsage || 0;
  const ramUsage = status?.systemRamUsage || 0;
  const isCpuCritical = cpuUsage >= 90;
  const isRamCritical = ramUsage >= 90;

  const overloadedWorkers = workers.filter(
    (w) => w.currentCpuUsage >= 90 || w.currentRamUsage >= 90
  );
  const isAnyResourceOver90 = isCpuCritical || isRamCritical || overloadedWorkers.length > 0;

  const triggerStressLoad = async () => {
    setIsStressLoading(true);
    try {
      await fetch('/api/system/stress-load', { method: 'POST' });
      setAlertDismissed(false);
    } catch (e) {
      console.error('Failed to trigger stress load:', e);
    } finally {
      setIsStressLoading(false);
    }
  };

  const relieveStressLoad = async () => {
    try {
      await fetch('/api/system/clear-stress', { method: 'POST' });
    } catch (e) {
      console.error('Failed to relieve stress load:', e);
    }
  };

  // Worker utilization data for chart
  const workerChartData = workers.map((w) => ({
    name: getWorkerDisplayName(w.id, w.name),
    cpu: w.currentCpuUsage,
    ram: w.currentRamUsage,
    workload: w.currentWorkload,
    score: w.score || 0,
  }));

  return (
    <div className="p-3 sm:p-4 space-y-4 max-w-[1600px] w-full min-w-0 max-w-full mx-auto font-sans text-[#E2E8F0]">
      {/* --- VISUAL RESOURCE OVERLOAD NOTIFICATION BANNER (>90%) --- */}
      {isAnyResourceOver90 && !alertDismissed && (
        <div className="relative overflow-hidden bg-rose-950/80 border-2 border-rose-500 rounded-sm p-3 sm:p-4 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)] transition-all animate-pulse w-full min-w-0">
          <div className="absolute -right-12 -top-12 opacity-10 pointer-events-none">
            <ShieldAlert className="w-64 h-64 text-rose-500" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10 w-full min-w-0">
            <div className="flex items-start md:items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-rose-500 text-black rounded-sm shrink-0 animate-bounce">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-extrabold font-mono tracking-wider text-white uppercase flex items-center gap-2 break-words">
                    CRITICAL RESOURCE OVERLOAD WARNING (&gt;90%)
                  </h2>
                  <span className="bg-rose-500 text-black font-extrabold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono animate-ping shrink-0">
                    CRITICAL ALERT
                  </span>
                </div>

                <p className="text-xs text-rose-200 mt-1 font-sans break-words">
                  {isCpuCritical && isRamCritical
                    ? `Cluster CPU usage (${cpuUsage}%) and RAM usage (${ramUsage}%) have breached the 90% critical safety threshold!`
                    : isCpuCritical
                    ? `Cluster CPU usage (${cpuUsage}%) has breached the 90% critical threshold!`
                    : isRamCritical
                    ? `Cluster RAM usage (${ramUsage}%) has breached the 90% critical threshold!`
                    : `${overloadedWorkers.length} worker node(s) exceed 90% utilization limit!`}
                  {' '}Task scheduling performance may degrade or experience execution delays.
                </p>

                {/* Gauge Meters in Alert Banner */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 font-mono text-xs">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-rose-300 font-bold text-[11px] shrink-0">CPU Load:</span>
                    <div className="w-24 sm:w-32 bg-slate-900 h-2 rounded-xs overflow-hidden border border-rose-500/50 relative shrink-0">
                      <div
                        className={`h-full ${cpuUsage >= 90 ? 'bg-rose-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(100, cpuUsage)}%` }}
                      ></div>
                      <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-white opacity-80" title="90% Threshold"></div>
                    </div>
                    <span className={`font-bold ${cpuUsage >= 90 ? 'text-rose-400' : 'text-slate-300'} shrink-0`}>
                      {cpuUsage}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-rose-300 font-bold text-[11px] shrink-0">RAM Load:</span>
                    <div className="w-24 sm:w-32 bg-slate-900 h-2 rounded-xs overflow-hidden border border-rose-500/50 relative shrink-0">
                      <div
                        className={`h-full ${ramUsage >= 90 ? 'bg-rose-500' : 'bg-purple-400'}`}
                        style={{ width: `${Math.min(100, ramUsage)}%` }}
                      ></div>
                      <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-white opacity-80" title="90% Threshold"></div>
                    </div>
                    <span className={`font-bold ${ramUsage >= 90 ? 'text-rose-400' : 'text-slate-300'} shrink-0`}>
                      {ramUsage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Quick Actions */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
              <button
                onClick={relieveStressLoad}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-sm text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>RELIEVE LOAD</span>
              </button>

              <button
                onClick={() => onNavigate('workers')}
                className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/60 font-semibold px-3 py-1.5 rounded-sm text-xs transition-colors cursor-pointer"
              >
                Inspect Workers
              </button>

              <button
                onClick={() => setAlertDismissed(true)}
                className="p-1 text-rose-300 hover:text-white hover:bg-rose-800/50 rounded-sm transition-colors cursor-pointer ml-auto md:ml-0"
                title="Dismiss Notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Hero Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full min-w-0">
        {/* Stat Card 1 */}
        <div className="bg-[#12141A] border border-[#22262E] hover:border-[#38BDF8]/50 hover:bg-[#161922] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(56,189,248,0.08)] transition-all duration-200 p-2.5 rounded-sm flex flex-col justify-between min-w-0">
          <div className="text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider flex justify-between items-center gap-1">
            <span className="truncate">Cluster Health</span>
            <Server className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap min-w-0">
            <span className="text-base font-bold font-mono text-emerald-400 shrink-0">
              {status?.totalWorkers
                ? `${((status.onlineWorkers / status.totalWorkers) * 100).toFixed(1)}%`
                : '100.0%'}
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 whitespace-nowrap">
              {status?.onlineWorkers || 0}/{status?.totalWorkers || 0} Nodes
            </span>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-[#12141A] border border-[#22262E] hover:border-[#38BDF8]/50 hover:bg-[#161922] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(56,189,248,0.08)] transition-all duration-200 p-2.5 rounded-sm flex flex-col justify-between min-w-0">
          <div className="text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider flex justify-between items-center gap-1">
            <span className="truncate">Active Jobs</span>
            <Activity className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap min-w-0">
            <span className="text-base font-bold font-mono text-[#38BDF8] shrink-0">
              {activeJobsCount}
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 whitespace-nowrap">
              {queuedJobsCount} Queued
            </span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-[#12141A] border border-[#22262E] hover:border-emerald-500/50 hover:bg-[#161922] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(34,197,94,0.08)] transition-all duration-200 p-2.5 rounded-sm flex flex-col justify-between min-w-0">
          <div className="text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider flex justify-between items-center gap-1">
            <span className="truncate">Completed Jobs</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap min-w-0">
            <span className="text-base font-bold font-mono text-emerald-400 shrink-0">
              {completedJobsCount}
            </span>
            <span className="text-[10px] font-mono text-rose-400 shrink-0 whitespace-nowrap">
              {failedJobsCount} Fail
            </span>
          </div>
        </div>

        {/* Stat Card 4 - CPU LOAD */}
        <div
          className={`p-2.5 rounded-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 min-w-0 ${
            isCpuCritical
              ? 'bg-rose-950/40 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
              : 'bg-[#12141A] border border-[#22262E] hover:border-[#38BDF8]/50 hover:bg-[#161922] hover:shadow-[0_4px_12px_rgba(56,189,248,0.08)]'
          }`}
        >
          <div className="text-[10px] uppercase font-semibold tracking-wider flex justify-between items-center gap-1">
            <span className={`truncate ${isCpuCritical ? 'text-rose-300 font-bold' : 'text-[#94A3B8]'}`}>
              CPU Load
            </span>
            <Cpu className={`w-3.5 h-3.5 shrink-0 ${isCpuCritical ? 'text-rose-400' : 'text-[#38BDF8]'}`} />
          </div>
          <div className="mt-1 space-y-1 min-w-0">
            <div className="flex justify-between items-center text-xs font-mono gap-1 flex-wrap">
              <span className={`font-bold text-base ${isCpuCritical ? 'text-rose-400' : 'text-[#38BDF8]'}`}>
                {cpuUsage}%
              </span>
              {isCpuCritical && (
                <span className="text-[8px] font-extrabold bg-rose-500 text-black px-1 py-0.2 rounded-xs uppercase tracking-wider shrink-0 whitespace-nowrap">
                  &gt;90% OVERLOAD
                </span>
              )}
            </div>
            <div className="w-full bg-[#0A0B0E] h-1 rounded-xs overflow-hidden border border-[#22262E] relative">
              <div
                className={`h-full transition-all duration-300 ${
                  isCpuCritical ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-[#38BDF8]'
                }`}
                style={{ width: `${cpuUsage}%` }}
              ></div>
              <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-rose-400 opacity-60"></div>
            </div>
          </div>
        </div>

        {/* Stat Card 5 - RAM USAGE */}
        <div
          className={`p-2.5 rounded-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 min-w-0 ${
            isRamCritical
              ? 'bg-rose-950/40 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
              : 'bg-[#12141A] border border-[#22262E] hover:border-purple-500/50 hover:bg-[#161922] hover:shadow-[0_4px_12px_rgba(168,85,247,0.08)]'
          }`}
        >
          <div className="text-[10px] uppercase font-semibold tracking-wider flex justify-between items-center gap-1">
            <span className={`truncate ${isRamCritical ? 'text-rose-300 font-bold' : 'text-[#94A3B8]'}`}>
              RAM Usage
            </span>
            <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${isRamCritical ? 'text-rose-400' : 'text-purple-400'}`} />
          </div>
          <div className="mt-1 space-y-1 min-w-0">
            <div className="flex justify-between items-center text-xs font-mono gap-1 flex-wrap">
              <span className={`font-bold text-base ${isRamCritical ? 'text-rose-400' : 'text-purple-400'}`}>
                {ramUsage}%
              </span>
              {isRamCritical && (
                <span className="text-[8px] font-extrabold bg-rose-500 text-black px-1 py-0.2 rounded-xs uppercase tracking-wider shrink-0 whitespace-nowrap">
                  &gt;90% OVERLOAD
                </span>
              )}
            </div>
            <div className="w-full bg-[#0A0B0E] h-1 rounded-xs overflow-hidden border border-[#22262E] relative">
              <div
                className={`h-full transition-all duration-300 ${
                  isRamCritical ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-purple-500'
                }`}
                style={{ width: `${ramUsage}%` }}
              ></div>
              <div className="absolute top-0 bottom-0 left-[90%] w-0.5 bg-rose-400 opacity-60"></div>
            </div>
          </div>
        </div>

        {/* Stat Card 6 */}
        <div className="bg-[#12141A] border border-[#22262E] hover:border-amber-500/50 hover:bg-[#161922] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.08)] transition-all duration-200 p-2.5 rounded-sm flex flex-col justify-between min-w-0">
          <div className="text-[10px] uppercase font-semibold text-[#94A3B8] tracking-wider flex justify-between items-center gap-1">
            <span className="truncate">Avg Runtime</span>
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline gap-1 min-w-0">
            <span className="text-base font-bold font-mono text-amber-400 shrink-0">
              {status?.avgExecutionTimeMs || 0}
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">ms</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Job Queue Panel & Worker Registry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full min-w-0">
        {/* Active Job Queue Panel */}
        <div className="lg:col-span-2 bg-[#12141A] border border-[#22262E] rounded-sm flex flex-col overflow-hidden w-full min-w-0">
          <div className="px-3 sm:px-4 py-2.5 bg-[#161922] border-b border-[#22262E] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider font-mono flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              Active Job Queue
            </span>
            <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                Strategy: <strong className="text-[#38BDF8]">{status?.activeStrategy || 'RESOURCE_AWARE'}</strong>
              </span>
              <button
                onClick={() => onNavigate('jobs')}
                className="text-[11px] font-mono text-[#38BDF8] hover:underline flex items-center gap-1"
              >
                All Jobs <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full max-w-full min-w-0 flex-1">
            <table className="w-full min-w-[540px] text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#22262E] text-[#94A3B8] text-[10px] uppercase tracking-wider bg-[#0A0B0E]/60">
                  <th className="py-2 px-3 font-medium">JOB ID</th>
                  <th className="py-2 px-3 font-medium">NAME</th>
                  <th className="py-2 px-3 font-medium">TYPE</th>
                  <th className="py-2 px-3 font-medium">PRIORITY</th>
                  <th className="py-2 px-3 font-medium">WORKER</th>
                  <th className="py-2 px-3 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22262E]">
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#94A3B8] font-sans">
                      No jobs submitted yet.
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => onViewJob(job)}
                      className="hover:bg-[#22262E]/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-bold text-[#38BDF8] whitespace-nowrap">{job.id}</td>
                      <td className="py-2 px-3 text-[#E2E8F0] font-sans font-medium whitespace-nowrap">{job.name}</td>
                      <td className="py-2 px-3 text-[#94A3B8] whitespace-nowrap">{job.type}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            job.priority === 'CRITICAL'
                              ? 'text-rose-400 border-rose-500/40 bg-rose-500/10'
                              : job.priority === 'HIGH'
                              ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                              : 'text-[#94A3B8] border-[#22262E] bg-[#0A0B0E]'
                          }`}
                        >
                          {job.priority}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#E2E8F0] whitespace-nowrap">
                        {job.assignedWorkerName ? getWorkerDisplayName(job.assignedWorkerId, job.assignedWorkerName) : <span className="text-[#94A3B8]">-</span>}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            job.status === 'COMPLETED'
                              ? 'bg-[#22C55E]/15 text-[#22C55E]'
                              : job.status === 'RUNNING'
                              ? 'bg-[#38BDF8]/15 text-[#38BDF8] animate-pulse'
                              : job.status === 'FAILED'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-slate-500/15 text-[#94A3B8]'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Node Registry Panel */}
        <div className="bg-[#12141A] border border-[#22262E] rounded-sm flex flex-col w-full min-w-0">
          <div className="px-3 sm:px-4 py-2.5 bg-[#161922] border-b border-[#22262E] flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider font-mono flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              Worker Node Registry
            </span>
            <button
              onClick={() => onNavigate('workers')}
              className="text-[11px] font-mono text-[#38BDF8] hover:underline flex items-center gap-1 shrink-0"
            >
              All Workers <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto max-h-[340px]">
            {workers.map((worker) => (
              <div
                key={worker.id}
                onClick={() => onViewWorker(worker)}
                className="border border-[#22262E] p-2.5 rounded-sm bg-[#0A0B0E]/60 hover:border-[#38BDF8]/60 hover:bg-[#161922] hover:scale-[1.02] hover:shadow-[0_4px_16px_rgba(56,189,248,0.12)] transition-all duration-200 cursor-pointer relative w-full min-w-0"
              >
                <div className="flex justify-between items-center text-xs font-semibold mb-1 gap-2">
                  <span className="text-[#E2E8F0] font-mono truncate">{worker.name}</span>
                  <span
                    className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                      worker.status === 'FAILED'
                        ? 'bg-rose-500 text-black'
                        : 'bg-[#38BDF8] text-black'
                    }`}
                  >
                    SCORE {worker.score || 0}
                  </span>
                </div>

                <div className="text-[9px] uppercase tracking-wider font-mono text-[#94A3B8] flex justify-between mb-1">
                  <span>CPU LOAD</span>
                  <span className="text-[#38BDF8]">{worker.currentCpuUsage}%</span>
                </div>

                {/* Meter Bar */}
                <div className="h-1.5 bg-[#22262E] rounded-xs overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      worker.status === 'FAILED' ? 'bg-rose-500' : 'bg-[#38BDF8]'
                    }`}
                    style={{ width: `${worker.status === 'FAILED' ? 100 : worker.currentCpuUsage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8]">
                  <span>Status: <strong className={worker.status === 'FAILED' ? 'text-rose-400' : 'text-emerald-400'}>{worker.status}</strong></span>
                  <span>Active Jobs: <strong className="text-[#E2E8F0]">{worker.activeJobs}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduler Reasoning & Real-time System Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full min-w-0">
        {/* Resource Allocation & Metrics Chart */}
        <div className="lg:col-span-2 bg-[#12141A] border border-[#22262E] rounded-sm p-3 sm:p-4 flex flex-col w-full min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3 border-b border-[#22262E] pb-2">
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider font-mono flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              Worker Node Load vs Algorithmic Score
            </span>
          </div>

          <div className="h-52 sm:h-60 w-full min-w-0 max-w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} interval={0} height={32} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#12141A', borderColor: '#22262E', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="cpu" name="CPU Usage %" fill="#38BDF8" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ram" name="RAM Usage %" fill="#a855f7" radius={[2, 2, 0, 0]} />
                <Bar dataKey="score" name="Worker Score" fill="#22C55E" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time System Logs Panel */}
        <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-3 sm:p-4 flex flex-col justify-between w-full min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between mb-2 border-b border-[#22262E] pb-2">
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              Scheduler Logs & Fault Events
            </span>
            <button
              onClick={() => onNavigate('logs')}
              className="text-[11px] font-mono text-[#38BDF8] hover:underline shrink-0"
            >
              Console
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] overflow-y-auto max-h-48 pr-1 text-[#88C0D0]">
            {recentLogs.map((log) => (
              <div key={log.id} className="border-l-2 border-[#22262E] pl-2 py-0.5 leading-snug break-words">
                <span className="text-[#38BDF8] mr-1.5 whitespace-nowrap">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={log.level === 'ERROR' ? 'text-rose-400 font-bold' : log.level === 'WARNING' ? 'text-amber-400 font-bold' : 'text-[#E2E8F0]'}>
                  [{log.component}] {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
