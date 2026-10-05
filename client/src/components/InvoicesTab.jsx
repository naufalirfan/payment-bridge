import React, { useState } from "react";
import { Card, Table, Tag, Button, Space, Typography, Input, Empty, Tooltip, Segmented, message } from "antd";
import { 
  PlusOutlined, 
  ReloadOutlined, 
  SearchOutlined, 
  CheckCircleFilled, 
  ClockCircleFilled, 
  CloseCircleFilled,
  DownloadOutlined,
  LinkOutlined,
  CreditCardOutlined,
  MobileOutlined,
  CopyOutlined
} from "@ant-design/icons";

const { Text } = Typography;

export default function InvoicesTab({ invoices, loading, onRefresh, onOpenCreateModal }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} berhasil disalin ke clipboard`);
  };

  const filteredInvoices = (invoices || []).filter(inv => {
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = 
      inv.id.toLowerCase().includes(q) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
      (inv.payment_method && inv.payment_method.toLowerCase().includes(q)) ||
      inv.total_amount.toString().includes(q);

    return matchStatus && matchSearch;
  });

  const handleExportCSV = () => {
    window.open("/api/v1/export/invoices", "_blank");
  };

  const columns = [
    {
      title: "Invoice ID / Channel",
      dataIndex: "id",
      key: "id",
      width: 220,
      render: (id, record) => (
        <Space direction="vertical" size={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="mono-code" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{id}</span>
            <Tooltip title="Salin Invoice ID">
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined style={{ fontSize: 11, color: "#94A3B8" }} />} 
                onClick={() => copyToClipboard(id, "Invoice ID")} 
                style={{ width: 20, height: 20 }}
              />
            </Tooltip>
          </div>
          {record.payment_method === "DOKU_CHECKOUT" ? (
            <Tag color="magenta" icon={<CreditCardOutlined />} style={{ margin: 0, fontSize: 11 }}>
              DOKU Gateway
            </Tag>
          ) : (
            <Tag color="blue" icon={<MobileOutlined />} style={{ margin: 0, fontSize: 11 }}>
              Payhooks Transfer
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: "Pelanggan",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (name, record) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: "var(--color-text-primary)", fontSize: 13.5 }}>{name || "Walk-in Customer"}</Text>
          {record.customer_email && (
            <Text type="secondary" style={{ fontSize: 11.5 }}>{record.customer_email}</Text>
          )}
        </Space>
      )
    },
    {
      title: "Nominal Pokok",
      dataIndex: "base_amount",
      key: "base_amount",
      align: "right",
      width: 140,
      render: (val) => (
        <span className="tabular-num" style={{ color: "#475569" }}>
          Rp {Number(val).toLocaleString("id-ID")}
        </span>
      )
    },
    {
      title: "Kode Unik",
      dataIndex: "unique_code",
      key: "unique_code",
      align: "center",
      width: 100,
      render: (val, record) => {
        if (record.payment_method === "DOKU_CHECKOUT") {
          return <span style={{ color: "#CBD5E1" }}>—</span>;
        }
        return <Tag color="cyan" className="mono-code" style={{ margin: 0 }}>+{val}</Tag>;
      }
    },
    {
      title: "Total Tagihan",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right",
      width: 150,
      render: (val) => (
        <span className="tabular-num" style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: 14 }}>
          Rp {Number(val).toLocaleString("id-ID")}
        </span>
      )
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 120,
      render: (status) => {
        if (status === "PAID") {
          return <Tag icon={<CheckCircleFilled />} color="success">PAID</Tag>;
        }
        if (status === "PENDING") {
          return <Tag icon={<ClockCircleFilled />} color="warning">PENDING</Tag>;
        }
        return <Tag icon={<CloseCircleFilled />} color="error">EXPIRED</Tag>;
      }
    },
    {
      title: "Payment Link / Dibuat",
      key: "action",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {record.payment_url && record.status === "PENDING" && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<LinkOutlined />}
              href={record.payment_url}
              target="_blank"
              style={{ fontSize: 12, height: 26, borderColor: "#E11D48", color: "#E11D48" }}
            >
              Bayar DOKU
            </Button>
          )}
          <span className="mono-code" style={{ fontSize: 11.5, color: "#64748B" }}>
            {new Date(record.created_at).toLocaleString("id-ID")}
          </span>
        </Space>
      )
    }
  ];

  return (
    <Card className="card-elevated">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <Space wrap size={10}>
          <Input 
            prefix={<SearchOutlined style={{ color: "#94A3B8" }} />} 
            placeholder="Cari invoice, customer, nominal..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Segmented
            options={[
              { label: "Semua", value: "ALL" },
              { label: "Pending", value: "PENDING" },
              { label: "Paid", value: "PAID" },
              { label: "Expired", value: "EXPIRED" }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </Space>

        <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreateModal}>
          Buat Invoice Baru
        </Button>
      </div>

      <Table
        dataSource={filteredInvoices}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Tidak ada data invoice yang sesuai" 
            >
              <Button type="primary" size="small" onClick={onOpenCreateModal}>
                Buat Invoice Sekarang
              </Button>
            </Empty>
          )
        }}
      />
    </Card>
  );
}

