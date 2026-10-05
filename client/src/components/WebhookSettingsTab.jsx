import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Form, 
  Input, 
  Select, 
  Button, 
  Typography, 
  Table, 
  Tag, 
  Space, 
  message, 
  Switch,
  Modal,
  Tabs,
  Tooltip
} from 'antd';
import { 
  ApiOutlined, 
  SaveOutlined, 
  SendOutlined, 
  ReloadOutlined,
  CodeOutlined,
  SafetyCertificateOutlined,
  RedoOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function WebhookSettingsTab() {
  const [form] = Form.useForm();
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Test Dispatcher State
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Webhook Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState(null);

  // Docs Modal
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/v1/webhooks/config');
      const json = await res.json();
      if (json.success) {
        form.setFieldsValue(json.data);
        setTestUrl(json.data.webhookUrl || '');
      }
    } catch (err) {
      message.error('Gagal memuat konfigurasi webhook: ' + err.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/v1/webhooks/logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      message.error('Gagal memuat log webhook: ' + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveConfig = async (values) => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/v1/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      if (json.success) {
        message.success('Konfigurasi webhook berhasil disimpan');
        fetchConfig();
      } else {
        message.error(json.error || 'Gagal menyimpan');
      }
    } catch (err) {
      message.error('Gagal menyimpan konfigurasi: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!testUrl) {
      message.warning('Tentukan target webhook URL terlebih dahulu');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_url: testUrl,
          secret_key: form.getFieldValue('webhookSecret')
        })
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(json);
        message.success(`Test webhook selesai dengan HTTP ${json.status_code}`);
        fetchLogs();
      } else {
        message.error(json.error || 'Test webhook gagal');
      }
    } catch (err) {
      message.error('Error pengiriman test webhook: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleRetryWebhook = async (logId) => {
    setRetryingLogId(logId);
    try {
      const res = await fetch(`/api/v1/webhooks/logs/${logId}/retry`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        if (json.data.success) {
          message.success('Webhook berhasil dikirim ulang (HTTP 200 OK)');
        } else {
          message.warning(`Retry webhook selesai dengan respon HTTP ${json.data.status_code}`);
        }
        fetchLogs();
      } else {
        message.error(json.error || 'Gagal retry webhook');
      }
    } catch (err) {
      message.error('Gagal retry: ' + err.message);
    } finally {
      setRetryingLogId(null);
    }
  };

  const logColumns = [
    {
      title: 'Waktu Eksekusi',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val) => (
        <span className="mono-code" style={{ fontSize: 12, color: '#475569' }}>
          {new Date(val).toLocaleString('id-ID')}
        </span>
      )
    },
    {
      title: 'Invoice Terkait',
      dataIndex: 'invoice_id',
      key: 'invoice_id',
      width: 170,
      render: (id, record) => (
        <Space direction="vertical" size={1}>
          <Text strong className="mono-code">{id || 'N/A'}</Text>
          {record.total_amount && (
            <span style={{ fontSize: 11, color: '#237804' }}>
              Rp {Number(record.total_amount).toLocaleString('id-ID')} ({record.customer_name || 'Customer'})
            </span>
          )}
        </Space>
      )
    },
    {
      title: 'HTTP Status',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 120,
      align: 'center',
      render: (code) => {
        const is2xx = code >= 200 && code < 300;
        return (
          <Tag color={is2xx ? 'success' : 'error'} style={{ fontWeight: 600 }}>
            {code} {is2xx ? 'OK' : 'FAIL'}
          </Tag>
        );
      }
    },
    {
      title: 'Percobaan',
      dataIndex: 'attempts',
      key: 'attempts',
      width: 100,
      align: 'center',
      render: (att) => <Tag color="blue">{att}x Attempt</Tag>
    },
    {
      title: 'Respons Server Merchant',
      dataIndex: 'response_body',
      key: 'response_body',
      render: (body) => (
        <Text ellipsis={{ tooltip: body }} style={{ maxWidth: 300, display: 'block', fontSize: 12 }} className="mono-code">
          {body || '<Empty Response>'}
        </Text>
      )
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Button
          size="small"
          icon={<RedoOutlined />}
          loading={retryingLogId === record.id}
          onClick={() => handleRetryWebhook(record.id)}
        >
          Retry
        </Button>
      )
    }
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={[20, 20]}>
        {/* Webhook Configuration Form */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ApiOutlined style={{ color: '#1677FF' }} />
                <span>Pengaturan Webhook Merchant</span>
              </Space>
            } 
            className="card-elevated"
            loading={loadingConfig}
            extra={
              <Button 
                type="link" 
                icon={<CodeOutlined />} 
                onClick={() => setDocsModalOpen(true)}
              >
                Panduan Verifikasi Merchant
              </Button>
            }
          >
            <Form form={form} layout="vertical" onFinish={handleSaveConfig}>
              <Form.Item
                label="Merchant Webhook Endpoint URL"
                name="webhookUrl"
                rules={[{ required: true, message: 'URL webhook wajib diisi' }]}
                extra="Sistem akan mengirim HTTP POST ke URL ini saat invoice terbayar."
              >
                <Input placeholder="https://api.merchant.com/v1/webhooks/payment" />
              </Form.Item>

              <Form.Item
                label="HMAC SHA-256 Secret Key"
                name="webhookSecret"
                rules={[{ required: true, message: 'Secret key wajib diisi' }]}
                extra="Digunakan untuk menghasilkan signature pada header X-Bridge-Signature."
              >
                <Input.Password placeholder="ph_sec_..." className="mono-code" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Retry Counter (Percobaan)" name="retryAttempts">
                    <Select>
                      <Option value="1">1x (Tanpa Retry)</Option>
                      <Option value="3">3x (Default Rekomendasi)</Option>
                      <Option value="5">5x (High Reliability)</Option>
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
          pagination={{ pageSize: 8 }}
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

