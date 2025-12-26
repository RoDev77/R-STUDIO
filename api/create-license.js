// create-license.js
import { getFirestore, getAuth } from "./lib/firebase.js";

/* ================= UTIL ================= */
function generateLicenseId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return "RSTUDIO_" + result;
}

export default async function handler(req, res) {
  /* ================= CORS ================= */
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    /* ================= AUTH ================= */
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(
      authHeader.replace("Bearer ", "")
    );

    const db = getFirestore();

    /* ================= USER ROLE ================= */
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ error: "User not registered" });
    }

    const user = userSnap.data();

    let userRole = "member";
    if (user.role === "owner") userRole = "owner";
    else if (user.role === "admin") userRole = "admin";
    else if (user.isVIP === true) userRole = "vip";

    /* ================= PAYLOAD ================= */
    const { gameId, placeId, mapName, duration } = req.body;

    if (!gameId || !placeId || !mapName || !mapName.trim()) {
      return res.status(400).json({ error: "Missing fields" });
    }

    /* ================= RULES ================= */
    let maxLicense = 2;
    let maxDays = 30;
    let allowUnlimited = false;

    if (userRole === "vip") {
      maxLicense = 5;
      maxDays = null;
      allowUnlimited = true;
    } else if (userRole === "admin" || userRole === "owner") {
      maxLicense = Infinity;
      maxDays = null;
      allowUnlimited = true;
    }

    /* ================= ACTIVE LICENSE CHECK ================= */
    const now = Date.now();

    const snap = await db
      .collection("licenses")
      .where("createdBy", "==", decoded.uid)
      .where("revoked", "==", false)
      .get();

    const activeCount = snap.docs.filter(d => {
      const l = d.data();
      if (l.expiresAt === null) return true;
      return l.expiresAt > now;
    }).length;

    if (activeCount >= maxLicense) {
      return res.status(403).json({
        error: "LICENSE_LIMIT",
        max: maxLicense,
        active: activeCount,
      });
    }

    /* ================= DURATION CHECK ================= */
    if (duration === -1) {
      if (!allowUnlimited) {
        return res.status(403).json({ error: "NO_UNLIMITED" });
      }
    } else if (maxDays !== null && duration > maxDays) {
      return res.status(403).json({
        error: "DURATION_LIMIT",
        maxDays,
      });
    }

    /* ================= GENERATE UNIQUE LICENSE ID ================= */
    let licenseId;
    let exists = true;

    while (exists) {
      licenseId = generateLicenseId();
      const check = await db.collection("licenses").doc(licenseId).get();
      exists = check.exists;
    }

    /* ================= CREATE LICENSE ================= */
    const expiresAt =
      duration === -1 || duration === 0
        ? null
        : Date.now() + duration * 86400000;

    await db.collection("licenses").doc(licenseId).set({
      mapName,
      role: userRole,
      gameId: Number(gameId),
      placeId: Number(placeId),
      expiresAt,
      revoked: false,
      createdAt: Date.now(),
      createdBy: decoded.uid,
    });

    // CONNECTION LOGS
    await db.collection("connection_logs").add({
      type: "create",
      licenseId: licenseId,
      userId: decoded.uid,
      role: userRole,
      valid: true,
      gameId: Number(gameId),
      placeId: Number(placeId),
      time: Date.now(),
    });

    return res.json({
      success: true,
      licenseId,
      mapName,
      gameId: Number(gameId),
      placeId: Number(placeId),
      expiresAt,
    });

  } catch (err) {
    console.error("🔥 CREATE LICENSE ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
