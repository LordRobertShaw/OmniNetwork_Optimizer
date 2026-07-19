import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  AuthCredential
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Services with Multi-Tab Offline Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const auth = getAuth(app);

// Configure Google OAuth Provider
export const googleAuthProvider = new GoogleAuthProvider();

// Scopes required for Google Contacts, Google Drive and Gmail
googleAuthProvider.addScope("https://www.googleapis.com/auth/contacts");
googleAuthProvider.addScope("https://www.googleapis.com/auth/contacts.other.readonly");
googleAuthProvider.addScope("https://www.googleapis.com/auth/user.phonenumbers.read");
googleAuthProvider.addScope("https://www.googleapis.com/auth/user.emails.read");
googleAuthProvider.addScope("https://www.googleapis.com/auth/drive");
googleAuthProvider.addScope("https://mail.google.com/");

// We also request userinfo profile and email implicitly
googleAuthProvider.addScope("openid");
googleAuthProvider.addScope("profile");
googleAuthProvider.addScope("email");

// In-memory token cache backed by sessionStorage (isolated to current tab) to allow auto-authentication on page refresh.
let cachedAccessToken: string | null = typeof window !== "undefined" ? sessionStorage.getItem("contacts_access_token") : null;
let isSigningIn = false;

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Restore from sessionStorage if available
      if (!cachedAccessToken && typeof window !== "undefined") {
        cachedAccessToken = sessionStorage.getItem("contacts_access_token");
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Access token was not found, trigger failure to prompt re-auth.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("contacts_access_token");
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Initiate Google Sign In (Triggered by user interaction)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google Auth");
    }
    cachedAccessToken = credential.accessToken;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("contacts_access_token", credential.accessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Authentication Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("contacts_access_token", token);
    } else {
      sessionStorage.removeItem("contacts_access_token");
    }
  }
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("contacts_access_token");
  }
};

// --- FIRESTORE HARDENED ERROR HANDLING (MANDATORY DIRECTIVE) ---
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
