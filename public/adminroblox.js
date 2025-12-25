/* ================= FIREBASE ================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= CONFIG ================= */
const API_BASE = "https://api.rstudiolab.online/api";

/* ================= STATE ================= */
let currentUser = null;
let logs = [];

/* ================= INIT ================= */
document.getElementById("apiEndpoint").textContent = API_BASE;

/* ================= UTIL ================= */
function showNotification(message, type = "success") {
  const n = document.getElementById("notification");
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => n.classList.remove("show"), 3000);
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "login.html";

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    showNotification("User data not found", "error");
    return;
  }

  const data = snap.data();

  currentUser = {
    uid: user.uid,
    role: data.role || "member",
    isVIP: data.isVIP === true
  };

  console.log("👤 Logged as:", currentUser);

  checkServerStatus();
  loadLicenses();
  refreshLogs();
});

/* ================= PERMISSION ================= */
function canRevoke() {
  if (!currentUser) return false;
  return currentUser.role === "admin" || currentUser.role === "owner";
}

/* ================= SERVER STATUS ================= */
async function checkServerStatus() {
  const el = document.getElementById("serverStatus");
  try {
    const res = await fetch(`${API_BASE}/meta?type=health`);
    if (!res.ok) throw new Error();
    el.textContent = "Online";
    el.className = "status online";
  } catch {
    el.textContent = "Offline";
    el.className = "status offline";
  }
}

/* ================= LICENSES ================= */
async function loadLicenses() {
  try {
    const res = await fetch(`${API_BASE}/licenses`);
    const data = await res.json();
    if (!data.success) throw new Error();

    const now = Date.now();
    const licenses = data.licenses;

    totalLicenses.textContent = licenses.length;
    activeLicenses.textContent = licenses.filter(
      l => !l.revoked && (l.expiresAt === null || l.expiresAt > now)
    ).length;
    expiredLicenses.textContent = licenses.filter(
      l => l.expiresAt !== null && l.expiresAt <= now
    ).length;

    licenseList.innerHTML = licenses.map(l => {
      let badge = "active";
      if (l.revoked) badge = "revoked";
      else if (l.expiresAt === null) badge = "unlimited";
      else if (l.expiresAt <= now) badge = "expired";

      return `
<div class="license-item">
  <b>${l.owner}</b>
  <span class="badge ${badge}">${badge.toUpperCase()}</span>
  <p>ID: ${l.licenseId}</p>
  <p>Game: ${l.gameId}</p>
  <p>Place: ${l.placeId}</p>
  <p>Expires: ${
    l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "♾️ Unlimited"
  }</p>

  ${
    canRevoke() && !l.revoked
      ? `<button class="btn btn-danger btn-sm"
          onclick="revokeLicense('${l.licenseId}')">Revoke</button>`
      : ""
  }
</div>`;
    }).join("");

  } catch {
    showNotification("Failed load licenses", "error");
  }
}

/* ================= REVOKE ================= */
async function revokeLicense(licenseId) {
  if (!confirm("Revoke license?")) return;

  try {
    const token = await auth.currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/revoke-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ licenseId })
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    showNotification("License revoked");
    loadLicenses();
  } catch {
    showNotification("No permission", "error");
  }
}

/* ================= LOGS ================= */
async function refreshLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs`);
    const data = await res.json();
    logs = data.logs || [];

    logContainer.innerHTML = logs.map(l => `
      <div class="log-entry ${l.valid ? "success" : "error"}">
        [${new Date(l.time).toLocaleTimeString()}]
        ${l.licenseId} — ${l.valid ? "VALID" : "INVALID"}
      </div>
    `).join("");

  } catch {
    showNotification("Failed load logs", "error");
  }
}

/* ================= GLOBAL ================= */
window.revokeLicense = revokeLicense;
window.refreshLogs = refreshLogs;

/* ================= AUTO REFRESH ================= */
setInterval(checkServerStatus, 30000);
setInterval(refreshLogs, 5000);

console.log("✅ License Manager ready");
