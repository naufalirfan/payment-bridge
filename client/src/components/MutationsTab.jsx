import React, { useState } from "react";
import { Card, Table, Tag, Button, Space, Typography, Input, Tooltip, Empty, Segmented } from "antd";
import { 
  ReloadOutlined, 
  SearchOutlined, 
  CodeOutlined, 
  LinkOutlined, 
  ThunderboltOutlined,
  DownloadOutlined,
  UserOutlined,
  CheckCircleFilled,
  ClockCircleFilled
} from "@ant-design/icons";

const { Text } = Typography;

export default function MutationsTab({ 
  mutations, 
  loading, 
  onRefresh, 
  onOpenRawDrawer, 
  onOpenManualMatch,
  onOpenSimulator 
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredMutations = (mutations || []).filter(item => {
    if (statusFilter === "MATCHED" && !item.matched_invoice_id) return false;
    if (statusFilter === "UNMATCHED" && item.matched_invoice_id) return false;

    const q = search.toLowerCase();
    if (!q) return true;

    return (
      (item.app_title && item.app_title.toLowerCase().includes(q)) ||
      (item.package_name && item.package_name.toLowerCase().includes(q)) ||
      (item.sender_name && item.sender_name.toLowerCase().includes(q)) ||
      (item.raw_payload && item.raw_payload.toLowerCase().includes(q)) ||
      (item.matched_invoice_id && item.matched_invoice_id.toLowerCase().includes(q)) ||
      item.amount.toString().includes(q)
    );
  });

  const handleExportCSV = () => {
    window.open("/api/v1/export/mutations", "_blank");
  };

  const getBankBadge = (title, pkg) => {
    const name = (title || pkg || "").toLowerCase();
    if (name.includes("bca")) return { color: "#1D4ED8", label: "BCA Mobile" };
    if (name.includes("mandiri") || name.includes("bmri") || name.includes("livin")) return { color: "#D97706", label: "Livin Mandiri" };
    if (name.includes("bri") || name.includes("brimo")) return { color: "#0284C7", label: "BRImo" };
    if (name.includes("bsi") || name.includes("byond")) return { color: "#0D9488", label: "BSI BYOND" };
    if (name.includes("qris")) return { color: "#BE185D", label: "QRIS Inbound" };
    if (name.includes("dana")) return { color: "#2563EB", label: "DANA" };
    if (name.includes("gopay")) return { color: "#059669", label: "GoPay" };
    if (name.includes("ovo")) return { color: "#7C3AED", label: "OVO" };
    if (name.includes("shopee")) return { color: "#EA580C", label: "ShopeePay" };
    return { color: "#475569", label: title || pkg || "Bank Notification" };
  };

  const columns = [
    {
      title: "Waktu Masuk",
      dataIndex: "received_at",
      key: "received_at",
      width: 160,
      render: (val) => (
        <span className="mono-code" style={{ color: "#475569", fontSize: 12 }}>
          {new Date(val).toLocaleString("id-ID")}
        </span>
      )
    },
    {
      title: "Bank / E-Wallet",
      dataIndex: "app_title",
      key: "app_title",
      width: 150,
      render: (title, record) => {
        const badge = getBankBadge(title, record.package_name);
        return (
          <Space direction="vertical" size={2}>
            <span style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              fontSize: 11.5, 
              fontWeight: 600, 
              color: badge.color, 
              background: "var(--color-surface-subtle)", 
              border: "1px solid var(--color-border)", 
              borderRadius: 6, 
              padding: "2px 8px" 
            }}>
              {badge.label}
            </span>
            <span className="mono-code" style={{ fontSize: 11, color: "#94A3B8" }}>
              {record.device_id || "PH-AND-01"}
            </span>
          </Space>
        );
      }
    },
    {
      title: "Pengirim & Raw Notifikasi",
      dataIndex: "raw_payload",
      key: "raw_payload",
      width: 240,
      render: (payloadStr, record) => {
        let text = payloadStr;
        try {
          const parsed = typeof payloadStr === "string" ? JSON.parse(payloadStr) : payloadStr;
          text = parsed.text || parsed.title || payloadStr;
        } catch (e) {
          text = payloadStr;
        }
        return (
          <Space direction="vertical" size={2} style={{ maxWidth: 280 }}>
            {record.sender_name && (
              <Tag icon={<UserOutlined />} color="purple" style={{ margin: 0, fontSize: 11 }}>
                {record.sender_name}
              </Tag>
            )}
            <Text ellipsis={{ tooltip: text }} style={{ fontSize: 12, color: "#334155" }}>
              {text}
            </Text>
          </Space>
        );
      }
    },
    {
      title: "Nominal Mutasi",
      dataIndex: "amount",
      key: "amount",
      width: 150,
      align: "right",
      render: (val) => (
        <span className="amount-credit" style={{ fontSize: 13.5 }}>
          + Rp {Number(val).toLocaleString("id-ID")}
        </span>
      )
    },
    {
      title: "Status Match",
      dataIndex: "matched_invoice_id",
      key: "matched_invoice_id",
      width: 150,
      render: (invoiceId) => {
        if (invoiceId) {
          return (
            <Tooltip title={`Tercocokkan ke Invoice: ${invoiceId}`}>
              <Space direction="vertical" size={1}>
                <Tag icon={<CheckCircleFilled />} color="success">MATCHED</Tag>
                <span className="mono-code" style={{ fontSize: 11, color: "#64748B" }}>
                  {invoiceId}
                </span>
              </Space>
            </Tooltip>
          );
        }
        return <Tag icon={<ClockCircleFilled />} color="warning">UNMATCHED</Tag>;
      }
    },
    {
      title: "Aksi",
      key: "action",
      width: 140,
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="Lihat Raw JSON Payload">
            <Button 
              size="small" 
              icon={<CodeOutlined />}
              onClick={() => onOpenRawDrawer(record)}
            >
              JSON
            </Button>
          </Tooltip>
          {!record.matched_invoice_id && (
            <Tooltip title="Cocokkan Manual ke Invoice">
              <Button 
                type="primary" 
                size="small" 
                icon={<LinkOutlined />}
                onClick={() => onOpenManualMatch(record)}
              >
                Match
              </Button>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card className="card-elevated">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, width: "100%", maxWidth: 740 }}>
          <Input 
            prefix={<SearchOutlined style={{ color: "#94A3B8" }} />} 
            placeholder="Cari mutasi, pengirim, nominal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
            allowClear
          />
          <Segmented
            options={[
              { label: "Semua", value: "ALL" },
              { label: "Matched", value: "MATCHED" },
              { label: "Unmatched", value: "UNMATCHED" }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            CSV
          </Button>
        </div>

        <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={onOpenSimulator}>
          Simulasikan Mutasi
        </Button>
      </div>

      <Table
        dataSource={filteredMutations}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 10, showSizeChanger: true, responsive: true }}
        locale={{
          emptyText: (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada notifikasi mutasi masuk dari Android Payhooks." 
            >
              <Button type="primary" size="small" onClick={onOpenSimulator}>
                Kirim Mutasi Simulasi Sekarang
              </Button>
            </Empty>
          )
        }}
      />
    </Card>
  );
}
