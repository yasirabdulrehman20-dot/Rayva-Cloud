import React, { useState } from 'react';
import { Job } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import { X, CheckCircle2, AlertTriangle, Clock, Server, GitBranch, ArrowDown, Copy, Check } from 'lucide-react';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onAddToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onAddToast }) => {
  const [copied, setCopied] = useState(false);

  if (!job) return null;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(job.id);
      setCopied(true);
      if (onAddToast) {
        onAddToast('JOB ID COPIED', `Copied Job ID "${job.id}" to clipboard.`, 'info');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy Job ID:', err);
    }
  };

  const timelineSteps = [
    { title: 'Job Submitted', time: job.submittedTime, done: true },
    { title: 'Added to Priority Queue', time: job.submittedTime, done: true },
    {
      title: 'Scheduler Evaluated Workers',
      time: job.startTime ? job.startTime - 50 : undefined,
      done: job.status !== 'QUEUED',
    },
    {
      title: `Worker Selected (${job.assignedWorkerId ? getWorkerDisplayName(job.assignedWorkerId, job.assignedWorkerName) : job.assignedWorkerName || 'Pending'})`,
      time: job.startTime,
      done: !!job.assignedWorkerId,
    },
    {
      title: 'Job Started Execution',
      time: job.startTime,
      done: job.status === 'RUNNING' || job.status === 'COMPLETED' || job.status === 'FAILED',
    },
    {
      title: job.status === 'FAILED' ? 'Execution Failed' : 'Job Completed',
      time: job.completionTime,
      done: job.status === 'COMPLETED' || job.status === 'FAILED',
      failed: job.status === 'FAILED',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-800/80">
                {job.id}
              </span>
              <button
                onClick={handleCopyId}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer border shadow-sm ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700/70'
                }`}
                title="Copy Job ID to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">{job.name}</h2>
              <p className="text-xs text-slate-400 font-mono">
                Type: {job.type} • Priority: {job.priority}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/60 rounded-lg border border-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Strip & Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">STATUS</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block ${
                job.status === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : job.status === 'RUNNING'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse'
                  : job.status === 'FAILED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {job.status}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">WORKER</span>
            <span className="font-semibold text-slate-200">
              {job.assignedWorkerId ? getWorkerDisplayName(job.assignedWorkerId, job.assignedWorkerName) : job.assignedWorkerName || 'Unassigned'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">EXECUTION TIME</span>
            <span className="font-semibold text-amber-400">
              {job.executionTimeMs !== undefined ? `${job.executionTimeMs} ms` : 'In progress...'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block mb-1">RETRY COUNT</span>
            <span className="font-semibold text-slate-200">
              {job.retryCount} / {job.maxRetries}
            </span>
          </div>
        </div>

        {/* Visual Timeline */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Execution Lifecycle Timeline
          </h3>

          <div className="space-y-3 font-mono text-xs pl-2 border-l-2 border-slate-800">
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="relative pl-6">
                <div
                  className={`absolute -left-[17px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    step.failed
                      ? 'bg-rose-500 text-slate-950 font-bold'
                      : step.done
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {step.failed ? '✕' : step.done ? '✓' : idx + 1}
                </div>

                <div className="flex justify-between items-center">
                  <span
                    className={`font-semibold ${
                      step.failed
                        ? 'text-rose-400'
                        : step.done
                        ? 'text-slate-200'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.time && (
                    <span className="text-[11px] text-slate-500">
                      {new Date(step.time).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution Output / Error */}
        {job.result && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Computational Output Result
            </h3>
            <p className="text-xs text-slate-300 font-sans">{job.result.summary}</p>
            <pre className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
              {JSON.stringify(job.result.details, null, 2)}
            </pre>
          </div>
        )}

        {job.error && (
          <div className="bg-rose-950/30 p-4 rounded-xl border border-rose-900/60 space-y-1">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Execution Error Log
            </h3>
            <p className="text-xs text-rose-200 font-mono">{job.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
