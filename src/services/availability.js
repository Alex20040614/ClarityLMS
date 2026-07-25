import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { classStartMs, classStudents, isClassUpcoming } from "../data.js";

// A tutor's availability lives in one doc keyed by their uid:
//   { tutorUid, available: ["0-09:30", …], busy: [{ startAt, duration }], updatedAt }
// `available` is the recurring weekly template (weekday-HH:MM slot keys). `busy` is a privacy-safe
// projection of the tutor's upcoming classes (times only, no student names/notes) so a student can
// grey out taken slots without being able to read the tutor's other class docs.

export function subscribeAvailability(tutorUid, callback) {
  return onSnapshot(doc(db, "availability", tutorUid), (snap) => {
    callback(snap.exists() ? snap.data() : { available: [], busy: [] });
  });
}

// Toggle a single weekly-template slot on or off. Uses arrayUnion/arrayRemove with merge so the doc
// is created on first use and the busy field is never disturbed.
export async function setSlotAvailable(tutorUid, slotKey, available) {
  await setDoc(
    doc(db, "availability", tutorUid),
    {
      tutorUid,
      available: available ? arrayUnion(slotKey) : arrayRemove(slotKey),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Replace the whole weekly template at once (e.g. a "clear all" action).
export async function setAvailableSlots(tutorUid, slotKeys) {
  await setDoc(
    doc(db, "availability", tutorUid),
    { tutorUid, available: slotKeys, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Derives the busy list from the tutor's own class list and writes it, but only when it actually
// changed (the caller passes the previously-written signature) to avoid a write on every snapshot.
// Returns the new signature so the caller can hold it for next time.
export async function syncTutorBusy(tutorUid, classes, lastSignature) {
  const busy = classes
    .filter((c) => classStudents(c).length > 0 && isClassUpcoming(c))
    .map((c) => ({ startAt: classStartMs(c), duration: Number(c.duration) || 60 }))
    .filter((b) => b.startAt != null)
    .sort((a, b) => a.startAt - b.startAt);
  const signature = JSON.stringify(busy);
  if (signature === lastSignature) return lastSignature;
  await setDoc(doc(db, "availability", tutorUid), { tutorUid, busy }, { merge: true });
  return signature;
}
