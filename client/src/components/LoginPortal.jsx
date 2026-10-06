import React, { useState } from "react";
import { Card, Form, Input, Button, Tabs, Typography, message, Tag, Space } from "antd";
import { 
  UserOutlined, 
  LockOutlined, 
  MailOutlined, 
  ShopOutlined, 
  RocketOutlined,
  SafetyCertificateOutlined,
  CloudServerOutlined,
  KeyOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function LoginPortal({ onLoginSuccess, isDarkMode }) {
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.data.user, data.data.token);
      } else {
        message.error(data.error || "Gagal masuk. Periksa username dan password.");
      }
    } catch (err) {
      message.error("Koneksi gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.data.user, data.data.token);
      } else {
        message.error(data.error || "Gagal mendaftar. Username atau email mungkin sudah digunakan.");
      }
    } catch (err) {
      message.error("Koneksi gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isDarkMode ? "#0B0F19" : "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)",
      padding: "20px 12px"
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 12,
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
          }}>
            PB
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Payment Bridge
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Automated Inbound Mutasi & Payment Dispatcher
          </Text>
        </div>

        {/* Auth Card */}
        <Card className="card-elevated" style={{ borderRadius: 16 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            items={[
              {
                key: "login",
                label: "Masuk Merchant",
                children: (
                  <Form
                    form={loginForm}
                    layout="vertical"
                    onFinish={handleLogin}
                    initialValues={{ username: "admin", password: "admin123" }}
                    requiredMark={false}
                  >
                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Username</span>}
                      name="username"
                      rules={[{ required: true, message: "Silakan masukkan username" }]}
                    >
                      <Input 
                        prefix={<UserOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                        placeholder="admin / username Anda"
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
                        placeholder="Password akun Anda"
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
                        marginTop: 6,
                        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
                      }}
                    >
                      Masuk ke Dashboard
                    </Button>

                    {/* Quick Demo Credentials Autofill */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <KeyOutlined style={{ color: '#2563EB' }} /> Akun Demo Siap Pakai (1-Klik Isi):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                        <div 
                          onClick={() => loginForm.setFieldsValue({ username: 'admin', password: 'admin123' })}
                          style={{ 
                            padding: '8px 10px', 
                            borderRadius: 8, 
                            background: isDarkMode ? '#1E293B' : '#F1F5F9', 
                            border: '1px solid ' + (isDarkMode ? '#334155' : '#CBD5E1'),
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>👑 Master Admin</div>
                          <div style={{ fontSize: 11, color: isDarkMode ? '#CBD5E1' : '#475569' }}>
                            <code>admin</code> / <code>admin123</code>
                          </div>
                        </div>

                        <div 
                          onClick={() => loginForm.setFieldsValue({ username: 'demo_merchant', password: 'merchant123' })}
                          style={{ 
                            padding: '8px 10px', 
                            borderRadius: 8, 
                            background: isDarkMode ? '#1E293B' : '#F1F5F9', 
                            border: '1px solid ' + (isDarkMode ? '#334155' : '#CBD5E1'),
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>🏪 Demo Merchant</div>
                          <div style={{ fontSize: 11, color: isDarkMode ? '#CBD5E1' : '#475569' }}>
                            <code>demo_merchant</code> / <code>merchant123</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Form>
                )
              },
              {
                key: "register",
                label: "Daftar Merchant (Free Trial)",
                children: (
                  <Form
                    form={registerForm}
                    layout="vertical"
                    onFinish={handleRegister}
                    requiredMark={false}
                  >
                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Nama Lengkap / Usaha</span>}
                      name="name"
                      rules={[{ required: true, message: "Masukkan nama Anda" }]}
                    >
                      <Input 
                        prefix={<ShopOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                        placeholder="Contoh: Toko Berkah Jaya"
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Username</span>}
                      name="username"
                      rules={[{ required: true, message: "Pilih username unik" }]}
                    >
                      <Input 
                        prefix={<UserOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                        placeholder="username"
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Email Bisnis</span>}
                      name="email"
                      rules={[{ required: true, type: "email", message: "Masukkan email valid" }]}
                    >
                      <Input 
                        prefix={<MailOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                        placeholder="nama@bisnisanda.com"
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span style={{ fontWeight: 600, fontSize: 13 }}>Password</span>}
                      name="password"
                      rules={[{ required: true, min: 6, message: "Minimal 6 karakter" }]}
                    >
                      <Input.Password 
                        prefix={<LockOutlined style={{ color: "#94A3B8", marginRight: 6 }} />}
                        placeholder="Buat password aman"
                        size="large"
                        style={{ borderRadius: 8 }}
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
                        marginTop: 6,
                        background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                        boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)"
                      }}
                    >
                      <RocketOutlined style={{ marginRight: 6 }} /> Daftar & Dapatkan 14 Hari Free Trial
                    </Button>
                  </Form>
                )
              }
            ]}
          />
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
