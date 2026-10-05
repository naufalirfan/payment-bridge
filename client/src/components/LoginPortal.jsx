import React, { useState } from "react";
import { Card, Form, Input, Button, Typography, Alert, Space, Tooltip, Badge } from "antd";
import { 
  UserOutlined, 
  LockOutlined, 
  SafetyCertificateOutlined, 
  ThunderboltOutlined, 
  SunOutlined, 
  MoonOutlined,
  CloudServerOutlined,
  KeyOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function LoginPortal({ onLoginSuccess, isDarkMode, onToggleTheme }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        onLoginSuccess(data.data.user, data.data.token);
      } else {
        setErrorMsg(data.error || "Gagal masuk. Periksa username dan password Anda.");
      }
    } catch (err) {
      setErrorMsg("Koneksi ke server gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    form.setFieldsValue({
      username: "admin",
      password: "admin123"
    });
  };

  return (
    <div 
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: isDarkMode 
          ? "radial-gradient(ellipse at top, #1E293B 0%, #0B0F19 100%)" 
          : "radial-gradient(ellipse at top, #EFF6FF 0%, #F8FAFC 100%)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Theme Toggle Top Right */}
      <div style={{ position: "absolute", top: 24, right: 24 }}>
        <Tooltip title={isDarkMode ? "Ganti ke Mode Terang" : "Ganti ke Mode Malam"}>
          <Button 
            shape="circle"
            size="large"
            icon={isDarkMode ? <SunOutlined style={{ color: "#FBBF24" }} /> : <MoonOutlined style={{ color: "#475569" }} />}
            onClick={onToggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderColor: isDarkMode ? "#374151" : "#CBD5E1",
              background: isDarkMode ? "#1F2937" : "#FFFFFF",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}
          />
        </Tooltip>
      </div>

      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              justifyContent: "center", 
              width: 54, 
              height: 54, 
              borderRadius: 14, 
              background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)", 
              color: "#FFFFFF",
              fontSize: 22,
              fontWeight: 800,
              boxShadow: "0 4px 20px rgba(37, 99, 235, 0.35)",
              marginBottom: 16
            }}
          >
            PB
          </div>
          <Title level={3} style={{ margin: "0 0 6px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Payment Bridge Portal
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Fintech Gateway Core & Distributed Inbound Hub
          </Text>
        </div>

        {/* Login Card */}
        <Card 
          className="card-elevated" 
          style={{ 
            borderRadius: 16, 
            boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 30px rgba(15,23,42,0.08)",
            border: isDarkMode ? "1px solid #1F2937" : "1px solid #E2E8F0"
          }}
          bodyStyle={{ padding: 32 }}
        >
          {errorMsg && (
            <Alert 
              type="error" 
              message={errorMsg} 
              showIcon 
              closable 
              onClose={() => setErrorMsg("")}
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            requiredMark={false}
            initialValues={{ username: "", password: "" }}
          >
            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 13 }}>Username</span>}
              name="username"
              rules={[{ required: true, message: "Silakan masukkan username" }]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                placeholder="Masukkan username"
                size="large"
                style={{ borderRadius: 8 }}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 13 }}>Password</span>}
              name="password"
              rules={[{ required: true, message: "Silakan masukkan password" }]}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                placeholder="Masukkan password"
                size="large"
                style={{ borderRadius: 8 }}
                autoComplete="current-password"
              />
            </Form.Item>

            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block 
              loading={loading}
              style={{ 
                height: 44, 
                borderRadius: 8, 
                fontWeight: 600, 
                marginTop: 8,
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
              }}
            >
              Masuk ke Dashboard
            </Button>
          </Form>

          {/* Quick Demo Credentials Autofill */}
          <div 
            onClick={handleFillDemo}
            style={{ 
              marginTop: 20, 
              padding: "10px 14px", 
              borderRadius: 8, 
              background: isDarkMode ? "#1F2937" : "#F8FAFC", 
              border: `1px dashed ${isDarkMode ? '#374151' : '#CBD5E1'}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KeyOutlined style={{ color: "#2563EB" }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Default Admin: </span>
                <code>admin</code> / <code>admin123</code>
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#2563EB", fontWeight: 600 }}>Klik untuk Isi</span>
          </div>
        </Card>

        {/* Footer Badges */}
        <div style={{ marginTop: 24, textAlign: "center", display: "flex", justifyContent: "center", gap: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <SafetyCertificateOutlined style={{ color: "#10B981" }} /> HMAC SHA-256 Auth
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <CloudServerOutlined style={{ color: "#2563EB" }} /> Turso Distributed LibSQL
          </Text>
        </div>
      </div>
    </div>
  );
}
