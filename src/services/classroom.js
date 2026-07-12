import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase.js";

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
    addedAt: serverTimestamp(),
  });
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

export async function createClass(tutorProfile, { students, title, notes, date, time, duration, files }) {
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
    materials: [],
    createdAt: serverTimestamp(),
  });
  if (files && files.length > 0) {
    const materials = await uploadClassFiles(classRef.id, files);
    await updateDoc(classRef, { materials });
  }
  return classRef.id;
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
