import React from 'react';
import { Drawer, Descriptions, Tag, Typography, Button, Space, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function RawPayloadDrawer({ open, onClose, mutation }) {
  if (!mutation) return null;

  let parsedPayload = {};
  try {
    parsedPayload = typeof mutation.raw_payload === 'string' 
      ? JSON.parse(mutation.raw_payload) 
      : mutation.raw_payload;
  } catch (e) {
    parsedPayload = { error: 'Failed to parse JSON', raw: mutation.raw_payload };
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  return (
    <Drawer
      title="Raw Payhooks Payload Inspection"
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      extra={
        <Button 
          icon={<CopyOutlined />} 
          size="small"
          onClick={() => copyToClipboard(JSON.stringify(parsedPayload, null, 2))}
        >
          Copy JSON
        </Button>
      }
    >
      <Descriptions column={1} bordered size="small" style={{ marginBottom: 20 }}>
        <Descriptions.Item label="Mutation ID">
          <Text copyable className="mono-code">{mutation.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Device ID">
          <Tag color="blue">{mutation.device_id || 'PH-AND-01'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Source App">
          <Text strong>{mutation.app_title || mutation.package_name || 'N/A'}</Text>
          <div className="mono-code" style={{ fontSize: 11, color: '#64748B' }}>
            {mutation.package_name}
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="Extracted Amount">
          <Text strong style={{ color: '#237804', fontSize: 16 }}>
            Rp {Number(mutation.amount).toLocaleString('id-ID')}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Received Timestamp">
          {new Date(mutation.received_at).toLocaleString('id-ID')}
        </Descriptions.Item>
        <Descriptions.Item label="Matching Status">
          {mutation.matched_invoice_id ? (
            <Tag color="green">MATCHED ({mutation.matched_invoice_id})</Tag>
          ) : (
            <Tag color="orange">UNMATCHED</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Raw Inbound JSON (from Payhooks Android Client):
      </Text>
      <div className="raw-json-viewer">
        <pre style={{ margin: 0 }}>{JSON.stringify(parsedPayload, null, 2)}</pre>
      </div>
    </Drawer>
  );
}
