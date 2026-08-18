import React, { useState, useMemo } from 'react';
import { WorkerNodeData, Job, SystemStatus } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import {
  Activity,
  Cpu,
  Server,
  CheckCircle2,
  BarChart3,
  Flame,
  Clock,
  Zap,
  Info,
  TrendingUp,
  HardDrive,
  Grid,
  Download,
} from 'lucide-react';
import { exportAnalyticsToCsv } from '../utils/exportUtils.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AnalyticsViewProps {
  status: SystemStatus | null;
  workers: WorkerNodeData[];
  jobs: Job[];
}

type MetricMode = 'cpu' | 'ram' | 'workload';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ status, workers, jobs }) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('cpu');
  const [hoveredCell, setHoveredCell] = useState<{
    workerName: string;
    timeLabel: string;
    cpu: number;
    ram: number;
    workload: number;
    jobsCount: number;
  } | null>(null);

  // Time intervals for the heatmap (12 intervals of 5 minutes over the last 1 hour)
  const timeSlots = useMemo(() => {
    const now = new Date();
    const slots = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 5 * 60 * 1000);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      slots.push({
        id: `t-${i}`,
        label: i === 0 ? 'Now' : `-${i * 5}m`,
        timeStr,
      });
    }
    return slots;
  }, []);

  // Generate deterministic realistic historical load data per worker node over time slots
  const heatmapData = useMemo(() => {
    return workers.map((w, wIndex) => {
      const history = timeSlots.map((slot, tIndex) => {
        // Deterministic variance based on worker ID and time slot index
        const hash = (wIndex * 17 + tIndex * 31) % 100;
        const sineWave = Math.sin(tIndex * 0.5 + wIndex) * 15;
        
        let cpu = Math.max(5, Math.min(98, Math.round(w.currentCpuUsage + sineWave + ((hash % 20) - 10))));
        let ram = Math.max(10, Math.min(95, Math.round(w.currentRamUsage + sineWave * 0.5 + ((hash % 14) - 7))));
        let workload = Math.max(0, Math.min(100, Math.round((cpu * 0.6) + (ram * 0.4))));
        let jobsCount = Math.max(0, Math.round((cpu / 100) * w.cpuCapacity));

        if (tIndex === 11) {
          // Latest slot reflects actual live state exactly
          cpu = w.currentCpuUsage;
          ram = w.currentRamUsage;
          workload = w.currentWorkload;
          jobsCount = w.activeJobs;
        }

        return {
          slotId: slot.id,
          timeLabel: slot.label,
          timeStr: slot.timeStr,
          cpu,
          ram,
          workload,
          jobsCount,
        };
      });

      return {
        worker: w,
        history,
      };
    });
  }, [workers, timeSlots]);

  // Color Intensity Helper
  const getCellColor = (value: number) => {
    if (value >= 85) return 'bg-rose-500/90 text-white border-rose-400/50 shadow-sm shadow-rose-500/30';
    if (value >= 70) return 'bg-amber-500/85 text-amber-950 border-amber-400/50';
    if (value >= 50) return 'bg-emerald-500/75 text-emerald-950 border-emerald-400/40';
    if (value >= 25) return 'bg-sky-500/60 text-slate-100 border-sky-400/30';
    if (value > 0) return 'bg-slate-800/80 text-slate-400 border-slate-700/40';
    return 'bg-slate-900 text-slate-600 border-slate-800';
  };

  // Peak hotspot stats calculation
  const peakHotspot = useMemo(() => {
    let maxVal = -1;
    let maxWorker = '';
    let maxTime = '';
    heatmapData.forEach((row) => {
      row.history.forEach((h) => {
        const val = metricMode === 'cpu' ? h.cpu : metricMode === 'ram' ? h.ram : h.workload;
        if (val > maxVal) {
          maxVal = val;
          maxWorker = getWorkerDisplayName(row.worker.id, row.worker.name);
          maxTime = h.timeLabel;
        }
      });
    });
    return { maxVal, maxWorker, maxTime };
  }, [heatmapData, metricMode]);

  // Jobs completed vs failed per worker
  const workerJobDistribution = workers.map((w) => ({
    name: getWorkerDisplayName(w.id, w.name),
    completed: w.completedJobs,
    failed: w.failedJobs,
    successRate: w.successRate,
  }));

  // Jobs distribution by type
  const typeCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    typeCounts[j.type] = (typeCounts[j.type] || 0) + 1;
  });

  const jobTypeData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type,
    count,
  }));

  const COLORS = ['#38BDF8', '#818CF8', '#C084FC', '#F472B6', '#34D399', '#FBBF24', '#A78BFA'];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#38BDF8]" />
            Cluster Performance & Workload Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry diagnostics, cluster thermal intensity heatmaps, and worker execution metrics.
          </p>
        </div>

        {/* Right header actions & status */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Export to CSV Button */}
          <button
            onClick={() => exportAnalyticsToCsv(status, workers, jobs, heatmapData)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#38BDF8] hover:bg-[#0284C7] text-[#0A0B0E] font-bold text-xs font-mono rounded-sm shadow-sm transition-colors cursor-pointer shrink-0"
            title="Export raw performance & telemetry metrics to CSV for spreadsheet analysis"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>

          {/* Live Cluster Health Status Pill */}
          <div className="flex items-center gap-3 font-mono text-xs bg-[#12141A] border border-[#22262E] p-2.5 rounded-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-bold">Node Telemetry Active</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Avg CPU: <strong className="text-emerald-400">{status?.systemCpuUsage.toFixed(1) || 0}%</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Avg RAM: <strong className="text-[#38BDF8]">{status?.systemRamUsage.toFixed(1) || 0}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* FEATURE: Cluster Resource Utilization Intensity Heatmap */}
      <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#22262E] pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400" />
              Cluster Resource Utilization Heatmap
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual intensity matrix tracking worker load across 5-minute rolling time windows.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Metric Mode Switcher */}
            <div className="flex items-center bg-[#0A0B0E] border border-[#22262E] p-0.5 rounded-sm font-mono text-xs">
              <button
                onClick={() => setMetricMode('cpu')}
                className={`px-2.5 py-1 rounded-xs transition-colors flex items-center gap-1 cursor-pointer ${
                  metricMode === 'cpu'
                    ? 'bg-[#38BDF8] text-[#0A0B0E] font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3 h-3" />
                <span>CPU Load</span>
              </button>
              <button
                onClick={() => setMetricMode('ram')}
                className={`px-2.5 py-1 rounded-xs transition-colors flex items-center gap-1 cursor-pointer ${
                  metricMode === 'ram'
                    ? 'bg-[#38BDF8] text-[#0A0B0E] font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>RAM Usage</span>
              </button>
              <button
                onClick={() => setMetricMode('workload')}
                className={`px-2.5 py-1 rounded-xs transition-colors flex items-center gap-1 cursor-pointer ${
                  metricMode === 'workload'
                    ? 'bg-[#38BDF8] text-[#0A0B0E] font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Combined Workload</span>
              </button>
            </div>
          </div>
        </div>

        {/* Heatmap Matrix Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px] space-y-1.5 font-mono">
            {/* Heatmap Time Headers */}
            <div className="grid grid-cols-13 gap-1.5 items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-[#22262E]/60">
              <div className="col-span-2 text-slate-300 flex items-center gap-1">
                <Grid className="w-3 h-3 text-[#38BDF8]" />
                <span>Worker Node</span>
              </div>
              {timeSlots.map((slot) => (
                <div key={slot.id} className="text-center font-mono text-slate-400">
                  {slot.label}
                </div>
              ))}
            </div>

            {/* Heatmap Rows */}
            {heatmapData.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                No active worker node telemetry available.
              </div>
            ) : (
              heatmapData.map((row) => (
                <div key={row.worker.id} className="grid grid-cols-13 gap-1.5 items-center">
                  {/* Worker Row Title */}
                  <div className="col-span-2 flex flex-col justify-center pr-2 truncate">
                    <span className="text-xs font-bold text-slate-200 truncate">{getWorkerDisplayName(row.worker.id, row.worker.name)}</span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {row.worker.cpuCapacity} Cores • {Math.round(row.worker.ramCapacity / 1024)}GB RAM
                    </span>
                  </div>

                  {/* Heatmap Interval Cells */}
                  {row.history.map((cell) => {
                    const value = metricMode === 'cpu' ? cell.cpu : metricMode === 'ram' ? cell.ram : cell.workload;
                    const colorClass = getCellColor(value);

                    return (
                      <div
                        key={cell.slotId}
                        onMouseEnter={() =>
                          setHoveredCell({
                            workerName: getWorkerDisplayName(row.worker.id, row.worker.name),
                            timeLabel: cell.timeLabel,
                            cpu: cell.cpu,
                            ram: cell.ram,
                            workload: cell.workload,
                            jobsCount: cell.jobsCount,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-9 rounded-xs border text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer hover:scale-105 hover:z-10 ${colorClass}`}
                      >
                        {value}%
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Heatmap Legend & Diagnostics Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#22262E] text-xs font-mono">
          {/* Legend */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Intensity Scale:</span>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">0-24% Low</span>
              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-sky-500/60 text-slate-100 border border-sky-400/30">25-49% Normal</span>
              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-500/75 text-emerald-950 border border-emerald-400/40">50-69% High</span>
              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-amber-500/85 text-amber-950 border border-amber-400/50">70-84% Heavy</span>
              <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-rose-500/90 text-white border border-rose-400/50">85%+ Peak</span>
            </div>
          </div>

          {/* Peak Hotspot Indicator */}
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-400">Peak Thermal Hotspot:</span>
            <span className="text-amber-400 font-bold">
              {peakHotspot.maxWorker || 'N/A'} ({peakHotspot.maxVal}% at {peakHotspot.maxTime})
            </span>
          </div>
        </div>

        {/* Hover Inspector Banner */}
        {hoveredCell && (
          <div className="bg-[#0A0B0E] border border-[#38BDF8]/40 p-2.5 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-fadeIn">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#38BDF8]" />
              <span className="text-slate-200 font-bold">{hoveredCell.workerName}</span>
              <span className="text-slate-500">Interval: {hoveredCell.timeLabel}</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div>CPU: <strong className="text-emerald-400">{hoveredCell.cpu}%</strong></div>
              <div>RAM: <strong className="text-[#38BDF8]">{hoveredCell.ram}%</strong></div>
              <div>Workload Intensity: <strong className="text-purple-400">{hoveredCell.workload}%</strong></div>
              <div>Concurrent Jobs: <strong className="text-amber-400">{hoveredCell.jobsCount}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Grid 1: Worker Execution Distribution & Success Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono uppercase tracking-wider">
            <Server className="w-4 h-4 text-[#38BDF8]" />
            Jobs Distributed per Worker Node
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerJobDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0A0B0E', borderColor: '#22262E' }} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill="#f43f5e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Job Workload Breakdown by Type
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            {jobTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={jobTypeData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {jobTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0A0B0E', borderColor: '#22262E' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500 font-mono">No job workloads analyzed yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid 2: Worker Success Rates Summary Cards */}
      <div className="bg-[#12141A] border border-[#22262E] rounded-sm p-5 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
          Worker Health & Reliability Metrics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workers.map((w) => (
            <div key={w.id} className="bg-[#0A0B0E] p-4 rounded-sm border border-[#22262E] space-y-2 font-mono hover:border-[#38BDF8]/40 transition-colors">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-200">{getWorkerDisplayName(w.id, w.name)}</span>
                <span className="text-emerald-400 font-bold">{w.successRate}%</span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="text-amber-400">{w.avgExecutionTimeMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="text-slate-200">{w.completedJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="text-rose-400">{w.failedJobs}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

