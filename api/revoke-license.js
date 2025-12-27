//revoke-license.js
import { getFirestore, getAuth } from "./lib/firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "NO_TOKEN" });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(
      authHeader.replace("Bearer ", "")
    );

    const { licenseId, reason } = req.body;
    if (!reason || reason.trim().length < 3)
      return res.status(400).json({ error: "REASON_REQUIRED" });

    const db = getFirestore();

    const licenseSnap = await db.collection("licenses").doc(licenseId).get();
    if (!licenseSnap.exists)
      return res.status(404).json({ error: "LICENSE_NOT_FOUND" });

    const license = licenseSnap.data();

    const creatorSnap = await db
      .collection("users")
      .doc(license.createdBy)
      .get();
    if (!creatorSnap.exists)
      return res.status(403).json({ error: "CREATOR_NOT_FOUND" });

    const creator = creatorSnap.data();

    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const user = userSnap.data();

    const getRole = u =>
      u.role === "owner"
        ? "👑 Owner"
        : u.role === "admin"
        ? "🛠 Admin"
        : u.isVIP
        ? "💎 VIP"
        : "👤 Member";

    const creatorRole = getRole(creator);
    const userRole = getRole(user);

    let canRevoke = false;

    if (userRole === "owner") canRevoke = true;
    else if (userRole === "admin") {
      if (license.createdBy === decoded.uid) canRevoke = true;
      else if (["member", "vip"].includes(creatorRole)) canRevoke = true;
    } else {
      if (license.createdBy === decoded.uid) canRevoke = true;
    }

    if (!canRevoke)
      return res.status(403).json({ error: "NO_PERMISSION" });

    await licenseSnap.ref.update({
      revoked: true,
      revokedAt: Date.now(),
      revokedBy: decoded.uid,
      revokedByRole: userRole,
      revokedReason: reason.trim(),
    });

    await db.collection("connection_logs").add({
      type: "revoke",
      licenseId,
      mapName: license.mapName || "-",
      revokedBy: decoded.uid,
      revokedByRole: userRole,
      reason: reason.trim(),
      time: Date.now(),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("REVOKE ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
