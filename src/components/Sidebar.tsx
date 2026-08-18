import React, { useState, useRef, useEffect } from 'react';
import { Job, WorkerNodeData } from '../shared/types.js';
import { RayvaLogo } from './RayvaLogo';
import {
  LayoutDashboard,
  Server,
  Cpu,
  GitBranch,
  FileCode2,
  Terminal,
  Activity,
  PlaySquare,
  ShieldCheck,
  Layers,
  Camera,
  Search,
  X,
  Briefcase,
  Database,
} from 'lucide-react';
import { ExportDropdown } from './ExportDropdown.tsx';

export type TabType =
  | 'dashboard'
  | 'jobs'
  | 'workers'
  | 'scheduler'
  | 'ledger'
  | 'logs'
  | 'analytics'
  | 'snapshots'
  | 'simulation'
  | 'cli';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onlineWorkers: number;
  queuedJobs: number;
  activeJobs: number;
  jobs?: Job[];
  workers?: WorkerNodeData[];
  onSelectJob?: (job: Job) => void;
  onSelectWorker?: (worker: WorkerNodeData) => void;
  onOpenHealthReport?: () => void;
  onExportBundleJson?: () => void;
  onExportBundlePdf?: () => void;
  onOpenDbRecovery?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onlineWorkers,
  queuedJobs,
  activeJobs,
  jobs = [],
  workers = [],
  onSelectJob,
  onSelectWorker,
  onOpenHealthReport,
  onExportBundleJson,
  onExportBundlePdf,
  onOpenDbRecovery,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = searchQuery.trim().toLowerCase();

  const matchingJobs = query
    ? jobs.filter(
        (j) =>
          j.id.toLowerCase().includes(query) ||
          j.name.toLowerCase().includes(query) ||
          j.type.toLowerCase().includes(query) ||
          j.status.toLowerCase().includes(query)
      ).slice(0, 5)
    : [];

  const matchingWorkers = query
    ? workers.filter(
        (w) =>
          w.id.toLowerCase().includes(query) ||
          w.name.toLowerCase().includes(query) ||
          w.host.toLowerCase().includes(query) ||
          w.status.toLowerCase().includes(query)
      ).slice(0, 5)
    : [];

  const hasResults = matchingJobs.length > 0 || matchingWorkers.length > 0;

  const handleJobClick = (job: Job) => {
    onSelectJob?.(job);
    setActiveTab('jobs');
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleWorkerClick = (worker: WorkerNodeData) => {
    onSelectWorker?.(worker);
    setActiveTab('workers');
    setIsOpen(false);
    setSearchQuery('');
  };

  const menuItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'jobs',
      label: 'Jobs & Queue',
      icon: <Server className="w-4 h-4" />,
      badge: activeJobs > 0 ? `${activeJobs} active` : queuedJobs > 0 ? `${queuedJobs} queued` : undefined,
      badgeColor: activeJobs > 0 ? 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    {
      id: 'workers',
      label: 'Worker Nodes',
      icon: <Cpu className="w-4 h-4" />,
      badge: onlineWorkers,
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    { id: 'scheduler', label: 'Scheduler Engine', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'ledger', label: 'Execution Ledger', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'logs', label: 'System Logs', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <Activity className="w-4 h-4" /> },
    { id: 'snapshots', label: 'System Snapshots', icon: <Camera className="w-4 h-4" /> },
    { id: 'simulation', label: 'Simulation Mode', icon: <PlaySquare className="w-4 h-4" /> },
    { id: 'cli', label: 'Rayva CLI', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-56 bg-[#12141A] border-r border-[#22262E] flex flex-col h-screen select-none shrink-0 font-sans">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-[#22262E] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <RayvaLogo size={28} />
          <div>
            <h1 className="font-extrabold text-base text-[#38BDF8] tracking-tight leading-none flex items-center gap-1.5">
              Rayva Cloud
            </h1>
            <span className="text-[10px] text-[#94A3B8] font-mono block mt-0.5">High Density v1.0</span>
          </div>
        </div>
      </div>

      {/* Quick Search Bar directly above Dashboard menu */}
      <div className="p-2 border-b border-[#22262E]/60 relative" ref={searchRef}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search Jobs / Workers..."
            className="w-full bg-[#0A0B0E] border border-[#22262E] text-[#E2E8F0] placeholder-[#94A3B8]/60 text-xs pl-8 pr-7 py-1.5 rounded-sm focus:outline-none focus:border-[#38BDF8] transition-colors font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
              className="absolute right-2 top-2 p-0.5 text-[#94A3B8] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown Popover */}
        {isOpen && query.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-[#12141A] border border-[#22262E] rounded-sm shadow-2xl z-50 max-h-80 overflow-y-auto p-2 font-sans space-y-2">
            {!hasResults ? (
              <div className="py-3 text-center text-[11px] text-[#94A3B8] font-mono">
                No matches found
              </div>
            ) : (
              <>
                {/* Matching Jobs Section */}
                {matchingJobs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#94A3B8] uppercase tracking-wider px-1.5 py-0.5 bg-[#0A0B0E] rounded-xs mb-1">
                      <Briefcase className="w-3 h-3 text-[#38BDF8]" />
                      <span>Jobs ({matchingJobs.length})</span>
                    </div>

                    <div className="space-y-1">
                      {matchingJobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => handleJobClick(job)}
                          className="w-full text-left p-1.5 rounded-xs hover:bg-[#22262E]/80 transition-colors flex flex-col gap-0.5 text-xs font-mono group cursor-pointer border border-transparent hover:border-[#38BDF8]/30"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[#38BDF8] group-hover:underline text-[11px]">
                              #{job.id}
                            </span>
                            <span
                              className={`px-1 py-0.2 text-[8px] font-extrabold rounded-xs uppercase ${
                                job.status === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : job.status === 'RUNNING'
                                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                  : job.status === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {job.status}
                            </span>
                          </div>
                          <span className="text-[#E2E8F0] font-sans text-[11px] font-medium truncate">
                            {job.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching Workers Section */}
                {matchingWorkers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#94A3B8] uppercase tracking-wider px-1.5 py-0.5 bg-[#0A0B0E] rounded-xs mb-1">
                      <Server className="w-3 h-3 text-purple-400" />
                      <span>Workers ({matchingWorkers.length})</span>
                    </div>

                    <div className="space-y-1">
                      {matchingWorkers.map((worker) => (
                        <button
                          key={worker.id}
                          onClick={() => handleWorkerClick(worker)}
                          className="w-full text-left p-1.5 rounded-xs hover:bg-[#22262E]/80 transition-colors flex flex-col gap-0.5 text-xs font-mono group cursor-pointer border border-transparent hover:border-purple-500/30"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white group-hover:underline text-[11px] truncate">
                              {worker.name}
                            </span>
                            <span
                              className={`px-1 py-0.2 text-[8px] font-extrabold rounded-xs uppercase ${
                                worker.status === 'ONLINE' || worker.status === 'IDLE'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : worker.status === 'BUSY'
                                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {worker.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#94A3B8] font-mono">
                            CPU: {worker.currentCpuUsage}% | RAM: {worker.currentRamUsage}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* System Health & Audit Quick Actions */}
      {(onOpenHealthReport || onExportBundleJson || onExportBundlePdf || onOpenDbRecovery) && (
        <div className="p-2 border-b border-[#22262E]/60 bg-[#0A0B0E]/50 space-y-1.5">
          {onOpenDbRecovery && (
            <button
              onClick={onOpenDbRecovery}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/40 hover:border-sky-400 text-sky-300 hover:text-white rounded transition-all text-xs font-mono font-bold cursor-pointer group shadow-sm"
              title="Detect malformed database files, view backups, and recover database"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="tracking-wide text-[11px]">DB RECOVERY</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 group-hover:bg-sky-400 group-hover:text-black transition-colors">
                UTILITY
              </span>
            </button>
          )}

          {onOpenHealthReport && (
            <button
              onClick={onOpenHealthReport}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 border border-[#38BDF8]/40 hover:border-[#38BDF8] text-[#38BDF8] hover:text-white rounded transition-all text-xs font-mono font-bold cursor-pointer group shadow-sm"
              title="Generate System Health Executive Report"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#38BDF8] animate-pulse shrink-0" />
                <span className="tracking-wide text-[11px]">HEALTH REPORT</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 group-hover:bg-[#38BDF8] group-hover:text-black transition-colors">
                REPORT
              </span>
            </button>
          )}

          {(onExportBundleJson || onExportBundlePdf) && (
            <ExportDropdown
              onExportJson={onExportBundleJson || (() => {})}
              onExportPdf={onExportBundlePdf || (() => {})}
              label="EXPORT AUDIT"
              className="w-full"
              variant="secondary"
              title="Export full cluster logs and ledger audit records"
            />
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-all border-l-2 ${
                isActive
                  ? 'border-[#38BDF8] text-white bg-[#38BDF8]/10'
                  : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#22262E]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor || 'bg-[#22262E] text-[#E2E8F0] border-[#22262E]'}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Node Info */}
      <div className="p-3 border-t border-[#22262E] bg-[#0A0B0E] text-[11px] text-[#94A3B8] space-y-1">
        <div className="flex justify-between items-center text-[#E2E8F0]">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#94A3B8]">Main Node</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ONLINE
          </span>
        </div>
        <p className="font-mono text-[10px] text-[#94A3B8] truncate">
          Express • SQLite • WS
        </p>
        <div className="text-[10px] font-sans text-[#94A3B8] pt-1 border-t border-[#22262E]/60 truncate">
          Developed by <span className="text-slate-300 font-medium">Abdul Rehman Yasir</span>
        </div>
      </div>
    </aside>
  );
};
