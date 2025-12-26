import admin from "firebase-admin";
import { getFirestore } from "./lib/firebase.js";
import { getMaxLicense } from "./utils/licenselimit.js";

export default async function handler(req, res) {
  // CORS
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

    const idToken = authHeader.replace("Bearer ", "");

    // 🔑 PAKAI APP YANG SUDAH DI-INIT DARI getFirestore()
    const decoded = await admin.auth().verifyIdToken(idToken);

    const db = getFirestore();

    /* ================= ROLE CHECK ================= */
    const userSnap = await db
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!userSnap.exists) {
      return res.status(403).json({ error: "User not registered" });
    }

    const userRole = userSnap.data().role;

    if (userRole !== "admin" && userRole !== "owner") {
      return res.status(403).json({ error: "NO_PERMISSION" });
    }

    /* ================= PAYLOAD ================= */
    const { gameId, placeId, owner, duration } = req.body;

    if (!gameId || !placeId || !owner) {
      return res.status(400).json({ error: "Missing fields" });
    }

    /* ================= LIMIT ================= */
    const snap = await db
      .collection("licenses")
      .where("owner", "==", owner)
      .where("revoked", "==", false)
      .get();

    const maxLicense = getMaxLicense({ role: userRole });

    if (snap.size >= maxLicense) {
      return res.status(403).json({
        success: false,
        error: `LIMIT_${maxLicense}`,
      });
    }

    /* ================= CREATE ================= */
    const expiresAt =
      duration === 0 || duration === -1
        ? null
        : Date.now() + duration * 86400000;

    const doc = {
      owner,
      role: userRole,
      gameId: Number(gameId),
      placeId: Number(placeId),
      expiresAt,
      revoked: false,
      createdAt: Date.now(),
      createdBy: decoded.uid,
    };

    const ref = await db.collection("licenses").add(doc);

    return res.json({
      success: true,
      licenseId: ref.id,
      ...doc,
    });

  } catch (err) {
    console.error("🔥 CREATE LICENSE ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
