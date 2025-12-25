import admin from "firebase-admin";
import { getFirestore } from "./lib/firebase.js";
import { getMaxLicense } from "./utils/licenselimit.js";

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
    return res.status(405).json({ success: false });
  }

  try {
    /* ================= AUTH ================= */
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await admin.auth().verifyIdToken(token);

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({ success: false });
    }

    const user = userSnap.data();

    if (user.role !== "admin" && user.role !== "owner") {
      return res.status(403).json({ success: false });
    }

    /* ================= BODY ================= */
    const { gameId, placeId, owner, duration } = req.body;

    if (!gameId || !placeId || !owner) {
      return res.status(400).json({ success: false });
    }

    /* ================= LIMIT ================= */
    const snap = await db
      .collection("licenses")
      .where("owner", "==", owner)
      .where("revoked", "==", false)
      .get();

    const maxLicense = getMaxLicense({ role: user.role });

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
      createdBy: decoded.uid,
      gameId: Number(gameId),
      placeId: Number(placeId),
      expiresAt,
      revoked: false,
      createdAt: Date.now(),
    };

    const ref = await db.collection("licenses").add(doc);

    return res.json({
      success: true,
      licenseId: ref.id,
      ...doc,
    });

  } catch (err) {
    console.error("🔥 CREATE LICENSE ERROR:", err);
    return res.status(500).json({ success: false });
  }
}
