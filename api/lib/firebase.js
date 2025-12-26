import admin from "firebase-admin";

let app = null;
let firestore = null;

export function initFirebase() {
  if (app) return app;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");
  }

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return app;
}

export function getFirestore() {
  if (firestore) return firestore;

  initFirebase(); // 🔥 PASTIKAN INIT DULU
  firestore = admin.firestore();
  return firestore;
}

export function getAuth() {
  initFirebase(); // 🔥 AUTH JUGA PASTI ADA APP
  return admin.auth();
}
