import React, { useState } from 'react';
import { WorkerNodeData } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import { Cpu, Server, Activity, ShieldCheck, AlertTriangle, RefreshCw, Plus } from 'lucide-react';

interface WorkersViewProps {
  workers: WorkerNodeData[];
  onViewWorker: (worker: WorkerNodeData) => void;
  onSimulateFailure: (id: string) => void;
  onRecoverWorker: (id: string) => void;
  onRegisterWorker: (name: string, host: string, cpu: number, ram: number) => void;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  workers,
  onViewWorker,
  onSimulateFailure,
  onRecoverWorker,
  onRegisterWorker,
}) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [cpu, setCpu] = useState(4);
  const [ram, setRam] = useState(16384);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterWorker(
      name || `Worker-Custom-${Date.now().toString(36)}`,
      host || '10.0.1.50',
      cpu,
      ram
    );
    setName('');
    setIsRegisterOpen(false);
  };

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto font-sans text-[#E2E8F0]">
      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#12141A] border border-[#22262E] p-3 rounded-sm">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#38BDF8]" />
            Worker Cluster Infrastructure Nodes
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Real-time telemetry, resource metrics, worker scores, fault-tolerance failure injection, and node recovery.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterOpen(true)}
          className="flex items-center gap-1.5 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold px-3 py-1.5 rounded-sm text-xs transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>PROVISION WORKER</span>
        </button>
      </div>

      {/* Grid of Workers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {workers.map((worker) => (
          <div
            key={worker.id}
            className="bg-[#12141A] border border-[#22262E] rounded-sm p-3.5 space-y-3 hover:border-[#38BDF8]/60 hover:shadow-[0_6px_20px_rgba(56,189,248,0.12)] hover:-translate-y-1 hover:scale-[1.01] transition-all duration-200 ease-out flex flex-col justify-between"
          >
            {/* Top row */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-xs text-white font-mono">{getWorkerDisplayName(worker.id, worker.name)}</h3>
                  <span className="font-mono text-[10px] text-[#94A3B8]">{worker.host}</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                    worker.status === 'IDLE' || worker.status === 'ONLINE'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : worker.status === 'BUSY'
                      ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 animate-pulse'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {worker.status}
                </span>
              </div>

              {/* Score pill */}
              <div className="bg-[#0A0B0E] p-2 rounded-sm border border-[#22262E] flex items-center justify-between font-mono text-xs my-2">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold">Worker Score</span>
                <span className="text-[#38BDF8] font-bold">{worker.score || 0} / 100</span>
              </div>

              {/* Progress bars for CPU & RAM */}
              <div className="space-y-2 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-[10px] mb-1 text-[#94A3B8]">
                    <span>CPU LOAD ({worker.cpuCapacity} Cores)</span>
                    <span className="text-[#38BDF8] font-bold">{worker.currentCpuUsage}%</span>
                  </div>
                  <div className="w-full bg-[#0A0B0E] h-1.5 rounded-xs overflow-hidden border border-[#22262E]">
                    <div
                      className="bg-[#38BDF8] h-full transition-all duration-300"
                      style={{ width: `${worker.currentCpuUsage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-1 text-[#94A3B8]">
                    <span>RAM LOAD ({Math.round(worker.ramCapacity / 1024)}GB)</span>
                    <span className="text-purple-400 font-bold">{worker.currentRamUsage}%</span>
                  </div>
                  <div className="w-full bg-[#0A0B0E] h-1.5 rounded-xs overflow-hidden border border-[#22262E]">
                    <div
                      className="bg-purple-500 h-full transition-all duration-300"
                      style={{ width: `${worker.currentRamUsage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Stats & Controls */}
            <div className="space-y-2.5 pt-2 border-t border-[#22262E]">
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center text-[#94A3B8]">
                <div className="bg-[#0A0B0E] p-1 rounded-xs border border-[#22262E]">
                  <span className="block text-[9px] uppercase">Active</span>
                  <span className="text-[#38BDF8] font-bold">{worker.activeJobs}</span>
                </div>
                <div className="bg-[#0A0B0E] p-1 rounded-xs border border-[#22262E]">
                  <span className="block text-[9px] uppercase">Done</span>
                  <span className="text-emerald-400 font-bold">{worker.completedJobs}</span>
                </div>
                <div className="bg-[#0A0B0E] p-1 rounded-xs border border-[#22262E]">
                  <span className="block text-[9px] uppercase">Failed</span>
                  <span className="text-rose-400 font-bold">{worker.failedJobs}</span>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => onViewWorker(worker)}
                  className="flex-1 py-1 rounded-sm bg-[#0A0B0E] hover:bg-[#22262E] text-[#94A3B8] hover:text-white border border-[#22262E] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Details
                </button>

                {worker.status === 'FAILED' || worker.status === 'OFFLINE' ? (
                  <button
                    onClick={() => onRecoverWorker(worker.id)}
                    className="flex-1 py-1 rounded-sm bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Recover
                  </button>
                ) : (
                  <button
                    onClick={() => onSimulateFailure(worker.id)}
                    className="flex-1 py-1 rounded-sm bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Fail Node
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Register Worker Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
          <form
            onSubmit={handleRegister}
            className="bg-[#12141A] border border-[#22262E] rounded-sm max-w-md w-full p-5 space-y-3 shadow-2xl font-sans my-auto"
          >
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#22262E] pb-2.5">
              <Plus className="w-4 h-4 text-[#38BDF8]" />
              Register Worker Node
            </h2>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[#94A3B8] mb-1 font-medium">Worker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rayva Node 05"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="block text-[#94A3B8] mb-1 font-medium">Host / IP Address</label>
                <input
                  type="text"
                  placeholder="10.0.1.15"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#94A3B8] mb-1 font-medium">CPU Cores</label>
                  <input
                    type="number"
                    value={cpu}
                    onChange={(e) => setCpu(parseInt(e.target.value))}
                    className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label className="block text-[#94A3B8] mb-1 font-medium">RAM Capacity (MB)</label>
                  <input
                    type="number"
                    value={ram}
                    onChange={(e) => setRam(parseInt(e.target.value))}
                    className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22262E]">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="px-3 py-1.5 rounded-sm bg-[#0A0B0E] border border-[#22262E] text-[#94A3B8] text-xs hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-sm bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold text-xs cursor-pointer"
              >
                Register Node
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
