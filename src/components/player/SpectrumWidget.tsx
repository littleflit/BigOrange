import React, { useEffect, useRef } from 'react';

// src/components/player/SpectrumWidget.tsx
// 播放页左下角 48 段实时频谱小组件：读共享 AnalyserNode，纯显示不拦截点击。

interface SpectrumWidgetProps {
    analyserRef: React.RefObject<AnalyserNode | null>;
    visible: boolean;
    isDaylight: boolean;
}

const BARS = 48;
const MAX_HZ = 16000;
const READ_INTERVAL_MS = 120;

const SpectrumWidget: React.FC<SpectrumWidgetProps> = ({ analyserRef, visible, isDaylight }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const readoutRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!visible) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        let rafId = 0;
        let lastReadAt = 0;
        let levels = new Float32Array(BARS);
        const data = new Uint8Array(2048);

        const draw = (now: number) => {
            rafId = requestAnimationFrame(draw);
            const analyser = analyserRef.current;
            if (now - lastReadAt >= READ_INTERVAL_MS) {
                lastReadAt = now;
                if (analyser) {
                    analyser.getByteFrequencyData(data);
                    const binHz = (analyser.context.sampleRate / 2) / analyser.frequencyBinCount;
                    const topBin = Math.min(analyser.frequencyBinCount - 1, Math.floor(MAX_HZ / binHz));
                    for (let index = 0; index < BARS; index += 1) {
                        const bin = Math.min(topBin, Math.floor(((index / (BARS - 1)) ** 2) * topBin));
                        levels[index] = data[bin] / 255;
                    }
                    let peakBin = 0;
                    let peakValue = 0;
                    for (let bin = 0; bin <= topBin; bin += 1) {
                        if (data[bin] > peakValue) {
                            peakValue = data[bin];
                            peakBin = bin;
                        }
                    }
                    if (readoutRef.current) {
                        const powerDb = peakValue > 0 ? (20 * Math.log10(peakValue / 255)).toFixed(1) : '-∞';
                        readoutRef.current.textContent = `${powerDb} dB · ${Math.round(peakBin * binHz)} Hz`;
                    }
                } else {
                    levels = new Float32Array(BARS);
                }
            }

            const width = canvas.width;
            const height = canvas.height;
            context.clearRect(0, 0, width, height);
            const gap = 2;
            const barWidth = (width - gap * (BARS - 1)) / BARS;
            const accent = isDaylight ? '#ea580c' : '#fb923c';
            context.fillStyle = accent;
            for (let index = 0; index < BARS; index += 1) {
                const barHeight = Math.max(2, levels[index] * (height - 18));
                const x = index * (barWidth + gap);
                const y = height - 18 - barHeight;
                context.globalAlpha = 0.25 + levels[index] * 0.75;
                context.beginPath();
                context.roundRect(x, y, barWidth, barHeight, 2);
                context.fill();
            }
            context.globalAlpha = 1;
        };

        rafId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafId);
    }, [visible, analyserRef, isDaylight]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute bottom-24 left-6 z-10 w-56 select-none rounded-2xl bg-black/35 p-3 backdrop-blur-md">
            <canvas ref={canvasRef} width={208} height={76} className="h-[76px] w-full" />
            <div ref={readoutRef} className="mt-1 text-center text-[10px] tabular-nums text-white/70" />
        </div>
    );
};

export default SpectrumWidget;
