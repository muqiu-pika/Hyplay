import fs from 'node:fs'
import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'
import { plumeTheme } from 'vuepress-theme-plume'

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'Hyplay 服务器',
  description: 'Hyplay 服务器官方网站 —— 服务器介绍、版本与入服教程',
  bundler: viteBundler({
    vuePluginOptions: {
      // 主题的 SFC 使用 defineProps<导入类型>()，编译时需要文件系统解析类型
      script: {
        fs: {
          fileExists: (file: string) => fs.existsSync(file),
          readFile: (file: string) => fs.readFileSync(file, 'utf-8'),
          realpath: (file: string) => fs.realpathSync(file),
        },
      },
    },
  }),
  head: [
    ['link', { rel: 'icon', href: '/ico/hyplay.png', type: 'image/png' }],
    ['meta', { name: 'theme-color', content: '#5e72e4' }],
    // 每次打开都强制深色，手动切换只在当前页面生效，重新打开仍是深色
    ['script', {}, `try{localStorage.setItem('vuepress-theme-appearance','dark');document.documentElement.setAttribute('data-theme','dark')}catch(e){}`],
  ],
  theme: plumeTheme({
    logo: '/ico/hyplay.png',
    appearance: 'dark',
    // 关闭自动写入 frontmatter（默认会生成随机永久链接并回写 Markdown）
    autoFrontmatter: false,
    editLink: false,
    prevPage: false,
    nextPage: false,
    aside: false,
    navbar: [
      { text: '首页', link: '/', icon: 'material-symbols:home-rounded' },
      { text: '入服方式', link: '/entry/', icon: 'material-symbols:login-rounded' },
      { text: '服务器信息', link: '/server/', icon: 'material-symbols:dns-rounded' },
      { text: '关于', link: '/about/', icon: 'material-symbols:info-rounded' },
      {
        text: 'QQ 群',
        link: 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=Xh3ibsNLMOEBB3IJw2Ro3WCeL1QusfNA&authKey=Xz%2FxVNfTvs9wZwCLQDBv93hme7xA6nerIeikbBVFSb%2BYQQKBKD3gyffbw8WXmzog&noverify=0&group_code=1011493009',
        icon: 'simple-icons:tencentqq',
      },
    ],
    footer: {
      message: 'Hyplay 服务器 · 官方网站',
      copyright: 'Copyright © 2025-现在 慕秋_Pika',
    },
  }),
})
