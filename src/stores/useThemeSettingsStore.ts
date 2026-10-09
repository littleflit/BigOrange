// src/stores/useThemeSettingsStore.ts
// Day/night mode and the background-derivation switches.
//
// Split out of useSettingsUiStore so the theme has one owner. Consumers deliberately keep
// receiving isDaylight as a prop for now: it is read in 187 files, and giving each of them its
// own subscription would wake 187 components on every toggle without removing the re-render.
// Changing how it is consumed is a separate, one-shot migration.

import { create } from 'zustand';
import i18n from '../i18n/config';

import { getStoredBoolean, setStoredBoolean } from './storagePrimitives';
import { setStatusMessage } from './useStatusMessageStore';

export const FOLLOW_SYSTEM_THEME_STORAGE_KEY = 'follow_system_theme';

export const readSystemThemeIsDaylight = (): boolean | null => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches;
};

const initialFollowSystemTheme = getStoredBoolean(FOLLOW_SYSTEM_THEME_STORAGE_KEY, false);
const initialStoredDaylight = getStoredBoolean('default_theme_daylight', false);
const initialDaylight = initialFollowSystemTheme
    ? (readSystemThemeIsDaylight() ?? initialStoredDaylight)
    : initialStoredDaylight;

const readStoredDisableHomeDynamicBackground = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const saved = localStorage.getItem('disable_home_dynamic_background');
    if (saved !== null) {
        return saved === 'true';
    }

    const legacySaved = localStorage.getItem('enable_home_dynamic_background');
    if (legacySaved !== null) {
        return legacySaved !== 'true';

    }

    return false;
};

export type ThemeSettingsState = {
    useCoverColorBg: boolean;
    staticMode: boolean;
    disableHomeDynamicBackground: boolean;
    /** Glass opacity: 0 is full liquid glass, 1 is fully opaque (glass off). */
    liquidGlassOpacity: number;
    isDaylight: boolean;
    followSystemTheme: boolean;
    handleToggleCoverColorBg: (enable: boolean) => void;
    handleToggleStaticMode: (enable: boolean) => void;
    handleToggleDisableHomeDynamicBackground: (disable: boolean) => void;
    setLiquidGlassOpacity: (value: number) => void;
    setDaylightPreference: (isDaylight: boolean) => void;
    setDaylightPreferenceFromSystem: (isDaylight: boolean) => void;
    setFollowSystemTheme: (enabled: boolean) => void;
};

const LIQUID_GLASS_OPACITY_STORAGE_KEY = 'liquid_glass_opacity';
const LEGACY_LIQUID_GLASS_ENABLED_STORAGE_KEY = 'liquid_glass_enabled';

const clamp01 = (value: number): number => (
    Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
);

const readStoredLiquidGlassOpacity = (): number => {
    if (typeof window === 'undefined') {
        return 0;
    }
    try {
        const saved = window.localStorage.getItem(LIQUID_GLASS_OPACITY_STORAGE_KEY);
        if (saved !== null) {
            const parsed = Number.parseFloat(saved);
            if (Number.isFinite(parsed)) {
                return clamp01(parsed);
            }
        }
        // One-way migration from the boolean switch: off meant fully opaque.
        if (window.localStorage.getItem(LEGACY_LIQUID_GLASS_ENABLED_STORAGE_KEY) === 'false') {
            return 1;
        }
    } catch {
        // Best-effort visual preference; a blocked storage must never break the dialog.
    }
    return 0;
};

