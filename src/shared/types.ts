export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  createdAt: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  timestamp: number;
  persistent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export interface SystemSnapshot {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  status: SystemStatus | null;
  workers: WorkerNodeData[];
  jobs: Job[];
  metricsSummary: {
    cpuUsage: number;
    ramUsage: number;
    totalWorkers: number;
    onlineWorkers: number;
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
}

export type JobType =
  | 'PRIME_CALC'
  | 'FIBONACCI'
  | 'SORTING'
  | 'MATRIX_OPS'
  | 'HASH_CALC'
  | 'DATA_PROCESSING'
  | 'AI_INFERENCE';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type JobStatus =
  | 'QUEUED'
  | 'SCHEDULING'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

export interface JobPayload {
  targetNumber?: number; // For primes / fibonacci
  arraySize?: number;    // For sorting / data processing
  matrixSize?: number;   // For matrix ops
  iterations?: number;   // For hash calc / AI inference
  complexity?: number;   // General difficulty factor
  customInput?: string;
}

export interface Job {
  id: string;
  name: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  submittedTime: number; // timestamp
  startTime?: number;
  completionTime?: number;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  executionTimeMs?: number;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  payload: JobPayload;
  userId?: string;
  submittedBy?: string;
}

export type WorkerStatus =
  | 'ONLINE'
  | 'IDLE'
  | 'BUSY'
  | 'OFFLINE'
  | 'FAILED'
  | 'MAINTENANCE';

export interface WorkerScoreBreakdown {
  cpuAvailabilityScore: number; // 0..100
  ramAvailabilityScore: number; // 0..100
  workloadScore: number;       // 0..100
  activeJobsScore: number;     // 0..100
  successRateScore: number;    // 0..100
  perfScore: number;           // 0..100
}

export interface WorkerNodeData {
  id: string;
  name: string;
  host: string;
  cpuCapacity: number;       // cores e.g. 4
  currentCpuUsage: number;   // percentage 0..100
  ramCapacity: number;       // MB e.g. 16384
  currentRamUsage: number;   // percentage 0..100
  currentWorkload: number;   // percentage 0..100
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgExecutionTimeMs: number;
  successRate: number;       // percentage 0..100
  status: WorkerStatus;
  lastHeartbeat: number;     // timestamp
  score?: number;
  scoreBreakdown?: WorkerScoreBreakdown;
}

export type SchedulerStrategyType =
  | 'RESOURCE_AWARE'
  | 'ROUND_ROBIN'
  | 'LEAST_LOADED'
  | 'PRIORITY'
  | 'PREDICTIVE_AI';

export interface SchedulerDecision {
  jobId: string;
  jobName: string;
  selectedWorkerId: string;
  selectedWorkerName: string;
  timestamp: number;
  strategyUsed: SchedulerStrategyType;
  workerScores: Record<string, number>;
  breakdown: Record<string, any>;
  reason: string;
}

export interface ExecutionRecord {
  recordId: string;
  jobId: string;
  jobName: string;
  workerId: string;
  workerName: string;
  timestamp: number;
  inputHash: string;
  resultHash: string;
  prevRecordHash: string;
  currentRecordHash: string;
  executionTimeMs: number;
  status: string;
}

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

export interface SystemLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface SystemStatus {
  totalWorkers: number;
  onlineWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  offlineWorkers: number;
  failedWorkers: number;
  totalJobs: number;
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  systemCpuUsage: number;
  systemRamUsage: number;
  avgExecutionTimeMs: number;
  activeStrategy: SchedulerStrategyType;
  simulationActive: boolean;
  maintenanceMode: boolean;
  uptimeSeconds: number;
}

export interface SimulationConfig {
  workerCount: number;
  cpuCapacity: number;
  ramCapacity: number;
  failureProbability: number; // 0..100
  jobArrivalRateMs: number;   // interval in ms
  jobComplexity: number;      // 1..10
}
