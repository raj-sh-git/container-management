import Docker from 'dockerode';
import { config } from '../config';
import os from 'os';

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

  async getVersion() {
    return await this.docker.version();
  }

  async getDiskUsage() {
    return await this.docker.df();
  }

  async systemPrune(options: { all?: boolean; volumes?: boolean } = {}) {
    const results: any = {};
    results.containers = await this.docker.pruneContainers();
    results.images = await this.docker.pruneImages({ filters: options.all ? {} : { dangling: { true: true } } });
    results.networks = await this.docker.pruneNetworks();
    if (options.volumes) {
      results.volumes = await this.docker.pruneVolumes();
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
      throw new Error('Cannot stop the Container Control Center platform itself to avoid service disruption.');
    }
    const container = this.docker.getContainer(id);
    await container.stop({ t: timeout });
    return { success: true, message: `Container ${id} stopped.` };
  }

  async restartContainer(id: string, timeout: number = 10, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot restart the Container Control Center platform itself to avoid service disruption.');
    }
    const container = this.docker.getContainer(id);
    await container.restart({ t: timeout });
    return { success: true, message: `Container ${id} restarted.` };
  }

  async pauseContainer(id: string, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot pause the Container Control Center platform itself.');
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
      throw new Error('Cannot kill the Container Control Center platform itself.');
    }
    const container = this.docker.getContainer(id);
    await container.kill();
    return { success: true, message: `Container ${id} killed.` };
  }

  async removeContainer(id: string, force: boolean = false, removeVolumes: boolean = false, allowSelf: boolean = false) {
    const inspect = await this.docker.getContainer(id).inspect();
    if (!allowSelf && this.isSelfContainer({ Id: inspect.Id, Names: [inspect.Name] })) {
      throw new Error('Cannot remove the Container Control Center platform itself.');
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
      throw new Error(`Cannot stop the Compose stack '${stackName}' containing the Container Control Center platform itself to avoid service disruption.`);
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
      throw new Error(`Cannot restart the Compose stack '${stackName}' containing the Container Control Center platform itself to avoid service disruption.`);
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

  // ==================== IMAGES ====================
  async listImages(all: boolean = false) {
    const images = await this.docker.listImages({ all });
    return images.map((img) => ({
      id: img.Id,
      shortId: img.Id.replace(/^sha256:/, '').substring(0, 12),
      repoTags: img.RepoTags || ['<none>:<none>'],
      repoDigests: img.RepoDigests || [],
      created: img.Created,
      size: img.Size,
      virtualSize: img.VirtualSize,
      labels: img.Labels || {},
      containers: img.Containers,
    }));
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

  // ==================== VOLUMES ====================
  async listVolumes() {
    const res = await this.docker.listVolumes();
    return res.Volumes || [];
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
    return await this.docker.listNetworks();
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
