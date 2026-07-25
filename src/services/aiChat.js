import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase.js";

// A short label for a saved chat, taken from the student's first message so the
// history list reads like "Help with quadratics" rather than a generic title.
function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  const base = firstUser?.text?.trim() || "New chat";
  return base.length > 60 ? `${base.slice(0, 57)}…` : base;
}

// Persist only what a conversation needs — the transient UI id is dropped, since
// keys are re-assigned when a chat is loaded back from history.
function toStored(messages) {
  return messages.map((m) => ({ role: m.role, text: m.text }));
}

export async function createAiChat(uid, messages) {
  const now = Date.now();
  const ref = await addDoc(collection(db, "aiChats"), {
    uid,
    title: deriveTitle(messages),
    messages: toStored(messages),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  });
  return ref.id;
}

export async function updateAiChat(chatId, messages) {
  await updateDoc(doc(db, "aiChats", chatId), {
    title: deriveTitle(messages),
    messages: toStored(messages),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

// Patches just the title (used to swap the initial first-message fallback for
// the AI-generated summary) without touching the messages array.
export async function updateAiChatTitle(chatId, title) {
  await updateDoc(doc(db, "aiChats", chatId), { title });
}

export async function deleteAiChat(chatId) {
  await deleteDoc(doc(db, "aiChats", chatId));
}

// Newest-first, sorted client-side (like qnaThreads) so a where + orderBy
// composite index isn't required.
export function subscribeAiChats(uid, callback) {
  const q = query(collection(db, "aiChats"), where("uid", "==", uid));
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    chats.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    callback(chats);
  });
}
