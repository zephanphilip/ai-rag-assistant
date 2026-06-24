'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { getSessionId } from '@/lib/session';

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() =>
    typeof window !== 'undefined' ? getSessionId() : '',
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/rag/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sessionId }),
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (sessionId) {
      try {
        await fetch(`${API_URL}/rag/session/${sessionId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore network errors; reset the UI regardless.
      }
    }
    setMessages([GREETING]);
  }

  return (
    <main className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Handbook Assistant
        </h1>
        <button
          onClick={handleClear}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Clear Chat
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    <span className="font-medium">Sources: </span>
                    {Array.from(new Set(m.sources)).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-zinc-800">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the handbook..."
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
