# Omni 在线音乐层

`src/services/onlineMusic/omni.ts` 是普通在线歌曲数据的唯一公开入口。组件、hook、store 和普通 app service 不得直接调用具体 provider、registry、transport 或 raw API；只有明确的跨 provider 编排，或 provider adapter/transport 自身，才可以使用 provider-explicit 层。

## Layer map

```text
UI / hooks / stores / app services
  -> omni.ts
       -> providerRegistry.ts
            -> neteaseProvider.ts
       -> providerAccountCache.ts / providerStorage.ts
  -> src/types/onlineMusic.ts（共享合同）
```

当前 registry 只注册 `netease`。Navidrome 是独立的 Subsonic 服务，入口是 `src/services/navidromeService.ts`，不属于 Omni provider。

扫码登录的分工：provider（`neteaseProvider.ts`）把后端的响应翻译成 `QrLoginState`，失败时带上后端原文（`message`）、原始返回字段（`detail`）、结构化原因（`reason`：手机上取消、连接被重置）、冷却（`retryAfterMs`）以及「网络层瞬时失败」（`transient`，没拿到上游回应、二维码仍有效）；要码与生成二维码拿不到 key / 图片时直接抛错，不再交出空值。provider 不持有任何扫码的模块级状态：一轮扫码的步骤、代次、时间线都在 Library Core 的 `core/services/providerLoginSession.ts`。会话在登录失败后自动调用 `omni.runQrLoginSelfCheck` 跑一次主动自检（在手机上取消除外），结论由 `core/model/loginSelfCheckRules.ts` 推出、显示在登录界面上，并和时间线、`omni.getQrLoginDiagnostics` 的 provider 段一起进诊断报告。

provider 段的内容来自主进程的内嵌后端快照（`loginBackendDiagnostics.ts` 排版，`electron/loginBackendIpc.cjs` 的 `get-login-diagnostics`）：应用与系统环境、凭据加密后端、后端状态、每一轮拉起的步骤（耗时、结果、错误原文）、上游连接记录（`electron/networkRecorder.cjs`：连了哪个地址、v4 还是 v6、TCP / TLS 耗时、断在哪一步、Node 错误码），网易另有每次登录请求的记录与扫码身份。报告不做隐私脱敏（IP、错误原文都保留），登录界面如实告知报告收集了哪些数据；登录凭据（cookie、token、session）的值从不进入记录。网页版没有主进程，provider 段只有会话状态，自检只检查远端 API 能不能连上（`loginSelfCheck.ts`）。

网易扫码轮询（`/login/qr/check`）在桌面端由主进程替换的 `login_qr_check` 处理（`electron/neteaseApiStartup.cjs` 的 `createLoginQrCheck`）：上游原版请求失败时只回 `404 Not Found`，替换后渲染进程拿到真实的 `{ code, msg }`，例如 `code 502: read ECONNRESET`。扫码的要码与轮询在主进程遇到网络层失败时立即重发一次（`withQrNetworkRetry`）；渲染进程的会话对轮询的瞬时失败再容忍两次。识别连接被重置与网络层失败用 `shared/networkErrorText`（`.mjs` 给渲染进程，`.cjs` 给主进程，内容一致）。主进程在扫码请求被重置后，于下一次要码前换掉扫码身份（`electron/neteaseLoginIdentity.cjs`）：`deviceId` 每次都换；匿名 token `MUSIC_A` 只在 token 文件比加载时更新时才换得到。网易内嵌后端的拉起、状态与诊断在 `electron/neteaseBackend.cjs`，`electron/main.cjs` 只负责装配。

取消当前二维码（关窗、到期）与要新码一样结束这一轮；没扫过码的自然过期不算失败。诊断入口有失败形态就给（`canShowLoginDiagnostics` 只看 failure，手机上取消除外）。登录界面（grid 的诊断区块与 TUI 的 F4）按同一规则给诊断入口。

## Public contract

调用前先看 `omni.ts` 的方法和 `src/types/onlineMusic.ts` 的类型。常用入口按能力分组：

| 能力 | Omni 方法/区域 | 结果/边界 |
| --- | --- | --- |
| provider 状态 | `getProviderSummaries`、`getActiveProviderSummary`、`getProviderCapabilities`、`getProviderAvailability` | `useOnlineProviderAccountStore` 提供 active provider 与账号快照 |
| 账号/二维码 | `getLoginStatus`、`logout`、`createQrLogin`、`checkQrLogin` | provider auth adapter；不要在 UI 直接保留 raw session |
| 搜索 | `searchSongs`、`searchProviderSongs` | 普通搜索按 active provider；显式 provider 或跨 provider 用第二个方法 |
| 用户库 | `getUserPlaylists`、`getProviderUserPlaylists`、`getUserAlbums`、`getLikedSongIds`、`getCloudCollection` | 统一 `OmniCollection` / page 类型，账号快照可先展示再静默刷新 |
| 推荐 | `getHomeFeed`、`getPersonalFm`、`supportsDailySongs`、`getDailySongs`、`getRecommendationHistory*`、`dislikeSong` | 首页推荐与历史推荐仍由 Omni 路由；日推入口按能力显示，空结果不隐藏入口 |
| 播放/歌词 | `getSongDetail`、`canPlaySong`、`getAudioSource`、`getLyrics`、`getChorusRanges` | 输出 `OmniAudioSource` / `OmniLyricsResult`；Navidrome 歌词走独立 service |
| 听歌上报 | `canReportPlayback`、`reportPlayback` | 只有声明 `playbackReports` 的 provider 支持（当前仅网易云）；时长必须是真实累计播放秒数，频控在 `playbackReportGate.ts` |
| 可用性 | `getSongAvailability`、`getSongReplacement` | 保留 unsupported / unavailable / auth 等 `OmniError` 语义 |
| 集合详情 | `getCollectionTracks`、`getCollectionDetail`、`getAlbumDetail`、`getArtistDetail`、`getArtistSongs`、`getArtistAlbums` | 按 collection 的 `providerId` 路由 |
| 修改 | `likeSong`、`toggleSongLike`、`getSubscriptionStatus`、`subscribe`、`updateCollectionTracks` | mutation 按歌曲/集合所属 provider 执行并更新 account cache |
| 外链与引用 | `canResolveCatalogRef`、`resolveCatalogRefs`、`getSongPageUrl` | 共享 `catalogRefs.ts` 的 provider-aware 引用 |

