BigOrange
Lyrics Reimagined 辞曲新境

项目简介

BigOrange 是以全屏沉浸式歌词播放为核心的在线音乐播放器，支持网易云、Navidrome 和本地音乐库。功能包括智能歌词匹配、AI 生成配色主题、多种全屏歌词动画。界面语言为中文和英文。

提供 Electron 桌面端版本（Windows、macOS、Linux）与基于 Node.js 的 Web 版本，支持多平台部署。移动设备或浏览器使用 Web 版本，自行部署到支持 Node.js 的平台后即可访问。

核心能力

在线搜索与播放：搜索歌曲、歌手或专辑后即可播放，自动加载相关封面与歌词。
本地音乐支持：可导入本地音频文件，在本地安全保存索引信息，不上传文件内容。详细用法见 docs/local-library-management.md。
智能歌词匹配：本地歌曲可自动匹配在线歌词与封面，也支持手动修正匹配结果。
本地歌词文件识别：自动加载同目录同名 .lrc、.vtt、.ttml、.qrc、.yrc、.krc 歌词文件，或歌词文件内嵌 LRC 歌词。适配 LDDC 生成的增强型逐字歌词格式。
Now Playing 接入：支持通过本机 Now Playing 服务接入外部播放器的歌曲、时间轴与歌词信息，并驱动 BigOrange 的舞台视图与全屏歌词渲染。服务地址 https://github.com/Widdit/now-playing-service/
AI 主题生成：基于歌曲情绪与歌词内容生成沉浸式背景与视觉参数。
多端体验：提供 Web 部署方式，同时支持桌面端打包分发。
模组系统（实验性）：桌面版可通过 Folium 模组添加歌词动画、背景、播放页图层、命令等，模组市场地址 https://folium-compound.vercel.app

获取方式

桌面版内置前后端运行环境，适合希望即装即用的用户。

一键部署

Vercel 一键部署 https://vercel.com/new/clone?repository-url=https://github.com/littleflit/BigOrange
Cloudflare 一键部署 https://deploy.workers.cloudflare.com/?url=https://github.com/littleflit/BigOrange

自托管用户可以使用 Docker Compose 全栈部署，见 deploy/docker/README.md。本地音乐目录访问依赖可信 HTTPS 安全上下文，部署文档包含 NAS 反向代理和证书要求。

移动端：部署 Web 版本或自托管版本后，通过 Android Chrome 或 iOS Safari 创建 PWA 应用（将网页应用添加到桌面）来使用。

有一定技术的用户可以使用 capacitor 将 Web 版本打包成可安装的安卓 apk，可参考示范仓库 https://github.com/chthollyphile/folia-sonnet

直接下载

Windows、macOS、Linux 最新安装包前往 Releases 页面下载 https://github.com/littleflit/BigOrange/releases/latest
Arch Linux 可通过 AUR 获取 bigorange-bin（待发布）。

Linux 包、Wayland 和 Hyprland 遥控窗、桌面端细节见 docs/technical.md。

文档与开发

部署、环境变量、本地开发、Stage API、常用脚本和技术栈见 docs/technical.md。

模组系统 Folium v1.x

模组系统是实验性功能，仅桌面版可用，默认关闭，需要在设置、实验室、模组系统中开启。

Folium 是 BigOrange 的模组平台。模组可以添加新的歌词动画模式和背景类型、在播放页上叠加内容、给进度条加按钮和标记、注册命令与设置分区、在歌词显示前改写歌词，也可以通过 Node 入口调用 ffmpeg 等本地能力。模组以可信代码运行，每个模组在启用前都要在原生窗口中确认，文件变化后需要重新确认。

模组市场 https://folium-compound.vercel.app 提供官方模组和经过审查的社区模组，下载 zip 后拖进模组面板即可安装。市场里的模组都带有 Folium 签名，安装后显示官方认证，没有签名的第三方模组显示未验证，同样可以使用。

模组开发与贡献指南见 docs/folium/contributing.md。Folium API 参考见 docs/folium/api.md。平台规范见 mods/README.md。示范模组在仓库的 mods 目录，覆盖歌词动画、调参、进度条、播放页图层与透明视频导出。

Sync Server

BigOrange 提供可选的官方同步服务端 sync-server，用于在多个设备之间同步外观设置与 AI 主题库。服务端由用户自行托管，适合希望跨设备同步配色主题的用户。

支持 Cloudflare Workers 加 D1 部署（免服务器运维，推荐），部署地址 https://deploy.workers.cloudflare.com/?url=https://github.com/littleflit/BigOrange/tree/main/sync-server
支持 Docker，镜像与 Compose 入口见 deploy/docker/README.md。
支持 Node.js 自托管，使用 SQLite，适合本地或不方便使用 Docker 的环境。

详细的环境变量、Token 配置与部署步骤见 sync-server/README.md 和 deploy/docker/README.md。部署完成后，在 BigOrange 的存储设置中填写服务端地址和 SYNC_TOKEN 即可启用同步。

本地音乐与匹配说明

BigOrange 会读取音频文件元数据、同目录歌词和封面，并可通过网易云补全歌曲信息。匹配不准确时，可以手动选择候选、恢复首次导入的本地信息，或进一步合并、拆分艺术家与专辑实体。

完整的导入、重扫、匹配、实体编辑、歌单、缓存和故障排查说明见 docs/local-library-management.md。

贡献者

感谢所有提交 Issue、Bug 报告、想法建议、测试与代码编写的贡献者，均依据 all-contributors 规范统计。贡献记录见 CONTRIBUTORS.md。

法律与免责声明

本项目在 AI 的广泛协助下开发，可能存在细微或不易察觉的问题。

本项目主要用于展示播放动效、界面设计与相关工程实现。应用中涉及的在线音乐流媒体、歌词、专辑封面及其他内容，版权均归对应权利人所有。

本仓库及其源代码仅供个人学习、技术交流与非营利测试使用。请勿用于商业盈利用途。因对在线资源的传播、加工或再分发引发的版权纠纷或其他责任，均由使用者自行承担，项目开发者不承担相关责任。

请始终尊重数字版权，在条件允许时通过官方平台支持正版音乐。

致谢

https://github.com/chenmozhijin/LDDC
https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced
https://github.com/chenglou/pretext
https://github.com/paper-design/shaders
https://github.com/amll-dev/amll-ttml-db

许可证

本项目基于 AGPL-3.0 许可证开源。
