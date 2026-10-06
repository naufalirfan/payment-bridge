import React, { useState } from "react";
import { 
  Card, 
  Row, 
  Col, 
  Button, 
  Typography, 
  Tag, 
  Space, 
  Modal, 
  message, 
  Alert, 
  Divider,
  Tooltip
} from "antd";
import { 
  CheckOutlined, 
  StarFilled, 
  CrownFilled, 
  ThunderboltOutlined, 
  CreditCardOutlined,
  CopyOutlined,
  QrcodeOutlined,
  ArrowRightOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function SubscriptionTab({ user, onRefreshProfile }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const handleSubscribe = async (planKey) => {
    setLoadingPlan(planKey);
    try {
      const token = localStorage.getItem("pb_token") || "";
      const res = await fetch("/api/v1/merchant/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ plan: planKey })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat tagihan langganan");
      }

      setCheckoutInvoice({
        ...data.data.invoice,
        paymentUrl: data.data.paymentUrl || data.data.invoice?.payment_url,
        plan: data.data.plan
      });
      message.success("Tagihan untuk " + (data.data.plan?.name || planKey) + " berhasil dibuat!");

      // If DOKU paymentUrl exists, open immediately
      if (data.data.paymentUrl) {
        window.open(data.data.paymentUrl, '_blank');
      }
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSimulatePayment = async (inv) => {
    if (!inv) return;
    setSimulating(true);
    try {
      const token = localStorage.getItem("pb_token") || "";
      const res = await fetch("/api/v1/simulate/notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          amount: inv.total_amount,
          sender: "PAYMENT-BRIDGE-SUBSCRIBE",
          bank: "BCA",
          description: "Transfer Langganan " + inv.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulasi gagal");

      message.success("✅ Pembayaran berhasil diverifikasi! Akun otomatis di-upgrade.");
      setCheckoutInvoice(null);
      if (onRefreshProfile) onRefreshProfile();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const copyText = (val, label) => {
    navigator.clipboard.writeText(val);
    message.success(label + " disalin ke clipboard!");
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Current Plan Overview */}
      <Card className="card-elevated" style={{ background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(30, 41, 59, 0) 100%)" }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} sm={16}>
            <Space orientation="vertical" size={4}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CrownFilled style={{ color: "#F59E0B", fontSize: 20 }} />
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                  Paket Langganan Aktif: <span style={{ color: "#2563EB" }}>{user?.plan || "FREE"}</span>
                </Title>
              </div>
              <Text type="secondary">
                Kuota Pemakaian: <strong>{user?.quota_used || 0}</strong> / {user?.quota === 999999 ? "Unlimited" : (user?.quota || 100)} Invoices per bulan
              </Text>
            </Space>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: "right" }}>
            <Tag color={user?.plan === "ENTERPRISE" ? "purple" : user?.plan === "PRO" ? "blue" : "default"} style={{ fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>
              Status: ACTIVE
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* Pricing Cards */}
      <Row gutter={[20, 20]} align="stretch">
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
        title={
          <Space>
            <CreditCardOutlined style={{ color: "#E11D48" }} />
            <span>Pembayaran Tagihan Langganan</span>
          </Space>
        }
        open={!!checkoutInvoice}
        onCancel={() => setCheckoutInvoice(null)}
        width={560}
        footer={[
          <Button 
            key="simulate" 
            type="primary" 
            ghost 
            icon={<ThunderboltOutlined />} 
            loading={simulating}
            onClick={() => handleSimulatePayment(checkoutInvoice)}
          >
            ⚡ Konfirmasi Instan (Demo)
          </Button>,
          <Button key="close" type="primary" onClick={() => { setCheckoutInvoice(null); if (onRefreshProfile) onRefreshProfile(); }}>
            Selesai / Refresh
          </Button>
        ]}
      >
        {checkoutInvoice && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Nomor Tagihan: <strong className="mono-code">{checkoutInvoice.id}</strong>
              </Text>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#2563EB", margin: "6px 0" }}>
                Rp {Number(checkoutInvoice.base_amount || checkoutInvoice.total_amount).toLocaleString("id-ID")}
              </div>
              <Tag color="blue">{checkoutInvoice.customer_name || 'Tagihan Langganan'}</Tag>
            </div>

            {/* DOKU Online Payment Option */}
            {checkoutInvoice.paymentUrl ? (
              <Card 
                style={{ 
                  background: "linear-gradient(135deg, rgba(225, 29, 72, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)",
                  border: "1px solid #E11D48",
                  marginBottom: 16,
                  borderRadius: 12
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Tag color="#E11D48" style={{ fontWeight: 700 }}>DOKU GATEWAY</Tag>
                      <Text strong>QRIS, VA Bank & E-Wallet</Text>
                    </div>
                    <Tag color="green">OTOMATIS AKTIF</Tag>
                  </div>

                  <Paragraph style={{ fontSize: 12, margin: 0, color: "var(--color-text-secondary)" }}>
                    Bayar langsung menggunakan DOKU Payment Gateway resmi (BCA, Mandiri, BRI, BNI VA, QRIS All Payment, GoPay, ShopeePay, DANA, Kartu Kredit).
                  </Paragraph>

                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<ArrowRightOutlined />}
                    style={{ background: "#E11D48", borderColor: "#E11D48", height: 44, fontWeight: 700 }}
                    onClick={() => window.open(checkoutInvoice.paymentUrl, '_blank')}
                    block
                  >
                    Buka Halaman Pembayaran DOKU 🚀
                  </Button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Text type="secondary" style={{ fontSize: 11, flex: 1, wordBreak: 'break-all' }}>
                      URL: {checkoutInvoice.paymentUrl}
                    </Text>
                    <Button 
                      size="small" 
                      icon={<CopyOutlined />} 
                      onClick={() => copyText(checkoutInvoice.paymentUrl, 'Link Checkout DOKU')}
                    >
                      Salin Link
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            <Alert 
              type="info" 
              showIcon 
              message="Aktivasi Otomatis & Instan" 
              description="Setelah pembayaran Anda selesai di DOKU atau transfer rekening, webhook DOKU akan langsung meng-upgrade kuota dan fitur akun Anda dalam hitungan detik." 
            />
          </div>
        )}
      </Modal>
    </Space>
  );
}
