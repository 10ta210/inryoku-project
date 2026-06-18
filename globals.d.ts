/**
 * inryokü global type declarations
 * Window 上のグローバル拡張 + 外部 CDN SDK (Sentry/THREE 等)
 */

declare global {
  interface Window {
    // Sentry browser SDK (CDN script で挿入)
    Sentry?: any;
    __INRYOKU_SENTRY_DSN__?: string;
    __INRYOKU_ENV__?: string;
    __INRYOKU_RELEASE__?: string;

    // P1 stage flags
    P1_STAGE13_RESET?: boolean;
    P1_ONLY_MODE?: boolean;
    p1FullScreenUnlocked?: boolean;

    // P1 stage1 sphere shader material 公開 (debug 用)
    __p1mat?: any;
    inryokuP1Stage1?: any;
    inryokuP1Stage2?: any;
    inryokuP1Stage5?: any;
    inryokuP1Stage6?: any;
    inryokuP1Stage7?: any;
    inryokuP1?: any;
    inryokuHarmonic?: any;
    lensPass?: any;

    // dev flags
    _p1FastForward?: number;
    _p1ShaderShared?: any;
    _p1LensDisabled?: boolean;
    _p1CamFixedForFull?: boolean;
    _p1LegacyHidden?: boolean;
    _inryokuP1_50fired?: boolean;
    _inryokuP1ToP2?: any;
    __inryokuP1Debug?: any;
    __inryokuP1ToP2?: any;
    __inryokuPhase?: any;
    __inryoku_mobile?: any;
    __p1_singStartB?: number;
    __p1_singStartW?: number;
    p3AudioEnergy?: number;
    webkitAudioContext?: typeof AudioContext;
  }

  // THREE 0.160 (UMD CDN) — vendor/three.min.js 経由
  const THREE: any;
}

export {};
