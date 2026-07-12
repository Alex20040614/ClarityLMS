import { addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase.js";

async function uploadQnaFiles(threadId, files) {
  return Promise.all(
    Array.from(files).map(async (file) => {
      const path = `qnaAttachments/${threadId}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return { name: file.name, url, path, size: file.size, type: file.type };
    })
  );
}

function makeMessage({ authorUid, author, role, text, attachments = [] }) {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorUid,
    author,
    role,
    text,
    attachments,
    time: Date.now(),
  };
}

export async function createThread({ tutorUid, tutorName, studentUid, studentName, title, authorUid, authorName, authorRole, files }) {
  // The thread doc must exist before we can upload to qnaAttachments/{threadId}/... (Storage rules
  // check it via firestore.exists), so the first message is written without attachments and then
  // patched in once the upload finishes — mirroring how class/task attachments are handled.
  const firstMessage = makeMessage({ authorUid, author: authorName, role: authorRole, text: title });
  const threadRef = await addDoc(collection(db, "qnaThreads"), {
    tutorUid,
    tutorName,
    studentUid,
    studentName,
    topic: "General",
    title,
    status: authorRole === "tutor" ? "answered" : "awaiting",
    messages: [firstMessage],
    createdAt: serverTimestamp(),
  });
  if (files && files.length > 0) {
    const attachments = await uploadQnaFiles(threadRef.id, files);
    await updateDoc(threadRef, { messages: [{ ...firstMessage, attachments }] });
  }
  return threadRef.id;
}

export async function postMessage(threadId, { authorUid, author, role, text, files }) {
  const attachments = files && files.length > 0 ? await uploadQnaFiles(threadId, files) : [];
  await updateDoc(doc(db, "qnaThreads", threadId), {
    status: role === "tutor" ? "answered" : "awaiting",
    messages: arrayUnion(makeMessage({ authorUid, author, role, text, attachments })),
  });
}

// messages live as an array field on the thread doc (not a subcollection), so editing or deleting
// one means writing the whole array back — we pass in the array already held by the UI (from the
// live subscription) rather than re-fetching, since a single-write replace is atomic either way.
export async function editMessage(threadId, messages, messageId, newText) {
  const updated = messages.map((m) => (m.id === messageId ? { ...m, text: newText, editedAt: Date.now() } : m));
  await updateDoc(doc(db, "qnaThreads", threadId), { messages: updated });
}

export async function deleteMessage(threadId, messages, messageId) {
  const target = messages.find((m) => m.id === messageId);
  if (target?.attachments?.length) {
    await Promise.all(target.attachments.map((a) => deleteObject(ref(storage, a.path)).catch(() => {})));
  }
  const updated = messages.filter((m) => m.id !== messageId);
  // status tracks who spoke last so "awaiting reply" queues stay accurate — if the deleted message
  // was the tutor's answer, the thread needs to go back to "awaiting" rather than staying stuck as
  // "answered" with no actual answer left.
  const last = updated[updated.length - 1];
  const status = last && last.role === "tutor" ? "answered" : "awaiting";
  await updateDoc(doc(db, "qnaThreads", threadId), { messages: updated, status });
}

export async function deleteThread(threadId) {
  await deleteDoc(doc(db, "qnaThreads", threadId));
}

// Records when the student last opened a thread, so the dashboard can tell a freshly-answered
// question apart from one the student has already read the reply to.
export async function markThreadSeenByStudent(threadId) {
  await updateDoc(doc(db, "qnaThreads", threadId), { studentSeenAt: Date.now() });
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
