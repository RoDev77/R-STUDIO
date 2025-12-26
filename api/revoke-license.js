// revoke-license.js
import { getFirestore, getAuth } from "./lib/firebase.js";

export default async function handler(req, res) {
  try {
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

    const licenseSnap = await db
      .collection("licenses")
      .doc(licenseId)
      .get();

    if (!licenseSnap.exists) {
      return res.status(404).json({ error: "LICENSE_NOT_FOUND" });
    }

    const license = licenseSnap.data();

    const creatorSnap = await db
      .collection("users")
      .doc(license.createdBy)
      .get();

    if (!creatorSnap.exists) {
      return res.status(403).json({ error: "CREATOR_NOT_FOUND" });
    }

    const creator = creatorSnap.data();

    let creatorRole = "member";
    if (creator.role === "owner") creatorRole = "owner";
    else if (creator.role === "admin") creatorRole = "admin";
    else if (creator.isVIP === true) creatorRole = "vip";

    let userRole = "member";
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const user = userSnap.data();

    if (user.role === "owner") userRole = "owner";
    else if (user.role === "admin") userRole = "admin";
    else if (user.isVIP === true) userRole = "vip";

    // ===== PERMISSION LOGIC =====
    let canRevoke = false;

    if (userRole === "owner") {
      canRevoke = true;
    } else if (userRole === "admin") {
      if (license.createdBy === decoded.uid) {
        canRevoke = true;
      } else if (creatorRole === "member" || creatorRole === "vip") {
        canRevoke = true;
      }
    } else {
      if (license.createdBy === decoded.uid) {
        canRevoke = true;
      }
    }

    if (!canRevoke) {
      return res.status(403).json({ error: "NO_PERMISSION" });
    }

    await licenseSnap.ref.update({
      revoked: true,
      revokedAt: Date.now(),
      revokedBy: decoded.uid,
    });

    await db.collection("connection_logs").add({
      type: "revoke",
      licenseId,
      mapName: license.mapName || "-",
      userId: decoded.uid,
      role: userRole,
      valid: true,
      time: Date.now(),
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("REVOKE ERROR:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
