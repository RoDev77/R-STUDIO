import { db } from "./lib/firebase.js";
import {
  collection, query, where,
  getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* COUNT LICENSE */
export async function countLicenses(uid) {
  const q = query(
    collection(db, "licenses"),
    where("ownerUid", "==", uid)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/* LIMIT */
export function getLimit(userData) {
  if (
    userData.role === "vip" &&
    userData.vipExpiresAt &&
    userData.vipExpiresAt.toMillis() > Date.now()
  ) {
    return 5;
  }
  return 2;
}

/* CREATE */
export async function createLicense(user, data, payload) {
  const current = await countLicenses(user.uid);
  const limit = getLimit(data);

  if (current >= limit) {
    throw new Error(`LIMIT_${limit}`);
  }

  await addDoc(collection(db, "licenses"), {
    ownerUid: user.uid,
    ownerEmail: user.email,
    gameId: payload.gameId,
    placeId: payload.placeId,
    createdAt: serverTimestamp()
  });
}
