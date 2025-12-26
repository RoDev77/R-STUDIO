// revoke-license.js
const licenseSnap = await db
  .collection("licenses")
  .doc(licenseId)
  .get();

if (!licenseSnap.exists) {
  return res.status(404).json({ error: "LICENSE_NOT_FOUND" });
}

const license = licenseSnap.data();

// ambil user pembuat license
const creatorSnap = await db
  .collection("users")
  .doc(license.createdBy)
  .get();

if (!creatorSnap.exists) {
  return res.status(403).json({ error: "CREATOR_NOT_FOUND" });
}

const creator = creatorSnap.data();

// tentukan role creator
let creatorRole;
if (creator.role === "owner") {
  creatorRole = "owner";
} else if (creator.role === "admin") {
  creatorRole = "admin";
} else if (creator.isVIP === true) {
  creatorRole = "vip";
} else {
  creatorRole = "member";
}

let canRevoke = false;

// ===== OWNER =====
if (userRole === "owner") {
  canRevoke = true;
}

// ===== ADMIN =====
else if (userRole === "admin") {
  // admin boleh revoke license sendiri
  if (license.createdBy === decoded.uid) {
    canRevoke = true;
  }
  // admin boleh revoke member / vip
  else if (creatorRole === "member" || creatorRole === "vip") {
    canRevoke = true;
  }
  // admin TIDAK boleh revoke admin lain / owner
}

// ===== MEMBER / VIP =====
else {
  // hanya boleh revoke license sendiri
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
  mapName: license.mapName || "-", // ✅ FIX
  userId: decoded.uid,
  role: userRole,
  valid: true,
  time: Date.now(),
});

return res.json({ success: true });
