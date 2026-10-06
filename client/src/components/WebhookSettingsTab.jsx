import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Form, 
  Input, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Typography, 
  Select, 
  Switch, 
  message, 
  Tooltip, 
  Badge,
  Modal,
  Tabs
} from 'antd';
import { 
  ApiOutlined, 
  SaveOutlined, 
  SendOutlined, 
  ReloadOutlined, 
  CheckCircleFilled, 
  CloseCircleFilled,
  CodeOutlined,
  CopyOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function WebhookSettingsTab() {
  const [form] = Form.useForm();
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testUrl, setTestUrl] = useState('https://webhook.site/demo-payment-bridge');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/v1/webhook/config');
      const json = await res.json();
      if (json.success) {
        form.setFieldsValue(json.data);
      }
    } catch (err) {
      console.error('Failed to load webhook config:', err);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/v1/webhook/logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveConfig = async (values) => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/v1/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      if (json.success) {
        message.success('Konfigurasi webhook berhasil disimpan');
      } else {
        message.error(json.error || 'Gagal menyimpan konfigurasi');
      }
    } catch (err) {
      message.error('Error: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!testUrl) {
      message.warning('Masukkan Target Webhook URL terlebih dahulu');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: testUrl })
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(json.data);
        message.success('Webhook uji coba berhasil ditembakkan!');
        fetchLogs();
      } else {
        message.error(json.error || 'Pengujian webhook gagal');
      }
    } catch (err) {
      message.error('Test request failed: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const logColumns = [
    {
      title: 'Waktu',
      dataIndex: 'dispatched_at',
      key: 'dispatched_at',
      width: 150,
      render: (val) => (
        <span className="mono-code" style={{ fontSize: 11.5, color: '#64748B' }}>
          {new Date(val).toLocaleString('id-ID')}
        </span>
      )
    },
    {
      title: 'Event / Invoice ID',
      dataIndex: 'invoice_id',
      key: 'invoice_id',
      width: 170,
      render: (id) => (
        <Space direction="vertical" size={1}>
          <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>invoice.paid</Tag>
          <span className="mono-code" style={{ fontSize: 11.5, fontWeight: 600 }}>{id}</span>
        </Space>
      )
    },
    {
      title: 'Target Endpoint URL',
      dataIndex: 'target_url',
      key: 'target_url',
      width: 220,
      render: (url) => (
        <Text ellipsis={{ tooltip: url }} className="mono-code" style={{ fontSize: 11.5 }}>
          {url}
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 110,
      align: 'center',
      render: (code, record) => {
        const isSuccess = code >= 200 && code < 300;
        return (
          <Tag color={isSuccess ? 'success' : 'error'} icon={isSuccess ? <CheckCircleFilled /> : <CloseCircleFilled />}>
            {code ? `HTTP ${code}` : 'TIMEOUT'}
          </Tag>
        );
      }
    },
    {
      title: 'Latency',
      dataIndex: 'execution_time_ms',
      key: 'execution_time_ms',
      width: 90,
      align: 'right',
      render: (ms) => <span className="tabular-num" style={{ fontSize: 12 }}>{ms || 0}ms</span>
    }
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Konfigurasi & Logs Outbound Webhook
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Pengaturan pengiriman notifikasi real-time ke sistem merchant dengan HMAC SHA-256
          </Text>
        </div>
        <Button icon={<CodeOutlined />} onClick={() => setDocsModalOpen(true)}>
          Panduan Verifikasi Signature
        </Button>
      </div>

      <Row gutter={[20, 20]}>
        {/* Outbound Webhook Engine Config */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ApiOutlined style={{ color: '#2563EB' }} />
                <span>Pengaturan Dispatcher Webhook</span>
              </Space>
            } 
            className="card-elevated"
          >
            <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
              <Form.Item 
                label="Default Merchant Webhook URL" 
                name="defaultWebhookUrl"
                rules={[{ type: 'url', message: 'Masukkan URL yang valid (https://...)' }]}
                extra="URL ini akan dipanggil otomatis saat ada mutasi transfer atau DOKU yang berhasil dicocokkan."
              >
                <Input placeholder="https://domain-anda.com/api/payment-callback" className="mono-code" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Maksimum Percobaan (Retry)" name="maxRetries">
                    <Select>
                      <Option value="1">1 Kali (No Retry)</Option>
                      <Option value="3">3 Kali (Rekomendasi)</Option>
                      <Option value="5">5 Kali</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Retry Delay Interval" name="retryDelaySeconds">
                    <Select>
                      <Option value="3">3 Detik</Option>
                      <Option value="5">5 Detik</Option>
                      <Option value="15">15 Detik</Option>
                      <Option value="60">60 Detik</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item 
                label="Strict Device Authentication Mode" 
                name="strictDeviceMode" 
                valuePropName="checked"
                extra="Jika aktif, hanya device yang sudah terdaftar di tab Device Management yang diizinkan mengirim notifikasi."
              >
                <Switch checkedChildren="ON (Strict)" unCheckedChildren="OFF (Auto-Register)" />
              </Form.Item>

              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />} 
                loading={savingConfig}
                block
              >
                Simpan Konfigurasi
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Test HMAC Dispatcher Console */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <SendOutlined style={{ color: '#52C41A' }} />
                <span>Konsol Pengujian HMAC Signature</span>
              </Space>
            } 
            className="card-elevated"
          >
            <Paragraph style={{ fontSize: 13, color: '#475569' }}>
              Uji coba tembakan webhook ke server merchant dengan payload simulasi dan validasi verifikasi <code>X-Bridge-Signature</code>.
            </Paragraph>

            <div style={{ marginBottom: 14 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Target Webhook Test URL:</Text>
              <Input 
                value={testUrl} 
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://webhook.site/..." 
              />
            </div>

            <Button 
              type="dashed" 
              icon={<SendOutlined />} 
              onClick={handleTestWebhook} 
              loading={testing}
              block
              style={{ height: 38, borderColor: '#1677FF', color: '#1677FF' }}
            >
              Kirim Test Webhook Sekarang
            </Button>

            {testResult && (
              <div style={{ marginTop: 16, background: "var(--color-surface-subtle)", padding: 14, borderRadius: 6, border: "1px solid var(--color-border)" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>Status Respons:</Text>
                  <Tag color={testResult.status_code >= 200 && testResult.status_code < 300 ? 'green' : 'red'}>
                    HTTP {testResult.status_code} ({testResult.execution_time_ms}ms)
                  </Tag>
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>HEADER X-Bridge-Signature (HMAC SHA-256):</Text>
                  <Text className="mono-code" copyable style={{ fontSize: 11, wordBreak: 'break-all', color: "var(--color-text-primary)" }}>
                    {testResult.signature}
                  </Text>
                </div>

                <div>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>RESPONS DARI SERVER:</Text>
                  <pre className="mono-code" style={{ fontSize: 11, background: '#0F172A', color: '#E2E8F0', padding: 8, borderRadius: 4, margin: '4px 0 0', overflowX: 'auto' }}>
                    {testResult.response_preview}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Webhook Execution Logs Table */}
      <Card 
        title="Riwayat Log Eksekusi Outbound Webhook" 
        className="card-elevated"
        extra={
          <Button icon={<ReloadOutlined />} size="small" onClick={fetchLogs} loading={loadingLogs}>
            Refresh Log
          </Button>
        }
      >
        <Table
          dataSource={logs}
          columns={logColumns}
          rowKey="id"
          loading={loadingLogs}
          scroll={{ x: 650 }}
          pagination={{ pageSize: 8, responsive: true }}
        />
      </Card>

      {/* Documentation Modal */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1677FF' }} />
            <span>Panduan Verifikasi Webhook Merchant (HMAC SHA-256)</span>
          </Space>
        }
        open={docsModalOpen}
        onCancel={() => setDocsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDocsModalOpen(false)}>
            Mengerti & Tutup
          </Button>
        ]}
        width={750}
      >
        <Paragraph>
          Setiap webhook yang dikirim oleh Payment Bridge dilengkapi header <code>X-Bridge-Signature</code> yang dienkripsi menggunakan algoritma HMAC SHA-256 dengan secret key Anda. Server merchant wajib memverifikasi signature sebelum memproses data.
        </Paragraph>

        <Tabs
          defaultActiveKey="nodejs"
          items={[
            {
              key: 'nodejs',
              label: 'Node.js (Express)',
              children: (
                <pre className="mono-code" style={{ background: '#0F172A', color: '#E2E8F0', padding: 12, borderRadius: 6, fontSize: 12, overflowX: 'auto' }}>
{`import crypto from 'crypto';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-bridge-signature'];
  const secretKey = process.env.PAYMENT_BRIDGE_SECRET;
  
  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString());
  console.log('Invoice Paid:', payload.data.invoice_id);
  res.status(200).send('OK');
});`}
                </pre>
              )
            },
            {
              key: 'php',
              label: 'PHP / Laravel',
              children: (
                <pre className="mono-code" style={{ background: '#0F172A', color: '#E2E8F0', padding: 12, borderRadius: 6, fontSize: 12, overflowX: 'auto' }}>
{`<?php
$secret = env('PAYMENT_BRIDGE_SECRET');
$rawPayload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_BRIDGE_SIGNATURE'] ?? '';

$expectedSignature = hash_hmac('sha256', $rawPayload, $secret);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    die('Invalid HMAC Signature');
}

$data = json_decode($rawPayload, true);
// Proses update status order/transaksi
http_response_code(200);
echo json_encode(['status' => 'success']);`}
                </pre>
              )
            },
            {
              key: 'python',
              label: 'Python (FastAPI / Flask)',
              children: (
                <pre className="mono-code" style={{ background: '#0F172A', color: '#E2E8F0', padding: 12, borderRadius: 6, fontSize: 12, overflowX: 'auto' }}>
{`import hmac
import hashlib
from flask import Flask, request, abort

@app.route('/webhook', methods=['POST'])
def webhook_handler():
    signature = request.headers.get('X-Bridge-Signature')
    secret = b'your_webhook_secret'
    raw_body = request.get_data()

    expected_sig = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        abort(401)

    payload = request.json
    print(f"Payment received: {payload['data']['paid_amount']}")
    return "OK", 200`}
                </pre>
              )
            }
          ]}
        />
      </Modal>
    </Space>
  );
}
