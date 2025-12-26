// createlicense.js
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

  if (data.role === "owner") {
    currentRole = "owner";
  } else if (data.role === "admin") {
    currentRole = "admin";
  } else if (data.isVIP === true) {
    currentRole = "vip";
  } else {
    currentRole = "member";
  }

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
      badge.textContent = "👑 Owner";
      badge.classList.add("role-owner");
      break;

    case "admin":
      badge.textContent = "🛠 Admin";
      badge.classList.add("role-admin");
      break;

    case "vip":
      badge.textContent = "💎 VIP";
      badge.classList.add("role-vip");
      break;

    default:
      badge.textContent = "👤 Member";
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
        mapName: mapName.value, // ⬅️ nama map
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

      // === LOG CREATE LICENSE ===
      await fetch(`${API_BASE}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          licenseId: data.licenseId,
          action: "CREATE_LICENSE",
          valid: true
        })
      });

      licenseKeyDisplay.textContent = `
      License ID : ${data.licenseId}
      Map Name   : ${data.mapName}
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

const userCache = {};

async function getUserName(uid) {
  if (userCache[uid]) return userCache[uid];

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "Unknown";

    const data = snap.data();
    const name = data.username || data.name || data.email || "Unknown";

    userCache[uid] = name;
    return name;
  } catch {
    return "Unknown";
  }
}

/* ================= DOM CACHE ================= */
const totalLicenses   = document.getElementById("totalLicenses");
const activeLicenses  = document.getElementById("activeLicenses");
const expiredLicenses = document.getElementById("expiredLicenses");
const licenseList     = document.getElementById("licenseList");

/* ================= LICENSES ================= */
async function loadLicenses() {
  try {
    const res = await fetch(`${API_BASE}/licenses`);
    if (!res.ok) throw new Error("NETWORK");

    const data = await res.json();
    if (!data.success || !Array.isArray(data.licenses)) {
      throw new Error("INVALID_RESPONSE");
    }


    const licenses = data.licenses;
    const now = Date.now();

    // === SAFE UI UPDATE ===
    if (totalLicenses)   totalLicenses.textContent = licenses.length;
    if (activeLicenses)  activeLicenses.textContent = licenses.filter(
      l => !l.revoked && (l.expiresAt === null || l.expiresAt > now)
    ).length;
    if (expiredLicenses) expiredLicenses.textContent = licenses.filter(
      l => l.expiresAt !== null && l.expiresAt <= now
    ).length;

    // === EMPTY STATE ===
    if (!licenses.length) {
      if (licenseList) {
        licenseList.innerHTML =
          `<p style="opacity:.6;text-align:center">No licenses yet</p>`;
      }
      return;
    }

    // === RENDER LIST ===
    licenseList.innerHTML = (await Promise.all(
      licenses.map(async l => {
        let badge = "active";
        if (l.revoked) badge = "revoked";
        else if (l.expiresAt === null) badge = "unlimited";
        else if (l.expiresAt <= now) badge = "expired";

        const creatorName = await getUserName(l.createdBy);

        return `
          <div class="license-item">
            <b>${l.mapName}</b>
            <span class="badge ${badge}">${badge.toUpperCase()}</span>

            <p>ID License: ${l.licenseId}</p>
            <p>Name User: ${creatorName}</p>
            <p>Game ID: ${l.gameId}</p>
            <p>Place ID: ${l.placeId}</p>
            <p>Expires: ${
              l.expiresAt
                ? new Date(l.expiresAt).toLocaleDateString()
                : "♾️ Unlimited"
            }</p>

            ${
              !l.revoked &&
              (
                currentRole === "owner" ||
                currentRole === "admin" ||
                l.createdBy === currentUser.uid
              )
                ? `<button class="btn btn-danger btn-sm"
                    onclick="revokeLicense('${l.licenseId}')">
                    Revoke
                  </button>`
                : ""
            }
          </div>
        `;
      })
    )).join("");

  } catch (err) {
    console.error("LOAD LICENSE ERROR:", err);
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

  // === LOG VERIFY (VALID / INVALID) ===
  const token = await currentUser.getIdToken();

  await fetch(`${API_BASE}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      licenseId,
      action: "TEST_CONNECTION",
      valid: data.valid === true
    })
  });

  if (!data.valid) {
    throw new Error(data.reason || "INVALID");
  }

  testResult.innerHTML = `
  <div style="background:#10b981;color:white;padding:12px;border-radius:8px">
  ✅ VALID<br>
  Map Name: ${data.mapName}<br>
  Game ID: ${data.gameId}<br>
  Universe ID: ${data.universeId}
  </div>`;
  } catch {
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

    // === LOG REVOKE ===
    await fetch(`${API_BASE}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        licenseId,
        action: "REVOKE_LICENSE",
        valid: false
      })
    });

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
        ${l.licenseId} — ${l.mapName} — ${l.valid ? "VALID" : "INVALID"}

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
