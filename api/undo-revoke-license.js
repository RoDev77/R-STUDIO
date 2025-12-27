//undo-revoke-license.js
import { getFirestore, getAuth } from "./lib/firebase.js";

export default async function handler(req, res) {
    // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method !== "POST")
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const authHeader = req.headers.authorization || "";
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(
      authHeader.replace("Bearer ", "")
    );

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (userSnap.data()?.role !== "owner")
      return res.status(403).json({ error: "OWNER_ONLY" });

    const { licenseId } = req.body;

    const ref = db.collection("licenses").doc(licenseId);
    const snap = await ref.get();
    if (!snap.exists)
      return res.status(404).json({ error: "LICENSE_NOT_FOUND" });

    await ref.update({
      revoked: false,
      revokedAt: null,
      revokedBy: null,
      revokedByRole: null,
      revokedReason: null,
    });

    await db.collection("connection_logs").add({
      type: "undo_revoke",
      licenseId,
      time: Date.now(),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UNDO ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
