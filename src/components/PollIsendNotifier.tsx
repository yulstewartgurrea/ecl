// src/components/PollIsendNotifier.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

export type PollingStatus = 'idle' | 'polling' | 'done' | 'error';

export interface UsePollingTaskOptions<T = any> {
  url: string;
  intervalMs?: number;
  requestInit?: RequestInit;
  parseDone: (data: T) => boolean;
  onDone?: (data: T) => void;
  immediate?: boolean;
  keepPollingAfterDone?: boolean;
}

export function usePollingTask<T = any>(options: UsePollingTaskOptions<T>) {
  const {
    url,
    intervalMs = 10 * 60 * 1000, // 10 minutes
    requestInit,
    parseDone,
    onDone,
    immediate = true,
    keepPollingAfterDone = false,
  } = options;

  const [status, setStatus] = useState<PollingStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneNotifiedRef = useRef(false);
  const mountedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelInFlight = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const fetchOnce = useCallback(async () => {
    cancelInFlight();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      setStatus((s) => (s === 'idle' ? 'polling' : s));
      const res = await fetch(url, { ...requestInit, signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (!mountedRef.current) return;
      setData(json);
      setError(null);
      setLastCheckedAt(Date.now());

      const isDone = parseDone(json);
      if (isDone) {
        if (!doneNotifiedRef.current) {
          doneNotifiedRef.current = true;
          onDone?.(json);
        }
        setStatus('done');
        if (!keepPollingAfterDone) {
          clearTimer();
          cancelInFlight();
        }
      } else {
        setStatus('polling');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
    }
  }, [url, requestInit, parseDone, onDone, keepPollingAfterDone]);

  const start = useCallback(() => {
    clearTimer();
    if (immediate) fetchOnce();
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOnce();
      }
    }, intervalMs) as unknown as number;

    setStatus('polling');
  }, [fetchOnce, immediate, intervalMs]);

  const stop = useCallback(() => {
    clearTimer();
    cancelInFlight();
    setStatus('idle');
  }, []);

  const checkNow = useCallback(() => {
    fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    mountedRef.current = true;
    start();
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [url]); // restart when URL changes

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') checkNow();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [checkNow]);

  return { status, data, error, lastCheckedAt, start, stop, checkNow } as const;
}

export async function notifyUser(
  title: string,
  options?: NotificationOptions,
  fallback?: () => void
) {
  try {
    if (!('Notification' in window)) {
      fallback?.();
      return;
    }
    if (Notification.permission === 'granted') {
      new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, options);
      } else {
        fallback?.();
      }
    } else {
      fallback?.();
    }
  } catch {
    fallback?.();
  }
}

export interface PollIsendNotifierProps<T = any> {
  url: string;
  everyMinutes?: number;
  requestInit?: RequestInit; // allow auth headers, etc.
  parseDone?: (data: T) => boolean;
  onDone?: (data: T) => void;
  children?: (state: {
    status: PollingStatus;
    data: T | null;
    error: Error | null;
    lastCheckedAt: number | null;
    checkNow: () => void;
  }) => React.ReactNode;
  keepPollingAfterDone?: boolean;
}

export function PollIsendNotifier<T = any>(props: PollIsendNotifierProps<T>) {
  const {
    url,
    everyMinutes = 10,
    requestInit, // <- read from props
    parseDone = (d: any) => {
      const s = (d?.status ?? '').toString().toLowerCase();
      const progress = typeof d?.progress === 'number' ? d.progress : undefined;
      return s === 'done' || s === 'completed' || progress === 100;
    },
    onDone,
    keepPollingAfterDone = false,
    children,
  } = props;

  const { status, data, error, lastCheckedAt, checkNow } = usePollingTask<T>({
    url,
    intervalMs: Math.max(1, everyMinutes) * 60 * 1000,
    requestInit, // <- pass to hook
    parseDone,
    keepPollingAfterDone,
    onDone: async (d) => {
      await notifyUser(
        'Your background task is done',
        {
          body: 'Tap to view the result.',
          requireInteraction: false,
        },
        () => {
          alert('Your background task is done.');
        }
      );
      onDone?.(d);
    },
  });

  const defaultUI = (
    <div className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      <span className="font-medium">Background checker</span>
      <span className="text-slate-500">·</span>
      <span className="text-slate-600 dark:text-slate-300">
        {status === 'polling' && 'Polling…'}
        {status === 'done' && 'Done'}
        {status === 'idle' && 'Idle'}
        {status === 'error' && 'Error'}
      </span>
      <button
        type="button"
        className="ml-2 rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={checkNow}
      >
        Check now
      </button>
      {lastCheckedAt && (
        <span className="ml-2 text-xs text-slate-500">
          {new Date(lastCheckedAt).toLocaleTimeString()}
        </span>
      )}
      {error && <span className="ml-2 text-xs text-red-600">{error.message}</span>}
    </div>
  );

  return <>{children ? children({ status, data, error, lastCheckedAt, checkNow }) : defaultUI}</>;
}