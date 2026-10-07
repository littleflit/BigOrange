import { defineVisualizerTuning } from '../tuningRegistry';

// src/components/visualizer/rings52hz/tuning.ts
// Injects Rings52hz's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({
    mode: 'rings52hz',
    settingsKey: 'rings52hzTuning',
    settingsSetterKey: 'handleSetRings52hzTuning',
    apply: (props, tuning) => ({ ...props, rings52hzTuning: tuning }),
});
