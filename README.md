# Hyplay 服务器官网

本仓库为 Hyplay MC 服务器公开内容存放处，QQ 群号 **1011493009**，欢迎各位前来游玩！

本站是 Hyplay 服务器的官方网站，使用 **Vue 3 + VuePress 2 + VuePlume 主题** 重写（原项目 `muqiu-pika/hyplay-web` 的 Vue 重写版）。定位为「服务器官网」，提供入服教程、服务器信息、关于等页面，不含任何入服检测 / IP 检测功能，页面运行时也不发起网络请求。

## 目录结构

```
.
├── docs/                      # VuePress 文档源（站点全部内容）
│   ├── README.md             # 首页（Hero + 特性卡片）
│   ├── entry/README.md       # 入服方式（Java 版 + EasyTier 四页图文教程）
│   ├── server/README.md      # 服务器信息
│   ├── about/README.md       # 关于
│   └── .vuepress/
│       ├── config.ts         # 站点标题、导航、页脚、默认深色等配置
│       ├── client.ts         # 组件注册与动效初始化
│       ├── components/       # HyplayEntry.vue / HyplayServer.vue / HyplayIcon.vue
│       ├── utils/            # tilt / cursor / reveal / icons 动效与图标工具
│       ├── styles/index.css  # 顶栏毛玻璃、光标、卡片等自定义样式
│       └── public/           # 图片、图标、Minecraft 字体
├── preview/                   # 已构建好的静态成品（可直接部署 / 本地预览）
├── Preview.bat               # 双击本地预览（零依赖，PowerShell 实现）
├── preview-server.ps1        # 零依赖本地预览服务
├── Build-Site.bat            # 构建静态站点（自动 npm install）
├── Start-Dev.bat             # 启动开发服务器（自动 npm install）
├── package.json
└── LICENSE                   # Apache-2.0
```

## 快速开始

### 1. 只看成品（无需安装任何软件）

双击 `Preview.bat`，会自动启动本地预览服务并打开浏览器（默认 `http://localhost:8080/`，端口被占用会自动顺延），关闭黑色命令行窗口即停止。

> 注意：不要直接双击 `preview/index.html` 打开，必须用 `Preview.bat`，否则路由和资源会 404。
> 环境要求：Windows 10 / 11 自带的 PowerShell 即可，无需 Node.js、无需联网。
> 若提示「拒绝访问」或端口被占用，请右键 `Preview.bat` 选择「以管理员身份运行」。

### 2. 修改源码（需要 Node.js）

1. 安装 **Node.js 20.19+ 或 22.12+**（自带 npm）
2. 双击 `Start-Dev.bat`，首次运行自动执行 `npm install`（需联网），然后启动开发服务器 `http://127.0.0.1:8080/`
3. 国内安装依赖慢时，先执行：`npm config set registry https://registry.npmmirror.com`
4. 停止：窗口内按 `Ctrl+C` 或直接关闭窗口

### 3. 重新构建与上线

1. 双击 `Build-Site.bat`，构建产物在 `docs/.vuepress/dist`
2. 把 `dist` 目录里的全部内容上传到任意静态服务器 / 对象存储 / Pages 即可
3. 若部署在二级路径（如 `https://example.com/hyplay/`），先在 `docs/.vuepress/config.ts` 加入 `base: '/hyplay/'`，再重新构建
4. 也可以直接部署 `preview/` 目录（已构建成品）

## 需要知道的几点

- 页面默认深色主题，右上角可手动切换，首次访问会记住选择
- 服务器地址与进服步骤写在两处：
  - `docs/.vuepress/components/HyplayEntry.vue`（`SERVER_IP` 常量 + `stages` 数组，共 4 页 15 步）
  - `docs/.vuepress/components/HyplayServer.vue` 的 `rows` 数组
  - 教程视频链接在 `HyplayEntry.vue` 的 `VIDEO_URL` 常量
- 顶栏、光标、卡片动效参考纯 CSS + 原生 JS 实现，无额外依赖
- 图标使用 VuePlume 内置的 Iconify 图标（material-symbols 等），`devDependencies` 里的 `@iconify/json` 用于在构建时把图标内联进 CSS，因此断网状态下图标也能正常显示
- 站点图标（favicon / 左上角 logo）为 `docs/.vuepress/public/ico/hyplay.png`，原文件来自 Velocity 的 MiniMOTD 图标目录
- 入服页下滑时会从上向下逐条淡入（`data-reveal` + 滚动扫描），已适配 `prefers-reduced-motion`

## 许可证

本项目遵循 **Apache-2.0** 许可证，详见 [`LICENSE`](./LICENSE)。
