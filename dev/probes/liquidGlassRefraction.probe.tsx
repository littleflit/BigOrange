import React, { useEffect, useRef, useState } from 'react';
import { Droplets, FlaskConical, Sparkles, Waves } from 'lucide-react';
import type { ProbeDefinition } from './definition';
// dev/probes/liquidGlassRefraction.probe.tsx
//
// 回答一个问题：SVG 折射（feDisplacementMap）在本项目的 Electron/Chromium 里
// 对 backdrop 是否生效、代价多大。折射只有压在密集内容上才看得见，所以背景
// 是故意摆满的多语种歌词行和色块；压在纯色上是什么都看不出来的，那不是滤镜坏了。
//
// 看法：
// - 开关对比同一块玻璃，看文字边缘有没有被“掰弯”。有效果 → 可用，没变化 →
//   当前 Chromium 不吃 backdrop-filter: url()， refraction 方案直接毙掉。
// - 拖动强度时看 FPS。静态 feTurbulence 只在重绘时算，日常静置不耗；但窗口
//   缩放、滚动、动画经过时每一帧都算，大面积铺开必掉帧 —— 这就是只敢给单个
//   hero 元素做的原因。

const BACKDROP_LINES = [
    '詩情を持たずとも、あなたを現実へと導くその神文の詩を紡ぐ。',
    'Weave that prosaic divine poem that leads you to reality.',
    '编织那没有诗意，却能将你带到现实的神文之诗。',
    'Tisse ce poème divin sans poésie qui te mène au réel.',
    'of course i still love you · もちろん、今でもあなたを愛してるよ',
    'Biānzhī nà méiyǒu shīyì, què néng jiāng nǐ dài dào xiànshí de shénwén zhī shī.',
];

const TILES = [
    { icon: Sparkles, label: '折射开' },
    { icon: Waves, label: 'backdrop' },
    { icon: Droplets, label: 'url()' },
    { icon: FlaskConical, label: '对比用' },
];

const useFps = (): number => {
    const [fps, setFps] = useState(0);
    useEffect(() => {
        let frames = 0;
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            frames += 1;
            if (now - last >= 1000) {
                setFps(Math.round((frames * 1000) / (now - last)));
                frames = 0;
                last = now;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);
    return fps;
};

const ProbeBody: React.FC = () => {
    const [enabled, setEnabled] = useState(true);
    const [scale, setScale] = useState(28);
    const fps = useFps();
    const filterId = 'lg-refract-probe';

    return (
        <div style={{ padding: 24, background: '#101014', minHeight: '100vh', color: '#e4e4e7' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>液态玻璃折射探针</h2>
            <p style={{ fontSize: 12, opacity: 0.6, maxWidth: 640 }}>
                四块玻璃压在密集歌词上。开关对比文字边缘是否被掰弯；拖强度看 FPS。
                SVG 滤镜定义在页面底部（零尺寸，引用生效即可，不参与布局）。
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0', fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                    折射（off = 纯 CSS 模糊对照组）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    强度
                    <input
                        type="range"
                        min={0}
                        max={80}
                        step={1}
                        value={scale}
                        onChange={(event) => setScale(Number(event.target.value))}
                        style={{ width: 200 }}
                    />
                    <span style={{ fontFamily: 'monospace' }}>{scale}</span>
                </label>
                <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>FPS: {fps}</span>
            </div>

            <div
                style={{
                    position: 'relative',
                    borderRadius: 24,
                    overflow: 'hidden',
                    padding: '56px 40px',
                    background:
                        'radial-gradient(600px 300px at 20% 10%, rgba(168,85,247,0.5), transparent 70%),' +
                        'radial-gradient(500px 260px at 85% 80%, rgba(34,211,238,0.4), transparent 70%),' +
                        'linear-gradient(135deg, #1c1030, #0b2a3a)',
                }}
            >
                <div style={{ display: 'grid', gap: 10, fontSize: 15, lineHeight: 1.9 }}>
                    {BACKDROP_LINES.concat(BACKDROP_LINES).map((line, index) => (
                        <div key={index} style={{ opacity: index % 3 === 0 ? 0.95 : 0.55 }}>
                            {line}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 28, marginTop: -160, position: 'relative', zIndex: 1 }}>
                    {TILES.map(({ icon: Icon, label }, index) => (
                        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <div
                                style={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 12px 32px rgba(0,0,0,0.4)',
                                    backdropFilter: enabled && index < 3 ? `url(#${filterId})` : 'blur(14px) saturate(1.5)',
                                    WebkitBackdropFilter: enabled && index < 3 ? `url(#${filterId})` : 'blur(14px) saturate(1.5)',
                                }}
                            >
                                <Icon size={34} />
                            </div>
                            <span style={{ fontSize: 11, opacity: 0.6 }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
                <defs>
                    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves={2} seed={7} result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                </defs>
            </svg>
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'liquidGlassRefraction',
    title: '液态玻璃·SVG 折射可行性',
    description: 'backdrop-filter: url() 在当前 Chromium 是否生效、什么代价；前三块玻璃开折射，第四块是纯 CSS 对照',
    Component: ProbeBody,
};

export default probe;
