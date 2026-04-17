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

// ── グローバルミュートフラグ（開発用: 全音を無効化） ──
window._inryokuMuted = true;
// UNUSED
// const WIN95_PALETTE = [
//     '#000000','#800000','#008000','#808000',
//     '#000080','#800080','#008080','#c0c0c0',
//     '#808080','#ff0000','#00ff00','#ffff00',
//     '#0000ff','#ff00ff','#00ffff','#ffffff'
// ];
let currentPhase = 1;
let audioContext = null;
// UNUSED
// function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }
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
  background:repeating-conic-gradient(#000 0deg 90deg,#fff 90deg 180deg) 0/2px 2px;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;
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
    /* Load Chicago-like font from CDN */
    @font-face {
      font-family: 'ChicagoFLF';
      src: url('https://cdn.jsdelivr.net/gh/smolck/chicago-flf-font@master/ChicagoFLF.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    /* 1-bit dither: 50% grey (Mac System 1 style) */
    .dither50 {
      background-color: transparent !important;
      background-image: linear-gradient(45deg,#000 25%,transparent 25%),
        linear-gradient(-45deg,#000 25%,transparent 25%),
        linear-gradient(45deg,transparent 75%,#000 75%),
        linear-gradient(-45deg,transparent 75%,#000 75%) !important;
      background-size: 2px 2px !important;
      background-position: 0 0, 0 1px, 1px -1px, -1px 0px !important;
    }
    /* 25% dither (lighter grey) */
    .dither25 {
      background-color: transparent !important;
      background-image: linear-gradient(45deg,#000 25%,transparent 25%),
        linear-gradient(-45deg,transparent 75%,transparent 75%),
        linear-gradient(45deg,transparent 75%,transparent 75%),
        linear-gradient(-45deg,transparent 75%,transparent 75%) !important;
      background-size: 4px 4px !important;
      background-position: 0 0, 0 2px, 2px -2px, -2px 0px !important;
    }
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
    /* System 1 デフォルトボタン（太い黒枠＋角丸＋1-bit美学） */
    #evolve-btn {
      font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;
      font-size:12px;
      letter-spacing:1px;
      padding:6px 36px;
      background:#ffffff;
      border:3px solid #000000;
      border-radius:8px;
      box-shadow:0 0 0 1px #000000, inset 0 0 0 1px #000000;
      cursor:pointer;
      color:#000000;
      min-width:130px;
      outline:none;
      position:relative;
      transition:background 0.05s, color 0.05s, opacity 0.5s, box-shadow 0.5s;
    }
    #evolve-btn.p0-disabled {
      opacity:0.4;
      pointer-events:none;
      cursor:default;
    }
    #evolve-btn:active {
      background:#000000;
      color:#ffffff;
    }
    #evolve-btn:hover {
      background:#e8e8e8;
    }
    /* System 7 エッチング線（上:暗い線 + 下:白い線） */
    .mac-divider {
      width:100%;
      border:none;
      border-top:1px solid #000000;
      border-bottom:1px solid #ffffff;
      height:0;
      margin:4px 0;
    }
    .p0-wave-ball {
      position:fixed;
      left:0;
      top:0;
      border-radius:50%;
      pointer-events:none;
      z-index:9990;
      opacity:0;
      will-change:transform,width,height,opacity,filter;
    }
  </style>

  <!-- Macダイアログ本体（System 7 ウィンドウ枠） -->
  <div id="mac-dialog" style="
    background:#ffffff;
    border:1px solid #000000;
    width:clamp(420px,48vw,520px);
    box-shadow:1px 1px 0 #000000;
    border-radius:0;
    overflow:hidden;
  ">

    <!-- タイトルバー（System 7: 横縞6本、高さ19px） -->
    <div style="
      height:19px;
      background:#ffffff;
      border-bottom:1px solid #000000;
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <!-- 横縞パターン（左半分） -->
      <div style="
        position:absolute;left:24px;right:50%;top:3px;bottom:3px;
        background:repeating-linear-gradient(
          0deg,
          #000000 0px,#000000 1px,
          #ffffff 1px,#ffffff 3px
        );
      "></div>
      <!-- 横縞パターン（右半分） -->
      <div style="
        position:absolute;left:50%;right:8px;top:3px;bottom:3px;
        background:repeating-linear-gradient(
          0deg,
          #000000 0px,#000000 1px,
          #ffffff 1px,#ffffff 3px
        );
      "></div>
      <!-- クローズボックス（System 7: 11×11, 白背景, ×シンボル付き） -->
      <div style="
        position:absolute;left:8px;top:50%;transform:translateY(-50%);
        width:11px;height:11px;
        border:1px solid #000000;
        background:#ffffff;
        display:flex;align-items:center;justify-content:center;
        font-size:9px;line-height:1;font-family:sans-serif;color:#000000;
      ">\u00d7</div>
      <!-- タイトルテキスト（白背景帯で縞を遮る） -->
      <span style="
        background:#ffffff;
        padding:0 6px;
        font-size:12px;
        white-space:nowrap;
        font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;
        color:#000000;
        position:relative;
        z-index:1;
        line-height:19px;
      ">Welcome to the inryok\u00fc</span>
    </div>

    <!-- コンテンツエリア -->
    <div style="
      background:#ffffff;
      padding:18px 24px 20px;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:12px;
    ">

      <!-- iアイコン + 軌道 -->
      <div>
        <svg id="orbit-svg" width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="orbGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <circle cx="80" cy="80" r="58" fill="none" stroke="#000000" stroke-width="0.5" stroke-dasharray="3 4"/>
          <!-- 上から時計回り: Cyan Green Blue Magenta Red Yellow (CMY+RGB交互) -->
          <circle id="px0" r="4" fill="#00FFFF" filter="url(#orbGlow)"/>
          <circle id="px1" r="4" fill="#00FF00" filter="url(#orbGlow)"/>
          <circle id="px2" r="4" fill="#0000FF" filter="url(#orbGlow)"/>
          <circle id="px3" r="4" fill="#FF00FF" filter="url(#orbGlow)"/>
          <circle id="px4" r="4" fill="#FF0000" filter="url(#orbGlow)"/>
          <circle id="px5" r="4" fill="#FFFF00" filter="url(#orbGlow)"/>
          <!-- iアイコン: 黒枠・白背景の円 -->
          <circle cx="80" cy="80" r="36" fill="#ffffff" stroke="#000000" stroke-width="2"/>
          <!-- i の点 -->
          <circle cx="80" cy="65" r="4" fill="#000000"/>
          <!-- i の縦棒 -->
          <rect x="77" y="74" width="6" height="17" fill="#000000"/>
        </svg>
      </div>

      <hr class="mac-divider"/>

      <!-- visitor counter (typewriter) -->
      <p id="p0-hello-line" style="font-size:12px;color:#000000;margin:0;font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;text-align:center;">
        <span id="p0-hello-text"></span><span style="animation:cursorBlink 1s step-end infinite;font-weight:normal;">&#9646;</span>
      </p>

      <hr class="mac-divider"/>

      <!-- Newton quote -->
      <p style="
        font-size:10px;color:#000000;margin:0;
        text-align:center;line-height:1.8;
        font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;
        max-width:380px;
      ">
        \u201CCogitamus, ergo sumus.\u201D<br>
        <span style="font-size:9px;letter-spacing:1px;">\u2014 R. Descartes, 1637 (reimagined)</span>
      </p>

      <hr class="mac-divider"/>

      <!-- ボタンエリア（System 7: 右下寄せ） -->
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;width:100%;padding-top:2px;">
        <a href="#" onclick="event.preventDefault();"
           style="font-size:10px;color:#000000;text-decoration:underline;
                  font-family:'ChicagoFLF', 'Geneva', 'Lucida Grande', Helvetica, sans-serif;">
          Skip to Shop
        </a>
        <button id="evolve-btn" class="p0-disabled" disabled>ENTER</button>
      </div>

    </div>
  </div>
</div>`;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  P0 起動シーケンス
    //  FLYING   = 波動状態 div、画面端→ダイアログ枠（easeOut）
    //  FLASH    = ダイアログ枠フラッシュ → フラット円に結晶化
    //  GLIDING  = ダイアログ内をゆっくり i-dot へ
    //  WAITING  = i-dotに静止（次の球の吸収待ち）
    //  ABSORBING= i-dotに吸い込まれる（C→M→Y→R→G→B順）
    //  EXPLODING= SVG circle が i-dot から軌道へ弾け飛ぶ
    //  ORBITING = SVG circle が軌道周回
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    (function(){
        const SVG_CX=80, SVG_CY=80, ORBIT_R=58;
        const I_DOT_X=80, I_DOT_Y=65;
        const orbitSvg=document.getElementById('orbit-svg');
        const els=[0,1,2,3,4,5].map(i=>document.getElementById('px'+i));

        const FLY_ORDER  =[0,3,5,4,1,2]; // C→M→Y→R→G→B
        const LAUNCH_INTV=0.80;
        const FLIGHT_DUR =1.80;
        const FLASH_DUR  =0.30;
        const GLIDE_DUR  =1.80;
        /* const ABSORB_DUR =0.35; */
        const ABSORB_DUR =0.50;
        const ABSORB_INTV=0.40;
        const EXPLODE_DUR=0.45;

        const CFG=[
            {edge:'left',        bx:0.0,by:0.5,ctrl: 1,rgb:[0,255,255],  noteHz:220.00,noteType:'triangle'},
            {edge:'right',       bx:1.0,by:0.5,ctrl:-1,rgb:[0,255,0],    noteHz:554.37,noteType:'sine'},
            {edge:'top-right',   bx:0.8,by:0.0,ctrl: 1,rgb:[0,0,255],    noteHz:659.25,noteType:'sine'},
            {edge:'top-left',    bx:0.2,by:0.0,ctrl:-1,rgb:[255,0,255],  noteHz:261.63,noteType:'triangle'},
            {edge:'bottom-left', bx:0.2,by:1.0,ctrl:-1,rgb:[255,0,0],    noteHz:440.00,noteType:'sine'},
            {edge:'bottom-right',bx:0.8,by:1.0,ctrl: 1,rgb:[255,255,0],  noteHz:329.63,noteType:'triangle'},
        ];
        CFG.forEach(c=>{
            c.phase='idle'; c.phaseStartAt=null;
            c.p0x=0;c.p0y=0;c.p1x=0;c.p1y=0;c.p2x=0;c.p2y=0;
            c.glideFromX=0;c.glideFromY=0;c.glideToX=0;c.glideToY=0;
        });

        const waveDivs=CFG.map(()=>{
            const d=document.createElement('div');
            d.className='p0-wave-ball';
            document.body.appendChild(d);
            return d;
        });

        let orbitAngle=-Math.PI/2;
        let seqStartMs=null, seqStep=0;
        let absorbStep=0, absorbWaitUntil=0, allWaiting=false;
        let chordDone=false;
        let idotScrX=0, idotScrY=0;

        els.forEach(el=>{if(el){el.setAttribute('r','0');el.setAttribute('opacity','0');}});

        function lerp(a,b,t){return a+(b-a)*t;}
        function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
        function easeOut3(t){return 1-Math.pow(1-t,3);}
        function easeIn3(t){return Math.pow(t,3);}
        function bezier2(t,ax,ay,bx,by,cx,cy){
            const u=1-t;
            return[u*u*ax+2*u*t*bx+t*t*cx, u*u*ay+2*u*t*by+t*t*cy];
        }

        // ── リバーブ＋コンプレッサー（遅延初期化）──
        let _reverb=null, _comp=null;
        function getAudioChain(){
            if(_reverb) return {reverb:_reverb};
            const sr=audioContext.sampleRate;
            const buf=audioContext.createBuffer(2,sr*2.5,sr);
            for(let ch=0;ch<2;ch++){
                const d=buf.getChannelData(ch);
                for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.8);
            }
            _reverb=audioContext.createConvolver(); _reverb.buffer=buf;
            _comp=audioContext.createDynamicsCompressor();
            _comp.threshold.value=-14; _comp.knee.value=6;
            _comp.ratio.value=3; _comp.attack.value=0.004; _comp.release.value=0.15;
            _reverb.connect(_comp); _comp.connect(audioContext.destination);
            return {reverb:_reverb};
        }

        function playNote(cfg){
            if(!audioContext||audioContext.state!=='running') return;
            try{
                const {reverb}=getAudioChain();
                const t=audioContext.currentTime;
                const osc=audioContext.createOscillator(), g=audioContext.createGain();
                osc.connect(g); g.connect(audioContext.destination); g.connect(reverb);
                osc.type=cfg.noteType; osc.frequency.value=cfg.noteHz;
                g.gain.setValueAtTime(0.30,t);
                g.gain.exponentialRampToValueAtTime(0.0001,t+2.2);
                osc.start(t); osc.stop(t+2.2);
                const osc2=audioContext.createOscillator(), g2=audioContext.createGain();
                osc2.connect(g2); g2.connect(reverb);
                osc2.type='sine'; osc2.frequency.value=cfg.noteHz*2;
                g2.gain.setValueAtTime(0.10,t);
                g2.gain.exponentialRampToValueAtTime(0.0001,t+1.5);
                osc2.start(t); osc2.stop(t+1.5);
            }catch(e){}
        }

        function playGreyChord(){
            if(!audioContext||audioContext.state!=='running') return;
            try{
                const {reverb}=getAudioChain();
                [220.00,261.63,329.63,440.00,554.37,659.25].forEach(freq=>{
                    const osc=audioContext.createOscillator(), g=audioContext.createGain();
                    osc.connect(g); g.connect(audioContext.destination); g.connect(reverb);
                    osc.type='sine'; osc.frequency.value=freq;
                    const t=audioContext.currentTime;
                    /* g.gain.setValueAtTime(0.14,t); */
                    g.gain.setValueAtTime(0.20,t);
                    g.gain.exponentialRampToValueAtTime(0.0001,t+2.5);
                    osc.start(t); osc.stop(t+2.5);
                });
            }catch(e){}
        }

        function tick(){
            orbitAngle+=0.008;
            const nowMs=performance.now();
            if(seqStartMs===null){requestAnimationFrame(tick);return;}
            const elapsed=(nowMs-seqStartMs)/1000;

            // 順次発射
            if(seqStep<6 && elapsed>=seqStep*LAUNCH_INTV){
                const bi=FLY_ORDER[seqStep];
                if(CFG[bi].phase==='idle'){CFG[bi].phase='flying';CFG[bi].phaseStartAt=elapsed;seqStep++;}
            }
            // 全球waiting後に順次吸収
            if(!allWaiting && CFG.every(c=>c.phase==='waiting'||c.phase==='absorbing'||c.phase==='exploding'||c.phase==='orbiting')){
                allWaiting=true; absorbWaitUntil=elapsed;
            }
            if(allWaiting && absorbStep<6){
                const bi=FLY_ORDER[absorbStep];
                if(CFG[bi].phase==='waiting' && elapsed>=absorbWaitUntil){
                    CFG[bi].phase='absorbing'; CFG[bi].phaseStartAt=elapsed;
                    playNote(CFG[bi]); absorbStep++;
                    absorbWaitUntil=elapsed+ABSORB_DUR+ABSORB_INTV;
                }
            }
            // グレーコード + 虹フラッシュ + ENTERボタン有効化
            if(!chordDone && CFG.every(c=>c.phase==='orbiting')){
                chordDone=true;
                // グレーコード和音（C4+E4+G4+A4, sine, 2秒減衰）
                (function(){
                    if(window._inryokuMuted||!audioContext||audioContext.state!=='running') return;
                    try{
                        var freqs=[261.63,329.63,392.00,440.00]; // C4,E4,G4,A4
                        var t0=audioContext.currentTime;
                        freqs.forEach(function(freq){
                            var osc=audioContext.createOscillator(),g=audioContext.createGain();
                            osc.connect(g);g.connect(audioContext.destination);
                            osc.type='sine';osc.frequency.value=freq;
                            g.gain.setValueAtTime(0.15,t0);
                            g.gain.exponentialRampToValueAtTime(0.0001,t0+2.0);
                            osc.start(t0);osc.stop(t0+2.0);
                        });
                    }catch(e){}
                })();
                // 旧playGreyChordも鳴らす
                playGreyChord();
                // 虹フラッシュ（ダイアログ背景を0.15秒だけ虹色に）
                var dlg=document.getElementById('mac-dialog');
                if(dlg){
                    var origBg=dlg.style.background||'#ffffff';
                    dlg.style.background='linear-gradient(135deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff)';
                    setTimeout(function(){dlg.style.background=origBg;},150);
                }
                // ENTERボタン有効化 + 緑グロー
                var btn=document.getElementById('evolve-btn');
                if(btn){
                    btn.disabled=false;
                    btn.classList.remove('p0-disabled');
                    btn.style.boxShadow='0 0 0 1px #000000, inset 0 0 0 1px #000000, 0 0 12px #00ff44';
                }
            }

            CFG.forEach((cfg,i)=>{
                const el=els[i], div=waveDivs[i];
                if(!el) return;
                const [r,g,b]=cfg.rgb;
                const cs=`rgb(${r},${g},${b})`;
                const orbitA=orbitAngle+(i*Math.PI*2/6);
                const orbitX=SVG_CX+ORBIT_R*Math.cos(orbitA);
                const orbitY=SVG_CY+ORBIT_R*Math.sin(orbitA);

                if(cfg.phase==='idle'){div.style.opacity='0';return;}
                const t=cfg.phaseStartAt!==null?elapsed-cfg.phaseStartAt:0;

                if(cfg.phase==='flying'){
                    const tN=clamp(t/FLIGHT_DUR,0,1);
                    const te=easeOut3(tN);
                    const [bx,by]=bezier2(te,cfg.p0x,cfg.p0y,cfg.p1x,cfg.p1y,cfg.p2x,cfg.p2y);
                    const pulse=0.5+0.5*Math.sin(nowMs*0.004+i*1.1);
                    const radius=26+pulse*18;
                    div.style.transform='translate('+(bx-radius)+'px,'+(by-radius)+'px)';
                    div.style.width=(radius*2)+'px';div.style.height=(radius*2)+'px';
                    div.style.background=`radial-gradient(circle,rgba(${r},${g},${b},0.95) 0%,rgba(${r},${g},${b},0.55) 30%,rgba(${r},${g},${b},0.18) 58%,transparent 78%)`;
                    div.style.filter=`blur(2px) drop-shadow(0 0 ${12+pulse*8}px rgba(${r},${g},${b},0.7))`;
                    div.style.opacity=clamp(t/0.20,0,1).toString();
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(tN>=1.0){cfg.phase='flash';cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='flash'){
                    const fp=clamp(t/FLASH_DUR,0,1);
                    if(fp<0.28){
                        const ex=fp/0.28;
                        const fSz=60+ex*60;
                        div.style.transform='translate('+(cfg.p2x-fSz/2)+'px,'+(cfg.p2y-fSz/2)+'px)';
                        div.style.width=fSz+'px';div.style.height=fSz+'px';
                        div.style.background=`radial-gradient(circle,rgba(255,255,255,0.96) 0%,rgba(255,255,255,0.35) 55%,transparent 78%)`;
                        div.style.filter='blur(2px)';div.style.opacity='1';
                    }else{
                        const sp=easeOut3((fp-0.28)/0.72);
                        const cr=lerp(60,5,sp);
                        div.style.transform='translate('+(cfg.p2x-cr)+'px,'+(cfg.p2y-cr)+'px)';
                        div.style.width=(cr*2)+'px';div.style.height=(cr*2)+'px';
                        div.style.background=cs;
                        div.style.filter=`blur(${lerp(2,0,sp)}px) drop-shadow(0 0 ${lerp(4,10,sp)}px ${cs})`;
                        div.style.opacity='1';
                    }
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(fp>=1.0){cfg.phase='gliding';cfg.glideFromX=cfg.p2x;cfg.glideFromY=cfg.p2y;cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='gliding'){
                    const gp=clamp(t/GLIDE_DUR,0,1);
                    const ge=easeOut3(gp);
                    const gx=lerp(cfg.glideFromX,cfg.glideToX,ge);
                    const gy=lerp(cfg.glideFromY,cfg.glideToY,ge);
                    const gSz=lerp(12,8,ge);
                    div.style.transform='translate('+(gx-gSz/2)+'px,'+(gy-gSz/2)+'px)';
                    div.style.width=gSz+'px';div.style.height=gSz+'px';
                    div.style.background=`radial-gradient(circle,${cs} 0%,transparent 70%)`;
                    div.style.filter=`drop-shadow(0 0 ${lerp(14,8,ge)}px ${cs})`;
                    div.style.opacity='1';
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(gp>=1.0){cfg.phase='waiting';cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='waiting'){
                    const isNext=FLY_ORDER[absorbStep]===i;
                    const wPulse=0.7+0.3*Math.sin(nowMs*0.006+i*0.9);
                    div.style.transform='translate('+(idotScrX-5)+'px,'+(idotScrY-5)+'px)';
                    div.style.width='10px';div.style.height='10px';
                    div.style.background=`radial-gradient(circle,${cs} 0%,transparent 70%)`;
                    div.style.filter=`drop-shadow(0 0 ${8*wPulse}px ${cs})`;
                    div.style.opacity=isNext?(0.8+0.2*wPulse).toString():'0';
                    el.setAttribute('r','0');el.setAttribute('opacity','0');

                }else if(cfg.phase==='absorbing'){
                    const ap=clamp(t/ABSORB_DUR,0,1);
                    let sz,opacity,glow;
                    if(ap<0.20){
                        const bulge=ap/0.20;
                        sz=lerp(10,18,bulge);opacity=1.0;glow=lerp(8,16,bulge);
                    }else{
                        const pull=easeIn3((ap-0.20)/0.80);
                        sz=lerp(18,0,pull);opacity=lerp(1.0,0,pull);glow=lerp(16,30,pull);
                    }
                    div.style.transform='translate('+(idotScrX-sz/2)+'px,'+(idotScrY-sz/2)+'px)';
                    div.style.width=sz+'px';div.style.height=sz+'px';
                    div.style.background=`radial-gradient(circle,${cs} 0%,rgba(255,255,255,0.4) 30%,transparent 65%)`;
                    div.style.filter=`drop-shadow(0 0 ${glow}px ${cs})`;
                    div.style.opacity=opacity.toString();
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(ap>=1.0){
                        cfg.phase='exploding';cfg.phaseStartAt=elapsed;
                        div.style.opacity='0';
                        el.setAttribute('cx',I_DOT_X.toString());el.setAttribute('cy',I_DOT_Y.toString());
                        el.setAttribute('r','0');el.setAttribute('opacity','0');
                    }

                }else if(cfg.phase==='exploding'){
                    const ep=clamp(t/EXPLODE_DUR,0,1);
                    div.style.opacity='0';
                    if(ep<0.10){
                        el.setAttribute('r',lerp(3,22,ep/0.10).toString());
                        el.setAttribute('fill','#ffffff');
                        el.setAttribute('cx',I_DOT_X.toString());el.setAttribute('cy',I_DOT_Y.toString());
                        el.setAttribute('opacity','1');
                    }else{
                        const fp2=easeOut3((ep-0.10)/0.90);
                        el.setAttribute('cx',lerp(I_DOT_X,orbitX,fp2).toString());
                        el.setAttribute('cy',lerp(I_DOT_Y,orbitY,fp2).toString());
                        el.setAttribute('r',lerp(22,4,fp2).toString());
                        el.setAttribute('fill',cs);
                        el.setAttribute('opacity','1');
                    }
                    if(ep>=1.0){cfg.phase='orbiting';}

                }else if(cfg.phase==='orbiting'){
                    el.setAttribute('cx',orbitX.toString());el.setAttribute('cy',orbitY.toString());
                    el.setAttribute('r','4');el.setAttribute('fill',cs);el.setAttribute('opacity','1');
                    div.style.opacity='0';
                }
            });
            requestAnimationFrame(tick);
        }

        window._p0StartFlyIn=function(){
            const dialogEl=document.getElementById('mac-dialog');
            const svgRect=orbitSvg.getBoundingClientRect();
            const dialogRect=dialogEl?dialogEl.getBoundingClientRect():svgRect;
            const vw=window.innerWidth, vh=window.innerHeight;
            idotScrX=svgRect.left+(I_DOT_X/160)*svgRect.width;
            idotScrY=svgRect.top +(I_DOT_Y/160)*svgRect.height;
            function edgePt(edge){
                switch(edge){
                    case 'left':        return{x:0,     y:dialogRect.top+dialogRect.height*0.45};
                    case 'right':       return{x:vw,    y:dialogRect.top+dialogRect.height*0.45};
                    case 'top-left':    return{x:vw*0.15,y:0};
                    case 'top-right':   return{x:vw*0.85,y:0};
                    case 'bottom-left': return{x:vw*0.15,y:vh};
                    case 'bottom-right':return{x:vw*0.85,y:vh};
                    default:            return{x:vw/2,  y:0};
                }
            }
            CFG.forEach((cfg,i)=>{
                const ep=edgePt(cfg.edge);
                cfg.p2x=dialogRect.left+cfg.bx*dialogRect.width;
                cfg.p2y=dialogRect.top +cfg.by*dialogRect.height;
                cfg.p0x=ep.x;cfg.p0y=ep.y;
                const midX=(ep.x+cfg.p2x)/2, midY=(ep.y+cfg.p2y)/2;
                const dx=cfg.p2x-ep.x, dy=cfg.p2y-ep.y;
                const len=Math.sqrt(dx*dx+dy*dy)||1;
                const off=130+i*22;
                cfg.p1x=midX+(-dy/len)*off*cfg.ctrl;
                cfg.p1y=midY+(dx/len) *off*cfg.ctrl;
                cfg.glideToX=idotScrX;cfg.glideToY=idotScrY;
                cfg.phase='idle';cfg.phaseStartAt=null;
                waveDivs[i].style.opacity='0';
                const el=els[i];if(el){el.setAttribute('r','0');el.setAttribute('opacity','0');}
            });
            chordDone=false;seqStep=0;allWaiting=false;absorbStep=0;absorbWaitUntil=0;
            seqStartMs=performance.now();
        };

        document.addEventListener('click',function onEnterCleanup(e){
            if(e.target&&e.target.id==='evolve-btn'){
                waveDivs.forEach(d=>{if(d.parentNode)d.parentNode.removeChild(d);});
                document.removeEventListener('click',onEnterCleanup);
            }
        });

        requestAnimationFrame(tick);
    })();
    setTimeout(()=>{if(window._p0StartFlyIn)window._p0StartFlyIn();},150);

    // ── P0 Hello. タイプライター演出 ──
    (function(){
        var helloStr='Hello.';
        var helloEl=document.getElementById('p0-hello-text');
        if(!helloEl)return;
        var hi=0;
        function typeClickSound(){
            if(window._inryokuMuted)return;
            if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return;}}
            if(audioContext.state==='suspended')audioContext.resume();
            try{
                var t=audioContext.currentTime;
                var osc=audioContext.createOscillator();
                var g=audioContext.createGain();
                osc.connect(g);g.connect(audioContext.destination);
                osc.type='square';
                osc.frequency.value=800+Math.random()*400; // 800-1200Hz
                g.gain.setValueAtTime(0.08,t);
                g.gain.exponentialRampToValueAtTime(0.0001,t+0.025); // ~25ms
                osc.start(t);osc.stop(t+0.03);
            }catch(e){}
        }
        function typeNext(){
            if(hi>=helloStr.length)return;
            helloEl.textContent+=helloStr[hi];
            typeClickSound();
            hi++;
            if(hi<helloStr.length)setTimeout(typeNext,100+Math.random()*60);
        }
        setTimeout(typeNext,400);
    })();

    // ── Win95 起動音（Web Audio API） Step 3 ──
    // G4→C5→E5→G5 4音メロディ（triangle波・FM合成風）
    function playWin95StartupSound() {
        if (window._inryokuMuted) return;
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
        if (window._inryokuMuted) return;
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
        // Mac click sound（カチッ）
        if (!window._inryokuMuted) try {
            const actx = new (window.AudioContext || window.webkitAudioContext)();
            const clickOsc = actx.createOscillator();
            const clickGain = actx.createGain();
            clickOsc.connect(clickGain);
            clickGain.connect(actx.destination);
            clickOsc.type = 'square';
            clickOsc.frequency.setValueAtTime(1200, actx.currentTime);
            clickOsc.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.03);
            clickGain.gain.setValueAtTime(0.3, actx.currentTime);
            clickGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.06);
            clickOsc.start(actx.currentTime);
            clickOsc.stop(actx.currentTime + 0.06);
        } catch(e) {}

        // P0→P1 CRTオフ演出（画面が中央の細い線に収縮→消滅）
        const crtOverlay = document.createElement('div');
        crtOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;z-index:99999;pointer-events:all;opacity:0;';
        document.body.appendChild(crtOverlay);
        // Step 1: 白フラッシュ (0→80ms)
        crtOverlay.offsetWidth;
        crtOverlay.style.transition = 'opacity 0.08s ease-out';
        crtOverlay.style.opacity = '1';

        setTimeout(() => {
            // Step 2: CRT collapse — 画面がY方向に潰れて中央の白い線になる (80→500ms)
            crtOverlay.style.background = '#000';
            crtOverlay.style.opacity = '1';
            const crtLine = document.createElement('div');
            crtLine.style.cssText = 'position:fixed;left:0;right:0;top:50%;height:100vh;background:#fff;z-index:100000;transform:translateY(-50%);transition:height 0.4s cubic-bezier(0.7,0,1,0.5);pointer-events:none;';
            document.body.appendChild(crtLine);
            crtLine.offsetWidth;
            crtLine.style.height = '2px';

            setTimeout(() => {
                // Step 3: 白い線が消える (500→700ms)
                crtLine.style.transition = 'opacity 0.2s ease-out, width 0.2s ease-in';
                crtLine.style.opacity = '0';
                crtLine.style.width = '60%';
                crtLine.style.left = '20%';
            }, 420);

            setTimeout(() => {
                // Step 4: 完全暗転、CRT要素除去
                crtLine.remove();
                crtOverlay.style.background = '#000';
            }, 650);
        }, 80);

        // Win95 startup sound — plays when P1 begins (delayed for CRT effect)
        setTimeout(() => { playWin95StartupSound(); }, 500);

        setTimeout(() => {
        // CRTオーバーレイ除去
        crtOverlay.remove();
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
        renderer.setClearColor(0x008080, 1); // Win95 default teal desktop
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
        //  POST-PROCESSING: Bloom only (masking via scissor)
        // ══════════════════════════════════════════════════════
        let composer = null, bloom = null, caPass = null;
        // Scissor rect for square clipping (GL coords: origin at bottom-left)
        const scissor = {
            x: 0,
            y: 0,
            w: sqPx,
            h: sqPx,
            enabled: true
        };
        try {
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(new THREE.RenderPass(scene, camera));
            bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.4, 0.35, 0.08);
            composer.addPass(bloom);
            // Chromatic Aberration pass (RGB channel split — EVENT_SING衝突時に発火)
            if (THREE.ShaderPass) {
                caPass = new THREE.ShaderPass({
                    uniforms: {
                        tDiffuse: { value: null },
                        u_ca: { value: 0.0 }  // 0=なし, 0.04=強烈な分離
                    },
                    vertexShader: [
                        'varying vec2 vUv;',
                        'void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
                    ].join('\n'),
                    fragmentShader: [
                        'uniform sampler2D tDiffuse;',
                        'uniform float u_ca;',
                        'varying vec2 vUv;',
                        'void main(){',
                        '  float r = texture2D(tDiffuse, vUv + vec2(u_ca, 0.0)).r;',
                        '  float g = texture2D(tDiffuse, vUv).g;',
                        '  float b = texture2D(tDiffuse, vUv - vec2(u_ca, 0.0)).b;',
                        '  gl_FragColor = vec4(r, g, b, 1.0);',
                        '}'
                    ].join('\n')
                });
                caPass.uniforms.u_ca.value = 0.0;
                composer.addPass(caPass);
            }
        } catch (e) { }

        // ══════════════════════════════════════════════════════
        //  UI OVERLAY (HTML/CSS)
        // ══════════════════════════════════════════════════════
        const ldCSS = document.createElement('style');
        ldCSS.textContent = '@keyframes p1In{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes p1Breathe{0%,100%{opacity:.85;filter:drop-shadow(0 0 12px rgba(255,255,255,.12))}50%{opacity:1;filter:drop-shadow(0 0 24px rgba(255,255,255,.25))}}@keyframes p1BarGlow{0%,100%{box-shadow:0 0 6px rgba(255,255,255,.06)}50%{box-shadow:0 0 14px rgba(255,255,255,.14)}}@keyframes p1Slide{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes p1Sq{0%,100%{border-color:rgba(255,255,255,.1);box-shadow:0 0 12px rgba(255,255,255,.03)}50%{border-color:rgba(255,255,255,.22);box-shadow:0 0 24px rgba(255,255,255,.07)}}.p1-orb{position:absolute;border-radius:50%;filter:blur(100px);opacity:.03;pointer-events:none}/* runBob removed — sprite frames handle vertical motion */@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes enterGlow{0%,100%{filter:drop-shadow(0 0 6px #00ff00) drop-shadow(0 0 12px rgba(0,255,0,0.4))}50%{filter:drop-shadow(0 0 10px #00ff00) drop-shadow(0 0 22px rgba(0,255,0,0.65)) drop-shadow(0 0 36px rgba(0,255,0,0.25))}}@keyframes exitPulse{0%,100%{filter:drop-shadow(0 0 6px #00ff44) drop-shadow(0 0 14px rgba(0,255,68,0.5));transform:scale(1)}50%{filter:drop-shadow(0 0 14px #00ff44) drop-shadow(0 0 28px rgba(0,255,68,0.7)) drop-shadow(0 0 44px rgba(0,255,68,0.3));transform:scale(1.04)}}@keyframes runnerExit{0%{transform:translateX(-10px) scale(1);opacity:1}50%{transform:translateX(4px) scale(0.6);opacity:0.7}100%{transform:translateX(10px) scale(0);opacity:0}}';
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
  .win95-menu-item:hover { background:#000080; color:#ffffff; }
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
  <div style="background:#c0c0c0;
    border-top:2px solid #ffffff;border-left:2px solid #ffffff;
    border-right:2px solid #404040;border-bottom:2px solid #404040;
    padding:2px 6px;font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;font-weight:bold;color:#000;
    display:flex;align-items:center;gap:3px;cursor:pointer;" id="win95-start-btn">
    <!-- Win95 4-color Windows logo -->
    <svg id="win95-start-logo" width="14" height="14" viewBox="0 0 14 14" style="image-rendering:pixelated;">
      <rect x="1" y="1" width="5" height="5" fill="#FF0000"/>
      <rect x="8" y="1" width="5" height="5" fill="#00FF00"/>
      <rect x="1" y="8" width="5" height="5" fill="#0000FF"/>
      <rect x="8" y="8" width="5" height="5" fill="#FFFF00"/>
    </svg> <span id="win95-start-text">Start</span>
  </div>
  <div style="width:2px;height:20px;border-left:1px solid #808080;border-right:1px solid #ffffff;margin:0 2px;"></div>
  <div style="background:#c0c0c0;
    border-top:2px solid #808080;border-left:2px solid #808080;
    border-right:2px solid #ffffff;border-bottom:2px solid #ffffff;
    padding:2px 8px;font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;
    color:#000;font-weight:bold;min-width:160px;">
    inryokü — Loading Reality
  </div>
  <div style="flex:1;"></div>
  <div style="
    border-top:2px solid #808080;border-left:2px solid #808080;
    border-right:2px solid #ffffff;border-bottom:2px solid #ffffff;
    padding:1px 8px;font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;
    color:#000;background:#c0c0c0;" id="win95-clock">
    ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2,'0')}
  </div>
</div>

<div id="win95-main" style="position:absolute;left:${winLeft}px;top:${winTop}px;width:${winWidth}px;height:${winHeight}px;z-index:10;opacity:1;outline:1px solid #000000;border-top:2px solid #ffffff;border-left:2px solid #ffffff;border-right:2px solid #808080;border-bottom:2px solid #808080;display:flex;flex-direction:column;overflow:hidden;">

  <!-- タイトルバー -->
  <div style="
    height:24px;min-height:24px;
    background:linear-gradient(to right,#000080,#1084d0);
    padding:0 3px;
    display:flex;align-items:center;justify-content:space-between;
  ">
    <div style="display:flex;align-items:center;gap:4px;">
      <!-- Win95-style 16x16 ISO 7010 exit icon -->
      <svg width="16" height="16" viewBox="0 0 16 16" style="image-rendering:pixelated;">
        <rect width="16" height="16" rx="1" fill="#009a44"/>
        <rect x="0.5" y="0.5" width="15" height="15" rx="1" fill="#00a84c"/>
        <!-- ドア -->
        <rect x="11" y="2" width="4" height="10" fill="#fff"/>
        <!-- 頭 -->
        <circle cx="7.5" cy="3" r="1.5" fill="#fff"/>
        <!-- 胴体 -->
        <rect x="6.5" y="4.5" width="2" height="5" rx="0.5" fill="#fff" transform="rotate(-8 7.5 7)"/>
        <!-- 前腕 -->
        <line x1="8" y1="5.5" x2="11" y2="4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        <!-- 後腕 -->
        <line x1="7" y1="6" x2="4.5" y2="7.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        <!-- 前脚 -->
        <line x1="8" y1="9" x2="11" y2="13" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
        <!-- 後脚 -->
        <line x1="7" y1="9" x2="4" y2="13" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      <span style="color:white;font-size:11px;font-weight:bold;
        font-family:'MS Sans Serif',Arial,sans-serif;letter-spacing:0;">
        inryokü — Loading Reality
      </span>
    </div>
    <div style="display:flex;gap:2px;">
      <div style="width:16px;height:14px;background:#c0c0c0;
        border-top:2px solid #ffffff;border-left:2px solid #ffffff;
        border-right:2px solid #404040;border-bottom:2px solid #404040;
        font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'Marlett','MS Sans Serif',Arial,sans-serif;line-height:1;">_</div>
      <div style="width:16px;height:14px;background:#c0c0c0;
        border-top:2px solid #ffffff;border-left:2px solid #ffffff;
        border-right:2px solid #404040;border-bottom:2px solid #404040;
        font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'Marlett','MS Sans Serif',Arial,sans-serif;line-height:1;">□</div>
      <div style="width:16px;height:14px;background:#c0c0c0;
        border-top:2px solid #ffffff;border-left:2px solid #ffffff;
        border-right:2px solid #404040;border-bottom:2px solid #404040;
        font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;
        cursor:pointer;color:#000;font-family:'Marlett','MS Sans Serif',Arial,sans-serif;line-height:1;">✕</div>
    </div>
  </div>

  <!-- メニューバー -->
  <div style="background:#c0c0c0;height:20px;display:flex;align-items:center;padding:0 2px;gap:0;
    border-bottom:1px solid #808080;">
    <div class="win95-menu-item" style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>F</u>ile</div>
    <div class="win95-menu-item" style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>E</u>dit</div>
    <div class="win95-menu-item" style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>V</u>iew</div>
    <div class="win95-menu-item" style="font-size:11px;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;
      padding:1px 6px;cursor:default;"><u>H</u>elp</div>
  </div>

  <!-- ヘッダーエリア（アイコン＋テキスト＋バー＋ステータス） -->
  <div style="background:#c0c0c0;">
  <div style="padding:8px 12px 6px 12px;display:flex;align-items:center;gap:14px;">
    <div id="ld-logo" style="width:72px;height:72px;max-width:72px;max-height:72px;animation:exitPulse 2s ease-in-out infinite;flex-shrink:0;">
      <!-- ISO 7010 E002 非常口ピクトグラム — Wikimedia Commons Public Domain SVG -->
      <svg viewBox="0 0 560 560" style="width:72px;height:72px;display:block;">
        <path fill="#00AF6B" d="M 490.00847,426.30353 476.01016,389.202 c -6.29359,-15.40393 -20.29754,-25.90277 -37.80672,-25.90277 h -6.29359 V 43.395188 H 128.10708 V 220.49813 h 39.90082 l 45.50014,-56.705 c 9.10455,-10.49319 23.09721,-17.50371 38.49535,-17.50371 h 97.30516 c 15.39814,0 28.69653,8.39343 35.69568,21.70324 l 28.70782,54.59395 c 1.39983,2.09977 2.0941,4.9051 2.0941,8.40471 0,9.79327 -8.39898,18.19234 -18.20344,18.19234 -7.69907,0 -13.29275,-3.49397 -16.80361,-9.79327 l -25.89123,-49.70013 h -42.00056 l 32.1961,80.50236 9.80446,102.89424 h 83.28993 c 13.30968,0 23.80841,8.40471 28.70782,19.60911 l 9.0989,23.79736 H 333.19921 c -10.48744,0 -19.59763,-7.6935 -20.2919,-18.19798 l -9.80446,-90.30128 -76.99069,159.59924 c -4.20513,9.10464 -14.00395,15.40394 -25.20259,15.40394 h -37.1068 l 94.5055,-195.30657 -29.3908,-73.4975 -28.0079,34.30185 c -6.99351,9.10463 -18.90901,15.39829 -31.50184,15.39829 h -41.295 v 231.00261 l 65.79768,65.09843 H 0 V 0 h 560 v 559.99436 h -63.00367 l -65.09212,-65.09843 v -68.5924 z M 228.20627,64.39286 c 21.70302,0 39.89517,18.203626 39.89517,39.90122 0,21.70324 -18.19215,39.2013 -39.89517,39.2013 -21.70302,0 -39.20655,-17.49806 -39.20655,-39.2013 0,-21.697594 17.50353,-39.90122 39.20655,-39.90122 M 245.70979,509.59994 296.10934,560 h -60.90957 l -65.79768,-65.10407 h 39.19526 c 14.00959,0 27.30798,5.60502 37.11244,14.70401"/>
      </svg>
    </div>
    <div>
      <div style="font-size:14px;font-weight:bold;font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;color:#000;letter-spacing:0.5px;">inryokü</div>
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
    overflow:visible;
    user-select:none;
    pointer-events:auto;
  ">
    <div id="p1-lb" style="
      width:0%;height:100%;
      background:repeating-linear-gradient(to right,#0000aa 0px,#0000aa 8px,#000044 8px,#000044 10px);
      pointer-events:none;
    "></div>
    <div id="drag-handle" style="
      width:2px;height:100%;
      background:#ffffff;
      position:absolute;top:0;left:0%;
      pointer-events:none;
    "></div>
    <!-- 非常口ランナー: 4フレームスプライト走りアニメーション -->
    <div id="exit-runner" style="
      position:absolute;
      bottom:2px;left:0;
      width:26px;height:34px;
      transform:translateX(-10px);
      transition:left 0.12s linear;
      z-index:3;
      pointer-events:none;
      filter:drop-shadow(0 0 4px rgba(0,204,68,0.6));
    ">
      <svg width="26" height="34" viewBox="0 0 26 34" style="overflow:visible;">
        <defs>
          <style>
            .rf{display:none}
            .rf.rf-active{display:block}
          </style>
        </defs>
        <!-- Frame 1: 右脚接地・左脚蹴り出し（重心低い） -->
        <g class="rf rf-active" id="rf1">
          <circle cx="14" cy="3.5" r="2.8" fill="#00dd55"/>
          <path d="M13,6.5 L11.5,15" stroke="#00dd55" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M12.5,9 L17,6.5" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M12.5,9.5 L8,12" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M11.5,15 L16,21 L18,27" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M11.5,15 L7,20 L4,21" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        </g>
        <!-- Frame 2: 両脚交差・体が浮く（重心高い） -->
        <g class="rf" id="rf2">
          <circle cx="14" cy="2" r="2.8" fill="#00dd55"/>
          <path d="M13.5,5 L12,14" stroke="#00dd55" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M13,8 L9,6" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M13,8.5 L17,10.5" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M12,14 L14,20 L13,25" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M12,14 L10,19 L9,25" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        </g>
        <!-- Frame 3: 左脚接地・右脚蹴り出し（重心低い、Frame1の鏡） -->
        <g class="rf" id="rf3">
          <circle cx="14" cy="3.5" r="2.8" fill="#00dd55"/>
          <path d="M13,6.5 L11.5,15" stroke="#00dd55" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M12.5,9 L8,6.5" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M12.5,9.5 L17,12" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M11.5,15 L7,21 L5,27" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M11.5,15 L16,20 L19,21" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        </g>
        <!-- Frame 4: 両脚交差・体が浮く 反対（重心高い、Frame2の鏡） -->
        <g class="rf" id="rf4">
          <circle cx="14" cy="2" r="2.8" fill="#00dd55"/>
          <path d="M13.5,5 L12,14" stroke="#00dd55" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M13,8 L17,6" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M13,8.5 L9,10.5" stroke="#00dd55" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M12,14 L10,20 L9,25" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M12,14 L14,19 L15,25" stroke="#00dd55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        </g>
      </svg>
    </div>
    <!-- ドア（右端、95%からフェードイン、101%で全開） -->
    <div id="exit-door" style="
      position:absolute;
      right:-1px;top:-4px;bottom:-2px;
      width:18px;
      background:linear-gradient(180deg,#00bb44 0%,#008833 100%);
      border:2px solid #00ff55;
      border-right:none;
      border-radius:2px 0 0 2px;
      opacity:0;
      transition:opacity 0.5s ease-in;
      z-index:2;
      pointer-events:none;
      box-shadow:0 0 8px rgba(0,255,85,0.3), inset 0 0 6px rgba(0,0,0,0.3);
    ">
      <div style="position:absolute;top:50%;right:3px;transform:translateY(-50%);width:3px;height:3px;background:#00ff55;border-radius:50%;box-shadow:0 0 3px #00ff55;"></div>
    </div>
  </div>

  <!-- ステータステキスト -->
  <div id="win95-status" style="
    font-size:11px;font-family:'MS Sans Serif',Arial,sans-serif;
    color:#444;text-align:left;letter-spacing:0;
    padding:0 12px 6px 12px;
  ">Initializing reality engine...</div>
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
    box-shadow:-6px 0 0 0 #c0c0c0, 6px 0 0 0 #c0c0c0, 0 6px 0 0 #c0c0c0;
  ">
  <!-- BACKUP: CSSグラデーションライン削除 → Three.js Newton's Ring に置き換え -->
  </div>

  <!-- Win95 sizing grip (bottom-right corner) -->
  <div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;overflow:hidden;">
    <div style="position:absolute;bottom:0;right:0;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
    <div style="position:absolute;bottom:0;right:4px;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
    <div style="position:absolute;bottom:4px;right:0;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
    <div style="position:absolute;bottom:0;right:8px;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
    <div style="position:absolute;bottom:4px;right:4px;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
    <div style="position:absolute;bottom:8px;right:0;border-right:2px solid #fff;border-bottom:2px solid #808080;width:4px;height:4px;"></div>
  </div>

</div>

<!-- Phase C プログレスバー (モダン、初期非表示) -->
<div id="phase-c-bar-wrap" style="
  display:none;
  position:fixed;
  bottom:36px;
  left:50%;
  transform:translateX(-50%);
  width:420px;
  z-index:100;
  pointer-events:none;
">
  <div style="
    font-size:10px;
    font-family:'Courier New',monospace;
    color:rgba(255,255,255,0.5);
    text-align:center;
    margin-bottom:6px;
    letter-spacing:0.1em;
  " id="phase-c-pct">LOADING REALITY... 50%</div>
  <div style="
    height:4px;
    background:rgba(255,255,255,0.08);
    border-radius:2px;
    overflow:hidden;
  ">
    <div id="phase-c-lb" style="
      width:50%;
      height:100%;
      background:linear-gradient(90deg,#00FFFF,#FF00FF,#FFFF00,#FF0000,#00FF00,#0000FF);
      background-size:400% 100%;
      animation:p1Slide 3s linear infinite;
      border-radius:2px;
    "></div>
  </div>
</div>
`;
        document.body.appendChild(wrap);

        // sq-borderのDOMRectからscissorを計算（GL座標系: 原点が左下）
        function updateScissorFromDOM() {
            const sqEl = document.getElementById('sq-border');
            if (sqEl) {
                const rect = sqEl.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return; // display:none時はスキップ
                scissor.x = Math.round(rect.left);
                scissor.y = Math.round(H - rect.bottom); // GLのyは下から
                scissor.w = Math.round(rect.width);
                scissor.h = Math.round(rect.height);
                // カメラのfrustumをコンテンツサイズに合わせる
                // sqWorldがコンテンツの「高さ」なので、それを基準にズーム
                const contentH = sqWorld / 2; // コンテンツの半分の高さ
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

        const bar = document.getElementById('p1-lb');
        const pct = document.getElementById('p1-lpct');
        const logoEl = document.getElementById('ld-logo');
        const barWrap = document.getElementById('bar-wrap');
        const sqBorder = document.getElementById('sq-border');

        // ── AUTO-TICK (自動進行) ──
        // NOTE: setInterval版は廃止（CLAUDE.md: setInterval+phase変数バグ）
        // → tick()内のrequestAnimationFrameで処理する（下記 AUTO_RATE 参照）

        // AUTO_RATE と EVENT_PHASES は PH 定義後に初期化（下方 line ~2058 直後に移動済み）

        const whiteOv = document.createElement('div');
        whiteOv.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#fff;opacity:0;pointer-events:none;';
        document.body.appendChild(whiteOv);

        // ══════════════════════════════════════════════════════
        //  SHADERS
        // ══════════════════════════════════════════════════════
        const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

        // ── Background split (square-sized plane) ──
        const bgMat = new THREE.ShaderMaterial({
            uniforms: { u_grey: { value: 0 }, u_flash: { value: 0 }, u_time: { value: 0 }, u_pixelSize: { value: 8.0 }, u_vortex: { value: 0.0 }, u_vortexAngle: { value: 0.0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_grey, u_flash, u_time, u_pixelSize, u_vortex, u_vortexAngle;',
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
                // ── 墨流しモード（Suminagashi — 有機的インク混合） ──
                '  float sumiAmt = 0.0;',
                '  if(u_vortex > 0.001) {',
                //   墨流し: 複数スケールのfbmで境界を有機的に歪ませる
                '    float t = u_time;',
                '    float intensity = min(u_vortexAngle / 20.0, 1.0);',
                //   大きな流れ（ゆっくり・大振幅）
                '    float flow1 = fbm(vec2(uv.y * 3.0 + t * 0.15, uv.x * 2.0 + t * 0.08)) - 0.5;',
                //   中くらいの波（水面の揺れ）
                '    float flow2 = fbm(vec2(uv.y * 7.0 - t * 0.2, uv.x * 5.0 + t * 0.12)) - 0.5;',
                //   細かいディテール（インクの繊維）
                '    float flow3 = fbm(vec2(uv.y * 15.0 + t * 0.3, uv.x * 12.0 - t * 0.18)) - 0.5;',
                //   合成: 振幅が時間とともに広がる
                '    sumiAmt = (flow1 * 0.45 + flow2 * 0.3 + flow3 * 0.12) * intensity;',
                //   緩やかな渦（墨流しの回転運動）
                '    vec2 center = vec2(0.5);',
                '    vec2 toC = uv - center;',
                '    float r = length(toC);',
                '    float slowTwist = intensity * 3.0 * (1.0 - r * 0.8);',
                '    float a = atan(toC.y, toC.x) + slowTwist;',
                '    uv = center + vec2(cos(a), sin(a)) * r;',
                '  }',
                '  float edge = uv.x - 0.5 + sumiAmt;',
                // 墨流し時はsmoothstepで柔らかい境界、通常時はhardエッジ
                '  float softness = sumiAmt * sumiAmt * 0.5;',
                '  float split = softness < 0.0001 ? step(0.0, edge) : smoothstep(-softness, softness, edge);',
                '  vec3 col = mix(vec3(1.0), vec3(0.0), split);',
                '',
                // BACKUP: glow/glowColor — 境界グロー除去（CSS虹色ラインに置き換え）
                '  float glow = 0.0;',
                '',
                // 白側・黒側のエフェクトは除去（純粋な白黒を維持）',
                '',
                '  vec3 grey = vec3(0.5);',
                '  float greyMix = clamp(u_grey, 0.0, 1.0);',
                '  float darkMix = clamp(u_grey - 1.0, 0.0, 1.0);',
                '  col = mix(col, grey, greyMix);',
                '  col = mix(col, vec3(0.0), darkMix);',
                '  col = mix(col, vec3(1.0), u_flash);',
                '  // 16色ディザリング (u_grey > 0.05の時のみ適用 = グレー化中のみ)',
                '  if(u_grey > 0.05) {',
                '    vec2 pixPos = gl_FragCoord.xy / u_pixelSize;',
                '    float dither = bayer4x4(pixPos) * 0.15 * u_grey;',
                '    col = quantize16(col + vec3(dither));',
                '  }',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n'), depthWrite: false
        });
        // BACKUP: PlaneGeometry(sqWorld, sqWorld) — 正方形では横長viewport時に左右に黒余白が出る
        const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 6, sqWorld), bgMat);
        bgPlane.position.z = -1; scene.add(bgPlane);

        // ── Newton Rings (Phase C 背景 — RGBCMY動的干渉縞) ──
        // ── Warp Tunnel Rings (WARP_GROW/CONSUME用: 9リング同心円・透視射影シミュレーション) ──
        const warpTunnelMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time:      { value: 0 },
                u_alpha:     { value: 0 },
                u_direction: { value: 1.0 },  // 1=外向き(WARP_GROW), -1=内向き(CONSUME)
                u_speed:     { value: 0.06 }, // リングスクロール速度 (シェーダー内で加速)
                u_progress:  { value: 0.0 },  // フェーズ内進捗 0-1
            },
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_time, u_alpha, u_direction, u_speed, u_progress;',
                '',
                'void main(){',
                '  vec2 p = (vUv - 0.5) * 2.0;',
                '  float r = length(p);',
                '',
                '  // RGBCMY 6色 — 補色ペア順: R↔C, G↔M, B↔Y',
                '  vec3 wc[6];',
                '  wc[0]=vec3(1.0,0.0,0.0); wc[1]=vec3(0.0,1.0,1.0);',   // Red, Cyan
                '  wc[2]=vec3(0.0,1.0,0.0); wc[3]=vec3(1.0,0.0,1.0);',   // Green, Magenta
                '  wc[4]=vec3(0.0,0.0,1.0); wc[5]=vec3(1.0,1.0,0.0);',   // Blue, Yellow
                '',
                '  // 引力加速: progress^2 で終盤ほど速くなる',
                '  float spd = u_speed * (1.0 + u_progress * u_progress * 4.0);',
                '',
                '  vec3 col = vec3(0.0);',
                '',
                // 18リングで高密度トンネル
                '  for(int i = 0; i < 18; i++){',
                '    float fi = float(i);',
                '    float basePhase = fi / 18.0;',
                '    float phase = fract(basePhase + u_time * spd * u_direction + 2.0);',
                '',
                '    // 透視射影: 手前ほど急激に大きく',
                '    float depth = 1.0 - phase;',
                '    float ringRadius = 0.04 / (depth * depth + 0.04);',
                '',
                '    if(ringRadius < 1.4){',
                '      // 太さ: 奥は細く、手前は太く（増量）',
                '      float thick = 0.006 + phase * phase * 0.04;',
                '      float dist = abs(r - ringRadius);',
                '      float ringVal = max(0.0, 1.0 - dist / max(thick, 0.001));',
                '      // ソフトグロー追加（広め）',
                '      float glow = exp(-dist * dist * 400.0) * 0.5;',
                '      ringVal = max(ringVal, glow);',
                '',
                '      // 輝度: 手前ほど明るく（強化）',
                '      float brightness = phase * phase * 2.5;',
                '',
                '      // 6色サイクル',
                '      int ci = int(mod(fi, 6.0));',
                '      vec3 ringColor;',
                '      if(ci==0) ringColor=wc[0];',
                '      else if(ci==1) ringColor=wc[1];',
                '      else if(ci==2) ringColor=wc[2];',
                '      else if(ci==3) ringColor=wc[3];',
                '      else if(ci==4) ringColor=wc[4];',
                '      else ringColor=wc[5];',
                '',
                '      col += ringColor * ringVal * brightness;',
                '    }',
                '  }',
                '',
                '  // 奥行きグロー (トンネル中心の光)',
                '  float centerGlow = exp(-r * r * 4.0) * u_progress * 0.5;',
                '  col += vec3(centerGlow);',
                '',
                '  // 画面端フェード',
                '  col *= smoothstep(1.2, 0.7, r);',
                '',
                '  float a = u_alpha * min(1.0, length(col) + centerGlow * 0.5);',
                '  gl_FragColor = vec4(col, a);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        const warpTunnelPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(sqWorld * 6, sqWorld * 6),
            warpTunnelMat
        );
        warpTunnelPlane.position.z = -0.5;
        warpTunnelPlane.visible = false;
        scene.add(warpTunnelPlane);

        // ── Eye + Light Cross (P1終末演出: 閉じた目が開き、光の十字架が現れる) ──
        // 哲学: グレーの視界→目を開ける→虹が見える = 視点の転換 = 101%
        // 物理: 虹彩=ニュートンリング(薄膜干渉), 十字架=回折スター(6条光芒=RGBCMY)
        const eyeMat = new THREE.ShaderMaterial({
            uniforms: {
                u_open: { value: 0.0 },    // 0=閉じた目, 1=完全に開いた目
                u_cross: { value: 0.0 },   // 0=十字架なし, 1+=十字架展開
                u_time: { value: 0.0 },
                u_appear: { value: 0.0 }   // 0=暗闘, 1=目が見えている
            },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_open, u_cross, u_time, u_appear;',
                '',
                '// ノイズ（まぶたの質感用）',
                'float hash(vec2 p) {',
                '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
                '}',
                'float noise(vec2 p) {',
                '  vec2 i = floor(p); vec2 f = fract(p);',
                '  f = f * f * (3.0 - 2.0 * f);',
                '  float a = hash(i); float b = hash(i + vec2(1,0));',
                '  float c = hash(i + vec2(0,1)); float d = hash(i + vec2(1,1));',
                '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
                '}',
                '',
                'void main() {',
                '  vec2 p = (vUv - 0.5) * 2.0;',
                '  float x = p.x;',
                '  float y = p.y;',
                '  float r = length(p);',
                '  float angle = atan(p.y, p.x);',
                '',
                '  // ═══ 瞼の形状（アーモンド型） ═══',
                '  float eyeW = 1.4;',
                '  float eyeH = u_open * 0.75;',
                // アーモンド型: (1 - x²/w²)^1.5 で尖った先端
                '  float xn = x / eyeW;',
                '  float lidBase = max(0.0, 1.0 - xn * xn);',
                '  float lidCurve = pow(lidBase, 1.5);',
                '  float upperLid = eyeH * lidCurve;',
                '  float lowerLid = -eyeH * lidCurve * 0.85;', // 下まぶたは浅い
                '',
                '  // まぶたのめくれ（開く途中で厚みが見える）',
                '  float lidThick = 0.02 + u_open * 0.03;',
                '',
                '  // insideEye: smoothstepで瞼の端をソフトに',
                '  float aboveLower = smoothstep(lowerLid - 0.01, lowerLid + 0.01, y);',
                '  float belowUpper = smoothstep(upperLid + 0.01, upperLid - 0.01, y);',
                '  float insideEye = aboveLower * belowUpper * step(0.0, lidBase);',
                '',
                '  // ═══ まぶたの質感 ═══',
                '  // 肌のノイズ（微細なテクスチャ）',
                '  float skinNoise = noise(p * 15.0) * 0.03 + noise(p * 40.0) * 0.015;',
                '  // 血管の影（まぶたを通して見える）',
                '  float veinPattern = noise(vec2(x * 8.0 + 0.5, y * 3.0 + u_time * 0.1));',
                '  float vein = smoothstep(0.45, 0.55, veinPattern) * 0.02;',
                '  // まぶたの基本色（暖かい暗色）',
                '  vec3 lidColor = vec3(0.04, 0.025, 0.02) + skinNoise + vein;',
                '  // 上まぶたのハイライト（光源からの反射）',
                '  float lidHighlight = smoothstep(upperLid + lidThick + 0.08, upperLid + lidThick, y)',
                '                     * smoothstep(-0.8, 0.0, -abs(x)) * 0.06;',
                '  lidColor += vec3(0.8, 0.75, 0.7) * lidHighlight;',
                '',
                '  // まつ毛の影（上まぶたの際）',
                '  float lashShadow = 0.0;',
                '  if (lidBase > 0.0 && u_open > 0.05) {',
                '    float lashY = upperLid;',
                '    float distToLash = abs(y - lashY);',
                '    // まつ毛の形: 複数のsin波で不規則に',
                '    float lashPattern = sin(x * 25.0) * 0.4 + sin(x * 40.0 + 1.0) * 0.3 + sin(x * 63.0) * 0.3;',
                '    lashPattern = max(0.0, lashPattern);',
                '    lashShadow = exp(-distToLash * distToLash * 800.0) * lashPattern * 0.7;',
                '    // 下まつ毛（薄い）',
                '    float lashYB = lowerLid;',
                '    float distToLashB = abs(y - lashYB);',
                '    float lashB = sin(x * 20.0 + 2.0) * 0.3 + sin(x * 35.0) * 0.3;',
                '    lashShadow += exp(-distToLashB * distToLashB * 1200.0) * max(0.0, lashB) * 0.3;',
                '  }',
                '',
                '  // ═══ 眼球の中の世界 ═══',
                '  // 瞳孔半径（目が開くと拡大→光に反応して縮小）',
                '  float pupilR = 0.12 + (1.0 - u_open) * 0.08;',
                '',
                '  // 虹彩: ニュートンリング（r² ∝ nλR — 6波長干渉）',
                '  float irisR = r * 4.0;',
                '  float r2iris = irisR * irisR;',
                '  // 6波長: R(700) G(530) B(450) C(490) M(560) Y(580)',
                '  float wR = sin(r2iris / 1.0 + u_time * 0.3 + angle * 0.5) * 0.5 + 0.5;',
                '  float wG = sin(r2iris / 0.757 + u_time * 0.4 + angle * 0.7) * 0.5 + 0.5;',
                '  float wB = sin(r2iris / 0.643 + u_time * 0.5 + angle * 0.3) * 0.5 + 0.5;',
                '  float wC = sin(r2iris / 0.700 + u_time * 0.35 - angle * 0.4) * 0.5 + 0.5;',
                '  float wM = sin(r2iris / 0.800 + u_time * 0.45 - angle * 0.6) * 0.5 + 0.5;',
                '  float wY = sin(r2iris / 0.829 + u_time * 0.38 + angle * 0.2) * 0.5 + 0.5;',
                '  vec3 irisNewton = vec3(0.0);',
                '  irisNewton += vec3(1.0, 0.0, 0.0) * wR;',
                '  irisNewton += vec3(0.0, 1.0, 0.0) * wG;',
                '  irisNewton += vec3(0.0, 0.0, 1.0) * wB;',
                '  irisNewton += vec3(0.0, 1.0, 1.0) * wC;',
                '  irisNewton += vec3(1.0, 0.0, 1.0) * wM;',
                '  irisNewton += vec3(1.0, 1.0, 0.0) * wY;',
                '  irisNewton /= 6.0;',
                '',
                '  // 虹彩リング（放射状の繊維パターン）',
                '  float irisFiber = noise(vec2(angle * 10.0, irisR * 5.0 + u_time * 0.2)) * 0.4;',
                '  irisFiber += noise(vec2(angle * 20.0 + 5.0, irisR * 8.0)) * 0.2;',
                '',
                '  // 虹彩の帯域（ドーナツ型にマスク）',
                '  float irisInner = smoothstep(pupilR - 0.02, pupilR + 0.04, irisR / 4.0);',
                '  float irisOuter = smoothstep(0.38, 0.32, irisR / 4.0);',
                '  float irisMask = irisInner * irisOuter;',
                '',
                '  // 虹彩の最終色: グレー→虹の観測エフェクト',
                '  vec3 greyIris = vec3(0.35 + irisFiber * 0.3);',
                '  vec3 irisCol = mix(greyIris, irisNewton, 0.4 + u_open * 0.5);',
                '  irisCol *= irisMask;',
                '',
                '  // 瞳孔（深い黒、わずかに宇宙が見える）',
                '  float pupilMask = smoothstep(pupilR + 0.02, pupilR - 0.01, irisR / 4.0);',
                '  // 瞳孔の中の宇宙（RGBCMY星雲）',
                '  float cosmicNoise = noise(p * 30.0 + u_time * 0.15) * noise(p * 50.0 - u_time * 0.1);',
                '  vec3 cosmic = vec3(',
                '    cosmicNoise * (0.3 + 0.7 * sin(angle + u_time * 0.2)),',
                '    cosmicNoise * (0.3 + 0.7 * sin(angle + u_time * 0.2 + 2.094)),',
                '    cosmicNoise * (0.3 + 0.7 * sin(angle + u_time * 0.2 + 4.189))',
                '  ) * 0.4;',
                '  vec3 pupilCol = cosmic * pupilMask;',
                '',
                '  // 白目（強膜）— 微かなピンク血管',
                '  float scleraMask = smoothstep(0.38, 0.42, irisR / 4.0) * insideEye;',
                '  float scleraVein = noise(vec2(angle * 6.0, r * 15.0)) * 0.08;',
                '  vec3 scleraCol = vec3(0.92, 0.9, 0.88) * scleraMask;',
                '  scleraCol += vec3(0.15, 0.02, 0.02) * scleraVein * scleraMask;',
                '',
                '  // 角膜反射（白い点光源）',
                '  float corneaRef = exp(-length(p - vec2(0.08, 0.06)) * length(p - vec2(0.08, 0.06)) * 300.0);',
                '  corneaRef *= insideEye * 0.8;',
                '',
                '  // ═══ 太陽十字架 ☉ Solar Cross ═══',
                '  // 4条の光芒（縦横の十字）+ 囲む円環 = ☉',
                '  // RGB×CMY の交差点 = グレー = 現実 = 太陽十字の中心',
                '  float crossBreath = 1.0 + sin(u_time * 1.5) * 0.12 + sin(u_time * 2.3) * 0.06;',
                '  float crossW = (0.012 + u_cross * 0.035) * crossBreath;',
                '  vec3 crossCol = vec3(0.0);',
                '',
                '  // 4条の光芒（純粋な十字: 上下左右）',
                '  // 上=精神(白に向かう), 下=物質(黒に向かう), 左右=時間の流れ',
                '  float hRay = exp(-y * y / (crossW * crossW));',  // 水平
                '  hRay *= exp(-x * x * 0.08);',  // 水平方向の長さ
                '  float vRay = exp(-x * x / (crossW * crossW));',  // 垂直
                '  vRay *= exp(-y * y * 0.08);',
                '',
                '  // 各光条にRGBCMYのグラデーション（中心から外へ色が分離）',
                '  // 水平: 左=Cyan→中心=White→右=Red',
                '  vec3 hColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), smoothstep(-0.5, 0.0, x));',
                '  hColor = mix(hColor, vec3(1.0, 0.0, 0.0), smoothstep(0.0, 0.5, x));',
                '  // 垂直: 上=Blue→中心=White→下=Yellow',
                '  vec3 vColor = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 1.0, 1.0), smoothstep(-0.5, 0.0, y));',
                '  vColor = mix(vColor, vec3(0.0, 0.0, 1.0), smoothstep(0.0, 0.5, y));',
                '',
                '  crossCol += hColor * hRay * u_cross;',
                '  crossCol += vColor * vRay * u_cross;',
                '',
                '  // 太陽の円環 ○ （ニュートンリング的な干渉で虹色に光る）',
                '  float ringR = 0.25 + u_cross * 0.15;',  // 円環の半径
                '  float ringW = 0.008 + u_cross * 0.012;', // 円環の太さ
                '  float ringDist = abs(r - ringR);',
                '  float ring = exp(-ringDist * ringDist / (ringW * ringW));',
                '  // 円環の虹色（角度に応じてRGBCMY）',
                '  vec3 ringColor = vec3(',
                '    0.5 + 0.5 * sin(angle * 1.0 + u_time * 0.4),',
                '    0.5 + 0.5 * sin(angle * 1.0 + u_time * 0.4 + 2.094),',
                '    0.5 + 0.5 * sin(angle * 1.0 + u_time * 0.4 + 4.189)',
                '  );',
                '  // 円環グロー（外側にソフトに広がる）',
                '  float ringGlow = exp(-ringDist * ringDist / (ringW * 8.0 * ringW * 8.0)) * 0.3;',
                '  crossCol += ringColor * (ring + ringGlow) * u_cross;',
                '',
                '  // 中心コア（全色が混ざった白=太陽の核）',
                '  float coreGlow = exp(-r * r * (10.0 - u_cross * 5.0)) * u_cross;',
                '  crossCol += vec3(1.0, 0.98, 0.95) * coreGlow;',
                '  // コアの脈動（心臓のように）',
                '  float corePulse = exp(-r * r * 25.0) * sin(u_time * 3.0) * 0.15 * u_cross;',
                '  crossCol += vec3(1.0) * max(0.0, corePulse);',
                '',
                '  // ═══ 瞼の縁の光漏れ ═══',
                '  // 開き始めの細い光の線（最もドラマチックな瞬間）',
                '  float slitLight = 0.0;',
                '  if (u_open > 0.01 && u_open < 0.5 && lidBase > 0.0) {',
                '    float slitH = u_open * 0.3;',
                '    float slitDist = abs(y) / max(slitH, 0.001);',
                '    slitLight = exp(-slitDist * slitDist * 4.0) * step(0.0, lidBase);',
                '    slitLight *= (1.0 - u_open * 2.0);', // 開くと薄れる
                '  }',
                '',
                '  // ═══ 最終合成 ═══',
                '  vec3 col = vec3(0.0);',
                '',
                '  // 目の中の世界（白目+虹彩+瞳孔+反射）',
                '  vec3 eyeWorld = scleraCol + irisCol + pupilCol + vec3(corneaRef);',
                '  col += eyeWorld * insideEye;',
                '',
                '  // まぶた（目の外は肌の色）',
                '  col += lidColor * (1.0 - insideEye);',
                '',
                '  // まつ毛の影',
                '  col -= vec3(lashShadow) * 0.5;',
                '',
                '  // 瞼の縁の光漏れ（開き始めの白い光）',
                '  col += vec3(1.0, 0.95, 0.9) * slitLight * 0.8;',
                '',
                '  // 十字架の光（目の中と外の両方に影響）',
                '  col += crossCol;',
                '',
                '  // 暗闇からのフェードイン',
                '  col *= u_appear;',
                '',
                '  float alpha = u_appear;',
                '  gl_FragColor = vec4(col, alpha);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false
        });
        const eyePlane = new THREE.Mesh(
            new THREE.PlaneGeometry(camW * 4, camH * 4),
            eyeMat
        );
        eyePlane.position.z = 2.0;  // 最前面
        eyePlane.visible = false;
        scene.add(eyePlane);

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

        // ── CMY particles (物質: 1シェーダーで減法混色) ──
        // 減法混色: 白(紙)から各インクが補色を吸収
        // C×M=Blue, C×Y=Green, M×Y=Red, C×M×Y=Black
        const cmyTriPos = [ // 正三角形（スクエア左半分中心基準 — 広めの配置）
            [0, 1.3 * unit],            // 上 (Cyan)
            [-1.15 * unit, -0.65 * unit], // 左下 (Magenta)
            [1.15 * unit, -0.65 * unit],  // 右下 (Yellow)
        ];
        const cmyCtr = new THREE.Vector3(-2.5 * unit, -0.2 * unit, 0);
        // プロキシ Object3D（位置・スケール・visibleを既存アニメコードと互換）
        const cmyP = cmyTriPos.map((pos, i) => {
            const m = new THREE.Object3D();
            m.position.set(cmyCtr.x + pos[0], cmyCtr.y + pos[1], 0.5);
            m.userData = { ox: m.position.x, oy: m.position.y };
            return m;
        });
        const cmyRadius = 0.6 * unit;
        const cmyShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                u_c0: { value: new THREE.Vector2(cmyP[0].position.x, cmyP[0].position.y) },
                u_c1: { value: new THREE.Vector2(cmyP[1].position.x, cmyP[1].position.y) },
                u_c2: { value: new THREE.Vector2(cmyP[2].position.x, cmyP[2].position.y) },
                u_radius: { value: cmyRadius },
                u_scale: { value: 1.0 },
                u_visible: { value: 1.0 },
            },
            vertexShader: [
                'varying vec2 vWorldPos;',
                'void main(){',
                '  vWorldPos = (modelMatrix * vec4(position,1.0)).xy;',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vWorldPos;',
                'uniform vec2 u_c0, u_c1, u_c2;',
                'uniform float u_radius, u_scale, u_visible;',
                '',
                'void main(){',
                '  if(u_visible < 0.5) discard;',
                '  float r = u_radius * u_scale;',
                '  float edge = r * 0.05;',
                '  float d0 = length(vWorldPos - u_c0);',
                '  float d1 = length(vWorldPos - u_c1);',
                '  float d2 = length(vWorldPos - u_c2);',
                '',
                '  // 各円の内側判定（ソフトエッジ）',
                '  float c = smoothstep(r, r - edge, d0);',  // Cyan
                '  float m = smoothstep(r, r - edge, d1);',  // Magenta
                '  float y = smoothstep(r, r - edge, d2);',  // Yellow
                '',
                '  float any = max(c, max(m, y));',
                '  if(any < 0.001) discard;',
                '',
                '  // 減法混色: 白(紙)から各インクが補色を吸収',
                '  // Cyan = (0,1,1) → Redを吸収',
                '  // Magenta = (1,0,1) → Greenを吸収',
                '  // Yellow = (1,1,0) → Blueを吸収',
                '  vec3 col = vec3(1.0);',                    // 白い紙
                '  col *= mix(vec3(1.0), vec3(0.0, 1.0, 1.0), c);',  // Cyan ink
                '  col *= mix(vec3(1.0), vec3(1.0, 0.0, 1.0), m);',  // Magenta ink
                '  col *= mix(vec3(1.0), vec3(1.0, 1.0, 0.0), y);',  // Yellow ink
                '',
                '  gl_FragColor = vec4(col, any);',
                '}'
            ].join('\n'),
            transparent: true,
            depthWrite: false,
        });
        const cmyPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(sqWorld * 6, sqWorld * 3),
            cmyShaderMat
        );
        cmyPlane.position.z = 0.5;
        scene.add(cmyPlane);

        // ── RGB particles (精神: フラットな円・加法混色) ──
        const rgbSphereGeo = new THREE.CircleGeometry(0.6 * unit, 64);
        const rgbTriPos = [ // 正三角形（スクエア右半分中心基準 — 広めの配置）
            [0, 1.3 * unit],
            [-1.15 * unit, -0.65 * unit],
            [1.15 * unit, -0.65 * unit],
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
        // ── CMY球（物質）: 重厚な影・フレネル反射 + グレー遷移 ──
        const bDotMat = new THREE.ShaderMaterial({
            uniforms: { u_time: { value: 0 }, u_greyMix: { value: 0.0 } },
            vertexShader: [
                'varying vec3 vNormal;',
                'varying vec3 vViewDir;',
                'void main(){',
                '  vNormal = normalize(normalMatrix * normal);',
                '  vec4 mvPos = modelViewMatrix * vec4(position,1.0);',
                '  vViewDir = normalize(-mvPos.xyz);',
                '  gl_Position = projectionMatrix * mvPos;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'precision highp float;',
                'varying vec3 vNormal;',
                'varying vec3 vViewDir;',
                'uniform float u_time, u_greyMix;',
                'void main(){',
                '  vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));',
                '  float diff = max(dot(vNormal, lightDir), 0.0);',
                '  float spec = pow(max(dot(reflect(-lightDir, vNormal), vViewDir), 0.0), 32.0);',
                '  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);',
                '  float ambient = 0.05;',
                '  vec3 blackCol = vec3(0.0) * (ambient + diff * 0.5);',
                '  blackCol += vec3(0.08) * spec * 0.3;',
                '  blackCol += vec3(0.03) * fresnel * 0.2;',
                '  // グレー遷移: 0=純黒、1=50%グレー',
                '  vec3 greyTarget = vec3(0.5) * (0.6 + diff * 0.4) + vec3(0.08) * spec;',
                '  vec3 col = mix(blackCol, greyTarget, u_greyMix);',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n'),
            depthWrite: false, depthTest: false
        });
        // ── RGB球（精神）: 内側から発光・柔らかいグロー + グレー遷移 ──
        const wDotMat = new THREE.ShaderMaterial({
            uniforms: { u_time: { value: 0 }, u_greyMix: { value: 0.0 } },
            vertexShader: [
                'varying vec3 vNormal;',
                'varying vec3 vViewDir;',
                'void main(){',
                '  vNormal = normalize(normalMatrix * normal);',
                '  vec4 mvPos = modelViewMatrix * vec4(position,1.0);',
                '  vViewDir = normalize(-mvPos.xyz);',
                '  gl_Position = projectionMatrix * mvPos;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'precision highp float;',
                'varying vec3 vNormal;',
                'varying vec3 vViewDir;',
                'uniform float u_time, u_greyMix;',
                'void main(){',
                '  vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));',
                '  float diff = max(dot(vNormal, lightDir), 0.0);',
                '  float spec = pow(max(dot(reflect(-lightDir, vNormal), vViewDir), 0.0), 64.0);',
                '  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);',
                '  float glow = 0.7 + 0.1 * sin(u_time * 2.0);',
                '  vec3 whiteCol = vec3(1.0) * (glow + diff * 0.3);',
                '  whiteCol += vec3(1.0) * spec * 0.5;',
                '  whiteCol += vec3(1.0) * fresnel * 0.15;',
                '  whiteCol = min(whiteCol, vec3(1.0));',
                '  // グレー遷移: 0=純白、1=50%グレー',
                '  vec3 greyTarget = vec3(0.5) * (0.6 + diff * 0.4) + vec3(0.08) * spec;',
                '  vec3 col = mix(whiteCol, greyTarget, u_greyMix);',
                '  gl_FragColor = vec4(col, 1.0);',
                '}'
            ].join('\n'),
            depthWrite: false, depthTest: false
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
                '// RGBCMY gradient: R→G→B→C→M→Y→R',
                'vec3 rgbcmy(float angle) {',
                '  float t = mod(angle, 6.28318) / 6.28318 * 6.0;',
                '  int i = int(floor(t)); float f = fract(t);',
                '  vec3 R=vec3(1.0,0.0,0.0), G=vec3(0.0,1.0,0.0), B=vec3(0.0,0.0,1.0);',
                '  vec3 C=vec3(0.0,1.0,1.0), M=vec3(1.0,0.0,1.0), Y=vec3(1.0,1.0,0.0);',
                '  if(i==0) return mix(R,G,f);',
                '  else if(i==1) return mix(G,B,f);',
                '  else if(i==2) return mix(B,C,f);',
                '  else if(i==3) return mix(C,M,f);',
                '  else if(i==4) return mix(M,Y,f);',
                '  else return mix(Y,R,f);',
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
                '  // 外周リング: RGBCMYグラデーション',
                '  float aO = atan(rp.y, rp.x);',
                '  vec3 ringColor = rgbcmy(aO + u_time * 0.4);',
                '  float aura1 = smoothstep(1.02, 0.88, r) * smoothstep(0.82, 0.92, r);',
                '  float aura2 = smoothstep(1.06, 0.96, r) * smoothstep(0.90, 1.00, r);',
                '  float aura3 = smoothstep(1.10, 1.02, r) * smoothstep(0.96, 1.04, r);',
                '  col = mix(col, ringColor * 1.3, (aura1 + aura2 * 0.6 + aura3 * 0.3) * (1.0 - u_grey));',
                '',
                '  // S字境界線: RGBCMYグラデーション',
                '  float bAngle = atan(rp.y, rp.x);',
                '  vec3 boundColor = rgbcmy(bAngle + u_time * 0.5);',
                '  float boundary = exp(-abs(b) * 80.0) * step(r, 0.85);',
                '  col += boundColor * boundary * 1.5 * (1.0 - u_grey);',
                '',
                '  // 小円（陰陽の目）',
                '  float dot1 = 1.0 - smoothstep(0.0, 0.13, length(rp - vec2(0.0,  0.24)));',
                '  float dot2 = 1.0 - smoothstep(0.0, 0.13, length(rp - vec2(0.0, -0.24)));',
                '  col = mix(col, lightCol * 1.2, dot1 * (1.0 - yin));',
                '  col = mix(col, darkCol,        dot2 * yin);',
                '  col += rgbcmy(aO + u_time) * exp(-abs(length(rp - vec2(0.0,  0.24)) - 0.1) * 40.0) * 0.8 * (1.0 - u_grey);',
                '  col += rgbcmy(aO + u_time) * exp(-abs(length(rp - vec2(0.0, -0.24)) - 0.1) * 40.0) * 0.8 * (1.0 - u_grey);',
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

        // ── Grey Sphere (demo_pattern_d移植 — uniform制御のみ、runtime書き換え禁止) ──
        const greySphereGeo = new THREE.SphereGeometry(sqWorld * 0.32, 48, 48);
        const greySphereMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 }, u_glow: { value: 0 },
                u_rainbow: { value: 0 }, u_opacity: { value: 1.0 }
            },
            vertexShader: [
                'varying vec3 vNormal; varying vec3 vPos;',
                'void main() {',
                '  vNormal = normalize(normalMatrix * normal);',
                '  vPos = position;',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'precision highp float;',
                'varying vec3 vNormal; varying vec3 vPos;',
                'uniform float u_time, u_glow, u_rainbow, u_opacity;',
                'void main() {',
                '  if (u_opacity < 0.005) discard;',
                '  vec3 N = normalize(vNormal);',
                '  float fresnel = pow(1.0 - max(dot(N, vec3(0,0,1)), 0.0), 3.0);',
                '',
                '  // 純粋なグレーの球体 + ニュートンリング',
                '  float grey = 0.50;',
                '  vec3 col = vec3(grey);',
                '',
                '  // ニュートンリング（物理式: r² ∝ nλR — 6波長RGBCMY干渉）',
                '  float r2 = dot(vPos.xy, vPos.xy) * 80.0;',
                '  // 6波長: R(700nm) O(600nm) Y(570nm) G(530nm) C(490nm) B(450nm) V(400nm)',
                '  // λ比率で同心円の間隔が変わる（物理的に正しいニュートンリング）',
                '  float wR = sin(r2 / 1.0 + u_time * 0.3) * 0.5 + 0.5;',   // 赤: 広い間隔
                '  float wO = sin(r2 / 0.857 + u_time * 0.35) * 0.5 + 0.5;', // 橙
                '  float wY = sin(r2 / 0.814 + u_time * 0.4) * 0.5 + 0.5;',  // 黄
                '  float wG = sin(r2 / 0.757 + u_time * 0.45) * 0.5 + 0.5;', // 緑
                '  float wB = sin(r2 / 0.643 + u_time * 0.5) * 0.5 + 0.5;',  // 青: 狭い間隔
                '  float wV = sin(r2 / 0.571 + u_time * 0.55) * 0.5 + 0.5;', // 紫
                '  // RGB合成: 各波長の寄与',
                '  vec3 newtonColor = vec3(0.0);',
                '  newtonColor += vec3(1.0, 0.0, 0.0) * wR;',  // Red
                '  newtonColor += vec3(1.0, 0.5, 0.0) * wO;',  // Orange
                '  newtonColor += vec3(1.0, 1.0, 0.0) * wY;',  // Yellow
                '  newtonColor += vec3(0.0, 1.0, 0.0) * wG;',  // Green
                '  newtonColor += vec3(0.0, 0.0, 1.0) * wB;',  // Blue
                '  newtonColor += vec3(0.5, 0.0, 1.0) * wV;',  // Violet
                '  newtonColor = newtonColor / 6.0 * 0.18 * u_rainbow;',
                '  col += newtonColor;',
                '',
                '  // フレネルによるエッジ明るさ（球の立体感）',
                '  col += vec3(fresnel * 0.18);',
                '',
                '  // 虹のフレネル（観測エフェクト: グレーの中の虹）',
                '  // 6波長: R O Y G B V',
                '  float fAngle = fresnel * 8.0 + u_time * 0.8;',
                '  vec3 rainbow = vec3(',
                '    0.5+0.5*sin(fAngle),',
                '    0.5+0.5*sin(fAngle+2.094),',
                '    0.5+0.5*sin(fAngle+4.189)',
                '  );',
                '  // エッジに虹 + 表面にもうっすら',
                '  float rainbowMix = fresnel * u_rainbow + u_rainbow * 0.15;',
                '  col = mix(col, rainbow, rainbowMix);',
                '',
                '  // グロー: 内部から発光',
                '  col += vec3(u_glow * 0.4);',
                '  col += vec3(1.0) * fresnel * u_glow * 0.8;',
                '',
                '  // ライティング: 柔らかい拡散光',
                '  float diff = max(dot(N, normalize(vec3(1,1,2))), 0.0) * 0.35 + 0.65;',
                '  col *= diff;',
                '',
                '  gl_FragColor = vec4(col, u_opacity);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, depthTest: false
        });
        const greySphere = new THREE.Mesh(greySphereGeo, greySphereMat);
        greySphere.visible = false; greySphere.position.z = 0.5; scene.add(greySphere);

        // ── RGBCMY Tunnel (OVERSIZED — covers full screen for overflow) ──
        // ── RGBCMY Tunnel 3D (demo_pattern_d移植 — u_scale=3.0固定、u_depth/u_ringDensity/u_scrollMul追加) ──
        const tunnelSize = Math.max(camW, camH) * 4;
        const tunnelMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_radius: { value: 0 }, u_alpha: { value: 0 },
                u_scale: { value: 3.0 },
                u_depth: { value: 0 },          // 奥行き (0=flat, 1=deep)
                u_ringDensity: { value: 3.0 },   // リング密度
                u_scrollMul: { value: 0.2 },     // スクロール速度倍率
                u_rainbow: { value: 0.0 }        // 虹の滲み出し量 (0=グレー, 1=フルレインボー)
            },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;',
                'uniform float u_time,u_radius,u_alpha,u_scale,u_depth,u_ringDensity,u_scrollMul,u_rainbow;',
                '',
                'void main(){',
                '  vec2 p=(vUv-0.5)*2.0*u_scale;',
                '  float r=length(p);',
                '  float mask=1.0-smoothstep(u_radius-0.02,u_radius,r);',
                '  if(mask<0.005)discard;',
                '',
                '  float normR=r/max(u_radius,0.001);',
                '',
                // === 透視トンネル: 1/r で自然な奥行き ===
                '  float zRaw = 1.0 / max(normR, 0.02);',  // 中心=無限遠、外周=手前
                // 深度スケール: 外周にもリングが複数見えるように
                '  float z = pow(zRaw, 0.6) * (1.0 + u_depth * 1.5);',
                '  float scrollSpeed = (0.2 + zRaw * 0.15) * u_scrollMul;',
                '  float phase = z * u_ringDensity - u_time * scrollSpeed;',
                '',
                // === RGBCMY 6色リング（明確な帯＋暗い間隔） ===
                '  float ringFract = fract(phase);',
                // リングの「壁面」部分（中央70%）と「溝」部分（端15%ずつ）
                '  float band = smoothstep(0.0, 0.12, ringFract) * smoothstep(1.0, 0.88, ringFract);',
                // 6色を帯ごとに割り当て: R, G, B, C, M, Y
                '  float idx = mod(floor(phase), 6.0);',
                '  vec3 ringColor;',
                '  if(idx < 0.5) ringColor = vec3(1.0, 0.0, 0.0);',       // Red
                '  else if(idx < 1.5) ringColor = vec3(0.0, 1.0, 0.0);',  // Green
                '  else if(idx < 2.5) ringColor = vec3(0.0, 0.0, 1.0);',  // Blue
                '  else if(idx < 3.5) ringColor = vec3(0.0, 1.0, 1.0);',  // Cyan
                '  else if(idx < 4.5) ringColor = vec3(1.0, 0.0, 1.0);',  // Magenta
                '  else ringColor = vec3(1.0, 1.0, 0.0);',                 // Yellow
                '',
                // === チューブ照明: 外周(手前)は明るく、中心(奥)は暗い ===
                '  float wallLight = normR * 0.9 + 0.1;',  // よりリニアで明るい
                // リング自体の発光（ネオン管のように）
                '  float glow = band * wallLight;',
                '',
                // === 暗い壁面（リング間の空間） ===
                '  float wallBase = 0.01 + normR * 0.03;', // 壁面は非常に暗い
                '  vec3 wall = vec3(wallBase);',
                '',
                // === 合成: 暗い壁 + 光るリング ===
                '  vec3 col = wall + ringColor * glow;',
                '',
                // === u_rainbow でグレー↔RGBCMY をミックス ===
                '  vec3 greyRing = vec3(0.5) * glow;',
                '  vec3 greyWall = vec3(wallBase);',
                '  vec3 greyCol = greyWall + greyRing;',
                '  col = mix(greyCol, col, u_rainbow);',
                '',
                // === トンネル奥の焦点光（白い消失点） ===
                '  float focal = exp(-normR * normR * 12.0);',
                '  col += vec3(0.8, 0.85, 0.9) * focal * 0.8;',
                '',
                // === 外周の強い暗化（チューブ内壁の影） ===
                '  col *= 1.0 - smoothstep(0.4, 1.0, normR) * 0.85;',
                '',
                '  gl_FragColor=vec4(col*mask,mask*u_alpha);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false
        });
        const tunnelPlane = new THREE.Mesh(new THREE.PlaneGeometry(tunnelSize, tunnelSize), tunnelMat);
        // z=0: bgPlane(z=-1)の手前、greySphere(z=0.5)の奥 → 球の裏からにじみ出る
        tunnelPlane.visible = false; tunnelPlane.position.z = 0; scene.add(tunnelPlane);

        // ── Halo (demo_pattern_d移植 — 球の背後のグロー) ──
        const haloMat = new THREE.ShaderMaterial({
            uniforms: { u_glow: { value: 0 }, u_time: { value: 0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;uniform float u_glow,u_time;',
                'void main(){',
                '  vec2 p=(vUv-0.5)*2.0;float r=length(p);',
                '  float glow=exp(-r*r*2.0)*u_glow;',
                '  vec3 col=vec3(0.7);',
                '  float angle=atan(p.y,p.x);',
                '  col.r+=sin(angle*3.0+u_time)*0.15*u_glow;',
                '  col.g+=sin(angle*3.0+u_time+2.094)*0.15*u_glow;',
                '  col.b+=sin(angle*3.0+u_time+4.189)*0.15*u_glow;',
                '  gl_FragColor=vec4(col*glow,glow);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        const haloPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 1.8, sqWorld * 1.8), haloMat);
        haloPlane.visible = false; haloPlane.position.z = 0.2; scene.add(haloPlane);

        // Stub objects so references in tick() don't error (solar cross removed — handled by eye shader u_cross)
        const scMat = { uniforms: { u_time: { value: 0 }, u_alpha: { value: 0 } } };
        const scPlane = { visible: false };

        // ══════════════════════════════════════════════════════
        //  STATE ENGINE
        // ══════════════════════════════════════════════════════
        let alive = true, globalTime = 0;
        const clk = new THREE.Clock();
        const PH = { ATTRACT: 0, EVENT_FUSE: 1, DUALITY: 2, EVENT_SING: 3, WARP_GROW: 4, EVENT_BREACH: 5, CONSUME: 6, EVENT_COLLAPSE: 7, DONE: 8 };

        // フェーズごとの自動進行速度 (prog / 秒)
        const AUTO_RATE = {};
        AUTO_RATE[PH.ATTRACT]   = 8.5;  // 0→30%  ≈ 3.5s
        AUTO_RATE[PH.DUALITY]   = 6.5;  // 30→50% ≈ 3.1s
        AUTO_RATE[PH.WARP_GROW] = 6.0;  // 50→75% ≈ 4.2s
        AUTO_RATE[PH.CONSUME]   = 5.0;  // 75→101% ≈ 5.2s

        // CONSUME phase speed constants (per-segment override)
        const CONSUME_SPEED_NORMAL   = 2.5;   // 75→99%: やや減速
        const CONSUME_SPEED_DRAMATIC = 0.8;   // 99→100%: 焦らし（crawl）
        const CONSUME_SPEED_FINAL    = 80.0;  // 100→101%: quantum jump

        const EVENT_PHASES = [
            PH.EVENT_FUSE, PH.EVENT_SING,
            PH.EVENT_BREACH, PH.EVENT_COLLAPSE
        ];
        let phase = PH.ATTRACT, prog = 0, progPaused = false, eventTimer = 0, phaseCInited = false, singDimSwitched = false, singShakeFrame = 0
        , numberRampageActive = false, numberRampageVal = 101, numberRampageStartTime = 0
        , silenceTriggered = false, warpGrowStartTime = -1
        , win95VortexOriginX = 0, win95VortexOriginY = 0 // スパゲッティ開始時の中心座標（キャッシュ）
        , freezeActive = false, freezeStartMs = -1; // 101%フリーズ用

        // ── ランナースプライトフレーム切り替え（4フレーム走りサイクル） ──
        let runnerFrame = 0;
        const RUNNER_FRAME_COUNT = 4;
        let runnerFrameTimer = 0;
        const RUNNER_FRAME_INTERVAL = 0.1; // 秒（100ms毎にフレーム切替 = 1歩0.4s）
        function updateRunnerFrame(dt) {
            runnerFrameTimer += dt;
            if (runnerFrameTimer >= RUNNER_FRAME_INTERVAL) {
                runnerFrameTimer -= RUNNER_FRAME_INTERVAL;
                runnerFrame = (runnerFrame + 1) % RUNNER_FRAME_COUNT;
                for (var i = 0; i < RUNNER_FRAME_COUNT; i++) {
                    var f = document.getElementById('rf' + (i + 1));
                    if (f) {
                        if (i === runnerFrame) { f.classList.add('rf-active'); }
                        else { f.classList.remove('rf-active'); }
                    }
                }
            }
        }

        // ── プログレスバー グリッチ演出（イベント発火時に呼ぶ） ──
        let barGlitchTimer = 0;
        function triggerBarGlitch() {
            barGlitchTimer = 0.5; // 0.5秒間グリッチ
        }
        function updateBarGlitch(dt) {
            if (barGlitchTimer <= 0) return;
            barGlitchTimer -= dt;
            var barWrap = document.getElementById('bar-wrap');
            var barFill = document.getElementById('p1-lb');
            if (!barWrap || !barFill) return;
            if (barGlitchTimer > 0) {
                // ブロックノイズ: バーの色・幅・位置がランダムにブレる
                var glitchI = Math.random();
                if (glitchI < 0.3) {
                    barFill.style.background = 'repeating-linear-gradient(to right,#aa0000 0px,#aa0000 6px,#000044 6px,#000044 8px)';
                } else if (glitchI < 0.6) {
                    barFill.style.background = 'repeating-linear-gradient(to right,#00aa00 0px,#00aa00 4px,#0000aa 4px,#0000aa 10px)';
                } else {
                    barFill.style.background = '#ffffff';
                }
                barWrap.style.transform = 'translateX(' + (Math.random() * 4 - 2) + 'px)';
                // ステータスバーも震える
                var status = document.getElementById('win95-status');
                if (status) status.style.transform = 'translateX(' + (Math.random() * 3 - 1.5) + 'px)';
            } else {
                // 復帰
                barFill.style.background = 'repeating-linear-gradient(to right,#0000aa 0px,#0000aa 8px,#000044 8px,#000044 10px)';
                barWrap.style.transform = 'none';
                var status2 = document.getElementById('win95-status');
                if (status2) status2.style.transform = 'none';
            }
        }

        function showProg(v) {
            const pv = Math.min(101, Math.floor(v));
            const fillPct = Math.min(100, pv);

            const barFill = document.getElementById('p1-lb');
            const handle = document.getElementById('drag-handle');
            if (barFill) barFill.style.width = fillPct + '%';
            if (handle) handle.style.left = fillPct + '%';

            const pctEl = document.getElementById('p1-lpct');
            if (pctEl) pctEl.textContent = 'Loading reality... ' + pv + '%';

            // Phase C バー同期
            const pcLb = document.getElementById('phase-c-lb');
            const pcPct = document.getElementById('phase-c-pct');
            if (pcLb) pcLb.style.width = fillPct + '%';
            if (pcPct) pcPct.textContent = 'LOADING REALITY... ' + pv + '%';

            // ── 非常口ランナー: prog%に連動 ──
            const runner = document.getElementById('exit-runner');
            const door = document.getElementById('exit-door');
            if (runner) {
                if (pv >= 101) {
                    // 101%: ドアに飛び込んで消える
                    if (door) { door.style.opacity = '1'; door.style.boxShadow = '0 0 16px rgba(0,255,85,0.6), inset 0 0 6px rgba(0,0,0,0.3)'; }
                    runner.style.transition = 'left 0.4s ease-in, opacity 0.3s ease-in 0.25s';
                    runner.style.left = 'calc(100% - 8px)';
                    runner.style.opacity = '0';
                    runner.style.filter = 'drop-shadow(0 0 8px rgba(0,255,85,0.9))';
                } else {
                    // 通常: fillPctに連動して位置を更新
                    runner.style.left = fillPct + '%';
                    runner.style.opacity = '1';
                    runner.style.filter = 'drop-shadow(0 0 4px rgba(0,204,68,0.6))';
                    // 95%以降: ドアが徐々に出現
                    if (door) {
                        if (fillPct >= 95) {
                            door.style.opacity = String((fillPct - 95) / 5);
                        } else {
                            door.style.opacity = '0';
                        }
                    }
                    // 速度に応じてグロー強度変化（CONSUMEフェーズで加速感）
                    if (fillPct >= 75) {
                        var glowI = Math.min(1, (fillPct - 75) / 25);
                        runner.style.filter = 'drop-shadow(0 0 ' + (4 + glowI * 8) + 'px rgba(0,255,85,' + (0.6 + glowI * 0.4) + '))';
                    }
                }
            }

            // ── タスクバー時計: prog%に応じてバグる ──
            var clockEl = document.getElementById('win95-clock');
            if (clockEl) {
                if (pv < 30) {
                    // 正常な時計
                    var now = new Date();
                    clockEl.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
                } else if (pv < 50) {
                    // 30-50%: 時々数字がブレる
                    var now2 = new Date();
                    var h = now2.getHours(), m = now2.getMinutes();
                    if (Math.random() < 0.15) { h = (h + Math.floor(Math.random() * 3) - 1 + 24) % 24; }
                    if (Math.random() < 0.2) { m = (m + Math.floor(Math.random() * 10) - 5 + 60) % 60; }
                    clockEl.textContent = h + ':' + String(m).padStart(2, '0');
                } else if (pv < 75) {
                    // 50-75%: 時間が加速・逆走
                    var glitchChars = '0123456789';
                    var gh = glitchChars[Math.floor(Math.random()*3)] + glitchChars[Math.floor(Math.random()*10)];
                    var gm = glitchChars[Math.floor(Math.random()*6)] + glitchChars[Math.floor(Math.random()*10)];
                    clockEl.textContent = gh + ':' + gm;
                } else if (pv < 101) {
                    // 75-100%: 完全崩壊 — 記号と数字が混在
                    var chaos = '█▓░▒∞?!@#$%^&*0123456789:';
                    var ct = '';
                    for (var ci = 0; ci < 5; ci++) { ct += chaos[Math.floor(Math.random() * chaos.length)]; }
                    clockEl.textContent = ct;
                    clockEl.style.color = Math.random() < 0.3 ? '#ff0000' : '#000';
                } else {
                    // 101%: ∞:∞
                    clockEl.textContent = '∞:∞';
                    clockEl.style.color = '#ff0000';
                }
            }

            // ── タスクバー Start→EXIT 変化 ──
            var startText = document.getElementById('win95-start-text');
            var startLogo = document.getElementById('win95-start-logo');
            var startBtn = document.getElementById('win95-start-btn');
            if (startText) {
                if (pv >= 101) {
                    startText.textContent = 'EXIT';
                    if (startBtn) { startBtn.style.background = '#00aa44'; startBtn.style.color = '#fff'; }
                    // Windowsロゴ → 非常口ミニアイコンに変更
                    if (startLogo) startLogo.innerHTML = '<rect width="14" height="14" rx="1" fill="#009a44"/><circle cx="5" cy="4" r="1.5" fill="#fff"/><line x1="5" y1="5.5" x2="5" y2="9" stroke="#fff" stroke-width="1.2"/><line x1="5" y1="9" x2="3" y2="12" stroke="#fff" stroke-width="1"/><line x1="5" y1="9" x2="8" y2="12" stroke="#fff" stroke-width="1"/><rect x="9" y="3" width="4" height="8" fill="#fff"/>';
                } else if (pv >= 75) {
                    // 75%以降: テキストがグリッチ
                    var glitchTexts = ['Start', 'St@rt', 'S̷tart', 'EXIT?', 'St█rt'];
                    startText.textContent = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
                }
            }

            // ── CONSUME背景浸食: teal → RGBCMYグラデーション ──
            if (pv >= 75 && pv < 101) {
                var rainbowT = (pv - 75) / 26; // 0→1
                var hue = Math.floor(globalTime * 30) % 360;
                var saturation = Math.floor(rainbowT * 70); // 0→70%
                renderer.setClearColor(new THREE.Color('hsl(' + hue + ',' + saturation + '%,25%)'));
            } else if (pv < 75) {
                renderer.setClearColor(0x008080, 1); // teal維持
            }
        }

        // ── MAIN TICK ──
        function tick() {
            if (!alive) return;
            const dt = Math.min(clk.getDelta(), 0.05);
            globalTime += dt;

            // ── ランナーフレーム更新 ──
            updateRunnerFrame(dt);
            updateBarGlitch(dt);

            // ── AUTO-TICK (rAF版: setInterval廃止) ──
            if (phase !== PH.DONE && !EVENT_PHASES.includes(phase)) {
                let rate = AUTO_RATE[phase] !== undefined ? AUTO_RATE[phase] : 5.0;
                // CONSUME フェーズ: 区間ごとに速度変更
                if (phase === PH.CONSUME) {
                    if (prog >= 100) {
                        rate = CONSUME_SPEED_FINAL;
                    } else if (prog >= 99) {
                        rate = CONSUME_SPEED_DRAMATIC;
                    } else if (prog >= 75) {
                        rate = CONSUME_SPEED_NORMAL;
                    }
                }
                prog = Math.min(101, prog + rate * dt);
                showProg(prog);
            }

            // 101%フリーズ処理 — 1.5秒の「次元突破」演出
            if (freezeActive) {
                var freezeElapsed = (performance.now() - freezeStartMs) / 1000;

                // Phase 1 (0-0.15s): 完全ホワイトアウト — 時間停止の瞬間
                if (freezeElapsed < 0.15) {
                    bgMat.uniforms.u_flash.value = 1.0;
                    if (bloom) bloom.strength = 5.0;
                    return; // 完全静止
                }

                // Phase 2 (0.15-0.8s): 数字暴走 — 101→999→∞
                if (freezeElapsed < 0.8) {
                    var ft = (freezeElapsed - 0.15) / 0.65;
                    // フラッシュ急減衰
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - ft * 2.0);
                    if (bloom) bloom.strength = 5.0 - ft * 3.5;
                    // 数字暴走: 101→120→200→500→999→∞
                    var pctEl = document.getElementById('p1-lpct');
                    var pcPct = document.getElementById('phase-c-pct');
                    if (ft < 0.3) {
                        var num = Math.floor(101 + ft / 0.3 * 899);
                        if (pctEl) pctEl.textContent = 'Loading reality... ' + num + '%';
                        if (pcPct) pcPct.textContent = 'LOADING REALITY... ' + num + '%';
                    } else if (ft < 0.6) {
                        // 数字がグリッチ
                        var glitchChars = '█▓░▒∞∞∞∞∞';
                        var gi = Math.floor(Math.random() * glitchChars.length);
                        if (pctEl) pctEl.textContent = 'Loading reality... ' + glitchChars[gi] + glitchChars[(gi+3)%glitchChars.length] + glitchChars[(gi+5)%glitchChars.length] + '%';
                        if (pcPct) pcPct.textContent = 'LOADING REALITY... ' + glitchChars[gi] + glitchChars[(gi+2)%glitchChars.length] + '%';
                    } else {
                        if (pctEl) pctEl.textContent = 'Loading reality... ∞%';
                        if (pcPct) pcPct.textContent = 'LOADING REALITY... ∞%';
                    }
                    // トンネルリングが爆発的に加速
                    tunnelMat.uniforms.u_scrollMul.value = 1.4 + ft * 3.0;
                    tunnelMat.uniforms.u_ringDensity.value = 11.0 + ft * 8.0;
                    // カメラ微振動（次元の壁が砕ける）
                    var shakeAmp = (1.0 - ft) * 4.0;
                    renderer.domElement.style.transform = 'translate(' + ((Math.random()-0.5)*shakeAmp) + 'px,' + ((Math.random()-0.5)*shakeAmp) + 'px)';
                    updateWin95Status('⚠ DIMENSION OVERFLOW: ∞%');
                }

                // Phase 3 (0.8-1.5s): 静寂 — ∞の余韻、全てが可能になった瞬間
                if (freezeElapsed >= 0.8 && freezeElapsed < 1.5) {
                    var ft2 = (freezeElapsed - 0.8) / 0.7;
                    bgMat.uniforms.u_flash.value = 0;
                    if (bloom) bloom.strength = 1.5 - ft2 * 1.0;
                    renderer.domElement.style.transform = 'translate(0,0)';
                    var pctEl2 = document.getElementById('p1-lpct');
                    var pcPct2 = document.getElementById('phase-c-pct');
                    if (pctEl2) pctEl2.textContent = 'Loading reality... ∞%';
                    if (pcPct2) pcPct2.textContent = 'BEYOND REALITY... ∞%';
                    updateWin95Status('You are now beyond 100%. Anything is possible.');
                    // トンネルが深呼吸するように脈動
                    tunnelMat.uniforms.u_radius.value = 0.60 + Math.sin(freezeElapsed * 4.0) * 0.03;
                }

                if (freezeElapsed >= 1.5) {
                    freezeActive = false;
                    renderer.domElement.style.transform = 'translate(0,0)';
                    if (phase === PH.CONSUME) {
                        phase = PH.EVENT_COLLAPSE;
                        eventTimer = 0;
                        progPaused = true;
                    }
                }
                // フリーズ中もシェーダーu_timeは更新（トンネルアニメ用）
                bgMat.uniforms.u_time.value = globalTime;
                if (tunnelPlane.visible) tunnelMat.uniforms.u_time.value = globalTime;
                if (warpTunnelPlane.visible) warpTunnelMat.uniforms.u_time.value = globalTime;
                // フリーズ中もレンダリングは続ける（ホワイトアウト/トンネルを描画）
                if (scissor.enabled) {
                    renderer.setScissorTest(true);
                    renderer.setScissor(scissor.x, scissor.y, scissor.w, scissor.h);
                    renderer.setViewport(scissor.x, scissor.y, scissor.w, scissor.h);
                }
                if (composer) composer.render(); else renderer.render(scene, camera);
                return;
            }

            bgMat.uniforms.u_time.value = globalTime;
            fieldMat.uniforms.u_time.value = globalTime;
            if (warpTunnelPlane.visible) { warpTunnelMat.uniforms.u_time.value = globalTime; }
            if (yyPlane.visible) yyMat.uniforms.u_time.value = globalTime;
            if (tunnelPlane.visible) tunnelMat.uniforms.u_time.value = globalTime;
            if (greySphere.visible) greySphereMat.uniforms.u_time.value = globalTime;
            if (haloPlane.visible) haloMat.uniforms.u_time.value = globalTime;
            if (scPlane.visible) scMat.uniforms.u_time.value = globalTime;
            if (eyePlane.visible) eyeMat.uniforms.u_time.value = globalTime;
            if (bDot.visible && bDot.material.uniforms && bDot.material.uniforms.u_time) {
                bDot.material.uniforms.u_time.value = globalTime;
            }
            if (wDot.visible && wDot.material.uniforms && wDot.material.uniforms.u_time) {
                wDot.material.uniforms.u_time.value = globalTime;
            }

            // ── CMYシェーダー位置同期（プロキシ→uniform） ──
            cmyShaderMat.uniforms.u_c0.value.set(cmyP[0].position.x, cmyP[0].position.y);
            cmyShaderMat.uniforms.u_c1.value.set(cmyP[1].position.x, cmyP[1].position.y);
            cmyShaderMat.uniforms.u_c2.value.set(cmyP[2].position.x, cmyP[2].position.y);
            cmyShaderMat.uniforms.u_scale.value = cmyP[0].scale.x;
            cmyShaderMat.uniforms.u_visible.value = cmyP[0].visible ? 1.0 : 0.0;

            // ── ピクセルサイズ制御（progressに応じて解像度が上がる） ──
            const pixelSize = prog < 50 ? 8.0 :
                              prog < 75 ? 4.0 :
                              prog < 90 ? 2.0 : 1.0;
            [bgMat, tunnelMat, yyMat].forEach(mat => {
                if (mat?.uniforms?.u_pixelSize) {
                    mat.uniforms.u_pixelSize.value = pixelSize;
                }
            });
            // ── ld-logoグロー＋サイズ進化 ──
            const logoEl2 = document.getElementById('ld-logo');
            if (logoEl2) {
                // アニメーション速度: 進行するほど速く脈動
                const spd = prog < 30  ? '2.0s' :
                            prog < 50  ? '1.4s' :
                            prog < 75  ? '0.9s' :
                                         '0.5s';
                logoEl2.style.animationDuration = spd;
                // サイズ: 52px → 68px（進行に合わせて成長）
                const logoScale = 52 + (prog / 101) * 16;
                logoEl2.style.width = logoScale + 'px';
                logoEl2.style.height = logoScale + 'px';
            }

            // 数字暴走表示
            if (numberRampageActive) {
                const rampageElapsed = globalTime - numberRampageStartTime;
                if (rampageElapsed < 0.5) {
                    // 0.5秒で 101 → 99999 へ指数的に増加
                    const t = rampageElapsed / 0.5;
                    numberRampageVal = Math.floor(101 + Math.pow(t, 2) * 99898);
                    const pcPct = document.getElementById('phase-c-pct');
                    if (pcPct) pcPct.textContent = 'LOADING REALITY... ' + numberRampageVal + '%';
                } else {
                    // 0.5秒後: ∞ 表示
                    const pcPct = document.getElementById('phase-c-pct');
                    if (pcPct) pcPct.textContent = 'LOADING REALITY... ∞';
                }
            }

            // ═══ PHASE 0: ATTRACT (0→30%) ═══
            if (phase === PH.ATTRACT) {
                updateWin95Status('Initializing reality engine...');
                if (bloom) bloom.strength = 0;
                bgMat.uniforms.u_grey.value = 0.0; // 純白/純黒を維持
                const t = prog / 30; // 0→1

                // ── 2%から動き出す: 3段階の引力 ──
                // Phase A (0-7%): 微かな呼吸・脈動。存在を感じる
                // Phase B (7-20%): ゆっくり引き寄せ。距離が縮まる
                // Phase C (20-30%): 加速。もう止められない
                let easeT;
                if (t < 0.07) {
                    easeT = 0; // 最初の2%はまだ静止
                } else if (t < 0.23) {
                    // 7-23% (2-7%相当): 超ゆっくり動き出し
                    const localT = (t - 0.07) / 0.16;
                    easeT = localT * localT * 0.05; // ほんの少し
                } else if (t < 0.67) {
                    // 23-67% (7-20%相当): 段階的に加速
                    const localT = (t - 0.23) / 0.44;
                    easeT = 0.05 + localT * localT * 0.2;
                } else {
                    // 67-100% (20-30%相当): 急加速→融合へ
                    const localT = (t - 0.67) / 0.33;
                    easeT = 0.25 + localT * localT * 0.75;
                }

                // CMY: 物質の引力 — 2%から微かに呼吸、徐々に接近
                cmyP.forEach((p, i) => {
                    // 呼吸: 2%から始まる微かな脈動（引力を感じている）
                    const breathAmp = t > 0.07 ? 0.003 * Math.min(1, (t - 0.07) / 0.3) : 0;
                    const breathX = Math.sin(globalTime * 1.2 + i * 2.1) * breathAmp;
                    const breathY = Math.cos(globalTime * 0.9 + i * 1.7) * breathAmp;
                    p.position.x = cmyCtr.x + cmyTriPos[i][0] * (1 - easeT) + breathX;
                    p.position.y = cmyCtr.y + cmyTriPos[i][1] * (1 - easeT) + breathY;
                    // 引き伸ばし（近づくほど強い）
                    const dist = Math.sqrt(cmyTriPos[i][0]*cmyTriPos[i][0] + cmyTriPos[i][1]*cmyTriPos[i][1]) * (1 - easeT);
                    const stretch = 1.0 + dist * 0.05;
                    p.scale.set(1.0 / stretch, stretch, 1.0 / stretch);
                });
                // RGB: 精神の振動 — 2%から微かに揺らぎ、徐々に引き寄せ
                rgbP.forEach((p, i) => {
                    // 振動: 最初は強く（精神は自由）→ 近づくと抑制
                    const jAmt = 0.008 * (1 - easeT * 0.9);
                    // 2%から引力方向への微かなドリフト
                    const driftAmp = t > 0.07 ? 0.002 * Math.min(1, (t - 0.07) / 0.2) : 0;
                    const driftX = Math.sin(globalTime * 0.5 + i) * driftAmp;
                    const driftY = Math.cos(globalTime * 0.4 + i) * driftAmp;
                    const jx = Math.sin(globalTime * 7.3 + i) * jAmt + driftX;
                    const jy = Math.cos(globalTime * 5.1 + i) * jAmt + driftY;
                    p.position.x = rgbCtr.x + rgbTriPos[i][0] * (1 - easeT) + jx;
                    p.position.y = rgbCtr.y + rgbTriPos[i][1] * (1 - easeT) + jy;
                });
                // 磁場線は0-30%では非表示
                fieldPlane.visible = false;
                if (prog >= 30) { phase = PH.EVENT_FUSE; eventTimer = 0; prog = 30; showProg(30); progPaused = true; triggerBarGlitch(); }

                // ═══ PHASE 1: EVENT_FUSE (30% — 3s fixed) ═══
            } else if (phase === PH.EVENT_FUSE) {
                updateWin95Status('⚠ REALITY.EXE is not responding...');
                eventTimer += dt;
                const et = eventTimer;

                // Step A (0-1.5s): 6球がゆっくり各重心へ — 引力が段階的に強まる
                if (et < 1.5) {
                    const t2 = et / 1.5;
                    // 3段階の引力: じわっと→加速→急収縮
                    var ease;
                    if (t2 < 0.4) {
                        ease = (t2 / 0.4) * (t2 / 0.4) * 0.15; // ほんのり近づく
                    } else if (t2 < 0.75) {
                        var lt = (t2 - 0.4) / 0.35;
                        ease = 0.15 + lt * lt * 0.35; // 加速
                    } else {
                        var lt2 = (t2 - 0.75) / 0.25;
                        ease = 0.5 + lt2 * lt2 * 0.5; // 急収縮
                    }
                    cmyP.forEach(function(p) {
                        p.position.x += (cmyCtr.x - p.position.x) * (0.02 + ease * 0.12);
                        p.position.y += (cmyCtr.y - p.position.y) * (0.02 + ease * 0.12);
                        p.scale.setScalar(1 - ease * 0.65);
                        if (p.material && p.material.emissiveIntensity !== undefined) {
                            p.material.emissiveIntensity = ease * 0.3;
                        }
                    });
                    rgbP.forEach(function(p) {
                        p.position.x += (rgbCtr.x - p.position.x) * (0.03 + ease * 0.15);
                        p.position.y += (rgbCtr.y - p.position.y) * (0.03 + ease * 0.15);
                        p.scale.setScalar(1 - ease * 0.55);
                    });
                    // 磁場線: 削除（ユーザー指示）
                    fieldPlane.visible = false;
                    if (bloom) bloom.strength = ease * 0.6;
                }

                // Step B (1.5-2.2s): 滑らかなクロスフェード — 6球→2球（黒白）
                if (et >= 1.5 && et < 2.2) {
                    const t2 = (et - 1.5) / 0.7;
                    const ease = t2 * t2 * (3 - 2 * t2); // smoothstep
                    // 6球を段階的にフェードアウト
                    cmyP.forEach(function(p) { p.scale.setScalar(Math.max(0.01, 0.35 * (1 - ease))); });
                    rgbP.forEach(function(p) { p.scale.setScalar(Math.max(0.01, 0.45 * (1 - ease))); });
                    // bDot/wDotを徐々にフェードイン
                    if (t2 > 0.2) {
                        const appear = (t2 - 0.2) / 0.8;
                        if (appear > 0.6) {
                            cmyP.forEach(function(p) { p.visible = false; });
                            rgbP.forEach(function(p) { p.visible = false; });
                        }
                        bDot.visible = true; bDot.position.set(cmyCtr.x, 0, 0);
                        wDot.visible = true; wDot.position.set(rgbCtr.x, 0, 0);
                        bDot.scale.setScalar(0.2 + appear * 0.8);
                        wDot.scale.setScalar(0.2 + appear * 0.8);
                    }
                    // フラッシュ: ゆるやかに上昇
                    bgMat.uniforms.u_flash.value = ease * 0.5;
                    if (bloom) bloom.strength = 0.6 + ease * 2.0;
                    fieldPlane.visible = false;
                }
                // 6球完全非表示
                if (et >= 2.2 && et < 2.3) {
                    cmyP.forEach(function(p) { p.visible = false; });
                    rgbP.forEach(function(p) { p.visible = false; });
                    bDot.scale.setScalar(1.0);
                    wDot.scale.setScalar(1.0);
                }

                // Step C (2.2-3.0s): フラッシュ減衰 + bDot/wDotが定位置へ
                if (et >= 2.2) {
                    const decay = Math.exp(-(et - 2.2) * 2.5);
                    bgMat.uniforms.u_flash.value = 0.5 * decay;
                    if (bloom) bloom.strength = Math.max(0, 2.6 * decay);
                }
                if (et >= 2.2 && et < 3.5) {
                    const t2 = (et - 2.2) / 1.3;
                    const ease = 1 - Math.pow(1 - t2, 2);
                    bDot.position.x += ((-1.2 * unit) - bDot.position.x) * (0.02 + ease * 0.06);
                    wDot.position.x += ((1.2 * unit) - wDot.position.x) * (0.02 + ease * 0.06);
                }

                // Step D (2.5-2.7s): 枠グロー（衝撃波の余韻）
                if (et >= 2.5 && et < 2.7) {
                    const t2 = (et - 2.5) / 0.2;
                    const glow = Math.sin(t2 * Math.PI);
                    sqBorder.style.boxShadow = '0 0 ' + (glow * 25) + 'px rgba(255,255,255,' + (glow * 0.8) + '), inset 0 0 ' + (glow * 12) + 'px rgba(255,255,255,' + (glow * 0.4) + ')';
                }
                if (et >= 2.7) {
                    sqBorder.style.boxShadow = 'none';
                }

                // Step E (4.0-4.5s): DUALITY移行前の「静」— bloom消灯、呼吸の間
                if (et >= 4.0) {
                    if (bloom) bloom.strength = Math.max(0, bloom.strength - dt * 0.5);
                }

                if (et >= 4.5) { phase = PH.DUALITY; progPaused = false; }

                // ═══ PHASE 2: DUALITY (30→50%) ═══
            } else if (phase === PH.DUALITY) {
                updateWin95Status('Resolving duality conflict...');
                if (bloom) bloom.strength = 0;
                // 背景: 純白/純黒のまま維持（50%の衝突まで色は混ざらない）
                bgMat.uniforms.u_grey.value = 0.0;
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
                // bDot/wDotは純黒・純白のまま維持（50%衝突まで混ざらない）
                bDotMat.uniforms.u_greyMix.value = 0.0;
                wDotMat.uniforms.u_greyMix.value = 0.0;
                if (prog >= 50) { phase = PH.EVENT_SING; eventTimer = 0; prog = 50; showProg(50); progPaused = true; singDimSwitched = false; singShakeFrame = 0; triggerBarGlitch(); }

                // ═══ PHASE 3: EVENT_SING (50% — 6s) — 白黒融合→グレー球（一瞬の陰陽） ═══
            } else if (phase === PH.EVENT_SING) {
                eventTimer += dt;
                const et = eventTimer;

                // 物理パラメータ解放 (一回だけ)
                if (!singDimSwitched) {
                    singDimSwitched = true;
                    renderer.setPixelRatio(window.devicePixelRatio);
                    bgMat.uniforms.u_pixelSize.value = 1.0;
                    if (yyMat.uniforms.u_pixelSize) yyMat.uniforms.u_pixelSize.value = 1.0;
                    // DUALITYの引き伸ばしをリセット
                    bDot.scale.setScalar(1); wDot.scale.setScalar(1);
                    bDot.position.y = 0; wDot.position.y = 0;
                }

                // ═══ Step A (0-1.5s): 白黒が真ん中で衝突 ═══
                if (et < 1.5) {
                    var t = et / 1.5;
                    var ease = t * t * (3 - 2 * t);
                    bgMat.uniforms.u_flash.value = 0;
                    bgMat.uniforms.u_grey.value = 0;
                    bgMat.uniforms.u_vortex.value = 0.0;
                    bDot.visible = true; wDot.visible = true;
                    bDot.scale.setScalar(1); wDot.scale.setScalar(1);
                    bDotMat.uniforms.u_greyMix.value = 0;
                    wDotMat.uniforms.u_greyMix.value = 0;
                    // 中心へ加速接近
                    var dist = (1 - ease) * 1.2 * unit;
                    bDot.position.set(-dist, 0, 0);
                    wDot.position.set(dist, 0, 0);
                    if (bloom) bloom.strength = 0.3 + ease * 0.3;
                    yyPlane.visible = false; greySphere.visible = false; haloPlane.visible = false;
                    updateWin95Status('⚠ REALITY.SYS MERGING...');
                }

                // ═══ Step B (1.5-2.0s): 衝突フラッシュ→一瞬の陰陽→グレー球誕生 ═══
                if (et >= 1.5 && et < 2.0) {
                    var t = (et - 1.5) / 0.5;
                    bDot.visible = false; wDot.visible = false; // 二度と戻さない
                    haloPlane.visible = false;

                    if (t < 0.2) {
                        // 衝突フラッシュ
                        bgMat.uniforms.u_flash.value = (1 - t / 0.2) * 0.8;
                        if (bloom) bloom.strength = 1.5 + (1 - t / 0.2) * 2.0;
                        if (caPass) caPass.uniforms.u_ca.value = (1 - t / 0.2) * 0.02;
                        yyPlane.visible = false; greySphere.visible = false;
                    } else if (t < 0.6) {
                        // 一瞬の陰陽（0.2秒）— 気づきの瞬間
                        var yyT = (t - 0.2) / 0.4;
                        bgMat.uniforms.u_flash.value = 0;
                        if (caPass) caPass.uniforms.u_ca.value = 0;
                        yyPlane.visible = true;
                        yyPlane.position.z = 0.5;
                        yyPlane.scale.setScalar(0.8);
                        yyMat.uniforms.u_alpha.value = (yyT < 0.5 ? yyT * 2 : 2 - yyT * 2) * 0.7;
                        yyMat.uniforms.u_rot.value = et * 1.5;
                        yyMat.uniforms.u_grey.value = 0;
                        greySphere.visible = false;
                        if (bloom) bloom.strength = 1.0 + (1 - yyT) * 0.5;
                    } else {
                        // 陰陽消滅→グレー球がその場に
                        var gT = (t - 0.6) / 0.4;
                        var gE = gT * gT;
                        yyPlane.visible = false;
                        bgMat.uniforms.u_flash.value = 0;
                        bgMat.uniforms.u_grey.value = gE * 1.5;
                        greySphere.visible = true;
                        greySphere.position.set(0, 0, 0.5);
                        greySphere.scale.setScalar(0.5 + gE * 0.5);
                        greySphereMat.uniforms.u_opacity.value = gE;
                        greySphereMat.uniforms.u_glow.value = gE * 0.03;
                        greySphereMat.uniforms.u_rainbow.value = 0;
                        if (bloom) bloom.strength = 0.5 + gE * 0.3;
                    }
                    updateWin95Status('DIMENSIONS CONVERGING...');
                }

                // ═══ Step C (2.0-4.0s): グレー球が呼吸＋トンネルの気配 ═══
                if (et >= 2.0 && et < 4.0) {
                    var t = (et - 2.0) / 2.0;
                    var ease = t * t * t;
                    bDot.visible = false; wDot.visible = false; yyPlane.visible = false;
                    bgMat.uniforms.u_vortex.value = 0.0;
                    bgMat.uniforms.u_grey.value = 2.0;
                    bgMat.uniforms.u_flash.value = 0;
                    greySphere.visible = true;
                    greySphere.position.set(0, 0, 0.5);
                    var breath = Math.sin(et * 1.5) * 0.01;
                    greySphere.scale.setScalar(1.0 + breath);
                    greySphereMat.uniforms.u_opacity.value = 1.0;
                    greySphereMat.uniforms.u_glow.value = 0.04;
                    greySphereMat.uniforms.u_rainbow.value = 0;
                    tunnelPlane.visible = true;
                    tunnelMat.uniforms.u_radius.value = ease * 0.03;
                    tunnelMat.uniforms.u_alpha.value = ease * 0.08;
                    tunnelMat.uniforms.u_depth.value = ease * 0.05;
                    tunnelMat.uniforms.u_ringDensity.value = 2.0;
                    tunnelMat.uniforms.u_scrollMul.value = 0.1;
                    tunnelMat.uniforms.u_rainbow.value = 0;
                    haloPlane.visible = true;
                    haloMat.uniforms.u_glow.value = ease * 0.06;
                    if (bloom) bloom.strength = 0.2 + ease * 0.15;
                    updateWin95Status('Entering warp tunnel...');
                }

                if (et >= 4.0) { phase = PH.WARP_GROW; progPaused = false; yyPlane.visible = false; }

                // ═══ PHASE 4: WARP_GROW (50→75%) — グレー画面が徐々にチューブだと気づく ═══
            } else if (phase === PH.WARP_GROW) {
                if (!phaseCInited) {
                    phaseCInited = true;
                    bgPlane.visible = false;
                    tunnelPlane.visible = true;
                    // 渦巻きリセット
                    bgMat.uniforms.u_vortex.value = 0.0;
                    bgMat.uniforms.u_vortexAngle.value = 0.0;
                }
                updateWin95Status('Travelling through warp tunnel...');
                const wt = (prog - 50) / 25; // 0→1
                bgMat.uniforms.u_grey.value = 1.0 + wt * 1.0; // グレー→黒へ徐々に

                // wt 0-0.3: 微妙なエッジ暗化 — ほとんど気づかない深度
                // wt 0.3-0.7: チューブの壁が見えてくる — まだグレー
                // wt 0.7-1.0: 虹がグレー壁面から滲み出す
                const depthEase = wt < 0.3 ? Math.pow(wt / 0.3, 3) * 0.15
                    : wt < 0.7 ? 0.15 + ((wt - 0.3) / 0.4) * ((wt - 0.3) / 0.4) * 0.55
                    : 0.7 + ((wt - 0.7) / 0.3) * 0.3;
                const rainbowBleed = wt < 0.2 ? 0.0
                    : Math.min(1.0, ((wt - 0.2) / 0.8) * 0.7); // 早めにRGBCMY色を見せる

                // トンネル: グレーの平面から深度が現れる
                tunnelMat.uniforms.u_radius.value = 0.04 + depthEase * 0.24;
                tunnelMat.uniforms.u_alpha.value = 0.08 + depthEase * 0.42;
                tunnelMat.uniforms.u_depth.value = 0.05 + depthEase * 0.35;
                tunnelMat.uniforms.u_ringDensity.value = 2.0 + depthEase * 5.0;
                tunnelMat.uniforms.u_scrollMul.value = 0.1 + depthEase * 0.5;
                tunnelMat.uniforms.u_rainbow.value = rainbowBleed;

                // ハロー
                haloPlane.visible = true;
                haloMat.uniforms.u_glow.value = 0.06 + wt * 0.17;

                // 球: 縮んでチューブの内部が見えてくる
                greySphere.visible = true;
                greySphere.rotation.y += dt * 0.2;
                greySphereMat.uniforms.u_glow.value = 0.04 + wt * 0.1;
                greySphereMat.uniforms.u_rainbow.value = rainbowBleed * 0.5;
                const shrink = 1.0 - wt * wt * 0.3;
                const pulse = 1 + Math.sin(globalTime * 2) * 0.01;
                greySphere.scale.setScalar(shrink * pulse);
                if (bloom) bloom.strength = 0.15 + wt * 0.2;

                if (prog >= 75) { phase = PH.EVENT_BREACH; eventTimer = 0; prog = 75; showProg(75); progPaused = true; triggerBarGlitch(); }

                // ═══ PHASE 5: EVENT_BREACH (75% — 4s fixed) — トンネル成長（デモPhase4） ═══
            } else if (phase === PH.EVENT_BREACH) {
                updateWin95Status('Breaching reality boundary...');
                eventTimer += dt;
                const et = eventTimer;
                const p = Math.min(et / 4.0, 1.0); // 4秒かけて
                const ease = 1 - Math.pow(1 - p, 2);
                bgMat.uniforms.u_grey.value = 2.0; // 背景黒維持

                // トンネル成長 — 壁が迫ってくる感覚（グレー壁面 + 虹の滲み増加）
                tunnelPlane.visible = true;
                tunnelMat.uniforms.u_radius.value = 0.28 + ease * 0.22;
                tunnelMat.uniforms.u_alpha.value = 0.50 + ease * 0.35;
                tunnelMat.uniforms.u_depth.value = 0.4 + ease * 0.4;
                tunnelMat.uniforms.u_ringDensity.value = 7.0 + ease * 3.0;
                tunnelMat.uniforms.u_scrollMul.value = 0.60 + ease * 0.60;
                tunnelMat.uniforms.u_rainbow.value = 0.7 + ease * 0.2; // RGBCMY色をしっかり見せる

                // 球: ゆっくり縮み
                greySphere.visible = true;
                greySphere.rotation.y += dt * 0.15;
                const shrinkEase = p * p;
                greySphereMat.uniforms.u_glow.value = 0.14 - shrinkEase * 0.05;
                greySphereMat.uniforms.u_rainbow.value = 0.3 + p * 0.3;
                greySphere.scale.setScalar((0.75 - shrinkEase * 0.2) * (1 + Math.sin(globalTime * 2.5) * 0.01));
                // ハロー
                haloPlane.visible = true;
                haloMat.uniforms.u_glow.value = 0.28 - shrinkEase * 0.08;

                // スクエア境界のグロー（UI演出）
                const g = 40 + p * 40;
                sqBorder.style.borderColor = 'rgba(255,255,255,' + (0.05 + p * 0.15) + ')';
                sqBorder.style.boxShadow = '0 0 ' + g + 'px 15px rgba(255,100,255,0.2),0 0 ' + (g * 1.5) + 'px 30px rgba(100,255,255,0.15)';
                if (logoEl) {
                    const breachAt = p;
                    logoEl.style.filter = `drop-shadow(0 0 ${8 + breachAt * 12}px #00ff44)`;
                }
                if (bloom) bloom.strength = 0.15 + ease * 0.2; // max 0.35

                if (et >= 4.0) { phase = PH.CONSUME; progPaused = false; sqBorder.style.borderColor = 'transparent'; }

                // ═══ PHASE 6: CONSUME (75→101%) — 虹の覚醒、グレー壁が完全レインボーへ ═══
            } else if (phase === PH.CONSUME) {
                updateWin95Status('Approaching the light...');
                const at = (prog - 75) / 26; // 0→1
                const consumeEase = 1 - Math.pow(1 - Math.min(at, 1.0), 2);
                bgMat.uniforms.u_grey.value = 2.0; // 黒維持

                // 球フェードアウト
                const shrinkP = at * at;
                greySphere.visible = at < 0.5;
                if (at < 0.5) {
                    greySphere.scale.setScalar(Math.max(0.05, 0.77 * (1 - shrinkP * 0.8)));
                    greySphereMat.uniforms.u_opacity.value = Math.max(0, 1.0 - shrinkP * 1.2);
                    greySphereMat.uniforms.u_glow.value = 0.14 * (1 - at);
                    greySphereMat.uniforms.u_rainbow.value = 0.5 + at * 0.5;
                }

                // ハロー減衰（球が消えるにつれて）
                haloPlane.visible = at < 0.5;
                if (at < 0.5) haloMat.uniforms.u_glow.value = 0.20 * (1 - shrinkP);

                // トンネル完成へ — 虹がグレー壁面を覆い尽くす
                // EVENT_BREACH終了値から連続: radius=0.50, alpha=0.85, depth=0.80, ringD=10, scroll=1.2, rainbow=0.90
                var consumeBreath = Math.sin(globalTime * 1.2) * 0.02;
                tunnelMat.uniforms.u_radius.value = 0.50 + consumeEase * 0.10 + consumeBreath * consumeEase;
                tunnelMat.uniforms.u_alpha.value = 0.85 + consumeEase * 0.15;
                tunnelMat.uniforms.u_depth.value = 0.80 + consumeEase * 0.15;
                tunnelMat.uniforms.u_ringDensity.value = 10.0 + consumeEase * 1.0;
                tunnelMat.uniforms.u_scrollMul.value = 1.2 + consumeEase * 0.3;
                // RGBCMY色: 0.90 → 1.0 (ほぼフルカラー)
                tunnelMat.uniforms.u_rainbow.value = 0.90 + consumeEase * 0.10;
                // u_progress removed — new tunnel uses u_depth/u_ringDensity/u_scrollMul

                // スクエア枠がトンネルの光で照らされる
                const g = 40 + at * 40;
                sqBorder.style.boxShadow = '0 0 ' + g + 'px 15px rgba(255,100,255,0.2),0 0 ' + (g * 1.5) + 'px 30px rgba(100,255,255,0.15)';
                if (bloom) bloom.strength = 0.2 + at * 0.15; // max 0.35

                if (prog >= 101 && !freezeActive) {
                    prog = 101; showProg(101); progPaused = true;
                    freezeActive = true;
                    freezeStartMs = performance.now();
                    // 101%到達: ホワイトフラッシュ + bloom爆発
                    bgMat.uniforms.u_flash.value = 1.0;
                    if (bloom) bloom.strength = 5.0;
                    updateWin95Status('⚠ 101% — REALITY LIMIT EXCEEDED');
                }

                // ═══ PHASE 7: EVENT_COLLAPSE — トンネルが溢れ出す ═══
            } else if (phase === PH.EVENT_COLLAPSE) {
                // 数字暴走は廃止 — 101%のまま固定表示
                eventTimer += dt;
                const et = eventTimer;
                updateWin95Status('Shutting down current dimension...');
                greySphere.visible = false; // 球は既に消えているはずだが念のため
                haloPlane.visible = false;  // ハロー消す
                // トンネル最終形態: フルレインボー
                tunnelMat.uniforms.u_radius.value = 0.60 + Math.sin(globalTime * 1.2) * 0.02;
                tunnelMat.uniforms.u_alpha.value = 1.0;
                tunnelMat.uniforms.u_depth.value = 0.9;
                tunnelMat.uniforms.u_ringDensity.value = 11.0;
                tunnelMat.uniforms.u_scrollMul.value = 1.4;
                tunnelMat.uniforms.u_rainbow.value = 1.0;

                // Step 1 (0-1.5s): グリッチ破壊 — OSがクラッシュする
                if (et < 1.5) {
                    const t2 = et / 1.5, ease = t2 * t2 * t2;

                    // Win95ウィンドウ: グリッチ破壊
                    const win95s = document.getElementById('win95-main');
                    if (win95s && win95s.style.display !== 'none') {
                        // スクリーンティア: 水平方向のずれ
                        const tearOffset = Math.sin(et * 30) * ease * 20;
                        const tearY = Math.sin(et * 15) * ease * 10;
                        win95s.style.transform = `translate(${tearOffset}px, ${tearY}px)`;
                        // カラーチャンネル破壊
                        const hueShift = Math.random() * ease * 360;
                        const saturate = 1 + ease * 5;
                        const contrast = 1 + Math.sin(et * 20) * ease * 2;
                        win95s.style.filter = `hue-rotate(${hueShift}deg) saturate(${saturate}) contrast(${contrast})`;
                        // 不透明度フリッカー
                        win95s.style.opacity = String(1 - ease + Math.random() * 0.3 * ease);

                        // テキスト文字化け（t2 > 0.3 で開始）
                        if (t2 > 0.3) {
                            const glitchChars = '\u2588\u2593\u2591\u2592\u2590\u258C\u25A0\u25A1\u25CA\u25C6\u25C7\u25CB\u25CF\u256C\u256B\u256A\u253C\u254B\u2551\u2550\u2560\u2563\u2566\u2569';
                            const allText = win95s.querySelectorAll('span, div');
                            allText.forEach(function(el) {
                                if (el.children.length === 0 && el.textContent.length > 0 && Math.random() < ease) {
                                    var garbled = '';
                                    for (var gi = 0; gi < el.textContent.length; gi++) {
                                        garbled += Math.random() < ease ?
                                            glitchChars[Math.floor(Math.random() * glitchChars.length)] :
                                            el.textContent[gi];
                                    }
                                    el.textContent = garbled;
                                }
                            });
                        }

                        // スタティックノイズオーバーレイ（t2 > 0.6）
                        if (t2 > 0.6) {
                            win95s.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
                            win95s.style.backgroundBlendMode = 'overlay';
                        }
                    }

                    // プログレスバー・ロゴ・パーセント表示のグリッチ
                    if (barWrap) {
                        barWrap.style.transition = 'none';
                        barWrap.style.filter = `hue-rotate(${Math.random() * ease * 360}deg)`;
                        barWrap.style.opacity = String(1 - ease);
                    }
                    if (logoEl) {
                        logoEl.style.filter = `hue-rotate(${Math.random() * ease * 360}deg) brightness(${1 + ease * 3})`;
                        logoEl.style.opacity = String(1 - ease);
                    }
                    pct.style.opacity = String(1 - ease);

                    // Phase C progress bar グリッチ
                    const pcBarWrap = document.getElementById('phase-c-bar-wrap');
                    if (pcBarWrap) {
                        pcBarWrap.style.transition = 'none';
                        pcBarWrap.style.filter = `hue-rotate(${Math.random() * ease * 360}deg)`;
                        pcBarWrap.style.opacity = String(Math.max(0, 1 - ease));
                    }
                }
                if (et >= 1.5 && et < 1.55) {
                    if (barWrap) barWrap.style.display = 'none'; pct.style.display = 'none';
                    if (logoEl) logoEl.style.display = 'none';
                    const pcBarWrap2 = document.getElementById('phase-c-bar-wrap');
                    if (pcBarWrap2) pcBarWrap2.style.display = 'none';
                    const win95hide = document.getElementById('win95-main');
                    if (win95hide) win95hide.style.display = 'none';
                    wrap.querySelectorAll('.p1-orb').forEach(o => o.style.display = 'none');
                    // タスクバーも消す
                    if (wrap) {
                        wrap.querySelectorAll('div').forEach(el => {
                            if (el.style.position === 'absolute' && (el.style.bottom === '0px' || el.style.bottom === '0')) {
                                el.style.display = 'none';
                            }
                        });
                    }
                    // CRTスキャンラインも消す
                    const scanlines = wrap.querySelector('div[style*="repeating-linear-gradient(0deg"]');
                    if (scanlines) scanlines.style.display = 'none';
                    // Hide all non-tunnel 3D objects
                    bgPlane.visible = false;
                    fieldPlane.visible = false;
                    bDot.visible = false; wDot.visible = false;
                    yyPlane.visible = false;
                    cmyP.forEach(p => p.visible = false);
                    rgbP.forEach(p => p.visible = false);
                    // scissor解除 → フルスクリーントンネルへ
                    scissor.enabled = false;
                    renderer.setScissorTest(false);
                    renderer.setViewport(0, 0, W, H);
                    camera.left = -camW; camera.right = camW;
                    camera.top = camH; camera.bottom = -camH;
                    camera.updateProjectionMatrix();
                    // ワープリング: 外向きに加速開始
                    warpTunnelPlane.visible = true;
                    warpTunnelMat.uniforms.u_direction.value = 1.0;
                    warpTunnelMat.uniforms.u_alpha.value = 1.0;
                    warpTunnelMat.uniforms.u_speed.value = 0.06;
                    warpTunnelMat.uniforms.u_progress.value = 0.0;
                }

                // ワープリング加速: et 1.5以降、滑らかに膨張
                if (et >= 1.5 && et < 7.0) {
                    const rt = Math.min(1.0, (et - 1.5) / 5.5);
                    // smoothstepで自然な加速（急激な変化を避ける）
                    const smoothRt = rt * rt * (3 - 2 * rt);
                    warpTunnelMat.uniforms.u_speed.value = 0.06 + smoothRt * 2.0;
                    warpTunnelMat.uniforms.u_progress.value = Math.min(1.0, smoothRt * 1.1);
                }

                // Step 2 (1.5-3.5s): Square border fades + mask expands → TUNNEL OVERFLOWS
                if (et >= 1.5 && et < 3.5) {
                    const t2 = (et - 1.5) / 2.0, eased = t2 * t2 * t2;
                    sqBorder.style.opacity = String(Math.max(0, 1 - eased * 3));
                    // Expand scissor from square to full screen
                    const curW = sqPx + (W - sqPx) * eased;
                    const curH = sqPx + (H - sqPx) * eased;
                    scissor.x = Math.round(W / 2 - curW / 2);
                    scissor.y = Math.round(H / 2 - curH / 2);
                    scissor.w = Math.round(curW);
                    scissor.h = Math.round(curH);
                    if (bloom) bloom.strength = 0.3 + eased * 0.2;
                }

                // Step 3 (3.5-6.0s): トンネル加速 — 回転なし、純粋な加速感
                if (et >= 3.5 && et < 6.0) {
                    if (!silenceTriggered) {
                        silenceTriggered = true;
                        try {
                            if (typeof audioContext !== 'undefined' && audioContext) {
                                audioContext.suspend();
                            }
                        } catch(e) {}
                    }
                    const t2 = (et - 3.5) / 2.5;
                    // smoothstepで滑らかに加速（違和感のない自然な引き込み）
                    const eased = t2 * t2 * (3 - 2 * t2);
                    sqBorder.style.display = 'none';
                    scissor.enabled = false;
                    // カメラは真っ直ぐ前進（回転なし — 自然な吸い込み感）
                    camera.position.z = 50 - eased * 35;
                    camera.rotation.z = 0; // 回転リセット
                    // トンネルスケールを滑らかに縮小（ズームイン）
                    tunnelMat.uniforms.u_scale.value = 3.0 * (1.0 - eased * 0.35);
                    // スクロール速度を段階的に上げる
                    tunnelMat.uniforms.u_scrollMul.value = 1.4 + eased * 1.5;
                    if (bloom) bloom.strength = 0.3 + eased * 0.15;
                }

                // Step 3.5 (5.5-6.0s): 光の中心に収束
                if (et >= 5.5 && et < 6.0) {
                    const pre = (et - 5.5) / 0.5;
                    const preEase = pre * pre;
                    tunnelMat.uniforms.u_scale.value = 3.0 * (1.0 - 0.35 - preEase * 0.25);
                    if (bloom) bloom.strength = 0.45 + preEase * 0.15;
                    renderer.setClearColor(0x000000, 1);
                }

                // Step 4 (6.0-7.5s): トンネルの奥の白い光がどんどん近づいてくる
                if (et >= 6.0 && et < 7.5) {
                    var t2 = (et - 6.0) / 1.5;
                    var eased = t2 * t2;
                    // トンネルのスケールがさらに縮む → 焦点光に吸い込まれる
                    tunnelMat.uniforms.u_scale.value = 3.0 * (1.0 - 0.60 - eased * 0.25);
                    // 虹が最大に → グレー壁が完全に色で溢れる
                    tunnelMat.uniforms.u_rainbow.value = 1.0;
                    // 中心の白い光が画面を飲み込む
                    whiteOv.style.background = '#fff';
                    whiteOv.style.opacity = String(eased * 0.95);
                    if (bloom) bloom.strength = 0.6 + eased * 3.0;
                    renderer.setClearColor(0x000000, 1);
                }

                // Step 5 (7.5-8.5s): 白い光の中 → 目が閉じる（暗闘へ）
                if (et >= 7.5 && et < 8.5) {
                    var t2 = (et - 7.5) / 1.0;
                    // 白い光の余韻 → ゆっくり暗闇へ
                    tunnelPlane.visible = false;
                    warpTunnelPlane.visible = false;
                    bgPlane.visible = false;
                    scPlane.visible = false;
                    scissor.enabled = false;
                    if (t2 < 0.4) {
                        // まだ白い光の中
                        whiteOv.style.background = '#fff';
                        whiteOv.style.opacity = '1';
                        if (bloom) bloom.strength = 3.6 * (1 - t2);
                    } else {
                        // 白→暗闇へ（目が閉じていく）
                        var blackT = (t2 - 0.4) / 0.6;
                        var easeBlack = blackT * blackT;
                        whiteOv.style.background = 'linear-gradient(#000, #000)';
                        whiteOv.style.opacity = String(easeBlack);
                        if (bloom) bloom.strength = Math.max(0, 1.0 * (1 - blackT));
                    }
                    renderer.setClearColor(0x000000, 1);
                }

                // Step 6 (8.5-11.5s): 暗闇の中 → 閉じた目が開く — 瞼シェーダー
                if (et >= 8.5 && et < 11.5) {
                    whiteOv.style.background = '#000';
                    whiteOv.style.opacity = '1';
                    renderer.setClearColor(0x000000, 1);
                    scissor.enabled = false;
                    var eyeT = (et - 8.5) / 3.0;

                    // フェードイン: 暗闇からまぶたがじわっと浮かび上がる
                    var appear;
                    if (eyeT < 0.15) {
                        appear = (eyeT / 0.15) * (eyeT / 0.15); // ease-in
                    } else {
                        appear = 1.0;
                    }

                    // 目の開き: 3段階の有機的な動き
                    var eyeOpen;
                    if (eyeT < 0.2) {
                        eyeOpen = 0; // 暗闘の中のまぶた（閉じたまま）
                    } else if (eyeT < 0.4) {
                        // 微かに震える — 開こうとする意志
                        var lt = (eyeT - 0.2) / 0.2;
                        eyeOpen = lt * lt * 0.05; // ほんの隙間
                        eyeOpen += Math.sin(lt * 12.0) * 0.008 * lt; // 震え
                    } else if (eyeT < 0.8) {
                        // ゆっくり開く — 光が溢れてくる
                        var lt2 = (eyeT - 0.4) / 0.4;
                        eyeOpen = 0.05 + lt2 * lt2 * 0.55;
                    } else {
                        // パッと全開 — 覚醒
                        var lt3 = (eyeT - 0.8) / 0.2;
                        eyeOpen = 0.6 + Math.min(lt3, 1.0) * 0.4;
                    }

                    eyePlane.visible = true;
                    eyeMat.uniforms.u_open.value = eyeOpen;
                    eyeMat.uniforms.u_appear.value = appear;
                    eyeMat.uniforms.u_time.value = globalTime;
                    eyeMat.uniforms.u_cross.value = 0.0;
                    // bloom: 目が開くにつれて光が溢れる
                    if (bloom) bloom.strength = eyeOpen * 0.6;
                }

                // Step 7 (11.5-13.5s): 太陽十字架 ☉ 出現
                if (et >= 11.5 && et < 13.5) {
                    var crossT = (et - 11.5) / 2.0;
                    // smoothstep + 呼吸で有機的に出現
                    var crossEase = crossT * crossT * (3 - 2 * crossT);
                    eyePlane.visible = true;
                    eyeMat.uniforms.u_open.value = 1.0;
                    eyeMat.uniforms.u_appear.value = 1.0;
                    eyeMat.uniforms.u_time.value = globalTime;
                    eyeMat.uniforms.u_cross.value = crossEase;
                    // bloom: 十字架の光が増す
                    if (bloom) bloom.strength = 0.6 + crossEase * 3.5;
                    // whiteOvを薄く → 背景光として使う
                    whiteOv.style.background = '#000';
                    whiteOv.style.opacity = String(Math.max(0, 1.0 - crossEase * 0.3));
                }

                // Step 8 (13.5-14.5s): 太陽十字架が画面を飲み込む → ホワイトアウト → P2
                if (et >= 13.5 && et < 14.5) {
                    var finalT = (et - 13.5) / 1.0;
                    eyePlane.visible = finalT < 0.6;
                    eyeMat.uniforms.u_cross.value = 1.0 + finalT * 2.0;
                    eyeMat.uniforms.u_appear.value = 1.0;
                    whiteOv.style.background = '#fff';
                    whiteOv.style.opacity = String(Math.min(1, finalT * 1.8));
                    if (bloom) bloom.strength = 4.0 + finalT * 3.0;
                }

                // Step 9 (14.5s): BSOD → P2へ遷移
                if (et >= 14.5 && phase !== PH.DONE) {
                    phase = PH.DONE; alive = false;
                    // ── クリーンアップ: 全3Dリソース解放 ──
                    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.dispose) o.material.dispose(); } });
                    if (composer) { composer.passes.forEach(p => { if (p.dispose) p.dispose(); }); }
                    renderer.dispose(); renderer.domElement.remove();
                    if (whiteOv) whiteOv.remove(); wrap.remove(); ldCSS.remove();

                    // ── P1完了: P2へ直接遷移 ──
                    window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
                }
            }
        }






        // scissorはsq-borderのDOMRectから動的に計算

        // ══════════════════════════════════════════════════════
        //  RENDER LOOP
        // ══════════════════════════════════════════════════════
        (function renderLoop() {
            if (!alive) return;
            tick();
            updateScissorFromDOM(); // scissorをsq-borderにDOM同期
            if (scissor.enabled) {
                renderer.setScissorTest(true);
                renderer.setScissor(scissor.x, scissor.y, scissor.w, scissor.h);
                renderer.setViewport(scissor.x, scissor.y, scissor.w, scissor.h);
            } else {
                renderer.setScissorTest(false);
                renderer.setViewport(0, 0, W, H);
            }
            if (composer) composer.render(); else renderer.render(scene, camera);
            requestAnimationFrame(renderLoop);
        })();
    }, 800); // end setTimeout for P0→P1 CRT-off transition
    });
}
