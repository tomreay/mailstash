import { useEffect, useRef } from 'react'

interface UsePollingOptions {
  enabled: boolean
  interval?: number
  onPoll: () => void | Promise<void>
}

export function usePolling({ enabled, interval = 2000, onPoll }: UsePollingOptions) {
  const savedCallback = useRef(onPoll)

  useEffect(() => {
    savedCallback.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      void savedCallback.current()
    }

    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [enabled, interval])
}