import React, { useState } from 'react';
import { SystemLog, User } from '../shared/types.js';
import { FileCode2, Search, Copy, Check } from 'lucide-react';
import { exportLogsToJson, exportLogsToPdf } from '../utils/exportUtils.js';
import { ExportDropdown } from './ExportDropdown.tsx';

interface LogsViewProps {
  logs: SystemLog[];
  currentUser: Pick<User, 'id' | 'email' | 'role'>;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, currentUser }) => {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.component.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopy = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] [${l.component}] ${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    exportLogsToJson(filteredLogs, { level: levelFilter, search }, currentUser);
  };

  const handleExportPdf = () => {
    exportLogsToPdf(filteredLogs, { level: levelFilter, search }, currentUser);
  };

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto font-sans text-[#E2E8F0]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#12141A] border border-[#22262E] p-3 rounded-sm">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#38BDF8]" />
            Real-time System Audit Logging Engine
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Structured cluster events, worker heartbeats, scheduler dispatch decisions, and execution failures.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-[#0A0B0E] hover:bg-[#22262E] text-[#94A3B8] hover:text-white border border-[#22262E] font-semibold px-3 py-1.5 rounded-sm text-xs transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#38BDF8]" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>

          <ExportDropdown
            onExportJson={handleExportJson}
            onExportPdf={handleExportPdf}
            label="EXPORT LOGS"
            variant="primary"
            title="Export logs as JSON or PDF"
          />
        </div>
      </div>

      {/* Filter Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-xs">
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search logs by keyword or component..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#12141A] border border-[#22262E] text-[#E2E8F0] pl-8 pr-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        <div className="flex bg-[#12141A] p-0.5 rounded-sm border border-[#22262E] text-xs font-mono">
          {['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`flex-1 py-1 rounded-xs text-center transition-colors text-[11px] cursor-pointer ${
                levelFilter === lvl
                  ? 'bg-[#0A0B0E] text-[#38BDF8] font-bold border border-[#22262E]'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Log Console Terminal Box */}
      <div className="bg-[#0A0B0E] border border-[#22262E] rounded-sm p-3 font-mono text-xs space-y-1.5 h-[580px] overflow-y-auto shadow-inner">
        {filteredLogs.length === 0 ? (
          <p className="text-[#94A3B8] py-12 text-center font-sans text-xs">
            No system log events match current filters.
          </p>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 py-1 px-2 rounded-xs hover:bg-[#12141A] transition-colors border-b border-[#22262E]/40"
            >
              <span className="text-[#94A3B8] shrink-0 select-none text-[11px]">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>

              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded-xs shrink-0 ${
                  log.level === 'ERROR'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : log.level === 'WARNING'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : log.level === 'DEBUG'
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30'
                }`}
              >
                {log.level}
              </span>

              <span className="text-[#94A3B8] font-bold shrink-0 text-[11px]">[{log.component}]</span>

              <span className="text-[#E2E8F0] flex-1 text-[11px]">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
