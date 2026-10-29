<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

interface Step {
  no: number
  text: string
  /** 出现在文本中间的链接（用于「群文件」这类带图标的跳转） */
  link?: { text: string, href: string, icon: string }
  after?: string
  mods?: string[]
}

interface Stage {
  key: string
  title: string
  desc: string
  icon: string
  steps: Step[]
}

const SERVER_IP = '10.100.100.100'
const QQ_FILES = 'https://qm.qq.com/q/GIciGhUFOM'
const VIDEO_URL = 'https://video.mcapp.eu.org/media/hyplayteach.mp4'

const copied = ref(false)
const copiedMod = ref<string | null>(null)
const toast = ref<{ ok: boolean, text: string } | null>(null)

let copiedTimer: ReturnType<typeof setTimeout> | null = null
let copiedModTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const stages: Stage[] = [
  {
    key: 'network',
    title: '接入 EasyTier 虚拟局域网',
    desc: '先把电脑接入服务器所在的虚拟局域网',
    icon: 'hub',
    steps: [
      {
        no: 1,
        text: '在',
        link: { text: '群文件', href: QQ_FILES, icon: 'qq' },
        after: '中下载文件（落幕曲文件夹中）',
      },
      { no: 2, text: '安装 <code>easytier-gui.exe</code> 到本地' },
      { no: 3, text: '导入配置文件 <code>windows.toml</code>' },
      { no: 4, text: '点击 EasyTier 底部的「运行网络」' },
    ],
  },
  {
    key: 'launcher',
    title: '安装整合包',
    desc: '用 PCL CE 启动器导入落幕曲整合包',
    icon: 'download-rounded',
    steps: [
      { no: 5, text: '启动 <code>PCL CE.exe</code>' },
      { no: 6, text: '登录 MC 账号（离线 / 正版 / 皮肤库）' },
      { no: 7, text: '将 <code>落幕曲.zip</code> 拖到 <code>PCL CE.exe</code> 上' },
      { no: 8, text: '等待安装整合包' },
    ],
  },
  {
    key: 'server',
    title: '添加服务器',
    desc: '装好推荐 MOD，进入多人游戏添加地址',
    icon: 'dns-rounded',
    steps: [
      {
        no: 9,
        text: '推荐 MOD 下载：<span class="hyplay-mod-tip">点击名字可复制</span>',
        mods: ['Simple Voice Chat', 'IMBlocker', 'Custom Skin Loader'],
      },
      { no: 10, text: '启动游戏，点击「多人探险」' },
      { no: 11, text: `添加服务器，IP 地址 <code>${SERVER_IP}</code>` },
    ],
  },
  {
    key: 'play',
    title: '调整设置，开始游玩',
    desc: '改掉冲突键位与小地图传送命令',
    icon: 'sports-esports',
    steps: [
      { no: 12, text: '按 <kbd>ESC</kbd> 进入设置，调整冲突键位' },
      {
        no: 13,
        text: '按 <kbd>M</kbd> 打开小地图，设置中搜索「默认传送命令」<br>把开头的 <code class="is-cmd">@//s/</code> <span style="white-space:nowrap">删掉</span>，并去掉<span style="white-space:nowrap">多余空格</span>',
      },
      { no: 14, text: '按 <kbd>V</kbd> 激活聊天 MOD（属于推荐 MOD）' },
      { no: 15, text: '开始游玩吧！' },
    ],
  },
]

onBeforeUnmount(() => {
  if (copiedTimer)
    clearTimeout(copiedTimer)
  if (copiedModTimer)
    clearTimeout(copiedModTimer)
  if (toastTimer)
    clearTimeout(toastTimer)
  stopWatchdog()
  clearRecoverTimer()
  clearSeekTimer()
})

async function writeClipboard(text: string): Promise<boolean> {
  // 非安全上下文（局域网 IP、file:// 等）下 Clipboard API 不可用，直接走降级
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    }
    catch {
      // 权限被拒或浏览器限制，继续尝试 execCommand
    }
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.focus()
    area.select()
    area.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
  catch {
    return false
  }
}

