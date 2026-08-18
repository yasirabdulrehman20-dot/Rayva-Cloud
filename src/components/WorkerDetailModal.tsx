import React, { useState } from 'react';
import { WorkerNodeData } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import { X, Cpu, Server, Activity, CheckCircle2, AlertTriangle, ShieldCheck, Copy, Check } from 'lucide-react';

interface WorkerDetailModalProps {
  worker: WorkerNodeData | null;
  onClose: () => void;
  onSimulateFailure: (id: string) => void;
  onRecoverWorker: (id: string) => void;
  onAddToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({
  worker,
  onClose,
  onSimulateFailure,
  onRecoverWorker,
  onAddToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!worker) return null;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(worker.id);
      setCopied(true);
      if (onAddToast) {
        onAddToast('WORKER ID COPIED', `Copied Worker ID "${worker.id}" to clipboard.`, 'info');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy Worker ID:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">{getWorkerDisplayName(worker.id, worker.name)}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono flex-wrap">
                <span className="font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                  ID: {worker.id}
                </span>
                <button
                  onClick={handleCopyId}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer border shadow-sm ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Copy Worker ID to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
                <span>• Host: {worker.host}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/60 rounded-lg border border-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">STATUS</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block ${
                worker.status === 'IDLE' || worker.status === 'ONLINE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : worker.status === 'BUSY'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {worker.status}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">COMPOSITE SCORE</span>
            <span className="font-bold text-emerald-400 text-sm">{worker.score || 0} / 100</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">SUCCESS RATE</span>
            <span className="font-bold text-blue-400">{worker.successRate}%</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">AVG RUNTIME</span>
            <span className="font-bold text-amber-400">{worker.avgExecutionTimeMs} ms</span>
          </div>
        </div>

        {/* Detailed Score Factors Breakdown */}
        {worker.scoreBreakdown && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Algorithmic Worker Score Factor Breakdown
            </h3>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">CPU Availability Score:</span>
                <span className="font-bold text-slate-200">
                  {worker.scoreBreakdown.cpuAvailabilityScore} / 100
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">RAM Availability Score:</span>
                <span className="font-bold text-slate-200">
                  {worker.scoreBreakdown.ramAvailabilityScore} / 100
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Workload Headroom Score:</span>
                <span className="font-bold text-slate-200">
                  {worker.scoreBreakdown.workloadScore} / 100
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Active Jobs Penalty Score:</span>
                <span className="font-bold text-slate-200">
                  {worker.scoreBreakdown.activeJobsScore} / 100
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Historical Stats Strip */}
        <div className="grid grid-cols-3 gap-3 text-xs font-mono text-center">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Active Jobs</span>
            <span className="text-cyan-400 font-bold text-base">{worker.activeJobs}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Completed Jobs</span>
            <span className="text-emerald-400 font-bold text-base">{worker.completedJobs}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Failed Jobs</span>
            <span className="text-rose-400 font-bold text-base">{worker.failedJobs}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          {worker.status === 'FAILED' || worker.status === 'OFFLINE' ? (
            <button
              onClick={() => {
                onRecoverWorker(worker.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Recover Worker Node
            </button>
          ) : (
            <button
              onClick={() => {
                onSimulateFailure(worker.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs"
            >
              Simulate Worker Failure
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
