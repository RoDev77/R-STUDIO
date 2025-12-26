import { getFirestore, getAuth } from "./lib/firebase.js";

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    // ===== AUTH =====
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "NO_TOKEN" });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(
      authHeader.replace("Bearer ", "")
    );

    const db = getFirestore();
    const { licenseId } = req.body;

    if (!licenseId) {
      return res.status(400).json({ error: "MISSING_LICENSE_ID" });
    }

    // ===== USER ROLE =====
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ error: "USER_NOT_FOUND" });
    }

    const user = userSnap.data();
    if (user.role !== "owner") {
      return res.status(403).json({ error: "OWNER_ONLY" });
    }

    // ===== LICENSE =====
    const ref = db.collection("licenses").doc(licenseId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "LICENSE_NOT_FOUND" });
    }

    const license = snap.data();

    if (!license.revoked) {
      return res.status(400).json({ error: "LICENSE_NOT_REVOKED" });
    }

    // OPTIONAL: jangan undo license expired
    if (license.expiresAt && Date.now() > license.expiresAt) {
      return res.status(400).json({ error: "LICENSE_EXPIRED" });
    }

    // ===== UNDO REVOKE =====
    await ref.update({
      revoked: false,
      revokedAt: null,
      revokedBy: null,
      restoredAt: Date.now(),
      restoredBy: decoded.uid,
    });

    // ===== LOG =====
    await db.collection("connection_logs").add({
      type: "undo_revoke",

      licenseId,
      mapName: license.mapName || "-",
      gameId: license.gameId || null,
      placeId: license.placeId || null,

      restoredBy: decoded.uid,
      restoredByRole: "owner",

      licenseOwner: license.createdBy,

      success: true,
      time: Date.now(),
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("UNDO REVOKE ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
