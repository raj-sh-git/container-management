# Container Manager

An enterprise-grade, modern web-based Container Management platform that communicates directly with the container engine via the engine socket (`/var/run/docker.sock` or TCP). It includes built-in **Trivy security vulnerability scanning** with the **`trivy-plugin-teamcity-report`** plugin, an interactive **Web Terminal (xterm.js)**, **real-time streaming logs**, **live CPU/RAM performance metrics**, **automated horizontal scaling and autoscaling**, and **Role-Based Access Control (RBAC)**.

---

## Key Features

### Complete Container Management & Lifecycle
- **Container Lifecycle**: Start, stop, restart, pause, unpause, kill, rename, and remove containers (with force / volume cleanup options).
- **Governance & Protection**:
  - **Protected Containers**: Lock critical containers to prevent operators and viewers from stopping or deleting them.
  - **Hidden Containers**: Conceal sensitive or infrastructure containers from operators and viewers.
  - **Self-Preservation**: The Container Manager platform itself, its network, and storage volumes are protected and hidden from non-admin users by default.
- **Visual Container Builder**: Create and deploy containers with port bindings (`host:container`), volume mounts (`host:container`), environment variables (`KEY=VALUE`), custom networks, restart policies, and memory/CPU limits.
- **Batch Operations**: Multi-select containers to batch Start, Stop, Restart, or Delete.
- **Inspect & Diffs**: View real-time filesystem changes and formatted JSON inspect tree.

### Horizontal Scaling & Metric-Driven Autoscaling
- **Manual Scaling**: Scale any eligible container up or down instantly with replica counts.
- **Network DNS Round-Robin**:
  - Replicas attached to custom bridge networks automatically receive the base container's network aliases.
  - Engine internal DNS (`127.0.0.11`) distributes network traffic evenly across all active container replicas using round-robin resolution.
  - Eliminates host port binding collisions by enabling upstream reverse proxies (e.g. Nginx, Traefik, Envoy) to route traffic seamlessly.
- **Autoscaling Policies**:
  - Configure Min and Max replica thresholds per container or service.
  - Monitor real-time CPU % and Memory % telemetry in the background.
  - Automatically scale out when load exceeds threshold (e.g. CPU > 80% or Memory > 85%) and scale down when traffic normalizes.
  - Built-in cooldown intervals to prevent flapping and thrashing.

### Interactive Web Terminal (Exec)
- High-performance embedded terminal powered by `@xterm/xterm` with **auto-fitting**, **dynamic TTY window resize**, shell selection (`/bin/sh`, `/bin/bash`, `/bin/ash`), and clipboard support.
- Communicates directly with container exec API over WebSockets.

### Real-Time Logs & Telemetry
- **Live Logs Streaming**: Stream `stdout` / `stderr` with auto-scroll, regex filter, timestamp toggle, tail line selector, and instant `.txt` download.
- **Live Performance Metrics**: Real-time CPU Usage %, Memory Usage vs Limit %, Network RX/TX, and Disk Block I/O streaming via WebSockets with Recharts area charts.

