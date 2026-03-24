/**
 * ═══════════════════════════════════════════════════════════════
 *  inryokü — PHASE 1: The Loading Ceremony
 * ═══════════════════════════════════════════════════════════════
 *
 *  哲学: "Reality is Grey. Observe the 50%."
 *
 *  概要:
 *    Web 1.0風のWelcome画面 → ENTERクリック後 → Three.js + GLSLによる
 *    ローディングアニメーション（9段階ステートエンジン）
 *
 *  ステートエンジン:
 *    ATTRACT(0→30%)    CMY/RGB球体が引き寄せられる
 *    EVENT_FUSE(30%)    球体が融合しBW二極に凝縮
 *    DUALITY(30→50%)   白黒ドットが中心へ加速
 *    EVENT_SING(50%)    衝突→灰色球→トンネル誕生
 *    WARP_GROW(50→75%)  トンネル成長
 *    EVENT_BREACH(75%)  スクエア境界が崩壊
 *    CONSUME(75→101%)   トンネルが現実を飲み込む
 *    EVENT_COLLAPSE     UI吸収→フルスクリーン→ホワイトアウト→太陽十字
 *    DONE               P1完了イベント発火
 *
 *  技術制約:
 *    - Three.js 0.160.0 + GLSL のみ (Canvas 2D禁止)
 *    - テクスチャは全てプロシージャル生成
 *    - EffectComposer + UnrealBloomPass 使用
 *
 *  完了時:
 *    window.dispatchEvent(new CustomEvent('inryoku:p1complete'))
 *
 *  依存:
 *    - three.js (CDN or import)
 *    - EffectComposer, RenderPass, UnrealBloomPass
 *    - enter.png (ロゴ画像、なくても動作)
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';
const WIN95_PALETTE = [
    '#000000','#800000','#008000','#808000',
    '#000080','#800080','#008080','#c0c0c0',
    '#808080','#ff0000','#00ff00','#ffff00',
    '#0000ff','#ff00ff','#00ffff','#ffffff'
];
let currentPhase = 1;
let audioContext = null;
function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }
function updateWin95Status(text) {
    const status = document.getElementById('win95-status');
    if (status) status.textContent = text;
}

// ═══ PHASE 1 ═══
function renderPhase1() {
    currentPhase = 1;
    const root = document.getElementById('root');
    root.className = 'phase-1';
    root.innerHTML = `<div style="
  background:#aaaaaa;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:'Press Start 2P', monospace;
">
  <style>
    @keyframes cursorBlink {
      0%,49%{opacity:1;}
      50%,100%{opacity:0;}
    }
    * {
      -webkit-font-smoothing: none;
      font-smooth: never;
      image-rendering: pixelated;
    }
    #evolve-btn {
      font-family:'Press Start 2P', monospace;
      font-size:11px;
      letter-spacing:1px;
      padding:7px 40px;
      background:#ffffff;
      border:2px solid #000000;
      cursor:pointer;
      color:#000000;
      border-radius:0;
      min-width:168px;
    }
    #evolve-btn:hover, #evolve-btn:active {
      background:#000000;
      color:#ffffff;
    }
    .mac-divider {
      width:100%;
      border:none;
      border-top:1px solid #000000;
      margin:6px 0;
    }
  </style>

  <!-- Macダイアログ本体 -->
  <div style="
    background:#ffffff;
    border:1px solid #000000;
    width:clamp(476px,54vw,580px);
    box-shadow:2px 2px 0 #000000;
    border-radius:0;
    overflow:hidden;
  ">

    <!-- タイトルバー -->
    <div style="
      background:repeating-linear-gradient(
        90deg,
        #000000 0px,#000000 1px,
        #ffffff 1px,#ffffff 2px
      );
      padding:4px 10px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-bottom:1px solid #000000;
      position:relative;
    ">
      <!-- クローズボックス（左上） -->
      <div style="
        position:absolute;left:10px;top:50%;transform:translateY(-50%);
        width:13px;height:13px;
        border:1px solid #000000;
        background:#ffffff;
      "></div>
      <!-- タイトルテキスト -->
      <span style="
        background:#ffffff;
        padding:1px 8px;
        font-size:10px;
        white-space:nowrap;
        font-family:'Press Start 2P', monospace;
        color:#000000;
      ">Welcome to the inryok\u00fc</span>
    </div>

    <!-- コンテンツエリア -->
    <div style="
      background:#ffffff;
      padding:28px 39px 34px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:20px;
    ">

      <!-- iアイコン + 軌道 -->
      <div>
        <svg id="orbit-svg" width="200" height="200" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="58" fill="none" stroke="#000000" stroke-width="0.5" stroke-dasharray="3 4"/>
          <circle id="px0" r="5" fill="#000000"/>
          <circle id="px1" r="5" fill="#000000"/>
          <circle id="px2" r="5" fill="#000000"/>
          <circle id="px3" r="5" fill="#000000"/>
          <circle id="px4" r="5" fill="#000000"/>
          <circle id="px5" r="5" fill="#000000"/>
          <!-- iアイコン: 黒枠・白背景の円 -->
          <circle cx="80" cy="80" r="36" fill="#ffffff" stroke="#000000" stroke-width="2"/>
          <!-- i の点 -->
          <circle cx="80" cy="65" r="4" fill="#000000"/>
          <!-- i の縦棒 -->
          <rect x="77" y="74" width="6" height="17" fill="#000000"/>
        </svg>
      </div>

      <hr class="mac-divider"/>

      <!-- visitor counter -->
      <p style="font-size:9px;color:#000000;margin:0;font-family:'Press Start 2P', monospace;text-align:center;">
        You are visitor number: <b id="vc">101010</b><span style="animation:cursorBlink 1s step-end infinite;font-weight:normal;">&#9646;</span>
      </p>

      <hr class="mac-divider"/>

      <!-- Newton quote -->
      <p style="
        font-size:7px;color:#000000;margin:0;
        text-align:center;line-height:2;
        font-family:'Press Start 2P', monospace;
        max-width:460px;
      ">
        "If I have seen further,<br>it is by standing on<br>the shoulders of giants."<br>
        <span style="font-size:6px;letter-spacing:2px;">— I. NEWTON, 1675</span>
      </p>

      <hr class="mac-divider"/>

      <!-- ボタンエリア -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;">
        <button id="evolve-btn">ENTER</button>
        <a href="#" onclick="event.preventDefault();"
           style="font-size:7px;color:#000000;text-decoration:none;letter-spacing:1px;
                  font-family:'Press Start 2P', monospace;">
          Skip to Shop →
        </a>
      </div>

    </div>
  </div>
</div>`;

    // ── P0 ピクセル軌道アニメーション ──
    (function(){
      const els=[0,1,2,3,4,5].map(i=>document.getElementById('px'+i));
      const R=58,cx=80,cy=80;
      let a=0;
      (function loop(){
        els.forEach((el,i)=>{
          if(!el)return;
          const angle=a+(i*Math.PI*2/6);
          el.setAttribute('cx', cx + R * Math.cos(angle));
          el.setAttribute('cy', cy + R * Math.sin(angle));
        });
        a+=0.008;
        requestAnimationFrame(loop);
      })();
    })();

    document.getElementById('evolve-btn').addEventListener('click', () => {
        document.querySelectorAll('.selection-title,.phase1-ui,.welcome-title,.evolve-btn-wrap').forEach(e => e.remove());
        const root = document.getElementById('root');
        root.innerHTML = ''; root.style.display = 'none';
        document.body.style.background = '#000';

        const W = window.innerWidth, H = window.innerHeight;

        // ══════════════════════════════════════════════════════
        //  THREE.JS FULLSCREEN INIT
        // ══════════════════════════════════════════════════════
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(0.5); // 低解像度レンダリング（Win95風）
        renderer.setSize(W, H);
        renderer.setClearColor(0x1a1a1a, 1);
        renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
        document.body.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // ── Lights ──
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);
        const aspect = W / H;
        const camH = 5, camW = camH * aspect;
        const camera = new THREE.OrthographicCamera(-camW, camW, camH, -camH, 0.1, 100);
        camera.position.z = 50;

        // Square dimensions in world units
        const sqPx = Math.min(Math.round(W * 0.55), Math.round(H * 0.55));
        const sqWorld = sqPx / H * camH * 2; // world units matching pixel size
        const unit = sqWorld / 10; // 1 old-unit = this many world-units

        // ══════════════════════════════════════════════════════
        //  SPLIT-RENDER PIPELINE (Step 1)
        //  スクエア内/外を分離レンダーし最終段で合成する
        //  P0: ポストプロセスなし
        //  P1: 16色ディザ (Step 4で追加予定)
        //  CRT: 最終合成後に適用予定 (Step 2/3で追加)
        // ══════════════════════════════════════════════════════

        // スクエア内描画用 RenderTarget
        let rtSquare = new THREE.WebGLRenderTarget(sqPx, sqPx, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false
        });
        // スクエア外GLSL背景用 RenderTarget (P1壁紙等で使用予定)
        const rtOuter = new THREE.WebGLRenderTarget(W, H, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        });

        // 合成シェーダー: rtSquare.texture をsq-border領域に貼り付け
        // squareRect = (left, bottom, width, height) in 0-1 screen UV
        const compositeUniforms = {
            tSquare:    { value: rtSquare.texture },
            squareRect: { value: new THREE.Vector4(0, 0, 1, 1) }
        };
        const compositeMat = new THREE.ShaderMaterial({
            uniforms: compositeUniforms,
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: [
                'precision highp float;',
                'uniform sampler2D tSquare;',
                'uniform vec4 squareRect;',
                'varying vec2 vUv;',
                'void main(){',
                '  vec2 sq=(vUv-squareRect.xy)/squareRect.zw;',
                '  if(sq.x<0.0||sq.x>1.0||sq.y<0.0||sq.y>1.0) discard;',
                '  gl_FragColor=texture2D(tSquare,sq);',
                '}'
            ].join('\n'),
            transparent: true,
            depthWrite: false
        });
        const compScene = new THREE.Scene();
        const compCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const compQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMat);
        compScene.add(compQuad);

        // bloom/composerはStep 2/3で再実装（Phase別ポストプロセスとして）
        let composer = null, bloom = null;

        // Scissor rect (GL座標: 原点=左下) — フルスクリーン切替フラグとして継続使用
        const scissor = {
            x: 0, y: 0,
            w: sqPx, h: sqPx,
            enabled: true
        };

        // ══════════════════════════════════════════════════════
        //  UI OVERLAY (HTML/CSS)
        // ══════════════════════════════════════════════════════
        const ldCSS = document.createElement('style');
        ldCSS.textContent = '@keyframes p1In{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes p1Breathe{0%,100%{opacity:.85;filter:drop-shadow(0 0 12px rgba(255,255,255,.12))}50%{opacity:1;filter:drop-shadow(0 0 24px rgba(255,255,255,.25))}}@keyframes p1BarGlow{0%,100%{box-shadow:0 0 6px rgba(255,255,255,.06)}50%{box-shadow:0 0 14px rgba(255,255,255,.14)}}@keyframes p1Slide{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes p1Sq{0%,100%{border-color:rgba(255,255,255,.1);box-shadow:0 0 12px rgba(255,255,255,.03)}50%{border-color:rgba(255,255,255,.22);box-shadow:0 0 24px rgba(255,255,255,.07)}}.p1-orb{position:absolute;border-radius:50%;filter:blur(100px);opacity:.03;pointer-events:none}@keyframes runBob{0%,100%{transform:translateY(0px) rotate(-1.5deg)}25%{transform:translateY(-5px) rotate(0deg)}50%{transform:translateY(-1px) rotate(1.5deg)}75%{transform:translateY(-5px) rotate(0deg)}}@keyframes bsodIn{from{opacity:0}to{opacity:1}}@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}';
        document.head.appendChild(ldCSS);

        // UI container: square at center, other elements above
        const winWidth = 680;
        const winHeight = 720;
        const winLeft = Math.round(W / 2 - winWidth / 2);
        const winTop = Math.round(H / 2 - winHeight / 2) - 14; // 14px up for taskbar
        // Three.js canvas area inside window (below header ~140px)
        const headerH = 140;
        const canvasAreaH = winHeight - headerH - 16; // 16px for window padding/borders
        const canvasAreaW = winWidth - 16;
        const sqDisplay = Math.min(canvasAreaW, canvasAreaH);
        const sqTop = winTop + headerH;
        const sqLeft = winLeft + Math.round((winWidth - sqDisplay) / 2);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10;font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;color:#fff;overflow:hidden;pointer-events:none;';
        wrap.innerHTML = `
<style>
  @keyframes p1In{from{opacity:0}to{opacity:1}}
  @keyframes scanline{
    0%{transform:translateY(-100%)}
    100%{transform:translateY(100vh)}
  }
  #win95-bar::-webkit-scrollbar{display:none;}
</style>

<!-- CRTスキャンライン効果 -->
<div style="position:absolute;inset:0;pointer-events:none;z-index:100;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);"></div>

<!-- タスクバー（下部） -->
<div style="position:absolute;bottom:0;left:0;right:0;height:28px;
  background:#c0c0c0;
  border-top:2px solid #fff;
  border-bottom:2px solid #555;
  display:flex;align-items:center;
  padding:0 4px;gap:4px;z-index:20;">
  <div style="background:#c0c0c0;border:2px solid #fff;border-right-color:#555;border-bottom-color:#555;
    padding:2px 8px;font-size:11px;font-family:monospace;font-weight:bold;color:#000;">
    ▶ Start
  </div>
  <div style="width:1px;height:20px;background:#888;margin:0 2px;"></div>
  <div style="background:#888;border:1px solid #555;padding:2px 8px;
    font-size:10px;font-family:monospace;color:#fff;">
    inryokü - Phase 1
  </div>
  <!-- win-clock 削除: 黒パネル右下に見えていたため -->
</div>

<div id="win95-main" style="position:absolute;left:${winLeft}px;top:${winTop}px;width:${winWidth}px;height:${winHeight}px;z-index:10;animation:p1In 0.5s ease-out both;outline:1px solid #000000;border-top:2px solid #ffffff;border-left:2px solid #ffffff;border-right:2px solid #808080;border-bottom:2px solid #808080;display:flex;flex-direction:column;overflow:hidden;">

  <!-- タイトルバー -->
  <div style="
    /* BACKUP: height:28px; linear-gradient(to right,#0a246a,#a6b8e8) */
    height:20px;min-height:20px;
    background:#000080;
    padding:0 3px;
    display:flex;align-items:center;justify-content:space-between;
  ">
    <div style="display:flex;align-items:center;gap:4px;">
      <div style="width:16px;height:16px;background:#008080;border:1px solid #005050;
        display:flex;align-items:center;justify-content:center;
        font-size:8px;color:white;font-weight:bold;">G</div>
      <span style="color:white;font-size:11px;font-weight:bold;
        font-family:'MS Sans Serif',Arial,sans-serif;letter-spacing:0;">
        inryokü — Loading Reality
      </span>
    </div>
    <div style="display:flex;gap:2px;">
      <!-- BACKUP: 2px borders, 16×14px buttons -->
      <div style="width:14px;height:13px;background:#c0c0c0;
        border-top:1px solid #ffffff;border-left:1px solid #ffffff;
        border-right:1px solid #404040;border-bottom:1px solid #404040;
        font-size:8px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'MS Sans Serif',Arial,sans-serif;">_</div>
      <div style="width:14px;height:13px;background:#c0c0c0;
        border-top:1px solid #ffffff;border-left:1px solid #ffffff;
        border-right:1px solid #404040;border-bottom:1px solid #404040;
        font-size:8px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'MS Sans Serif',Arial,sans-serif;">□</div>
      <div style="width:14px;height:13px;background:#c0c0c0;
        border-top:1px solid #ffffff;border-left:1px solid #ffffff;
        border-right:1px solid #404040;border-bottom:1px solid #404040;
        font-size:8px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'MS Sans Serif',Arial,sans-serif;">✕</div>
    </div>
  </div>

  <!-- メニューバー -->
  <div style="background:#c0c0c0;height:20px;display:flex;align-items:center;padding:0 2px;gap:0;
    border-bottom:1px solid #808080;">
    <div style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>F</u>ile</div>
    <div style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>E</u>dit</div>
    <div style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>V</u>iew</div>
    <div style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>H</u>elp</div>
  </div>

  <!-- ヘッダーエリア（アイコン＋テキスト＋バー＋ステータス） -->
  <div style="background:#c0c0c0;">
  <div style="padding:8px 12px 4px 12px;display:flex;align-items:center;gap:10px;">
    <img id="ld-logo" src="enter.png" alt="inryoku"
      style="width:32px;height:32px;image-rendering:pixelated;"
      onerror="this.style.display='none';"/>
    <div>
      <div style="font-size:12px;font-weight:bold;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;">inryokü</div>
      <div style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#444;" id="p1-lpct">Loading reality... 0%</div>
    </div>
  </div>
  <!-- セパレーター -->
  <div style="height:2px;margin:2px 8px 4px 8px;border-top:1px solid #808080;border-bottom:1px solid #fff;"></div>

  <!-- プログレスバー -->
  <div id="bar-wrap" style="
    height:20px;min-height:20px;
    margin:0 12px 4px 12px;
    background:#000000;
    border-top:2px solid #808080;
    border-left:2px solid #808080;
    border-right:2px solid #ffffff;
    border-bottom:2px solid #ffffff;
    cursor:pointer;
    position:relative;
    overflow:hidden;
    user-select:none;
    pointer-events:auto;
  ">
    <div id="p1-lb" style="
      width:0%;height:100%;
      background:#0000aa;
      pointer-events:none;
    "></div>
    <div id="drag-handle" style="
      width:2px;height:100%;
      background:#ffffff;
      position:absolute;top:0;left:0%;
      pointer-events:none;
    "></div>
  </div>

  <!-- ステータステキスト -->
  <div id="win95-status" style="
    font-size:11px;font-family:'MS Sans Serif',Arial,sans-serif;
    color:#444;text-align:left;letter-spacing:0;
    padding:0 12px 6px 12px;
  ">HOLD TO LOAD</div>
  </div><!-- /ヘッダーエリア -->

  <!-- Three.jsキャンバスエリア（スクエアボーダー） -->
  <div id="sq-border" style="
    flex:1;
    margin:0 6px 6px 6px;
    border-top:2px solid #808080;
    border-left:2px solid #808080;
    border-right:2px solid #ffffff;
    border-bottom:2px solid #ffffff;
    position:relative;
    overflow:hidden;
  ">
  <!-- BACKUP: CSSグラデーションライン削除 → Three.js Newton's Ring に置き換え -->
  </div>

