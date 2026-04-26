// createlicense.js
/* ================= FIREBASE ================= */
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= CONFIG ================= */
const API_BASE = "https://api.rstudiolab.online/api";

/* ================= STATE ================= */
let currentUser = null;
let currentRole = "member";
let isEmailVerified = false;

/* ================= INIT ================= */
document.getElementById("apiEndpoint").textContent = API_BASE;

/* ================= UTIL ================= */
function showNotification(message, type = "success") {
  const n = document.getElementById("notification");
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => n.classList.remove("show"), 3000);
}

/* ================= EMAIL VERIFICATION BANNER ================= */
function showVerificationBanner(isVerified) {
  const oldBanner = document.getElementById("verificationBanner");
  if (oldBanner) oldBanner.remove();
  if (isVerified) return;

  const banner = document.createElement("div");
  banner.id = "verificationBanner";
  banner.innerHTML = `
    <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; border-radius: 12px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">⚠️</span>
        <div>
          <div style="font-weight: 700; font-size: 15px;">Email Belum Diverifikasi</div>
          <div style="font-size: 13px;">Verifikasi email kamu untuk menggunakan semua fitur dengan aman.</div>
        </div>
      </div>
      <a href="profile.html" style="background: white; color: #f59e0b; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700;">Verifikasi Sekarang</a>
    </div>
  `;
  const mainContent = document.querySelector(".page-wrap") || document.body;
  mainContent.insertBefore(banner, mainContent.firstChild);
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
  isEmailVerified = data.emailVerified || false;
  showVerificationBanner(isEmailVerified);

  if (!isEmailVerified) {
    setTimeout(() => showNotification("⚠️ Email belum diverifikasi. Silakan verifikasi di halaman Profile.", "warning"), 1000);
  }

  if (data.role === "owner") currentRole = "owner";
  else if (data.role === "admin") currentRole = "admin";
  else if (data.isVIP === true) currentRole = "vip";
  else currentRole = "member";

  renderUserRole(currentRole);
  checkServerStatus();
  loadLicenses();
  refreshLogs();
});

function renderUserRole(role) {
  const badge = document.getElementById("userRoleBadge");
  if (!badge) return;
  badge.className = "role-badge";
  
  const roleMap = {
    owner: "👑 Owner",
    admin: "🛠 Admin",
    vip: "💎 VIP",
    member: "👤 Member"
  };
  badge.textContent = roleMap[role] || "👤 Member";
}

/* ================= PERMISSION ================= */
function canRevoke(license) {
  if (!license) return false;
  if (currentRole === "owner") return true;
  if (currentRole === "admin") {
    if (license.createdBy === currentUser.uid) return true;
    return license.creatorRole === "member" || license.creatorRole === "vip";
  }
  return license.createdBy === currentUser.uid;
}

/* ================= CREATE LICENSE ================= */
document.getElementById("createLicenseForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!isEmailVerified) {
    if (confirm("Email kamu belum diverifikasi. Verifikasi dulu untuk keamanan akun.\n\nKe halaman Profile sekarang?")) {
      location.href = "profile.html";
    }
    return;
  }

  try {
    const token = await currentUser.getIdToken();
    const gameId = Number(document.getElementById("gameId").value);
    const placeId = Number(document.getElementById("placeId").value);
    const mapName = document.getElementById("mapName").value;
    const duration = Number(document.getElementById("duration").value);

    const res = await fetch(`${API_BASE}/create-license.js`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ gameId, placeId, mapName, duration })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "FAILED");

    document.getElementById("licenseKeyDisplay").textContent = `
License ID : ${data.licenseId}
Map Name   : ${data.mapName}
Game ID    : ${data.gameId}
Place ID   : ${data.placeId}
Expires At : ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : "♾️ Unlimited"}
    `;
    document.getElementById("newLicenseInfo").style.display = "block";
    showNotification("✅ License created");
    loadLicenses();
  } catch (err) {
    showNotification(err.message, "error");
  }
});

/* ================= SERVER STATUS ================= */
async function checkServerStatus() {
  const el = document.getElementById("serverStatus");
  try {
    const res = await fetch(`${API_BASE}/licenses.js`);
    if (res.ok) {
      el.innerHTML = '<span class="dot"></span> Online';
      el.className = "status-pill online";
    } else throw new Error();
  } catch {
    el.innerHTML = '<span class="dot"></span> Offline';
    el.className = "status-pill offline";
  }
}

