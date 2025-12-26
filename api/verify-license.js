//verify-license.js
import { cors } from "./_cors.js";
import { getFirestore } from "./lib/firebase.js";

export default async function handler(req, res) {
  // ✅ CORS PALING ATAS
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ valid: false });
  }

  try {
    const { licenseId, universeId } = req.query;

    if (!licenseId || !universeId) {
      return res.status(400).json({
        valid: false,
        reason: "MISSING_PARAMS",
      });
    }

    const db = getFirestore();
    const ref = db.collection("licenses").doc(licenseId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.json({ valid: false, reason: "LICENSE_NOT_FOUND" });
    }

    const license = snap.data();

    if (license.revoked && Date.now() > license.revoked) {

      await db.collection("connection_logs").add({
        type: "verify",
        licenseId,
        valid: false,
        reason: "REVOKED",
        universeId: Number(universeId),
        time: Date.now(),
      });

      return res.json({ valid: false, reason: "REVOKED" });
    }

    if (license.expiresAt && Date.now() > license.expiresAt) {

      await db.collection("connection_logs").add({
        type: "verify",
        licenseId,
        valid: false,
        reason: "EXPIRED",
        universeId: Number(universeId),
        time: Date.now(),
      });

      return res.json({ valid: false, reason: "EXPIRED" });
    }

    // 🔐 AUTO-BIND UNIVERSE (1x SAJA)
    if (!license.universeId) {
      await ref.update({
        universeId: Number(universeId),
        boundAt: Date.now(),
      });
    } else if (Number(license.universeId) !== Number(universeId)) {
      return res.json({
        valid: false,
        reason: "UNIVERSE_MISMATCH",
      });
    }
    
    // CONNECTION LOGS
    await db.collection("connection_logs").add({
      type: "verify",
      licenseId,
      userId: license.createdBy,
      role: license.role || "unknown",
      valid: true,
      gameId: license.gameId,
      placeId: license.placeId,
      universeId: Number(universeId),
      time: Date.now(),
    });

    return res.json({
      valid: true,
      mapName: license.mapName || null, // ✅ FIX UTAMA
      gameId: license.gameId,
      placeId: license.placeId,
      universeId: license.universeId ?? Number(universeId),
      expiresAt: license.expiresAt,
    });
  } catch (err) {
    console.error("VERIFY LICENSE ERROR:", err);
    return res.status(500).json({
      valid: false,
      reason: "SERVER_ERROR",
    });
  }
}
