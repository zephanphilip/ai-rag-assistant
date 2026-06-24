'use client';

import { useState, FormEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

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
        body: formData,
      });

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Upload Handbook
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Upload a PDF or text document to add it to the knowledge base.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-lg border border-zinc-300 text-sm text-zinc-600 file:mr-4 file:cursor-pointer file:border-0 file:bg-zinc-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200"
          />

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {uploading ? 'Processing...' : 'Upload & Process'}
          </button>
        </form>

        {status && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {status}
          </p>
        )}
      </div>
    </main>
  );
}
