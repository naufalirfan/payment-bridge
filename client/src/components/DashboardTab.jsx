import React from "react";
import { Row, Col, Card, Typography, Tag, Space, Button, Tooltip } from "antd";
import { 
  TransactionOutlined, 
  CheckCircleOutlined, 
  WalletOutlined, 
  MobileOutlined, 
  ThunderboltOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  SendOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function DashboardTab({ stats, loading, onRefresh, onOpenSimulator, onOpenCreateInvoice }) {
  const devices = stats?.devices || [];
  const primaryDevice = devices[0];

  const isDeviceOnline = primaryDevice && (
    new Date().getTime() - new Date(primaryDevice.last_ping_at).getTime() < 5 * 60 * 1000
  );

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Top Header & Fast Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--color-text-primary)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Financial Bridge Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: 13.5 }}>
            Monitoring sinkronisasi mutasi real-time, invoice matching, dan gateway status
          </Text>
        </div>
        <Space size={10}>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={onOpenSimulator}>
            Simulasi Mutasi Inbound
          </Button>
        </Space>
      </div>

      {/* 4 KPI Metrics Grid */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="card-elevated" loading={loading} bodyStyle={{ padding: 20 }}>
            <div className="stat-card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-card-title">Mutasi Hari Ini</span>
                <div style={{ background: "#EFF6FF", color: "#2563EB", padding: "6px 8px", borderRadius: 8 }}>
                  <TransactionOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div className="stat-card-value tabular-num">
                {stats?.today_mutations_count || 0}
                <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B", marginLeft: 6 }}>trx</span>
              </div>
              <div className="stat-card-sub">
                <span>Volume:</span>
                <strong className="tabular-num" style={{ color: "var(--color-text-primary)" }}>
                  Rp {Number(stats?.today_mutations_amount || 0).toLocaleString("id-ID")}
                </strong>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="card-elevated" loading={loading} bodyStyle={{ padding: 20 }}>
            <div className="stat-card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-card-title">Invoice Selesai</span>
                <div style={{ background: "#ECFDF5", color: "#059669", padding: "6px 8px", borderRadius: 8 }}>
                  <CheckCircleOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div className="stat-card-value tabular-num" style={{ color: "#059669" }}>
                {stats?.paid_invoices || 0}
                <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B", marginLeft: 6 }}>
                  / {stats?.total_invoices || 0}
                </span>
              </div>
              <div className="stat-card-sub">
                <Tag color="warning" style={{ margin: 0, padding: "0 6px", fontSize: 11 }}>
                  {stats?.pending_invoices || 0} Pending
                </Tag>
                <span>menunggu pembayaran</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="card-elevated" loading={loading} bodyStyle={{ padding: 20 }}>
            <div className="stat-card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-card-title">Akumulasi Revenue</span>
                <div style={{ background: "#F5F3FF", color: "#7C3AED", padding: "6px 8px", borderRadius: 8 }}>
                  <WalletOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div className="stat-card-value tabular-num" style={{ color: "#7C3AED", fontSize: 22 }}>
                Rp {Number(stats?.collected_revenue || 0).toLocaleString("id-ID")}
              </div>
              <div className="stat-card-sub">
                <span>Total tagihan lunas terverifikasi</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="card-elevated" loading={loading} bodyStyle={{ padding: 20 }}>
            <div className="stat-card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="stat-card-title">Primary Android Gateway</span>
                <div style={{ background: isDeviceOnline ? "#ECFDF5" : "#FFFBEB", color: isDeviceOnline ? "#059669" : "#D97706", padding: "6px 8px", borderRadius: 8 }}>
                  <MobileOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                <span className={`pulse-indicator ${isDeviceOnline ? "" : "offline"}`} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {primaryDevice?.id || "No Device"}
                </span>
                <Tag color={isDeviceOnline ? "success" : "warning"} style={{ marginLeft: 8 }}>
                  {isDeviceOnline ? "ONLINE" : "IDLE"}
                </Tag>
              </div>
              <div className="stat-card-sub" style={{ marginTop: 2 }}>
                <span>Ping:</span>
                <span className="tabular-num">
                  {primaryDevice?.last_ping_at 
                    ? new Date(primaryDevice.last_ping_at).toLocaleTimeString("id-ID") 
                    : "Belum terhubung"}
                </span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Integration Pipeline Card */}
      <Card 
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ApartmentOutlined style={{ color: "#2563EB" }} />
            <span>Arsitektur Alur Transaksi Payhooks Hybrid Bridge</span>
          </div>
        } 
        className="card-elevated"
      >
        <Row gutter={[20, 20]} align="stretch">
          <Col xs={24} md={7}>
            <div className="pipeline-node">
              <div className="pipeline-node-header">
                <span className="pipeline-node-title">
                  <MobileOutlined style={{ color: "#2563EB" }} />
                  1. Inbound Ingestion
                </span>
                <Tag color="blue">Fast Path</Tag>
              </div>
              <Paragraph className="pipeline-node-desc">
                Aplikasi <strong>Payhooks Android</strong> menangkap notifikasi push dari BCA, Mandiri, BRI, BSI, QRIS, DANA, dll. lalu mengirimkan payload ke <code>/api/v1/callbacks/payhooks</code>. Server membalas <code>200 OK</code> dalam &lt;150ms.
              </Paragraph>
            </div>
          </Col>

          <Col xs={24} md={1} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRightOutlined style={{ fontSize: 18, color: "#94A3B8" }} />
          </Col>

          <Col xs={24} md={8}>
            <div className="pipeline-node">
              <div className="pipeline-node-header">
                <span className="pipeline-node-title">
                  <SafetyCertificateOutlined style={{ color: "#10B981" }} />
                  2. Parser & Auto-Matcher
                </span>
                <Tag color="green">Deterministic</Tag>
              </div>
              <Paragraph className="pipeline-node-desc">
                Nominal transaksi diekstrak menggunakan parser regex perbankan dan dicocokkan otomatis dengan invoice berstatus <code>PENDING</code> (nominal pokok + kode unik). Status invoice langsung diubah menjadi <code>PAID</code>.
              </Paragraph>
            </div>
          </Col>

          <Col xs={24} md={1} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowRightOutlined style={{ fontSize: 18, color: "#94A3B8" }} />
          </Col>

          <Col xs={24} md={7}>
            <div className="pipeline-node">
              <div className="pipeline-node-header">
                <span className="pipeline-node-title">
                  <SendOutlined style={{ color: "#7C3AED" }} />
                  3. HMAC Signed Dispatcher
                </span>
                <Tag color="purple">Encrypted</Tag>
              </div>
              <Paragraph className="pipeline-node-desc">
                Worker dispatcher menandatangani payload dengan header <code>X-Bridge-Signature</code> (HMAC SHA-256) menggunakan secret key merchant Anda, lalu men-dispatch webhook notifikasi instan dengan exponential retry.
              </Paragraph>
            </div>
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

