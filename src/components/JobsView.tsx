import React, { useState } from 'react';
import { Job, JobType, JobPriority, JobStatus, WorkerNodeData } from '../shared/types.js';
import { getWorkerDisplayName } from '../shared/workerUtils.js';
import {
  Server,
  Plus,
  Search,
  Filter,
  XCircle,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
  Wrench,
  AlertTriangle,
} from 'lucide-react';

interface JobsViewProps {
  jobs: Job[];
  workers: WorkerNodeData[];
  maintenanceMode?: boolean;
  onViewJob: (job: Job) => void;
  onCancelJob: (jobId: string) => void;
  onSubmitNewJob: (name: string, type: JobType, priority: JobPriority, payload: any) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  workers,
  maintenanceMode = false,
  onViewJob,
  onCancelJob,
  onSubmitNewJob,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobType, setNewJobType] = useState<JobType>('PRIME_CALC');
  const [newJobPriority, setNewJobPriority] = useState<JobPriority>('NORMAL');
  const [newJobComplexity, setNewJobComplexity] = useState(5);

  const [useCustomParams, setUseCustomParams] = useState(false);
  const [customTargetNumber, setCustomTargetNumber] = useState<number>(50000);
  const [customArraySize, setCustomArraySize] = useState<number>(100000);
  const [customMatrixSize, setCustomMatrixSize] = useState<number>(150);
  const [customIterations, setCustomIterations] = useState<number>(25000);

  const filteredJobs = jobs.filter((j) => {
    if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && j.type !== typeFilter) return false;
    if (priorityFilter !== 'ALL' && j.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        j.id.toLowerCase().includes(q) ||
        j.name.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q) ||
        (j.assignedWorkerName && j.assignedWorkerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    let payload: any = {};

    if (useCustomParams) {
      if (newJobType === 'PRIME_CALC') {
        payload = { targetNumber: customTargetNumber };
      } else if (newJobType === 'FIBONACCI') {
        payload = { targetNumber: customTargetNumber };
      } else if (newJobType === 'SORTING') {
        payload = { arraySize: customArraySize };
      } else if (newJobType === 'MATRIX_OPS') {
        payload = { matrixSize: customMatrixSize };
      } else if (newJobType === 'HASH_CALC') {
        payload = { iterations: customIterations };
      } else if (newJobType === 'DATA_PROCESSING') {
        payload = { arraySize: customArraySize };
      } else if (newJobType === 'AI_INFERENCE') {
        payload = { iterations: customIterations, matrixSize: customMatrixSize };
      }
    } else {
      payload = {
        targetNumber: newJobComplexity * 10000,
        arraySize: newJobComplexity * 20000,
        matrixSize: newJobComplexity * 30,
        iterations: newJobComplexity * 5000,
      };
    }

    onSubmitNewJob(newJobName || `${newJobType.toLowerCase()}-task`, newJobType, newJobPriority, payload);
    setNewJobName('');
    setIsSubmitModalOpen(false);
  };

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto font-sans text-[#E2E8F0]">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#12141A] border border-[#22262E] p-3 rounded-sm">
        <div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-[#38BDF8]" />
            Distributed Job Queue Manager
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Submit computational tasks, monitor priority queue, inspect results, or cancel pending jobs.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#38BDF8] hover:bg-sky-300 text-black font-extrabold px-3 py-1.5 rounded-sm text-xs transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>SUBMIT NEW JOB</span>
        </button>
      </div>

      {/* Filter Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 font-mono text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search job ID, name, worker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#12141A] border border-[#22262E] text-[#E2E8F0] pl-8 pr-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#12141A] border border-[#22262E] text-[#E2E8F0] px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-[#38BDF8]"
        >
          <option value="ALL">All Statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="SCHEDULING">Scheduling</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#12141A] border border-[#22262E] text-[#E2E8F0] px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-[#38BDF8]"
        >
          <option value="ALL">All Job Types</option>
          <option value="PRIME_CALC">Prime Calculation</option>
          <option value="FIBONACCI">Fibonacci Sequence</option>
          <option value="SORTING">Sorting Benchmark</option>
          <option value="MATRIX_OPS">Matrix Operations</option>
          <option value="HASH_CALC">Cryptographic Hashing</option>
          <option value="DATA_PROCESSING">Data Stream Processing</option>
          <option value="AI_INFERENCE">Simulated AI Inference</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#12141A] border border-[#22262E] text-[#E2E8F0] px-2.5 py-1.5 rounded-sm text-xs focus:outline-none focus:border-[#38BDF8]"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical Priority</option>
          <option value="HIGH">High Priority</option>
          <option value="NORMAL">Normal Priority</option>
          <option value="LOW">Low Priority</option>
        </select>
      </div>

      {/* Main Jobs Table */}
      <div className="bg-[#12141A] border border-[#22262E] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-[#161922] text-[#94A3B8] border-b border-[#22262E] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-3 font-medium">Job ID</th>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">Priority</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Assigned Worker</th>
                <th className="py-2 px-3 font-medium">Submitted</th>
                <th className="py-2 px-3 font-medium">Duration</th>
                <th className="py-2 px-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22262E]">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#94A3B8] font-sans">
                    No jobs match the active filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#22262E]/30 transition-colors">
                    <td className="py-2 px-3 font-bold text-[#38BDF8]">{job.id}</td>
                    <td className="py-2 px-3 text-[#E2E8F0] font-sans font-medium">{job.name}</td>
                    <td className="py-2 px-3 text-[#94A3B8]">{job.type}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                          job.priority === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : job.priority === 'HIGH'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : job.priority === 'NORMAL'
                            ? 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30'
                            : 'bg-[#0A0B0E] text-[#94A3B8] border-[#22262E]'
                        }`}
                      >
                        {job.priority}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          job.status === 'COMPLETED'
                            ? 'bg-[#22C55E]/15 text-[#22C55E]'
                            : job.status === 'RUNNING'
                            ? 'bg-[#38BDF8]/15 text-[#38BDF8] animate-pulse'
                            : job.status === 'FAILED'
                            ? 'bg-rose-500/15 text-rose-400'
                            : job.status === 'CANCELLED'
                            ? 'bg-[#0A0B0E] text-[#94A3B8] border border-[#22262E]'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[#E2E8F0]">
                      {job.assignedWorkerName ? getWorkerDisplayName(job.assignedWorkerId, job.assignedWorkerName) : <span className="text-[#94A3B8]">-</span>}
                    </td>
                    <td className="py-2 px-3 text-[#94A3B8]">
                      {new Date(job.submittedTime).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-[#E2E8F0]">
                      {job.executionTimeMs !== undefined ? `${job.executionTimeMs}ms` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right space-x-1.5">
                      <button
                        onClick={() => onViewJob(job)}
                        className="p-1 rounded bg-[#0A0B0E] hover:bg-[#22262E] text-[#94A3B8] hover:text-white border border-[#22262E] transition-colors cursor-pointer"
                        title="View job details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {job.status === 'QUEUED' || job.status === 'SCHEDULING' ? (
                        <button
                          onClick={() => onCancelJob(job.id)}
                          className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-900 transition-colors cursor-pointer"
                          title="Cancel queued job"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Job Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-20 pb-12 overflow-y-auto">
          <form
            onSubmit={handleCreateJob}
            className="bg-[#12141A] border border-[#22262E] rounded-sm max-w-lg w-full p-5 space-y-4 shadow-2xl font-sans my-auto"
          >
            <div className="flex justify-between items-center border-b border-[#22262E] pb-2.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#38BDF8]" />
                Submit Computational Workload
              </h2>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-[#94A3B8] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {maintenanceMode && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>System Maintenance Active: New job submissions are currently suspended.</span>
                </div>
              )}

              <div>
                <label className="block text-[#94A3B8] mb-1 font-medium">Job Name / Description</label>
                <input
                  type="text"
                  placeholder="e.g., Matrix Multi-Core Benchmark"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] mb-1 font-medium">Job Type</label>
                  <select
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value as JobType)}
                    className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                  >
                    <option value="PRIME_CALC">Prime Calculation</option>
                    <option value="FIBONACCI">Fibonacci Calculation</option>
                    <option value="SORTING">Array Sorting</option>
                    <option value="MATRIX_OPS">Matrix Multiplication</option>
                    <option value="HASH_CALC">SHA-256 Hash Chain</option>
                    <option value="DATA_PROCESSING">Telemetry Processing</option>
                    <option value="AI_INFERENCE">AI Tensor Inference</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#94A3B8] mb-1 font-medium">Priority Level</label>
                  <select
                    value={newJobPriority}
                    onChange={(e) => setNewJobPriority(e.target.value as JobPriority)}
                    className="w-full bg-[#0A0B0E] border border-[#22262E] rounded-sm p-2 text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-[#22262E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#94A3B8] font-medium">Workload Parameter Mode</span>
                  <div className="flex gap-2 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setUseCustomParams(false)}
                      className={`px-2 py-0.5 rounded ${
                        !useCustomParams ? 'bg-[#38BDF8] text-black font-bold' : 'bg-[#0A0B0E] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      Preset Complexity
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCustomParams(true)}
                      className={`px-2 py-0.5 rounded ${
                        useCustomParams ? 'bg-[#38BDF8] text-black font-bold' : 'bg-[#0A0B0E] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      Custom Parameters
                    </button>
                  </div>
                </div>

                {!useCustomParams ? (
                  <div>
                    <label className="block text-[#94A3B8] mb-1 font-medium flex justify-between">
                      <span>Task Complexity Level</span>
                      <span className="font-mono text-[#38BDF8] font-bold">{newJobComplexity}x</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={newJobComplexity}
                      onChange={(e) => setNewJobComplexity(parseInt(e.target.value))}
                      className="w-full accent-[#38BDF8]"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-[#0A0B0E] border border-[#22262E] rounded space-y-2">
                    {newJobType === 'PRIME_CALC' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">Upper Bound / Search Limit (Target Prime)</label>
                        <input
                          type="number"
                          min="100"
                          max="1000000"
                          value={customTargetNumber}
                          onChange={(e) => setCustomTargetNumber(parseInt(e.target.value) || 10000)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'FIBONACCI' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">Nth Fibonacci Term (Range: 10 - 45)</label>
                        <input
                          type="number"
                          min="5"
                          max="45"
                          value={customTargetNumber > 50 ? 35 : customTargetNumber}
                          onChange={(e) => setCustomTargetNumber(parseInt(e.target.value) || 30)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'SORTING' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">Array Element Count (Size)</label>
                        <input
                          type="number"
                          min="1000"
                          max="1000000"
                          value={customArraySize}
                          onChange={(e) => setCustomArraySize(parseInt(e.target.value) || 50000)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'MATRIX_OPS' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">Square Matrix Dimension (N × N)</label>
                        <input
                          type="number"
                          min="10"
                          max="500"
                          value={customMatrixSize}
                          onChange={(e) => setCustomMatrixSize(parseInt(e.target.value) || 100)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'HASH_CALC' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">SHA-256 Iteration Count</label>
                        <input
                          type="number"
                          min="500"
                          max="500000"
                          value={customIterations}
                          onChange={(e) => setCustomIterations(parseInt(e.target.value) || 10000)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'DATA_PROCESSING' && (
                      <div>
                        <label className="block text-[#94A3B8] mb-1 font-medium">Telemetry Batch Record Count</label>
                        <input
                          type="number"
                          min="1000"
                          max="1000000"
                          value={customArraySize}
                          onChange={(e) => setCustomArraySize(parseInt(e.target.value) || 50000)}
                          className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    )}

                    {newJobType === 'AI_INFERENCE' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[#94A3B8] mb-1 font-medium">Neural Network Layers</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={customIterations > 50 ? 12 : customIterations}
                            onChange={(e) => setCustomIterations(parseInt(e.target.value) || 8)}
                            className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#94A3B8] mb-1 font-medium">Tensor Vector Dim</label>
                          <input
                            type="number"
                            min="16"
                            max="1024"
                            value={customMatrixSize}
                            onChange={(e) => setCustomMatrixSize(parseInt(e.target.value) || 128)}
                            className="w-full bg-[#12141A] border border-[#22262E] rounded p-1.5 font-mono text-[#E2E8F0] focus:outline-none focus:border-[#38BDF8]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#22262E]">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-3 py-1.5 rounded-sm bg-[#0A0B0E] border border-[#22262E] text-[#94A3B8] text-xs hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={maintenanceMode}
                className={`px-3 py-1.5 rounded-sm font-extrabold text-xs transition-all ${
                  maintenanceMode
                    ? 'bg-amber-950/80 text-amber-500/70 border border-amber-800/40 cursor-not-allowed'
                    : 'bg-[#38BDF8] hover:bg-sky-300 text-black cursor-pointer'
                }`}
              >
                {maintenanceMode ? 'Submissions Disabled' : 'Submit to Cluster'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
