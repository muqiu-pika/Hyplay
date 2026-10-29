<script setup lang="ts">
const rows = [
  { version: 'Java版', protocol: 'EasyTier', address: '10.100.100.100' },
]
</script>

<template>
  <div class="hyplay-server">
    <section class="hyplay-panel">
      <header class="hyplay-panel-head">
        <h2>
          <HyplayIcon name="dns-rounded" class="hyplay-panel-icon" />
          服务器地址
        </h2>
        <span class="hyplay-note">仅 Java 版 · EasyTier 虚拟局域网</span>
      </header>

      <div class="hyplay-table">
        <div v-for="row in rows" :key="`${row.version}-${row.protocol}`" class="hyplay-row">
          <span class="hyplay-version">{{ row.version }}</span>
          <span class="hyplay-tag is-et">{{ row.protocol }}</span>
          <code>{{ row.address }}</code>
        </div>
      </div>

      <p class="hyplay-tip">
        该地址是 EasyTier 组网的虚拟局域网 IP，必须先运行 EasyTier 才能连接；基岩版暂不支持。
      </p>
    </section>

    <section class="hyplay-panel">
      <header class="hyplay-panel-head">
        <h2>
          <HyplayIcon name="format-list-numbered" class="hyplay-panel-icon" />
          入服步骤
        </h2>
      </header>
      <ol class="hyplay-steps">
        <li>在<a href="https://qm.qq.com/q/GIciGhUFOM" target="_blank" rel="noreferrer">群文件</a>的「落幕曲」文件夹中下载整合包与 EasyTier 配置。</li>
        <li>安装 easytier-gui.exe，导入 windows.toml，点击「运行网络」。</li>
        <li>启动 PCL CE.exe，登录账号后把落幕曲.zip 拖进去安装整合包。</li>
        <li>启动游戏，进入「多人探险」，添加服务器地址 10.100.100.100。</li>
        <li>详细图文流程见<a href="/entry/">入服方式</a>。</li>
      </ol>
    </section>

    <section class="hyplay-panel">
      <header class="hyplay-panel-head">
        <h2>
          <HyplayIcon name="link" class="hyplay-panel-icon" />
          相关链接
        </h2>
      </header>
      <ul class="hyplay-links">
        <li>
          <a class="hyplay-link-btn" href="https://hyplay.mcapp.eu.org" target="_blank" rel="noreferrer">
            <HyplayIcon name="language" class="hyplay-link-icon" />
            <span class="hyplay-link-label">官方网站</span>
          </a>
        </li>
        <li>
          <a class="hyplay-link-btn" href="https://pd.qq.com/s/d0ulp027e?businessType=9" target="_blank" rel="noreferrer">
            <HyplayIcon name="forum" class="hyplay-link-icon" />
            <span class="hyplay-link-label">QQ 频道</span>
          </a>
        </li>
        <li>
          <a class="hyplay-link-btn" href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=Xh3ibsNLMOEBB3IJw2Ro3WCeL1QusfNA&authKey=Xz%2FxVNfTvs9wZwCLQDBv93hme7xA6nerIeikbBVFSb%2BYQQKBKD3gyffbw8WXmzog&noverify=0&group_code=1011493009" target="_blank" rel="noreferrer">
            <HyplayIcon name="qq" class="hyplay-link-icon" />
            <span class="hyplay-link-label">QQ 群 1011493009</span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.hyplay-server {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.hyplay-panel {
  position: relative;
  padding: 22px 24px;
  border-radius: 16px;
  border: 1px solid var(--hyplay-card-border);
  transition: translate 0.35s ease, border-color 0.35s ease,
    box-shadow 0.35s ease;
  background-color: var(--hyplay-card-bg);
  backdrop-filter: blur(10px);
}

.hyplay-panel:hover {
  translate: 0 -3px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.14);
}

/* 面板入场后标题图标轻微弹出 */
.hyplay-panel.is-revealed .hyplay-panel-icon {
  animation: hyplay-panel-icon-pop 0.55s cubic-bezier(0.16, 1, 0.3, 1)
    var(--reveal-delay, 0ms) both;
}

@keyframes hyplay-panel-icon-pop {
  0% {
    opacity: 0;
    scale: 0.6;
  }

  70% {
    opacity: 1;
    scale: 1.12;
  }

  100% {
    opacity: 1;
    scale: 1;
  }
}

.hyplay-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.hyplay-panel-head h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: none;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 1.25rem;
  letter-spacing: 0.5px;
}

.hyplay-panel-icon {
  flex: none;
  font-size: 22px;
  color: var(--vp-c-brand-1);
}

.hyplay-note {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.hyplay-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hyplay-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--vp-c-bg-alt);
}

.hyplay-version {
  flex: none;
  min-width: 56px;
  font-family: 'Minecraft', var(--vp-font-family-base);
  font-size: 14px;
  color: var(--vp-c-text-1);
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

.hyplay-tag.is-et {
  background: var(--vp-c-brand-1);
}

.hyplay-row code {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-brand-1);
  word-break: break-all;
}

.hyplay-tip {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.hyplay-steps {
  margin: 0;
  padding-left: 20px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.9;
}

.hyplay-steps a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hyplay-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hyplay-links li {
  display: flex;
  align-items: stretch;
}

/* 三个入口按钮：等宽等高，内容居中，底边对齐 */
.hyplay-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  height: 56px;
  padding: 14px 16px;
  border: 1px solid var(--hyplay-card-border);
  border-radius: 14px;
  background: var(--vp-c-bg-alt);
  font-size: 14px;
  font-weight: 600;
  line-height: 24px;
  text-align: center;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: transform 0.25s ease, box-shadow 0.25s ease,
    border-color 0.25s ease, background-color 0.25s ease;
}

.hyplay-link-btn:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
}

.hyplay-link-label {
  white-space: nowrap;
}

.hyplay-link-icon {
  font-size: 18px;
}

.hyplay-links a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 640px) {
  .hyplay-panel {
    padding: 18px 16px;
  }

  .hyplay-links {
    grid-template-columns: 1fr;
  }

  .hyplay-row {
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .hyplay-row code {
    flex-basis: 100%;
  }
}
</style>
