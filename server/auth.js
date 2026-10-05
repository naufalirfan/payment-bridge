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
    { id: user.id, username: user.username, role: user.role || "admin" },
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

// Auth Middleware for protected API endpoints
export function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Authentication required (Token missing)" });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token" });
  }

  req.user = decoded;
  next();
}
