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
  theme
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
  CloudServerOutlined
} from "@ant-design/icons";

import DashboardTab from "./components/DashboardTab";
import MutationsTab from "./components/MutationsTab";
import InvoicesTab from "./components/InvoicesTab";
import DevicesTab from "./components/DevicesTab";
import DokuSettingsTab from "./components/DokuSettingsTab";
import WebhookSettingsTab from "./components/WebhookSettingsTab";
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
    message.success(`Selamat datang kembali, ${userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("pb_user");
    localStorage.removeItem("pb_token");
    message.info("Anda telah keluar dari sistem.");
  };

  const fetchAllData = async () => {
    try {
      const [statsRes, mutRes, invRes] = await Promise.all([
        fetch("/api/v1/dashboard/stats").then(r => r.json()),
        fetch("/api/v1/mutations").then(r => r.json()),
        fetch("/api/v1/invoices").then(r => r.json())
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (mutRes.success) setMutations(mutRes.data);
      if (invRes.success) setInvoices(invRes.data);
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 8000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

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
          <span>Mutasi Masuk</span>
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
      key: "doku",
      icon: <CreditCardOutlined style={{ fontSize: 16, color: "#E11D48" }} />,
      label: "DOKU Gateway"
    },
    {
      key: "webhooks",
      icon: <ApiOutlined style={{ fontSize: 16 }} />,
      label: "Webhook Settings"
    }
  ];

  const userMenuItems = [
    {
      key: "user-info",
      label: (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user?.username || "Admin"}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>Fintech Administrator</div>
        </div>
      ),
      disabled: true
    },
    { type: "divider" },
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
            onOpenRawDrawer={(mut) => setRawDrawerMutation(mut)}
            onOpenManualMatch={(mut) => setManualMatchMutation(mut)}
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
      case "doku":
        return <DokuSettingsTab />;
      case "webhooks":
        return <WebhookSettingsTab />;
      default:
        return null;
    }
  };

  const customTheme = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: "#2563EB",
      colorInfo: "#2563EB",
      colorSuccess: "#10B981",
      colorWarning: "#F59E0B",
      colorError: "#EF4444",
      colorTextBase: isDarkMode ? "#F9FAFB" : "#0F172A",
      fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      borderRadius: 8,
      colorBgContainer: isDarkMode ? "#111827" : "#FFFFFF",
      colorBgElevated: isDarkMode ? "#1F2937" : "#FFFFFF",
      colorBgLayout: isDarkMode ? "#0B0F19" : "#F8FAFC",
      colorBorder: isDarkMode ? "#1F2937" : "#E2E8F0",
      colorBorderSecondary: isDarkMode ? "#374151" : "#F1F5F9",
      fontSize: 14
    },
    components: {
      Menu: {
        itemBorderRadius: 8,
        itemMarginInline: 8,
        itemSelectedBg: isDarkMode ? "#1E3A8A" : "#EFF6FF",
        itemSelectedColor: isDarkMode ? "#93C5FD" : "#2563EB"
      },
      Button: {
        borderRadius: 8,
        controlHeight: 38,
        fontWeight: 600
      },
      Table: {
        headerBg: isDarkMode ? "#1F2937" : "#F8FAFC",
        headerBorderRadius: 8
      },
      Card: {
        borderRadiusLG: 12
      }
    }
  };

  // If not authenticated, display Login Portal
  if (!user || !token) {
    return (
      <ConfigProvider theme={customTheme}>
        <LoginPortal 
          onLoginSuccess={handleLoginSuccess}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={customTheme}>
      <Layout style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
        {/* Desktop Sider */}
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={248}
          className="app-sider"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 10,
            boxShadow: isDarkMode ? "1px 0 3px rgba(0, 0, 0, 0.4)" : "1px 0 2px rgba(15, 23, 42, 0.03)"
          }}
        >
          <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: `1px solid ${isDarkMode ? '#1F2937' : '#F1F5F9'}` }}>
            <div className="app-logo">
              <div className="app-logo-badge">PB</div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>Payment Bridge</span>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500, marginTop: -2 }}>Fintech Gateway Core</div>
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

          {/* Sider Footer: Turso Cloud Status */}
          <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, padding: "10px 12px", background: isDarkMode ? "#1F2937" : "#F8FAFC", borderRadius: 8, border: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}`, fontSize: 11.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#2563EB" }}>
              <CloudServerOutlined />
              <span>Turso LibSQL Cloud</span>
            </div>
            <div style={{ color: "var(--color-text-muted)", marginTop: 2, fontSize: 10.5 }}>
              Distributed Edge Replica (sin/tokyo)
            </div>
          </div>
        </Sider>

        {/* Mobile Navigation Drawer */}
        <Drawer
          title="Payment Bridge"
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={260}
          styles={{ body: { padding: 0 } }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => {
              setSelectedKey(key);
              setMobileDrawerOpen(false);
            }}
            style={{ borderRight: 0, padding: "12px 4px" }}
          />
        </Drawer>

        {/* Main Content Layout */}
        <Layout className="site-layout" style={{ marginLeft: 248, transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)", background: "var(--color-bg)" }}>
          <Header className="app-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                className="mobile-menu-btn"
                onClick={() => setMobileDrawerOpen(true)}
                style={{ display: "none" }}
              />
              <Text strong style={{ fontSize: 16, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                {selectedKey === "dashboard" ? "Dashboard" :
                 selectedKey === "mutations" ? "Mutasi Real-time" :
                 selectedKey === "invoices" ? "Invoices" :
                 selectedKey === "devices" ? "Device Android" :
                 selectedKey === "doku" ? "DOKU Gateway" : "Webhook Settings"}
              </Text>
            </div>

            <Space size={12}>
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
                    padding: "4px 12px", 
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: isDarkMode
                      ? (activeDeviceCount > 0 ? "#34D399" : "#FBBF24")
                      : (activeDeviceCount > 0 ? "#065F46" : "#92400E")
                  }}
                >
                  <span className={"pulse-indicator " + (activeDeviceCount > 0 ? "" : "offline")} />
                  {activeDeviceCount > 0 ? activeDeviceCount + " Android Online" : "Android Idle"}
                </div>
              </Tooltip>

              <Button 
                icon={<ThunderboltOutlined style={{ color: "#2563EB" }} />}
                onClick={() => setSimulatorOpen(true)}
                style={{ borderColor: isDarkMode ? "#374151" : "#CBD5E1" }}
              >
                Simulator Inbound
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setCreateInvoiceOpen(true)}
              >
                Buat Invoice
              </Button>

              {/* User Profile Dropdown */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 8, border: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}` }}>
                  <Avatar size={28} style={{ backgroundColor: "#2563EB", fontWeight: 700 }}>
                    {user?.username ? user.username[0].toUpperCase() : "A"}
                  </Avatar>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {user?.username || "Admin"}
                  </span>
                </div>
              </Dropdown>
            </Space>
          </Header>

          <Content style={{ padding: "28px", minHeight: "calc(100vh - 64px)" }}>
            <div style={{ maxWidth: 1360, margin: "0 auto" }}>
              {renderContent()}
            </div>
          </Content>
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
