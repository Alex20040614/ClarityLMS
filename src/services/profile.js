import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase.js";

// Uploads a new profile picture to profilePictures/{uid}/... and points the user's photoURL at it.
// Returns the download URL so the caller can update local state without re-fetching.
export async function uploadProfilePicture(uid, file) {
  const path = `profilePictures/${uid}/${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  return url;
}

// Updates editable profile fields (name and/or photoURL). photoURL may be a Storage URL, an inline
// avatar data URI, or null to fall back to initials. Role/uid/email aren't editable (locked by rules).
export async function updateProfileFields(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}