/* ================= LOAD LICENSES ================= */
async function loadLicenses() {
  try {
    const res = await fetch(`${API_BASE}/licenses.js`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.licenses)) throw new Error();

    const licenses = data.licenses;
    const now = Date.now();

    document.getElementById("totalLicenses").textContent = licenses.length;
    document.getElementById("activeLicenses").textContent = licenses.filter(l => !l.revoked && (l.expiresAt === null || l.expiresAt > now)).length;
    document.getElementById("expiredLicenses").textContent = licenses.filter(l => l.expiresAt !== null && l.expiresAt <= now).length;

    if (!licenses.length) {
      document.getElementById("licenseList").innerHTML = '<div class="empty-state">No licenses yet</div>';
      return;
    }

    const licenseList = document.getElementById("licenseList");
    licenseList.innerHTML = await Promise.all(licenses.map(async l => {
      let badge = l.revoked ? "revoked" : (l.expiresAt === null ? "unlimited" : (l.expiresAt <= now ? "expired" : "active"));
      const creatorName = await getUserName(l.createdBy);
      
      return `
        <div class="license-item ${badge}">
          <div class="license-key">
            <strong>${l.mapName}</strong>
            <span class="badge badge-${badge}">${badge.toUpperCase()}</span>
          </div>
          <div class="license-meta">
            <div class="meta-row"><strong>License ID:</strong> ${l.licenseId}</div>
            <div class="meta-row"><strong>Created by:</strong> ${creatorName}</div>
            <div class="meta-row"><strong>Game ID:</strong> ${l.gameId}</div>
            <div class="meta-row"><strong>Place ID:</strong> ${l.placeId}</div>
            <div class="meta-row"><strong>Expires:</strong> ${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "♾️ Unlimited"}</div>
          </div>
          <div class="license-actions">
            ${l.revoked ? `
              ${currentRole === "owner" ? `<button class="btn btn-sm" style="background:#6c5ce7;" onclick="undoRevoke('${l.licenseId}')">↻ Undo Revoke</button>` : ""}
            ` : `
              ${canRevoke(l) ? `<button class="btn btn-danger btn-sm" onclick="revokeLicense('${l.licenseId}')">🗑 Revoke</button>` : ""}
            `}
          </div>
        </div>
      `;
    })).then(html => html.join(""));
  } catch (err) {
    console.error(err);
    showNotification("Failed load licenses", "error");
  }
}

/* ================= GET USER NAME ================= */
const userCache = {};
async function getUserName(uid) {
  if (userCache[uid]) return userCache[uid];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const name = snap.data()?.username || snap.data()?.name || snap.data()?.email || "Unknown";
    userCache[uid] = name;
    return name;
  } catch {
    return "Unknown";
  }
}

/* ================= TEST CONNECTION (VERIFY) ================= */
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
    const res = await fetch(`${API_BASE}/verify-license.js?licenseId=${licenseId}&universeId=${universeId}&placeId=${placeId}`);
    const data = await res.json();

    const testResult = document.getElementById("testResult");
    if (data.valid) {
      testResult.innerHTML = `<div style="background:#10b981;color:white;padding:12px;border-radius:8px">✅ VALID<br>Map Name: ${data.mapName}<br>Game ID: ${data.gameId}</div>`;
      showNotification("License valid!", "success");
    } else {
      testResult.innerHTML = `<div style="background:#ef4444;color:white;padding:12px;border-radius:8px">❌ INVALID<br>${data.reason || "License not valid"}</div>`;
      showNotification(data.reason || "Invalid license", "error");
    }
  } catch {
    document.getElementById("testResult").innerHTML = `<div style="background:#ef4444;color:white;padding:12px;border-radius:8px">❌ CONNECTION ERROR</div>`;
  }
}

/* ================= REVOKE LICENSE ================= */
async function revokeLicense(licenseId) {
  if (!isEmailVerified) {
    showNotification("⚠️ Verifikasi email dulu untuk melakukan revoke", "warning");
    return;
  }

  const reason = prompt("Alasan revoke (wajib):");
  if (!reason || reason.trim().length < 3) return showNotification("Alasan wajib diisi (min 3 karakter)", "error");
  if (!confirm("Revoke license ini?")) return;

  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE}/revoke-license.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ licenseId, reason })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showNotification("License revoked");
    loadLicenses();
    refreshLogs();
  } catch (err) {
    showNotification(err.message, "error");
  }
}

/* ================= UNDO REVOKE ================= */
async function undoRevoke(licenseId) {
  if (currentRole !== "owner") return showNotification("Only owner can undo revoke", "error");
  if (!confirm("Undo revoke license ini?")) return;

  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE}/undo-revoke-license.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ licenseId })
    });
    const data = await res.json();
    if (!data.success) throw new Error();
    showNotification("License restored");
    loadLicenses();
    refreshLogs();
  } catch {
    showNotification("Undo revoke failed", "error");
  }
}

/* ================= REFRESH LOGS ================= */
async function refreshLogs() {
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE}/logs.js`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) throw new Error();

    const logContainer = document.getElementById("logContainer");
    if (!data.logs?.length) {
      logContainer.innerHTML = '<div class="empty-state">No logs yet</div>';
      return;
    }

    logContainer.innerHTML = data.logs.map(l => `
      <div class="log-entry ${l.type === 'revoke' ? 'error' : (l.type === 'undo_revoke' ? 'success' : 'info')}">
        [${new Date(l.time).toLocaleTimeString()}] 
        ${l.type === 'revoke' ? '🔥 REVOKE' : (l.type === 'undo_revoke' ? '♻️ UNDO REVOKE' : '📝 ' + l.action)} 
        — ${l.licenseId}
        ${l.reason ? `<br>Reason: "${l.reason}"` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}

/* ================= GLOBAL FUNCTIONS ================= */
window.loadLicenses = loadLicenses;
window.testConnection = testConnection;
window.refreshLogs = refreshLogs;
window.revokeLicense = revokeLicense;
window.undoRevoke = undoRevoke;

/* ================= AUTO REFRESH ================= */
setInterval(checkServerStatus, 30000);
setInterval(refreshLogs, 5000);

console.log("✅ License Manager ready");