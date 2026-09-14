import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase.js";
import { recurrenceDates } from "../data.js";

async function uploadClassFiles(classId, files) {
  return Promise.all(
    Array.from(files).map(async (file) => {
      const path = `classAttachments/${classId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return { name: file.name, url, path, size: file.size, type: file.type };
    })
  );
}

export async function findStudentByEmail(email) {
  const q = query(
    collection(db, "users"),
    where("email", "==", email.trim().toLowerCase()),
    where("role", "==", "student")
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export async function addStudentToRoster(tutorProfile, student) {
  await addDoc(collection(db, "rosterLinks"), {
    tutorUid: tutorProfile.uid,
    tutorName: tutorProfile.name,
    studentUid: student.uid,
    studentName: student.name,
    studentEmail: student.email,
    // Remaining prepaid class hours for this student with this tutor. Booked classes draw it down;
    // cancellations feed it back; the tutor can top it up or correct it directly.
    hoursRemaining: 0,
    addedAt: serverTimestamp(),
  });
}

// Sets a student's remaining-hours balance to an exact value (tutor top-up / correction).
export async function setRosterHours(linkId, hours) {
  await updateDoc(doc(db, "rosterLinks", linkId), { hoursRemaining: Number(hours) || 0 });
}

// Applies a signed delta to a student's balance (negative when a class is booked, positive on
// refund). Uses a Firestore increment so concurrent class operations don't clobber each other.
export async function adjustRosterHours(linkId, deltaHours) {
  if (!deltaHours) return;
  await updateDoc(doc(db, "rosterLinks", linkId), { hoursRemaining: increment(deltaHours) });
}

export function subscribeRoster(tutorUid, callback) {
  const q = query(collection(db, "rosterLinks"), where("tutorUid", "==", tutorUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeTutorsForStudent(studentUid, callback) {
  const q = query(collection(db, "rosterLinks"), where("studentUid", "==", studentUid));
  return onSnapshot(q, async (snap) => {
    const links = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Older roster links (created before tutorName was stored on write) need the name backfilled from the tutor's profile.
    const enriched = await Promise.all(
      links.map(async (link) => {
        if (link.tutorName) return link;
        const tutorSnap = await getDoc(doc(db, "users", link.tutorUid));
        return { ...link, tutorName: tutorSnap.exists() ? tutorSnap.data().name : "Your tutor" };
      })
    );
    callback(enriched);
  });
}

export async function removeRosterLink(linkId) {
  await deleteDoc(doc(db, "rosterLinks", linkId));
}

// seriesId groups the sessions created together as one recurring series (null for a one-off class),
// so a series could later be shown or managed as a unit.
export async function createClass(tutorProfile, { students, title, notes, date, time, duration, files, meetingLink, seriesId = null }) {
  const classRef = doc(collection(db, "classes"));
  // startAt is computed here, in the tutor's own browser, so it's an unambiguous absolute instant
  // (JS interprets "date T time" in the local system timezone) — every viewer later renders it
  // back in their own local timezone, so tutor and student each see their own correct time.
  const startAt = new Date(`${date}T${time}`).getTime();
  await setDoc(classRef, {
    tutorUid: tutorProfile.uid,
    tutorName: tutorProfile.name,
    // A class is one shared session — students is the list of everyone attending it, and
    // studentUids is a flat parallel array purely so Firestore can query with array-contains
    // (Firestore can't query array-contains against a field inside an array of objects).
    students,
    studentUids: students.map((s) => s.uid),
    title,
    notes: notes || "",
    date,
    time,
    startAt: Number.isNaN(startAt) ? null : startAt,
    duration: Number(duration),
    // Hours this class bills each attendee — the exact amount to refund on cancellation, kept on the
    // doc so refunds stay correct even if the duration is later changed.
    billedHours: (Number(duration) || 0) / 60,
    // The tutor pastes in a link to whatever meeting they've set up themselves (Zoom, Meet, etc.)
    // rather than the app creating one automatically — see the class-detail modal for editing this later.
    meetingLink: meetingLink || "",
    materials: [],
    seriesId,
    createdAt: serverTimestamp(),
  });
  if (files && files.length > 0) {
    const materials = await uploadClassFiles(classRef.id, files);
    await updateDoc(classRef, { materials });
  }
  return classRef.id;
}

// Batch-creates a recurring series: the same class details repeated across every date the rule
// produces. Each session is an independent class doc (its own id, its own copy of any attachments
// under classAttachments/{classId} — required by Storage rules, which key access to a real class
// doc), tagged with a shared seriesId. Created sequentially so a mid-way failure surfaces clearly
// with the earlier sessions already saved, rather than silently leaving an unknown partial set.
export async function createRecurringClasses(tutorProfile, data, { frequency, count }) {
  const dates = recurrenceDates(data.date, frequency, count);
  const seriesId = doc(collection(db, "classes")).id;
  const ids = [];
  for (const date of dates) {
    ids.push(await createClass(tutorProfile, { ...data, date, seriesId }));
  }
  return ids;
}

export async function updateClassMeetingLink(classId, meetingLink) {
  await updateDoc(doc(db, "classes", classId), { meetingLink });
}

// Replaces an existing class's attendee list — used both when adding students and when removing
// one. Receives the full new attendee list and keeps the flat studentUids array in sync, so
// array-contains queries and the read rule (which gate a student's access to the class on
// membership in studentUids) stay correct; a removed student loses access as soon as this lands.
export async function setClassStudents(classId, students) {
  await updateDoc(doc(db, "classes", classId), {
    students,
    studentUids: students.map((s) => s.uid),
  });
}

// Reschedules a class. Recomputes the absolute startAt from the new date/time (in the editing tutor's
// local timezone, matching how classes are created) so every viewer still renders the correct instant.
export async function updateClassTime(classId, { date, time, duration }) {
  const startAt = new Date(`${date}T${time}`).getTime();
  await updateDoc(doc(db, "classes", classId), {
    date,
    time,
    startAt: Number.isNaN(startAt) ? null : startAt,
    duration: Number(duration),
    billedHours: (Number(duration) || 0) / 60,
  });
}

export async function addClassMaterials(classId, files) {
  const materials = await uploadClassFiles(classId, files);
  await updateDoc(doc(db, "classes", classId), { materials: arrayUnion(...materials) });
}

export async function removeClassMaterial(classId, material) {
  await deleteObject(ref(storage, material.path)).catch(() => {});
  await updateDoc(doc(db, "classes", classId), { materials: arrayRemove(material) });
}

export async function updateClassNotes(classId, notes) {
  await updateDoc(doc(db, "classes", classId), { notes });
}

export async function deleteClass(classId) {
  await deleteDoc(doc(db, "classes", classId));
}

// Deletes every session in a recurring series. Takes the ids the client already holds from its live
// classes subscription (rather than re-querying by seriesId) — each delete is authorised one-by-one
// by the existing per-class rule (tutorUid == auth.uid), so no seriesId query/index is needed.
export async function deleteClassSeries(classIds) {
  await Promise.all(classIds.map((id) => deleteDoc(doc(db, "classes", id))));
}

export function subscribeClassesForTutor(tutorUid, callback) {
  const q = query(collection(db, "classes"), where("tutorUid", "==", tutorUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeClassesForStudent(studentUid, callback) {
  const q = query(collection(db, "classes"), where("studentUids", "array-contains", studentUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
