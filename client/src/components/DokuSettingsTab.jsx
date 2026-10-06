import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Tag, 
  Space, 
  message, 
  Switch, 
  Divider,
  Alert
} from 'antd';
import { 
  CreditCardOutlined, 
  SaveOutlined, 
  CopyOutlined, 
  SafetyCertificateOutlined,
  CheckCircleFilled,
  LinkOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function DokuSettingsTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dokuConfig, setDokuConfig] = useState(null);

  useEffect(() => {
    fetchDokuConfig();
  }, []);

  const fetchDokuConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('pb_token') || '';
      const res = await fetch('/api/v1/doku/config', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDokuConfig(json.data);
        form.setFieldsValue({
          enabled: json.data.enabled !== false,
          isProduction: json.data.isProduction === true,
          clientId: json.data.clientId || '',
          secretKey: json.data.secretKey || ''
        });
      }
    } catch (err) {
      message.error('Gagal memuat konfigurasi DOKU: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('pb_token') || '';
      const res = await fetch('/api/v1/doku/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          ...values,
          dokuEnabled: values.enabled
        })
      });
      const json = await res.json();
      if (json.success) {
        message.success('Konfigurasi DOKU berhasil disimpan');
        fetchDokuConfig();
      } else {
        message.error(json.error || 'Gagal menyimpan konfigurasi DOKU');
      }
    } catch (err) {
      message.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(label + ' disalin ke clipboard!');
  };

  const callbackUrl = window.location.origin + '/api/v1/callbacks/doku';

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={[20, 20]}>
        {/* DOKU API Keys Config Card */}
        <Col xs={24} lg={13}>
          <Card 
            title={
              <Space>
                <CreditCardOutlined style={{ color: '#E11D48' }} />
                <span>Integrasi DOKU Payment Gateway (Jokul API)</span>
              </Space>
            } 
            className="card-elevated"
            loading={loading}
          >
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item 
                label="Status Integrasi DOKU" 
                name="enabled" 
                valuePropName="checked"
                extra="Aktifkan DOKU untuk mengizinkan pembuatan checkout URL dan penerimaan notifikasi webhook."
              >
                <Switch checkedChildren="AKTIF" unCheckedChildren="NONAKTIF" />
              </Form.Item>

              <Form.Item 
                label="Environment Mode" 
                name="isProduction" 
                valuePropName="checked"
                extra="Nyalakan jika akun DOKU Anda sudah Live / Production (api.doku.com)."
              >
                <Switch checkedChildren="PRODUCTION (Live)" unCheckedChildren="SANDBOX (Testing)" />
              </Form.Item>

              <Form.Item
                label="DOKU Client ID (Mall ID)"
                name="clientId"
                rules={[{ required: true, message: 'Client ID DOKU wajib diisi' }]}
                extra="Dapat ditemukan di DOKU Dashboard > Integrasi / API Keys."
              >
                <Input placeholder="Contoh: BRN-0220-1791096945382" className="mono-code" />
              </Form.Item>

              <Form.Item
                label="DOKU Shared Secret Key"
                name="secretKey"
                rules={[{ required: true, message: 'Secret key DOKU wajib diisi' }]}
                extra="Digunakan untuk memvalidasi HMAC SHA-256 signature webhook notifikasi pembayaran DOKU."
              >
                <Input.Password placeholder="SK-..." className="mono-code" />
              </Form.Item>

              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />} 
                loading={saving}
                block
                style={{ height: 40, fontWeight: 600, background: '#E11D48', borderColor: '#E11D48' }}
              >
                Simpan Kredensial DOKU
              </Button>
            </Form>
          </Card>
        </Col>

        {/* DOKU Webhook Notification URL Box */}
        <Col xs={24} lg={11}>
          <Card 
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1677FF' }} />
                <span>Pengaturan Webhook DOKU Dashboard</span>
              </Space>
            } 
            className="card-elevated"
          >
            <Paragraph style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Salin URL notifikasi di bawah ini ke <strong>DOKU Back Office / Dashboard &gt; Integrasi &gt; Webhook Notification URL</strong>:
            </Paragraph>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                HTTP NOTIFICATION URL (Payment Bridge):
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: "var(--color-surface-subtle)", padding: '8px 12px', borderRadius: 6, border: "1px solid var(--color-border)" }}>
                <Text className="mono-code" style={{ fontSize: 12, wordBreak: 'break-all', flex: 1, color: "var(--color-text-primary)" }}>
                  {callbackUrl}
                </Text>
                <Button 
                  size="small" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyToClipboard(callbackUrl, 'Notification URL')}
                />
              </div>
            </div>

            <Alert
              type="success"
              showIcon
              message="Metode Pembayaran DOKU yang Didukung"
              description={
                <ul style={{ paddingLeft: 18, margin: '6px 0 0', fontSize: 12, lineHeight: 1.6 }}>
                  <li><strong>Virtual Account:</strong> BCA, Mandiri, BRI, BNI, Permata, Danamon, CIMB</li>
                  <li><strong>QRIS Nasional:</strong> Dinamis &amp; Statis (BCA, GoPay, OVO, ShopeePay, DANA)</li>
                  <li><strong>E-Wallet:</strong> OVO, DANA, ShopeePay, LinkAja</li>
                  <li><strong>Retail / Gerai:</strong> Alfamart, Indomaret</li>
                  <li><strong>Kartu Kredit / Debit Online:</strong> Visa, MasterCard, JCB</li>
                </ul>
              }
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
