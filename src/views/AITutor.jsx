import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Common.jsx";
import MathText from "../components/MathText.jsx";
import { AI_GREETING, SUGGESTED_PROMPTS, PROMPT_TIPS, formatMessageTime } from "../data.js";
import { getChatTitle, getCoachReply } from "../services/ai.js";
import { isFirebaseConfigured } from "../firebase.js";
import { createAiChat, deleteAiChat, subscribeAiChats, updateAiChat, updateAiChatTitle } from "../services/aiChat.js";

let idCounter = 1;
function nextId() {
  return idCounter++;
}

function greetingMessage() {
  return { id: nextId(), role: "assistant", text: AI_GREETING };
}

// Stored chats keep only { role, text }; re-key them for React when loading back in.
function withIds(messages) {
  return messages.map((m) => ({ id: nextId(), role: m.role, text: m.text }));
}

export default function AITutor({ profile }) {
  const [messages, setMessages] = useState([greetingMessage()]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  // Tracked in a ref too so the async send handler always sees the current chat
  // id (state closures would otherwise capture a stale value mid-request).
  const activeChatIdRef = useRef(null);

  const canPersist = isFirebaseConfigured && Boolean(profile?.uid);

  useEffect(() => {
    if (!canPersist) return;
    return subscribeAiChats(profile.uid, setChats);
  }, [canPersist, profile?.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  function setActiveChat(id) {
    activeChatIdRef.current = id;
    setActiveChatId(id);
  }

  async function persist(allMessages) {
    if (!canPersist) return;
    try {
      if (activeChatIdRef.current) {
        await updateAiChat(activeChatIdRef.current, allMessages);
      } else {
        // Save immediately with the first-message fallback title so the chat
        // appears in history right away, then refine it into a concise
        // AI-generated summary in the background.
        const id = await createAiChat(profile.uid, allMessages);
        setActiveChat(id);
        getChatTitle(allMessages.map((m) => ({ role: m.role, text: m.text }))).then((title) => {
          if (title) updateAiChatTitle(id, title).catch((err) => console.error("Failed to save chat title:", err));
        });
      }
    } catch (err) {
      console.error("Failed to save AI chat:", err);
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg = { id: nextId(), role: "user", text: trimmed };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);

    const reply = await getCoachReply(withUser.map((m) => ({ role: m.role, text: m.text })));

    const withReply = [...withUser, { id: nextId(), role: "assistant", text: reply }];
    setMessages(withReply);
    setSending(false);
    persist(withReply);
  }

  function startNewChat() {
    if (sending) return;
    setActiveChat(null);
    setMessages([greetingMessage()]);
    setDraft("");
  }

  function openChat(chat) {
    if (sending) return;
    setActiveChat(chat.id);
    setMessages(withIds(chat.messages || []));
    setDraft("");
  }

  async function handleDeleteChat(e, chatId) {
    e.stopPropagation();
    try {
      await deleteAiChat(chatId);
    } catch (err) {
      console.error("Failed to delete AI chat:", err);
      return;
    }
    if (activeChatIdRef.current === chatId) startNewChat();
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
          {canPersist && (
            <div className="card ai-sidebar-card">
              <div className="ai-history-head">
                <div className="ai-sidebar-title mono" style={{ marginBottom: 0 }}>Chat history</div>
                <button className="ai-new-chat-btn" onClick={startNewChat} disabled={sending}>
                  <Icon name="add" />
                  New chat
                </button>
              </div>
              {chats.length === 0 ? (
                <p className="ai-history-empty">Your past chats with the AI tutor will show up here.</p>
              ) : (
                <div className="ai-history-list">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`ai-history-item ${chat.id === activeChatId ? "active" : ""}`}
                      onClick={() => openChat(chat)}
                    >
                      <div className="ai-history-text">
                        <div className="ai-history-title">
                          <MathText text={chat.title} />
                        </div>
                        <div className="ai-history-time">{formatMessageTime(chat.updatedAtMs)}</div>
                      </div>
                      <button
                        className="ai-history-delete"
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        aria-label="Delete chat"
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
