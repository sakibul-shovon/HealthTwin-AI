"use client";

import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/api';

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    getHealth().then((data) => {
      if (data) {
        setHealth(data);
      } else {
        setError(true);
      }
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Family Command Center</h1>
      <div className="p-6 rounded-lg bg-[var(--surface)] shadow-md text-center">
        <h2 className="text-2xl mb-4">HealthTwin</h2>
        <p className="text-lg">
          backend: {health?.status === 'ok' ? <span className="text-[var(--well)] font-bold">ok</span> : (error ? <span className="text-[var(--urgent)] font-bold">down</span> : <span className="text-[var(--watch)] font-bold">checking...</span>)}
        </p>
        {health && (
          <div className="mt-4 text-sm text-[var(--ink-soft)]">
            <p>DB: {health.db ? 'Yes' : 'No'}</p>
            <p>Vector: {health.vector ? 'Yes' : 'No'}</p>
            <p>Time: {new Date(health.time).toLocaleString()}</p>
          </div>
        )}
      </div>
    </main>
  );
}