export const useThemeSettingsStore = create<ThemeSettingsState>((set, get) => ({
    useCoverColorBg: getStoredBoolean('use_cover_color_bg', false),
    staticMode: getStoredBoolean('static_mode', false),
    disableHomeDynamicBackground: readStoredDisableHomeDynamicBackground(),
    liquidGlassOpacity: readStoredLiquidGlassOpacity(),
    followSystemTheme: initialFollowSystemTheme,
    isDaylight: initialDaylight,
    handleToggleCoverColorBg: (enable) => {
        setStoredBoolean('use_cover_color_bg', enable);
        set({ useCoverColorBg: enable });
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'coverColorAdded' : 'coverColorDefault')),
        });
    },
    handleToggleStaticMode: (enable) => {
        setStoredBoolean('static_mode', enable);
        set({ staticMode: enable });
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (enable ? 'staticModeOn' : 'staticModeOff')),
        });
    },
    handleToggleDisableHomeDynamicBackground: (disable) => {
        setStoredBoolean('disable_home_dynamic_background', disable);
        set({ disableHomeDynamicBackground: disable });
        setStatusMessage({
            type: 'info',
            text: i18n.t('notifications.' + (disable ? 'homeBgDisabled' : 'homeBgEnabled')),
        });
    },
    setLiquidGlassOpacity: (value) => {
        const opacity = clamp01(value);
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(LIQUID_GLASS_OPACITY_STORAGE_KEY, String(opacity));
            }
        } catch {
            // Best-effort visual preference; a full or blocked storage must never break the dialog.
        }
        // A slider drag fires continuously; no toast (unlike the one-shot toggles above).
        set({ liquidGlassOpacity: opacity });
    },
    // System updates are kept separate from the manual setter so a user click can disable auto-follow.
    setDaylightPreferenceFromSystem: (enabled) => {
        if (!get().followSystemTheme) {
            return;
        }

        setStoredBoolean('default_theme_daylight', enabled);
        set({ isDaylight: enabled });
        if (typeof window !== 'undefined' && window.electron?.setNativeTheme) {
            void window.electron.setNativeTheme('system');
        }
    },
    setFollowSystemTheme: (enabled) => {
        setStoredBoolean(FOLLOW_SYSTEM_THEME_STORAGE_KEY, enabled);
        set({ followSystemTheme: enabled });

        if (typeof window !== 'undefined' && window.electron?.setNativeTheme) {
            void window.electron.setNativeTheme(enabled ? 'system' : (get().isDaylight ? 'light' : 'dark'));
        }

        if (enabled) {
            const systemThemeIsDaylight = readSystemThemeIsDaylight();
            if (systemThemeIsDaylight !== null) {
                get().setDaylightPreferenceFromSystem(systemThemeIsDaylight);
            }
        }
    },
    setDaylightPreference: (enabled) => {
        const wasFollowingSystem = get().followSystemTheme;
        if (wasFollowingSystem) {
            setStoredBoolean(FOLLOW_SYSTEM_THEME_STORAGE_KEY, false);
        }
        setStoredBoolean('default_theme_daylight', enabled);
        set({ isDaylight: enabled, ...(wasFollowingSystem ? { followSystemTheme: false } : {}) });
        if (typeof window !== 'undefined' && window.electron?.setNativeTheme) {
            void window.electron.setNativeTheme(enabled ? 'light' : 'dark');
        }
    },
}));

/**
 * The ThemeSettings half of the former settings snapshot, for the surfaces that
 * legitimately edit this whole domain at once. Ordinary consumers select one field instead.
 */
export const selectThemeSettingsSnapshot = (state: ThemeSettingsState) => ({
    isDaylight: state.isDaylight,
    followSystemTheme: state.followSystemTheme,
    useCoverColorBg: state.useCoverColorBg,
    staticMode: state.staticMode,
    disableHomeDynamicBackground: state.disableHomeDynamicBackground,
    liquidGlassOpacity: state.liquidGlassOpacity,
    setDaylightPreference: state.setDaylightPreference,
    setDaylightPreferenceFromSystem: state.setDaylightPreferenceFromSystem,
    setFollowSystemTheme: state.setFollowSystemTheme,
    handleToggleCoverColorBg: state.handleToggleCoverColorBg,
    handleToggleStaticMode: state.handleToggleStaticMode,
    handleToggleDisableHomeDynamicBackground: state.handleToggleDisableHomeDynamicBackground,
});

// The liquid-glass amount lives on <html> as `--lg-op` (0 = full glass, 1 = fully
// opaque) so every `.lg-*` surface in the app follows one slider from CSS alone -
// no prop threading, no per-surface branches.
const syncLiquidGlassAmount = (opacity: number) => {
    if (typeof document === 'undefined') {
        return;
    }
    document.documentElement.style.setProperty('--lg-op', String(clamp01(opacity)));
};

if (typeof window !== 'undefined') {
    syncLiquidGlassAmount(useThemeSettingsStore.getState().liquidGlassOpacity);
    useThemeSettingsStore.subscribe((state, previous) => {
        if (state.liquidGlassOpacity !== previous.liquidGlassOpacity) {
            syncLiquidGlassAmount(state.liquidGlassOpacity);
        }
    });
}

// Seed Electron's native theme from the stored preference at startup. Lives here rather than in
// useSettingsUiStore because it reads nothing but this domain.
if (typeof window !== 'undefined' && window.electron?.setNativeTheme) {
    const initialTheme = useThemeSettingsStore.getState();
    void window.electron.setNativeTheme(
        initialTheme.followSystemTheme ? 'system' : (initialTheme.isDaylight ? 'light' : 'dark'),
    );
}

// Module-level handle for the assembly layer; an action needs no subscription.
export const handleToggleCoverColorBg = (enable: boolean) => useThemeSettingsStore.getState().handleToggleCoverColorBg(enable);
