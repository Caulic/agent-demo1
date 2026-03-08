import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4111";
const AGENT_STREAM_URL = `${API_URL}/api/agents/rising-stars-agent/stream`;

const SUGGESTIONS = [
  "2026 年最受关注的前 5 个 JS 项目是什么？",
  "分析一下 React 生态的现状",
  "Bun 和 Node.js 相比有哪些优势？",
  "有哪些值得关注的新兴全栈框架？",
];

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  pending?: boolean;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trimEnd()}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[a-z])(.+)$/gm, "$1")
    .replace(/^(.+[^>])$/gm, (line) =>
      /^<(h[1-3]|ul|ol|li|pre|blockquote)/.test(line) ? line : line)
    .replace(/\n/g, "<br/>");
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setTimeout(autoResize, 0);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build conversation history for the API
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: trimmed });

    try {
      const res = await fetch(AGENT_STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]" || !raw) continue;
          try {
            const chunk = JSON.parse(raw);
            const delta =
              (chunk?.type === "text-delta" && chunk?.payload?.text) ||
              chunk?.textDelta ||
              chunk?.choices?.[0]?.delta?.content ||
              "";
            if (delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + delta, pending: true }
                    : m
                )
              );
            }
          } catch {
            // non-JSON lines (e.g. event: type lines) — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `⚠️ 请求失败：${(err as Error).message}\n\n请检查 API 服务是否启动（${API_URL}）`,
                  pending: false,
                }
              : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, pending: false } : m
        )
      );
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages, autoResize]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={styles.shell}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>⭐</span>
            <span style={styles.logoText}>JS Rising Stars</span>
            <span style={styles.logoBadge}>Playground</span>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.apiTag}>{API_URL}</span>
            {messages.length > 0 && (
              <button style={styles.clearBtn} onClick={handleClear}>
                清空
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main style={styles.main}>
        {isEmpty ? (
          <div style={styles.welcome}>
            <div style={styles.welcomeIcon}>⭐</div>
            <h2 style={styles.welcomeTitle}>JS 生态系统分析助手</h2>
            <p style={styles.welcomeSub}>
              基于 risingstars.js.org 数据，探索最新 JavaScript 趋势
            </p>
            <div style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} style={styles.suggestionBtn} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.msgList}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.msgRow,
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "assistant" && (
                  <div style={styles.avatar}>⭐</div>
                )}
                <div
                  style={{
                    ...styles.bubble,
                    ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant),
                  }}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="msg-content"
                      style={msg.pending && !msg.content ? styles.typing : undefined}
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          ? renderMarkdown(msg.content)
                          : "<span>...</span>",
                      }}
                    />
                  ) : (
                    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                  )}
                  {msg.pending && msg.content && (
                    <span style={styles.cursor} />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input area */}
      <footer style={styles.footer}>
        <div style={styles.inputWrap}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行…"
            rows={1}
            disabled={loading}
          />
          {loading ? (
            <button style={{ ...styles.sendBtn, ...styles.stopBtn }} onClick={handleStop}>
              ■
            </button>
          ) : (
            <button
              style={{
                ...styles.sendBtn,
                ...(input.trim() ? {} : styles.sendBtnDisabled),
              }}
              onClick={() => send(input)}
              disabled={!input.trim()}
            >
              ↑
            </button>
          )}
        </div>
        <p style={styles.hint}>数据来源：bestofjs-static-api.vercel.app</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxWidth: 820,
    margin: "0 auto",
  },
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "0 16px",
    flexShrink: 0,
  },
  headerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
  },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { fontSize: 18 },
  logoText: { fontWeight: 600, fontSize: 15 },
  logoBadge: {
    fontSize: 11,
    background: "rgba(125,211,252,0.15)",
    color: "#7dd3fc",
    border: "1px solid rgba(125,211,252,0.3)",
    borderRadius: 4,
    padding: "1px 6px",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  apiTag: { fontSize: 11, color: "#666", fontFamily: "monospace" },
  clearBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#999",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 16px 8px",
  },
  welcome: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 12,
    textAlign: "center",
  },
  welcomeIcon: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: 600 },
  welcomeSub: { color: "#888", fontSize: 14, maxWidth: 400 },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
    width: "100%",
    maxWidth: 480,
  },
  suggestionBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#ccc",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s",
  },
  msgList: { display: "flex", flexDirection: "column", gap: 20 },
  msgRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
  },
  bubble: {
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.65,
    position: "relative",
  },
  bubbleUser: {
    background: "#1d6fba",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#e0e0e0",
    borderBottomLeftRadius: 4,
  },
  typing: { color: "#666" },
  cursor: {
    display: "inline-block",
    width: 2,
    height: "1em",
    background: "#7dd3fc",
    marginLeft: 2,
    verticalAlign: "middle",
    animation: "blink 1s step-end infinite",
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.07)",
    padding: "12px 16px 16px",
    flexShrink: 0,
  },
  inputWrap: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "8px 8px 8px 14px",
  },
  textarea: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    color: "#e8e8e8",
    fontSize: 14,
    lineHeight: 1.6,
    resize: "none",
    fontFamily: "inherit",
    minHeight: 24,
    maxHeight: 160,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "none",
    background: "#1d6fba",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: "rgba(255,255,255,0.08)",
    color: "#555",
    cursor: "default",
  },
  stopBtn: { background: "#c0392b" },
  hint: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
    marginTop: 8,
  },
};
