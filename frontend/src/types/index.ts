export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegistryAuth {
  serveraddress?: string;
  username?: string;
  password?: string;
  email?: string;
}

export interface ContainerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface Container {
  id: string;
  shortId: string;
  name: string;
  names: string[];
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | string;
  status: string;
  ports: ContainerPort[];
  labels: Record<string, string>;
  mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
  }>;
  networkMode: string;
  isSelf?: boolean;
  isHidden?: boolean;
  isProtected?: boolean;
  composeProject?: string;
  composeService?: string;
}

export interface ComposeStack {
  name: string;
  workingDir?: string;
  configFile?: string;
  containers: Container[];
  runningCount: number;
  totalCount: number;
  isSelf?: boolean;
}

export interface DockerImage {
  id: string;
  shortId: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  virtualSize: number;
  labels: Record<string, string>;
  containers: number;
  inUse?: boolean;
}

export interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt?: string;
  Status?: Record<string, any>;
  Labels?: Record<string, string>;
  Scope: string;
  Options?: Record<string, string>;
  UsageData?: {
    Size: number;
    RefCount: number;
  };
  isSelf?: boolean;
}

export interface DockerNetwork {
  Id: string;
  id?: string;
  Name: string;
  Driver: string;
  Scope: string;
  EnableIPv6: boolean;
  Internal: boolean;
  Attachable: boolean;
  isSelf?: boolean;
  IPAM?: {
    Driver: string;
    Config: Array<{
      Subnet?: string;
      Gateway?: string;
    }>;
  };
  Containers?: Record<string, {
    Name: string;
    EndpointID: string;
    MacAddress: string;
    IPv4Address: string;
    IPv6Address: string;
  }>;
  Labels?: Record<string, string>;
}

export interface ScanReport {
  id: string;
  targetType: 'image' | 'container';
  targetName: string;
  targetId?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  unknownCount: number;
  jsonReportPath?: string;
  htmlReportPath?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  durationMs?: number;
  createdBy?: string;
  createdAt: string;
  data?: any;
}

export interface AuditLog {
  id: string;
  userId?: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemInfo {
  Containers: number;
  ContainersRunning: number;
  ContainersPaused: number;
  ContainersStopped: number;
  Images: number;
  Driver: string;
  SystemTime: string;
  LoggingDriver: string;
  NCPU: number;
  MemTotal: number;
  OperatingSystem: string;
  OSType: string;
  Architecture: string;
  ServerVersion: string;
}

export interface CleanupSchedule {
  id: string;
  name: string;
  scheduleType: 'once' | 'recurring';
  frequencyPreset: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly' | 'custom' | 'once';
  cronExpression?: string;
  scheduledAt?: string;
  cleanImages: boolean;
  cleanImagesMode: 'all' | 'dangling';
  cleanVolumes: boolean;
  cleanNetworks: boolean;
  cleanContainers: boolean;
  cleanBuildCache: boolean;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running' | null;
  lastRunSummary?: string;
  nextRunAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCleanupScheduleInput {
  name: string;
  scheduleType: 'once' | 'recurring';
  frequencyPreset: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly' | 'custom' | 'once';
  cronExpression?: string;
  scheduledAt?: string;
  cleanImages: boolean;
  cleanImagesMode: 'all' | 'dangling';
  cleanVolumes: boolean;
  cleanNetworks: boolean;
  cleanContainers: boolean;
  cleanBuildCache: boolean;
  enabled?: boolean;
}

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export interface ScalingReplica {
  id: string;
  name: string;
  state: string;
  status: string;
  created: number;
}

export interface ScalingInfo {
  baseName: string;
  primaryId: string;
  currentReplicas: number;
  replicas: ScalingReplica[];
  hasHostPortConflict: boolean;
  ports: Array<{ hostPort?: string; containerPort: string }>;
  networks: string[];
  isComposeService: boolean;
  composeProject?: string;
  composeService?: string;
  eligible: boolean;
  strategy: 'direct' | 'internal_network';
  reason: string;
  resources?: {
    memoryLimitMB?: number;
    memoryReservationMB?: number;
    nanoCpus?: number;
    cpuShares?: number;
  };
  policy: ScalingPolicy | null;
}

export interface ScalingPolicy {
  id: string;
  name: string;
  targetType: 'container' | 'stack';
  targetId: string;
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  cpuThreshold: number;
  memoryThreshold: number;
  cooldownSeconds: number;
  lastScaleAt?: string | null;
  lastScaleAction?: string | null;
  lastScaleReason?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScalingPolicyInput {
  name: string;
  targetType?: 'container' | 'stack';
  targetId: string;
  enabled?: boolean;
  minReplicas: number;
  maxReplicas: number;
  cpuThreshold: number;
  memoryThreshold: number;
  cooldownSeconds: number;
}

export interface HostMetrics {
  cpu: {
    usagePercent: number;
    cores: number;
    model: string;
    speedMHz: number;
    loadAvg: [number, number, number];
    perCoreUsage: number[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  uptimeSeconds: number;
  platform: string;
  arch: string;
  hostname: string;
}



