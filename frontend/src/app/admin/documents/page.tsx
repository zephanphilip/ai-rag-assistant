'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authHeaders, getToken, isAdmin, logout } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type DocStatus = 'processing' | 'ready' | 'error';

interface DocItem {
  documentId: string;
  name: string;
  filename?: string;
  chunkCount?: number;
  status: DocStatus;
  uploadedAt?: string;
}

const STATUS_STYLES: Record<DocStatus, string> = {
  processing:
    'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  error: 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30',
};

export default function DocumentsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [docName, setDocName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [toDelete, setToDelete] = useState<DocItem | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`${API_URL}/rag/documents`, {
      headers: { ...authHeaders() },
    });
    if (res.status === 401) {
      logout();
      router.replace('/login');
      return;
    }
    if (res.ok) {
      setDocuments(await res.json());
    }
  }, [router]);

  // Admin-only gate.
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
    void refresh();
  }, [router, refresh]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
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
      formData.append('documentName', docName.trim() || file.name);

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
      setDocName('');
      setFile(null);
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const doc = toDelete;
    setToDelete(null);
    try {
      const res = await fetch(`${API_URL}/rag/documents/${doc.documentId}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        await refresh();
      }
    } catch {
      // Ignore; the list simply won't change.
    }
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen p-4 text-zinc-100 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm shadow-[0_8px_24px_-6px_rgba(99,102,241,0.8)]">
              ▦
            </div>
            <h1 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-semibold text-transparent">
              Documents
            </h1>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            ← Back to chat
          </Link>
        </div>

        {/* Upload form */}
        <form
          onSubmit={handleUpload}
          className="mb-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        >
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Document name
            </label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Employee Handbook 2024"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
            />
          </div>
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-300 file:mr-4 file:cursor-pointer file:border-0 file:bg-white/10 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-white/20"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_32px_-10px_rgba(99,102,241,0.9)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Processing…' : 'Upload & Process'}
          </button>
          {status && (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
              {status}
            </p>
          )}
        </form>

        {/* Documents table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_-25px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Chunks</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-zinc-500"
                  >
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
              {documents.map((doc) => (
                <tr
                  key={doc.documentId}
                  className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {doc.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {doc.chunkCount ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.status]}`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {doc.uploadedAt
                      ? new Date(doc.uploadedAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setToDelete(doc)}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {toDelete && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-msg w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/90 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">
              Delete document?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              This will permanently remove{' '}
              <strong className="text-zinc-200">{toDelete.name}</strong> and all
              of its chunks. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-xl bg-red-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.8)] transition-all hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
