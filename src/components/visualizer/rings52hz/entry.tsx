import React from 'react';
import { DEFAULT_RINGS52HZ_TUNING } from '../../../types';
import { defineVisualizer } from '../definition';
import Rings52hzSettingsPanel from './Rings52hzSettingsPanel';

const VisualizerRings52hz = React.lazy(() => import('./VisualizerRings52hz'));

// src/components/visualizer/rings52hz/entry.tsx
// Registers 52Hz and its preview tuning panel.
export default defineVisualizer({
    mode: 'rings52hz',
    order: 65,
    labelKey: 'ui.visualizerRings52hz',
    labelFallback: '52Hz',
    previewSeed: 'rings52hz',
    previewStartOffset: 12,
    tuningKind: 'rings52hz',
    render: props => <VisualizerRings52hz key={props.seed} {...props} />,
    renderSettingsPanel: props => <Rings52hzSettingsPanel {...props} />,
    resetSettings: ({ resetRings52hzTuning, setDraftRings52hzTuning }) => {
        setDraftRings52hzTuning?.(DEFAULT_RINGS52HZ_TUNING);
        resetRings52hzTuning?.();
    },
});
