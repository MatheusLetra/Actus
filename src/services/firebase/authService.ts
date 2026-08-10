import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth } from './config';

export interface SyncUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

function toSyncUser(user: User): SyncUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function requireAuth() {
  if (!auth) throw new Error('Firebase não configurado. Verifique o arquivo .env.');
  return auth;
}

export const authService = {
  signInWithGoogle(): Promise<SyncUser> {
    const instance = requireAuth();
    const provider = new GoogleAuthProvider();
    return signInWithPopup(instance, provider).then((result) => toSyncUser(result.user));
  },

  signOut(): Promise<void> {
    return signOut(requireAuth());
  },

  onAuthStateChanged(callback: (user: SyncUser | null) => void): () => void {
    return onAuthStateChanged(requireAuth(), (user) => callback(user ? toSyncUser(user) : null));
  },

  getCurrentUser(): SyncUser | null {
    const current = requireAuth().currentUser;
    return current ? toSyncUser(current) : null;
  },
};