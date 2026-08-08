import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Lenis smooth scrolling over the window scroller.
 * Respects prefers-reduced-motion and cleans up on unmount.
 */
export function useLenis(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      smoothWheel: true,
    })

    let rafId = 0
    const loop = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])
}
