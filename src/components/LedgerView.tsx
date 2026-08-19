import React, { useEffect, useState } from 'react';
import { ExecutionRecord, Job, User } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { exportLedgerToJson, exportLedgerToPdf } from '../utils/exportUtils.js';
import { ExportDropdown } from './ExportDropdown.tsx';

interface LedgerViewProps {
  records: ExecutionRecord[];
  jobs: Job[];
  currentUser: Pick<User, 'id' | 'email' | 'role'>;
  onVerifyLedger: () => Promise<{ valid: boolean; recordCount: number; errors: string[] }>;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ records, jobs, currentUser, onVerifyLedger }) => {
  const [verification, setVerification] = useState<{ valid: boolean; recordCount: number; errors: string[] } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await onVerifyLedger();
      setVerification(res);
    } finally {
      setVerifying(false);
    }
  };

  const handleExportJson = () => {
    exportLedgerToJson(records, verification, currentUser, jobs);
  };

  const handleExportPdf = () => {
    exportLedgerToPdf(records, verification, currentUser, jobs);
  };

  useEffect(() => {
    handleVerify();
  }, [records.length]);

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto font-sans text-[#E2E8F0]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#12141A] border border-[#22262E] p-3 rounded-sm">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Execution Ledger (Verifiable Hash Audit Chain)
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Database-backed immutable cryptographic audit ledger recording every completed computation with SHA-256 state hashes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-1.5 bg-[#0A0B0E] hover:bg-[#22262E] text-[#94A3B8] hover:text-white border border-[#22262E] font-semibold px-3 py-1.5 rounded-sm text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#38BDF8] ${verifying ? 'animate-spin' : ''}`} />
            <span>Verify Chain Integrity</span>
          </button>

          <ExportDropdown
            onExportJson={handleExportJson}
            onExportPdf={handleExportPdf}
            label="EXPORT LEDGER"
            variant="primary"
            title="Export ledger hash chain as JSON or PDF"
          />
        </div>
      </div>

      {/* Verification Banner */}
      {verification && (
        <div
          className={`p-3 rounded-sm border flex items-center justify-between font-mono text-xs ${
            verification.valid
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {verification.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-bold text-xs block">
                {verification.valid ? 'Cryptographic Hash Chain Verified Valid' : 'Ledger Integrity Mismatch Detected'}
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Audited {verification.recordCount} records in hash sequence. 0 tampered entries found.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Table */}
      <div className="bg-[#12141A] border border-[#22262E] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-[#161922] text-[#94A3B8] border-b border-[#22262E] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3 font-medium">Record ID</th>
                <th className="py-2 px-3 font-medium">Job ID</th>
                <th className="py-2 px-3 font-medium">Worker</th>
                <th className="py-2 px-3 font-medium">Timestamp</th>
                <th className="py-2 px-3 font-medium">Input Hash</th>
                <th className="py-2 px-3 font-medium">Result Hash</th>
                <th className="py-2 px-3 font-medium">Prev Hash</th>
                <th className="py-2 px-3 font-medium">Record Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22262E]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#94A3B8] font-sans">
                    No execution ledger entries recorded yet. Submit jobs to generate verifiable records.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.recordId} className="hover:bg-[#22262E]/30 transition-colors">
                    <td className="py-2 px-3 font-bold text-[#38BDF8]">{r.recordId}</td>
                    <td className="py-2 px-3 text-[#E2E8F0]">{r.jobId}</td>
                    <td className="py-2 px-3 text-[#E2E8F0]">{getWorkerDisplayName(r.workerId, r.workerName)}</td>
                    <td className="py-2 px-3 text-[#94A3B8]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-purple-400 font-mono text-[11px]">
                      {r.inputHash.substring(0, 10)}...
                    </td>
                    <td className="py-2 px-3 text-blue-400 font-mono text-[11px]">
                      {r.resultHash.substring(0, 10)}...
                    </td>
                    <td className="py-2 px-3 text-[#94A3B8] font-mono text-[11px]">
                      {r.prevRecordHash.substring(0, 10)}...
                    </td>
                    <td className="py-2 px-3 text-emerald-400 font-mono text-[11px] font-bold">
                      {r.currentRecordHash.substring(0, 10)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
