'use client'

import { useEffect, useRef, useState } from 'react'

export interface ScrollEdges {
  /** True when content is scrolled past the top — there's more above. */
  top: boolean
  /** True when there's more content below the visible area. */
  bottom: boolean
  /** True when content is scrolled past the left — there's more to the left. */
  left: boolean
  /** True when there's more content to the right of the visible area. */
  right: boolean
}

/**
 * Tracks which edges of a scrollable container have hidden content. Used to
 * render scroll-shadow gradients only where they're meaningful (i.e. not on
 * an edge that has no content to scroll into).
 *
 * Returns a ref to attach to the scroll container plus the live edge state.
 * Recomputes on scroll and on container resize.
 */
export function useScrollEdges<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>
  edges: ScrollEdges
} {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState<ScrollEdges>({
    top: false,
    bottom: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const {
        scrollTop,
        scrollLeft,
        scrollWidth,
        scrollHeight,
        clientWidth,
        clientHeight,
      } = el
      // Sub-pixel rounding tolerance — at scroll-end positions, the math can
      // come out 0.5px short and falsely flag the edge as scrollable.
      const epsilon = 1
      setEdges({
        top: scrollTop > epsilon,
        bottom: scrollTop + clientHeight < scrollHeight - epsilon,
        left: scrollLeft > epsilon,
        right: scrollLeft + clientWidth < scrollWidth - epsilon,
      })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Watch children too — table content grows when rows load in.
    for (const child of Array.from(el.children)) {
      ro.observe(child)
    }
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  return { ref, edges }
}
