import React from "react";
import { hueForTopic } from "../data.js";

export function Icon({ name, style }) {
  return (
    <span className="icon" style={style}>
      {name}
    </span>
  );
}

export function TopicChip({ topic }) {
  const h = hueForTopic(topic);
  return (
    <span
      className="chip"
      style={{
        background: `oklch(0.955 0.032 ${h})`,
        color: `oklch(0.46 0.12 ${h})`,
      }}
    >
      <span className="chip-dot" style={{ background: `oklch(0.6 0.14 ${h})` }} />
      {topic}
    </span>
  );
}

export function PersonChip({ name, hue }) {
  return (
    <span
      className="chip"
      style={{
        background: `oklch(0.955 0.032 ${hue})`,
        color: `oklch(0.46 0.12 ${hue})`,
      }}
    >
      <span className="chip-dot" style={{ background: `oklch(0.6 0.14 ${hue})` }} />
      {name}
    </span>
  );
}

export function StatusPill({ status }) {
  const isAnswered = status === "answered";
  return (
    <span className={`pill ${isAnswered ? "pill-answered" : "pill-awaiting"}`}>
      {isAnswered ? "Answered" : "Awaiting reply"}
    </span>
  );
}

export function TopicDot({ topic }) {
  const h = hueForTopic(topic);
  return <span className="dot-topic" style={{ background: `oklch(0.6 0.14 ${h})` }} />;
}
