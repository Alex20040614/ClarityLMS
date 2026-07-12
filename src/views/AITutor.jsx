import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Common.jsx";
import MathText from "../components/MathText.jsx";
import { AI_GREETING, SUGGESTED_PROMPTS, PROMPT_TIPS } from "../data.js";
import { getCoachReply } from "../services/ai.js";

let idCounter = 1;
function nextId() {
  return idCounter++;
}

export default function AITutor() {
  const [messages, setMessages] = useState([
    { id: nextId(), role: "assistant", text: AI_GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg = { id: nextId(), role: "user", text: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);

    const reply = await getCoachReply(
      nextMessages.map((m) => ({ role: m.role, text: m.text }))
    );

    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: reply }]);
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  }

  function handleTextareaInput(e) {
    setDraft(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  }

  return (
    <div className="content-inner" style={{ height: "100%", maxWidth: 1080 }}>
      <div className="ai-layout">
        <div className="card ai-chat-card">
          <div className="ai-messages" ref={scrollRef}>
            <div className="ai-messages-inner">
              {messages.map((m) => (
                <div className={`ai-message-row ${m.role === "user" ? "user" : ""} fade-up`} key={m.id}>
                  {m.role === "assistant" && (
                    <div className="ai-avatar">
                      <Icon name="auto_awesome" />
                    </div>
                  )}
                  <div className={`ai-bubble ${m.role === "user" ? "user" : "ai"}`}>
                    <MathText text={m.text} />
                  </div>
                </div>
              ))}
              {sending && (
                <div className="ai-message-row fade-up">
                  <div className="ai-avatar">
                    <Icon name="auto_awesome" />
                  </div>
                  <div className="ai-bubble ai typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ai-composer">
            <div className="ai-composer-inner">
              <textarea
                ref={textareaRef}
                placeholder="Ask about a maths problem — or how to study it…"
                value={draft}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(draft)}
                disabled={sending || !draft.trim()}
                aria-label="Send"
              >
                <Icon name="arrow_upward" />
              </button>
            </div>
          </div>
          <div className="ai-disclaimer">
            Clarity coaches your thinking — always check key steps yourself.
          </div>
        </div>

        <div className="ai-sidebar">
          <div className="card ai-sidebar-card">
            <div className="ai-sidebar-title mono">Try asking</div>
            {SUGGESTED_PROMPTS.map((p) => (
              <button className="prompt-chip" key={p} onClick={() => sendMessage(p)} disabled={sending}>
                {p}
              </button>
            ))}
          </div>

          <div className="card ai-sidebar-card">
            <div className="ai-sidebar-title mono">Prompt like a pro</div>
            {PROMPT_TIPS.map((tip) => (
              <div className="tip-row" key={tip.title}>
                <div className="tip-icon">
                  <Icon name={tip.icon} />
                </div>
                <div>
                  <div className="tip-title">{tip.title}</div>
                  <div className="tip-body">{tip.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
