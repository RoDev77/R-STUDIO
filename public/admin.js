import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from
"https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const vipList = document.getElementById("vipList");

import { getAuth } from "firebase/auth";

const auth = getAuth();
auth.currentUser.getIdTokenResult().then(token => {
  console.log("CLAIMS:", token.claims);
});

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "login.html";

  const snap = await getDocs(collection(db, "vip_requests"));

  vipList.innerHTML = "";

  snap.forEach(docSnap => {
    const d = docSnap.data();

    vipList.innerHTML += `
      <tr>
        <td>${d.email}</td>
        <td>${d.status}</td>
        <td>
          <button onclick="approveVIP('${d.uid}')">✅ Approve</button>
          <button onclick="rejectVIP('${d.uid}')">❌ Reject</button>
        </td>
      </tr>
    `;
  });
});

window.approveVIP = async uid => {
  // set VIP
  await updateDoc(doc(db,"users",uid), { isVIP: true });

  // update request
  await updateDoc(doc(db,"vip_requests",uid), { status:"approved" });

  alert("🎉 VIP Approved");
  location.reload();
};

window.rejectVIP = async uid => {
  await updateDoc(doc(db,"vip_requests",uid), { status:"rejected" });
  alert("❌ VIP Rejected");
  location.reload();
};