function showToast(ok: boolean, text: string) {
  toast.value = { ok, text }
  if (toastTimer)
    clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 3000)
}

async function copyIp() {
  const ok = await writeClipboard(SERVER_IP)
  showToast(ok, ok ? '复制成功，快去加入吧！' : `复制失败，请手动复制 ${SERVER_IP}`)

  if (!ok)
    return

  copied.value = true
  if (copiedTimer)
    clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

/* ---------- 视频：断点续传 / 自动恢复 ----------
   网盘直链是「短时签名 302 → CDN」，长视频播到中途签名过期后，后续 Range 请求会失败，
   播放器就会卡死（连播放/暂停都点不动）。这里加一层自愈：一旦停滞或报错，
   就用带时间戳的新链接重新拿一次签名，并从上次位置续播。 */
type PlayerState = 'idle' | 'playing' | 'recovering' | 'error'

const videoEl = ref<HTMLVideoElement | null>(null)
const videoSrc = ref(VIDEO_URL)
const playerState = ref<PlayerState>('idle')
const bufferingHint = ref(false)

let watchdog: ReturnType<typeof setInterval> | null = null
let recoverTimer: ReturnType<typeof setTimeout> | null = null
let seekTimer: ReturnType<typeof setTimeout> | null = null
let lastTime = 0
let lastProgressAt = 0
let recovering = false
let failCount = 0
let pendingSeek: number | null = null
let pendingAutoplay = false

function freshVideoSrc() {
  return `${VIDEO_URL}${VIDEO_URL.includes('?') ? '&' : '?'}r=${Date.now()}`
}

function stopWatchdog() {
  if (watchdog) {
    clearInterval(watchdog)
    watchdog = null
  }
}

function clearRecoverTimer() {
  if (recoverTimer) {
    clearTimeout(recoverTimer)
    recoverTimer = null
  }
}

function clearSeekTimer() {
  if (seekTimer) {
    clearTimeout(seekTimer)
    seekTimer = null
  }
}

function startWatchdog() {
  stopWatchdog()
  const el = videoEl.value
  lastTime = el?.currentTime ?? 0
  lastProgressAt = Date.now()
  watchdog = setInterval(() => {
    const v = videoEl.value
    if (!v || recovering)
      return
    if (v.error) {
      recover()
      return
    }
    if (v.paused || v.ended) {
      lastTime = v.currentTime
      lastProgressAt = Date.now()
      return
    }
    if (Math.abs(v.currentTime - lastTime) > 0.05) {
      lastTime = v.currentTime
      lastProgressAt = Date.now()
    }
    else if (Date.now() - lastProgressAt > 6000 && v.readyState < 3) {
      // 播放中 6 秒没前进且缓冲不足 —— 判定为卡住，续传
      recover()
    }
  }, 2000)
}

function restart(seek: number, autoplay: boolean) {
  const el = videoEl.value
  if (!el)
    return
  pendingSeek = seek
  pendingAutoplay = autoplay
  playerState.value = 'recovering'
  videoSrc.value = freshVideoSrc()
  nextTick(() => {
    try {
      videoEl.value?.load()
    }
    catch {}
  })
  clearRecoverTimer()
  // 若 25 秒内仍拿不到元数据，视为一次失败，连续失败则判死
  recoverTimer = setTimeout(() => {
    if (recovering) {
      recovering = false
      failCount += 1
      if (failCount >= 4) {
        playerState.value = 'error'
        stopWatchdog()
      }
    }
  }, 25000)
}

function recover(atTime?: number) {
  const el = videoEl.value
  if (!el || recovering)
    return
  recovering = true
  bufferingHint.value = false
  const wasPlaying = !el.paused && !el.ended
  restart(atTime ?? (el.currentTime || lastTime || 0), wasPlaying)
}

function onLoadedMeta() {
  const el = videoEl.value
  if (!el)
    return
  if (pendingSeek != null) {
    try {
      el.currentTime = pendingSeek
    }
    catch {}
    pendingSeek = null
  }
  if (pendingAutoplay)
    el.play().catch(() => {})
  pendingAutoplay = false
  recovering = false
  failCount = 0
  clearRecoverTimer()
  clearSeekTimer()
  playerState.value = 'playing'
  bufferingHint.value = false
  startWatchdog()
}

function onVideoError() {
  if (recovering)
    return
  failCount += 1
  if (failCount >= 4) {
    playerState.value = 'error'
    stopWatchdog()
    return
  }
  recover()
}

function onBuffering() {
  if (playerState.value !== 'error')
    bufferingHint.value = true
}

function onPlaying() {
  bufferingHint.value = false
  recovering = false
  failCount = 0
  playerState.value = 'playing'
  lastTime = videoEl.value?.currentTime ?? 0
  lastProgressAt = Date.now()
}

function onSeeking() {
  const el = videoEl.value
  if (!el || recovering)
    return
  let bufferedEnd = 0
  for (let i = 0; i < el.buffered.length; i++)
    bufferedEnd = Math.max(bufferedEnd, el.buffered.end(i))
  // 拖到尚未缓冲的区域：若 5 秒内还没出画，用新签名从目标位置续传
  if (el.currentTime > bufferedEnd + 1) {
    clearSeekTimer()
    seekTimer = setTimeout(() => {
      const cur = videoEl.value
      if (cur && cur.seeking && cur.readyState < 2)
        recover(cur.currentTime)
    }, 5000)
  }
}

function manualReload() {
  const el = videoEl.value
  if (!el)
    return
  failCount = 0
  recovering = true
  bufferingHint.value = false
  restart(0, true)
}

onMounted(() => {
  startWatchdog()
})

async function copyMod(name: string) {
  const ok = await writeClipboard(name)
  showToast(ok, ok ? `已复制「${name}」，去搜索吧` : `复制失败，请手动复制 ${name}`)

  if (!ok)
    return

  copiedMod.value = name
  if (copiedModTimer)
    clearTimeout(copiedModTimer)
  copiedModTimer = setTimeout(() => {
    copiedMod.value = null
  }, 1500)
}

</script>

<template>
  <div class="hyplay-entry">
    <header class="hyplay-entry-head">
      <p class="hyplay-lead" data-reveal>
        <span class="hyplay-pill">
          <HyplayIcon name="coffee" class="hyplay-pill-icon" />
          仅 Java 版
        </span>
        <span class="hyplay-pill is-alt">
          <HyplayIcon name="hub" class="hyplay-pill-icon" />
          连接方式：EasyTier
        </span>
      </p>
      <p class="hyplay-sub" data-reveal>
        基岩版暂不支持，请先接入 EasyTier 虚拟局域网，再用 Java 版进入服务器
      </p>
    </header>

    <div class="hyplay-cards">
      <article class="hyplay-card hyplay-info" data-reveal>
        <img src="/img/Java.jpg" alt="Java 版" class="hyplay-card-icon">
        <h3>Java 版</h3>
        <p class="hyplay-card-desc">
          仅支持 Java 版客户端，基岩版无法进入
        </p>
        <div class="hyplay-addr-row">
          <span class="hyplay-tag is-java">客户端</span>
          <code>Forge 1.20.1</code>
        </div>
      </article>

      <article class="hyplay-card hyplay-info" data-reveal>
        <div class="hyplay-et-icon" aria-hidden="true">
          <HyplayIcon name="hub" class="hyplay-et-glyph" />
        </div>
        <h3>EasyTier</h3>
        <p class="hyplay-card-desc">
          唯一的连接方式，组网后使用下方虚拟局域网 IP 进服
        </p>
        <div class="hyplay-addr-row">
          <span class="hyplay-tag is-et">虚拟局域网</span>
          <code>{{ SERVER_IP }}</code>
          <button
            class="hyplay-copy"
            :class="{ done: copied }"
            type="button"
            aria-label="复制服务器 IP"
            @click="copyIp"
          >
            <svg v-if="copied" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" fill="currentColor" />
            </svg>
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </article>
    </div>

    <section class="hyplay-video" data-reveal>
      <header class="hyplay-video-head">
        <span class="hyplay-video-badge">
          <HyplayIcon name="play-rounded" class="hyplay-video-glyph" />
        </span>
        <div class="hyplay-video-title">
          <h3>落幕曲进服教程（视频版）</h3>
          <p class="hyplay-video-desc">
            跟着视频走一遍：下载文件 → 运行 EasyTier → 导入整合包 → 进入服务器
          </p>
        </div>
      </header>

      <div class="hyplay-video-frame">
        <video
          ref="videoEl"
          :src="videoSrc"
          controls
          playsinline
          preload="auto"
          @loadedmetadata="onLoadedMeta"
          @error="onVideoError"
          @stalled="onBuffering"
          @waiting="onBuffering"
          @playing="onPlaying"
          @seeking="onSeeking"
        />
        <div v-if="bufferingHint || playerState === 'recovering'" class="hyplay-video-status">
          <span class="hyplay-video-spinner" aria-hidden="true" />
          {{ playerState === 'recovering' ? '正在恢复播放…' : '正在缓冲…' }}
        </div>
        <div v-if="playerState === 'error'" class="hyplay-video-error">
          <p>视频加载失败，请重试或在新窗口打开。</p>
          <div class="hyplay-video-error-actions">
            <button type="button" class="hyplay-video-retry" @click="manualReload">
              重新加载
            </button>
            <a class="hyplay-inline-link" :href="VIDEO_URL" target="_blank" rel="noreferrer">
              <HyplayIcon name="link" class="hyplay-inline-icon" />在新窗口播放
            </a>
          </div>
        </div>
      </div>

      <p class="hyplay-video-note">
        视频较大，网速慢时会在当前位置自动续传，无需重头再来；
        <a class="hyplay-inline-link" :href="VIDEO_URL" target="_blank" rel="noreferrer">
          <HyplayIcon name="link" class="hyplay-inline-icon" />打不开？在新窗口播放
        </a>
      </p>
    </section>

    <ol class="hyplay-stages">
      <li v-for="stage in stages" :key="stage.key" class="hyplay-card hyplay-stage" data-reveal>
        <header class="hyplay-stage-head">
          <span class="hyplay-stage-badge">
            <HyplayIcon :name="stage.icon" class="hyplay-stage-icon" />
          </span>
          <div class="hyplay-stage-title">
            <h3>{{ stage.title }}</h3>
            <p class="hyplay-stage-desc">
              {{ stage.desc }}
            </p>
          </div>
        </header>

        <ol class="hyplay-steps">
          <li
            v-for="step in stage.steps"
            :key="step.no"
            class="hyplay-step"
            data-reveal
          >
            <span class="hyplay-step-no">{{ step.no }}</span>
            <div class="hyplay-step-body">
              <p v-if="step.link" class="hyplay-step-text">{{ step.text
            }}<a class="hyplay-inline-link" :href="step.link.href" target="_blank" rel="noreferrer"><HyplayIcon
              :name="step.link.icon"
              class="hyplay-inline-icon"
            />{{ step.link.text }}</a>{{ step.after }}</p>
              <p v-else class="hyplay-step-text" v-html="step.text" />
              <div v-if="step.mods" class="hyplay-mods">
                <button
                  v-for="mod in step.mods" :key="mod"
                  class="hyplay-mod" :class="{ done: copiedMod === mod }"
                  type="button" :aria-label="`复制模组名称 ${mod}`"
                  @click="copyMod(mod)"
                >
                  <svg v-if="copiedMod === mod" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" fill="currentColor" />
                  </svg>
                  {{ mod }}
                </button>
              </div>
            </div>
          </li>
        </ol>
      </li>
    </ol>

    <p class="hyplay-note" data-reveal>
      整合包与 EasyTier 配置文件都在
      <a class="hyplay-inline-link" :href="QQ_FILES" target="_blank" rel="noreferrer">
        <HyplayIcon name="qq" class="hyplay-inline-icon" />QQ 群文件
      </a>
      的「落幕曲」文件夹中，遇到问题可在群里提问。
    </p>

    <Transition name="hyplay-toast">
      <div v-if="toast" class="hyplay-toast" :class="toast.ok ? 'is-ok' : 'is-bad'" role="status">
        <svg v-if="toast.ok" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
        </svg>
        {{ toast.text }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hyplay-entry {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ---------- 卡片入场后图标方块轻微弹出 ---------- */
.hyplay-stage-badge {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
}

.hyplay-stage.is-revealed .hyplay-stage-badge,
.hyplay-info.is-revealed .hyplay-card-icon,
.hyplay-info.is-revealed .hyplay-et-icon,
.vp-home-feature.is-revealed .box .icon {
  animation: hyplay-icon-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms) both;
}

/* 步骤序号牌依次弹出 */
.hyplay-step.is-revealed .hyplay-step-no {
  animation: hyplay-num-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms) both;
}

@keyframes hyplay-num-pop {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }

  70% {
    opacity: 1;
    transform: scale(1.14);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.hyplay-stage:hover .hyplay-stage-badge {
  transform: translateY(-2px) scale(1.05);
  background: var(--vp-c-brand-1);
  color: #fff;
  box-shadow: 0 8px 20px rgba(94, 114, 228, 0.32);
}

/* 徽标底色变成品牌色时，图标必须是白色，否则紫底紫图标会糊成一团 */
.hyplay-stage:hover .hyplay-stage-badge .hyplay-stage-icon {
  color: #fff;
}

@keyframes hyplay-icon-pop {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }

  60% {
    opacity: 1;
    transform: scale(1.07);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ---------- 头部 ---------- */
.hyplay-entry-head {
  text-align: center;
}

.hyplay-lead {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin: 0;
}

.hyplay-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--hyplay-card-border);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 14px;
  letter-spacing: 0.5px;
}

.hyplay-pill.is-alt {
  background: var(--hyplay-card-bg);
  color: var(--vp-c-text-1);
}

.hyplay-pill-icon {
  font-size: 16px;
}

.hyplay-sub {
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 15px;
}

/* ---------- 顶部两张信息卡 ---------- */
.hyplay-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: stretch;
}

