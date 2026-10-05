import React, { useState } from 'react';
import { Modal, Form, Select, Input, Button, Alert, Typography, message, Space, Card, Tag } from 'antd';
import { PlayCircleOutlined, ThunderboltOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const PRESETS = [
  {
    label: 'QRIS Merchant - Pembayaran Diterima (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'id.dana',
    title: 'DANA Bisnis',
    text: 'Pembayaran QRIS dari Hendra Gunawan sebesar Rp 150.231 berhasil diterima ke saldo tokomu.'
  },
  {
    label: 'BCA Mobile - Transfer Masuk (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'com.bca',
    title: 'BCA Mobile',
    text: 'Transfer dr 1234567890 Rp 150.231 berhasil. Sisa saldo Rp 4.500.000'
  },
  {
    label: 'Mandiri Livin - Dana Masuk (Rp 250.412)',
    device_id: 'PH-AND-01',
    package_name: 'id.bmri.livin',
    title: "Livin' by Mandiri",
    text: 'Dana masuk Rp 250.412 dari BUDI SANTOSO berhasil diterima.'
  },
  {
    label: 'Bank BSI / BYOND - Transfer Masuk (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'com.bsi.byond',
    title: 'BYOND by BSI',
    text: 'Transfer masuk dari AHMAD FAUZI sebesar Rp 150.231 ke rekening 7123456789 berhasil.'
  },
  {
    label: 'SeaBank - Dana Diterima (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'com.seabank.id',
    title: 'SeaBank',
    text: 'Transfer Masuk Rp 150.231 dari RIANTO SUSANTO berhasil diterima.'
  },
  {
    label: 'Bank Jago - Uang Masuk (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'com.jago',
    title: 'Bank Jago',
    text: 'Uang Masuk Rp 150.231 dari SITI NURHALIZA masuk ke Kantong Utama kamu.'
  },
  {
    label: 'ShopeePay - Transfer Masuk (Rp 75.105)',
    device_id: 'PH-AND-01',
    package_name: 'com.shopeepay.id',
    title: 'ShopeePay',
    text: 'Kamu menerima transfer saldo sebesar Rp 75.105 dari Mega.'
  },
  {
    label: 'BRI BRImo - Transfer Masuk (Rp 150.231)',
    device_id: 'PH-AND-01',
    package_name: 'id.co.bri.brimo',
    title: 'BRImo',
    text: 'Transfer Masuk Rp 150.231 dari NOREK 0012398481 Berhasil'
  },
  {
    label: 'DANA - Isi Saldo (Rp 75.105)',
    device_id: 'PH-AND-01',
    package_name: 'id.dana',
    title: 'DANA',
    text: 'Isi Saldo Rp 75.105 dari BCA berhasil ditambahkan ke dompet DANA kamu'
  }
];

export default function SimulatorModal({ open, onClose, onSimulated }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const handleSelectPreset = (index) => {
    const preset = PRESETS[index];
    if (preset) {
      form.setFieldsValue({
        device_id: preset.device_id,
        package_name: preset.package_name,
        title: preset.title,
        text: preset.text
      });
    }
  };

  const handleSimulate = async (values) => {
    setLoading(true);
    setSimulationResult(null);
    try {
      const res = await fetch('/api/v1/simulate/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      if (json.success) {
        setSimulationResult(json);
        message.success('Simulasi notifikasi mutasi berhasil diproses!');
        if (onSimulated) onSimulated();
      } else {
        message.error(json.error || 'Simulation failed');
      }
    } catch (err) {
      message.error('Simulation request failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1677FF' }} />
          <span>Payhooks Inbound Mutation Simulator</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        setSimulationResult(null);
        onClose();
      }}
      footer={null}
      width={700}
    >
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Gunakan simulator ini untuk menguji ekstraksi regex nominal notifikasi bank/e-wallet Android dan pencocokan otomatis ke invoice pending.
      </Paragraph>

      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 6 }}>Pilih Template Preset Notifikasi:</Text>
        <Select 
          placeholder="Pilih contoh notifikasi bank..." 
          style={{ width: '100%' }}
          onChange={handleSelectPreset}
          defaultValue={0}
        >
          {PRESETS.map((p, idx) => (
            <Option key={idx} value={idx}>{p.label}</Option>
          ))}
        </Select>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSimulate}
        initialValues={PRESETS[0]}
      >
        <Form.Item label="Device ID" name="device_id" rules={[{ required: true }]}>
          <Input placeholder="PH-AND-01" />
        </Form.Item>

        <Form.Item label="Package Name Android" name="package_name" rules={[{ required: true }]}>
          <Input placeholder="com.bca" className="mono-code" />
        </Form.Item>

        <Form.Item label="Notification Title" name="title" rules={[{ required: true }]}>
          <Input placeholder="BCA Mobile" />
        </Form.Item>

        <Form.Item label="Raw Notification Text (SMS / Push Notif)" name="text" rules={[{ required: true }]}>
          <Input.TextArea rows={3} placeholder="Transfer dr 1234567890 Rp 150.231 berhasil" />
        </Form.Item>

        <Button 
          type="primary" 
          htmlType="submit" 
          icon={<PlayCircleOutlined />} 
          loading={loading}
          block
          style={{ height: 40, fontWeight: 600 }}
        >
          Kirim Simulasi Webhook Inbound
        </Button>
      </Form>

      {simulationResult && (
        <Card 
          size="small" 
          title="Hasil Ekstraksi & Matching Engine" 
          style={{ marginTop: 20, background: '#F8FAFC', borderColor: '#CBD5E1' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            <div>
              <Text strong>Nominal Terekstraksi:</Text>{' '}
              <Text strong style={{ color: '#237804', fontSize: 16, marginLeft: 8 }}>
                Rp {Number(simulationResult.parsed.amount).toLocaleString('id-ID')}
              </Text>{' '}
              <Tag color="cyan">{simulationResult.parsed.detectedBank}</Tag>
              {simulationResult.parsed.senderName && (
                <Tag color="purple">Pengirim: {simulationResult.parsed.senderName}</Tag>
              )}
            </div>

            <div>
              <Text strong>Status Pencocokan:</Text>{' '}
              {simulationResult.result.matched ? (
                <Tag color="green" icon={<CheckCircleFilled />}>
                  MATCHED DENGAN INVOICE ({simulationResult.result.invoice.id})
                </Tag>
              ) : (
                <Tag color="orange" icon={<CloseCircleFilled />}>
                  UNMATCHED (Tersimpan sebagai mutasi tanpa invoice)
                </Tag>
              )}
            </div>

            {simulationResult.result.matched && (
              <Alert
                type="success"
                showIcon
                message="Invoice Paid & Outbound Webhook Triggered!"
                description={`Invoice ${simulationResult.result.invoice.id} (${simulationResult.result.invoice.customer_name}) telah ditandai LUNAS dan webhook merchant telah ditembakkan dengan HMAC SHA-256 signature.`}
              />
            )}
          </Space>
        </Card>
      )}
    </Modal>
  );
}
