import React, { useState, useEffect } from "react";
import { Card, Typography, Input, Button, Space, message, Tabs, Alert, Tag, Row, Col, Modal } from "antd";
import { 
  KeyOutlined, 
  CopyOutlined, 
  ReloadOutlined, 
  CodeOutlined, 
  CheckCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ApiOutlined,
  SendOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function ApiDocsTab({ token, user, onRefreshProfile }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/merchant/profile", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setWebhookUrl(data.data.webhook_url || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} disalin ke clipboard!`);
  };

  const handleRegenerateKeys = () => {
    Modal.confirm({
      title: "Regenerate API Keys?",
      content: "Kunci API lama Anda akan langsung dinonaktifkan. Integrasi toko yang menggunakan kunci lama harus diperbarui.",
      okText: "Ya, Regenerate",
      okType: "danger",
      cancelText: "Batal",
      onOk: async () => {
        try {
          const res = await fetch("/api/v1/merchant/regenerate-keys", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            message.success("API Keys berhasil diperbarui!");
            fetchProfile();
            if (onRefreshProfile) onRefreshProfile();
          }
        } catch (err) {
          message.error("Gagal memperbarui API keys: " + err.message);
        }
      }
    });
  };

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      const res = await fetch("/api/v1/merchant/webhook-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ webhook_url: webhookUrl })
      });
      const data = await res.json();
      if (data.success) {
        message.success("Webhook URL berhasil disimpan!");
        fetchProfile();
        if (onRefreshProfile) onRefreshProfile();
      }
    } catch (err) {
      message.error("Gagal menyimpan webhook URL: " + err.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  const phpSnippet = `<?php
// 1. Buat Invoice Pembayaran ke Payment Bridge
$apiKey = '${profile?.api_key || "pb_live_your_api_key"}';
$apiSecret = '${profile?.api_secret || "pb_sec_your_secret"}';

$payload = [
    'customer_name' => 'Budi Santoso',
    'customer_email' => 'budi@example.com',
    'amount' => 150000,
    'expiry_minutes' => 60,
    'payment_method' => 'MANUAL_TRANSFER' // atau 'DOKU_CHECKOUT'
];

$ch = curl_init('https://payment-bridge-ecru.vercel.app/api/v1/gateway/invoices');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-Merchant-Key: ' . $apiKey,
    'X-Merchant-Secret: ' . $apiSecret
]);

$response = curl_exec($ch);
$result = json_decode($response, true);
print_r($result);
?>`;

  const nodeSnippet = `import fetch from 'node-fetch';

const apiKey = '${profile?.api_key || "pb_live_your_api_key"}';
const apiSecret = '${profile?.api_secret || "pb_sec_your_secret"}';

const response = await fetch('https://payment-bridge-ecru.vercel.app/api/v1/gateway/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Merchant-Key': apiKey,
    'X-Merchant-Secret': apiSecret
  },
  body: JSON.stringify({
    customer_name: 'Budi Santoso',
    customer_email: 'budi@example.com',
    amount: 150000,
    expiry_minutes: 60,
    payment_method: 'MANUAL_TRANSFER'
  })
});

const data = await response.json();
console.log('Invoice Dibuat:', data);`;

  const curlSnippet = `curl -X POST https://payment-bridge-ecru.vercel.app/api/v1/gateway/invoices \\
  -H "Content-Type: application/json" \\
  -H "X-Merchant-Key: ${profile?.api_key || "pb_live_your_api_key"}" \\
  -H "X-Merchant-Secret: ${profile?.api_secret || "pb_sec_your_secret"}" \\
  -d '{
    "customer_name": "Budi Santoso",
    "customer_email": "budi@example.com",
    "amount": 150000,
    "expiry_minutes": 60,
    "payment_method": "MANUAL_TRANSFER"
  }'`;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Header */}
      <div>
        <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Developer API & Integration Keys
        </Title>
        <Text type="secondary" style={{ fontSize: 13.5 }}>
          Gunakan API Key dan Secret di bawah untuk mengintegrasikan toko online / backend Anda dengan Payment Bridge
        </Text>
      </div>

      {/* API Credentials Card */}
      <Card title={<Space><KeyOutlined style={{ color: "#2563EB" }} /><span>Kredensial Merchant API</span></Space>} className="card-elevated">
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Merchant API Key (Public / Client Identifier)</div>
            <Input.Group compact style={{ display: "flex" }}>
              <Input 
                value={profile?.api_key || "Memuat..."} 
                readOnly 
                className="mono-code"
                style={{ flex: 1, background: "var(--color-surface-subtle)", fontWeight: 600 }}
              />
              <Button 
                icon={<CopyOutlined />} 
                onClick={() => copyToClipboard(profile?.api_key, "API Key")}
              >
                Salin
              </Button>
            </Input.Group>
            <Text type="secondary" style={{ fontSize: 12 }}>Kirimkan di header <code>X-Merchant-Key</code></Text>
          </Col>

          <Col xs={24} md={12}>
            <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Merchant Secret Key (Signature Verification)</div>
            <Input.Group compact style={{ display: "flex" }}>
              <Input 
                type={showSecret ? "text" : "password"}
                value={profile?.api_secret || "Memuat..."} 
                readOnly 
                className="mono-code"
                style={{ flex: 1, background: "var(--color-surface-subtle)", fontWeight: 600 }}
              />
              <Button 
                icon={showSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
                onClick={() => setShowSecret(!showSecret)}
              />
              <Button 
                icon={<CopyOutlined />} 
                onClick={() => copyToClipboard(profile?.api_secret, "Secret Key")}
              >
                Salin
              </Button>
            </Input.Group>
            <Text type="secondary" style={{ fontSize: 12 }}>Rahasiakan! Digunakan untuk memvalidasi tanda tangan webhook</Text>
          </Col>
        </Row>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <Button icon={<ReloadOutlined />} onClick={handleRegenerateKeys} danger>
            Regenerate API Keys
          </Button>
        </div>
      </Card>

      {/* Webhook Dispatch Target */}
      <Card title={<Space><SendOutlined style={{ color: "#7C3AED" }} /><span>Target Webhook Merchant</span></Space>} className="card-elevated">
        <div style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13.5 }}>
            URL endpoint di server Anda yang akan menerima notifikasi HTTP POST setiap kali invoice berhasil dibayar:
          </Text>
        </div>
        <div style={{ display: "flex", gap: 10, maxWidth: 800 }}>
          <Input 
            value={webhookUrl} 
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://tokoanda.com/api/payment-callback" 
            size="large"
            style={{ borderRadius: 8 }}
          />
          <Button type="primary" size="large" onClick={handleSaveWebhook} loading={savingWebhook}>
            Simpan URL
          </Button>
        </div>
      </Card>

      {/* Code Integration Samples */}
      <Card title={<Space><CodeOutlined style={{ color: "#10B981" }} /><span>Contoh Integrasi Kode (Create Invoice API)</span></Space>} className="card-elevated">
        <Tabs
          defaultActiveKey="php"
          items={[
            {
              key: "php",
              label: "PHP / Laravel",
              children: <pre className="raw-json-viewer"><code>{phpSnippet}</code></pre>
            },
            {
              key: "node",
              label: "Node.js / Express",
              children: <pre className="raw-json-viewer"><code>{nodeSnippet}</code></pre>
            },
            {
              key: "curl",
              label: "cURL / CLI",
              children: <pre className="raw-json-viewer"><code>{curlSnippet}</code></pre>
            }
          ]}
        />
      </Card>
    </Space>
  );
}