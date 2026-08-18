import React, { useState } from 'react';
import { SchedulerDecision, SchedulerStrategyType } from '../shared/types.js';
import { getWorkerDisplayName, sanitizeWorkerText } from '../shared/workerUtils.js';
import { GitBranch, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Activity, Clock } from 'lucide-react';

interface SchedulerViewProps {
  decisions: SchedulerDecision[];
  activeStrategy: SchedulerStrategyType;
  onChangeStrategy: (strat: SchedulerStrategyType) => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({
  decisions,
  activeStrategy,
  onChangeStrategy,
}) => {
  const [selectedDecision, setSelectedDecision] = useState<SchedulerDecision | null>(
    decisions.length > 0 ? decisions[0] : null
  );

  const activeDec = selectedDecision || (decisions.length > 0 ? decisions[0] : null);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            Algorithmic Scheduler Engine & Placement Pipeline
          </h1>
          <p className="text-xs text-slate-400">
            Visual inspection of scheduler worker evaluations, score normalization, feature weightings, and selection reasoning.
          </p>
        </div>

        {/* Strategy Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl text-xs font-mono">
          <span className="text-slate-400 pl-2 font-medium">Active Strategy:</span>
          <select
            value={activeStrategy}
            onChange={(e) => onChangeStrategy(e.target.value as SchedulerStrategyType)}
            className="bg-slate-950 text-cyan-400 font-bold px-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="RESOURCE_AWARE">Resource Aware (Composite Score)</option>
            <option value="ROUND_ROBIN">Round Robin (Cyclic Order)</option>
            <option value="LEAST_LOADED">Least Loaded (Minimal Jobs)</option>
            <option value="PRIORITY">Priority Driven (Resource Reservation)</option>
            <option value="PREDICTIVE_AI">Predictive AI (ML Forecast Pipeline)</option>
          </select>
        </div>
      </div>

      {/* Scheduler Pipeline Diagram */}
      {activeDec ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800 font-bold">
                DECISION FOR {activeDec.jobId}
              </span>
              <span className="text-sm font-bold text-slate-200">{activeDec.jobName}</span>
            </div>

            <span className="text-xs font-mono text-slate-500">
              {new Date(activeDec.timestamp).toLocaleString()}
            </span>
          </div>

          {/* Visual Scheduling Flow Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Step 1: Job Node */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-mono font-bold">
                JOB
              </div>
              <span className="font-mono text-xs font-bold text-slate-200">{activeDec.jobId}</span>
              <span className="text-[11px] text-slate-400">{activeDec.jobName}</span>
            </div>

            {/* Step 2: Scheduler Engine */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center space-y-2 relative">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <GitBranch className="w-5 h-5" />
              </div>
              <span className="font-mono text-xs font-bold text-cyan-400">SCHEDULER ENGINE</span>
              <span className="text-[11px] text-slate-400 font-mono">
                Strategy: {activeDec.strategyUsed}
              </span>
            </div>

            {/* Step 3: Evaluated Workers List */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block text-center uppercase tracking-wider font-mono">
                Worker Scores
              </span>
              <div className="space-y-1.5 font-mono text-xs max-h-36 overflow-y-auto pr-1">
                {Object.entries(activeDec.workerScores).map(([wId, score]) => {
                  const isSelected = wId === activeDec.selectedWorkerId;
                  return (
                    <div
                      key={wId}
                      className={`flex justify-between items-center px-2.5 py-1 rounded text-[11px] ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="truncate">{getWorkerDisplayName(wId, wId)}</span>
                      <span>Score: {score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Selected Target Worker */}
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 flex flex-col items-center text-center space-y-2 bg-emerald-950/20">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {getWorkerDisplayName(activeDec.selectedWorkerId, activeDec.selectedWorkerName)}
              </span>
              <span className="text-[11px] text-emerald-300 font-mono">TARGET ASSIGNED</span>
            </div>
          </div>

          {/* Decision Reason Callout */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Scheduling Decision Reason
            </h3>
            <p className="text-xs text-slate-200 font-sans leading-relaxed">{sanitizeWorkerText(activeDec.reason)}</p>
          </div>

          {/* Worker Factor Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Worker Factor Evaluation Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Worker ID / Name</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Evaluation Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {Object.entries(activeDec.breakdown).map(([wId, details]: [string, any]) => (
                    <tr
                      key={wId}
                      className={wId === activeDec.selectedWorkerId ? 'bg-emerald-950/20 font-bold' : ''}
                    >
                      <td className="py-2.5 px-3 text-cyan-400">{getWorkerDisplayName(wId, wId)} ({wId})</td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {activeDec.workerScores[wId] || 0}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                        <pre className="inline">{JSON.stringify(details)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 font-mono text-xs">
          No scheduling decisions logged yet. Submit a job to view real-time scheduler evaluations!
        </div>
      )}

      {/* Historical Scheduler Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
          <Clock className="w-4 h-4 text-cyan-400" />
          Scheduler Decision History Audit
        </h2>

        <div className="space-y-2 font-mono text-xs max-h-72 overflow-y-auto pr-1">
          {decisions.map((dec, i) => (
            <div
              key={i}
              onClick={() => setSelectedDecision(dec)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                activeDec && activeDec.timestamp === dec.timestamp
                  ? 'bg-slate-800 border-cyan-500 text-slate-100'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-400">{dec.jobId}</span>
                  <span className="text-slate-300 font-sans">{dec.jobName}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Strategy: {dec.strategyUsed} • Assigned: {getWorkerDisplayName(dec.selectedWorkerId, dec.selectedWorkerName)}
                </div>
              </div>

              <span className="text-[11px] text-slate-500">
                {new Date(dec.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
