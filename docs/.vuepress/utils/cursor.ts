/**
 * 自定义光标 + 磁吸按钮
 * 交互参考 LIGHT.html：光点 + 跟随缓动的圆环，悬停交互元素时放大
 */

const isBrowser = typeof window !== 'undefined'

interface RouterLike {
  afterEach: (cb: () => void) => void
}

const HOVER_SELECTOR = 'a, button, [role="switch"], .hyplay-card, .vp-home-feature'
const MAGNETIC_SELECTOR = '.vp-home-hero .actions .vp-button'

const magneticBound = new WeakSet<HTMLElement>()
let observer: MutationObserver | null = null
let boostTimer: ReturnType<typeof setTimeout> | null = null

function initCursor() {
  if (!isBrowser || document.querySelector('.hyplay-cursor-ring'))
    return
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches)
    return

  const dot = document.createElement('div')
  dot.className = 'hyplay-cursor-dot'
  dot.setAttribute('aria-hidden', 'true')

  const ring = document.createElement('div')
  ring.className = 'hyplay-cursor-ring'
  ring.setAttribute('aria-hidden', 'true')

  document.body.append(dot, ring)
  document.documentElement.classList.add('has-cursor')

  let pointerX = window.innerWidth / 2
  let pointerY = window.innerHeight / 2
  let ringX = pointerX
  let ringY = pointerY

  window.addEventListener('mousemove', (event) => {
    pointerX = event.clientX
    pointerY = event.clientY
    dot.style.transform = `translate(${pointerX}px, ${pointerY}px)`
    dot.style.opacity = '1'
    ring.style.opacity = '1'
  }, { passive: true })

  document.addEventListener('mouseover', (event) => {
    const target = (event.target as Element | null)?.closest?.(HOVER_SELECTOR)
    if (target)
      ring.classList.add('is-hover')
  })

  document.addEventListener('mouseout', (event) => {
    const target = (event.target as Element | null)?.closest?.(HOVER_SELECTOR)
    if (target && !target.contains(event.relatedTarget as Node | null))
      ring.classList.remove('is-hover')
  })

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0'
    ring.style.opacity = '0'
  })

  function loop() {
    ringX += (pointerX - ringX) * 0.16
    ringY += (pointerY - ringY) * 0.16
    ring.style.transform = `translate(${ringX.toFixed(1)}px, ${ringY.toFixed(1)}px)`
    requestAnimationFrame(loop)
  }

  ring.style.opacity = '0'
  requestAnimationFrame(loop)
}

function enhanceMagnetic() {
  if (!isBrowser)
    return

  document.querySelectorAll<HTMLElement>(MAGNETIC_SELECTOR).forEach((el) => {
    if (magneticBound.has(el))
      return
    magneticBound.add(el)

    el.addEventListener('mousemove', (event) => {
      const rect = el.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      el.style.transform = `translate(${(dx * 0.32).toFixed(1)}px, ${(dy * 0.32).toFixed(1)}px)`
    })

    el.addEventListener('mouseleave', () => {
      el.style.transform = ''
    })
  })
}

function scheduleEnhance() {
  if (boostTimer)
    clearTimeout(boostTimer)
  boostTimer = setTimeout(enhanceMagnetic, 120)
}

export function setupCursor(router: RouterLike) {
  if (!isBrowser)
    return

  initCursor()

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced)
    return

  enhanceMagnetic()

  if (router?.afterEach) {
    router.afterEach(() => {
      scheduleEnhance()
      setTimeout(enhanceMagnetic, 500)
    })
  }

  observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.body, { childList: true, subtree: true })
}
