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
    root.innerHTML = `<div id="p0-wrapper" style="
  background:#808080;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:'Press Start 2P', monospace;
  cursor:default;
  animation:p0Flicker 7s step-end infinite;
">

  <!-- CRT スキャンライン（全画面） -->
  <div style="position:fixed;inset:0;pointer-events:none;z-index:9999;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,
      rgba(0,0,0,0.11) 2px,rgba(0,0,0,0.11) 4px);"></div>

  <!-- CRT ビネット（周辺減光） -->
  <div style="position:fixed;inset:0;pointer-events:none;z-index:9998;
    background:radial-gradient(ellipse at 50% 50%,transparent 52%,rgba(0,0,0,0.42) 100%);
  "></div>

  <style>
    @keyframes cursorBlink {
      0%,49%{opacity:1;}
      50%,100%{opacity:0;}
    }
    @keyframes p0Flicker {
      0%,93%,100%{opacity:1;}
      94%{opacity:0.97;}
      96%{opacity:1;}
      97%{opacity:0.95;}
      98%{opacity:0.99;}
    }
    * {
      -webkit-font-smoothing: none;
      font-smooth: never;
      image-rendering: pixelated;
    }
    /* System 7 ベベルボタン */
    #evolve-btn {
      font-family:'Press Start 2P', monospace;
      font-size:11px;
      letter-spacing:1px;
      padding:7px 40px;
      background:#ffffff;
      border:2px solid #000000;
      box-shadow:inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
      cursor:pointer;
      color:#000000;
      border-radius:0;
      min-width:168px;
    }
    #evolve-btn:hover {
      background:#f4f4f4;
    }
    #evolve-btn:active {
      box-shadow:inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff;
      background:#e8e8e8;
    }
    .mac-divider {
      width:100%;
      border:none;
      border-top:1px solid #000000;
      margin:6px 0;
    }
  </style>

  <!-- Macダイアログ本体（System 7 ウィンドウ枠） -->
  <div style="
    background:#ffffff;
    border:1px solid #000000;
    width:clamp(476px,54vw,580px);
    box-shadow:inset 1px 1px 0 #ffffff, inset -1px -1px 0 #000000;
    border-radius:0;
    overflow:hidden;
  ">

    <!-- タイトルバー（System 7: 縦縞1px交互） -->
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
      <!-- クローズボックス（左上, System 7 12×12） -->
      <div style="
        position:absolute;left:10px;top:50%;transform:translateY(-50%);
        width:13px;height:13px;
        border:1px solid #000000;
        background:#ffffff;
        box-shadow:inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
      "></div>
      <!-- タイトルテキスト（白背景帯） -->
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
          <defs>
            <!-- 発光フィルター: モノクロUIの中で浮かぶ「異質な窓」 -->
            <filter id="orb-glow-c"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#00FFFF" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-g"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#00FF00" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-b"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#0000FF" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-m"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#FF00FF" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-r"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#FF0000" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="orb-glow-y"  x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="#FFFF00" flood-opacity="0.85" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx="80" cy="80" r="58" fill="none" stroke="#000000" stroke-width="0.5" stroke-dasharray="3 4"/>
          <!-- 上から時計回り: Cyan Green Blue Magenta Red Yellow (CMY+RGB交互) -->
          <circle id="px0" r="5.5" fill="#00FFFF" filter="url(#orb-glow-c)"/>
          <circle id="px1" r="5.5" fill="#00FF00" filter="url(#orb-glow-g)"/>
          <circle id="px2" r="5.5" fill="#0000FF" filter="url(#orb-glow-b)"/>
          <circle id="px3" r="5.5" fill="#FF00FF" filter="url(#orb-glow-m)"/>
          <circle id="px4" r="5.5" fill="#FF0000" filter="url(#orb-glow-r)"/>
          <circle id="px5" r="5.5" fill="#FFFF00" filter="url(#orb-glow-y)"/>
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
      let a=-Math.PI/2; // px0(Cyan)が12時(上)からスタート
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

    // ── Win95 起動音（Web Audio API） Step 3 ──
    // G4→C5→E5→G5 4音メロディ（triangle波・FM合成風）
    function playWin95StartupSound() {
        if (!audioContext) {
            try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
            catch(e) { return; }
        }
        if (audioContext.state === 'suspended') audioContext.resume();
        const notes = [392.00, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
        const now = audioContext.currentTime;
        notes.forEach((freq, i) => {
            const t = now + i * 0.22;
            const osc  = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            // FM風: 軽いビブラート
            osc.frequency.setValueAtTime(freq * 1.004, t + 0.05);
            osc.frequency.setValueAtTime(freq, t + 0.1);
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.10, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
            osc.start(t); osc.stop(t + 0.4);
        });
    }

    // ── P0 Mac起動チャイム（Web Audio API） ──
    // C major 和音: C4・E4・G4（正弦波、2秒減衰）
    // autoplay制限対応: 初回クリック時に再生
    function playMacStartupSound() {
        if (!audioContext) {
            try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
            catch(e) { return; }
        }
        if (audioContext.state === 'suspended') audioContext.resume();
        const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
        const now = audioContext.currentTime;
        notes.forEach(freq => {
            const osc  = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12 / notes.length, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
            osc.start(now); osc.stop(now + 1.8);
        });
    }
    document.body.addEventListener('click', function p0SoundInit() {
        document.body.removeEventListener('click', p0SoundInit);
        playMacStartupSound();
    }, { once: true });


    document.getElementById('evolve-btn').addEventListener('click', () => {
        playWin95StartupSound();

        // ── Clear P0 ──
        document.getElementById('root').innerHTML = '';
        document.body.style.background = '#000';

        const W = window.innerWidth, H = window.innerHeight;

        // ═══════════════════════ THREE.JS SETUP ════════════════════════
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setPixelRatio(0.5);
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
        document.body.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
        camera.position.z = 14;

        // ═══════════════════════ WIN95 UI OVERLAY ════════════════════════
        const ldCSS = document.createElement('style');
        ldCSS.textContent = `
            @keyframes p1In{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
            @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
        `;
        document.head.appendChild(ldCSS);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10;pointer-events:none;font-family:"MS Sans Serif",Arial,sans-serif;';
        wrap.innerHTML = `
            <!-- タスクバー -->
            <div style="position:absolute;bottom:0;left:0;right:0;height:28px;background:#c0c0c0;
                border-top:2px solid #fff;display:flex;align-items:center;padding:0 4px;gap:4px;z-index:20;">
                <div style="background:#c0c0c0;border-top:2px solid #fff;border-left:2px solid #fff;
                    border-right:2px solid #555;border-bottom:2px solid #555;
                    padding:2px 8px;font-size:11px;font-weight:bold;color:#000;
                    display:flex;align-items:center;gap:4px;">
                    <svg width="14" height="14" viewBox="0 0 14 14" style="image-rendering:pixelated;flex-shrink:0;">
                        <rect x="1" y="1" width="5" height="5" fill="#ff0000"/>
                        <rect x="8" y="1" width="5" height="5" fill="#00aa00"/>
                        <rect x="1" y="8" width="5" height="5" fill="#ffff00"/>
                        <rect x="8" y="8" width="5" height="5" fill="#0000ff"/>
                    </svg>
                    <b>Start</b>
                </div>
                <div style="width:1px;height:20px;background:#888;margin:0 2px;"></div>
                <div style="background:#888;border-top:1px solid #555;border-left:1px solid #555;
                    border-right:1px solid #ddd;border-bottom:1px solid #ddd;
                    padding:2px 8px;font-size:10px;color:#fff;">inryokü — Loading Reality</div>
                <div style="margin-left:auto;border-top:1px solid #808080;border-left:1px solid #808080;
                    border-right:1px solid #fff;border-bottom:1px solid #fff;
                    background:#c0c0c0;padding:0 8px;">
                    <div id="win-clock" style="font-size:11px;color:#000;"></div>
                </div>
            </div>

            <!-- プログレスウィンドウ -->
            <div id="p1-win" style="position:absolute;left:50%;bottom:40px;transform:translateX(-50%);
                width:440px;background:#c0c0c0;
                border-top:2px solid #fff;border-left:2px solid #fff;
                border-right:2px solid #555;border-bottom:2px solid #555;
                animation:p1In 0.4s ease-out both;">
                <div style="background:linear-gradient(to right,#000080,#1084d0);
                    padding:2px 6px;display:flex;align-items:center;justify-content:space-between;">
                    <span style="color:#fff;font-size:11px;font-weight:bold;
                        font-family:'MS Sans Serif',Arial,sans-serif;">inryokü — Loading Reality</span>
                    <div style="width:14px;height:13px;background:#c0c0c0;
                        border-top:1px solid #fff;border-left:1px solid #fff;
                        border-right:1px solid #404040;border-bottom:1px solid #404040;
                        font-size:8px;font-weight:bold;display:flex;align-items:center;
                        justify-content:center;color:#000;font-family:'MS Sans Serif',Arial,sans-serif;">✕</div>
                </div>
                <div style="padding:10px 14px 10px 14px;">
                    <div style="font-size:11px;color:#000;margin-bottom:6px;font-family:'MS Sans Serif',Arial,sans-serif;"
                        id="p1-status">Initializing reality engine...</div>
                    <div style="height:20px;background:#000;
                        border-top:2px solid #808080;border-left:2px solid #808080;
                        border-right:2px solid #fff;border-bottom:2px solid #fff;
                        margin-bottom:6px;position:relative;overflow:hidden;">
                        <div id="p1-lb" style="width:0%;height:100%;
                            background:repeating-linear-gradient(90deg,#0000aa 0,#0000aa 7px,#0000cc 7px,#0000cc 8px);
                            transition:width 0.1s linear;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="font-size:10px;color:#444;font-family:'MS Sans Serif',Arial,sans-serif;">
                            Loading reality...</div>
                        <div id="p1-lpct" style="font-size:11px;color:#444;
                            font-family:'MS Sans Serif',Arial,sans-serif;">0%</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrap);

        // 時計
        setInterval(() => {
            const cl = document.getElementById('win-clock');
            if (cl) {
                const n = new Date();
                cl.textContent = n.getHours().toString().padStart(2, '0') + ':' +
                                 n.getMinutes().toString().padStart(2, '0');
            }
        }, 1000);

        // ═══════════════════════ SHADERS ════════════════════════
        const orbVert = [
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'void main() {',
            '    vNormal = normalize(normalMatrix * normal);',
            '    vec4 mv = modelViewMatrix * vec4(position, 1.0);',
            '    vViewDir = normalize(-mv.xyz);',
            '    gl_Position = projectionMatrix * mv;',
            '}'
        ].join('\n');

        const orbFrag = [
            'precision highp float;',
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'uniform vec3 u_color;',
            'uniform float u_alpha;',
            'uniform float u_time;',
            'void main() {',
            '    vec3 N = normalize(vNormal);',
            '    vec3 V = normalize(vViewDir);',
            '    vec3 L = normalize(vec3(0.6, 0.8, 1.0));',
            '    float diff = max(dot(N, L), 0.0);',
            '    vec3 H = normalize(L + V);',
            '    float spec = pow(max(dot(N, H), 0.0), 48.0);',
            '    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);',
            '    vec3 col = u_color * (0.12 + diff * 0.55);',
            '    col += u_color * rim * 2.5;',
            '    col += vec3(1.0) * spec * 0.5;',
            '    col += vec3(1.0) * pow(rim, 5.0) * 0.7;',
            '    float pulse = 1.0 + 0.10 * sin(u_time * 2.8);',
            '    float alpha = u_alpha * (0.45 + rim * 0.55);',
            '    gl_FragColor = vec4(col * pulse, alpha);',
            '}'
        ].join('\n');

        const VS_UV = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

        // Yin-yang shader
        const yyFrag = [
            'precision highp float;',
            'varying vec2 vUv;',
            'uniform float u_rot, u_alpha, u_time;',
            'void main() {',
            '    vec2 p = (vUv - 0.5) * 2.0;',
            '    float ca = cos(u_rot), sa = sin(u_rot);',
            '    vec2 rp = vec2(ca*p.x - sa*p.y, sa*p.x + ca*p.y);',
            '    float r = length(rp);',
            '    if (r > 1.06) discard;',
            '    float b = rp.x - sin(rp.y * 3.14159) * 0.28;',
            '    float s1 = smoothstep(0.13, 0.0, length(rp - vec2(0.0,  0.24)));',
            '    float s2 = smoothstep(0.13, 0.0, length(rp - vec2(0.0, -0.24)));',
            '    float yin = smoothstep(-0.015, 0.015, b) * step(r, 0.86);',
            '    yin = yin * (1.0 - s1) + s2 * step(r, 0.86);',
            '    vec3 darkCol  = vec3(0.01, 0.01, 0.02);',
            '    vec3 lightCol = vec3(0.97, 0.97, 1.00);',
            '    vec3 col = mix(darkCol, lightCol, yin);',
            '    float ao = atan(p.y, p.x);',
            '    vec3 rainbow = vec3(',
            '        0.5+0.5*sin(ao*3.+u_time*1.5),',
            '        0.5+0.5*sin(ao*3.+u_time*1.5+2.094),',
            '        0.5+0.5*sin(ao*3.+u_time*1.5+4.189)',
            '    );',
            '    float aura = smoothstep(1.02, 0.88, r) * smoothstep(0.82, 0.92, r);',
            '    float boundary = exp(-abs(b) * 80.0) * step(r, 0.85);',
            '    float bAngle = atan(rp.y, rp.x);',
            '    vec3 boundCol = vec3(',
            '        0.5+0.5*sin(bAngle*2.+u_time*3.),',
            '        0.5+0.5*sin(bAngle*2.+u_time*3.+2.094),',
            '        0.5+0.5*sin(bAngle*2.+u_time*3.+4.189)',
            '    );',
            '    col += boundCol * boundary * 1.4;',
            '    col = mix(col, rainbow * 1.2, aura);',
            '    float alpha = smoothstep(1.06, 0.90, r) * u_alpha;',
            '    gl_FragColor = vec4(col, alpha);',
            '}'
        ].join('\n');

        // Ring shader (WARP_GROW / CONSUME)
        const ringFrag = [
            'precision highp float;',
            'varying vec2 vUv;',
            'uniform vec3 u_color;',
            'uniform float u_radius;',
            'uniform float u_alpha;',
            'uniform float u_time;',
            'void main() {',
            '    vec2 p = (vUv - 0.5) * 2.0;',
            '    float r = length(p);',
            '    float ring  = exp(-abs(r - u_radius) * 14.0);',
            '    float inner = exp(-abs(r - u_radius) * 4.0) * 0.35;',
            '    float total = ring + inner;',
            '    gl_FragColor = vec4(u_color * total, total * u_alpha);',
            '}'
        ].join('\n');

        // Grey sphere shader
        const greySphFrag = [
            'precision highp float;',
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'uniform float u_alpha, u_time;',
            'void main() {',
            '    vec3 N = normalize(vNormal);',
            '    vec3 V = normalize(vViewDir);',
            '    vec3 L = normalize(vec3(0.6, 0.8, 1.0));',
            '    float diff = max(dot(N, L), 0.0);',
            '    vec3 H = normalize(L + V);',
            '    float spec = pow(max(dot(N, H), 0.0), 64.0);',
            '    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);',
            '    float ao = atan(N.y, N.x);',
            '    vec3 rainbow = vec3(',
            '        0.5+0.5*sin(ao*3.+u_time),',
            '        0.5+0.5*sin(ao*3.+u_time+2.094),',
            '        0.5+0.5*sin(ao*3.+u_time+4.189)',
            '    );',
            '    vec3 col = vec3(0.06 + diff * 0.52 + spec * 0.28);',
            '    col += rainbow * rim * 0.5;',
            '    gl_FragColor = vec4(col, u_alpha);',
            '}'
        ].join('\n');

        // ═══════════════════════ SCENE OBJECTS ════════════════════════
        // 6 RGBCMY orbs
        const orbGeo = new THREE.SphereGeometry(0.7, 32, 32);
        const ORB_COLORS = [
            [1, 0, 0],   // R
            [0, 1, 0],   // G
            [0, 0, 1],   // B
            [0, 1, 1],   // C
            [1, 0, 1],   // M
            [1, 1, 0],   // Y
        ];
        const orbs = ORB_COLORS.map(([r, g, b]) => {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    u_color: { value: new THREE.Vector3(r, g, b) },
                    u_alpha: { value: 1.0 },
                    u_time:  { value: 0.0 },
                },
                vertexShader:   orbVert,
                fragmentShader: orbFrag,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            const m = new THREE.Mesh(orbGeo, mat);
            scene.add(m);
            return m;
        });

        // Yin-yang plane
        const yyMat = new THREE.ShaderMaterial({
            uniforms: { u_rot: { value: 0 }, u_alpha: { value: 0 }, u_time: { value: 0 } },
            vertexShader: VS_UV,
            fragmentShader: yyFrag,
            transparent: true,
            depthWrite: false,
        });
        const yyPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), yyMat);
        yyPlane.visible = false;
        scene.add(yyPlane);

        // 6 color rings (WARP_GROW / CONSUME) — large plane that covers screen
        const RING_COLORS = [
            [1, 0, 0],  // R
            [0, 1, 0],  // G
            [0, 0, 1],  // B
            [0, 1, 1],  // C
            [1, 0, 1],  // M
            [1, 1, 0],  // Y
        ];
        const ringPlanes = RING_COLORS.map(([r, g, b]) => {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    u_color:  { value: new THREE.Vector3(r, g, b) },
                    u_radius: { value: 0.0 },
                    u_alpha:  { value: 0.0 },
                    u_time:   { value: 0.0 },
                },
                vertexShader: VS_UV,
                fragmentShader: ringFrag,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat);
            m.position.z = 0.5;
            m.visible = false;
            scene.add(m);
            return m;
        });

        // Grey sphere (EVENT_FUSE result + DUALITY)
        const greySphMat = new THREE.ShaderMaterial({
            uniforms: { u_alpha: { value: 0 }, u_time: { value: 0 } },
            vertexShader: orbVert,
            fragmentShader: greySphFrag,
            transparent: true,
            depthWrite: false,
        });
        const greySph = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), greySphMat);
        greySph.visible = false;
        scene.add(greySph);

        // Flash plane (full-screen white flash)
        const flashMat = new THREE.ShaderMaterial({
            uniforms: { u_alpha: { value: 0 } },
            vertexShader: VS_UV,
            fragmentShader: 'precision highp float;uniform float u_alpha;void main(){gl_FragColor=vec4(1.0,1.0,1.0,u_alpha);}',
            transparent: true,
            depthWrite: false,
        });
        const flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), flashMat);
        flashPlane.position.z = 5;
        flashPlane.visible = false;
        scene.add(flashPlane);

        // White overlay (DOM, for final fade)
        const whiteOv = document.createElement('div');
        whiteOv.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#fff;opacity:0;pointer-events:none;';
        document.body.appendChild(whiteOv);

        // ═══════════════════════ STATE MACHINE ════════════════════════
        const PH = {
            ATTRACT:    0,
            EVENT_FUSE: 1,
            DUALITY:    2,
            EVENT_SING: 3,
            WARP_GROW:  4,
            CONSUME:    5,
            DONE:       6,
        };
        let phase = PH.ATTRACT;
        let prog = 0;        // 0 → 101
        let eventTimer = 0;
        let alive = true;
        let globalTime = 0;
        const clk = new THREE.Clock();

        // Auto-advance speed (%/second) for continuous phases
        const AUTO_RATE = {
            [PH.ATTRACT]:   5.0,   // 0→30% in ~6s
            [PH.DUALITY]:   5.0,   // 30→50% in ~4s
            [PH.WARP_GROW]: 5.0,   // 50→75% in ~5s
            [PH.CONSUME]:   6.5,   // 75→101% in ~4s
        };

        function showProg(v) {
            const pv = Math.min(101, Math.floor(v));
            const bar = document.getElementById('p1-lb');
            const pct = document.getElementById('p1-lpct');
            if (bar) {
                bar.style.width = Math.min(100, pv) + '%';
                if (pv >= 101) {
                    bar.style.background = '#ffffff';
                    bar.style.boxShadow = '0 0 12px 4px rgba(255,255,255,0.8)';
                }
            }
            if (pct) {
                if (pv >= 101) {
                    pct.textContent = '⚠ OVERFLOW: 101%';
                    pct.style.color = '#ff0000';
                } else {
                    pct.textContent = pv + '%';
                    pct.style.color = '';
                }
            }
        }

        function setStatus(msg) {
            const el = document.getElementById('p1-status');
            if (el) el.textContent = msg;
        }

        // ═══════════════════════ MAIN TICK ════════════════════════
        function tick() {
            if (!alive) return;
            const dt = Math.min(clk.getDelta(), 0.05);
            globalTime += dt;

            // Auto-advance progress in non-event phases
            const rate = AUTO_RATE[phase];
            if (rate !== undefined) {
                prog = Math.min(101, prog + rate * dt);
                showProg(prog);
            }

            // Update time uniforms
            orbs.forEach(o => { o.material.uniforms.u_time.value = globalTime; });
            if (yyPlane.visible)  yyMat.uniforms.u_time.value = globalTime;
            if (greySph.visible)  greySphMat.uniforms.u_time.value = globalTime;
            ringPlanes.forEach(r => { if (r.visible) r.material.uniforms.u_time.value = globalTime; });

            // ─────────────────────────────────────────────
            // ATTRACT (0 → 30%)
            // 6 RGBCMY orbs orbit in hexagonal formation,
            // converging toward center
            // ─────────────────────────────────────────────
            if (phase === PH.ATTRACT) {
                setStatus('Initializing reality engine... ' + Math.floor(prog) + '%');
                const t = prog / 30; // 0 → 1

                // Orbit radius shrinks: 4.5 → 0.7 (ease-in^2)
                const orbRadius = 4.5 - t * t * 3.8;
                // Group rotation accelerates slightly
                const groupAngle = globalTime * (0.35 + t * 0.55);

                orbs.forEach((orb, i) => {
                    const baseAngle = (i / 6) * Math.PI * 2 + groupAngle;
                    // Slight Y-axis variation for 3D depth
                    const yTilt = Math.sin(baseAngle + i) * 0.5;
                    orb.position.set(
                        Math.cos(baseAngle) * orbRadius,
                        yTilt * (1 - t * 0.5),
                        Math.sin(baseAngle) * orbRadius * 0.3
                    );
                    // Gentle pulse
                    orb.material.uniforms.u_alpha.value = 0.8 + 0.2 * Math.sin(globalTime * 2.5 + i * 1.1);
                    orb.visible = true;
                });

                if (prog >= 30) {
                    phase = PH.EVENT_FUSE;
                    eventTimer = 0;
                    prog = 30;
                    showProg(30);
                }

            // ─────────────────────────────────────────────
            // EVENT_FUSE (30%, ~1.8s fixed)
            // Orbs rush to center → flash → grey sphere born
            // ─────────────────────────────────────────────
            } else if (phase === PH.EVENT_FUSE) {
                setStatus('\u26a0 Fusing matter and energy...');
                eventTimer += dt;
                const et = eventTimer;

                // 0–0.7s: Rush to center
                if (et < 0.7) {
                    const t2 = et / 0.7;
                    const ease = t2 * t2 * (3 - 2 * t2); // smoothstep
                    orbs.forEach((orb, i) => {
                        orb.position.x *= (1 - ease * 0.18);
                        orb.position.y *= (1 - ease * 0.18);
                        orb.position.z *= (1 - ease * 0.18);
                        orb.scale.setScalar(1.0 - ease * 0.4);
                    });
                }

                // 0.7s: Flash + orbs vanish → grey sphere appears
                if (et >= 0.7 && et < 0.75) {
                    orbs.forEach(o => { o.visible = false; });
                    flashPlane.visible = true;
                    flashMat.uniforms.u_alpha.value = 1.0;
                }
                if (et >= 0.75) {
                    const ft = Math.max(0, 1.0 - (et - 0.75) / 0.4);
                    flashMat.uniforms.u_alpha.value = ft;
                    if (ft < 0.01) flashPlane.visible = false;
                }

                // 0.8s: Grey sphere born (grows from 0)
                if (et >= 0.8) {
                    greySph.visible = true;
                    const growT = Math.min(1.0, (et - 0.8) / 0.6);
                    const easedGrow = growT * (2 - growT); // ease-out quad
                    greySph.scale.setScalar(easedGrow * 1.0);
                    greySphMat.uniforms.u_alpha.value = 1.0;
                }

                if (et >= 1.8) {
                    phase = PH.DUALITY;
                    prog = 30;
                    flashPlane.visible = false;
                }

            // ─────────────────────────────────────────────
            // DUALITY (30 → 50%)
            // Grey sphere shrinks → yin-yang fades in
            // ─────────────────────────────────────────────
            } else if (phase === PH.DUALITY) {
                setStatus('Resolving duality... ' + Math.floor(prog) + '%');
                const t = (prog - 30) / 20; // 0 → 1

                // Grey sphere fades and shrinks
                greySph.scale.setScalar(Math.max(0.01, 1.0 - t * 0.85));
                greySphMat.uniforms.u_alpha.value = Math.max(0, 1.0 - t * 1.2);

                // Yin-yang fades in and rotates
                yyPlane.visible = true;
                yyMat.uniforms.u_alpha.value = Math.min(1.0, t * 1.6);
                yyMat.uniforms.u_rot.value = globalTime * 1.2;

                if (prog >= 50) {
                    phase = PH.EVENT_SING;
                    eventTimer = 0;
                    prog = 50;
                    showProg(50);
                    greySph.visible = false;
                    greySph.scale.setScalar(1.0);
                }

            // ─────────────────────────────────────────────
            // EVENT_SING (50%, ~2.5s fixed)
            // Yin-yang pulses then stabilizes at 50%
            // ─────────────────────────────────────────────
            } else if (phase === PH.EVENT_SING) {
                setStatus('50% \u2014 Singularity achieved');
                eventTimer += dt;
                const et = eventTimer;

                yyMat.uniforms.u_alpha.value = 1.0;
                yyMat.uniforms.u_rot.value = globalTime * 1.2;

                // Pulse: 3 quick bursts then settle
                const decay = Math.max(0, 1 - et / 1.5);
                const pulse = 1.0 + Math.sin(et * Math.PI * 5) * 0.12 * decay;
                yyPlane.scale.setScalar(pulse);

                if (et >= 2.5) {
                    phase = PH.WARP_GROW;
                    prog = 50;
                    yyPlane.scale.setScalar(1.0);
                }

            // ─────────────────────────────────────────────
            // WARP_GROW (50 → 75%)
            // 6 color rings born from center, expand outward
            // ─────────────────────────────────────────────
            } else if (phase === PH.WARP_GROW) {
                setStatus('Expanding reality rings... ' + Math.floor(prog) + '%');
                const t = (prog - 50) / 25; // 0 → 1

                // Yin-yang fades out in first 30%
                const yyFade = Math.max(0, 1.0 - t * 3.5);
                yyMat.uniforms.u_alpha.value = yyFade;
                if (yyFade < 0.01) yyPlane.visible = false;

                // Rings expand with stagger
                ringPlanes.forEach((ring, i) => {
                    ring.visible = true;
                    const delay = (i / 6) * 0.25;
                    const rt = Math.max(0, t - delay) / (1 - delay);
                    const easedRt = rt * rt;
                    ring.material.uniforms.u_radius.value = easedRt * 2.2;
                    ring.material.uniforms.u_alpha.value = Math.min(1.0, rt * 3.0) * (1.0 - rt * 0.2);
                });

                if (prog >= 75) {
                    phase = PH.CONSUME;
                    prog = 75;
                    showProg(75);
                }

            // ─────────────────────────────────────────────
            // CONSUME (75 → 101%)
            // Rings accelerate, white flood, Win95 UI dies
            // ─────────────────────────────────────────────
            } else if (phase === PH.CONSUME) {
                setStatus('Consuming reality... do not turn off your computer');
                const t = Math.min(1.0, (prog - 75) / 26); // 0 → 1

                // Rings race outward
                ringPlanes.forEach((ring, i) => {
                    ring.visible = true;
                    const offset = (i / 6) * 0.4;
                    ring.material.uniforms.u_radius.value = 2.2 + t * t * 5.0 + offset;
                    ring.material.uniforms.u_alpha.value = Math.max(0, 1.0 - t * 0.7);
                });

                // White DOM overlay fades in from 80%
                const wt = Math.max(0, (t - 0.5) / 0.5);
                whiteOv.style.opacity = String(wt * wt);

                // Win95 window fades at 85%
                if (prog > 85) {
                    const p1win = document.getElementById('p1-win');
                    if (p1win) {
                        p1win.style.opacity = String(Math.max(0, 1 - (prog - 85) / 16));
                    }
                }

                if (prog >= 101) {
                    phase = PH.DONE;
                    showProg(101);

                    // White → black → P2
                    whiteOv.style.opacity = '1';
                    setTimeout(() => {
                        whiteOv.style.background = '#000';
                        setTimeout(() => {
                            alive = false;
                            // Cleanup
                            scene.traverse(o => {
                                if (o.geometry) o.geometry.dispose();
                                if (o.material && o.material.dispose) o.material.dispose();
                            });
                            renderer.dispose();
                            renderer.domElement.remove();
                            whiteOv.remove();
                            wrap.remove();
                            ldCSS.remove();
                            window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
                        }, 800);
                    }, 500);
                }
            }
        }

        // ═══════════════════════ RENDER LOOP ════════════════════════
        (function renderLoop() {
            if (!alive) return;
            tick();
            renderer.render(scene, camera);
            requestAnimationFrame(renderLoop);
        })();

    }); // end evolve-btn click
} // end renderPhase1
