/**
 * 卡片 3D 倾斜 + 跟随光标的光效
 * 交互参考 LIGHT.html 的极光引擎卡片（data-tilt）
 */

const isBrowser = typeof window !== 'undefined'

interface RouterLike {
  afterEach: (cb: () => void) => void
}

interface TiltState {
  el: HTMLElement
  rx: number
  ry: number
  tx: number
  ty: number
  active: boolean
}

const SELECTOR = '.hyplay-card, .hyplay-stage, .vp-home-feature'
// 只跟随光标做描边高光、不做倾斜的面板（服务器信息页）
const GLOW_SELECTOR = '.hyplay-panel'

// 最大倾斜角度，可在 CSS 里用 --hyplay-tilt-max 覆盖（大卡片调小）
const DEFAULT_TILT_MAX = 11

const enhanced = new WeakSet<HTMLElement>()
const glowBound = new WeakSet<HTMLElement>()
let states: TiltState[] = []
let rafId = 0
let boostTimer: ReturnType<typeof setTimeout> | null = null

const canTilt = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function start() {
  if (!rafId)
    rafId = requestAnimationFrame(loop)
}

function loop() {
  rafId = 0
  states = states.filter(state => state.el.isConnected)

  for (const state of states) {
    const dx = state.tx - state.rx
    const dy = state.ty - state.ry
    const settled = Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01

    if (settled && !state.active) {
      if (state.rx !== 0 || state.ry !== 0) {
        state.rx = 0
        state.ry = 0
        state.el.style.transform = ''
      }
      continue
    }

    state.rx += dx * 0.12
    state.ry += dy * 0.12
    state.el.style.transform
      = `perspective(1000px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg)`
  }

  if (states.length)
    rafId = requestAnimationFrame(loop)
}

function bind(el: HTMLElement) {
  const state: TiltState = { el, rx: 0, ry: 0, tx: 0, ty: 0, active: false }
  const max = Number.parseFloat(
    getComputedStyle(el).getPropertyValue('--hyplay-tilt-max'),
  ) || DEFAULT_TILT_MAX

  el.addEventListener('mousemove', (event) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height)
      return

    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height

    state.tx = -(py - 0.5) * max
    state.ty = (px - 0.5) * max * 1.18
    state.active = true

    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    start()
  })

  el.addEventListener('mouseleave', () => {
    state.tx = 0
    state.ty = 0
    state.active = false
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
    start()
  })

  states.push(state)
}

/** 只更新光标位置变量，用于 .hyplay-panel 的描边高光（不倾斜） */
function bindGlow(el: HTMLElement) {
  if (glowBound.has(el))
    return
  glowBound.add(el)

  el.addEventListener('mousemove', (event) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height)
      return

    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
  })

  el.addEventListener('mouseleave', () => {
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  })
}

function enhance() {
  if (!isBrowser || !canTilt())
    return

  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (enhanced.has(el))
      return
    enhanced.add(el)
    bind(el)
  })

  document.querySelectorAll<HTMLElement>(GLOW_SELECTOR).forEach(bindGlow)
}

function schedule() {
  if (boostTimer)
    clearTimeout(boostTimer)
  boostTimer = setTimeout(enhance, 120)
}

export function setupTilt(router: RouterLike) {
  if (!isBrowser || !router?.afterEach)
    return

  router.afterEach(() => {
    schedule()
    setTimeout(enhance, 500)
  })

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
}
