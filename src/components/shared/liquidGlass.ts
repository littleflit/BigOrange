// src/components/shared/liquidGlass.ts
// Liquid-glass pilot (settings dialog): class-name helpers over the `.lg-*`
// rules in index.css. Daylight is a modifier class, not a second rule set,
// so future callers only branch once here.

export const liquidGlassPanel = (isDaylight: boolean): string => (
    isDaylight ? 'lg-panel lg-panel-daylight' : 'lg-panel'
);

export const liquidGlassCard = (isDaylight: boolean): string => (
    isDaylight ? 'lg-card lg-card-daylight' : 'lg-card'
);

export const liquidGlassPill = (isDaylight: boolean): string => (
    isDaylight ? 'lg-pill lg-pill-daylight' : 'lg-pill'
);

export const liquidGlassTile = (isDaylight: boolean): string => (
    isDaylight ? 'lg-tile lg-tile-daylight' : 'lg-tile'
);