</div>
`;
        document.body.appendChild(wrap);

        // sq-borderのDOMRectからscissor + compositeUniforms を更新
        function updateScissorFromDOM() {
            const sqEl = document.getElementById('sq-border');
            if (sqEl) {
                const rect = sqEl.getBoundingClientRect();
                scissor.x = Math.round(rect.left);
                scissor.y = Math.round(H - rect.bottom); // GLのyは下から
                scissor.w = Math.round(rect.width);
                scissor.h = Math.round(rect.height);

                // rtSquare サイズをsq-borderのサイズに同期
                if (scissor.w > 0 && scissor.h > 0 &&
                    (rtSquare.width !== scissor.w || rtSquare.height !== scissor.h)) {
                    rtSquare.setSize(scissor.w, scissor.h);
                    compositeUniforms.tSquare.value = rtSquare.texture;
                }
                // 合成シェーダーの squareRect 更新（正規化スクリーン座標 0-1）
                compositeUniforms.squareRect.value.set(
                    scissor.x / W,   // left
                    scissor.y / H,   // bottom (GL座標)
                    scissor.w / W,   // width
                    scissor.h / H    // height
                );

                // カメラのfrustumをsq-borderのアスペクト比に合わせる
                const contentH = sqWorld / 2;
                const newAspect = rect.width / rect.height;
                const contentW = contentH * newAspect;
                camera.left = -contentW;
                camera.right = contentW;
                camera.top = contentH;
                camera.bottom = -contentH;
                camera.updateProjectionMatrix();
            }
        }
        // 初回計算
        requestAnimationFrame(() => updateScissorFromDOM());

        console.log('bar-wrap:', document.getElementById('bar-wrap'));
        console.log('drag-handle:', document.getElementById('drag-handle'));
        console.log('bar:', document.getElementById('p1-lb'));
        console.log('pct:', document.getElementById('p1-lpct'));

        const bar = document.getElementById('p1-lb');
        const pct = document.getElementById('p1-lpct');
        const logoEl = document.getElementById('ld-logo');
        const barWrap = document.getElementById('bar-wrap');
        const sqBorder = document.getElementById('sq-border');

        // ── HOLD-TO-LOAD + AUTO-TICK ──
        setTimeout(() => {
            const barTrack = document.getElementById('bar-wrap');
            const barFill = document.getElementById('p1-lb');
            const handle = document.getElementById('drag-handle');
            if (!barTrack) { console.error('bar-wrap not found'); return; }

            let holding = false;

            barTrack.addEventListener('mousedown', (e) => {
                holding = true;
                e.preventDefault();
            });
            barTrack.addEventListener('touchstart', (e) => {
                holding = true;
                e.preventDefault();
            }, { passive: false });
            window.addEventListener('mouseup', () => { holding = false; });
            window.addEventListener('touchend', () => { holding = false; });

            // メインループ
            setInterval(() => {
                if (phase === PH.DONE) return;

                const inEvent = [
                    PH.EVENT_FUSE,
                    PH.EVENT_SING,
                    PH.EVENT_BREACH,
                    PH.EVENT_COLLAPSE
                ].includes(phase);

                if (inEvent) {
                    tick();
                    return;
                }

                if (holding) {
                    prog = Math.min(101, prog + 0.35);
                    showProg(prog);
                    tick();
                }
            }, 16);

        }, 100);

        // Windows95風時計更新
        setInterval(() => {
            const cl = document.getElementById('win-clock');
            if (cl) {
                const n = new Date();
                cl.textContent = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
            }
        }, 1000);
        const whiteOv = document.createElement('div');
        whiteOv.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#fff;opacity:0;pointer-events:none;';
        document.body.appendChild(whiteOv);

        // ══════════════════════════════════════════════════════
        //  SHADERS
        // ══════════════════════════════════════════════════════
        const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

        // ── Background split (square-sized plane) ──
        const bgMat = new THREE.ShaderMaterial({
            uniforms: { u_grey: { value: 0 }, u_flash: { value: 0 }, u_time: { value: 0 }, u_pixelSize: { value: 8.0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_grey, u_flash, u_time, u_pixelSize;',
                '',
                'vec2 pixelate(vec2 uv) {',
                '  if(u_pixelSize <= 1.0) return uv;',
                '  vec2 pixCount = vec2(512.0) / u_pixelSize;',
                '  return floor(uv * pixCount) / pixCount;',
                '}',
                '',
                'vec3 quantize16(vec3 c) {',
                '  vec3 palette[16];',
                '  palette[0]=vec3(0.0,0.0,0.0); palette[1]=vec3(0.5,0.0,0.0);',
                '  palette[2]=vec3(0.0,0.5,0.0); palette[3]=vec3(0.5,0.5,0.0);',
                '  palette[4]=vec3(0.0,0.0,0.5); palette[5]=vec3(0.5,0.0,0.5);',
                '  palette[6]=vec3(0.0,0.5,0.5); palette[7]=vec3(0.75,0.75,0.75);',
                '  palette[8]=vec3(0.5,0.5,0.5); palette[9]=vec3(1.0,0.0,0.0);',
                '  palette[10]=vec3(0.0,1.0,0.0); palette[11]=vec3(1.0,1.0,0.0);',
                '  palette[12]=vec3(0.0,0.0,1.0); palette[13]=vec3(1.0,0.0,1.0);',
                '  palette[14]=vec3(0.0,1.0,1.0); palette[15]=vec3(1.0,1.0,1.0);',
                '  float minDist=9999.0; vec3 best=palette[0];',
                '  for(int i=0;i<16;i++){float d=distance(c,palette[i]);if(d<minDist){minDist=d;best=palette[i];}}',
                '  return best;',
                '}',
                '',
                'float bayer4x4(vec2 pos) {',
                '  int x=int(mod(pos.x,4.0)); int y=int(mod(pos.y,4.0));',
                '  int idx=y*4+x;',
                '  float m[16];',
                '  m[0]=0.0;m[1]=8.0;m[2]=2.0;m[3]=10.0;',
                '  m[4]=12.0;m[5]=4.0;m[6]=14.0;m[7]=6.0;',
                '  m[8]=3.0;m[9]=11.0;m[10]=1.0;m[11]=9.0;',
                '  m[12]=15.0;m[13]=7.0;m[14]=13.0;m[15]=5.0;',
                '  return m[idx]/16.0-0.5;',
                '}',
                '',
                'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
                'float noise(vec2 p){',
                '  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
                '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);',
                '}',
                'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.5;}return v;}',
                '',
                'void main() {',
                '  vec2 uv = pixelate(vUv);',
                // BACKUP: edge = uv.x - 0.5 + (fbmVal - 0.75)*0.04; split = smoothstep(-0.003,0.003,edge);
                '  float fbmVal = fbm(vec2(uv.y*12.0, u_time*0.4))',
                '               + fbm(vec2(uv.y*6.0+100.0, u_time*0.25)) * 0.5;',
                '  float edge = uv.x - 0.5;',
                '  float split = step(0.0, edge);',
                '  vec3 col = mix(vec3(1.0), vec3(0.0), split);',
                '',
                // BACKUP: glow/glowColor — 境界グロー除去（CSS虹色ラインに置き換え）
                '  float glow = 0.0;',
                '',
                '  if(edge < 0.0) {',
                '    float grain = fbm(uv * 80.0 + u_time * 0.1) * 0.04;',
                '    col += vec3(grain) * (1.0 - u_grey);',
                '  }',
                '',
                '  if(edge > 0.0) {',
                '    vec2 starCell = floor(uv * 40.0);',
                '    float starRnd = hash(starCell);',
                '    if(starRnd > 0.92) {',
                '      vec2 sf = fract(uv * 40.0) - 0.5;',
                '      float star = exp(-length(sf)*16.0) * (0.5 + 0.5*sin(u_time*3.0 + starRnd*20.0));',
                '      col += vec3(star * 0.6) * (1.0 - u_grey);',
                '    }',
                '  }',
                '',
                '  vec3 grey = vec3(0.5);',
                '  col = mix(col, grey, u_grey);',
                '  col = mix(col, vec3(1.0), u_flash);',
                '  // 16色ディザリング',
                '  vec2 pixPos = gl_FragCoord.xy / u_pixelSize;',
                '  float dither = bayer4x4(pixPos) * 0.15;',
                '  col = quantize16(col + vec3(dither));',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n'), depthWrite: false
        });
        // BACKUP: PlaneGeometry(sqWorld, sqWorld) — 正方形では横長viewport時に左右に黒余白が出る
        const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 6, sqWorld), bgMat);
        bgPlane.position.z = -1; scene.add(bgPlane);

        // ── 境界線: CMY/RGB静止虹色グラデーション ──
        const newtonRingMat = new THREE.ShaderMaterial({
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: [
                'precision highp float;varying vec2 vUv;',
                'void main(){',
                '  float t=1.0-vUv.y;float f=fract(t*5.0);int i=int(floor(t*5.0));',
                '  vec3 c0=vec3(0.0,1.0,1.0),c1=vec3(1.0,0.0,1.0),c2=vec3(1.0,1.0,0.0);',
                '  vec3 c3=vec3(1.0,0.0,0.0),c4=vec3(0.0,1.0,0.0),c5=vec3(0.0,0.0,1.0);',
                '  vec3 col;',
                '  if(i==0)col=mix(c0,c1,f);else if(i==1)col=mix(c1,c2,f);',
                '  else if(i==2)col=mix(c2,c3,f);else if(i==3)col=mix(c3,c4,f);',
                '  else col=mix(c4,c5,f);',
                '  gl_FragColor=vec4(col,1.0);',
                '}'
            ].join('\n'),
            depthWrite: false
        });
        const newtonLine = new THREE.Mesh(
            new THREE.PlaneGeometry(sqWorld * 0.008, sqWorld * 2),
            newtonRingMat
        );
        newtonLine.position.set(0, 0, 0.2);
        scene.add(newtonLine);

        // ── Magnetic field ──
        const fieldMat = new THREE.ShaderMaterial({
            uniforms: { u_minus: { value: new THREE.Vector2(-0.5, 0) }, u_plus: { value: new THREE.Vector2(0.5, 0) }, u_density: { value: 0 }, u_time: { value: 0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;uniform vec2 u_minus,u_plus;uniform float u_density,u_time;',
                'void main(){',
                '  vec2 p=(vUv-0.5)*2.0;vec2 toP=p-u_plus,toM=p-u_minus;',
                '  float aP=atan(toP.y,toP.x),aM=atan(toM.y,toM.x);',
                '  float lines=sin((aP-aM)*10.0+u_time*0.6);float lines2=sin((aP-aM)*6.0-u_time*0.3+1.5);',
                '  lines=smoothstep(0.78,1.0,abs(lines))+smoothstep(0.85,1.0,abs(lines2))*0.4;',
                '  float dP=length(toP),dM=length(toM);float prox=1.0/(1.0+dP*1.8)*1.0/(1.0+dM*1.8)*8.0;',
                '  float pulse=1.0+0.15*sin(u_time*2.0+dP*5.0);float alpha=lines*prox*u_density*0.55*pulse;',
                '  float t2=smoothstep(u_minus.x,u_plus.x,p.x);',
                '  vec3 cmyC=mix(vec3(0.0,0.9,0.9),vec3(0.9,0.0,0.9),sin(aM*2.0+u_time)*0.5+0.5);',
                '  vec3 rgbC=mix(vec3(1.0,0.1,0.1),vec3(0.1,0.4,1.0),cos(aP*2.0-u_time)*0.5+0.5);',
                '  vec3 col=mix(cmyC,rgbC,t2);col+=vec3(1.0)*smoothstep(0.95,1.0,abs(lines))*prox*0.3;',
                '  gl_FragColor=vec4(col,alpha);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        // BACKUP: PlaneGeometry(sqWorld, sqWorld)
        const fieldPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 6, sqWorld), fieldMat);
        fieldPlane.position.z = 0.1; fieldPlane.visible = false; scene.add(fieldPlane);

        // ── CMY particles (物質: フラットな円・減法混色) ──
        const cmySphereGeo = new THREE.CircleGeometry(0.6 * unit, 64);
        const cmyTriPos = [ // 正三角形（スクエア左半分中心基準）
            [0, 0.8 * unit],         // 上
            [-0.7 * unit, -0.4 * unit], // 左下
            [0.7 * unit, -0.4 * unit],  // 右下
        ];
        const cmyCtr = new THREE.Vector3(-2.5 * unit, -0.2 * unit, 0);
        const cmyDefs = [
            { color: 0x00FFFF }, // Cyan #00FFFF
            { color: 0xFF00FF }, // Magenta #FF00FF
            { color: 0xFFFF00 }, // Yellow #FFFF00
        ];
        const cmyP = cmyDefs.map((def, i) => {
            const mat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
            });
            const m = new THREE.Mesh(cmySphereGeo, mat);
            m.position.set(cmyCtr.x + cmyTriPos[i][0], cmyCtr.y + cmyTriPos[i][1], 0.5);
            m.userData = { ox: m.position.x, oy: m.position.y };
            scene.add(m); return m;
        });

        // ── RGB particles (精神: フラットな円・加法混色) ──
        const rgbSphereGeo = new THREE.CircleGeometry(0.6 * unit, 64);
        const rgbTriPos = [ // 正三角形（スクエア右半分中心基準）
            [0, 0.8 * unit],
            [-0.7 * unit, -0.4 * unit],
            [0.7 * unit, -0.4 * unit],
        ];
        const rgbCtr = new THREE.Vector3(2.5 * unit, 0, 0);
        const rgbDefs = [
            { color: 0xff0000 }, // Red → 16色パレット
            { color: 0x00ff00 }, // Green
            { color: 0x0000ff }, // Blue
        ];
        const rgbP = rgbDefs.map((def, i) => {
            const mat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const m = new THREE.Mesh(rgbSphereGeo, mat);
            m.position.set(rgbCtr.x + rgbTriPos[i][0], rgbCtr.y + rgbTriPos[i][1], 0.5);
            m.userData = { ox: m.position.x, oy: m.position.y };
            scene.add(m); return m;
        });

        // ── Fused dots ──
        const dotGeo = new THREE.SphereGeometry(0.65 * unit, 16, 16);
        const bDotMat = new THREE.ShaderMaterial({
            uniforms: { u_time: { value: 0 } },
            vertexShader: [
                'varying vec3 vNormal;',
                'void main(){',
                '  vNormal = normalize(normalMatrix * normal);',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
                '}'
            ].join('\n'),
            fragmentShader: 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.02),1.0);}'
        });
        const wDotMat = new THREE.ShaderMaterial({
            vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.98),1.0);}'
        });
        const bDot = new THREE.Mesh(dotGeo, bDotMat); bDot.visible = false; scene.add(bDot);
        const wDot = new THREE.Mesh(dotGeo, wDotMat); wDot.visible = false; scene.add(wDot);

        // ── Yin-Yang GLSL ──
        const yyMat = new THREE.ShaderMaterial({
            uniforms: { u_rot: { value: 0 }, u_grey: { value: 0 }, u_alpha: { value: 0 }, u_time: { value: 0 }, u_pixelSize: { value: 8.0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_rot, u_grey, u_alpha, u_time, u_pixelSize;',
                '',
                'vec2 pixelate(vec2 uv) {',
                '  if(u_pixelSize <= 1.0) return uv;',
                '  vec2 pixCount = vec2(512.0) / u_pixelSize;',
                '  return floor(uv * pixCount) / pixCount;',
                '}',
                '',
                'void main() {',
                '  vec2 pxUv = pixelate(vUv);',
                '  vec2 p = (pxUv - 0.5) * 2.0;',
                '  float ca = cos(u_rot), sa = sin(u_rot);',
                '  vec2 rp = vec2(ca*p.x - sa*p.y, sa*p.x + ca*p.y);',
                '  float r = length(rp);',
                '  if(r > 1.08) discard;',
                '',
                '  float b = rp.x - sin(rp.y * 3.14159) * 0.28;',
                '  float s1 = smoothstep(0.13, 0.0, length(rp - vec2(0.0,  0.24)));',
                '  float s2 = smoothstep(0.13, 0.0, length(rp - vec2(0.0, -0.24)));',
                '  float yin = smoothstep(-0.015, 0.015, b) * step(r, 0.86);',
                '  yin = yin * (1.0 - s1) + s2 * step(r, 0.86);',
                '',
                '  vec3 darkCol  = vec3(0.01, 0.01, 0.02);',
                '  vec3 lightCol = vec3(0.97, 0.97, 1.00);',
                '  vec3 col = mix(darkCol, lightCol, yin);',
                '',
                '  float aO = atan(p.y, p.x);',
                '  float aura1 = smoothstep(1.02, 0.88, r) * smoothstep(0.82, 0.92, r);',
                '  float aura2 = smoothstep(1.06, 0.96, r) * smoothstep(0.90, 1.00, r);',
                '  float aura3 = smoothstep(1.10, 1.02, r) * smoothstep(0.96, 1.04, r);',
                '  vec3 rainbow = vec3(',
                '    0.5 + 0.5*sin(aO*3.0 + u_time*1.5),',
                '    0.5 + 0.5*sin(aO*3.0 + u_time*1.5 + 2.094),',
                '    0.5 + 0.5*sin(aO*3.0 + u_time*1.5 + 4.189)',
                '  );',
                '  vec3 auraColor = rainbow * aura1 * 1.2;',
                '  vec3 rainbow2 = vec3(',
                '    0.5 + 0.5*sin(aO*4.0 - u_time*2.0 + 1.0),',
                '    0.5 + 0.5*sin(aO*4.0 - u_time*2.0 + 3.094),',
                '    0.5 + 0.5*sin(aO*4.0 - u_time*2.0 + 5.189)',
                '  );',
                '  auraColor += rainbow2 * aura2 * 0.8;',
                '  auraColor += rainbow * aura3 * 0.4;',
                '  col = mix(col, auraColor, (aura1 + aura2 * 0.6 + aura3 * 0.3) * (1.0 - u_grey));',
                '',
                '  float boundary = exp(-abs(b) * 80.0) * step(r, 0.85);',
                '  float bAngle = atan(rp.y, rp.x);',
                '  vec3 boundColor = vec3(',
                '    0.5 + 0.5*sin(bAngle*2.0 + u_time*3.0),',
                '    0.5 + 0.5*sin(bAngle*2.0 + u_time*3.0 + 2.094),',
                '    0.5 + 0.5*sin(bAngle*2.0 + u_time*3.0 + 4.189)',
                '  );',
                '  col += boundColor * boundary * 1.5 * (1.0 - u_grey);',
                '',
                '  float dot1 = 1.0 - smoothstep(0.0, 0.13, length(rp - vec2(0.0,  0.24)));',
                '  float dot2 = 1.0 - smoothstep(0.0, 0.13, length(rp - vec2(0.0, -0.24)));',
                '  col = mix(col, lightCol * 1.2, dot1 * (1.0 - yin));',
                '  col = mix(col, darkCol,        dot2 * yin);',
                '  col += rainbow * exp(-abs(length(rp - vec2(0.0,  0.24)) - 0.1) * 40.0) * 0.8 * (1.0 - u_grey);',
                '  col += rainbow * exp(-abs(length(rp - vec2(0.0, -0.24)) - 0.1) * 40.0) * 0.8 * (1.0 - u_grey);',
                '',
                '  float rings = sin(r * 28.0 - u_time * 2.0) * 0.5 + 0.5;',
                '  rings = pow(rings, 6.0) * (1.0 - smoothstep(0.5, 0.85, r)) * 0.25;',
                '  col += rainbow * rings * (1.0 - u_grey);',
                '',
                '  vec3 grey = vec3(dot(col, vec3(0.299, 0.587, 0.114)));',
                '  col = mix(col, grey, u_grey);',
                '',
                '  float alpha = smoothstep(1.08, 0.90, r) * u_alpha;',
                '  gl_FragColor = vec4(col, alpha);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false
        });
        const yyPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 0.65, sqWorld * 0.65), yyMat);
        yyPlane.visible = false; yyPlane.position.z = 0.5; scene.add(yyPlane);

        // ── RGBCMY Tunnel (OVERSIZED — covers full screen for overflow) ──
        const tunnelSize = Math.max(camW, camH) * 4;
        const tunnelScale = tunnelSize / sqWorld; // how many times bigger than square
        const tunnelMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 }, u_progress: { value: 0 },
                u_radius: { value: 0 }, u_alpha: { value: 0 },
                u_warpSpeed: { value: 1.0 }, u_scale: { value: tunnelScale },
                u_pixelSize: { value: 8.0 }
            },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_time, u_progress, u_radius, u_alpha, u_warpSpeed, u_scale, u_pixelSize;',
                '',
                'vec2 pixelate(vec2 uv) {',
                '  if(u_pixelSize <= 1.0) return uv;',
                '  vec2 pixCount = vec2(512.0) / u_pixelSize;',
                '  return floor(uv * pixCount) / pixCount;',
                '}',
                '',
                'void main() {',
                '    vec2 pxUv = pixelate(vUv);',
                '    vec2 pos = (pxUv - 0.5) * 2.0 * u_scale;',
                '    float r = length(pos);',
                '    float angle = atan(pos.y, pos.x);',
                '',
                '    float mask = 1.0 - smoothstep(u_radius - 0.02, u_radius, r);',
                '    if(mask < 0.005) discard;',
                '',
                '    float speed = u_time * u_warpSpeed * 0.5;',
                '',
                '    float wl[6];',
                '    wl[0]=0.70; wl[1]=0.60; wl[2]=0.55;',
                '    wl[3]=0.51; wl[4]=0.47; wl[5]=0.43;',
                '',
                '    vec3 wc[6];',
                '    wc[0]=vec3(1.0, 0.05, 0.05);',
                '    wc[1]=vec3(0.0,  1.0,  1.0);',
                '    wc[2]=vec3(1.0,  0.0,  1.0);',
                '    wc[3]=vec3(0.05, 1.0, 0.05);',
                '    wc[4]=vec3(0.05,0.05,  1.0);',
                '    wc[5]=vec3(1.0,  1.0,  0.0);',
                '',
                '    vec3 col = vec3(0.0);',
                '    float totalBright = 0.0;',
                '',
                '    for(int i = 0; i < 6; i++) {',
                '        float n = (r * r) / (wl[i] * 3.5 * 0.15);',
                '        float phase = n * 6.28318 - speed * (1.0 + float(i) * 0.04);',
                '        float intensity = pow(cos(phase * 0.5), 2.0);',
                '        col += wc[i] * intensity;',
                '        totalBright += intensity;',
                '    }',
                '    col /= 6.0;',
                '',
                '    float depth = 1.0 - smoothstep(0.0, u_radius, r);',
                '    float depthPow = pow(depth, 1.4);',
                '',
                '    float brightness = totalBright / 6.0;',
                '    col *= smoothstep(0.2, 0.8, brightness) * 1.8;',
                '    col *= depthPow * (0.3 + u_progress * 1.4);',
                '',
                '    float focal = exp(-r * r * 7.0 / max(u_radius * u_radius, 0.001));',
                '    col = mix(col, vec3(1.0), focal * (0.2 + u_progress * 0.8));',
                '',
                '    float wall = smoothstep(u_radius, u_radius - 0.04, r)',
                '               * smoothstep(u_radius - 0.09, u_radius - 0.04, r);',
                '    float eh = fract(angle / 6.28318 - u_time * 0.05);',
                '    vec3 edgeCol = vec3(',
                '        0.5 + 0.5*sin(eh * 6.28318),',
                '        0.5 + 0.5*sin(eh * 6.28318 + 2.094),',
                '        0.5 + 0.5*sin(eh * 6.28318 + 4.189)',
                '    );',
                '    col += wall * edgeCol * 0.5;',
                '',
                '    gl_FragColor = vec4(col * mask, mask * u_alpha);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        const tunnelPlane = new THREE.Mesh(new THREE.PlaneGeometry(tunnelSize, tunnelSize), tunnelMat);
        tunnelPlane.visible = false; tunnelPlane.position.z = 1; scene.add(tunnelPlane);

        // ── Solar cross GLSL ──
        const scMat = new THREE.ShaderMaterial({
            uniforms: { u_alpha: { value: 0 }, u_time: { value: 0 }, u_aspect: { value: aspect } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_alpha, u_time, u_aspect;',
                '',
                'void main() {',
                '    vec2 uv = (vUv - 0.5) * 2.0;',
                '    uv.x *= u_aspect;',
                '    float r = length(uv);',
                '    float angle = atan(uv.y, uv.x);',
                '    float sz = 0.30;',
                '',
                '    float outerRing = 1.0 - smoothstep(0.0, 0.014, abs(r - sz));',
                '    float outerGlow = exp(-abs(r - sz) * 60.0) * 0.5;',
                '',
                '    float innerRing = 1.0 - smoothstep(0.0, 0.010, abs(r - sz*0.32));',
                '    float innerGlow = exp(-abs(r - sz*0.32) * 80.0) * 0.4;',
                '',
                '    float arm1 = exp(-uv.x*uv.x * 600.0) * step(abs(uv.y), sz) * step(sz*0.32, abs(uv.y));',
                '    float arm2 = exp(-uv.y*uv.y * 600.0) * step(abs(uv.x), sz) * step(sz*0.32, abs(uv.x));',
                '    float arms = (arm1 + arm2) * 0.5;',
                '',
                '    float spikes = 0.0;',
                '    for(int i=0; i<4; i++) {',
                '        float a = float(i) * 1.5708;',
                '        float da = mod(angle - a + 3.14159, 6.28318) - 3.14159;',
                '        float spike = exp(-da*da * 80.0) * exp(-r * 3.0);',
                '        spikes += spike * 0.4;',
                '    }',
                '',
                '    float nRings = 0.0;',
                '    for(int i=0; i<6; i++) {',
                '        float wl = 0.43 + float(i) * 0.044;',
                '        float n = (r*r) / (wl * 1.2 * 0.1);',
                '        nRings += pow(cos(n * 3.14159 - u_time * 0.8), 2.0) / 6.0;',
                '    }',
                '    float ringMask = smoothstep(sz*1.05, sz*0.35, r) * smoothstep(sz*0.28, sz*0.35, r);',
                '    float ringGlow = nRings * ringMask * 0.12;',
                '',
                '    float focal = exp(-r * r * 50.0) * 1.5;',
                '    float focalHalo = exp(-r * r * 8.0) * 0.3;',
                '',
                '    float shape = outerRing + outerGlow',
                '                + innerRing * 0.7 + innerGlow',
                '                + arms',
                '                + spikes',
                '                + ringGlow',
                '                + focal + focalHalo;',
                '',
                '    vec3 gold  = vec3(0.92, 0.80, 0.42);',
                '    vec3 white = vec3(1.0);',
                '    float goldRatio = 0.35 + 0.2 * sin(u_time * 1.2);',
                '    vec3 lightCol = mix(white, gold, goldRatio);',
                '',
                '    vec3 col = vec3(1.0) - shape * u_alpha * (1.0 - lightCol * 0.5);',
                '',
                '    gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n'), depthWrite: false
        });
        const scPlane = new THREE.Mesh(new THREE.PlaneGeometry(camW * 2, camH * 2), scMat);
        scPlane.visible = false; scPlane.position.z = 2; scene.add(scPlane);

        // ══════════════════════════════════════════════════════
        //  STATE ENGINE
        // ══════════════════════════════════════════════════════
        let alive = true, globalTime = 0;
        const clk = new THREE.Clock();
        const PH = { ATTRACT: 0, EVENT_FUSE: 1, DUALITY: 2, EVENT_SING: 3, WARP_GROW: 4, EVENT_BREACH: 5, CONSUME: 6, EVENT_COLLAPSE: 7, DONE: 8 };
        let phase = PH.ATTRACT, prog = 0, progPaused = false, eventTimer = 0, tunnelBorn = false;

        function showProg(v) {
            const pv = Math.min(101, Math.floor(v));
            const fillPct = Math.min(100, pv);

            const barFill = document.getElementById('p1-lb');
            const handle = document.getElementById('drag-handle');
            if (barFill) barFill.style.width = fillPct + '%';
            if (handle) handle.style.left = fillPct + '%';

            const pctEl = document.getElementById('p1-lpct');
            if (pctEl) pctEl.textContent = 'Loading reality... ' + pv + '%';
        }

        // ── MAIN TICK ──
        function tick() {
            if (!alive) return;
            const dt = Math.min(clk.getDelta(), 0.05);
            globalTime += dt;
            bgMat.uniforms.u_time.value = globalTime;
            fieldMat.uniforms.u_time.value = globalTime;
            // newtonRingMat は MeshBasicMaterial のため u_time 不要
            if (yyPlane.visible) yyMat.uniforms.u_time.value = globalTime;
            if (tunnelPlane.visible) tunnelMat.uniforms.u_time.value = globalTime;
            if (scPlane.visible) scMat.uniforms.u_time.value = globalTime;
            if (bDot.visible && bDot.material.uniforms && bDot.material.uniforms.u_time) {
                bDot.material.uniforms.u_time.value = globalTime;
            }

            // ── ピクセルサイズ制御（progressに応じて解像度が上がる） ──
            const pixelSize = prog < 50 ? 8.0 :
                              prog < 75 ? 4.0 :
                              prog < 90 ? 2.0 : 1.0;
            [bgMat, tunnelMat, yyMat].forEach(mat => {
                if (mat?.uniforms?.u_pixelSize) {
                    mat.uniforms.u_pixelSize.value = pixelSize;
                }
            });
            // tunnelMatピクセルサイズ別制御
            if (tunnelMat?.uniforms?.u_pixelSize) {
                tunnelMat.uniforms.u_pixelSize.value =
                    prog < 75 ? 0.05 :
                    prog < 90 ? 0.03 :
                    prog < 100 ? 0.01 : 0.005;
            }

            // ── ランナーアニメーション速度制御 ──
            const runnerSvg = document.getElementById('exit-man-svg');
            if (runnerSvg) {
                const speed = prog < 30  ? 0.4 :
                              prog < 50  ? 0.28 :
                              prog < 75  ? 0.18 :
                              prog < 101 ? 0.10 : 0.06;
                const duration = speed + 's';
                runnerSvg.style.setProperty('--run-speed', speed + 's');
                runnerSvg.querySelectorAll('[id^="arm"],[id^="leg"],[id^="shin"],[id^="torso"]').forEach(el => {
                    el.style.animationDuration = duration;
                });
            }

            // ── ld-logoバウンス速度制御 ──
            const logoEl2 = document.getElementById('ld-logo');
            if (logoEl2) {
                const spd = prog < 30  ? '0.45s' :
                            prog < 50  ? '0.32s' :
                            prog < 75  ? '0.20s' :
                                         '0.11s';
                logoEl2.style.animationDuration = spd;
            }

            // ═══ PHASE 0: ATTRACT (0→30%) ═══
            if (phase === PH.ATTRACT) {
                updateWin95Status('Initializing reality engine...');
                const t = prog / 30;
                // CMY: 粘性のある動き（物質）
                cmyP.forEach((p, i) => {
                    const tx = cmyCtr.x + cmyTriPos[i][0] * (1 - t * 0.85);
                    const ty = cmyCtr.y + cmyTriPos[i][1] * (1 - t * 0.85);
                    p.position.x += (tx - p.position.x) * 0.012;
                    p.position.y += (ty - p.position.y) * 0.012;
                    // 表面張力の歪み
                    const distToTarget = Math.sqrt((tx - p.position.x) ** 2 + (ty - p.position.y) ** 2);
                    const stretch = 1.0 + distToTarget * 0.05;
                    p.scale.set(1.0 / stretch, stretch, 1.0 / stretch);
                });
                // RGB: 振動しながら引き寄せられる（精神）
                rgbP.forEach((p, i) => {
                    const tx = rgbCtr.x + rgbTriPos[i][0] * (1 - t * 0.85);
                    const ty = rgbCtr.y + rgbTriPos[i][1] * (1 - t * 0.85);
                    const jx = Math.sin(globalTime * 7.3 + i) * 0.008;
                    const jy = Math.cos(globalTime * 5.1 + i) * 0.008;
                    p.position.x += (tx + jx - p.position.x) * 0.025;
                    p.position.y += (ty + jy - p.position.y) * 0.025;
                });
                // 磁場線は0-30%では非表示
                fieldPlane.visible = false;
                if (prog >= 30) { phase = PH.EVENT_FUSE; eventTimer = 0; prog = 30; showProg(30); progPaused = true; }

                // ═══ PHASE 1: EVENT_FUSE (30% — 3s fixed) ═══
            } else if (phase === PH.EVENT_FUSE) {
                updateWin95Status('⚠ REALITY.EXE is not responding...');
                eventTimer += dt;
                const et = eventTimer;
                if (et < 0.5) {
                    const t2 = et / 0.5;
                    cmyP.forEach(p => { p.position.x += (cmyCtr.x - p.position.x) * 0.12; p.position.y += (cmyCtr.y - p.position.y) * 0.12; p.scale.setScalar(1 - t2 * 0.6); });
                    rgbP.forEach(p => { p.position.x += (rgbCtr.x - p.position.x) * 0.2; p.position.y += (rgbCtr.y - p.position.y) * 0.2; p.scale.setScalar(1 - t2 * 0.5); });
                    fieldPlane.visible = false;
                }
                if (et >= 0.5 && et < 0.55) {
                    cmyP.forEach(p => p.visible = false); rgbP.forEach(p => p.visible = false);
                    bDot.visible = true; bDot.position.set(cmyCtr.x, 0, 0);
                    wDot.visible = true; wDot.position.set(rgbCtr.x, 0, 0);
                    bgMat.uniforms.u_flash.value = 0.6;
                }
                if (et >= 0.6) bgMat.uniforms.u_flash.value = Math.max(0, bgMat.uniforms.u_flash.value - dt * 2);
                if (et >= 0.5 && et < 1.5) { bDot.position.x += ((-1.2 * unit) - bDot.position.x) * 0.04; wDot.position.x += ((1.2 * unit) - wDot.position.x) * 0.04; }
                if (et >= 1.0 && et < 1.05) {
                    sqBorder.style.boxShadow = '0 0 20px rgba(255,255,255,0.8), inset 0 0 10px rgba(255,255,255,0.4)';
                }
                if (et >= 3.0) { phase = PH.DUALITY; progPaused = false; }

                // ═══ PHASE 2: DUALITY (30→50%) ═══
            } else if (phase === PH.DUALITY) {
                updateWin95Status('Resolving duality conflict...');
                renderer.setClearColor(0x808080, 1.0); // 透明背景防止
                const t = (prog - 30) / 20;
                // Black and white dots accelerate toward center
                const targetX_b = -2.5 * unit + t * 2.4 * unit; // approaches center
                const targetX_w = 2.5 * unit - t * 2.4 * unit;
                const accel = 0.03 + t * t * 0.08; // accelerating
                bDot.position.x += (targetX_b - bDot.position.x) * accel;
                wDot.position.x += (targetX_w - wDot.position.x) * accel;
                // Stretch toward each other as they get close
                const dist = Math.abs(bDot.position.x - wDot.position.x);
                const stretchFactor = 1.0 + Math.max(0, 1.0 - dist / (4 * unit)) * 0.3;
                bDot.scale.set(stretchFactor, 1.0 / stretchFactor, 1);
                wDot.scale.set(stretchFactor, 1.0 / stretchFactor, 1);
                // Background blends toward grey
                bgMat.uniforms.u_grey.value = t * 0.8;
                if (prog >= 50) { phase = PH.EVENT_SING; eventTimer = 0; prog = 50; showProg(50); progPaused = true; }

                // ═══ PHASE 3: EVENT_SING (50% — 3.5s) — Simple Physics Collision ═══
            } else if (phase === PH.EVENT_SING) {
                updateWin95Status('Processing dimension collapse...');
                renderer.setClearColor(0x1a1a1a, 1.0); // 背景色を復元
                eventTimer += dt;
                const et = eventTimer;

                // Step 1 (0-0.3s): Collision flash
                if (et < 0.3) {
                    const t2 = et / 0.3;
                    bDot.position.x += (0 - bDot.position.x) * 0.3;
                    wDot.position.x += (0 - wDot.position.x) * 0.3;
                    bgMat.uniforms.u_flash.value = t2 * t2;
                    if (bloom) bloom.strength = 1.0 + t2 * 4.0;
                }

                // Step 2 (0.3-0.5s): Flash peak + dots disappear → grey sphere
                if (et >= 0.3 && et < 0.5) {
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 0.3) / 0.2 * 3);
                    bgMat.uniforms.u_grey.value = 1.0; // full grey background
                    // Show grey sphere (reuse bDot as grey)
                    bDot.visible = true; bDot.position.set(0, 0, 0.5);
                    bDot.material.fragmentShader = 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.5),1.0);}';
                    bDot.material.needsUpdate = true;
                    bDot.scale.set(1, 1, 1);
                    wDot.visible = false;
                }

                // Step 3 (0.5-1.2s): Grey sphere pulses → yin-yang fade-in
                if (et >= 0.5 && et < 1.2) {
                    const t2 = (et - 0.5) / 0.7;
                    bDot.visible = true;
                    bDot.scale.setScalar(1.0 + Math.sin(t2 * Math.PI * 3) * 0.2 * (1 - t2));
                    if (bloom) bloom.strength = 1.0 + Math.abs(Math.sin(t2 * Math.PI * 3)) * 1.5 * (1 - t2);
                }
                // Yin-Yang fade-in (0.8s~)
                if (et >= 0.8 && et < 1.8) {
                    const t2 = (et - 0.8) / 1.0;
                    bDot.visible = false;
                    yyPlane.visible = true;
                    yyMat.uniforms.u_alpha.value = Math.min(1.0, t2 * 1.5);
                    yyMat.uniforms.u_rot.value = globalTime * 1.5;
                    yyMat.uniforms.u_grey.value = 0.0;
                    if (bloom) bloom.strength = 1.5;
                }
                // Step 4 (1.8-2.3s): Yin-Yang → grey sphere morphing
                if (et >= 1.8 && et < 2.3) {
                    const t2 = (et - 1.8) / 0.5;
                    
                    // 陰陽をグレー化しながら縮小
                    yyPlane.visible = true;
                    yyMat.uniforms.u_grey.value = t2;
                    yyMat.uniforms.u_rot.value = globalTime * (1.5 + t2 * 8.0);
                    yyMat.uniforms.u_alpha.value = 1.0 - t2 * 0.8;
                    
                    // 陰陽が消えるタイミングでグレー球体をフェードイン
                    if (t2 > 0.4) {
                        const gt = (t2 - 0.4) / 0.6;
                        bDot.visible = true;
                        bDot.position.set(0, 0, 0.5);
                        if (!bDot.userData.greySet) {
                            bDot.material.fragmentShader = [
                                'precision highp float;',
                                'varying vec3 vNormal;',
                                'uniform float u_time;',
                                'void main(){',
                                '  vec3 N = normalize(vNormal);',
                                '  float r = length(gl_FragCoord.xy / 400.0 - vec2(1.0));',
                                '  float ring = sin(r * 60.0 - u_time * 2.0) * 0.5 + 0.5;',
                                '  float grey = 0.45 + ring * 0.08;',
                                '  float fresnel = pow(1.0 - max(dot(N, vec3(0.0,0.0,1.0)), 0.0), 3.0);',
                                '  vec3 rainbow = vec3(',
                                '    0.5+0.5*sin(fresnel*8.0+u_time),',
                                '    0.5+0.5*sin(fresnel*8.0+u_time+2.094),',
                                '    0.5+0.5*sin(fresnel*8.0+u_time+4.189)',
                                '  );',
                                '  vec3 col = mix(vec3(grey), rainbow, fresnel * 0.25);',
                                '  gl_FragColor = vec4(col, 1.0);',
                                '}'
                            ].join('\n');
                            bDot.material.needsUpdate = true;
                            bDot.userData.greySet = true;
                        }
                        bDot.scale.setScalar(gt * 1.0);
                        if (bloom) bloom.strength = 1.0 + gt * 0.5;
                    }
                    
                    const shake = Math.sin(et * 30) * 0.015 * (1 - t2);
                    if (yyPlane.visible) yyPlane.position.x = shake;
                    
                    if (bloom) bloom.strength = 1.5 + t2 * 2.0;
                }
                // Step 5 (2.3-2.5s): Yin-Yang vanish → tunnel born
                if (et >= 2.3 && et < 2.5) {
                    yyPlane.visible = false;
                    yyPlane.position.x = 0;
                    bDot.userData.greySet = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 2.3) / 0.2);
                    tunnelPlane.visible = true;
                    const t2 = (et - 2.3) / 0.2;
                    tunnelMat.uniforms.u_radius.value = 0.05 + t2 * 0.15;
                    tunnelMat.uniforms.u_alpha.value = t2;
                    tunnelMat.uniforms.u_progress.value = t2 * 0.2;
                    if (bloom) bloom.strength = 4.0 * (1 - t2) + 1.5;
                }

                // Step 6 (2.5-3.5s): Tunnel grows + stabilizes
                if (et >= 2.5) {
                    const t2 = (et - 2.5) / 1.0;
                    const pulse = 1 + Math.sin(et * 6) * 0.04;
                    tunnelMat.uniforms.u_radius.value = (0.2 + t2 * 0.05) * pulse;
                    tunnelMat.uniforms.u_alpha.value = 1.0;
                    tunnelMat.uniforms.u_progress.value = 0.2 + t2 * 0.1;
                    if (bloom) bloom.strength = 1.5;
                }

                if (et >= 3.5) { phase = PH.WARP_GROW; progPaused = false; }

                // ═══ PHASE 4: WARP_GROW (50→75%) ═══
            } else if (phase === PH.WARP_GROW) {
                updateWin95Status('Loading warp tunnel...');
                const wt = (prog - 50) / 25;
                const tR = 0.2 + wt * 0.35;
                tunnelMat.uniforms.u_radius.value = tR;
                tunnelMat.uniforms.u_progress.value = 0.2 + wt * 0.3;
                tunnelMat.uniforms.u_alpha.value = 0.8 + wt * 0.2;
                if (bloom) bloom.strength = 1.5 + wt * 1.5;
                if (prog >= 75) { phase = PH.EVENT_BREACH; eventTimer = 0; prog = 75; showProg(75); progPaused = true; }

                // ═══ PHASE 5: EVENT_BREACH (75% — 3s fixed) ═══
            } else if (phase === PH.EVENT_BREACH) {
                updateWin95Status('ERROR: Reality boundary exceeded');
                eventTimer += dt;
                const et = eventTimer;
                // ── Win95エラーダイアログ演出 ──
                if (et < 0.1 && !document.getElementById('breach-dialog')) {
                    const dialog = document.createElement('div');
                    dialog.id = 'breach-dialog';
                    dialog.style.cssText = `
                        position:fixed;
                        left:50%;top:50%;
                        transform:translate(-50%,-50%);
                        background:#c0c0c0;
                        border:2px solid #fff;
                        border-right-color:#555;
                        border-bottom-color:#555;
                        width:280px;
                        z-index:60;
                        font-family:'Courier New',monospace;
                        font-size:11px;
                        box-shadow:4px 4px 0 #333;
                    `;
                    dialog.innerHTML = `
                        <div style="background:#000080;color:white;padding:3px 6px;font-weight:bold;font-size:11px;display:flex;justify-content:space-between;">
                            <span>⚠ System Warning</span>
                            <span style="cursor:pointer;">✕</span>
                        </div>
                        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
                            <p style="margin:0;">Reality boundary exceeded.<br>Current progress: <b>75%</b></p>
                            <p style="margin:0;color:#cc0000;">ERROR: Cannot contain dimension overflow</p>
                            <div style="display:flex;justify-content:center;gap:8px;">
                                <button style="font-family:'Courier New',monospace;font-size:11px;padding:3px 20px;background:#c0c0c0;border:2px solid #fff;border-right-color:#555;border-bottom-color:#555;cursor:pointer;">OK</button>
                                <button style="font-family:'Courier New',monospace;font-size:11px;padding:3px 20px;background:#c0c0c0;border:2px solid #fff;border-right-color:#555;border-bottom-color:#555;cursor:pointer;">Cancel</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(dialog);
                    setTimeout(() => {
                        const el = document.getElementById('breach-dialog');
                        if (el) el.remove();
                    }, 2500);
                }
                if (et < 1.0) {
                    const t2 = et;
                    sqBorder.style.borderColor = 'rgba(255,255,255,' + (0.1 + t2 * 0.3) + ')';
                    const g = 40 + t2 * 40;
                    sqBorder.style.boxShadow = '0 0 ' + g + 'px 20px rgba(255,100,255,0.25),0 0 ' + (g * 1.5) + 'px 40px rgba(100,255,255,0.15)';
                    tunnelMat.uniforms.u_radius.value = 0.55 + t2 * 0.05;
                    tunnelMat.uniforms.u_alpha.value = 1.0;
                }
                if (et >= 1.0 && et < 2.0) {
                    const t2 = (et - 1.0);
                    barWrap.style.boxShadow = '0 0 ' + (t2 * 20) + 'px rgba(255,255,255,' + (t2 * 0.4) + ')';
                    sqBorder.style.borderColor = 'transparent';
                }
                if (et >= 2.0) { if (logoEl) { const t2 = (et - 2.0); logoEl.style.filter = 'blur(' + (t2 * 3) + 'px) brightness(' + (1 + t2 * 0.5) + ')'; } }
                // 残像エフェクト
                if (logoEl) {
                    const breachAt = Math.min(et / 3.0, 1.0);
                    logoEl.style.filter = `drop-shadow(0 0 ${8 + breachAt * 20}px #00ff44) drop-shadow(${breachAt * -8}px 0 ${breachAt * 12}px rgba(0,255,68,0.4))`;
                }
                if (bloom) bloom.strength = 3.5;
                if (et >= 3.0) { phase = PH.CONSUME; progPaused = false; sqBorder.style.borderColor = 'transparent'; }

                // ═══ PHASE 6: CONSUME (75→101%) — 引力の増大 ═══
            } else if (phase === PH.CONSUME) {
                updateWin95Status('Consuming reality... do not turn off');
                const at = (prog - 75) / 25;
                tunnelMat.uniforms.u_radius.value = 0.6 + at * 0.35;
                tunnelMat.uniforms.u_progress.value = 0.5 + at * 0.5;
                tunnelMat.uniforms.u_alpha.value = 1.0;
                const g = 40 + at * 40;
                sqBorder.style.boxShadow = '0 0 ' + g + 'px 15px rgba(255,100,255,0.2),0 0 ' + (g * 1.5) + 'px 30px rgba(100,255,255,0.15)';
                if (bloom) bloom.strength = 3.5 + at * 3;
                // 残像エフェクト
                if (logoEl) {
                    logoEl.style.filter = `drop-shadow(0 0 ${8 + at * 20}px #00ff44) drop-shadow(${at * -8}px 0 ${at * 12}px rgba(0,255,68,0.4))`;
                }
                if (prog >= 101) { phase = PH.EVENT_COLLAPSE; eventTimer = 0; prog = 101; showProg(101); progPaused = true; }

                // ═══ PHASE 7: EVENT_COLLAPSE — トンネルが溢れ出す ═══
            } else if (phase === PH.EVENT_COLLAPSE) {
                eventTimer += dt;
                const et = eventTimer;
                updateWin95Status('Shutting down current dimension...');
                // ── BSOD演出 ──
                if (et < 0.1 && !document.getElementById('bsod')) {
                    const bsod = document.createElement('div');
                    bsod.id = 'bsod';
                    bsod.style.cssText = `
                        position:fixed;
                        left:${sqLeft}px;top:${sqTop}px;
                        width:${sqPx}px;height:${sqPx}px;
                        background:#0000aa;
                        color:#ffffff;
                        font-family:'Courier New',monospace;
                        font-size:11px;
                        padding:24px;
                        z-index:200;
                        display:flex;
                        flex-direction:column;
                        gap:10px;
                        line-height:1.6;
                    `;
                    bsod.innerHTML = `
                        <div style="background:#aaaaaa;color:#0000aa;padding:2px 8px;font-weight:bold;font-size:12px;margin-bottom:8px;">
                            Windows
                        </div>
                        <p>A fatal exception 101% has occurred at<br>
                        0028:C047B5A2 in REALITY(01) + 00048E2F.<br>
                        The current dimension will be terminated.</p>
                        <p>* Press any key to terminate the current<br>
                        &nbsp;&nbsp;reality session.</p>
                        <p>* Press CTRL+ALT+DEL again to restart<br>
                        &nbsp;&nbsp;the universe. You will lose any unsaved<br>
                        &nbsp;&nbsp;data in all dimensions.</p>
                        <p style="margin-top:8px;">Press any key to continue <span style="animation:blink 0.5s step-end infinite">_</span></p>
                        <div style="margin-top:16px;">
                            <p>REALITY_OVERFLOW</p>
                            <p>Progress exceeded: 101%</p>
                            <div style="width:100%;height:12px;border:1px solid #4444aa;margin-top:4px;">
                                <div id="bsod-bar" style="height:100%;width:0%;background:#4444ff;"></div>
                            </div>
                            <p style="margin-top:4px;font-size:9px;">Initializing inryokü v2.0...</p>
                        </div>
                    `;
                    document.body.appendChild(bsod);
                    setTimeout(() => {
                        const bar = document.getElementById('bsod-bar');
                        if (bar) { bar.style.transition = 'width 3s linear'; bar.style.width = '100%'; }
                    }, 100);
                    setTimeout(() => {
                        const el = document.getElementById('bsod');
                        if (el) el.remove();
                    }, 4000);
                }
                tunnelMat.uniforms.u_radius.value = 0.95 + Math.min(et, 2.0) * 2.0; // expand beyond square
                tunnelMat.uniforms.u_progress.value = 1.0;
                tunnelMat.uniforms.u_alpha.value = 1.0;

                // Step 1 (0-0.5s): UI absorbed into center
                if (et < 0.5) {
                    const t2 = et / 0.5, ease = t2 * t2 * t2;
                    if (barWrap) { barWrap.style.transition = 'none'; barWrap.style.transform = 'translateY(' + (ease * 40) + 'px) scale(' + Math.max(0.01, 1 - ease) + ')'; barWrap.style.opacity = String(1 - ease * 2); barWrap.style.filter = 'blur(' + (ease * 12) + 'px)'; }
                    pct.style.transform = 'scale(' + Math.max(0.01, 1 - ease) + ')'; pct.style.opacity = String(1 - ease * 2);
                    if (logoEl) { const le = Math.max(0, (et - 0.15) / 0.35); if (le > 0) { logoEl.style.transform = 'scale(' + Math.max(0.01, 1 - le * le) + ') rotate(' + (le * le * 120) + 'deg)'; logoEl.style.opacity = String(1 - le * le * 1.5); logoEl.style.filter = 'blur(' + (le * le * 10) + 'px)'; } }
                }
                if (et >= 0.5 && et < 0.55) {
                    if (barWrap) barWrap.style.display = 'none'; pct.style.display = 'none';
                    if (logoEl) logoEl.style.display = 'none';
                    wrap.querySelectorAll('.p1-orb').forEach(o => o.style.display = 'none');
                    // Hide all non-tunnel 3D objects
                    bgPlane.visible = false;
                    fieldPlane.visible = false;
                    bDot.visible = false; wDot.visible = false;
                    yyPlane.visible = false;
                    cmyP.forEach(p => p.visible = false);
                    rgbP.forEach(p => p.visible = false);
                }

                // Step 2 (0.5-2.5s): Square border fades + mask expands → TUNNEL OVERFLOWS
                if (et >= 0.5 && et < 2.5) {
                    const t2 = (et - 0.5) / 2.0, eased = t2 * t2 * t2;
                    sqBorder.style.opacity = String(Math.max(0, 1 - eased * 3));
                    // Expand scissor from square to full screen
                    const curW = sqPx + (W - sqPx) * eased;
                    const curH = sqPx + (H - sqPx) * eased;
                    scissor.x = Math.round(W / 2 - curW / 2);
                    scissor.y = Math.round(H / 2 - curH / 2);
                    scissor.w = Math.round(curW);
                    scissor.h = Math.round(curH);
                    tunnelMat.uniforms.u_warpSpeed.value = 1.0 + eased * 3.0;
                    if (bloom) bloom.strength = 1.5 + eased * 3.0;
                }

                // Step 3 (2.5-5.0s): Camera warp into the light
                if (et >= 2.5 && et < 5.0) {
                    const t2 = (et - 2.5) / 2.5, eased = t2 * t2;
                    sqBorder.style.display = 'none';
                    scissor.enabled = false; // Full screen — no clip
                    camera.position.z = 50 - eased * 40;
                    camera.rotation.z += dt * (0.3 + eased * 1.5);
                    tunnelMat.uniforms.u_warpSpeed.value = 4.0 + eased * 6.0;
                    if (bloom) bloom.strength = 4.5 + eased * 4.0;
                    tunnelMat.uniforms.u_progress.value = 1.0 + eased;
                }

                // Step 4 (5.0-5.8s): Whiteout
                if (et >= 5.0 && et < 5.8) {
                    const t2 = (et - 5.0) / 0.8;
                    whiteOv.style.opacity = String(t2);
                    if (bloom) bloom.strength = 8.5;
                }

                // Step 5 (5.8-6.6s): Solar cross (GLSL)
                if (et >= 5.8 && et < 6.6) {
                    whiteOv.style.opacity = '1';
                    tunnelPlane.visible = false;
                    bgPlane.visible = false;
                    scPlane.visible = true;
                    scissor.enabled = false;
                    renderer.setClearColor(0xffffff, 1);
                    const scPhase = et - 5.8;
                    const scA = scPhase < 0.3 ? (scPhase / 0.3) * (scPhase / 0.3) : (scPhase > 0.6 ? Math.max(0, 1 - ((scPhase - 0.6) / 0.2) * ((scPhase - 0.6) / 0.2)) : 1.0);
                    scMat.uniforms.u_alpha.value = scA;
                }

                // Step 6 (6.6s): Transition to P3
                if (et >= 6.6 && phase !== PH.DONE) {
                    phase = PH.DONE; alive = false;
                    // ── クリーンアップ: 全3Dリソース解放 ──
                    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.dispose) o.material.dispose(); } });
                    if (composer) { composer.passes.forEach(p => { if (p.dispose) p.dispose(); }); }
                    // 分離レンダーパイプラインリソース解放
                    rtSquare.dispose(); rtOuter.dispose();
                    compositeMat.dispose(); compQuad.geometry.dispose();
                    renderer.dispose(); renderer.domElement.remove();
                    whiteOv.remove(); wrap.remove(); ldCSS.remove();
                    // ── P1完了: カスタムイベント発火 ──
                    window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
                }
            }
        }






        // scissorはsq-borderのDOMRectから動的に計算

        // ══════════════════════════════════════════════════════
        //  RENDER LOOP — 分離レンダーパイプライン
        // ══════════════════════════════════════════════════════
        (function renderLoop() {
            if (!alive) return;
            tick();
            updateScissorFromDOM(); // scissor + squareRect をDOM同期

            if (scissor.enabled) {
                // ── Pass 1: シーン → rtSquare ──
                // (Phase別ポストプロセスはStep 2/4で追加)
                renderer.setRenderTarget(rtSquare);
                renderer.setScissorTest(false);
                renderer.setViewport(0, 0, rtSquare.width, rtSquare.height);
                renderer.clear();
                renderer.render(scene, camera);
                renderer.setRenderTarget(null);

                // ── Pass 2: rtSquare → スクリーン（合成）──
                // CRTエフェクトはStep 2/3で合成シェーダーに統合予定
                renderer.setViewport(0, 0, W, H);
                renderer.setScissorTest(false);
                renderer.render(compScene, compCamera);
            } else {
                // フルスクリーンレンダー (CONSUME後半 / EVENT_COLLAPSE)
                renderer.setRenderTarget(null);
                renderer.setScissorTest(false);
                renderer.setViewport(0, 0, W, H);
                renderer.render(scene, camera);
            }

            requestAnimationFrame(renderLoop);
        })();
    });
}
