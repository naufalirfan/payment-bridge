import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Tag, Button, Space, Typography, message, Empty } from 'antd';
import { SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function ManualMatchModal({ open, onClose, mutation, onMatched }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPendingInvoices();
    }
  }, [open]);

  const fetchPendingInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/invoices?status=PENDING');
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      }
    } catch (err) {
      message.error('Failed to load pending invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (invoiceId) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/mutations/match-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutation_id: mutation.id,
          invoice_id: invoiceId
        })
      });
      const json = await res.json();
      if (json.success) {
        message.success('Mutation manually matched and webhook dispatched!');
        if (onMatched) onMatched();
        onClose();
      } else {
        message.error(json.error || 'Failed to match');
      }
    } catch (err) {
      message.error('Matching failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase();
    return (
      inv.id.toLowerCase().includes(q) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
      inv.total_amount.toString().includes(q)
    );
  });

  const columns = [
    {
      title: 'Invoice ID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text strong className="mono-code">{id}</Text>
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (val, record) => {
        const isExact = mutation && Number(mutation.amount) === Number(val);
        return (
          <Space orientation="vertical" size={2}>
            <Text strong style={{ color: isExact ? '#237804' : '#0F172A' }}>
              Rp {Number(val).toLocaleString('id-ID')}
            </Text>
            {isExact && <Tag color="green" style={{ fontSize: 10 }}>Exact Match</Tag>}
          </Space>
        );
      }
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (dt) => new Date(dt).toLocaleString('id-ID')
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          loading={submitting}
          onClick={() => handleMatch(record.id)}
        >
          Match & Dispatch
        </Button>
      )
    }
  ];

  return (
    <Modal
      title="Manual Invoice Matching"
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
    >
      {mutation && (
        <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 6, marginBottom: 16, border: '1px solid #E2E8F0' }}>
          <Text secondary>Target Mutation:</Text>{' '}
          <Text strong style={{ color: '#237804', fontSize: 16, marginLeft: 8 }}>
            Rp {Number(mutation.amount).toLocaleString('id-ID')}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{mutation.app_title || mutation.package_name}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Received: {new Date(mutation.received_at).toLocaleString('id-ID')}
            </Text>
          </div>
        </div>
      )}

      <Input
        prefix={<SearchOutlined />}
        placeholder="Search invoice by ID, customer, or nominal..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />

      <Table
        dataSource={filteredInvoices}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: <Empty description="No pending invoices available" /> }}
      />
    </Modal>
  );
}
