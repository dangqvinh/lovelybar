import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)

  const load = useCallback(() => {
    const id = ++run.current
    setLoading(true)
    setError(null)
    fn()
      .then((d) => run.current === id && setData(d))
      .catch((e: Error) => run.current === id && setError(e.message))
      .finally(() => run.current === id && setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(load, [load])
  return { data, setData, loading, error, reload: load }
}
