import { arrayRemove, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase.js";

async function uploadFiles(taskId, folder, files) {
  return Promise.all(
    Array.from(files).map(async (file) => {
      const path = `taskAttachments/${taskId}/${folder}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return { name: file.name, url, path, size: file.size, type: file.type };
    })
  );
}

async function createTaskForStudent({ tutorUid, tutorName, studentUid, studentName, title, notes, dueDate, dueTime, dueAt, files }) {
  const taskRef = doc(collection(db, "tasks"));
  await setDoc(taskRef, {
    tutorUid,
    tutorName,
    studentUid,
    studentName,
    title,
    notes: notes || "",
    topic: "General",
    dueDate,
    dueTime,
    dueAt,
    attachments: [],
    status: "pending",
    submission: null,
    createdAt: serverTimestamp(),
  });
  if (files && files.length > 0) {
    // Uploaded independently per student (rather than sharing one Storage object across their
    // task docs) so that removing an attachment from one student's task can never break another
    // student's copy — see removeTaskAttachment, which deletes the underlying file outright.
    const attachments = await uploadFiles(taskRef.id, "task", files);
    await updateDoc(taskRef, { attachments });
  }
  return taskRef.id;
}

// A task can be assigned to several students at once — each gets their own fully independent
// document (own attachments, own submission, own status), since grading/submission is per-student
// even when the assignment itself was made "to everyone" in one action.
export async function createTask({ tutorUid, tutorName, students, title, notes, dueDate, dueTime, files }) {
  // dueAt is computed here, in the tutor's own browser, so it's an unambiguous absolute instant —
  // every viewer later renders it back in their own local timezone (see classroom.js's createClass
  // for the same reasoning applied to classes).
  const dueAtRaw = new Date(`${dueDate}T${dueTime}`).getTime();
  const dueAt = Number.isNaN(dueAtRaw) ? null : dueAtRaw;
  const taskIds = await Promise.all(
    students.map((student) =>
      createTaskForStudent({
        tutorUid,
        tutorName,
        studentUid: student.uid,
        studentName: student.name,
        title,
        notes,
        dueDate,
        dueTime,
        dueAt,
        files,
      })
    )
  );
  return taskIds;
}

export async function removeTaskAttachment(taskId, attachment) {
  await deleteObject(ref(storage, attachment.path)).catch(() => {});
  await updateDoc(doc(db, "tasks", taskId), { attachments: arrayRemove(attachment) });
}

export async function updateTaskTitle(taskId, title) {
  await updateDoc(doc(db, "tasks", taskId), { title });
}

export async function updateTaskNotes(taskId, notes) {
  await updateDoc(doc(db, "tasks", taskId), { notes });
}

export async function deleteTask(taskId) {
  await deleteDoc(doc(db, "tasks", taskId));
}

export async function submitTask(taskId, { files, note }) {
  const attachments = files && files.length > 0 ? await uploadFiles(taskId, "submission", files) : [];
  await updateDoc(doc(db, "tasks", taskId), {
    status: "submitted",
    submission: {
      attachments,
      note: note || "",
      submittedAt: serverTimestamp(),
    },
  });
}

export async function markTaskReviewed(taskId) {
  await updateDoc(doc(db, "tasks", taskId), { status: "reviewed" });
}

export function subscribeTasksForTutor(tutorUid, callback) {
  const q = query(collection(db, "tasks"), where("tutorUid", "==", tutorUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeTasksForStudent(studentUid, callback) {
  const q = query(collection(db, "tasks"), where("studentUid", "==", studentUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
