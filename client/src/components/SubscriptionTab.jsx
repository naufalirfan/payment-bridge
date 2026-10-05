import React, { useState } from "react";
import { Card, Typography, Row, Col, Button, Tag, Space, Progress, Modal, message } from "antd";
import { 
  CheckOutlined, 
  CrownOutlined, 
  RocketOutlined, 
  ThunderboltOutlined,
  QrcodeOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
  StarFilled
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function SubscriptionTab({ user, token, onRefreshProfile }) {
  const [loadingPlan, setLoadingPlan] = useState("");
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);

  const planName = user?.plan || "PRO_TRIAL";
  const usedQuota = user?.used_quota || 0;
  const totalQuota = user?.invoice_quota || 500;
  const quotaPercent = Math.min(100, Math.round((usedQuota / totalQuota) * 100));

  const handleSubscribe = async (targetPlan) => {
    setLoadingPlan(targetPlan);
    try {
      const res = await fetch("/api/v1/merchant/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ plan: targetPlan })
      });
      const data = await res.json();
      if (data.success && data.data?.invoice) {
        setCheckoutInvoice(data.data.invoice);
      } else {
        message.error(data.error || "Gagal membuat invoice langganan");
      }
    } catch (err) {
      message.error("Koneksi gagal: " + err.message);
    } finally {
      setLoadingPlan("");
    }
  };

  return (
    <Space direction="vertical" size={28} style={{ width: "100%" }}>
      {/* Header & Current Plan Status */}
      <Card className="card-elevated" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(30,64,175,0.02) 100%)", border: "1px solid rgba(37,99,235,0.2)" }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={14}>
            <Space align="center" size={12}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#2563EB", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                <CrownOutlined />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                    Paket Aktif: {planName.replace("_", " ")}
                  </Title>
                  <Tag color={planName === "ENTERPRISE" ? "purple" : planName === "PRO" ? "blue" : "green"}>
                    {planName}
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Masa aktif hingga: {user?.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Tidak terbatas"}
                </Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={10}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                <span style={{ fontWeight: 600 }}>Penggunaan Kuota Invoice Bulan Ini:</span>
                <span className="mono-code" style={{ fontWeight: 700 }}>{usedQuota} / {totalQuota}</span>
              </div>
              <Progress percent={quotaPercent} strokeColor="#2563EB" status={quotaPercent >= 90 ? "exception" : "active"} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Pricing Tier Grid */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <Title level={3} style={{ margin: "0 0 6px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Pilihan Paket Langganan Merchant
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Pilih paket yang sesuai dengan skala volume transaksi toko atau aplikasi Anda
        </Text>
      </div>

      <Row gutter={[24, 24]} align="stretch">
        {/* Starter Plan */}
        <Col xs={24} md={8}>
          <Card className="card-elevated" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Starter</Title>
                <Tag color="default">Pemula</Tag>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>Rp 49.000</span>
                <Text type="secondary"> / bulan</Text>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 13 }}>
                Cocok untuk toko online pemula atau bisnis personal yang baru memulai otomatisasi transfer.
              </Paragraph>
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginBottom: 24 }}>
                <Space direction="vertical" size={10} style={{ width: "100%", fontSize: 13 }}>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> <strong>1 Smartphone Android</strong> Terhubung</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Kuota <strong>500 Invoice / bulan</strong></div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Parsing Multi-Bank & QRIS</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Webhook HMAC Signed Notif</div>
                </Space>
              </div>
            </div>
            <Button block size="large" onClick={() => handleSubscribe("STARTER")} loading={loadingPlan === "STARTER"}>
              Pilih Paket Starter
            </Button>
          </Card>
        </Col>

        {/* Pro Plan (Featured) */}
        <Col xs={24} md={8}>
          <Card 
            className="card-elevated" 
            style={{ 
              height: "100%", 
              display: "flex", 
              flexDirection: "column", 
              justifyContent: "space-between",
              border: "2px solid #2563EB",
              position: "relative"
            }}
          >
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}>
              <Tag color="#2563EB" style={{ padding: "2px 12px", borderRadius: 12, fontWeight: 700 }}>
                <StarFilled style={{ marginRight: 4 }} /> PALING POPULER
              </Tag>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 4 }}>
                <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#2563EB" }}>Pro</Title>
                <Tag color="blue">Tumbuh Cepat</Tag>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#2563EB" }}>Rp 149.000</span>
                <Text type="secondary"> / bulan</Text>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 13 }}>
                Pilihan utama toko online & platform SaaS dengan volume transaksi harian yang stabil.
              </Paragraph>
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginBottom: 24 }}>
                <Space direction="vertical" size={10} style={{ width: "100%", fontSize: 13 }}>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> <strong>3 Smartphone Android</strong> Terhubung</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Kuota <strong>5.000 Invoice / bulan</strong></div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> <strong>DOKU Payment Gateway</strong> Support</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Ekspor Laporan Keuangan CSV</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Support Prioritas WhatsApp</div>
                </Space>
              </div>
            </div>
            <Button type="primary" block size="large" onClick={() => handleSubscribe("PRO")} loading={loadingPlan === "PRO"}>
              Upgrade ke Pro
            </Button>
          </Card>
        </Col>

        {/* Enterprise Plan */}
        <Col xs={24} md={8}>
          <Card className="card-elevated" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Enterprise</Title>
                <Tag color="purple">Unlimited</Tag>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>Rp 349.000</span>
                <Text type="secondary"> / bulan</Text>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 13 }}>
                Untuk perusahaan, agensi skala besar, atau merchant dengan volume transaksi tanpa batas.
              </Paragraph>
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginBottom: 24 }}>
                <Space direction="vertical" size={10} style={{ width: "100%", fontSize: 13 }}>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> <strong>Unlimited Device Android</strong></div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> <strong>Unlimited Invoices</strong></div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> High Availability Edge Routing</div>
                  <div><CheckOutlined style={{ color: "#10B981", marginRight: 8 }} /> Dedicated SLA & Bantuan Integrasi</div>
                </Space>
              </div>
            </div>
            <Button block size="large" onClick={() => handleSubscribe("ENTERPRISE")} loading={loadingPlan === "ENTERPRISE"}>
              Pilih Enterprise
            </Button>
          </Card>
        </Col>
      </Row>

      {/* Checkout Modal */}
      <Modal
        title="Pembayaran Tagihan Langganan"
        open={!!checkoutInvoice}
        onCancel={() => setCheckoutInvoice(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => { setCheckoutInvoice(null); if (onRefreshProfile) onRefreshProfile(); }}>
            Saya Sudah Transfer
          </Button>
        ]}
      >
        {checkoutInvoice && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <Text type="secondary">Nomor Tagihan: <strong className="mono-code">{checkoutInvoice.id}</strong></Text>
            <div style={{ margin: "20px 0" }}>
              <div style={{ fontSize: 13, color: "#64748B" }}>Total yang Harus Ditransfer (Tepat Termasuk Kode Unik):</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#2563EB", margin: "8px 0" }}>
                Rp {Number(checkoutInvoice.total_amount).toLocaleString("id-ID")}
              </div>
              <Tag color="warning" style={{ fontSize: 12, padding: "4px 8px" }}>
                Kode Unik: {checkoutInvoice.unique_code}
              </Tag>
            </div>
            <Alert 
              type="info" 
              showIcon 
              message="Otomatis Aktif Detik Ini Juga" 
              description="Transfer nominal di atas ke rekening BCA/Mandiri/QRIS Payment Bridge. Sistem akan mendeteksi mutasi dan langsung meng-upgrade akun Anda secara instan." 
            />
          </div>
        )}
      </Modal>
    </Space>
  );
}