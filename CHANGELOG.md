# Changelog
All notable changes to Container Management Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-08

### Added
- **SSH Terminal**: Interactive web-based SSH terminal supporting multiple simultaneous remote host sessions with tabbed navigation, PTY resizing, and bulk session disconnect (`Close All Sessions`).
- **SSH Quick-Connect Profiles**: Local management of saved remote host connection configurations with one-click connect, auto-fill, and bulk clear profile action.
- **Trivy Concurrent Scanning**: Concurrent vulnerability scanning across multiple images without UI table flicker.
- **Trivy Batch Reports Management**: Multi-select checkbox support for security reports, allowing batch deletion and single-click consolidated ZIP archive export (`adm-zip`).
- **Unified Animated Refresh Controls**: Standardized spinning refresh action across all platform views (Containers, Images, Networks, Stacks, Volumes, Host Info).

### Performance & Security
- **Security Hardening**: Resolved 17 vulnerabilities by updating critical and high-severity dependencies (`proxy-addr`, `shell-quote`, `@grpc/grpc-js`, `drizzle-orm`, `uuid`) and upgrading the bundled Trivy engine to `v0.75.0` in `Dockerfile`.
- **Host Info Caching**: Introduced backend disk usage caching (30s TTL) with manual force-refresh and retained frontend state to eliminate page-transition lag and flickering.

### Fixed
- **Catalog Alignment**: Corrected table header alignments in Images catalog with the rows below.
- **Deterministic Sorting**: Stabilized entity list sorting across manual and periodic refreshes across all tabs (e.g. Networks list).
- **Network Tab Typography**: Standardized font sizing across Networks management tab for visual consistency.

---

## [0.3.0] - 2026-09-27

### Added
- **Horizontal Container Scaling & Autoscaling**: Manual replica scaling (1-20 replicas) and metrics-driven autoscaler policies based on CPU and memory thresholds with cooldown protection.
- **Internal DNS Load Balancing**: Scaled replicas automatically receive network aliases enabling native round-robin load distribution across internal networks.
- **Container Protection & Hiding**: Role-based safeguards allowing administrators to hide containers or protect them against termination from operators and viewers.
- **Platform Self-Protection**: Default automatic shielding of Container Manager, its network, and storage volumes from non-admin roles.
- **User Management Bulk Import**: CSV and spreadsheet user onboarding with downloadable template and validation preview.
- **User Disaster Recovery Backup**: Administrator export and backup utility for user accounts and permission structures.
- **UI Layout & Navigation**: Persistent page state on refresh and independent sidebar scrolling.
- **Modal Window Controls**: Minimize dock and maximize fullscreen modes on dialogs and detail drawers.
- **Audit Maintenance**: Administrative audit log purge functionality.

---

## [0.2.0] - 2026-09-12

### Added
- **Automated Clean-Up Scheduler**: Schedule one-time or recurring pruning for unused/dangling images, volumes, networks, stopped containers, and build cache.
- **Unused Images Identification**: Visual badge tagging unused container images across the catalog.
- **Login Page Theme Switcher**: Dark and Light mode toggle accessible directly on the sign-in screen.
- **Storage Reclaim Analytics**: Real-time calculation and audit logging of reclaimed disk space.
- **Multi-Arch Support**: Production container builds supporting both `linux/amd64` and `linux/arm64` architectures.

### Security
- **Credential Security**: Removed default credentials prefill on the login screen.

---

## [0.1.0] - 2026-09-10

### Added
- **Nginx Reverse Proxy Support**: Dynamic base path routing for serving behind subpaths (e.g. `/cce`).
- **Stack & Container Safety**: Protection against stopping or restarting the management container from inside itself.
- **RBAC Safeguards**: Sole admin protection and prevention of self-role-demotion or self-deletion.
- **Trivy Security Scanning**: Container & image vulnerability analysis with severity breakdown and exportable reports.
- **Interactive Terminal & Real-Time Logs**: Web-based container console and live log streaming.
- **Compose Stacks & Engine Overview**: Full lifecycle management for Compose stacks, volumes, and networks.