.hyplay-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 26px 22px 24px;
  border-radius: 18px;
  border: 1px solid var(--hyplay-card-border);
  background-color: var(--hyplay-card-bg);
  backdrop-filter: blur(10px);
  transition: box-shadow 0.35s ease, border-color 0.35s ease,
    translate 0.35s ease, --hyplay-blob 0.45s ease;
}

.hyplay-info:hover {
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.16);
}

.hyplay-card-icon {
  height: 76px;
  width: auto;
  border-radius: 10px;
  object-fit: contain;
}

.hyplay-et-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76px;
  color: var(--vp-c-brand-1);
}

.hyplay-et-glyph {
  font-size: 68px;
}

.hyplay-info h3 {
  margin: 0;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 1.35rem;
  letter-spacing: 0.5px;
}

.hyplay-card-desc {
  margin: 0;
  text-align: center;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

/* 两卡底部信息行对齐，保证卡片等高 */
.hyplay-addr-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 10px;
  width: 100%;
  margin-top: auto;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--vp-c-bg-alt);
}

.hyplay-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.3px;
}

.hyplay-tag.is-java {
  background: #e2a03f;
}

.hyplay-tag.is-et {
  background: var(--vp-c-brand-1);
}

.hyplay-addr-row code {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-text-1);
  word-break: break-all;
}

