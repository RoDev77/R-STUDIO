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

  if (req.headers.authorization !== process.env.SUPER_ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { gameId, placeId, owner, duration, role = "user" } = req.body;

    if (!gameId || !placeId || !owner) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const db = getFirestore();

    // hitung license aktif
    const snap = await db
      .collection("licenses")
      .where("owner", "==", owner)
      .where("revoked", "==", false)
      .get();

    const maxLicense = getMaxLicense({ role });

    if (snap.size >= maxLicense) {
      return res.status(403).json({
        success: false,
        error: `LIMIT_${maxLicense}`,
      });
    }

    const expiresAt =
      duration === 0 || duration === -1
        ? null
        : Date.now() + duration * 86400000;

    const doc = {
      owner,
      role,
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
    return res.status(500).json({ error: "Internal server error" });
  }
}
