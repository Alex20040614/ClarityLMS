import React from "react";
import { Icon, TopicChip, PersonChip, StatusPill, TopicDot } from "../components/Common.jsx";
import MathText from "../components/MathText.jsx";
import { hueForTopic, hueForName, formatClassDay, formatClassStartTime, formatTimeRange, taskDueInfo, isClassUpcoming, classStartMs, classStudentNames } from "../data.js";
import { useNow } from "../hooks/useNow.js";

function StatCard({ label, value, sub, icon, topic, onClick }) {
  const h = hueForTopic(topic);
  return (
    <div className={`card stat-card fade-up ${onClick ? "stat-card-clickable" : ""}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-icon" style={{ background: `oklch(0.955 0.032 ${h})`, color: `oklch(0.46 0.12 ${h})` }}>
        <Icon name={icon} />
      </div>
      <div className="stat-value serif">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function ClassRow({ classItem: c, meta, onClick }) {
  return (
    <div className="class-row class-row-clickable" onClick={onClick}>
      <div className="class-time-col wide">
        <div className="class-time">{formatClassDay(c)}</div>
        <div className="class-day">{formatTimeRange(c)}</div>
      </div>
      <div className="class-bar" style={{ background: "oklch(0.6 0.14 235)" }} />
      <div className="class-info">
        <div className="class-title">{c.title}</div>
        <div className="class-meta">{meta}</div>
      </div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div className="list-row list-row-empty">{text}</div>;
}

export default function Dashboard({ role, profile, setView, classes, roster, studentThreads, tutorThreads, studentTasks, tutorTasks, onSelectClass, onSelectQuestion }) {
  const isTutor = role === "tutor";
  const firstName = profile.name.split(" ")[0];
  const awaitingCount = tutorThreads.filter((t) => t.status === "awaiting").length;
  const studentOpenQuestions = studentThreads.filter((t) => t.status === "awaiting").length;
  const studentTasksDue = studentTasks.filter((t) => t.status === "pending").length;
  const tutorTasksToReview = tutorTasks.filter((t) => t.status === "submitted").length;

  const now = useNow();
  const sortedClasses = [...classes]
    .filter((c) => isClassUpcoming(c, now))
    .sort((a, b) => classStartMs(a) - classStartMs(b));
  const upcoming = sortedClasses.slice(0, 3);
  const nextClass = sortedClasses[0];

  const tasksDueList = studentTasks.filter((t) => t.status === "pending").slice(0, 3);
  const tasksReviewList = tutorTasks.filter((t) => t.status === "submitted").slice(0, 3);

  const recentStudentQuestions = studentThreads.slice(0, 3);
  const tutorQuestionsList = tutorThreads.filter((t) => t.status === "awaiting").slice(0, 3);

  return (
    <div className="content-inner">
      <div className="kicker">{isTutor ? `${roster.length} student${roster.length === 1 ? "" : "s"}` : "Student"}</div>
      <h1 className="page-greeting">Good afternoon, {firstName}</h1>
      <p className="page-greeting-sub">
        {isTutor
          ? `${sortedClasses.length} class${sortedClasses.length === 1 ? "" : "es"} scheduled and ${awaitingCount} question${awaitingCount === 1 ? "" : "s"} waiting for a reply.`
          : nextClass
          ? `You have a class on ${formatClassDay(nextClass)} at ${formatClassStartTime(nextClass)} and ${studentTasksDue} task${studentTasksDue === 1 ? "" : "s"} due.`
          : "No classes booked yet — ask your tutor to get one on the schedule."}
      </p>

      <div className="stat-grid">
        {isTutor ? (
          <>
            <StatCard label="Classes scheduled" value={String(sortedClasses.length)} sub={nextClass ? `Next ${formatClassDay(nextClass)}` : "None yet"} icon="event" topic="New assignment" onClick={() => setView("schedule")} />
            <StatCard label="Students" value={String(roster.length)} sub="On your roster" icon="groups" topic="Mixed revision" onClick={() => setView("schedule")} />
            <StatCard label="Questions to answer" value={String(awaitingCount)} sub={awaitingCount > 0 ? "Needs a reply" : "All caught up"} icon="forum" topic="Probability" onClick={() => setView("qna")} />
            <StatCard label="Tasks to review" value={String(tutorTasksToReview)} sub={tutorTasksToReview > 0 ? "Ready to review" : "Nothing submitted yet"} icon="grading" topic="Quadratics" onClick={() => setView("tasks")} />
          </>
        ) : (
          <>
            <StatCard label="Next class" value={nextClass ? formatTimeRange(nextClass) : "—"} sub={nextClass ? formatClassDay(nextClass) : "None booked"} icon="schedule" topic="Quadratics" onClick={() => setView("schedule")} />
            <StatCard label="Tasks due" value={String(studentTasksDue)} sub={studentTasksDue > 0 ? "Check your list" : "All done"} icon="assignment" topic="Mixed revision" onClick={() => setView("tasks")} />
            <StatCard label="Open questions" value={String(studentOpenQuestions)} sub="Awaiting reply" icon="forum" topic="Probability" onClick={() => setView("qna")} />
            <StatCard label="Classes booked" value={String(sortedClasses.length)} sub="Total upcoming" icon="event" topic="New assignment" onClick={() => setView("schedule")} />
          </>
        )}
      </div>

      <div className="dash-columns">
        <div className="card fade-up">
          <div className="card-header">
            <div className="card-title">{isTutor ? "Upcoming classes" : "Upcoming classes"}</div>
            <button className="link-btn" onClick={() => setView("schedule")}>
              View schedule
            </button>
          </div>
          <div>
            {upcoming.length === 0 ? (
              <EmptyRow text={isTutor ? "No classes scheduled yet — create one from Schedule." : "No classes booked yet."} />
            ) : (
              upcoming.map((c) => (
                <ClassRow
                  key={c.id}
                  classItem={c}
                  meta={isTutor ? `With ${classStudentNames(c)}` : `With ${c.tutorName}`}
                  onClick={() => onSelectClass(c.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="dash-right-col">
          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">{isTutor ? "Tasks to review" : "Tasks due"}</div>
            </div>
            <div>
              {(isTutor ? tasksReviewList : tasksDueList).length === 0 ? (
                <EmptyRow text="Nothing here yet." />
              ) : (
                (isTutor ? tasksReviewList : tasksDueList).map((t) => (
                  <div className="list-row list-row-clickable" key={t.id} onClick={() => setView("tasks")}>
                    <TopicDot topic={t.topic} />
                    <div>
                      <div className="list-row-title">
                        <MathText text={t.title} />
                      </div>
                      <div className="list-row-meta">
                        {isTutor ? `Submitted by ${t.studentName}` : taskDueInfo(t).label}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card fade-up">
            <div className="card-header">
              <div className="card-title">{isTutor ? "Questions awaiting you" : "Your recent questions"}</div>
            </div>
            <div>
              {(isTutor ? tutorQuestionsList : recentStudentQuestions).length === 0 ? (
                <EmptyRow text={isTutor ? "You're all caught up — nothing waiting for a reply." : "No questions yet."} />
              ) : (
                (isTutor ? tutorQuestionsList : recentStudentQuestions).map((q) => (
                  <div className="list-row list-row-clickable" key={q.id} onClick={() => onSelectQuestion(q.id)}>
                    {isTutor ? <PersonChip name={q.studentName} hue={hueForName(q.studentName)} /> : <TopicChip topic={q.topic} />}
                    <div style={{ flex: 1 }}>
                      <div className="list-row-title">
                        <MathText text={q.title} />
                      </div>
                    </div>
                    <StatusPill status={q.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="promo-banner fade-up">
        <div className="promo-icon">
          <Icon name="auto_awesome" />
        </div>
        <div>
          <div className="promo-title serif">Study smarter with your AI tutor</div>
          <p className="promo-body">
            Turn any maths problem into a guided, step-by-step study session — and learn to prompt like a pro
            instead of just copying answers.
          </p>
        </div>
        <button className="btn btn-primary promo-btn" onClick={() => setView("ai")}>
          Open AI Tutor
        </button>
      </div>
    </div>
  );
}