.hyplay-copy {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.hyplay-copy:hover {
  background: var(--vp-c-brand-3);
  transform: translateY(-1px);
}

.hyplay-copy:active {
  transform: scale(0.94);
}

.hyplay-copy.done {
  background: #2f9e5f;
}

/* ---------- 视频教程（首页两卡与步骤区之间） ---------- */
.hyplay-video {
  padding: 20px 22px 18px;
  border-radius: 20px;
  border: 1px solid var(--hyplay-card-border);
  background-color: var(--hyplay-card-bg);
  backdrop-filter: blur(10px);
}

.hyplay-video-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.hyplay-video-badge {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--hyplay-card-border);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.hyplay-video-glyph {
  font-size: 22px;
}

.hyplay-video-title {
  min-width: 0;
}

.hyplay-video-title h3 {
  margin: 0;
  padding: 0;
  border: none;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 1.1rem;
  letter-spacing: 0.5px;
}

.hyplay-video-desc {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

/* 播放器：固定 16:9，黑底 + 圆角，避免加载时高度跳动 */
.hyplay-video-frame {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  border: 1px solid var(--hyplay-card-border);
  background: #000;
}

.hyplay-video-frame video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

/* 缓冲 / 续传提示 */
.hyplay-video-status {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12.5px;
  pointer-events: none;
  backdrop-filter: blur(6px);
}

.hyplay-video-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: hyplay-spin 0.8s linear infinite;
}

@keyframes hyplay-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 连续续传失败后的兜底 */
.hyplay-video-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  text-align: center;
}

