import { addDoc, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";

function makeMessage({ authorUid, author, role, text }) {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorUid,
    author,
    role,
    text,
    time: Date.now(),
  };
}

export async function createThread({ tutorUid, tutorName, studentUid, studentName, title, authorUid, authorName, authorRole }) {
  const ref = await addDoc(collection(db, "qnaThreads"), {
    tutorUid,
    tutorName,
    studentUid,
    studentName,
    topic: "General",
    title,
    status: authorRole === "tutor" ? "answered" : "awaiting",
    messages: [makeMessage({ authorUid, author: authorName, role: authorRole, text: title })],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function postMessage(threadId, { authorUid, author, role, text }) {
  await updateDoc(doc(db, "qnaThreads", threadId), {
    status: role === "tutor" ? "answered" : "awaiting",
    messages: arrayUnion(makeMessage({ authorUid, author, role, text })),
  });
}

export function subscribeThreadsForTutor(tutorUid, callback) {
  const q = query(collection(db, "qnaThreads"), where("tutorUid", "==", tutorUid));
  return onSnapshot(q, (snap) => {
    callback(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  });
}

export function subscribeThreadsForStudent(studentUid, callback) {
  const q = query(collection(db, "qnaThreads"), where("studentUid", "==", studentUid));
  return onSnapshot(q, (snap) => {
    callback(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  });
}

function sortByCreatedAtDesc(threads) {
  return [...threads].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