### Security Vulnerability Scanning & Reports
- **On-Demand & Automatic Scans**: Scan any local image or running container.
- **Vulnerability Report Integration**: Built-in support for [`cfculhane/trivy-plugin-teamcity-report`](https://github.com/cfculhane/trivy-plugin-teamcity-report) to generate formatted HTML reports.
- **Interactive CVE Breakdown**: Filter by severity (Critical, High, Medium, Low), search by CVE ID or package name, view installed vs fixed versions and remediation links.
- **Export & Download**: One-click download of `.html` and `.json` vulnerability reports.

### Images, Volumes & Networks
- **Image Registry**: List local images, pull images from public or private registries with live progress, inspect layer history, tag images, and delete.
- **Volumes**: List, create, inspect mountpoints, and remove persistent data volumes.
- **Networks**: Bridge, overlay, macvlan, and ipvlan networks; connect and disconnect containers on the fly.
- **Host & System**: Disk usage breakdown, system specifications, and scheduled or manual System Prune garbage collection.

### Security, User Management & RBAC
- **Role Hierarchy**:
  - `Admin`: Full engine access, user management, container protection/hiding flags, scheduled cleanups, system prune, audit logs.
  - `Operator`: Container & image lifecycle, interactive terminal exec, vulnerability scans.
  - `Viewer`: Read-only container inspection, live logs, metrics, and security reports.
- **Bulk User Management**:
  - Download standard CSV template.
  - Bulk import users via CSV or JSON with client-side validation preview table.
  - Backup and restore all users with a single click.
- **Audit Trail**: Immutable log of all operations (who performed what action on which container/image with timestamp and IP).

---

## Quick Start

Run the entire platform with a single command:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Default Admin Credentials**:
- **Username**: `admin`
- **Password**: `admin123` *(Forced password change prompt on first login)*

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+ / 22+
- Container engine running locally (OrbStack, Docker Desktop, or Linux engine with `/var/run/docker.sock`)

### 2. Install Dependencies
```bash
# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 3. Run in Development Mode
In two terminal tabs:

```bash
# Tab 1: Start Backend (Port 3001)
cd backend && npm run dev

# Tab 2: Start Frontend (Port 5173 with proxy to backend)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP & WebSocket server listening port |
| `BASE_PATH` / `SUB_PATH` | `""` (root) | Optional sub-path prefix (e.g. `/cce` or `/manager`) for reverse proxy serving |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Path to Unix engine socket |
| `DOCKER_HOST` | `undefined` | TCP host for engine daemon (if using TCP) |
| `JWT_SECRET` | `...` | Secret key for signing auth tokens |
| `DEFAULT_ADMIN_USER` | `admin` | Initial seeded administrator username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Initial seeded administrator password |
| `DATA_DIR` | `./data` | Directory for SQLite DB and scan reports |
| `TRIVY_PATH` | `trivy` | Path to Trivy binary |

---

## Nginx Reverse Proxy & Sub-Path Setup

Container Manager can be served behind any reverse proxy sub-path (e.g. `/manager/`) or root (`/`) either with **zero configuration** (automatic dynamic detection) or with explicit `BASE_PATH=/manager`.

### Example Nginx Configuration (`location /manager/`)

```nginx
server {
    listen 80;
    server_name example.com;

    location /manager/ {
        proxy_pass http://127.0.0.1:3000/manager/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /manager;

        # WebSocket support (Terminal, Logs, Real-time Metrics)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## Architecture

```
               ┌────────────────────────────────────────────────────────┐
               │              Modern Web UI (React 19 + Vite)           │
               │  - Dashboard & Metrics      - Container List & CRUD    │
               │  - Interactive Web Terminal - Live Logs & Stats Stream │
               │  - Autoscaling Controller   - User & RBAC Management   │
               │  - Trivy Security Center    - TeamCity HTML Report     │
               └───────────────▲────────────────────────▲───────────────┘
                               │ HTTP REST API          │ WebSockets (TTY/Logs/Stats)
               ┌───────────────▼────────────────────────▼───────────────┐
               │         Backend Service (Node.js / TypeScript)         │
               │  - Auth & RBAC Middleware   - Container Engine Adapter │
               │  - WebSocket Multiplexer    - Autoscaler Engine        │
               │  - Trivy Scanner Service    - SQLite (Drizzle ORM)     │
               └───────────────┬────────────────────────┬───────────────┘
                               │ Unix Socket / TCP      │ CLI Exec
               ┌───────────────▼──────────────┐ ┌───────▼───────────────┐
               │      Host Engine Daemon      │ │      Trivy CLI        │
               │    (/var/run/docker.sock)    │ │ (TeamCity Plugin)     │
               └──────────────────────────────┘ └───────────────────────┘
```