.hyplay-video-error p {
  margin: 0;
  font-size: 14px;
}

.hyplay-video-error-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.hyplay-video-retry {
  padding: 7px 18px;
  border: none;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.hyplay-video-retry:hover {
  background: var(--vp-c-brand-3);
}

.hyplay-video-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

/* ---------- 步骤卡片 ---------- */
.hyplay-stages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hyplay-stage {
  position: relative;
  padding: 26px 28px 28px;
  border-radius: 20px;
  border: 1px solid var(--hyplay-card-border);
  background-color: var(--hyplay-card-bg);
  backdrop-filter: blur(10px);
  transition: box-shadow 0.35s ease, border-color 0.35s ease,
    translate 0.35s ease, --hyplay-blob 0.45s ease;
}

/* 卡片左侧的品牌色竖条，增强层次 */
.hyplay-stage::before {
  position: absolute;
  z-index: 1;
  top: 20px;
  bottom: 20px;
  left: 0;
  width: 3px;
  content: '';
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  opacity: 0.5;
}

.hyplay-stage:hover {
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.14);
  translate: 0 -3px;
}

.hyplay-stage-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.hyplay-stage-badge {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  border: 1px solid var(--hyplay-card-border);
  background: var(--vp-c-brand-soft);
}

.hyplay-stage-icon {
  font-size: 24px;
  color: var(--vp-c-brand-1);
}

