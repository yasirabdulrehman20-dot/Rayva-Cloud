import React, { useEffect, useState, useRef } from 'react';
import {
  SystemStatus,
  WorkerNodeData,
  Job,
  SystemLog,
  SchedulerDecision,
  ExecutionRecord,
  SchedulerStrategyType,
  JobType,
  JobPriority,
  SimulationConfig,
  ToastNotification,
} from './shared/types.js';

import { Sidebar, TabType } from './components/Sidebar.tsx';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { JobsView } from './components/JobsView.tsx';
import { JobDetailModal } from './components/JobDetailModal.tsx';
import { WorkersView } from './components/WorkersView.tsx';
import { WorkerDetailModal } from './components/WorkerDetailModal.tsx';
import { SchedulerView } from './components/SchedulerView.tsx';
import { LedgerView } from './components/LedgerView.tsx';
import { LogsView } from './components/LogsView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { exportFullAuditBundleToJson, exportFullAuditBundleToPdf } from './utils/exportUtils.js';
import { SimulationView } from './components/SimulationView.tsx';
import { SnapshotsView } from './components/SnapshotsView.tsx';
import { CliView } from './components/CliView.tsx';
import { SystemHealthReportModal } from './components/SystemHealthReportModal.tsx';
import { DatabaseRecoveryModal } from './components/DatabaseRecoveryModal.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthLayout } from './components/auth/AuthLayout.tsx';
import { Cloud, Wrench, AlertTriangle } from 'lucide-react';

