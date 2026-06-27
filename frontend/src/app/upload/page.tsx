'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authHeaders, getToken, isAdmin, logout } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function UploadPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  // Only admins may reach this page; everyone else is redirected.
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!isAdmin()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setStatus('Please choose a file first.');
      return;
    }

    setUploading(true);
    setStatus('Uploading and processing...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/rag/upload`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: formData,
      });

      if (res.status === 401) {
        logout();
        router.replace('/login');
        return;
      }

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      const data = await res.json();
      setStatus(data.message ?? 'Upload complete.');
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setUploading(false);
    }
  }


  if (!authorized) return null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 text-zinc-100">
      <div className="animate-msg w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg shadow-[0_12px_32px_-8px_rgba(99,102,241,0.9)]">
          ⬆
        </div>
        <h1 className="mt-4 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-semibold text-transparent">
          Upload Handbook
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Add a PDF or text document to the knowledge base.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-white/20"
          />

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_32px_-10px_rgba(99,102,241,0.9)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Processing…' : 'Upload & Process'}
          </button>
        </form>

        {status && (
          <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
            {status}
          </p>
        )}

        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          ← Back to chat
        </Link>
      </div>
    </main>
  );
}
