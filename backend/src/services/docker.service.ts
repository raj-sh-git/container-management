import Docker from 'dockerode';
import { config } from '../config';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

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

let dockerClient: Docker;

export function getDocker(): Docker {
  if (!dockerClient) {
    if (config.dockerHost) {
      dockerClient = new Docker({
        host: config.dockerHost,
        port: config.dockerPort || 2375,
      });
    } else {
      // Default to unix socket
      dockerClient = new Docker({
        socketPath: config.dockerSocket,
      });
    }
  }
  return dockerClient;
}

export interface RegistryAuth {
  serveraddress?: string;
  username?: string;
  password?: string;
  email?: string;
}

export class DockerService {
  private docker = getDocker();

  // Helper to detect if a container is the manager platform itself
  isSelfContainer(c: { id?: string; shortId?: string; names?: string[]; Id?: string; Names?: string[] }): boolean {
    const selfHostname = (process.env.HOSTNAME || os.hostname() || '').toLowerCase();
    const id = (c.id || c.Id || '').toLowerCase();
    const shortId = (c.shortId || id.substring(0, 12)).toLowerCase();
    const names = (c.names || c.Names || []).map((n) => n.replace(/^\//, '').toLowerCase());

    if (selfHostname && (id.startsWith(selfHostname) || selfHostname.startsWith(shortId))) {
      return true;
    }

    const selfNames = ['docker-control-center', 'container-manager', 'container-management', 'container_manager'];
    if (names.some((n) => selfNames.some((sn) => n.includes(sn)))) {
      return true;
    }

    return false;
  }

  // ==================== SYSTEM ====================
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getInfo() {
    return await this.docker.info();
  }

  async getHostMetrics(): Promise<HostMetrics> {
    const cpusStart = os.cpus();
    const startTimes = cpusStart.map((c) => {
      let total = 0;
      for (const t in c.times) {
        total += (c.times as any)[t];
      }
      return { idle: c.times.idle, total };
    });

    // Sample CPU for 100ms
    await new Promise((resolve) => setTimeout(resolve, 100));

    const cpusEnd = os.cpus();
    const perCoreUsage: number[] = cpusEnd.map((c, idx) => {
      const start = startTimes[idx];
      let endTotal = 0;
      for (const t in c.times) {
        endTotal += (c.times as any)[t];
      }
      const idleDiff = c.times.idle - (start?.idle ?? 0);
      const totalDiff = endTotal - (start?.total ?? 0);
      const pct = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;
      return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
    });

    const avgCpu =
      perCoreUsage.length > 0
        ? Math.round((perCoreUsage.reduce((a, b) => a + b, 0) / perCoreUsage.length) * 10) / 10
        : 0;

    // Memory Calculation
    const totalMem = os.totalmem();
    let freeMem = os.freemem();

    if (process.platform === 'linux') {
      try {
        if (fs.existsSync('/proc/meminfo')) {
          const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
          const availableMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
          if (availableMatch && availableMatch[1]) {
            freeMem = parseInt(availableMatch[1], 10) * 1024;
          }
        }
      } catch {
        // Fallback to os.freemem()
      }
    } else if (process.platform === 'darwin') {
      try {
        const out = execSync('vm_stat', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
        const pageSizeMatch = out.match(/page size of (\d+) bytes/);
        const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;
        const free = parseInt((out.match(/Pages free:\s+(\d+)/) || [])[1] || '0', 10) * pageSize;
        const inactive = parseInt((out.match(/Pages inactive:\s+(\d+)/) || [])[1] || '0', 10) * pageSize;
        const speculative = parseInt((out.match(/Pages speculative:\s+(\d+)/) || [])[1] || '0', 10) * pageSize;
        const available = free + inactive + speculative;
        if (available > 0 && available < totalMem) {
          freeMem = available;
        }
      } catch {
        // Fallback to os.freemem()
      }
    }

    const usedMem = Math.max(0, totalMem - freeMem);
    const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;

    return {
      cpu: {
        usagePercent: avgCpu,
        cores: cpusEnd.length,
        model: cpusEnd[0]?.model || os.arch(),
        speedMHz: cpusEnd[0]?.speed || 0,
        loadAvg: [
          Math.round(os.loadavg()[0] * 100) / 100,
          Math.round(os.loadavg()[1] * 100) / 100,
          Math.round(os.loadavg()[2] * 100) / 100,
        ],
        perCoreUsage,
      },
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usagePercent: memPercent,
      },
      uptimeSeconds: Math.floor(os.uptime()),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    };
  }

  async getVersion() {
    return await this.docker.version();
  }

  async getDiskUsage() {
    return await this.docker.df();
  }

  async systemPrune(options: { all?: boolean; volumes?: boolean } = {}) {
    const results: any = {};
    results.containers = await this.docker.pruneContainers();
    // In Docker API: dangling: false prunes ALL unused images (not just dangling ones)
    results.images = await this.docker.pruneImages({
      filters: options.all ? { dangling: { false: true } } : { dangling: { true: true } },
    });
    results.networks = await this.docker.pruneNetworks();
    if (options.volumes) {
      results.volumes = await this.docker.pruneVolumes();
    }
    results.totalSpaceReclaimed =
      (results.containers?.SpaceReclaimed || 0) +
      (results.images?.SpaceReclaimed || 0) +
      (results.volumes?.SpaceReclaimed || 0);
    return results;
  }

  async executePrune(options: {
    cleanImages?: boolean;
    cleanImagesMode?: 'all' | 'dangling';
    cleanVolumes?: boolean;
    cleanNetworks?: boolean;
    cleanContainers?: boolean;
    cleanBuildCache?: boolean;
  }) {
    const results: {
      spaceReclaimed: number;
      containersDeleted: string[];
      imagesDeleted: Array<{ Untagged?: string; Deleted?: string }>;
      volumesDeleted: string[];
      networksDeleted: string[];
      buildCacheReclaimed: number;
      details: string[];
    } = {
      spaceReclaimed: 0,
      containersDeleted: [],
      imagesDeleted: [],
      volumesDeleted: [],
      networksDeleted: [],
      buildCacheReclaimed: 0,
      details: [],
    };

    // 1. Containers
    if (options.cleanContainers) {
      try {
        const cRes = await this.docker.pruneContainers();
        if (cRes) {
          results.containersDeleted = cRes.ContainersDeleted || [];
          results.spaceReclaimed += cRes.SpaceReclaimed || 0;
          if (results.containersDeleted.length > 0) {
            results.details.push(`Deleted ${results.containersDeleted.length} stopped containers`);
          }
        }
      } catch (err: any) {
        console.error('Error pruning containers:', err.message);
      }
    }

    // 2. Images
    if (options.cleanImages) {
      try {
        // Docker API: dangling: false prunes ALL unused images. Empty filters {} defaults to dangling: true!
        const filterOpt = options.cleanImagesMode === 'dangling'
          ? { dangling: { true: true } }
          : { dangling: { false: true } };
        const imgRes = await this.docker.pruneImages({ filters: filterOpt });
        if (imgRes) {
          results.imagesDeleted = imgRes.ImagesDeleted || [];
          results.spaceReclaimed += imgRes.SpaceReclaimed || 0;
          if (results.imagesDeleted.length > 0) {
            results.details.push(`Deleted ${results.imagesDeleted.length} images (${options.cleanImagesMode || 'all'})`);
          }
        }
      } catch (err: any) {
        console.error('Error pruning images:', err.message);
      }
    }

    // 3. Volumes
    if (options.cleanVolumes) {
      try {
        const vRes = await this.docker.pruneVolumes();
        if (vRes) {
          results.volumesDeleted = vRes.VolumesDeleted || [];
          results.spaceReclaimed += vRes.SpaceReclaimed || 0;
          if (results.volumesDeleted.length > 0) {
            results.details.push(`Deleted ${results.volumesDeleted.length} unused volumes`);
          }
        }
      } catch (err: any) {
        console.error('Error pruning volumes:', err.message);
      }
    }

    // 4. Networks
    if (options.cleanNetworks) {
      try {
        const nRes = await this.docker.pruneNetworks();
        if (nRes) {
          results.networksDeleted = nRes.NetworksDeleted || [];
          if (results.networksDeleted.length > 0) {
            results.details.push(`Deleted ${results.networksDeleted.length} unused networks`);
          }
        }
      } catch (err: any) {
        console.error('Error pruning networks:', err.message);
      }
    }

    // 5. Build Cache
    if (options.cleanBuildCache) {
      try {
        const bRes: any = await (this.docker as any).pruneBuilder?.();
        if (bRes && bRes.SpaceReclaimed) {
          results.buildCacheReclaimed = bRes.SpaceReclaimed;
          results.spaceReclaimed += bRes.SpaceReclaimed;
          results.details.push(`Reclaimed build cache`);
        }
      } catch (err: any) {
        // safe to ignore if pruneBuilder is not supported
      }
    }

    if (results.details.length === 0) {
      results.details.push('No unused resources needed cleanup.');
    }

    return results;
  }


  // ==================== CONTAINERS ====================
  async listContainers(all: boolean = true) {
    const containers = await this.docker.listContainers({ all });
    return containers.map((c) => {
      const isSelf = this.isSelfContainer({ Id: c.Id, Names: c.Names });
      return {
        id: c.Id,
        shortId: c.Id.substring(0, 12),
        names: c.Names.map((n) => n.replace(/^\//, '')),
        name: c.Names[0]?.replace(/^\//, '') || c.Id.substring(0, 12),
        image: c.Image,
        imageId: c.ImageID,
        command: c.Command,
        created: c.Created,
        state: c.State, // 'running', 'exited', 'paused', 'restarting', 'dead'
        status: c.Status,
        ports: c.Ports,
        labels: c.Labels || {},
        mounts: c.Mounts,
        networkMode: c.HostConfig?.NetworkMode || 'default',
        isSelf,
        composeProject: c.Labels?.['com.docker.compose.project'] || c.Labels?.['com.docker.stack.namespace'],
        composeService: c.Labels?.['com.docker.compose.service'],
      };
    });
  }

  async getContainer(id: string) {
    const container = this.docker.getContainer(id);
    const data = await container.inspect();
    const isSelf = this.isSelfContainer({ Id: data.Id, Names: [data.Name] });
    return {
      ...data,
      isSelf,
    };
  }

  async createContainer(options: {
    name?: string;
    image: string;
    command?: string[];
    entrypoint?: string[];
    env?: string[];
    ports?: Array<{ hostPort: string; containerPort: string; protocol?: 'tcp' | 'udp' }>;
    volumes?: Array<{ hostPath: string; containerPath: string; mode?: 'ro' | 'rw' }>;
    network?: string;
    restartPolicy?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
    memoryLimit?: number; // in bytes
    cpuShares?: number;
    privileged?: boolean;
    autoRemove?: boolean;
    labels?: Record<string, string>;
    pullBeforeCreate?: boolean;
    auth?: RegistryAuth;
  }) {
    // Optionally pull image first (supports private registry auth)
    if (options.pullBeforeCreate) {
      try {
        await this.pullImage(options.image, options.auth);
      } catch (err: any) {
        console.warn(`[Docker] Pre-pull warning: ${err.message}`);
      }
    }

    const exposedPorts: Record<string, {}> = {};
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};

    if (options.ports) {
      for (const p of options.ports) {
        const proto = p.protocol || 'tcp';
        const key = `${p.containerPort}/${proto}`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: p.hostPort }];
      }
    }

    const binds = options.volumes
      ? options.volumes.map((v) => `${v.hostPath}:${v.containerPath}${v.mode ? `:${v.mode}` : ''}`)
      : [];

    const createOptions: Docker.ContainerCreateOptions = {
      name: options.name || undefined,
      Image: options.image,
      Cmd: options.command,
      Entrypoint: options.entrypoint,
      Env: options.env,
      ExposedPorts: exposedPorts,
      Labels: options.labels,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: options.network || 'bridge',
        RestartPolicy: options.restartPolicy ? { Name: options.restartPolicy } : undefined,
        Memory: options.memoryLimit,
        CpuShares: options.cpuShares,
        Privileged: options.privileged || false,
        AutoRemove: options.autoRemove || false,
      },
    };

    const container = await this.docker.createContainer(createOptions);
    return await container.inspect();
  }

  async startContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.start();
    return { success: true, message: `Container ${id} started.` };
  }

