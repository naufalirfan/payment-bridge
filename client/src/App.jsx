import React, { useState, useEffect } from "react";
import { 
  Layout, 
  Menu, 
  Typography, 
  Button, 
  Badge, 
  Space, 
  ConfigProvider, 
  Tooltip, 
  Drawer,
  Dropdown,
  Avatar,
  message,
  theme,
  Tag
} from "antd";
import { 
  DashboardOutlined, 
  TransactionOutlined, 
  FileTextOutlined, 
  MobileOutlined, 
  ApiOutlined, 
  CreditCardOutlined, 
  ThunderboltOutlined, 
  PlusOutlined, 
  MenuOutlined, 
  SunOutlined, 
  MoonOutlined, 
  UserOutlined, 
  LogoutOutlined, 
  KeyOutlined, 
  CloudServerOutlined, 
  CrownOutlined, 
  CodeOutlined,
  AppstoreOutlined
} from "@ant-design/icons";

import DashboardTab from "./components/DashboardTab";
import MutationsTab from "./components/MutationsTab";
import InvoicesTab from "./components/InvoicesTab";
import DevicesTab from "./components/DevicesTab";
import DokuSettingsTab from "./components/DokuSettingsTab";
import WebhookSettingsTab from "./components/WebhookSettingsTab";
import ApiDocsTab from "./components/ApiDocsTab";
import SubscriptionTab from "./components/SubscriptionTab";
import SimulatorModal from "./components/SimulatorModal";
import CreateInvoiceModal from "./components/CreateInvoiceModal";
import RawPayloadDrawer from "./components/RawPayloadDrawer";
import ManualMatchModal from "./components/ManualMatchModal";
import LoginPortal from "./components/LoginPortal";
import ChangePasswordModal from "./components/ChangePasswordModal";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function App() {
  const [selectedKey, setSelectedKey] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [mutations, setMutations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("pb_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("pb_token") || "");

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("pb_theme");
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.body.classList.toggle("dark", isDarkMode);
    localStorage.setItem("pb_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Modals & Drawers state
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [rawDrawerMutation, setRawDrawerMutation] = useState(null);
  const [manualMatchMutation, setManualMatchMutation] = useState(null);

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("pb_user", JSON.stringify(userData));
    localStorage.setItem("pb_token", userToken);
    message.success(`Selamat datang, ${userData.name || userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("pb_user");
    localStorage.removeItem("pb_token");
    message.info("Anda telah keluar dari sistem.");
  };

  const fetchAllData = async () => {
    if (!token) return;
    try {
      const headers = { "Authorization": `Bearer ${token}` };
      const [statsRes, mutRes, invRes] = await Promise.all([
        fetch("/api/v1/dashboard/stats", { headers }).then(r => r.json()),
        fetch("/api/v1/mutations", { headers }).then(r => r.json()),
        fetch("/api/v1/invoices", { headers }).then(r => r.json())
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (mutRes.success) setMutations(mutRes.data);
      if (invRes.success) setInvoices(invRes.data);
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        localStorage.setItem("pb_user", JSON.stringify(data.data));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile();
      fetchAllData();
      const interval = setInterval(() => {
        fetchAllData();
        refreshProfile();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const activeDeviceCount = (stats?.devices || []).filter(d => 
    d.last_ping_at && (new Date().getTime() - new Date(d.last_ping_at).getTime() < 5 * 60 * 1000)
  ).length;

  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined style={{ fontSize: 16 }} />,
      label: "Dashboard"
    },
    {
      key: "mutations",
      icon: <TransactionOutlined style={{ fontSize: 16 }} />,
      label: (
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Mutasi Real-time</span>
          {mutations.length > 0 && (
            <Badge 
              count={mutations.length} 
              overflowCount={999} 
              style={{ backgroundColor: isDarkMode ? "#3B82F6" : "#2563EB", boxShadow: "none" }} 
            />
          )}
        </span>
      )
    },
    {
      key: "invoices",
      icon: <FileTextOutlined style={{ fontSize: 16 }} />,
      label: "Invoices"
    },
    {
      key: "devices",
      icon: <MobileOutlined style={{ fontSize: 16 }} />,
      label: "Device Android"
    },
    {
      key: "api-docs",
      icon: <CodeOutlined style={{ fontSize: 16, color: "#10B981" }} />,
      label: "API & Integrasi Toko"
    },
    {
      key: "subscription",
      icon: <CrownOutlined style={{ fontSize: 16, color: "#F59E0B" }} />,
      label: "Paket Langganan"
    },
    {
      key: "doku",
      icon: <CreditCardOutlined style={{ fontSize: 16, color: "#E11D48" }} />,
      label: "DOKU Gateway"
    },
    {
      key: "webhooks",
      icon: <ApiOutlined style={{ fontSize: 16 }} />,
      label: "Webhook Logs"
    }
  ];

  const userMenuItems = [
    {
      key: "user-info",
      label: (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user?.name || user?.username || "Merchant"}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            {user?.email || "merchant@paymentbridge.id"}
          </div>
          <Tag color="blue" style={{ marginTop: 4, fontSize: 10.5 }}>
            {user?.plan || "PRO TRIAL"}
          </Tag>
        </div>
      ),
      disabled: true
    },
    { type: "divider" },
    {
      key: "menu-subscription",
      icon: <CrownOutlined style={{ color: "#F59E0B" }} />,
      label: "Upgrade Paket",
      onClick: () => setSelectedKey("subscription")
    },
    {
      key: "change-password",
      icon: <KeyOutlined />,
      label: "Ubah Password",
      onClick: () => setChangePassOpen(true)
    },
    {
      key: "logout",
      icon: <LogoutOutlined style={{ color: "#EF4444" }} />,
      label: <span style={{ color: "#EF4444" }}>Keluar</span>,
      onClick: handleLogout
    }
  ];

  const getPageTitle = () => {
    switch (selectedKey) {
      case "dashboard": return "Dashboard";
      case "mutations": return "Mutasi Real-time";
      case "invoices": return "Invoices";
      case "devices": return "Device Android";
      case "api-docs": return "API & Integrasi";
      case "subscription": return "Paket Langganan";
      case "doku": return "DOKU Gateway";
      case "webhooks": return "Webhook Logs";
      default: return "Payment Bridge";
    }
  };

  const renderContent = () => {
    switch (selectedKey) {
      case "dashboard":
        return (
          <DashboardTab
            stats={stats}
            loading={loading}
            onRefresh={fetchAllData}
            onOpenSimulator={() => setSimulatorOpen(true)}
            onOpenCreateInvoice={() => setCreateInvoiceOpen(true)}
          />
        );
      case "mutations":
        return (
          <MutationsTab
            mutations={mutations}
            loading={loading}
            onRefresh={fetchAllData}
            onOpenRawDrawer={(item) => setRawDrawerMutation(item)}
            onOpenManualMatch={(item) => setManualMatchMutation(item)}
            onOpenSimulator={() => setSimulatorOpen(true)}
          />
        );
      case "invoices":
        return (
          <InvoicesTab
            invoices={invoices}
            loading={loading}
            onRefresh={fetchAllData}
            onOpenCreateModal={() => setCreateInvoiceOpen(true)}
          />
        );
      case "devices":
        return (
          <DevicesTab
            devices={stats?.devices || []}
            onRefresh={fetchAllData}
          />
        );
      case "api-docs":
        return (
          <ApiDocsTab
            token={token}
            onRefreshProfile={refreshProfile}
          />
        );
      case "subscription":
        return (
          <SubscriptionTab
            user={user}
            token={token}
            onRefreshProfile={refreshProfile}
          />
        );
      case "doku":
        return <DokuSettingsTab />;
      case "webhooks":
        return <WebhookSettingsTab />;
      default:
        return <div>Tab tidak ditemukan</div>;
    }
  };

  // If not logged in, show sleek login / register portal
  if (!user || !token) {
    return (
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: "#2563EB",
            fontFamily: "var(--font-sans)",
            borderRadius: 8
          }
        }}
      >
        <LoginPortal onLoginSuccess={handleLoginSuccess} isDarkMode={isDarkMode} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#2563EB",
          fontFamily: "var(--font-sans)",
          borderRadius: 8
        }
      }}
    >
      <Layout style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
        {/* Desktop Sidebar Sider */}
        <Sider
          width={256}
          className="app-sider"
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100
          }}
        >
          {/* Logo & Platform Info */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${isDarkMode ? '#1F2937' : '#E2E8F0'}` }}>
            <div className="app-logo">
              <div className="app-logo-badge">PB</div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>Payment Bridge</span>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500, marginTop: -2 }}>SaaS Gateway Core</div>
              </div>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ borderRight: 0, padding: "14px 4px", background: "transparent" }}
          />

          {/* Sider Footer: Merchant Plan & Turso Status */}
          <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, padding: "12px", background: isDarkMode ? "#1F2937" : "#F8FAFC", borderRadius: 8, border: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}`, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Paket:</span>
              <Tag color={user?.plan === "ENTERPRISE" ? "purple" : "blue"} style={{ margin: 0 }}>
                {user?.plan || "STARTER"}
              </Tag>
            </div>
            <div style={{ color: "var(--color-text-muted)", marginTop: 6, fontSize: 11 }}>
              Turso Cloud LibSQL (Tokyo Edge)
            </div>
          </div>
        </Sider>

        {/* Mobile Navigation Drawer */}
        <Drawer
          title={
            <div className="app-logo">
              <div className="app-logo-badge" style={{ width: 28, height: 28, fontSize: 12 }}>PB</div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Payment Bridge</span>
            </div>
          }
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          {/* User Info Header in Drawer */}
          <div style={{ padding: "16px 16px 12px 16px", background: isDarkMode ? "#1F2937" : "#F8FAFC", borderBottom: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar size={36} style={{ backgroundColor: "#2563EB", fontWeight: 700 }}>
                {user?.username ? user.username[0].toUpperCase() : "M"}
              </Avatar>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.name || user?.username || "Merchant"}
                </div>
                <Tag color="blue" style={{ fontSize: 10, padding: "0 6px", marginTop: 2 }}>
                  {user?.plan || "STARTER"}
                </Tag>
              </div>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => {
              setSelectedKey(key);
              setMobileDrawerOpen(false);
            }}
            style={{ borderRight: 0, padding: "8px 4px" }}
          />

          <div style={{ padding: "16px", marginTop: "auto" }}>
            <Button 
              danger 
              block 
              icon={<LogoutOutlined />} 
              onClick={() => {
                setMobileDrawerOpen(false);
                handleLogout();
              }}
            >
              Keluar Akun
            </Button>
          </div>
        </Drawer>

        {/* Main Content Layout */}
        <Layout className="site-layout" style={{ marginLeft: 256, transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)", background: "var(--color-bg)" }}>
          <Header className="app-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                className="mobile-menu-btn"
                onClick={() => setMobileDrawerOpen(true)}
                style={{ display: "none" }}
              />
              <Text strong className="page-title-text" style={{ fontSize: 16, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                {getPageTitle()}
              </Text>
            </div>

            <Space size={8} className="header-actions-space" style={{ flexShrink: 0 }}>
              {/* Dark Mode Toggle */}
              <Tooltip title={isDarkMode ? "Ganti ke Mode Terang" : "Ganti ke Mode Malam"}>
                <Button 
                  shape="circle"
                  icon={isDarkMode ? <SunOutlined style={{ color: "#FBBF24" }} /> : <MoonOutlined style={{ color: "#475569" }} />}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderColor: isDarkMode ? "#374151" : "#CBD5E1",
                    background: isDarkMode ? "#1F2937" : "#FFFFFF"
                  }}
                />
              </Tooltip>

              {/* Active Device Indicator */}
              <Tooltip title={activeDeviceCount > 0 ? activeDeviceCount + " Smartphone Android aktif terhubung" : "Tidak ada smartphone Android yang mengirim heartbeat (< 5 mnt)"}>
                <div 
                  className="device-status-badge"
                  onClick={() => setSelectedKey("devices")}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    background: isDarkMode 
                      ? (activeDeviceCount > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)")
                      : (activeDeviceCount > 0 ? "#ECFDF5" : "#FFFBEB"), 
                    border: "1px solid " + (isDarkMode
                      ? (activeDeviceCount > 0 ? "#059669" : "#D97706")
                      : (activeDeviceCount > 0 ? "#A7F3D0" : "#FDE68A")),
                    borderRadius: 20, 
                    padding: "4px 10px", 
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: isDarkMode
                      ? (activeDeviceCount > 0 ? "#34D399" : "#FBBF24")
                      : (activeDeviceCount > 0 ? "#065F46" : "#92400E")
                  }}
                >
                  <span className={"pulse-indicator " + (activeDeviceCount > 0 ? "" : "offline")} />
                  <span className="device-status-badge-text">
                    {activeDeviceCount > 0 ? activeDeviceCount + " Online" : "Idle"}
                  </span>
                </div>
              </Tooltip>

              {/* Simulator Inbound Button */}
              <Tooltip title="Simulator Inbound">
                <Button 
                  icon={<ThunderboltOutlined style={{ color: "#2563EB" }} />}
                  onClick={() => setSimulatorOpen(true)}
                  style={{ borderColor: isDarkMode ? "#374151" : "#CBD5E1" }}
                >
                  <span className="desktop-only-btn-text">Simulator</span>
                </Button>
              </Tooltip>

              {/* Create Invoice Button */}
              <Tooltip title="Buat Invoice Baru">
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setCreateInvoiceOpen(true)}
                >
                  <span className="desktop-only-btn-text">Buat Invoice</span>
                </Button>
              </Tooltip>

              {/* User Profile Dropdown */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 6px", borderRadius: 8, border: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}` }}>
                  <Avatar size={26} style={{ backgroundColor: "#2563EB", fontWeight: 700, fontSize: 12 }}>
                    {user?.username ? user.username[0].toUpperCase() : "M"}
                  </Avatar>
                  <span className="desktop-only-btn-text" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {user?.name || user?.username || "Merchant"}
                  </span>
                </div>
              </Dropdown>
            </Space>
          </Header>

          <Content className="app-content">
            <div style={{ maxWidth: 1360, margin: "0 auto", width: "100%" }}>
              {renderContent()}
            </div>
          </Content>

          {/* Native-style Mobile Bottom Navigation */}
          <div className="mobile-bottom-nav">
            <button 
              type="button" 
              className={`mobile-nav-item ${selectedKey === 'dashboard' ? 'active' : ''}`}
              onClick={() => setSelectedKey('dashboard')}
            >
              <DashboardOutlined className="nav-icon" />
              <span>Dashboard</span>
            </button>

            <button 
              type="button" 
              className={`mobile-nav-item ${selectedKey === 'mutations' ? 'active' : ''}`}
              onClick={() => setSelectedKey('mutations')}
            >
              <Badge count={mutations.length} size="small" offset={[4, -2]}>
                <TransactionOutlined className="nav-icon" />
              </Badge>
              <span>Mutasi</span>
            </button>

            <button 
              type="button" 
              className={`mobile-nav-item ${selectedKey === 'invoices' ? 'active' : ''}`}
              onClick={() => setSelectedKey('invoices')}
            >
              <FileTextOutlined className="nav-icon" />
              <span>Invoices</span>
            </button>

            <button 
              type="button" 
              className={`mobile-nav-item ${selectedKey === 'devices' ? 'active' : ''}`}
              onClick={() => setSelectedKey('devices')}
            >
              <MobileOutlined className="nav-icon" />
              <span>Device</span>
            </button>

            <button 
              type="button" 
              className="mobile-nav-item"
              onClick={() => setMobileDrawerOpen(true)}
            >
              <AppstoreOutlined className="nav-icon" />
              <span>Menu</span>
            </button>
          </div>
        </Layout>
      </Layout>

      {/* Global Modals & Drawers */}
      <SimulatorModal
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        onSimulated={fetchAllData}
      />

      <CreateInvoiceModal
        open={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        onCreated={fetchAllData}
      />

      <ChangePasswordModal
        open={changePassOpen}
        onClose={() => setChangePassOpen(false)}
        token={token}
      />

      <RawPayloadDrawer
        open={!!rawDrawerMutation}
        onClose={() => setRawDrawerMutation(null)}
        mutation={rawDrawerMutation}
      />

      <ManualMatchModal
        open={!!manualMatchMutation}
        onClose={() => setManualMatchMutation(null)}
        mutation={manualMatchMutation}
        onMatched={fetchAllData}
      />
    </ConfigProvider>
  );
}
