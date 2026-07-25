import React, { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Schedule from "./views/Schedule.jsx";
import QnA from "./views/QnA.jsx";
import Tasks from "./views/Tasks.jsx";
import AITutor from "./views/AITutor.jsx";
import Booking from "./views/Booking.jsx";
import Profile from "./views/Profile.jsx";
import SignIn from "./views/auth/SignIn.jsx";
import SignUp from "./views/auth/SignUp.jsx";
import ChooseRole from "./views/auth/ChooseRole.jsx";
import PrivacyPolicy from "./views/PrivacyPolicy.jsx";
import ClassDetailModal from "./components/ClassDetailModal.jsx";
import { useAuth } from "./auth/useAuth.js";
import { findClassConflict, formatClassDay, formatClassStartTime, classStartMs, classStudents, classStudentNames, formatHours } from "./data.js";
import DailyDebriefModal from "./components/DailyDebriefModal.jsx";
import {
  addClassMaterials,
  addClassStudents,
  addStudentToRoster,
  createClass,
  createRecurringClasses,
  deleteClass,
  deleteClassSeries,
  findStudentByEmail,
  adjustRosterHours,
  removeClassMaterial,
  removeRosterLink,
  setRosterHours,
  subscribeClassesForStudent,
  subscribeClassesForTutor,
  subscribeRoster,
  subscribeTutorsForStudent,
  updateClassMeetingLink,
  updateClassNotes,
  updateClassTime,
} from "./services/classroom.js";
import {
  createThread as createQnaThread,
  deleteMessage as deleteQnaMessage,
  deleteThread as deleteQnaThread,
  editMessage as editQnaMessage,
  markThreadSeenByStudent,
  postMessage as postQnaMessage,
  subscribeThreadsForStudent,
  subscribeThreadsForTutor,
} from "./services/qna.js";
import {
  createTask,
  deleteTask,
  markTaskReviewed,
  removeTaskAttachment,
  submitTask,
  subscribeTasksForStudent,
  subscribeTasksForTutor,
  updateTaskNotes,
  updateTaskTitle,
} from "./services/tasks.js";
import {
  setAvailableSlots,
  subscribeAvailability,
  syncTutorBusy,
} from "./services/availability.js";
import {
  acceptClassRequest,
  cancelClassRequest,
  createClassRequest,
  declineClassRequest,
  subscribeRequestsForStudent,
  subscribeRequestsForTutor,
} from "./services/classRequests.js";

// Absolute-time label for a notification, e.g. "Mon 3 Aug · 15:00", in the viewer's local timezone.
function notifWhen(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

// Timestamp of a thread's most recent message, used to sort notifications and to tell whether a
// student has seen the latest reply (studentSeenAt is stamped when they open the thread).
function threadLastTs(thread) {
  const times = (thread.messages || []).map((m) => m.time).filter(Boolean);
  return times.length ? Math.max(...times) : (thread.createdAt?.seconds || 0) * 1000;
}

// Keeps the visible view in sync with the URL so a refresh (or back/forward) lands back on the
// same page instead of always resetting to the dashboard.
const VIEW_TO_PATH = {
  dashboard: "/",
  schedule: "/schedule",
  qna: "/qna",
  tasks: "/tasks",
  ai: "/ai",
  profile: "/profile",
  booking: "/booking",
};
const PATH_TO_VIEW = Object.fromEntries(Object.entries(VIEW_TO_PATH).map(([v, p]) => [p, v]));

function viewFromPath(pathname) {
  return PATH_TO_VIEW[pathname] || "dashboard";
}

export default function App() {
  const auth = useAuth();
  const [authMode, setAuthMode] = useState("signin");
  const [view, setViewState] = useState(() => viewFromPath(window.location.pathname));

  function setView(next) {
    setViewState(next);
    const path = VIEW_TO_PATH[next] || "/";
    if (window.location.pathname !== path) {
      window.history.pushState({ view: next }, "", path);
    }
  }

  useEffect(() => {
    function handlePopState() {
      setViewState(viewFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [myTutors, setMyTutors] = useState([]);

  const [studentThreads, setStudentThreads] = useState([]);
  const [tutorThreads, setTutorThreads] = useState([]);
  const [activeStudentThreadId, setActiveStudentThreadId] = useState(null);
  const [activeTutorThreadId, setActiveTutorThreadId] = useState(null);

  const [studentTasks, setStudentTasks] = useState([]);
  const [tutorTasks, setTutorTasks] = useState([]);

  const [tutorRequests, setTutorRequests] = useState([]);
  const [studentRequests, setStudentRequests] = useState([]);
  const [ownAvailability, setOwnAvailability] = useState({ available: [], busy: [] });
  const [selectedBookingTutorUid, setSelectedBookingTutorUid] = useState(null);
  const [bookingTutorAvailability, setBookingTutorAvailability] = useState({ available: [], busy: [] });
  const busySignatureRef = useRef("");

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showDebrief, setShowDebrief] = useState(false);

  const profile = auth.profile;
  const isTutor = profile?.role === "tutor";

  useEffect(() => {
    if (!profile) return;
    const callback = (docs) => setClasses(docs);
    const unsub = isTutor
      ? subscribeClassesForTutor(profile.uid, callback)
      : subscribeClassesForStudent(profile.uid, callback);
    return unsub;
  }, [profile?.uid, isTutor]);

  useEffect(() => {
    if (!profile || !isTutor) {
      setRoster([]);
      return;
    }
    return subscribeRoster(profile.uid, setRoster);
  }, [profile?.uid, isTutor]);

  useEffect(() => {
    if (!profile || isTutor) {
      setMyTutors([]);
      return;
    }
    return subscribeTutorsForStudent(profile.uid, setMyTutors);
  }, [profile?.uid, isTutor]);

  useEffect(() => {
    if (!profile) return;
    return isTutor
      ? subscribeThreadsForTutor(profile.uid, setTutorThreads)
      : subscribeThreadsForStudent(profile.uid, setStudentThreads);
  }, [profile?.uid, isTutor]);

  useEffect(() => {
    if (!profile) return;
    return isTutor
      ? subscribeTasksForTutor(profile.uid, setTutorTasks)
      : subscribeTasksForStudent(profile.uid, setStudentTasks);
  }, [profile?.uid, isTutor]);

  // Class requests: tutors watch requests sent to them, students watch their own.
  useEffect(() => {
    if (!profile) return;
    return isTutor
      ? subscribeRequestsForTutor(profile.uid, setTutorRequests)
      : subscribeRequestsForStudent(profile.uid, setStudentRequests);
  }, [profile?.uid, isTutor]);

  // A tutor reads their own availability doc (for the editor); a student reads the availability of
  // whichever tutor they're currently booking with.
  useEffect(() => {
    if (!profile || !isTutor) return;
    return subscribeAvailability(profile.uid, setOwnAvailability);
  }, [profile?.uid, isTutor]);

  useEffect(() => {
    if (!profile || isTutor || !selectedBookingTutorUid) {
      setBookingTutorAvailability({ available: [], busy: [] });
      return;
    }
    return subscribeAvailability(selectedBookingTutorUid, setBookingTutorAvailability);
  }, [profile?.uid, isTutor, selectedBookingTutorUid]);

  // Default the student's booking tutor to their first linked tutor once tutors load.
  useEffect(() => {
    if (isTutor) return;
    if (!selectedBookingTutorUid && myTutors.length > 0) {
      setSelectedBookingTutorUid(myTutors[0].tutorUid);
    }
  }, [isTutor, myTutors, selectedBookingTutorUid]);

  // Keep the tutor's privacy-safe busy feed in sync with their classes, so students see taken slots
  // without being able to read the underlying class docs. Runs whenever the tutor's classes change.
  useEffect(() => {
    if (!profile || !isTutor) return;
    let cancelled = false;
    (async () => {
      const sig = await syncTutorBusy(profile.uid, classes, busySignatureRef.current);
      if (!cancelled) busySignatureRef.current = sig;
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, isTutor, classes]);

  const awaitingCount = tutorThreads.filter((t) => t.status === "awaiting").length;
  const pendingRequestCount = tutorRequests.filter((r) => r.status === "pending").length;

  async function submitStudentTask(taskId, { files, note }) {
    await submitTask(taskId, { files, note });
  }

  async function assignTutorTask({ students, title, notes, dueDate, dueTime, files }) {
    await createTask({
      tutorUid: profile.uid,
      tutorName: profile.name,
      students,
      title,
      notes,
      dueDate,
      dueTime,
      files,
    });
  }

  async function createStudentThread({ tutorUid, tutorName, title, files }) {
    const id = await createQnaThread({
      tutorUid,
      tutorName,
      studentUid: profile.uid,
      studentName: profile.name,
      title,
      authorUid: profile.uid,
      authorName: profile.name,
      authorRole: "student",
      files,
    });
    setActiveStudentThreadId(id);
  }

  async function postStudentMessage(threadId, text, files) {
    await postQnaMessage(threadId, { authorUid: profile.uid, author: profile.name, role: "student", text, files });
  }

  async function createTutorThread({ studentUid, studentName, title, files }) {
    const id = await createQnaThread({
      tutorUid: profile.uid,
      tutorName: profile.name,
      studentUid,
      studentName,
      title,
      authorUid: profile.uid,
      authorName: profile.name,
      authorRole: "tutor",
      files,
    });
    setActiveTutorThreadId(id);
  }

  async function postTutorMessage(threadId, text, files) {
    await postQnaMessage(threadId, { authorUid: profile.uid, author: profile.name, role: "tutor", text, files });
  }

  async function handleAddStudent(email) {
    const student = await findStudentByEmail(email);
    if (!student) {
      throw new Error("No student account found with that email.");
    }
    if (roster.some((r) => r.studentUid === student.uid)) {
      throw new Error("That student is already on your roster.");
    }
    await addStudentToRoster(profile, student);
  }

  // Applies a signed hours delta to each student's balance (their rosterLink with this tutor).
  // Negative deducts (class booked), positive refunds (class cancelled). Non-roster uids are skipped.
  async function adjustHoursForStudents(studentUids, deltaHours) {
    if (!deltaHours) return;
    await Promise.all(
      studentUids.map((uid) => {
        const link = roster.find((r) => r.studentUid === uid);
        return link ? adjustRosterHours(link.id, deltaHours) : Promise.resolve();
      })
    );
  }

  async function handleSetStudentHours(linkId, hours) {
    await setRosterHours(linkId, hours);
  }

  async function handleCreateClass(data) {
    await createClass(profile, data);
    await adjustHoursForStudents(data.students.map((s) => s.uid), -(Number(data.duration) || 0) / 60);
  }

  async function handleCreateRecurringClasses(data, recurrence) {
    const ids = await createRecurringClasses(profile, data, recurrence);
    const perStudent = ((Number(data.duration) || 0) / 60) * ids.length;
    await adjustHoursForStudents(data.students.map((s) => s.uid), -perStudent);
  }

  async function handleSetAvailability(slotKeys) {
    await setAvailableSlots(profile.uid, slotKeys);
  }

  async function handleRequestClass(payload) {
    await createClassRequest({
      ...payload,
      studentUid: profile.uid,
      studentName: profile.name,
    });
  }

  async function handleAcceptRequest(request) {
    // Accepting turns the request into a real class, so guard against it clashing with one already
    // on the tutor's schedule (e.g. two students requested the same slot, or a class was booked
    // after this request came in).
    const conflict = findClassConflict(classes, request.startAt, request.duration);
    if (conflict) {
      throw new Error(
        `This clashes with an existing class (“${conflict.title}”, ${formatClassDay(conflict)} at ${formatClassStartTime(conflict)}). Decline it or move the other class first.`
      );
    }
    const hoursNeeded = (Number(request.duration) || 60) / 60;
    const link = roster.find((r) => r.studentUid === request.studentUid);
    const balance = link?.hoursRemaining ?? 0;
    if (balance < hoursNeeded) {
      const ok = window.confirm(
        `${request.studentName} has only ${formatHours(balance)} remaining but this class needs ${formatHours(hoursNeeded)}. Accept anyway? Their balance will go negative.`
      );
      if (!ok) return;
    }
    await acceptClassRequest(request, profile);
    await adjustHoursForStudents([request.studentUid], -hoursNeeded);
  }

  async function handleDeclineRequest(requestId) {
    await declineClassRequest(requestId);
  }

  async function handleCancelRequest(requestId) {
    await cancelClassRequest(requestId);
  }

  async function handleAddClassMaterials(classId, files) {
    await addClassMaterials(classId, files);
  }

  async function handleAddClassStudents(classId, students) {
    const cls = classes.find((c) => c.id === classId);
    const billed = cls ? cls.billedHours ?? (Number(cls.duration) || 0) / 60 : 0;
    const prevUids = new Set(classStudents(cls || {}).map((s) => s.uid));
    const addedUids = students.filter((s) => !prevUids.has(s.uid)).map((s) => s.uid);
    const short = addedUids.filter((uid) => (roster.find((r) => r.studentUid === uid)?.hoursRemaining ?? 0) < billed);
    if (billed > 0 && short.length > 0) {
      const names = short.map((uid) => roster.find((r) => r.studentUid === uid)?.studentName || "A student").join(", ");
      const ok = window.confirm(
        `${names} ${short.length === 1 ? "does" : "do"} not have enough hours for this class (${formatHours(billed)}). Add anyway? Their balance will go negative.`
      );
      if (!ok) return;
    }
    await addClassStudents(classId, students);
    await adjustHoursForStudents(addedUids, -billed);
  }

  async function handleRemoveClassMaterial(classId, material) {
    await removeClassMaterial(classId, material);
  }

  async function handleEditClassNotes(classId, notes) {
    await updateClassNotes(classId, notes);
  }

  async function handleEditClassMeetingLink(classId, meetingLink) {
    await updateClassMeetingLink(classId, meetingLink);
  }

  async function handleEditClassTime(classId, { date, time, duration }) {
    // Rescheduling can't drop the class onto a time that overlaps another of the tutor's classes;
    // ignore this class itself so shrinking/nudging its own time never counts as a self-clash.
    const startMs = new Date(`${date}T${time}`).getTime();
    const conflict = findClassConflict(classes, startMs, Number(duration), classId);
    if (conflict) {
      throw new Error(
        `That time clashes with an existing class (“${conflict.title}”, ${formatClassDay(conflict)} at ${formatClassStartTime(conflict)}). Pick another time or length.`
      );
    }
    const cls = classes.find((c) => c.id === classId);
    await updateClassTime(classId, { date, time, duration });
    // If the length changed, reconcile each attendee's balance by the difference in billed hours.
    const oldBilled = cls ? cls.billedHours ?? (Number(cls.duration) || 0) / 60 : 0;
    const delta = (Number(duration) || 0) / 60 - oldBilled;
    if (delta && cls) await adjustHoursForStudents(classStudents(cls).map((s) => s.uid), -delta);
  }

  async function handleDeleteClass(classId) {
    const cls = classes.find((c) => c.id === classId);
    await deleteClass(classId);
    if (cls) {
      const refund = cls.billedHours ?? (Number(cls.duration) || 0) / 60;
      await adjustHoursForStudents(classStudents(cls).map((s) => s.uid), refund);
    }
    setSelectedClassId(null);
  }

  async function handleDeleteClassSeries(seriesId) {
    const seriesClasses = classes.filter((c) => c.seriesId === seriesId);
    await deleteClassSeries(seriesClasses.map((c) => c.id));
    for (const c of seriesClasses) {
      const refund = c.billedHours ?? (Number(c.duration) || 0) / 60;
      await adjustHoursForStudents(classStudents(c).map((s) => s.uid), refund);
    }
    setSelectedClassId(null);
  }

  async function handleRemoveTaskAttachment(taskId, attachment) {
    await removeTaskAttachment(taskId, attachment);
  }

  async function handleEditTaskTitle(taskId, title) {
    await updateTaskTitle(taskId, title);
  }

  async function handleEditTaskNotes(taskId, notes) {
    await updateTaskNotes(taskId, notes);
  }

  async function handleDeleteTask(taskId) {
    await deleteTask(taskId);
  }

  async function handleMarkTaskReviewed(taskId) {
    await markTaskReviewed(taskId);
  }

  async function handleSignOut() {
    await auth.signOutUser();
    setAuthMode("signin");
  }

  async function handleSaveName(name) {
    await auth.saveProfile({ name });
  }

  async function handleSetPhotoURL(url) {
    await auth.saveProfile({ photoURL: url });
  }

  function handleSelectQuestion(threadId) {
    if (isTutor) {
      setActiveTutorThreadId(threadId);
    } else {
      setActiveStudentThreadId(threadId);
    }
    setView("qna");
  }

  // Public route, reachable without signing in — needed so the URL can be shared/reviewed directly
  // (e.g. pasted into the Zoom Marketplace submission form) without requiring an account first.
  if (window.location.pathname === "/privacy") {
    return <PrivacyPolicy />;
  }

  if (auth.loading) {
    return <div className="auth-loading">Loading…</div>;
  }

  if (!auth.user) {
    return authMode === "signin" ? (
      <SignIn auth={auth} onSwitchToSignUp={() => setAuthMode("signup")} />
    ) : (
      <SignUp auth={auth} onSwitchToSignIn={() => setAuthMode("signin")} />
    );
  }

  if (!profile) {
    return <ChooseRole auth={auth} />;
  }

  const role = profile.role;
  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;
  const selectedSeriesCount = selectedClass?.seriesId
    ? classes.filter((c) => c.seriesId === selectedClass.seriesId).length
    : 0;

  // The tutor's classes falling on today (viewer-local), sorted by start — powers the daily debrief.
  const todayLabel = new Date().toDateString();
  const todaysClasses = isTutor
    ? classes
        .filter((c) => {
          const ms = classStartMs(c);
          return ms != null && new Date(ms).toDateString() === todayLabel;
        })
        .sort((a, b) => classStartMs(a) - classStartMs(b))
    : [];

  // Things needing the current user's attention, newest first, each linking to where it's handled.
  const notifications = [];
  if (isTutor) {
    if (todaysClasses.length > 0) {
      // Date-keyed id so a new debrief surfaces (and re-lights the unread dot) once each day.
      const dayKey = new Date().toISOString().slice(0, 10);
      notifications.push({
        id: `debrief-${dayKey}`,
        icon: "today",
        title: `Today's debrief: ${todaysClasses.length} ${todaysClasses.length === 1 ? "class" : "classes"}`,
        meta: todaysClasses.map((c) => classStudentNames(c)).join(", "),
        ts: Date.now(),
        onClick: () => setShowDebrief(true),
      });
    }
    for (const r of tutorRequests) {
      if (r.status === "pending") {
        notifications.push({ id: `req-${r.id}`, icon: "event_available", title: `${r.studentName} requested a class`, meta: notifWhen(r.startAt), ts: (r.createdAt?.seconds || 0) * 1000 || r.startAt, onClick: () => setView("booking") });
      }
    }
    for (const t of tutorThreads) {
      if (t.status === "awaiting") {
        notifications.push({ id: `qna-${t.id}`, icon: "forum", title: `${t.studentName} asked a question`, meta: t.title, ts: threadLastTs(t), onClick: () => handleSelectQuestion(t.id) });
      }
    }
    for (const tk of tutorTasks) {
      if (tk.status === "submitted") {
        notifications.push({ id: `task-${tk.id}`, icon: "assignment_turned_in", title: `${tk.studentName} submitted a task`, meta: tk.title, ts: (tk.submission?.submittedAt?.seconds || 0) * 1000, onClick: () => setView("tasks") });
      }
    }
  } else {
    for (const t of studentThreads) {
      if (t.status === "answered" && threadLastTs(t) > (t.studentSeenAt || 0)) {
        notifications.push({ id: `qna-${t.id}`, icon: "forum", title: `${t.tutorName} answered your question`, meta: t.title, ts: threadLastTs(t), onClick: () => handleSelectQuestion(t.id) });
      }
    }
    for (const r of studentRequests) {
      if ((r.status === "accepted" || r.status === "declined") && r.startAt + (Number(r.duration) || 60) * 60000 > Date.now()) {
        notifications.push({ id: `req-${r.id}`, icon: "event_available", title: `Class request ${r.status}`, meta: `${r.tutorName} · ${notifWhen(r.startAt)}`, ts: (r.resolvedAt?.seconds || r.createdAt?.seconds || 0) * 1000, onClick: () => setView("booking") });
      }
    }
    for (const tk of studentTasks) {
      if (tk.status === "pending") {
        notifications.push({ id: `task-${tk.id}`, icon: "checklist", title: `New task: ${tk.title}`, meta: tk.dueAt ? `Due ${notifWhen(tk.dueAt)}` : "", ts: (tk.createdAt?.seconds || 0) * 1000, onClick: () => setView("tasks") });
      }
    }
  }
  notifications.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  function renderView() {
    switch (view) {
      case "dashboard":
        return (
          <Dashboard
            role={role}
            profile={profile}
            setView={setView}
            classes={classes}
            roster={roster}
            studentThreads={studentThreads}
            tutorThreads={tutorThreads}
            studentTasks={studentTasks}
            tutorTasks={tutorTasks}
            onSelectClass={setSelectedClassId}
            onSelectQuestion={handleSelectQuestion}
          />
        );
      case "schedule":
        return (
          <Schedule
            role={role}
            profile={profile}
            classes={classes}
            roster={roster}
            onAddStudent={handleAddStudent}
            onRemoveStudent={removeRosterLink}
            onCreateClass={handleCreateClass}
            onCreateRecurringClasses={handleCreateRecurringClasses}
            onSetStudentHours={handleSetStudentHours}
            onSelectClass={setSelectedClassId}
          />
        );
      case "qna":
        return role === "student" ? (
          <QnA
            role={role}
            profile={profile}
            threads={studentThreads}
            activeId={activeStudentThreadId}
            setActiveId={setActiveStudentThreadId}
            onPost={postStudentMessage}
            onNewQuestion={createStudentThread}
            onEditMessage={editQnaMessage}
            onDeleteMessage={deleteQnaMessage}
            onDeleteThread={deleteQnaThread}
            onMarkSeen={markThreadSeenByStudent}
            tutors={myTutors}
          />
        ) : (
          <QnA
            role={role}
            profile={profile}
            threads={tutorThreads}
            activeId={activeTutorThreadId}
            setActiveId={setActiveTutorThreadId}
            onPost={postTutorMessage}
            onNewQuestion={createTutorThread}
            onEditMessage={editQnaMessage}
            onDeleteMessage={deleteQnaMessage}
            onDeleteThread={deleteQnaThread}
            roster={roster}
          />
        );
      case "tasks":
        return (
          <Tasks
            role={role}
            studentTasks={studentTasks}
            onSubmitStudentTask={submitStudentTask}
            tutorTasks={tutorTasks}
            roster={roster}
            onAssignTutorTask={assignTutorTask}
            onRemoveTaskAttachment={handleRemoveTaskAttachment}
            onEditTaskTitle={handleEditTaskTitle}
            onEditTaskNotes={handleEditTaskNotes}
            onDeleteTask={handleDeleteTask}
            onMarkTaskReviewed={handleMarkTaskReviewed}
          />
        );
      case "ai":
        return <AITutor profile={profile} />;
      case "profile":
        return (
          <Profile
            profile={profile}
            onSaveName={handleSaveName}
            onUploadPhoto={auth.updateProfilePhoto}
            onSetPhotoURL={handleSetPhotoURL}
          />
        );
      case "booking":
        return (
          <Booking
            role={role}
            profile={profile}
            availability={ownAvailability}
            requests={role === "tutor" ? tutorRequests : studentRequests}
            onSetAvailability={handleSetAvailability}
            onAccept={handleAcceptRequest}
            onDecline={handleDeclineRequest}
            tutors={myTutors}
            selectedTutorUid={selectedBookingTutorUid}
            onSelectTutor={setSelectedBookingTutorUid}
            tutorAvailability={bookingTutorAvailability}
            onRequest={handleRequestClass}
            onCancel={handleCancelRequest}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={setView}
        profile={profile}
        awaitingCount={awaitingCount}
        bookingCount={pendingRequestCount}
        onSignOut={handleSignOut}
      />
      <div className="main">
        <Header view={view} notifications={notifications} userId={profile.uid} />
        <div className="content">{renderView()}</div>
      </div>
      {selectedClass && (
        <ClassDetailModal
          classItem={selectedClass}
          isTutor={isTutor}
          onClose={() => setSelectedClassId(null)}
          onAddMaterials={handleAddClassMaterials}
          onRemoveMaterial={handleRemoveClassMaterial}
          onEditNotes={handleEditClassNotes}
          onEditMeetingLink={handleEditClassMeetingLink}
          onEditTime={handleEditClassTime}
          onDeleteClass={handleDeleteClass}
          onDeleteClassSeries={handleDeleteClassSeries}
          seriesCount={selectedSeriesCount}
          roster={roster}
          classes={classes}
          onAddStudents={handleAddClassStudents}
        />
      )}
      {showDebrief && <DailyDebriefModal classes={todaysClasses} onClose={() => setShowDebrief(false)} />}
    </div>
  );
}
