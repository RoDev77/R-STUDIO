import { getFirestore, getAuth } from "./lib/firebase.js";

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

    const auth = getAuth(); // ✅ PASTI ADA APP
    const decoded = await auth.verifyIdToken(idToken);

    const db = getFirestore();

    /* ================= ROLE ================= */
    const userSnap = await db
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!userSnap.exists) {
      return res.status(403).json({ error: "User not registered" });
    }

    const userRole = userSnap.data().role;


    /* ================= PAYLOAD ================= */
    const { gameId, placeId, owner, duration } = req.body;

    if (!gameId || !placeId || !owner) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // ================= LIMIT & RULE =================
    let maxLicense;
    let maxDays;
    let allowUnlimited;

    switch (userRole) {
      case "member":
        maxLicense = 2;
        maxDays = 30;
        allowUnlimited = false;
        break;

      case "vip":
        maxLicense = 5;
        maxDays = null;
        allowUnlimited = true;
        break;

      case "admin":
      case "owner":
        maxLicense = Infinity;
        maxDays = null;
        allowUnlimited = true;
        break;

      default:
        return res.status(403).json({ error: "INVALID_ROLE" });
    }

    // LICENSE AKTIF
    const now = Date.now();

    const snap = await db
      .collection("licenses")
      .where("createdBy", "==", decoded.uid)
      .where("revoked", "==", false)
      .get();

    // hitung ACTIVE license saja
    const activeLicenses = snap.docs.filter(doc => {
      const data = doc.data();

      // unlimited / permanent license
      if (data.expiresAt === null) return true;

      // masih aktif
      return data.expiresAt > now;
    }).length;

    if (activeLicenses >= maxLicense) {
      return res.status(403).json({
        error: "LICENSE_LIMIT",
        max: maxLicense,
        active: activeLicenses,
      });
    }

    // ================= DURATION CHECK =================
    if (duration === -1) {
      if (!allowUnlimited) {
        return res.status(403).json({ error: "NO_UNLIMITED" });
      }
    } else {
      if (maxDays !== null && duration > maxDays) {
        return res.status(403).json({
          error: "DURATION_LIMIT",
          maxDays,
        });
      }
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
