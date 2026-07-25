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
import { updateProfileFields, uploadProfilePicture } from "../services/profile.js";

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

  // Google users pick their role AND enter the display name they want shown on the platform, rather
  // than inheriting whatever name their Google account carries.
  async function completeRoleChoice(role, name) {
    if (!user) return;
    await createProfile(user.uid, {
      name: (name && name.trim()) || user.displayName || user.email,
      email: user.email,
      role,
      photoURL: user.photoURL,
    });
  }

  async function updateProfilePhoto(file) {
    if (!user) return;
    const url = await uploadProfilePicture(user.uid, file);
    setProfile((prev) => (prev ? { ...prev, photoURL: url } : prev));
  }

  // Saves editable profile fields ({ name?, photoURL? }) and mirrors them into local state. photoURL
  // may be null to clear a picture back to initials.
  async function saveProfile(fields) {
    if (!user) return;
    const clean = {};
    if (typeof fields.name === "string") clean.name = fields.name;
    if (fields.photoURL !== undefined) clean.photoURL = fields.photoURL;
    if (Object.keys(clean).length === 0) return;
    await updateProfileFields(user.uid, clean);
    setProfile((prev) => (prev ? { ...prev, ...clean } : prev));
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
    updateProfilePhoto,
    saveProfile,
    signOutUser,
    resetPassword,
    refreshProfile,
  };
}
