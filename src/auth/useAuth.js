import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "../firebase.js";

async function fetchProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfile(await fetchProfile(firebaseUser.uid));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function createProfile(uid, { name, email, role, photoURL }) {
    const data = { uid, name, email, role, photoURL: photoURL || null, createdAt: serverTimestamp() };
    await setDoc(doc(db, "users", uid), data);
    setProfile(data);
  }

  async function signUpWithEmail({ name, email, password, role }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(cred.user.uid, { name, email, role });
  }

  async function signInWithEmail({ email, password }) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signInWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);
    const existing = await fetchProfile(cred.user.uid);
    setUser(cred.user);
    setProfile(existing);
    return { user: cred.user, hasProfile: Boolean(existing) };
  }

  async function completeRoleChoice(role) {
    if (!user) return;
    await createProfile(user.uid, {
      name: user.displayName || user.email,
      email: user.email,
      role,
      photoURL: user.photoURL,
    });
  }

  async function signOutUser() {
    await signOut(auth);
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  }

  // Re-fetches the profile doc — for changes made server-side (e.g. a Cloud Function updating
  // Zoom connection status) that the client's one-time fetch at sign-in wouldn't otherwise see.
  async function refreshProfile() {
    if (!user) return;
    setProfile(await fetchProfile(user.uid));
  }

  return {
    user,
    profile,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    completeRoleChoice,
    signOutUser,
    resetPassword,
    refreshProfile,
  };
}
