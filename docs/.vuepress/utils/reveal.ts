/**
 * 通用滚动显现 / 回滚隐藏
 *
 * 带 data-reveal 的元素默认不可见：
 * - 元素顶边升到视口 82% 处 → 淡入
 * - 反向滚动、顶边退回到该线以下 → 淡出（可逆）
 *
 * 用「window scroll + rAF 扫描」而不是 IntersectionObserver：
 * IntersectionObserver 在一次大跨度跳转滚动时不会为中间元素回调，
 * 会导致划过的元素永远停在隐藏状态。
 */

const isBrowser = typeof window !== 'undefined'

interface RouterLike {
  afterEach: (cb: () => void) => void
}

const SELECTOR = '[data-reveal]'

// 这些元素无需手写标记，自动纳入滚动显现
const AUTO_SELECTOR = [
  '.vp-home-feature',
  '.vp-home-features > .container > .title',
  '.vp-home-features > .container > .description',
  '.hyplay-panel',
  '.vp-doc > h2',
  '.vp-doc > p',
  '.vp-doc > ul',
  '.vp-doc > ol',
].join(', ')

// 元素布局顶边越过视口这个比例时显示；回滚时要越过更低的 HIDE_RATIO 才隐藏。
// 用两个阈值（滞回）避免在临界线附近来回抖动造成闪烁。
const SHOW_RATIO = 0.82
const HIDE_RATIO = 0.95

const tracked: HTMLElement[] = []
const marked = new WeakSet<HTMLElement>()
let ticking = false
let timer: ReturnType<typeof setTimeout> | null = null

function mark(el: HTMLElement): boolean {
  if (marked.has(el))
    return false
  marked.add(el)
  el.classList.add('hyplay-reveal')
  tracked.push(el)
  return true
}

/**
 * 取元素在文档中的布局顶边（不含 transform/translate）。
 * 显现动画本身会改变 getBoundingClientRect，若直接用它判断，
 * 元素会「显示→位置变化→再判定为隐藏→再显示」来回闪，
 * 所以这里沿 offsetParent 累加 offsetTop。
 */
function layoutTop(el: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

/** 扫描所有已标记元素，按当前滚动位置双向切换显示状态 */
function update() {
  if (!tracked.length)
    return

  const vh = window.innerHeight || 800
  const scrollY = window.scrollY || 0
  const showLine = scrollY + vh * SHOW_RATIO
  const hideLine = scrollY + vh * HIDE_RATIO
  let batch = 0

  for (const el of tracked) {
    if (!el.isConnected)
      continue

    const top = layoutTop(el)
    const shown = el.classList.contains('is-revealed')

    if (top < showLine) {
      if (!shown) {
        // 同一帧内新出现的元素依次延迟，形成渐进式入场
        el.style.setProperty('--reveal-delay', `${Math.min(batch * 60, 360)}ms`)
        el.classList.add('is-revealed')
        batch += 1
      }
    }
    else if (shown && top > hideLine) {
      // 回滚时立即淡出，不再叠加延迟
      el.style.setProperty('--reveal-delay', '0ms')
      el.classList.remove('is-revealed')
    }
  }
}

function onScroll() {
  if (ticking)
    return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    update()
  })
}

function collect() {
  // 清掉路由切换后已脱离文档的旧元素
  for (let i = tracked.length - 1; i >= 0; i--) {
    if (!tracked[i].isConnected)
      tracked.splice(i, 1)
  }

  document.querySelectorAll<HTMLElement>(AUTO_SELECTOR).forEach((el) => {
    if (!el.hasAttribute('data-reveal'))
      el.setAttribute('data-reveal', 'soft')
  })

  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    mark(el)
  })

  update()
}

function setupProgressBar() {
  let bar = document.querySelector<HTMLElement>('.hyplay-progress')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'hyplay-progress'
    document.body.appendChild(bar)
  }

  const target = bar

  const refresh = () => {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    target.style.transform = `scaleX(${ratio.toFixed(4)})`
  }

  window.addEventListener('scroll', refresh, { passive: true })
  window.addEventListener('resize', refresh)
  refresh()
}

// 路由切换后给文档区加一次淡入，过渡更顺滑
function fadePage() {
  const el = document.querySelector<HTMLElement>('.vp-doc')
  if (!el)
    return
  el.classList.remove('hyplay-page-in')
  // 强制重排以重启动画
  void el.offsetWidth
  el.classList.add('hyplay-page-in')
}

export function setupReveal(router: RouterLike) {
  if (!isBrowser)
    return

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    // 尊重系统「减少动效」，直接全部显示
    const show = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        el.classList.add('is-revealed')
      })
    }
    show()
    if (router?.afterEach)
      router.afterEach(() => setTimeout(show, 60))
    return
  }

  const schedule = () => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(collect, 80)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  // 图片字体加载完成后高度会变化，重新判断一次
  window.addEventListener('load', update)
  document.fonts?.ready.then(() => update()).catch(() => {})

  schedule()

  if (router?.afterEach) {
    router.afterEach(() => {
      schedule()
      fadePage()
      setTimeout(collect, 420)
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  setupProgressBar()
}