.hyplay-stage-title {
  min-width: 0;
}

.hyplay-stage-title h3 {
  margin: 0;
  padding: 0;
  border: none;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 1.15rem;
  letter-spacing: 0.5px;
}

.hyplay-stage-desc {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.hyplay-steps {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hyplay-step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 15px 18px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--vp-c-bg-alt);
  transition: transform 0.25s ease, background-color 0.25s ease,
    border-color 0.25s ease;
}

.hyplay-step:hover {
  transform: translateX(4px);
  background: var(--vp-c-brand-soft);
  border-color: var(--hyplay-card-border);
}

/* 悬停时左侧浮出品牌色指示条 */
.hyplay-step::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 0;
  content: '';
  border-radius: 0 3px 3px 0;
  background: var(--vp-c-brand-1);
  translate: 0 -50%;
  transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.hyplay-step:hover::before {
  height: 62%;
}

/* 序号之间的竖向连接线，串起流程感 */
.hyplay-step:not(:last-child)::after {
  position: absolute;
  top: 48px;
  bottom: -16px;
  left: 31px;
  width: 3px;
  content: '';
  border-radius: 3px;
  background: linear-gradient(
    180deg,
    var(--vp-c-brand-1) 0%,
    var(--vp-c-brand-1) 70%,
    transparent 100%
  );
  opacity: 0.85;
}

