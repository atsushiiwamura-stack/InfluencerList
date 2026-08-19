import { useCallback, useEffect, useRef } from "react";

/** 文字入力のたびにAPIを叩くと重くなるため、入力が止まってから発火させる。 */
export function useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delayMs = 400) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: Args) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs]
  );
}
