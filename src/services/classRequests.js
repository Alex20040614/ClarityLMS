import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";

function pad(n) {
  return String(n).padStart(2, "0");
}

// Derives the naive date/time fallback fields (stored alongside the absolute startAt) in the given
// instant's local timezone — same convention createClass uses.
function localDateTime(ms) {
  const d = new Date(ms);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

// A student asks a tutor for a class at a specific instant. startAt is the absolute booking time
// (computed from the slot in the student's local tz), so acceptance can rebuild the class without
// re-parsing a naive date/time that would otherwise be read in the tutor's tz instead.
export async function createClassRequest({ tutorUid, tutorName, studentUid, studentName, startAt, duration, topic, notes }) {
  const { date, time } = localDateTime(startAt);
  await addDoc(collection(db, "classRequests"), {
    tutorUid,
    tutorName,
    studentUid,
    studentName,
    startAt,
    date,
    time,
    duration: Number(duration),
    topic: topic || "",
    notes: notes || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// Tutor accepts: create the confirmed class from the request (using its absolute startAt so the time
// is exact regardless of whose timezone parses it), then mark the request accepted.
export async function acceptClassRequest(request, tutorProfile) {
  const { date, time } = localDateTime(request.startAt);
  const classRef = doc(collection(db, "classes"));
  await setDoc(classRef, {
    tutorUid: tutorProfile.uid,
    tutorName: tutorProfile.name,
    students: [{ uid: request.studentUid, name: request.studentName }],
    studentUids: [request.studentUid],
    title: request.topic?.trim() || "Tutoring session",
    notes: request.notes || "",
    date,
    time,
    startAt: request.startAt,
    duration: Number(request.duration) || 60,
    billedHours: (Number(request.duration) || 60) / 60,
    meetingLink: "",
    materials: [],
    seriesId: null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "classRequests", request.id), { status: "accepted", classId: classRef.id, resolvedAt: serverTimestamp() });
  return classRef.id;
}

export async function declineClassRequest(requestId) {
  await updateDoc(doc(db, "classRequests", requestId), { status: "declined", resolvedAt: serverTimestamp() });
}

// A student can withdraw their own still-pending request.
export async function cancelClassRequest(requestId) {
  await deleteDoc(doc(db, "classRequests", requestId));
}

export function subscribeRequestsForTutor(tutorUid, callback) {
  const q = query(collection(db, "classRequests"), where("tutorUid", "==", tutorUid));
  return onSnapshot(q, (snap) => {
    callback(sortByStartAt(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  });
}

export function subscribeRequestsForStudent(studentUid, callback) {
  const q = query(collection(db, "classRequests"), where("studentUid", "==", studentUid));
  return onSnapshot(q, (snap) => {
    callback(sortByStartAt(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  });
}

function sortByStartAt(requests) {
  return [...requests].sort((a, b) => (a.startAt || 0) - (b.startAt || 0));
}