.hyplay-step-no {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 13.5px;
  line-height: 1;
  transition: scale 0.25s ease;
}

.hyplay-step:hover .hyplay-step-no {
  scale: 1.08;
}

.hyplay-step-body {
  flex: 1;
  min-width: 0;
}

.hyplay-step-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--vp-c-text-1);
  /* 让浏览器优化中文断行，避免出现「删/除」这类被拆开的词 */
  text-wrap: pretty;
  word-break: normal;
  line-break: strict;
}

.hyplay-step-text :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hyplay-step-text :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-brand-1);
  /* 命令、文件名等不要被折行拆开 */
  white-space: nowrap;
  word-break: keep-all;
}

/* 需要删除的命令片段：单独强调，避免和普通文字混在一起看不清 */
.hyplay-step-text :deep(code.is-cmd) {
  padding: 1px 8px;
  border: 1px solid var(--hyplay-card-border);
  background: var(--vp-c-bg);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--vp-c-text-1);
}

.hyplay-step-text :deep(kbd) {
  display: inline-block;
  min-width: 22px;
  padding: 1px 8px;
  border-radius: 6px;
  border: 1px solid var(--hyplay-card-border);
  border-bottom-width: 2px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  text-align: center;
  color: var(--vp-c-text-1);
}

.hyplay-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* 推荐 MOD：整颗胶囊就是复制按钮，点一下把名字复制走方便去搜索 */
.hyplay-mod-tip {
  margin-left: 6px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.hyplay-mod {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--hyplay-card-border);
  background: var(--vp-c-bg);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease,
    background-color 0.2s ease;
}

.hyplay-mod svg {
  flex: none;
  opacity: 0.55;
}

/* 只在有真正悬停能力的设备上变色，避免触屏点按后颜色一直挂着 */
@media (hover: hover) {
  .hyplay-mod:hover {
    border-color: var(--vp-c-brand-1);
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
  }
}

.hyplay-mod:active {
  scale: 0.97;
}

.hyplay-mod.done {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.hyplay-mod.done svg {
  opacity: 1;
}

/* ---------- 尾部提示 ---------- */
.hyplay-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 14px 18px;
  border: 1px dashed var(--hyplay-card-border);
  border-radius: 14px;
  background: var(--hyplay-card-bg);
  text-align: center;
  font-size: 13.5px;
  line-height: 1.9;
  color: var(--vp-c-text-2);
}

/* ---------- 文本内联图标（如「群文件」前的 QQ 图标） ---------- */
.hyplay-inline-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.hyplay-inline-link:hover {
  background: var(--vp-c-brand-soft);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hyplay-inline-icon {
  font-size: 15px;
}

/* ---------- 复制提示 ---------- */
.hyplay-toast {
  position: fixed;
  top: 76px;
  left: 50%;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  color: #fff;
  transform: translateX(-50%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}

.hyplay-toast.is-ok {
  background: #2f9e5f;
}

.hyplay-toast.is-bad {
  background: #d1453b;
}

.hyplay-toast-enter-active,
.hyplay-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.hyplay-toast-enter-from,
.hyplay-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* 窄屏：信息卡与步骤卡都改为单列 */
@media (max-width: 820px) {
  .hyplay-cards {
    grid-template-columns: 1fr;
  }

  .hyplay-stages {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hyplay-card-icon,
  .hyplay-et-icon {
    height: 64px;
  }

  .hyplay-et-glyph {
    font-size: 52px;
  }

  .hyplay-info h3 {
    font-size: 1.2rem;
  }

  .hyplay-stage {
    padding: 18px 16px 20px;
  }

  .hyplay-video {
    padding: 16px 14px;
  }

  .hyplay-step {
    gap: 10px;
    padding: 12px 14px;
  }
}
</style>
