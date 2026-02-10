import { useEffect, useRef, useCallback, useState } from 'react';

let idCounter = 0;

/**
 * Hook that offloads deco calculations to a Web Worker.
 * Falls back to main-thread calculation if Workers aren't supported.
 */
export function useDecoWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const [supported] = useState(() => typeof Worker !== 'undefined');

  useEffect(() => {
    if (!supported) return;
    try {
      workerRef.current = new Worker(
        new URL('../workers/decoWorker.js', import.meta.url),
        { type: 'module' }
      );
      workerRef.current.onmessage = (e) => {
        const { id, result, error } = e.data;
        const pending = pendingRef.current.get(id);
        if (pending) {
          pendingRef.current.delete(id);
          if (error) pending.reject(new Error(error));
          else pending.resolve(result);
        }
      };
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [supported]);

  const calculate = useCallback((settings, stops) => {
    if (!workerRef.current) return null; // fallback signal
    const id = ++idCounter;
    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({ id, settings, stops });
    });
  }, []);

  return { calculate, supported: supported && workerRef.current !== null };
}
