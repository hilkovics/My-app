import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

import { getVersion, subscribe } from './changes';
import type { Db } from './types';

export { useNow } from '@/hooks/use-now';

export function useDb(): Db {
  return useSQLiteContext() as unknown as Db;
}

/**
 * Runs an async query and re-runs it whenever data changes (notifyChange) or `deps` change.
 * `deps` must be JSON-serialisable (strings, numbers, booleans, null).
 * Returns the last result (undefined until the first one arrives).
 */
export function useLiveQuery<T>(fn: (db: Db) => Promise<T>, deps: unknown[]): T | undefined {
  const db = useDb();
  const [data, setData] = useState<T | undefined>(undefined);
  const [version, setVersion] = useState(getVersion);
  const fnRef = useRef(fn);
  const seq = useRef(0);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => subscribe(() => setVersion(getVersion())), []);

  useEffect(() => {
    const mySeq = ++seq.current;
    fnRef
      .current(db)
      .then((r) => {
        if (mySeq === seq.current) setData(r);
      })
      .catch((e) => console.warn('useLiveQuery', e));
  }, [db, depsKey, version]);

  return data;
}
