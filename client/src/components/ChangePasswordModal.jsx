import React, { useState } from "react";
import { Modal, Form, Input, Button, message, Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";

export default function ChangePasswordModal({ open, onClose, token }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      setErrorMsg("Konfirmasi password baru tidak cocok.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        message.success("Password berhasil diperbarui!");
        form.resetFields();
        onClose();
      } else {
        setErrorMsg(data.error || "Gagal mengubah password.");
      }
    } catch (err) {
      setErrorMsg("Koneksi gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Ubah Password Admin"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {errorMsg && <Alert type="error" message={errorMsg} showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Password Saat Ini"
          name="currentPassword"
          rules={[{ required: true, message: "Masukkan password saat ini" }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Password lama" />
        </Form.Item>

        <Form.Item
          label="Password Baru"
          name="newPassword"
          rules={[{ required: true, min: 6, message: "Minimal 6 karakter" }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Password baru" />
        </Form.Item>

        <Form.Item
          label="Konfirmasi Password Baru"
          name="confirmPassword"
          rules={[{ required: true, message: "Konfirmasi password baru" }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Ulangi password baru" />
        </Form.Item>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Simpan Password
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
