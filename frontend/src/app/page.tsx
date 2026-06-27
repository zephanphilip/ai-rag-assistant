'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionId } from '@/lib/session';
import { authHeaders, getToken, getUser, logout, AuthUser } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Message = {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
};

const GREETING: Message = {
  role: 'assistant',
  text: "Hi! I'm your Employee Handbook Assistant. Ask me anything about the handbook.",
};

interface ReadyDoc {
  documentId: string;
  name: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [documents, setDocuments] = useState<ReadyDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(''); // '' = all documents
  const [sessionId] = useState(() =>
    typeof window !== 'undefined' ? getSessionId() : '',
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  // Buffers driving the typewriter reveal: `target` is everything received so
  // far, `shown` is how many characters are currently displayed.
  const targetRef = useRef('');
  const shownRef = useRef(0);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Cancel any in-flight animation frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Redirect to login if there's no token; otherwise load the current user
  // and the list of documents available to chat against.
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/rag/documents`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) return;
        const all: { documentId: string; name: string; status: string }[] =
          await res.json();
        setDocuments(
          all
            .filter((d) => d.status === 'ready')
            .map((d) => ({ documentId: d.documentId, name: d.name })),
        );
      } catch {
        // Non-fatal: the selector just stays empty (chats all documents).
      }
    })();
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleUnauthorized() {
    logout();
    router.replace('/login');
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  // Update the text of the most recent assistant message (the streaming one).
  function updateLastAssistant(updater: (text: string) => string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, text: updater(last.text) };
      }
      return copy;
    });
  }

  // Typewriter loop: reveals buffered text a few characters per frame so that
  // large chunks (Gemini streams in big bursts) still animate in smoothly.
  // Resolves once everything received has been fully revealed.
  function startReveal(): Promise<void> {
    return new Promise((resolve) => {
      const step = () => {
        const target = targetRef.current;
        if (shownRef.current < target.length) {
          // Ease-out: reveal more when far behind, slowing as it catches up.
          const remaining = target.length - shownRef.current;
          const inc = Math.max(2, Math.min(25, Math.ceil(remaining / 5)));
          shownRef.current = Math.min(target.length, shownRef.current + inc);
          const shownText = target.slice(0, shownRef.current);
          updateLastAssistant(() => shownText);
        }
        if (doneRef.current && shownRef.current >= targetRef.current.length) {
          rafRef.current = null;
          resolve();
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    });
  }

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    // Append the user message and an empty assistant message to stream into.
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      { role: 'assistant', text: '' },
    ]);
    setInput('');
    setStreaming(true);

    // Reset the reveal buffers and start the typewriter animation.
    targetRef.current = '';
    shownRef.current = 0;
    doneRef.current = false;
    const revealDone = startReveal();

    try {
      const res = await fetch(`${API_URL}/rag/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          question,
          sessionId,
          documentId: selectedDocId || undefined,
        }),
      });

      if (res.status === 401) {
        doneRef.current = true;
        handleUnauthorized();
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      // Read the SSE stream; feed tokens into the reveal buffer.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep any incomplete trailing line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload) as { text?: string };
            if (typeof parsed.text === 'string') {
              targetRef.current += parsed.text;
            }
          } catch {
            // Ignore malformed SSE lines.
          }
        }
      }
    } catch {
      if (targetRef.current.length === 0) {
        targetRef.current = 'Sorry, something went wrong. Please try again.';
      }
    } finally {
      // Let the animation finish revealing before re-enabling input.
      doneRef.current = true;
      await revealDone;
      setStreaming(false);
    }
  }

  async function handleClear() {
    if (sessionId) {
      try {
        await fetch(`${API_URL}/rag/session/${sessionId}`, {
          method: 'DELETE',
          headers: { ...authHeaders() },
        });
      } catch {
        // Ignore network errors; reset the UI regardless.
      }
    }
    setMessages([GREETING]);
  }

  const scopeName = selectedDocId
    ? (documents.find((d) => d.documentId === selectedDocId)?.name ??
      'Document')
    : 'All Documents';

  const ghostBtn =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white';

  return (
    <main className="flex h-screen flex-col text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base shadow-[0_8px_24px_-6px_rgba(99,102,241,0.8)]">
            ✦
          </div>
          <div className="leading-tight">
            <h1 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-base font-semibold text-transparent">
              Handbook Assistant
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
                {scopeName}
              </span>
              {user && <span>{user.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Link href="/admin/documents" className={ghostBtn}>
              Documents
            </Link>
          )}
          <button onClick={handleClear} className={ghostBtn}>
            Clear
          </button>
          <button onClick={handleLogout} className={ghostBtn}>
            Logout
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.map((m, i) => {
            const isUser = m.role === 'user';
            const isStreamingMsg =
              streaming && i === messages.length - 1 && !isUser;
            return (
              <div
                key={i}
                className={`animate-msg flex items-end gap-2.5 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {!isUser && (
                  <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs shadow-[0_4px_16px_-4px_rgba(99,102,241,0.8)]">
                    ✦
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)]'
                      : 'rounded-bl-md border border-white/10 bg-white/[0.04] text-zinc-100 backdrop-blur-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {m.text}
                    {isStreamingMsg && (
                      <span className="animate-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-indigo-400 align-middle" />
                    )}
                  </p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2 text-[11px] text-zinc-400">
                      {Array.from(new Set(m.sources)).map((s) => (
                        <span
                          key={s}
                          className="rounded-md bg-white/5 px-1.5 py-0.5 ring-1 ring-inset ring-white/10"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl"
      >
        <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Search in
          </label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            disabled={streaming}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-400/60 disabled:opacity-60 [&>option]:bg-zinc-900"
          >
            <option value="">All Documents</option>
            {documents.map((d) => (
              <option key={d.documentId} value={d.documentId}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm transition-colors focus-within:border-indigo-400/50 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Ask about the handbook..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.9)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {streaming ? (
              <span className="flex gap-1 py-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80" />
              </span>
            ) : (
              <>
                Send
                <span className="text-base leading-none">→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
