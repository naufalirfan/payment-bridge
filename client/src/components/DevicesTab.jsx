import React, { useState } from "react";
import { 
  Row, 
  Col, 
  Card, 
  Typography, 
  Tag, 
  Space, 
  Button, 
  Divider, 
  Modal, 
  Form, 
  Input, 
  message, 
  Popconfirm,
  Tooltip
} from "antd";
import { 
  MobileOutlined, 
  PlusOutlined, 
  KeyOutlined, 
  DeleteOutlined, 
  SendOutlined, 
  CopyOutlined,
  CheckCircleFilled,
  ClockCircleFilled
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function DevicesTab({ devices, onRefresh }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} berhasil disalin ke clipboard`);
  };

  const handleRegenerateKey = async (deviceId) => {
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/regenerate-key`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        message.success("Secret key berhasil diganti!");
        onRefresh();
      } else {
        message.error(json.error || "Gagal memperbarui key");
      }
    } catch (err) {
      message.error("Gagal memperbarui key: " + err.message);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        message.success("Device berhasil dihapus");
        onRefresh();
      } else {
        message.error(json.error || "Gagal menghapus device");
      }
    } catch (err) {
      message.error("Gagal menghapus device: " + err.message);
    }
  };

  const handlePingDevice = async (deviceId) => {
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/ping`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        message.success("Heartbeat ping device berhasil dikirim!");
        onRefresh();
      }
    } catch (err) {
      message.error("Gagal mengirim ping: " + err.message);
    }
  };

  const handleAddDevice = async (values) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      if (json.success) {
        message.success("Device baru berhasil didaftarkan!");
        form.resetFields();
        setModalOpen(false);
        onRefresh();
      } else {
        message.error(json.error || "Gagal mendaftarkan device");
      }
    } catch (err) {
      message.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--color-text-primary)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Device Gateway Android (Payhooks)
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Kelola smartphone Android yang menangkap notifikasi mutasi dari aplikasi perbankan
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Tambah Device Baru
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {(devices || []).map(device => {
          const isOnline = device.last_ping_at && (new Date().getTime() - new Date(device.last_ping_at).getTime() < 5 * 60 * 1000);
          return (
            <Col xs={24} lg={12} key={device.id}>
              <Card 
                className="card-elevated"
                title={
                  <Space>
                    <div style={{ background: "#EFF6FF", color: "#2563EB", padding: "4px 8px", borderRadius: 6 }}>
                      <MobileOutlined />
                    </div>
                    <Text strong style={{ fontSize: 15 }}>{device.name}</Text>
                  </Space>
                }
                extra={
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    background: isOnline ? "#ECFDF5" : "#FFFBEB", 
                    border: `1px solid ${isOnline ? "#A7F3D0" : "#FDE68A"}`,
                    borderRadius: 16, 
                    padding: "2px 10px", 
                    fontSize: 12,
                    fontWeight: 600,
                    color: isOnline ? "#065F46" : "#92400E"
                  }}>
                    <span className={`pulse-indicator ${isOnline ? "" : "offline"}`} />
                    {isOnline ? "ONLINE" : "IDLE"}
                  </div>
                }
              >
                <div style={{ marginBottom: 14 }}>
                  <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    Device ID
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    <span className="mono-code" style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: 13.5 }}>{device.id}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    Secret Key (Header X-Payhooks-Key)
                  </Text>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-surface-subtle)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-border)", marginTop: 4 }}>
                    <Text className="mono-code" style={{ fontSize: 12, wordBreak: "break-all", flex: 1, color: "#334155" }}>
                      {device.secret_key}
                    </Text>
                    <Tooltip title="Salin Secret Key">
                      <Button 
                        size="small" 
                        type="text" 
                        icon={<CopyOutlined style={{ color: "#64748B" }} />} 
                        onClick={() => copyToClipboard(device.secret_key, "Secret Key")} 
                      />
                    </Tooltip>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    Heartbeat Terakhir
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    <span className="tabular-num" style={{ fontSize: 13, color: "#475569" }}>
                      {device.last_ping_at ? new Date(device.last_ping_at).toLocaleString("id-ID") : "Belum pernah terhubung"}
                    </span>
                  </div>
                </div>

                <Divider style={{ margin: "16px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Button size="small" icon={<SendOutlined />} onClick={() => handlePingDevice(device.id)}>
                    Simulasi Ping Heartbeat
                  </Button>

                  <Space size={8}>
                    <Popconfirm
                      title="Regenerate Device Key?"
                      description="Koneksi aplikasi Payhooks Android lama akan terputus sampai Anda memasukkan key baru."
                      onConfirm={() => handleRegenerateKey(device.id)}
                      okText="Ya, Ganti"
                      cancelText="Batal"
                    >
                      <Button size="small" danger icon={<KeyOutlined />}>
                        Regenerate Key
                      </Button>
                    </Popconfirm>

                    <Popconfirm
                      title="Hapus Device ini?"
                      description="Device ini tidak dapat lagi mengirimkan notifikasi mutasi."
                      onConfirm={() => handleDeleteDevice(device.id)}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Integration Guide Card */}
      <Card title="Petunjuk Menghubungkan Payhooks Android" className="card-elevated">
        <Paragraph style={{ fontSize: 13.5, color: "#334155" }}>
          Ikuti 4 langkah mudah untuk mengaktifkan sinkronisasi otomatis dari HP Android:
        </Paragraph>
        <ol style={{ paddingLeft: 22, fontSize: 13, color: "#475569", lineHeight: 1.9 }}>
          <li>Download & pasang aplikasi <strong>Payhooks</strong> di smartphone Android kasir / gateway.</li>
          <li>Buka menu <strong>Settings &gt; Webhook Endpoint</strong> di aplikasi Payhooks.</li>
          <li>Masukkan URL Webhook: <code>POST http://&lt;IP_SERVER&gt;:3001/api/v1/callbacks/payhooks</code></li>
          <li>Masukkan Header Autentikasi: <code>X-Payhooks-Key: &lt;SECRET_KEY_DEVICE&gt;</code></li>
          <li>Aktifkan <strong>Notification Listener Permission</strong> untuk aplikasi perbankan (BCA Mobile, Livin Mandiri, BRImo, BSI BYOND, QRIS, DANA, GoPay).</li>
        </ol>
      </Card>

      {/* Modal Add Device */}
      <Modal
        title="Daftarkan Device Android Baru"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddDevice} style={{ marginTop: 16 }}>
          <Form.Item label="Device ID" name="id" rules={[{ required: true, message: "Device ID wajib diisi" }]}>
            <Input placeholder="Contoh: PH-AND-02" />
          </Form.Item>
          <Form.Item label="Nama Device" name="name" rules={[{ required: true, message: "Nama device wajib diisi" }]}>
            <Input placeholder="Contoh: Xiaomi Redmi Note 12 (Kasir Utama)" />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
            <Button onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Daftarkan Device</Button>
          </div>
        </Form>
      </Modal>
    </Space>
  );
}

