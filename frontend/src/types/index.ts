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
