import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "pb_jwt_secret_fintech_2026_bridge";
const SALT = "pb_salt_2026";

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role || "merchant",
      plan: user.plan || "STARTER"
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Auth Middleware for Web Dashboard
export function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Otorisasi dibutuhkan (Token JWT hilang)" });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali." });
  }

  req.user = decoded;
  next();
}

// API Key Middleware for External Merchant REST API Integration
export async function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers["x-merchant-key"] || req.headers["x-api-key"];
  const apiSecret = req.headers["x-merchant-secret"] || req.headers["x-api-secret"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "X-Merchant-Key header is required for external API requests."
    });
  }

  const merchant = await db.get("SELECT * FROM users WHERE api_key = ?", [apiKey]);
  if (!merchant) {
    return res.status(401).json({
      success: false,
      error: "Invalid X-Merchant-Key. Merchant not found."
    });
  }

  if (apiSecret && merchant.api_secret && merchant.api_secret !== apiSecret) {
    return res.status(401).json({
      success: false,
      error: "Invalid X-Merchant-Secret."
    });
  }

  req.merchant = merchant;
  req.user = { id: merchant.id, username: merchant.username, role: merchant.role, plan: merchant.plan };
  next();
}
