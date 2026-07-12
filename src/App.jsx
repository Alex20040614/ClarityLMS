import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Schedule from "./views/Schedule.jsx";
import QnA from "./views/QnA.jsx";
import Tasks from "./views/Tasks.jsx";
import AITutor from "./views/AITutor.jsx";
import SignIn from "./views/auth/SignIn.jsx";
import SignUp from "./views/auth/SignUp.jsx";
import ChooseRole from "./views/auth/ChooseRole.jsx";
import Settings from "./views/Settings.jsx";
import PrivacyPolicy from "./views/PrivacyPolicy.jsx";
import ClassDetailModal from "./components/ClassDetailModal.jsx";
import { useAuth } from "./auth/useAuth.js";
import { createZoomMeetingForClass } from "./services/zoom.js";
import {
  addClassMaterials,
  addStudentToRoster,
  createClass,
  deleteClass,
  findStudentByEmail,
  removeClassMaterial,
  removeRosterLink,
  subscribeClassesForStudent,
  subscribeClassesForTutor,
  subscribeRoster,
  subscribeTutorsForStudent,
  updateClassNotes,
} from "./services/classroom.js";
import {
  createThread as createQnaThread,
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

export default function App() {
  const auth = useAuth();
  const [authMode, setAuthMode] = useState("signin");
  const [view, setView] = useState("dashboard");

  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [myTutors, setMyTutors] = useState([]);

  const [studentThreads, setStudentThreads] = useState([]);
  const [tutorThreads, setTutorThreads] = useState([]);
  const [activeStudentThreadId, setActiveStudentThreadId] = useState(null);
  const [activeTutorThreadId, setActiveTutorThreadId] = useState(null);

  const [studentTasks, setStudentTasks] = useState([]);
  const [tutorTasks, setTutorTasks] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [zoomBanner, setZoomBanner] = useState(null);

  const profile = auth.profile;
  const isTutor = profile?.role === "tutor";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zoomStatus = params.get("zoom");
    if (zoomStatus) {
      setZoomBanner(zoomStatus === "connected" ? "Zoom account connected." : "Couldn't connect Zoom — try again.");
      params.delete("zoom");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

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

  const awaitingCount = tutorThreads.filter((t) => t.status === "awaiting").length;

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

  async function createStudentThread({ tutorUid, tutorName, title }) {
    const id = await createQnaThread({
      tutorUid,
      tutorName,
      studentUid: profile.uid,
      studentName: profile.name,
      title,
      authorUid: profile.uid,
      authorName: profile.name,
      authorRole: "student",
    });
    setActiveStudentThreadId(id);
  }

  async function postStudentMessage(threadId, text) {
    await postQnaMessage(threadId, { authorUid: profile.uid, author: profile.name, role: "student", text });
  }

  async function createTutorThread({ studentUid, studentName, title }) {
    const id = await createQnaThread({
      tutorUid: profile.uid,
      tutorName: profile.name,
      studentUid,
      studentName,
      title,
      authorUid: profile.uid,
      authorName: profile.name,
      authorRole: "tutor",
    });
    setActiveTutorThreadId(id);
  }

  async function postTutorMessage(threadId, text) {
    await postQnaMessage(threadId, { authorUid: profile.uid, author: profile.name, role: "tutor", text });
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

  async function handleCreateClass(data) {
    const classId = await createClass(profile, data);
    // Best-effort: the class already exists at this point regardless of whether a Zoom meeting
    // can be created, so a Zoom failure here shouldn't surface as a "couldn't create class" error.
    createZoomMeetingForClass(classId).catch(() => {});
  }

  async function handleAddClassMaterials(classId, files) {
    await addClassMaterials(classId, files);
  }

  async function handleRemoveClassMaterial(classId, material) {
    await removeClassMaterial(classId, material);
  }

  async function handleEditClassNotes(classId, notes) {
    await updateClassNotes(classId, notes);
  }

  async function handleDeleteClass(classId) {
    await deleteClass(classId);
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
        return <AITutor />;
      case "settings":
        return <Settings profile={profile} onProfileChange={auth.refreshProfile} />;
      default:
        return null;
    }
  }

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} profile={profile} awaitingCount={awaitingCount} onSignOut={handleSignOut} />
      <div className="main">
        <Header view={view} />
        {zoomBanner && (
          <div className="zoom-banner">
            {zoomBanner}
            <button type="button" className="link-btn" onClick={() => setZoomBanner(null)}>
              Dismiss
            </button>
          </div>
        )}
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
          onDeleteClass={handleDeleteClass}
        />
      )}
    </div>
  );
}
