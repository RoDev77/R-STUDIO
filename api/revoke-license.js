// revoke-license.js
import { getFirestore, getAuth } from "./lib/firebase.js";

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "https://rstudiolab.online");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

    // ===== LICENSE =====
    const licenseRef = db.collection("licenses").doc(licenseId);
    const licenseSnap = await licenseRef.get();

    if (!licenseSnap.exists) {
      return res.status(404).json({ error: "LICENSE_NOT_FOUND" });
    }

    const license = licenseSnap.data();

    // ===== CREATOR =====
    const creatorSnap = await db
      .collection("users")
      .doc(license.createdBy)
      .get();

    if (!creatorSnap.exists) {
      return res.status(403).json({ error: "CREATOR_NOT_FOUND" });
    }

    const creator = creatorSnap.data();

    // ===== ROLES =====
    const resolveRole = (user) => {
      if (user.role === "owner") return "owner";
      if (user.role === "admin") return "admin";
      if (user.isVIP === true) return "vip";
      return "member";
    };

    const creatorRole = resolveRole(creator);

    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return res.status(403).json({ error: "USER_NOT_FOUND" });
    }

    const user = userSnap.data();
    const userRole = resolveRole(user);

    // ===== PERMISSION LOGIC (FINAL) =====
    let canRevoke = false;

    if (userRole === "owner") {
      // Owner = full access
      canRevoke = true;

    } else if (userRole === "admin") {
      // Admin rules
      if (license.createdBy === decoded.uid) {
        canRevoke = true; // own license
      } else if (creatorRole === "member" || creatorRole === "vip") {
        canRevoke = true; // member / vip
      }
      // ❌ admin tidak boleh revoke admin lain / owner

    } else {
      // Member / VIP
      if (license.createdBy === decoded.uid) {
        canRevoke = true;
      }
    }

    if (!canRevoke) {
      return res.status(403).json({ error: "NO_PERMISSION" });
    }

    // ===== REVOKE =====
    await licenseRef.update({
      revoked: true,
      revokedAt: Date.now(),
      revokedBy: decoded.uid,
    });

    // ===== LOG =====
    await db.collection("connection_logs").add({
      type: "revoke",
      licenseId,
      mapName: license.mapName || "-",
      userId: decoded.uid,
      role: userRole,
      targetRole: creatorRole,
      valid: true,
      time: Date.now(),
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("REVOKE ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
