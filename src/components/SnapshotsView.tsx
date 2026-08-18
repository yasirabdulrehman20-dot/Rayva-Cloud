import React, { useState, useEffect } from 'react';
import { SystemStatus, Job, WorkerNodeData, SystemSnapshot } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import {
  Camera,
  Download,
  Upload,
  Trash2,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Server,
  Briefcase,
  GitBranch,
  Plus,
  X,
  Sparkles,
  Play,
  RotateCcw,
  FileJson,
  Layers,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { exportSnapshotToJson, exportSnapshotToPdf } from '../utils/exportUtils.js';
import { ExportDropdown } from './ExportDropdown.tsx';

interface SnapshotsViewProps {
  status: SystemStatus | null;
  jobs: Job[];
  workers: WorkerNodeData[];
  onRestoreSnapshot?: (snapshot: SystemSnapshot) => void;
  onAddToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const STORAGE_KEY = 'rayva_system_snapshots_v1';

const INITIAL_DEMO_SNAPSHOTS: SystemSnapshot[] = [
  {
    id: 'snap-demo-1',
    name: 'Peak Load Stress Test',
    description: 'Captured during 10-job batch submission with high CPU demand across 4 worker nodes.',
    timestamp: Date.now() - 3600000 * 5,
    status: {
      totalWorkers: 4,
      onlineWorkers: 4,
      idleWorkers: 1,
      busyWorkers: 3,
      offlineWorkers: 0,
      failedWorkers: 0,
      totalJobs: 27,
      activeJobs: 3,
      queuedJobs: 5,
      completedJobs: 18,
      failedJobs: 1,
      cancelledJobs: 0,
      systemCpuUsage: 84.5,
      systemRamUsage: 68.2,
      avgExecutionTimeMs: 1400,
      activeStrategy: 'RESOURCE_AWARE',
      simulationActive: false,
      maintenanceMode: false,
      uptimeSeconds: 14200,
    },
    workers: [
      { id: 'worker-1', name: 'Rayva Titan', host: '192.168.1.101', status: 'BUSY', cpuCapacity: 8, ramCapacity: 16384, currentCpuUsage: 92, currentRamUsage: 78, currentWorkload: 85, activeJobs: 1, completedJobs: 12, failedJobs: 0, avgExecutionTimeMs: 1400, successRate: 100, lastHeartbeat: Date.now() },
      { id: 'worker-2', name: 'Rayva Vector', host: '192.168.1.102', status: 'BUSY', cpuCapacity: 8, ramCapacity: 16384, currentCpuUsage: 88, currentRamUsage: 70, currentWorkload: 80, activeJobs: 1, completedJobs: 10, failedJobs: 1, avgExecutionTimeMs: 1600, successRate: 90, lastHeartbeat: Date.now() },
      { id: 'worker-3', name: 'Rayva Flux', host: '192.168.1.103', status: 'BUSY', cpuCapacity: 4, ramCapacity: 8192, currentCpuUsage: 85, currentRamUsage: 62, currentWorkload: 75, activeJobs: 1, completedJobs: 8, failedJobs: 0, avgExecutionTimeMs: 1100, successRate: 100, lastHeartbeat: Date.now() },
      { id: 'worker-4', name: 'Rayva Edge', host: '192.168.1.104', status: 'IDLE', cpuCapacity: 4, ramCapacity: 8192, currentCpuUsage: 12, currentRamUsage: 25, currentWorkload: 10, activeJobs: 0, completedJobs: 6, failedJobs: 0, avgExecutionTimeMs: 900, successRate: 100, lastHeartbeat: Date.now() },
    ],
    jobs: [
      { id: 'job-101', name: 'Large Matrix Multiplication', type: 'MATRIX_OPS', priority: 'HIGH', status: 'RUNNING', assignedWorkerId: 'worker-1', submittedTime: Date.now() - 10000, retryCount: 0, maxRetries: 3, payload: { matrixSize: 500 } },
      { id: 'job-102', name: 'Prime Number Range Calc', type: 'PRIME_CALC', priority: 'CRITICAL', status: 'RUNNING', assignedWorkerId: 'worker-2', submittedTime: Date.now() - 12000, retryCount: 0, maxRetries: 3, payload: { targetNumber: 1000000 } },
      { id: 'job-103', name: 'SHA-256 Batch Hash', type: 'HASH_CALC', priority: 'NORMAL', status: 'RUNNING', assignedWorkerId: 'worker-3', submittedTime: Date.now() - 6000, retryCount: 0, maxRetries: 3, payload: { iterations: 50000 } },
    ],
    metricsSummary: {
      cpuUsage: 84.5,
      ramUsage: 68.2,
      totalWorkers: 4,
      onlineWorkers: 4,
      totalJobs: 27,
      activeJobs: 3,
      completedJobs: 18,
      failedJobs: 1,
    },
  },
  {
    id: 'snap-demo-2',
    name: 'Optimal Round-Robin Baseline',
    description: 'Clean cluster state with balanced job distribution under Round-Robin scheduling.',
    timestamp: Date.now() - 3600000 * 24,
    status: {
      totalWorkers: 4,
      onlineWorkers: 4,
      idleWorkers: 3,
      busyWorkers: 1,
      offlineWorkers: 0,
      failedWorkers: 0,
      totalJobs: 43,
      activeJobs: 1,
      queuedJobs: 0,
      completedJobs: 42,
      failedJobs: 0,
      cancelledJobs: 0,
      systemCpuUsage: 22.4,
      systemRamUsage: 34.1,
      avgExecutionTimeMs: 1100,
      activeStrategy: 'ROUND_ROBIN',
      simulationActive: false,
      maintenanceMode: false,
      uptimeSeconds: 86400,
    },
    workers: [
      { id: 'worker-1', name: 'Rayva Titan', host: '192.168.1.101', status: 'BUSY', cpuCapacity: 8, ramCapacity: 16384, currentCpuUsage: 35, currentRamUsage: 40, currentWorkload: 30, activeJobs: 1, completedJobs: 15, failedJobs: 0, avgExecutionTimeMs: 1200, successRate: 100, lastHeartbeat: Date.now() },
      { id: 'worker-2', name: 'Rayva Vector', host: '192.168.1.102', status: 'IDLE', cpuCapacity: 8, ramCapacity: 16384, currentCpuUsage: 10, currentRamUsage: 30, currentWorkload: 5, activeJobs: 0, completedJobs: 14, failedJobs: 0, avgExecutionTimeMs: 1300, successRate: 100, lastHeartbeat: Date.now() },
      { id: 'worker-3', name: 'Rayva Flux', host: '192.168.1.103', status: 'IDLE', cpuCapacity: 4, ramCapacity: 8192, currentCpuUsage: 8, currentRamUsage: 22, currentWorkload: 5, activeJobs: 0, completedJobs: 8, failedJobs: 0, avgExecutionTimeMs: 1000, successRate: 100, lastHeartbeat: Date.now() },
      { id: 'worker-4', name: 'Rayva Edge', host: '192.168.1.104', status: 'IDLE', cpuCapacity: 4, ramCapacity: 8192, currentCpuUsage: 5, currentRamUsage: 20, currentWorkload: 5, activeJobs: 0, completedJobs: 5, failedJobs: 0, avgExecutionTimeMs: 800, successRate: 100, lastHeartbeat: Date.now() },
    ],
    jobs: [
      { id: 'job-042', name: 'Fibonacci Sequence Generator', type: 'FIBONACCI', priority: 'LOW', status: 'RUNNING', assignedWorkerId: 'worker-1', submittedTime: Date.now() - 3000, retryCount: 0, maxRetries: 3, payload: { targetNumber: 45 } },
    ],
    metricsSummary: {
      cpuUsage: 22.4,
      ramUsage: 34.1,
      totalWorkers: 4,
      onlineWorkers: 4,
      totalJobs: 43,
      activeJobs: 1,
      completedJobs: 42,
      failedJobs: 0,
    },
  },
];

export const SnapshotsView: React.FC<SnapshotsViewProps> = ({
  status,
  jobs,
  workers,
  onRestoreSnapshot,
  onAddToast,
}) => {
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_DEMO_SNAPSHOTS;
  });

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    snapshots[0]?.id || null
  );

  const [searchFilter, setSearchFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    } catch {
      // ignore
    }
  }, [snapshots]);

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || null;

  // Calculate live summary
  const liveSummary = {
    cpuUsage: status?.systemCpuUsage || 0,
    ramUsage: status?.systemRamUsage || 0,
    totalWorkers: status?.totalWorkers || workers.length,
    onlineWorkers: status?.onlineWorkers || workers.filter((w) => w.status !== 'OFFLINE').length,
    totalJobs: jobs.length,
    activeJobs: jobs.filter((j) => j.status === 'RUNNING').length,
    completedJobs: jobs.filter((j) => j.status === 'COMPLETED').length,
    failedJobs: jobs.filter((j) => j.status === 'FAILED').length,
  };

  const handleOpenModal = () => {
    const d = new Date();
    const defaultName = `Snapshot - ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setSnapshotName(defaultName);
    setSnapshotDesc('');
    setIsModalOpen(true);
  };

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;

    const newSnap: SystemSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: snapshotName.trim(),
      description: snapshotDesc.trim() || 'Custom system snapshot preset.',
      timestamp: Date.now(),
      status: status ? { ...status } : null,
      workers: JSON.parse(JSON.stringify(workers)),
      jobs: JSON.parse(JSON.stringify(jobs)),
      metricsSummary: { ...liveSummary },
    };

    setSnapshots((prev) => [newSnap, ...prev]);
    setSelectedSnapshotId(newSnap.id);
    setIsModalOpen(false);
    onAddToast?.('Snapshot Saved', `Successfully created system snapshot "${newSnap.name}".`, 'success');
  };

  const handleDeleteSnapshot = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const snap = snapshots.find((s) => s.id === id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    if (selectedSnapshotId === id) {
      setSelectedSnapshotId(snapshots.find((s) => s.id !== id)?.id || null);
    }
    onAddToast?.('Snapshot Deleted', `Removed snapshot "${snap?.name || id}".`, 'info');
  };

  const handleExportSnapshotJson = (snap: SystemSnapshot, e?: React.MouseEvent) => {
    e?.stopPropagation();
    exportSnapshotToJson(snap);
    onAddToast?.('Exported', `Downloaded "${snap.name}" as JSON file.`, 'success');
  };

  const handleExportSnapshotPdf = (snap: SystemSnapshot, e?: React.MouseEvent) => {
    e?.stopPropagation();
    exportSnapshotToPdf(snap);
    onAddToast?.('Exported', `Downloaded "${snap.name}" as PDF report.`, 'success');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.name && parsed.metricsSummary) {
            const importedSnap: SystemSnapshot = {
              ...parsed,
              id: `snap-imp-${Date.now()}`,
              timestamp: parsed.timestamp || Date.now(),
            };
            setSnapshots((prev) => [importedSnap, ...prev]);
            setSelectedSnapshotId(importedSnap.id);
            onAddToast?.('Imported', `Successfully imported snapshot "${importedSnap.name}".`, 'success');
          } else {
            throw new Error('Invalid snapshot structure');
          }
        } catch {
          onAddToast?.('Import Error', 'Failed to import snapshot. File content is invalid JSON format.', 'error');
        }
      };
    }
  };

  const handleRestore = (snap: SystemSnapshot) => {
    if (onRestoreSnapshot) {
      onRestoreSnapshot(snap);
    } else {
      onAddToast?.('Simulation Preset Loaded', `Loaded snapshot state for "${snap.name}".`, 'success');
    }
  };

  const filteredSnapshots = snapshots.filter((s) =>
    s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans text-[#E2E8F0]">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#12141A] border border-[#22262E] p-5 rounded-sm shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#38BDF8]/10 text-[#38BDF8] rounded-sm border border-[#38BDF8]/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                System Snapshots & Simulation Presets
              </h1>
              <p className="text-xs text-[#94A3B8]">
                Save current cluster state (jobs, workers, metrics) as named presets for side-by-side comparison or simulation playback.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 bg-[#1C202B] hover:bg-[#22262E] text-[#94A3B8] hover:text-white border border-[#22262E] rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={handleOpenModal}
            className="px-4 py-1.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0A0B0E] font-bold rounded-sm text-xs flex items-center gap-1.5 transition-all shadow-md hover:shadow-[#38BDF8]/20 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Capture Live Snapshot</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#12141A] border border-[#22262E] p-3.5 rounded-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Saved Snapshots</div>
            <div className="text-xl font-extrabold text-white mt-0.5">{snapshots.length}</div>
          </div>
          <Layers className="w-5 h-5 text-[#38BDF8]/60" />
        </div>

        <div className="bg-[#12141A] border border-[#22262E] p-3.5 rounded-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Live System CPU</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{liveSummary.cpuUsage.toFixed(1)}%</div>
          </div>
          <Cpu className="w-5 h-5 text-emerald-400/60" />
        </div>

        <div className="bg-[#12141A] border border-[#22262E] p-3.5 rounded-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Live Active Workers</div>
            <div className="text-xl font-extrabold text-purple-400 mt-0.5">{liveSummary.onlineWorkers} / {liveSummary.totalWorkers}</div>
          </div>
          <Server className="w-5 h-5 text-purple-400/60" />
        </div>

        <div className="bg-[#12141A] border border-[#22262E] p-3.5 rounded-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">Live Queue Jobs</div>
            <div className="text-xl font-extrabold text-amber-400 mt-0.5">{liveSummary.activeJobs} active</div>
          </div>
          <Briefcase className="w-5 h-5 text-amber-400/60" />
        </div>
      </div>

      {/* Main Grid: Comparison Panel (Left/Top) & Snapshot List (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live vs Snapshot Comparison Matrix */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#22262E] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  State Comparison Matrix
                </h2>
              </div>
              {selectedSnapshot && (
                <span className="text-[11px] font-mono bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 px-2 py-0.5 rounded-xs">
                  Comparing Live vs &quot;{selectedSnapshot.name}&quot;
                </span>
              )}
            </div>

            {!selectedSnapshot ? (
              <div className="py-12 text-center text-[#94A3B8] text-xs font-mono">
                Select a snapshot from the list on the right to perform a side-by-side comparison with the live cluster.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header Metadata */}
                <div className="bg-[#0A0B0E] border border-[#22262E] p-3 rounded-sm flex items-start justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white text-sm">{selectedSnapshot.name}</h3>
                    <p className="text-[#94A3B8] text-xs mt-0.5">{selectedSnapshot.description}</p>
                    <div className="flex items-center gap-3 font-mono text-[11px] text-[#94A3B8] mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#38BDF8]" />
                        {new Date(selectedSnapshot.timestamp).toLocaleString()}
                      </span>
                      {selectedSnapshot.status?.activeStrategy && (
                        <span className="flex items-center gap-1 text-purple-400">
                          <GitBranch className="w-3 h-3" />
                          Strategy: {selectedSnapshot.status.activeStrategy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(selectedSnapshot)}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xs text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Load snapshot state into Simulation Mode"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Reproduce State</span>
                    </button>
                    <ExportDropdown
                      onExportJson={() => handleExportSnapshotJson(selectedSnapshot)}
                      onExportPdf={() => handleExportSnapshotPdf(selectedSnapshot)}
                      label="EXPORT SNAPSHOT"
                      variant="secondary"
                      title="Export snapshot as JSON or PDF"
                    />
                  </div>
                </div>

                {/* Side-by-Side Comparison Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  {/* LIVE COLUMN */}
                  <div className="bg-[#0A0B0E] border border-[#22262E] p-3 rounded-sm space-y-2.5">
                    <div className="flex items-center justify-between text-[#38BDF8] border-b border-[#22262E] pb-1.5 font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        LIVE CLUSTER
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">Real-time</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">CPU Usage:</span>
                        <span className="font-bold text-white">{liveSummary.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">RAM Usage:</span>
                        <span className="font-bold text-white">{liveSummary.ramUsage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Online Workers:</span>
                        <span className="font-bold text-emerald-400">{liveSummary.onlineWorkers} / {liveSummary.totalWorkers}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Active Jobs:</span>
                        <span className="font-bold text-sky-400">{liveSummary.activeJobs}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Completed / Failed:</span>
                        <span className="font-bold text-[#E2E8F0]">{liveSummary.completedJobs} / {liveSummary.failedJobs}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Active Strategy:</span>
                        <span className="font-bold text-purple-400">{status?.activeStrategy || 'ROUND_ROBIN'}</span>
                      </div>
                    </div>
                  </div>

                  {/* SNAPSHOT COLUMN */}
                  <div className="bg-[#0A0B0E] border border-[#22262E] p-3 rounded-sm space-y-2.5">
                    <div className="flex items-center justify-between text-purple-400 border-b border-[#22262E] pb-1.5 font-bold">
                      <span className="flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        PRESET SNAPSHOT
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">Saved</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">CPU Usage:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-white">{selectedSnapshot.metricsSummary.cpuUsage.toFixed(1)}%</span>
                          {(() => {
                            const diff = selectedSnapshot.metricsSummary.cpuUsage - liveSummary.cpuUsage;
                            if (Math.abs(diff) < 0.5) return null;
                            return (
                              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${diff > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">RAM Usage:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-white">{selectedSnapshot.metricsSummary.ramUsage.toFixed(1)}%</span>
                          {(() => {
                            const diff = selectedSnapshot.metricsSummary.ramUsage - liveSummary.ramUsage;
                            if (Math.abs(diff) < 0.5) return null;
                            return (
                              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${diff > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Online Workers:</span>
                        <span className="font-bold text-emerald-400">{selectedSnapshot.metricsSummary.onlineWorkers} / {selectedSnapshot.metricsSummary.totalWorkers}</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Active Jobs:</span>
                        <span className="font-bold text-sky-400">{selectedSnapshot.metricsSummary.activeJobs}</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Completed / Failed:</span>
                        <span className="font-bold text-[#E2E8F0]">{selectedSnapshot.metricsSummary.completedJobs} / {selectedSnapshot.metricsSummary.failedJobs}</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#94A3B8]">Strategy:</span>
                        <span className="font-bold text-purple-400">{selectedSnapshot.status?.activeStrategy || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Worker Node Comparison Table */}
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-xs font-bold text-[#94A3B8] uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-purple-400" />
                    <span>Snapshot Worker Inventory ({selectedSnapshot.workers.length})</span>
                  </h4>
                  <div className="bg-[#0A0B0E] border border-[#22262E] rounded-sm divide-y divide-[#22262E] text-xs font-mono max-h-48 overflow-y-auto">
                    {selectedSnapshot.workers.map((w) => (
                      <div key={w.id} className="p-2 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${w.status === 'BUSY' ? 'bg-[#38BDF8]' : w.status === 'IDLE' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                          <span className="font-bold text-white">{getWorkerDisplayName(w.id, w.name)}</span>
                          <span className="text-[#94A3B8] text-[10px]">({w.host})</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#94A3B8]">
                          <span>CPU: {w.currentCpuUsage}%</span>
                          <span>RAM: {w.currentRamUsage}%</span>
                          <span className="text-white font-bold">{w.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: List of Saved Snapshots */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
              Saved Snapshot Presets ({filteredSnapshots.length})
            </h2>

            <input
              type="text"
              placeholder="Filter snapshots..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#0A0B0E] border border-[#22262E] text-xs px-2.5 py-1 rounded-sm text-[#E2E8F0] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] w-36 font-mono"
            />
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredSnapshots.length === 0 ? (
              <div className="bg-[#12141A] border border-[#22262E] p-6 text-center text-[#94A3B8] text-xs font-mono rounded-sm">
                No matching snapshots found. Click &quot;Capture Live Snapshot&quot; to create one.
              </div>
            ) : (
              filteredSnapshots.map((snap) => {
                const isSelected = snap.id === selectedSnapshotId;
                return (
                  <div
                    key={snap.id}
                    onClick={() => setSelectedSnapshotId(snap.id)}
                    className={`p-3 rounded-sm border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-[#38BDF8]/10 border-[#38BDF8] shadow-md'
                        : 'bg-[#12141A] border-[#22262E] hover:border-[#38BDF8]/40 hover:bg-[#1C202B]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                          {snap.name}
                          {isSelected && (
                            <span className="text-[9px] bg-[#38BDF8] text-[#0A0B0E] px-1 py-0.2 rounded-xs font-extrabold font-mono uppercase">
                              Active
                            </span>
                          )}
                        </h3>
                        {snap.description && (
                          <p className="text-[11px] text-[#94A3B8] line-clamp-1 mt-0.5">{snap.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <ExportDropdown
                          onExportJson={() => handleExportSnapshotJson(snap)}
                          onExportPdf={() => handleExportSnapshotPdf(snap)}
                          variant="compact"
                          title="Export snapshot as JSON or PDF"
                        />
                        <button
                          onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                          className="p-1 text-[#94A3B8] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                          title="Delete Snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] border-t border-[#22262E]/60 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">CPU: {snap.metricsSummary.cpuUsage.toFixed(0)}%</span>
                        <span>Workers: {snap.metricsSummary.onlineWorkers}</span>
                        <span>Jobs: {snap.metricsSummary.activeJobs} active</span>
                      </div>
                      <span>{new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Capture Snapshot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-start justify-center z-50 p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
          <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-5 max-w-md w-full space-y-4 shadow-2xl font-sans text-[#E2E8F0] my-auto">
            <div className="flex items-center justify-between border-b border-[#22262E] pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#38BDF8]" />
                <h3 className="font-extrabold text-sm text-white">Capture Live System Snapshot</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-[#94A3B8] uppercase tracking-wider mb-1">
                  Snapshot Name *
                </label>
                <input
                  type="text"
                  required
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="e.g., Pre-deployment High Traffic Snapshot"
                  className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#94A3B8] uppercase tracking-wider mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  value={snapshotDesc}
                  onChange={(e) => setSnapshotDesc(e.target.value)}
                  placeholder="Optional context about cluster workload, active strategy, or test purpose..."
                  className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8] font-sans"
                />
              </div>

              {/* Summary Preview Box */}
              <div className="bg-[#0A0B0E] border border-[#22262E] p-3 rounded-sm space-y-1.5 font-mono text-xs">
                <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Current Live Payload Preview</span>
                  <span className="text-[#38BDF8]">Real-time</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#E2E8F0]">
                  <div>• Workers: <strong className="text-white">{liveSummary.onlineWorkers} online</strong></div>
                  <div>• Active Jobs: <strong className="text-white">{liveSummary.activeJobs} running</strong></div>
                  <div>• CPU Load: <strong className="text-emerald-400">{liveSummary.cpuUsage.toFixed(1)}%</strong></div>
                  <div>• Strategy: <strong className="text-purple-400">{status?.activeStrategy || 'ROUND_ROBIN'}</strong></div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22262E]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-[#1C202B] hover:bg-[#22262E] text-[#94A3B8] hover:text-white rounded-sm text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0A0B0E] font-bold rounded-sm text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Save Snapshot</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
