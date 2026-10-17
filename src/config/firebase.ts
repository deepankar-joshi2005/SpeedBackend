import fs from "fs";
import path from "path";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App | undefined;

function getApp(): App {
  if (!app) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `[firebase] Service account file not found at "${resolvedPath}". Download it from Firebase Console → Project Settings → Service Accounts, and set FIREBASE_SERVICE_ACCOUNT_PATH in .env.`
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
    app = initializeApp({ credential: cert(serviceAccount) });
  }
  return app;
}

export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getAuth(getApp()) as any)[prop];
  },
});