  async stopContainer(id: string, timeout: number = 10, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot stop the Container Manager platform itself to avoid service disruption.');
    }
    const container = this.docker.getContainer(id);
    await container.stop({ t: timeout });
    return { success: true, message: `Container ${id} stopped.` };
  }

  async restartContainer(id: string, timeout: number = 10, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot restart the Container Manager platform itself to avoid service disruption.');
    }
    const container = this.docker.getContainer(id);
    await container.restart({ t: timeout });
    return { success: true, message: `Container ${id} restarted.` };
  }

  async pauseContainer(id: string, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot pause the Container Manager platform itself.');
    }
    const container = this.docker.getContainer(id);
    await container.pause();
    return { success: true, message: `Container ${id} paused.` };
  }

  async unpauseContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.unpause();
    return { success: true, message: `Container ${id} unpaused.` };
  }

  async killContainer(id: string, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot kill the Container Manager platform itself.');
    }
    const container = this.docker.getContainer(id);
    await container.kill();
    return { success: true, message: `Container ${id} killed.` };
  }

  async removeContainer(id: string, force: boolean = false, removeVolumes: boolean = false, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot remove the Container Manager platform itself.');
    }
    const container = this.docker.getContainer(id);
    await container.remove({ force, v: removeVolumes });
    return { success: true, message: `Container ${id} removed.` };
  }

  async renameContainer(id: string, newName: string) {
    const container = this.docker.getContainer(id);
    await container.rename({ name: newName });
    return { success: true, message: `Container ${id} renamed to ${newName}.` };
  }

  async getContainerChanges(id: string) {
    const container = this.docker.getContainer(id);
    return await container.changes();
  }

  async getContainerLogs(id: string, tail: number = 100, timestamps: boolean = true) {
    const container = this.docker.getContainer(id);
    const logsBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps,
    });
    return logsBuffer.toString('utf-8');
  }

  // ==================== COMPOSE STACKS ====================
  async listStacks() {
    const containers = await this.listContainers(true);
    const stacksMap = new Map<string, {
      name: string;
      workingDir?: string;
      configFile?: string;
      containers: typeof containers;
      runningCount: number;
      totalCount: number;
      isSelf: boolean;
    }>();

    for (const c of containers) {
      const projectName = c.composeProject;
      if (projectName) {
        if (!stacksMap.has(projectName)) {
          stacksMap.set(projectName, {
            name: projectName,
            workingDir: c.labels?.['com.docker.compose.project.working_dir'],
            configFile: c.labels?.['com.docker.compose.project.config_files'],
            containers: [],
            runningCount: 0,
            totalCount: 0,
            isSelf: false,
          });
        }
        const stack = stacksMap.get(projectName)!;
        stack.containers.push(c);
        stack.totalCount++;
        if (c.state === 'running') stack.runningCount++;
        if (c.isSelf) stack.isSelf = true;
      }
    }

    return Array.from(stacksMap.values());
  }

  async startStack(stackName: string) {
    const containers = await this.listContainers(true);
    const stackContainers = containers.filter((c) => c.composeProject === stackName);
    const results = [];
    for (const c of stackContainers) {
      if (c.state !== 'running') {
        try {
          await this.startContainer(c.id);
          results.push({ id: c.id, name: c.name, status: 'started' });
        } catch (err: any) {
          results.push({ id: c.id, name: c.name, status: 'error', error: err.message });
        }
      }
    }
    return results;
  }

  async stopStack(stackName: string) {
    const containers = await this.listContainers(true);
    const hasSelf = containers.some((c) => c.composeProject === stackName && c.isSelf);
    if (hasSelf) {
      throw new Error(`Cannot stop the Compose stack '${stackName}' containing the Container Manager platform itself to avoid service disruption.`);
    }

    const stackContainers = containers.filter((c) => c.composeProject === stackName && !c.isSelf);
    const results = [];
    for (const c of stackContainers) {
      if (c.state === 'running') {
        try {
          await this.stopContainer(c.id, 10);
          results.push({ id: c.id, name: c.name, status: 'stopped' });
        } catch (err: any) {
          results.push({ id: c.id, name: c.name, status: 'error', error: err.message });
        }
      }
    }
    return results;
  }

  async restartStack(stackName: string) {
    const containers = await this.listContainers(true);
    const hasSelf = containers.some((c) => c.composeProject === stackName && c.isSelf);
    if (hasSelf) {
      throw new Error(`Cannot restart the Compose stack '${stackName}' containing the Container Manager platform itself to avoid service disruption.`);
    }

    const stackContainers = containers.filter((c) => c.composeProject === stackName && !c.isSelf);
    const results = [];
    for (const c of stackContainers) {
      try {
        await this.restartContainer(c.id, 10);
        results.push({ id: c.id, name: c.name, status: 'restarted' });
      } catch (err: any) {
        results.push({ id: c.id, name: c.name, status: 'error', error: err.message });
      }
    }
    return results;
  }

  // ==================== SCALING & REPLICAS ====================
  async getScalingEligibility(idOrName: string) {
    const inspect = await this.docker.getContainer(idOrName).inspect();
    const rawName = inspect.Name.replace(/^\//, '');
    const baseName = rawName.replace(/-replica-\d+$/, '');

    // List all containers to find active replicas
    const allContainers = await this.listContainers(true);
    const replicas = allContainers.filter((c) => {
      const cName = c.name.replace(/^\//, '');
      const isNamedReplica = cName === baseName || new RegExp(`^${baseName}-replica-\\d+$`).test(cName);
      const isLabeledReplica = c.labels?.['com.docker-control.replica-of'] === baseName;
      return isNamedReplica || isLabeledReplica;
    });

    const portBindings = inspect.HostConfig?.PortBindings || {};
    const ports: Array<{ hostPort?: string; containerPort: string }> = [];
    let hasHostPortConflict = false;

    for (const [containerPort, bindings] of Object.entries(portBindings)) {
      if (Array.isArray(bindings) && bindings.length > 0) {
        for (const b of bindings) {
          if (b.HostPort) {
            hasHostPortConflict = true;
            ports.push({ hostPort: b.HostPort, containerPort });
          } else {
            ports.push({ containerPort });
          }
        }
      } else {
        ports.push({ containerPort });
      }
    }

    const networks = Object.keys(inspect.NetworkSettings?.Networks || {});
    const isComposeService = Boolean(inspect.Config?.Labels?.['com.docker.compose.service']);
    const composeProject = inspect.Config?.Labels?.['com.docker.compose.project'];
    const composeService = inspect.Config?.Labels?.['com.docker.compose.service'];

    let reason = 'Eligible for horizontal scaling.';
    let strategy: 'direct' | 'internal_network' = 'direct';

    if (hasHostPortConflict) {
      strategy = 'internal_network';
      reason = `Container binds host port(s) [${ports.map((p) => p.hostPort).filter(Boolean).join(', ')}]. Additional replicas will run on the internal Docker network (${networks.join(', ') || 'bridge'}) without host port bindings to prevent port collision, ideal for reverse proxy routing.`;
    }

    return {
      baseName,
      primaryId: inspect.Id,
      currentReplicas: Math.max(1, replicas.length),
      replicas: replicas.map((r) => ({
        id: r.id,
        name: r.name,
        state: r.state,
        status: r.status,
        created: r.created,
      })),
      hasHostPortConflict,
      ports,
      networks,
      isComposeService,
      composeProject,
      composeService,
      eligible: true,
      strategy,
      reason,
      resources: {
        memoryLimitMB: inspect.HostConfig?.Memory ? Math.round(inspect.HostConfig.Memory / (1024 * 1024)) : undefined,
        memoryReservationMB: inspect.HostConfig?.MemoryReservation ? Math.round(inspect.HostConfig.MemoryReservation / (1024 * 1024)) : undefined,
        nanoCpus: inspect.HostConfig?.NanoCpus,
        cpuShares: inspect.HostConfig?.CpuShares,
      },
    };
  }

  async scaleContainer(idOrName: string, targetReplicas: number) {
    if (targetReplicas < 1 || targetReplicas > 20) {
      throw new Error('Target replicas must be between 1 and 20.');
    }

    const inspect = await this.docker.getContainer(idOrName).inspect();
    const rawName = inspect.Name.replace(/^\//, '');
    const baseName = rawName.replace(/-replica-\d+$/, '');

    // Never scale the container manager itself
    if (this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot scale the Container Manager platform itself.');
    }

    // Find all existing replicas for this baseName
    const allContainers = await this.listContainers(true);
    const existingReplicas = allContainers.filter((c) => {
      const cName = c.name.replace(/^\//, '');
      return (
        cName !== baseName &&
        (new RegExp(`^${baseName}-replica-\\d+$`).test(cName) ||
          c.labels?.['com.docker-control.replica-of'] === baseName)
      );
    });

    const currentTotal = 1 + existingReplicas.length; // 1 primary + replicas

    if (targetReplicas > currentTotal) {
      // Scale UP
      const toAdd = targetReplicas - currentTotal;
      const createdNames: string[] = [];

      // Find highest index currently used
      let maxIndex = 0;
      for (const r of existingReplicas) {
        const match = r.name.match(new RegExp(`^/?${baseName}-replica-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndex) maxIndex = num;
        }
      }

      for (let i = 1; i <= toAdd; i++) {
        const newIndex = maxIndex + i;
        const replicaName = `${baseName}-replica-${newIndex}`;

        const networks = inspect.NetworkSettings?.Networks || {};
        const networkNames = Object.keys(networks);
        const composeService = inspect.Config?.Labels?.['com.docker.compose.service'];
        const networkAliases = Array.from(new Set([baseName, composeService].filter(Boolean) as string[]));

        const endpointsConfig: Record<string, any> = {};
        for (const netName of networkNames) {
          if (netName !== 'bridge' && netName !== 'host' && netName !== 'none') {
            endpointsConfig[netName] = {
              Aliases: networkAliases,
            };
          }
        }

        const cloneConfig: any = {
          name: replicaName,
          Image: inspect.Config.Image,
          Env: inspect.Config.Env,
          Cmd: inspect.Config.Cmd,
          Entrypoint: inspect.Config.Entrypoint,
          WorkingDir: inspect.Config.WorkingDir,
          Labels: {
            ...(inspect.Config.Labels || {}),
            'com.docker-control.replica-of': baseName,
            'com.docker-control.replica-index': String(newIndex),
          },
          HostConfig: {
            Memory: inspect.HostConfig.Memory,
            MemoryReservation: inspect.HostConfig.MemoryReservation,
            CpuShares: inspect.HostConfig.CpuShares,
            NanoCpus: inspect.HostConfig.NanoCpus,
            Binds: inspect.HostConfig.Binds,
            RestartPolicy: inspect.HostConfig.RestartPolicy,
            // Strip host port bindings to prevent host port collision!
            PortBindings: {},
            NetworkMode: inspect.HostConfig.NetworkMode,
          },
          ...(Object.keys(endpointsConfig).length > 0
            ? { NetworkingConfig: { EndpointsConfig: endpointsConfig } }
            : {}),
        };

        const newContainer = await this.docker.createContainer(cloneConfig);

        // Connect to any additional networks not included in creation config
        for (const netName of networkNames) {
          if (netName !== 'bridge' && netName !== 'host' && netName !== 'none' && !endpointsConfig[netName]) {
            try {
              const net = this.docker.getNetwork(netName);
              await net.connect({
                Container: newContainer.id,
                EndpointConfig: {
                  Aliases: networkAliases,
                },
              });
            } catch {}
          }
        }

        await newContainer.start();
        createdNames.push(replicaName);
      }

      return {
        success: true,
        baseName,
        action: 'scaled_up',
        previousReplicas: currentTotal,
        currentReplicas: targetReplicas,
        created: createdNames,
      };
    } else if (targetReplicas < currentTotal) {
      // Scale DOWN
      const toRemoveCount = currentTotal - targetReplicas;

      // Sort existing replicas by index descending so we remove newest first
      existingReplicas.sort((a, b) => {
        const aMatch = a.name.match(/-replica-(\d+)$/);
        const bMatch = b.name.match(/-replica-(\d+)$/);
        const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
        const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
        return bNum - aNum;
      });

      const removedNames: string[] = [];
      const toRemove = existingReplicas.slice(0, toRemoveCount);

      for (const r of toRemove) {
        try {
          const container = this.docker.getContainer(r.id);
          await container.stop({ t: 10 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
          removedNames.push(r.name);
        } catch (err: any) {
          console.error(`Failed to stop/remove replica ${r.name}:`, err.message);
        }
      }

      return {
        success: true,
        baseName,
        action: 'scaled_down',
        previousReplicas: currentTotal,
        currentReplicas: targetReplicas,
        removed: removedNames,
      };
    }

    return {
      success: true,
      baseName,
      action: 'no_change',
      currentReplicas: currentTotal,
    };
  }

  async getContainerMetricsQuick(containerId: string): Promise<{ cpuPercent: number; memPercent: number }> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      if (!stats || !stats.cpu_stats) {
        return { cpuPercent: 0, memPercent: 0 };
      }

      // Calculate CPU percent
      let cpuPercent = 0.0;
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
      const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
      const onlineCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage?.percpu_usage?.length || 1;

      if (systemDelta > 0.0 && cpuDelta > 0.0) {
        cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
      }

      // Calculate Memory percent
      let memPercent = 0.0;
      if (stats.memory_stats && stats.memory_stats.limit > 0) {
        const usage = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
        memPercent = (usage / stats.memory_stats.limit) * 100.0;
      }

      return {
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        memPercent: Math.round(memPercent * 10) / 10,
      };
    } catch {
      return { cpuPercent: 0, memPercent: 0 };
    }
  }

  // ==================== IMAGES ====================
  async listImages(all: boolean = false) {
    const [images, containers] = await Promise.all([
      this.docker.listImages({ all }),
      this.docker.listContainers({ all: true }).catch(() => []),
    ]);

    const usedImageIds = new Set<string>();
    const usedImageNames = new Set<string>();
    for (const c of containers) {
      if (c.ImageID) {
        usedImageIds.add(c.ImageID);
        usedImageIds.add(c.ImageID.replace(/^sha256:/, ''));
      }
      if (c.Image) {
        usedImageNames.add(c.Image);
      }
    }

    return images.map((img) => {
      const cleanId = img.Id.replace(/^sha256:/, '');
      const isInUseById = usedImageIds.has(img.Id) || usedImageIds.has(cleanId);
      const isInUseByName = (img.RepoTags || []).some((tag) => usedImageNames.has(tag));
      const inUse = isInUseById || isInUseByName || (typeof img.Containers === 'number' && img.Containers > 0);

      return {
        id: img.Id,
        shortId: cleanId.substring(0, 12),
        repoTags: img.RepoTags || ['<none>:<none>'],
        repoDigests: img.RepoDigests || [],
        created: img.Created,
        size: img.Size,
        virtualSize: img.VirtualSize,
        labels: img.Labels || {},
        containers: img.Containers,
        inUse,
      };
    });
  }


  async inspectImage(id: string) {
    const image = this.docker.getImage(id);
    return await image.inspect();
  }

  async getImageHistory(id: string) {
    const image = this.docker.getImage(id);
    return await image.history();
  }

  async pullImage(
    imageName: string,
    authConfig?: RegistryAuth,
    onProgress?: (event: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const pullOptions: any = {};
      if (authConfig && authConfig.username && authConfig.password) {
        pullOptions.authconfig = {
          username: authConfig.username,
          password: authConfig.password,
          serveraddress: authConfig.serveraddress || 'https://index.docker.io/v1/',
          email: authConfig.email,
        };
      }

      this.docker.pull(imageName, pullOptions, (err: any, stream?: any) => {
        if (err) return reject(err);
        if (!stream) return resolve();
        this.docker.modem.followProgress(
          stream,
          (err: any, output: any[]) => {
            if (err) return reject(err);
            resolve();
          },
          (event: any) => {
            if (onProgress) onProgress(event);
          }
        );
      });
    });
  }

  async removeImage(id: string, force: boolean = false) {
    const image = this.docker.getImage(id);
    return await image.remove({ force });
  }

  async tagImage(id: string, repo: string, tag: string = 'latest') {
    const image = this.docker.getImage(id);
    await image.tag({ repo, tag });
    return { success: true, message: `Tagged image as ${repo}:${tag}` };
  }

  async getSelfResourceInfo(): Promise<{ networks: Set<string>; volumes: Set<string>; containerIds: Set<string> }> {
    const networks = new Set<string>();
    const volumes = new Set<string>();
    const containerIds = new Set<string>();

    try {
      const allContainers = await this.docker.listContainers({ all: true });
      for (const c of allContainers) {
        if (this.isSelfContainer(c)) {
          containerIds.add(c.Id);
          containerIds.add(c.Id.substring(0, 12));
          if (c.NetworkSettings?.Networks) {
            for (const netName of Object.keys(c.NetworkSettings.Networks)) {
              if (netName !== 'bridge' && netName !== 'host' && netName !== 'none') {
                networks.add(netName);
              }
            }
          }
          if (c.Mounts) {
            for (const m of c.Mounts) {
              if (m.Type === 'volume' && m.Name) {
                volumes.add(m.Name);
              }
            }
          }
        }
      }
    } catch {}

    networks.add('container-management_default');
    networks.add('container-manager_default');
    volumes.add('container-management_data');
    volumes.add('container-manager_data');

    return { networks, volumes, containerIds };
  }

  // ==================== VOLUMES ====================
  async listVolumes() {
    const [res, selfInfo] = await Promise.all([
      this.docker.listVolumes(),
      this.getSelfResourceInfo().catch(() => ({
        networks: new Set<string>(),
        volumes: new Set<string>(),
        containerIds: new Set<string>(),
      })),
    ]);
    const volumes = res.Volumes || [];
    return volumes.map((v) => {
      const isSelf =
        selfInfo.volumes.has(v.Name) ||
        v.Name.toLowerCase().includes('container-management') ||
        v.Name.toLowerCase().includes('container-manager');
      return {
        ...v,
        isSelf,
      };
    });
  }

  async inspectVolume(name: string) {
    const volume = this.docker.getVolume(name);
    return await volume.inspect();
  }

  async createVolume(options: { name?: string; driver?: string; labels?: Record<string, string> }) {
    return await this.docker.createVolume({
      Name: options.name,
      Driver: options.driver || 'local',
      Labels: options.labels,
    });
  }

  async removeVolume(name: string, force: boolean = false) {
    const volume = this.docker.getVolume(name);
    return await volume.remove({ force });
  }

  // ==================== NETWORKS ====================
  async listNetworks() {
    const [nets, selfInfo] = await Promise.all([
      this.docker.listNetworks(),
      this.getSelfResourceInfo().catch(() => ({
        networks: new Set<string>(),
        volumes: new Set<string>(),
        containerIds: new Set<string>(),
      })),
    ]);
    return nets.map((n) => {
      const isSelf =
        selfInfo.networks.has(n.Name) ||
        n.Name.toLowerCase().includes('container-management') ||
        n.Name.toLowerCase().includes('container-manager');
      return {
        ...n,
        isSelf,
      };
    });
  }

  async inspectNetwork(id: string) {
    const network = this.docker.getNetwork(id);
    return await network.inspect();
  }

  async createNetwork(options: {
    name: string;
    driver?: string;
    checkDuplicate?: boolean;
    internal?: boolean;
    attachable?: boolean;
    labels?: Record<string, string>;
  }) {
    return await this.docker.createNetwork({
      Name: options.name,
      Driver: options.driver || 'bridge',
      CheckDuplicate: options.checkDuplicate ?? true,
      Internal: options.internal ?? false,
      Attachable: options.attachable ?? true,
      Labels: options.labels,
    });
  }

  async removeNetwork(id: string) {
    const network = this.docker.getNetwork(id);
    return await network.remove();
  }

  async connectNetwork(networkId: string, containerId: string) {
    const network = this.docker.getNetwork(networkId);
    return await network.connect({ Container: containerId });
  }

  async disconnectNetwork(networkId: string, containerId: string, force: boolean = false) {
    const network = this.docker.getNetwork(networkId);
    return await network.disconnect({ Container: containerId, Force: force });
  }
}

export const dockerService = new DockerService();
