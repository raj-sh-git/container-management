import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ContainersPage } from './pages/ContainersPage';
import { StacksPage } from './pages/StacksPage';
import { ImagesPage } from './pages/ImagesPage';
import { VolumesPage } from './pages/VolumesPage';
import { NetworksPage } from './pages/NetworksPage';
import { SecurityPage } from './pages/SecurityPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { HostPage } from './pages/HostPage';
import { CreateContainerModal } from './components/containers/CreateContainerModal';
import { ScanModal } from './components/security/ScanModal';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';

import {
  containersApi,
  imagesApi,
  volumesApi,
  networksApi,
  securityApi,
  systemApi,
} from './services/api';

import {
  Container,
  ComposeStack,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  ScanReport,
  SystemInfo,
} from './types';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Core Docker data state
  const [containers, setContainers] = useState<Container[]>([]);
  const [stacks, setStacks] = useState<ComposeStack[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Modals & Navigation targets
  const [isCreateContainerOpen, setIsCreateContainerOpen] = useState<boolean>(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanModalTarget, setScanModalTarget] = useState<
    { type: 'image' | 'container'; name: string; id?: string } | undefined
  >(undefined);
  const [selectedContainerForDetail, setSelectedContainerForDetail] = useState<Container | null>(
    null
  );
  const [initialDetailTab, setInitialDetailTab] = useState<string>('overview');

  const fetchAllData = async () => {
    if (!user) return;
    try {
      const [c, stk, img, v, n, rep, sys] = await Promise.allSettled([
        containersApi.list(true),
        containersApi.listStacks(),
        imagesApi.list(false),
        volumesApi.list(),
        networksApi.list(),
        securityApi.listReports(),
        systemApi.info(),
      ]);

      if (c.status === 'fulfilled') setContainers(c.value);
      if (stk.status === 'fulfilled') setStacks(stk.value);
      if (img.status === 'fulfilled') setImages(img.value);
      if (v.status === 'fulfilled') setVolumes(v.value);
      if (n.status === 'fulfilled') setNetworks(n.value);
      if (rep.status === 'fulfilled') setReports(rep.value);
      if (sys.status === 'fulfilled') setSystemInfo(sys.value);
    } catch (err) {
      console.error('Error fetching dashboard state:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 10000); // 10s auto-sync
      return () => clearInterval(interval);
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Initializing Container Control Center Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleSelectContainerFromDashboard = (c: Container, tab?: string) => {
    setSelectedContainerForDetail(c);
    setInitialDetailTab(tab || 'overview');
    setActiveTab('containers');
  };

  const handleOpenScanWithTarget = (target: {
    type: 'image' | 'container';
    name: string;
    id: string;
  }) => {
    setScanModalTarget(target);
    setIsScanModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-[#f4f4f5] flex flex-col font-sans transition-colors duration-200">
      <Navbar onRefresh={fetchAllData} />

      <div className="flex flex-1">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(t) => {
            if (t !== 'containers') setSelectedContainerForDetail(null);
            setActiveTab(t);
          }}
          counts={{
            containers: containers.length,
            stacks: stacks.length,
            images: images.length,
            volumes: volumes.length,
            networks: networks.length,
            reports: reports.length,
          }}
        />

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              systemInfo={systemInfo}
              containers={containers}
              images={images}
              volumes={volumes}
              networks={networks}
              reports={reports}
              onSelectTab={setActiveTab}
              onOpenCreateContainer={() => setIsCreateContainerOpen(true)}
              onOpenScanModal={() => {
                setScanModalTarget(undefined);
                setIsScanModalOpen(true);
              }}
              onSelectContainer={handleSelectContainerFromDashboard}
            />
          )}

          {activeTab === 'containers' && (
            <ContainersPage
              containers={containers}
              images={images}
              networks={networks}
              reports={reports}
              onRefresh={fetchAllData}
              onOpenCreateModal={() => setIsCreateContainerOpen(true)}
              onOpenScanModal={handleOpenScanWithTarget}
              selectedContainerForDetail={selectedContainerForDetail}
              initialDetailTab={initialDetailTab}
            />
          )}

          {activeTab === 'stacks' && (
            <StacksPage
              stacks={stacks}
              onRefresh={fetchAllData}
              onSelectContainer={handleSelectContainerFromDashboard}
            />
          )}

          {activeTab === 'images' && (
            <ImagesPage
              images={images}
              containers={containers}
              reports={reports}
              onRefresh={fetchAllData}
              onOpenScanModal={handleOpenScanWithTarget}
            />
          )}

          {activeTab === 'volumes' && (
            <VolumesPage volumes={volumes} onRefresh={fetchAllData} />
          )}

          {activeTab === 'networks' && (
            <NetworksPage networks={networks} containers={containers} onRefresh={fetchAllData} />
          )}

          {activeTab === 'security' && (
            <SecurityPage
              reports={reports}
              onRefresh={fetchAllData}
              onOpenScanModal={() => {
                setScanModalTarget(undefined);
                setIsScanModalOpen(true);
              }}
            />
          )}

          {activeTab === 'users' && isAdmin && <UsersPage />}

          {activeTab === 'audit' && isAdmin && <AuditPage />}

          {activeTab === 'host' && (
            <HostPage systemInfo={systemInfo} onRefresh={fetchAllData} />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <CreateContainerModal
        isOpen={isCreateContainerOpen}
        onClose={() => setIsCreateContainerOpen(false)}
        images={images}
        networks={networks}
        onCreated={fetchAllData}
      />

      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setScanModalTarget(undefined);
        }}
        containers={containers}
        images={images}
        onScanInitiated={() => {
          fetchAllData();
          setActiveTab('security');
        }}
        initialTarget={scanModalTarget}
      />

      <ForcePasswordChangeModal isOpen={Boolean(user?.mustChangePassword)} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
