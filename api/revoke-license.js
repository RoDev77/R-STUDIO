const licenseSnap = await db
  .collection("licenses")
  .doc(licenseId)
  .get();

if (!licenseSnap.exists) {
  return res.status(404).json({ error: "LICENSE_NOT_FOUND" });
}

const license = licenseSnap.data();

let canRevoke = false;

// OWNER BISA SEMUA
if (userRole === "owner") {
  canRevoke = true;
}

// ADMIN
else if (userRole === "admin") {
  // admin bisa revoke milik sendiri
  if (license.createdBy === decoded.uid) {
    canRevoke = true;
  }
  // admin bisa revoke member & vip
  else if (["member", "vip"].includes(license.role)) {
    canRevoke = true;
  }
}

// MEMBER / VIP
else {
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

return res.json({ success: true });