function RayvaCloudContent() {
  const { user, token, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [workers, setWorkers] = useState<WorkerNodeData[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [decisions, setDecisions] = useState<SchedulerDecision[]>([]);
  const [ledgerRecords, setLedgerRecords] = useState<ExecutionRecord[]>([]);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerNodeData | null>(null);
  const [isHealthReportOpen, setIsHealthReportOpen] = useState<boolean>(false);
  const [isDbRecoveryOpen, setIsDbRecoveryOpen] = useState<boolean>(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const prevWorkerStatusRef = useRef<Record<string, string>>({});
  const prevJobStatusRef = useRef<Record<string, string>>({});
  const isAutoRefreshRef = useRef<boolean>(true);

  useEffect(() => {
    isAutoRefreshRef.current = isAutoRefresh;
  }, [isAutoRefresh]);

  const addToast = (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
    const newToast: ToastNotification = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearAllToasts = () => {
    setToasts([]);
  };

  const getAuthHeaders = (): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const processStateToasts = (newWorkers?: WorkerNodeData[], newJobs?: Job[]) => {
    if (newWorkers) {
      newWorkers.forEach((w) => {
        const prevStatus = prevWorkerStatusRef.current[w.id];
        if (
          prevStatus &&
          (prevStatus === 'ONLINE' || prevStatus === 'IDLE' || prevStatus === 'BUSY') &&
          (w.status === 'OFFLINE' || w.status === 'FAILED')
        ) {
          addToast({
            type: 'error',
            title: 'CRITICAL: WORKER NODE FAILURE',
            message: `Worker Node "${w.name}" (${w.id}) went ${w.status}!`,
            persistent: true,
            actionLabel: 'Inspect Worker',
            onAction: () => {
              setActiveTab('workers');
              setSelectedWorker(w);
            },
          });
        }
        prevWorkerStatusRef.current[w.id] = w.status;
      });
    }

    if (newJobs) {
      newJobs.forEach((j) => {
        const prevStatus = prevJobStatusRef.current[j.id];
        if (
          prevStatus &&
          prevStatus !== 'CANCELLED' &&
          prevStatus !== 'FAILED' &&
          (j.status === 'CANCELLED' || j.status === 'FAILED')
        ) {
          addToast({
            type: j.status === 'FAILED' ? 'error' : 'warning',
            title: j.status === 'FAILED' ? 'CRITICAL: JOB FAILED' : 'JOB CANCELLED',
            message: `Job "${j.name}" (#${j.id}) state changed to ${j.status}.`,
            persistent: true,
            actionLabel: 'View Jobs',
            onAction: () => setActiveTab('jobs'),
          });
        }
        prevJobStatusRef.current[j.id] = j.status;
      });
    }
  };

  // Fetch initial data & fallback poll
  const fetchData = async () => {
    try {
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url, { headers: getAuthHeaders() });
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      };

      const [resStatus, resWorkers, resJobs, resLogs, resDec, resLedger] = await Promise.all([
        safeFetch('/api/system/status'),
        safeFetch('/api/workers'),
        safeFetch('/api/jobs'),
        safeFetch('/api/logs'),
        safeFetch('/api/scheduler/decisions'),
        safeFetch('/api/ledger'),
      ]);

      if (resStatus?.data) setStatus(resStatus.data);
      if (resWorkers?.data) {
        setWorkers(resWorkers.data);
        processStateToasts(resWorkers.data, undefined);
      }
      if (resJobs?.data) {
        setJobs(resJobs.data);
        processStateToasts(undefined, resJobs.data);
      }
      if (resLogs?.data) setLogs(resLogs.data);
      if (resDec?.data) setDecisions(resDec.data);
      if (resLedger?.data) setLedgerRecords(resLedger.data);
    } catch (e) {
      console.warn('Transient fetch cluster state:', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup resilient WebSocket with graceful backoff reconnection & cleanup
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isUnmounted = false;
    let retryDelay = 2000;
    const maxRetryDelay = 30000;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        const wsUrl = `${protocol}//${window.location.host}/ws${tokenParam}`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) {
            ws?.close();
            return;
          }
          // Reset retry delay upon successful connection
          retryDelay = 2000;
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.data) {
              if (parsed.data.status) setStatus(parsed.data.status);
              if (!isAutoRefreshRef.current) return;
              if (parsed.data.workers) {
                setWorkers(parsed.data.workers);
                processStateToasts(parsed.data.workers, undefined);
              }
              if (parsed.data.jobs) {
                setJobs(parsed.data.jobs);
                processStateToasts(undefined, parsed.data.jobs);
              }
            }
          } catch (err) {
            // Ignore malformed transient frames
          }
        };

        ws.onerror = () => {
          // Gracefully suppress expected early WebSocket connection errors / handshake terminations
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          // Schedule exponential backoff reconnect without blocking or logging unhandled rejections
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isUnmounted) {
              retryDelay = Math.min(retryDelay * 1.5, maxRetryDelay);
              connectWebSocket();
            }
          }, retryDelay);
        };
      } catch (e) {
        // Fallback gracefully to REST polling without throwing unhandled exceptions
        if (!isUnmounted) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isUnmounted) connectWebSocket();
          }, retryDelay);
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        // Detach handlers before closing to prevent post-unmount triggers
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch (_) {}
        ws = null;
      }
    };
  }, [token]);

  // Managed 2000ms polling interval
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Keep authoritative system status synchronized even when detailed auto-refresh is paused.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/system/status', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data?.data) setStatus(data.data);
        }
      } catch {
        // WebSocket and the detailed polling loop remain responsible for other state.
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [token]);

  // Handler actions
  const handleChangeStrategy = async (strat: SchedulerStrategyType) => {
    await fetch('/api/scheduler/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ strategy: strat }),
    });
    addToast({
      type: 'info',
      title: 'SCHEDULER STRATEGY UPDATED',
      message: `Active scheduling policy switched to ${strat.replace('_', ' ')}.`,
    });
    fetchData();
  };

  const handleSimulateFailure = async (id: string) => {
    const targetWorker = workers.find((w) => w.id === id);
    await fetch(`/api/workers/${id}/fail`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    addToast({
      type: 'error',
      title: 'CRITICAL: WORKER FAILURE',
      message: `Worker Node "${targetWorker?.name || id}" (${id}) went UNHEALTHY / OFFLINE!`,
      persistent: true,
      actionLabel: 'Inspect Worker',
      onAction: () => {
        setActiveTab('workers');
        if (targetWorker) setSelectedWorker(targetWorker);
      },
    });
    fetchData();
  };

  const handleRecoverWorker = async (id: string) => {
    const targetWorker = workers.find((w) => w.id === id);
    await fetch(`/api/workers/${id}/recover`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    addToast({
      type: 'success',
      title: 'WORKER RECOVERED',
      message: `Worker Node "${targetWorker?.name || id}" re-registered as HEALTHY.`,
      persistent: true,
    });
    fetchData();
  };

  const handleCancelJob = async (id: string) => {
    const targetJob = jobs.find((j) => j.id === id);
    await fetch(`/api/jobs/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    addToast({
      type: 'warning',
      title: 'JOB CANCELLED',
      message: `Job "${targetJob?.name || id}" (#${id}) was cancelled by user.`,
      persistent: true,
      actionLabel: 'View Jobs',
      onAction: () => setActiveTab('jobs'),
    });
    fetchData();
  };

  const handleToggleMaintenance = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addToast({
          type: 'error',
          title: 'MAINTENANCE TOGGLE ERROR',
          message: data.error || 'Failed to update maintenance mode state.',
        });
      } else {
        addToast({
          type: enabled ? 'warning' : 'success',
          title: enabled ? 'SYSTEM MAINTENANCE MODE ACTIVATED' : 'MAINTENANCE MODE DEACTIVATED',
          message: enabled
            ? 'Cluster is now in Maintenance Mode. New job submissions are suspended.'
            : 'Maintenance mode disabled. Normal job scheduling and submissions resumed.',
          persistent: enabled,
        });
        fetchData();
      }
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'MAINTENANCE ERROR',
        message: e.message || 'Error communicating with cluster controller.',
      });
    }
  };

  const handleSubmitNewJob = async (
    name: string,
    type: JobType,
    priority: JobPriority,
    payload: any
  ) => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name, type, priority, payload }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addToast({
          type: 'error',
          title: 'JOB SUBMISSION REJECTED',
          message: data.error || 'Failed to submit job to queue.',
          persistent: true,
        });
      } else {
        addToast({
          type: 'info',
          title: 'JOB SUBMITTED',
          message: `Submitted "${name}" (${priority} priority) to queue.`,
        });
        fetchData();
      }
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'JOB SUBMISSION ERROR',
        message: e.message || 'Communication error during job submission.',
      });
    }
  };

  const handleRegisterWorker = async (name: string, host: string, cpuCapacity: number, ramCapacity: number) => {
    await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name, host, cpuCapacity, ramCapacity }),
    });
    fetchData();
  };

  const handleVerifyLedger = async () => {
    const res = await fetch('/api/ledger/verify', {
      headers: getAuthHeaders(),
    }).then((r) => r.json());
    return res.data;
  };

  const handleStartSimulation = async (config: SimulationConfig) => {
    await fetch('/api/simulation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(config),
    });
    fetchData();
  };

  const handlePauseSimulation = async () => {
    await fetch('/api/simulation/pause', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] flex flex-col items-center justify-center text-[#E2E8F0] font-mono p-4">
        <div className="p-4 bg-[#12141A] rounded-lg border border-[#22262E] shadow-2xl flex items-center gap-3 mb-3 animate-pulse">
          <Cloud className="w-6 h-6 text-[#38BDF8]" />
          <span className="font-extrabold text-sm tracking-wider text-white">RAYVA CLOUD SECURITY GATEWAY</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <div className="w-3.5 h-3.5 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
          <span>Verifying cryptographic session token...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthLayout />;
  }

  const isAdmin = user?.role === 'Cluster Admin';
  const sidebarActiveJobs = isAdmin
    ? (status?.activeJobs || 0)
    : jobs.filter((j) => j.status === 'RUNNING' || j.status === 'ASSIGNED' || j.status === 'SCHEDULING').length;

  const sidebarQueuedJobs = isAdmin
    ? (status?.queuedJobs || 0)
    : jobs.filter((j) => j.status === 'QUEUED' || j.status === 'RETRYING').length;

  return (
    <div className="flex h-screen bg-[#0A0B0E] text-[#E2E8F0] font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onlineWorkers={status?.onlineWorkers || 0}
        queuedJobs={sidebarQueuedJobs}
        activeJobs={sidebarActiveJobs}
        jobs={jobs}
        workers={workers}
        isAdmin={isAdmin}
        onSelectJob={(job) => {
          setSelectedJob(job);
          setActiveTab('jobs');
        }}
        onSelectWorker={(worker) => {
          setSelectedWorker(worker);
          setActiveTab('workers');
        }}
        onOpenHealthReport={() => setIsHealthReportOpen(true)}
        onOpenDbRecovery={() => setIsDbRecoveryOpen(true)}
        onExportBundleJson={() => exportFullAuditBundleToJson(logs, ledgerRecords, status, user, jobs)}
        onExportBundlePdf={() => exportFullAuditBundleToPdf(logs, ledgerRecords, status, user, jobs)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          status={status}
          onOpenQuickSubmit={() => setActiveTab('jobs')}
          onRefresh={fetchData}
          onChangeStrategy={handleChangeStrategy}
          onToggleMaintenance={handleToggleMaintenance}
          canManageMaintenance={isAdmin}
          onOpenHealthReport={() => setIsHealthReportOpen(true)}
          onOpenDbRecovery={() => setIsDbRecoveryOpen(true)}
          onExportBundleJson={() => exportFullAuditBundleToJson(logs, ledgerRecords, status, user, jobs)}
          onExportBundlePdf={() => exportFullAuditBundleToPdf(logs, ledgerRecords, status, user, jobs)}
          isAutoRefresh={isAutoRefresh}
          onToggleAutoRefresh={setIsAutoRefresh}
        />

        {/* System-wide Maintenance Mode Banner */}
        {status?.maintenanceMode && (
          <div className="bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border-b border-amber-500/60 px-4 py-2.5 text-amber-100 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-sm bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 animate-pulse">
                <Wrench className="w-4 h-4 text-amber-400 stroke-[2.5]" />
              </span>
              <div>
                <div className="flex items-center gap-2 font-extrabold tracking-wider uppercase text-amber-300">
                  <span>[MAINTENANCE MODE ACTIVE]</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black">
                    SUBMISSIONS SUSPENDED
                  </span>
                </div>
                <div className="text-amber-200/90 text-[11px] mt-0.5">
                  System maintenance in progress. New job submissions are temporarily disabled. Running workloads continue execution.
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleToggleMaintenance(false)}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 hover:text-amber-100 border border-amber-500/50 rounded-sm text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto flex items-center gap-1.5"
              >
                <span>DISABLE MAINTENANCE</span>
              </button>
            )}
          </div>
        )}

        {/* Tab View Container */}
        <main className="flex-1 overflow-y-auto bg-[#0A0B0E]">
          {activeTab === 'dashboard' && (
            <DashboardView
              status={status}
              workers={workers}
              jobs={jobs}
              logs={logs}
              user={user}
              onNavigate={setActiveTab}
              onViewJob={setSelectedJob}
              onViewWorker={setSelectedWorker}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsView
              jobs={jobs}
              workers={workers}
              maintenanceMode={status?.maintenanceMode}
              onViewJob={setSelectedJob}
              onCancelJob={handleCancelJob}
              onSubmitNewJob={handleSubmitNewJob}
            />
          )}

          {activeTab === 'workers' && (
            <WorkersView
              workers={workers}
              onViewWorker={setSelectedWorker}
              onSimulateFailure={handleSimulateFailure}
              onRecoverWorker={handleRecoverWorker}
              onRegisterWorker={handleRegisterWorker}
            />
          )}

          {activeTab === 'scheduler' && (
            <SchedulerView
              decisions={decisions}
              activeStrategy={status?.activeStrategy || 'RESOURCE_AWARE'}
              onChangeStrategy={handleChangeStrategy}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView records={ledgerRecords} jobs={jobs} currentUser={user} onVerifyLedger={handleVerifyLedger} />
          )}

          {activeTab === 'logs' && <LogsView logs={logs} currentUser={user} />}

          {activeTab === 'analytics' && (
            <AnalyticsView status={status} workers={workers} jobs={jobs} />
          )}

          {activeTab === 'snapshots' && (
            <SnapshotsView
              status={status}
              jobs={jobs}
              workers={workers}
              onRestoreSnapshot={(snap) => {
                setActiveTab('simulation');
                addToast({
                  type: 'success',
                  title: 'Snapshot Preset Loaded',
                  message: `Loaded "${snap.name}" into Simulation mode.`,
                });
              }}
              onAddToast={(title, msg, type) =>
                addToast({
                  type: type || 'info',
                  title,
                  message: msg,
                })
              }
            />
          )}

          {activeTab === 'simulation' && (
            <SimulationView
              status={status}
              onStartSimulation={handleStartSimulation}
              onPauseSimulation={handlePauseSimulation}
            />
          )}

          {activeTab === 'cli' && <CliView />}
        </main>
      </div>

      {/* Modals */}
      <SystemHealthReportModal
        isOpen={isHealthReportOpen}
        onClose={() => setIsHealthReportOpen(false)}
        status={status}
        workers={workers}
        jobs={jobs}
      />
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onAddToast={(title, msg, type) =>
          addToast({
            type: type || 'info',
            title,
            message: msg,
          })
        }
      />
      <WorkerDetailModal
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
        onSimulateFailure={handleSimulateFailure}
        onRecoverWorker={handleRecoverWorker}
        onAddToast={(title, msg, type) =>
          addToast({
            type: type || 'info',
            title,
            message: msg,
          })
        }
      />
      <DatabaseRecoveryModal
        isOpen={isDbRecoveryOpen}
        onClose={() => setIsDbRecoveryOpen(false)}
        onRefreshSystem={fetchData}
        onAddToast={(title, msg, type) =>
          addToast({
            type: type || 'info',
            title,
            message: msg,
          })
        }
      />

      {/* Persistent Toasts Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onClearAll={handleClearAllToasts}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RayvaCloudContent />
    </AuthProvider>
  );
}
