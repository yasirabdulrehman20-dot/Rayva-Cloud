import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Copy,
  Download,
  Sparkles,
  X,
  RefreshCw,
  BarChart3,
  Check,
  Server,
  Zap,
  Info,
  FileText,
} from 'lucide-react';
import { SystemStatus, WorkerNodeData, Job } from '../shared/types.ts';
import { exportHealthReportToPdf } from '../utils/exportUtils.ts';

interface SystemHealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus | null;
  workers: WorkerNodeData[];
  jobs: Job[];
}

interface HealthReportData {
  timestamp: number;
  healthGrade: 'OPTIMAL' | 'ELEVATED LOAD' | 'CRITICAL LOAD' | 'MAINTENANCE';
  healthScore: number;
  generatedBy: string;
  executiveSummary: string;
  keyObservations: string[];
  metrics: {
    workersOnline: number;
    workersTotal: number;
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    cpuUsage: number;
    ramUsage: number;
    activeStrategy: string;
    maintenanceMode: boolean;
  };
  recommendations: string[];
}

export const SystemHealthReportModal: React.FC<SystemHealthReportModalProps> = ({
  isOpen,
  onClose,
  status,
  workers,
  jobs,
}) => {
  const [report, setReport] = useState<HealthReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchHealthReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/health-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
      } else {
        // Fallback local report generation
        generateLocalReport();
      }
    } catch (err) {
      generateLocalReport();
    } finally {
      setLoading(false);
    }
  };

  const generateLocalReport = () => {
    if (!status) return;

    const totalJobs = jobs.length;
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    const failed = jobs.filter((j) => j.status === 'FAILED').length;
    const queued = jobs.filter((j) => j.status === 'QUEUED').length;
    const running = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED').length;

    const cpu = status.systemCpuUsage || 0;
    const ram = status.systemRamUsage || 0;
    const isMaintenance = status.maintenanceMode;

    let grade: 'OPTIMAL' | 'ELEVATED LOAD' | 'CRITICAL LOAD' | 'MAINTENANCE' = 'OPTIMAL';
    let score = 98;

    if (isMaintenance) {
      grade = 'MAINTENANCE';
      score = 80;
    } else if (cpu >= 90 || ram >= 90) {
      grade = 'CRITICAL LOAD';
      score = Math.max(35, 100 - Math.max(cpu, ram));
    } else if (cpu >= 70 || ram >= 70 || queued > 5) {
      grade = 'ELEVATED LOAD';
      score = Math.max(65, 100 - Math.round((cpu + ram) / 2));
    } else {
      score = Math.max(88, 100 - Math.round((cpu + ram) / 4) - failed * 2);
    }

    const onlineWorkers = workers.filter((w) => w.status !== 'OFFLINE' && w.status !== 'FAILED').length;
    const totalWorkers = workers.length;

    const summaryParts: string[] = [];
    summaryParts.push(
      `The Rayva Cloud distributed cluster is operating with ${onlineWorkers} of ${totalWorkers} worker nodes active (${Math.round(
        (onlineWorkers / Math.max(1, totalWorkers)) * 100
      )}% availability).`
    );

    summaryParts.push(
      `Aggregate resource utilization is currently at ${cpu}% CPU and ${ram}% RAM across allocated nodes.`
    );

    if (isMaintenance) {
      summaryParts.push(
        `SYSTEM NOTICE: Cluster Maintenance Mode is currently ACTIVE. New job submissions are paused while background workers finalize running workloads.`
      );
    } else if (grade === 'CRITICAL LOAD') {
      summaryParts.push(
        `ALERT: Cluster compute capacity is experiencing critical pressure (>90% utilization). Queued workloads may experience processing latency.`
      );
    } else if (grade === 'ELEVATED LOAD') {
      summaryParts.push(
        `Workload load is elevated. Active jobs are being routed effectively via the ${status.activeStrategy} scheduler strategy.`
      );
    } else {
      summaryParts.push(
        `Cluster posture is optimal with healthy memory and compute headroom available for upcoming batch jobs.`
      );
    }

    const observations: string[] = [
      `Node Availability: ${onlineWorkers}/${totalWorkers} nodes operational with average CPU utilization at ${cpu}%.`,
      `Job Pipeline: ${totalJobs} total jobs tracked (${running} running, ${queued} queued, ${completed} completed, ${failed} failed).`,
      `Scheduler Strategy: Routing active workloads using '${status.activeStrategy}' scheduling policy.`,
      `Cluster Uptime: ${Math.floor(status.uptimeSeconds / 3600)}h ${Math.floor(
        (status.uptimeSeconds % 3600) / 60
      )}m active uptime.`,
    ];

    if (isMaintenance) {
      observations.push('Maintenance Guard: New submissions are suspended via system maintenance switch.');
    }
    if (failed > 0) {
      observations.push(`Failure Telemetry: ${failed} job(s) reported execution errors or timeouts.`);
    }

    const recs: string[] = [];
    if (isMaintenance) {
      recs.push('Disable Maintenance Mode once operational updates complete to resume job ingestion.');
    }
    if (cpu >= 85 || ram >= 85) {
      recs.push('Scale worker node pool or register additional compute instances to relieve compute bottleneck.');
    }
    if (queued > 5) {
      recs.push('Consider switching scheduler strategy to "Least Loaded" or "Resource Aware" to accelerate queue drain.');
    }
    if (failed > 0) {
      recs.push('Inspect execution ledger and failure logs for detailed stack traces on failed jobs.');
    }
    if (recs.length === 0) {
      recs.push('Current cluster metrics are within nominal safety parameters. No immediate intervention required.');
      recs.push('Maintain current scheduling strategy and monitor worker memory headroom during peak hours.');
    }

    setReport({
      timestamp: Date.now(),
      healthGrade: grade,
      healthScore: score,
      generatedBy: 'Rayva Cluster Health Engine',
      executiveSummary: summaryParts.join(' '),
      keyObservations: observations,
      metrics: {
        workersOnline: onlineWorkers,
        workersTotal: totalWorkers,
        activeJobs: running,
        queuedJobs: queued,
        completedJobs: completed,
        failedJobs: failed,
        cpuUsage: cpu,
        ramUsage: ram,
        activeStrategy: status.activeStrategy,
        maintenanceMode: isMaintenance,
      },
      recommendations: recs,
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealthReport();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyText = () => {
    if (!report) return;
    const text = `
=====================================================
RAYVA CLOUD - SYSTEM HEALTH EXECUTIVE REPORT
=====================================================
Generated: ${new Date(report.timestamp).toLocaleString()}
Health Grade: ${report.healthGrade} (${report.healthScore}/100)
Engine: ${report.generatedBy}

EXECUTIVE SUMMARY:
${report.executiveSummary}

KEY METRICS & POSTURE:
- Workers: ${report.metrics.workersOnline} / ${report.metrics.workersTotal} Online
- CPU Usage: ${report.metrics.cpuUsage}%
- RAM Usage: ${report.metrics.ramUsage}%
- Active Jobs: ${report.metrics.activeJobs}
- Queued Jobs: ${report.metrics.queuedJobs}
- Completed Jobs: ${report.metrics.completedJobs}
- Failed Jobs: ${report.metrics.failedJobs}
- Active Strategy: ${report.metrics.activeStrategy}
- Maintenance Mode: ${report.metrics.maintenanceMode ? 'ENABLED' : 'DISABLED'}

KEY OBSERVATIONS:
${report.keyObservations.map((o) => `• ${o}`).join('\n')}

OPERATIONAL RECOMMENDATIONS:
${report.recommendations.map((r) => `• ${r}`).join('\n')}
=====================================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const dateStr = new Date(report.timestamp).toISOString().split('T')[0];
    const text = `
=====================================================
RAYVA CLOUD - SYSTEM HEALTH EXECUTIVE REPORT
=====================================================
Generated: ${new Date(report.timestamp).toLocaleString()}
Health Grade: ${report.healthGrade} (${report.healthScore}/100)
Engine: ${report.generatedBy}

EXECUTIVE SUMMARY:
${report.executiveSummary}

KEY METRICS & POSTURE:
- Workers: ${report.metrics.workersOnline} / ${report.metrics.workersTotal} Online
- CPU Usage: ${report.metrics.cpuUsage}%
- RAM Usage: ${report.metrics.ramUsage}%
- Active Jobs: ${report.metrics.activeJobs}
- Queued Jobs: ${report.metrics.queuedJobs}
- Completed Jobs: ${report.metrics.completedJobs}
- Failed Jobs: ${report.metrics.failedJobs}
- Active Strategy: ${report.metrics.activeStrategy}
- Maintenance Mode: ${report.metrics.maintenanceMode ? 'ENABLED' : 'DISABLED'}

KEY OBSERVATIONS:
${report.keyObservations.map((o) => `• ${o}`).join('\n')}

RECOMMENDATIONS:
${report.recommendations.map((r) => `• ${r}`).join('\n')}
=====================================================
    `.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rayva_Cloud_Health_Report_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getGradeStyle = (grade: string) => {
    switch (grade) {
      case 'OPTIMAL':
        return 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
      case 'ELEVATED LOAD':
        return 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      case 'CRITICAL LOAD':
        return 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)]';
      case 'MAINTENANCE':
        return 'bg-sky-950/80 border-sky-500 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]';
      default:
        return 'bg-[#12141A] border-[#22262E] text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
      <div className="bg-[#12141A] border border-[#22262E] rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans my-auto">
        {/* Header */}
        <div className="p-4 border-b border-[#22262E] flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#12141A] border border-[#38BDF8]/40 p-1 flex items-center justify-center shrink-0 shadow-sm">
              <img src="/favicon.svg" alt="Rayva Cloud Logo" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
                System Health Executive Report
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22262E] text-[#38BDF8] border border-[#38BDF8]/30">
                  REAL-TIME DIAGNOSTICS
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Cluster compute metrics, queue velocity, and operational executive posture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealthReport}
              disabled={loading}
              className="p-2 text-[#94A3B8] hover:text-white bg-[#12141A] hover:bg-[#22262E] rounded border border-[#22262E] transition-colors cursor-pointer"
              title="Refresh Health Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#38BDF8]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#94A3B8] hover:text-white bg-[#12141A] hover:bg-[#22262E] rounded border border-[#22262E] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#38BDF8] animate-spin mx-auto" />
              <p className="text-xs font-mono text-[#94A3B8]">Analyzing cluster metrics & generating executive synthesis...</p>
            </div>
          ) : report ? (
            <>
              {/* Top Summary Banner */}
              <div className="flex flex-col md:flex-row items-stretch gap-4">
                {/* Health Score Pill */}
                <div
                  className={`p-4 rounded-lg border flex flex-col justify-between items-center text-center min-w-[200px] shrink-0 ${getGradeStyle(
                    report.healthGrade
                  )}`}
                >
                  <span className="text-[11px] font-mono font-bold tracking-wider uppercase opacity-80">
                    STATUS POSTURE
                  </span>
                  <div className="my-2">
                    <span className="text-3xl font-black font-mono tracking-tight">{report.healthScore}</span>
                    <span className="text-sm font-bold opacity-70"> / 100</span>
                  </div>
                  <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded bg-black/40 border border-current">
                    {report.healthGrade}
                  </span>
                </div>

                {/* Executive Summary Card */}
                <div className="p-4 rounded-lg bg-[#0A0B0E] border border-[#22262E] flex-1 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between border-b border-[#22262E]/60 pb-2">
                    <span className="text-xs font-mono font-bold text-[#38BDF8] flex items-center gap-1.5 uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Executive Summary
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      Generated via {report.generatedBy}
                    </span>
                  </div>
                  <p className="text-xs text-[#E2E8F0] leading-relaxed font-sans pt-1">
                    {report.executiveSummary}
                  </p>
                  <div className="text-[10px] font-mono text-[#94A3B8] pt-2 flex items-center gap-2">
                    <span>Timestamp: {new Date(report.timestamp).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span>Uptime: {status ? `${Math.floor(status.uptimeSeconds / 3600)}h ${Math.floor((status.uptimeSeconds % 3600) / 60)}m` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Metric Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#0A0B0E] border border-[#22262E] rounded-md font-mono space-y-1">
                  <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>WORKERS ONLINE</span>
                  </div>
                  <div className="text-xl font-bold text-white flex items-baseline gap-1">
                    <span>{report.metrics.workersOnline}</span>
                    <span className="text-xs text-[#94A3B8]">/ {report.metrics.workersTotal} Nodes</span>
                  </div>
                  <div className="w-full bg-[#1A1D24] h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-[#38BDF8] h-full transition-all"
                      style={{
                        width: `${Math.round(
                          (report.metrics.workersOnline / Math.max(1, report.metrics.workersTotal)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-[#0A0B0E] border border-[#22262E] rounded-md font-mono space-y-1">
                  <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>CLUSTER CPU LOAD</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    <span className={report.metrics.cpuUsage >= 85 ? 'text-rose-400 font-extrabold' : 'text-purple-300'}>
                      {report.metrics.cpuUsage}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1A1D24] h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all ${
                        report.metrics.cpuUsage >= 85 ? 'bg-rose-500' : 'bg-purple-400'
                      }`}
                      style={{ width: `${report.metrics.cpuUsage}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-[#0A0B0E] border border-[#22262E] rounded-md font-mono space-y-1">
                  <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CLUSTER RAM LOAD</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    <span className={report.metrics.ramUsage >= 85 ? 'text-rose-400 font-extrabold' : 'text-emerald-300'}>
                      {report.metrics.ramUsage}%
                    </span>
                  </div>
                  <div className="w-full bg-[#1A1D24] h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all ${
                        report.metrics.ramUsage >= 85 ? 'bg-rose-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${report.metrics.ramUsage}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-[#0A0B0E] border border-[#22262E] rounded-md font-mono space-y-1">
                  <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>SCHEDULER MODE</span>
                  </div>
                  <div className="text-sm font-bold text-amber-300 truncate">
                    {report.metrics.activeStrategy}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">
                    {report.metrics.maintenanceMode ? 'Maintenance Paused' : 'Ingestion Normal'}
                  </div>
                </div>
              </div>

              {/* Key Observations Section */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#38BDF8]" />
                  Key Operational Observations
                </h3>
                <div className="bg-[#0A0B0E] border border-[#22262E] rounded-md p-3 space-y-2 font-mono text-xs">
                  {report.keyObservations.map((obs, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-[#E2E8F0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{obs}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Actionable Operational Recommendations
                </h3>
                <div className="bg-[#0A0B0E] border border-[#22262E] rounded-md p-3 space-y-2 font-mono text-xs">
                  {report.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              No report available. Click refresh to generate report.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#22262E] bg-[#0A0B0E] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              disabled={!report}
              className="px-3 py-1.5 bg-[#12141A] hover:bg-[#22262E] border border-[#22262E] hover:border-[#38BDF8]/40 text-[#E2E8F0] rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">COPIED TO CLIPBOARD</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>COPY SUMMARY</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={!report}
              className="px-3 py-1.5 bg-[#12141A] hover:bg-[#22262E] border border-[#22262E] hover:border-[#38BDF8]/40 text-[#E2E8F0] rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>TEXT REPORT (.TXT)</span>
            </button>

            <button
              onClick={() => report && exportHealthReportToPdf(report)}
              disabled={!report}
              className="px-3 py-1.5 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>DOWNLOAD PDF REPORT</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold text-xs rounded transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
