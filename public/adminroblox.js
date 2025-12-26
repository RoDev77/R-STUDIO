/* ================= FIREBASE ================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= CONFIG ================= */
const API_BASE = "https://api.rstudiolab.online/api";

/* ================= STATE ================= */
let currentUser = null;     // firebase auth user
let currentRole = "member"; // role dari Firestore
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

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    showNotification("User data not found", "error");
    return;
  }

  const data = snap.data();
  currentRole = data.role || "member";

  renderUserRole(currentRole); // ✅ TAMBAHKAN INI
  checkServerStatus();
  loadLicenses();
  refreshLogs();
});

function renderUserRole(role) {
  const badge = document.getElementById("userRoleBadge");
  if (!badge) return;

  badge.className = "role-badge"; // reset

  switch (role) {
    case "owner":
      badge.textContent = "OWNER";
      badge.classList.add("role-owner");
      break;

    case "admin":
      badge.textContent = "ADMIN";
      badge.classList.add("role-admin");
      break;

    case "vip":
      badge.textContent = "VIP";
      badge.classList.add("role-vip");
      break;

    default:
      badge.textContent = "MEMBER";
      badge.classList.add("role-member");
  }
}

/* ================= PERMISSION ================= */
function canRevoke() {
  return currentRole === "admin" || currentRole === "owner";
}

// ================= CREATE LICENSE =================
document
  .getElementById("createLicenseForm")
  .addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const token = await currentUser.getIdToken();

      const payload = {
        gameId: Number(gameId.value),
        placeId: Number(placeId.value),
        owner: owner.value,
        duration: Number(duration.value),
      };
      

      const res = await fetch(`${API_BASE}/create-license`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "FAILED");

      licenseKeyDisplay.textContent = `
License ID : ${data.licenseId}
Owner      : ${data.owner}
Game ID    : ${data.gameId}
Place ID   : ${data.placeId}
Expires At : ${
        data.expiresAt
          ? new Date(data.expiresAt).toLocaleDateString()
          : "♾️ Unlimited"
      }
`;

      newLicenseInfo.style.display = "block";
      showNotification("✅ License created");

      loadLicenses();
    } catch (err) {
      showNotification(err.message, "error");

    }
  })

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

// ================= VERIFY =================
async function testConnection() {
  const licenseId = prompt("Masukkan License ID");
  if (!licenseId) return;

  const universeId = document.getElementById("testGameId").value;
  const placeId = document.getElementById("testPlaceId").value;

  if (!universeId) {
    showNotification("Universe ID kosong", "error");
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/verify-license?licenseId=${licenseId}&universeId=${universeId}&placeId=${placeId}`
    );

    const data = await res.json();

    if (!data.valid) {
      throw new Error(data.reason || "INVALID");
    }

    testResult.innerHTML = `
<div style="background:#10b981;color:white;padding:12px;border-radius:8px">
✅ VALID<br>
Owner: ${data.owner}<br>
Game ID: ${data.gameId}<br>
Universe ID: ${data.universeId}
</div>`;
  } catch (err) {
    testResult.innerHTML = `
<div style="background:#ef4444;color:white;padding:12px;border-radius:8px">
❌ INVALID
</div>`;
  }
}

/* ================= REVOKE ================= */
async function revokeLicense(licenseId) {
  if (!canRevoke()) {
    return showNotification("No permission", "error");
  }

  if (!confirm("Revoke license?")) return;

  try {
    const token = await currentUser.getIdToken();

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
    showNotification("Revoke failed", "error");
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
window.loadLicenses = loadLicenses;
window.testConnection = testConnection;
window.refreshLogs = refreshLogs;
window.revokeLicense = revokeLicense;



/* ================= AUTO REFRESH ================= */
setInterval(checkServerStatus, 30000);
setInterval(refreshLogs, 5000);

console.log("✅ License Manager ready");
