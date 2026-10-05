import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, message, Space, Typography, Alert, Radio, Card } from 'antd';
import { PlusCircleOutlined, MobileOutlined, CreditCardOutlined, LinkOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function CreateInvoiceModal({ open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [gateway, setGateway] = useState('MANUAL');
  const [baseAmount, setBaseAmount] = useState(150000);
  const [uniqueCode, setUniqueCode] = useState(Math.floor(100 + Math.random() * 899));
  const [createdInvoice, setCreatedInvoice] = useState(null);

  const handleFinish = async (values) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: values.customer_name,
          customer_email: values.customer_email,
          base_amount: values.base_amount,
          gateway: gateway,
          custom_unique_code: gateway === 'MANUAL' ? values.unique_code : 0,
          expiry_minutes: values.expiry_minutes || 1440
        })
      });
      const json = await res.json();
      if (json.success) {
        setCreatedInvoice(json.data);
        message.success(`Invoice ${json.data.id} berhasil dibuat!`);
        if (onCreated) onCreated();
      } else {
        message.error(json.error || 'Gagal membuat invoice');
      }
    } catch (err) {
      message.error('Gagal membuat invoice: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const total = gateway === 'MANUAL' 
    ? (Number(baseAmount) || 0) + (Number(uniqueCode) || 0) 
    : (Number(baseAmount) || 0);

  const handleModalClose = () => {
    setCreatedInvoice(null);
    form.resetFields();
    setUniqueCode(Math.floor(100 + Math.random() * 899));
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <PlusCircleOutlined style={{ color: '#1677FF' }} />
          <span>Buat Tagihan / Invoice Baru</span>
        </Space>
      }
      open={open}
      onCancel={handleModalClose}
      footer={null}
      width={560}
    >
      {createdInvoice ? (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Alert
            type="success"
            showIcon
            message={`Invoice Berhasil Dibuat: ${createdInvoice.id}`}
            description={
              <div>
                <p>Pelanggan: <strong>{createdInvoice.customer_name}</strong></p>
                <p>Total Tagihan: <strong>Rp {Number(createdInvoice.total_amount).toLocaleString('id-ID')}</strong></p>
                <p>Metode: <strong style={{ color: createdInvoice.payment_method === 'DOKU_CHECKOUT' ? '#E11D48' : '#1677FF' }}>{createdInvoice.payment_method}</strong></p>
              </div>
            }
          />

          {createdInvoice.payment_url && (
            <Card size="small" style={{ background: '#FDF2F8', borderColor: '#F472B6' }}>
              <Text strong style={{ display: 'block', marginBottom: 8, color: '#9D174D' }}>
                Link Pembayaran DOKU Checkout:
              </Text>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                href={createdInvoice.payment_url}
                target="_blank"
                block
                style={{ background: '#E11D48', borderColor: '#E11D48', height: 38 }}
              >
                Buka Halaman Pembayaran DOKU
              </Button>
            </Card>
          )}

          <Button type="primary" block onClick={handleModalClose}>
            Selesai
          </Button>
        </Space>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            customer_name: 'PT Mitra Digital',
            customer_email: 'buyer@example.com',
            base_amount: 150000,
            unique_code: uniqueCode,
            expiry_minutes: 1440
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Pilih Jalur Pembayaran (Payment Gateway):</Text>
            <Radio.Group 
              value={gateway} 
              onChange={(e) => setGateway(e.target.value)} 
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
            >
              <Radio.Button value="MANUAL" style={{ height: 'auto', padding: '10px 12px' }}>
                <Space direction="vertical" size={2}>
                  <Text strong><MobileOutlined style={{ color: '#1677FF' }} /> Payhooks Transfer</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>Kode Unik 3 Digit (Bank/E-Wallet)</Text>
                </Space>
              </Radio.Button>

              <Radio.Button value="DOKU" style={{ height: 'auto', padding: '10px 12px' }}>
                <Space direction="vertical" size={2}>
                  <Text strong><CreditCardOutlined style={{ color: '#E11D48' }} /> DOKU Gateway</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>VA Semua Bank, QRIS, CC, Alfa/Indo</Text>
                </Space>
              </Radio.Button>
            </Radio.Group>
          </div>

          <Form.Item
            label="Nama Pelanggan / Pembeli"
            name="customer_name"
            rules={[{ required: true, message: 'Nama pelanggan wajib diisi' }]}
          >
            <Input placeholder="Contoh: Budi Pratama / Toko Berkah" />
          </Form.Item>

          {gateway === 'DOKU' && (
            <Form.Item label="Email Pelanggan (Opsional)" name="customer_email">
              <Input placeholder="customer@example.com" />
            </Form.Item>
          )}

          <Form.Item
            label="Nominal Pokok Tagihan (Base Amount)"
            name="base_amount"
            rules={[{ required: true, message: 'Nominal tagihan wajib diisi' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1000}
              step={10000}
              formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => value.replace(/\Rp\s?|(\.*)/g, '')}
              onChange={(val) => setBaseAmount(val)}
            />
          </Form.Item>

          {gateway === 'MANUAL' && (
            <Form.Item
              label="Kode Unik Transfer (Anti-Collision Auto)"
              name="unique_code"
              rules={[{ required: true, message: 'Kode unik wajib diisi' }]}
              extra="Kode unik acak untuk mencocokkan mutasi masuk m-banking secara otomatis."
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={999}
                onChange={(val) => setUniqueCode(val)}
              />
            </Form.Item>
          )}

          <Alert
            type={gateway === 'DOKU' ? 'warning' : 'info'}
            showIcon
            style={{ marginBottom: 20 }}
            message={
              <div>
                <Text>Total Tagihan yang Harus Dibayar:</Text>{' '}
                <Text strong style={{ fontSize: 16, color: gateway === 'DOKU' ? '#E11D48' : '#1677FF', marginLeft: 6 }}>
                  Rp {total.toLocaleString('id-ID')}
                </Text>
              </div>
            }
          />

          <Form.Item label="Masa Berlaku Invoice (Menit)" name="expiry_minutes">
            <InputNumber style={{ width: '100%' }} min={10} max={10080} />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={handleModalClose}>Batal</Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting} 
              icon={<PlusCircleOutlined />}
              style={gateway === 'DOKU' ? { background: '#E11D48', borderColor: '#E11D48' } : {}}
            >
              {gateway === 'DOKU' ? 'Buat Invoice & Link DOKU' : 'Buat Invoice Payhooks'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
