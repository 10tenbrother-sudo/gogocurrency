import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AlertRule } from '../types/forex';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
    return false;
  }
}

// Auth Helper Functions
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Sync initial user profile
    if (result.user) {
      await saveUserProfile(result.user.uid, {
        email: result.user.email || '',
        displayName: result.user.displayName || 'Forex Trader',
      });
    }
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-Out failed:', error);
    throw error;
  }
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// User Profile Storage
export async function saveUserProfile(
  userId: string,
  data: {
    email?: string;
    displayName?: string;
    preferredTimeframe?: string;
    soundEnabled?: boolean;
    selectedCurrencies?: string[];
  }
) {
  if (!userId) return;
  const path = `users/${userId}`;
  try {
    const cleanPayload: Record<string, any> = {
      userId,
      updatedAt: new Date().toISOString(),
    };
    if (data.email !== undefined && data.email !== null) {
      cleanPayload.email = String(data.email).slice(0, 256);
    }
    if (data.displayName !== undefined && data.displayName !== null) {
      cleanPayload.displayName = String(data.displayName).slice(0, 128);
    }
    if (data.preferredTimeframe !== undefined && data.preferredTimeframe !== null) {
      cleanPayload.preferredTimeframe = String(data.preferredTimeframe);
    }
    if (data.soundEnabled !== undefined && data.soundEnabled !== null) {
      cleanPayload.soundEnabled = Boolean(data.soundEnabled);
    }
    if (Array.isArray(data.selectedCurrencies)) {
      cleanPayload.selectedCurrencies = data.selectedCurrencies.slice(0, 20);
    }

    await setDoc(doc(db, 'users', userId), cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserProfile(userId: string) {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// User Alerts in Firestore
export async function saveUserAlert(userId: string, alert: AlertRule) {
  const path = `alerts/${alert.id}`;
  try {
    await setDoc(doc(db, 'alerts', alert.id), {
      id: alert.id,
      userId,
      currency: alert.currency,
      condition: alert.condition,
      threshold: alert.threshold,
      enabled: alert.enabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteUserAlert(alertId: string) {
  const path = `alerts/${alertId}`;
  try {
    await deleteDoc(doc(db, 'alerts', alertId));
  } catch (error: any) {
    if (alertId === 'rule-1' || alertId === 'rule-2') {
      console.warn(`Local template rule ${alertId} cleaned up from state`);
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateUserAlertStatus(alertId: string, enabled: boolean) {
  const path = `alerts/${alertId}`;
  try {
    await updateDoc(doc(db, 'alerts', alertId), {
      enabled,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (alertId === 'rule-1' || alertId === 'rule-2') {
      console.warn(`Local template rule ${alertId} updated in state`);
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserAlerts(userId: string): Promise<AlertRule[]> {
  const path = 'alerts';
  try {
    const q = query(collection(db, 'alerts'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const alerts: AlertRule[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      alerts.push({
        id: data.id,
        currency: data.currency,
        condition: data.condition,
        threshold: data.threshold,
        enabled: data.enabled,
      });
    });
    return alerts;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