共享类型包括 `UnifiedSong`、`OmniCollection`、`OmniPage`、`OmniLyricsResult`、`OmniAudioSource`、`OmniUser`、`OmniError`、`OmniProviderCapabilities`。调用方不能依赖 provider 的 raw field、numeric id 单独比较或 raw response envelope。

## Provider and cache files

- `providerRegistry.ts`：注册、查找、按歌曲 `sourceRef` 选择 provider、能力检查。BigOrange 只注册网易云。
- `neteaseProvider.ts`：网易云 adapter，归一化到 Omni contract。
- `providerAccountCache.ts`：按 provider 保存用户、集合、点赞 ID、hydration/freshness 快照；刷新失败保留旧快照。
- `providerStorage.ts`：renderer 的 provider session/account 持久化边界。
- `resourceCache.ts` / `resourceKeys.ts`：在线资源缓存键和缓存层。当前 kind：`audio`、`lyric`、`cover`、`theme`、`replayGain`。**新增 kind 必须同时在 `src/services/repositories/cacheRepository.ts` 的 `getCacheTableName` 与 `matchesCategory` 里登记前缀**，否则条目会静默落进 `api_cache` 兜底表、不属于任何一个「清除缓存」分类，变成清不掉的孤儿；若该 kind 是按歌曲存一份，还要确认它没有被计进 `mediaCount`（那个数字的语义是「已缓存歌曲数」，会翻倍）。
- `playbackReportGate.ts`：听歌上报的频控与可用性判断。上报写的是用户真实账号，突发的不可能记录会触发风控，所以这里限制最小间隔与每小时上限、串行发送，并给设置面板和命令面板提供同一个 `isNeteaseScrobbleReady()`。真实播放秒数的计量在 `src/utils/playbackListenTracker.ts`，接线在 `src/hooks/useNeteaseScrobbleReporter.ts`。
- `songMetadata.ts` / `songAvailability.ts`：歌曲元数据、可播放性和替代歌曲相关共享逻辑。
- `catalogRefs.ts`：歌曲、歌单、专辑、歌手的 provider-aware catalog 引用。

`omni.ts` 的 active-provider 调用带 request generation 检查：`withActiveProvider` 会丢弃 provider 切换后返回的旧响应，切换事务需要 `invalidateActiveRequests()`。不要在调用方重新实现一套取消/晚到响应防护。

## Routing rules

### Ordinary single-provider flow

```ts
import { omni } from '@/services/onlineMusic/omni';

const page = await omni.searchSongs(query, { limit: 30, offset: 0 });
const song = page.items[0];
if (song) {
    const lyrics = await omni.getLyrics(song);
    const audio = await omni.getAudioSource(song, 'high');
}
```

歌曲已经带有 provider identity 时，使用 song-aware 方法：

```ts
await omni.toggleSongLike(song);
await omni.getCollectionTracks(collection, { limit: 50, offset: 0 });
```

### Explicit cross-provider flow

歌词匹配、本地元数据匹配、联邦搜索、fallback、比较和迁移才是跨 provider。使用 `searchProviderSongs(providerId, ...)` 等显式方法，并保留每条结果的 `sourceRef.providerId`。不要为了“当前有两个 provider”就直接并发调用 raw adapter。

### Identity

在线歌曲身份是 `(sourceRef.kind='online', sourceRef.providerId, sourceRef.mediaId)`，不是 `song.id` 单值。比较、去重、替代、入队前优先使用：

- `src/utils/appPlaybackGuards.ts`：`getPlaybackSourceRef`、`getPlaybackSongKey`、`isSamePlaybackSong`
- `src/utils/appPlaybackHelpers.ts`：播放结构和来源相关派生

跨 provider 的 numeric id 不可直接去重；`online:netease:123` 与 `online:kugou:123` 默认是两个播放身份。

## Fast lookup

```powershell
rg -n "export const omni|searchSongs|getLyrics|getAudioSource|updateCollectionTracks" src/services/onlineMusic/omni.ts
rg -n "OnlineMusicProvider|OmniProvider|UnifiedSong|OmniLyricsResult|OmniAudioSource" src/types/onlineMusic.ts
rg -n "registerOnlineMusicProvider|neteaseProvider|kugouProvider|qqProvider|providerSupports" src/services/onlineMusic/providerRegistry.ts
```

先确认 Omni 是否已有能力；没有时扩展 `types/onlineMusic.ts`、`omni.ts` 和适用 adapter，不要新增第二条公开 bypass。
