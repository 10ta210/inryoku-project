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
  background:repeating-conic-gradient(#000 0deg 90deg,#fff 90deg 180deg) 0/2px 2px;
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
    .p0-wave-ball {
      position:fixed;
      border-radius:50%;
      pointer-events:none;
      z-index:9990;
      opacity:0;
      transform:translate(-50%,-50%);
      will-change:left,top,width,height,opacity,filter;
    }
  </style>

  <!-- Macダイアログ本体（System 7 ウィンドウ枠） -->
  <div id="mac-dialog" style="
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
            <filter id="wave-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood flood-color="#ffffff" flood-opacity="0.9" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="glow"/>
              <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx="80" cy="80" r="58" fill="none" stroke="#000000" stroke-width="0.5" stroke-dasharray="3 4"/>
          <!-- 上から時計回り: Cyan Green Blue Magenta Red Yellow (CMY+RGB交互) -->
          <circle id="px0" r="4" fill="#00FFFF" filter="url(#orb-glow-c)"/>
          <circle id="px1" r="4" fill="#00FF00" filter="url(#orb-glow-g)"/>
          <circle id="px2" r="4" fill="#0000FF" filter="url(#orb-glow-b)"/>
          <circle id="px3" r="4" fill="#FF00FF" filter="url(#orb-glow-m)"/>
          <circle id="px4" r="4" fill="#FF0000" filter="url(#orb-glow-r)"/>
          <circle id="px5" r="4" fill="#FFFF00" filter="url(#orb-glow-y)"/>
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
        Hello.<span style="animation:cursorBlink 1s step-end infinite;font-weight:normal;">&#9646;</span>
      </p>

      <hr class="mac-divider"/>

      <!-- Newton quote -->
      <p style="
        font-size:7px;color:#000000;margin:0;
        text-align:center;line-height:2;
        font-family:'Press Start 2P', monospace;
        max-width:460px;
      ">
        "Cogitamus, ergo sumus."<br>
        <span style="font-size:6px;letter-spacing:2px;">— R. DESCARTES, 1637 (reimagined)</span>
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
        const ABSORB_DUR =0.35;
        const ABSORB_INTV=0.40;
        const EXPLODE_DUR=0.45;

        const CFG=[
            {edge:'left',        bx:0.0,by:0.5,ctrl: 1,rgb:[0,255,255],  noteHz:220.00,noteType:'triangle',filterId:'orb-glow-c'},
            {edge:'right',       bx:1.0,by:0.5,ctrl:-1,rgb:[0,255,0],    noteHz:554.37,noteType:'sine',    filterId:'orb-glow-g'},
            {edge:'top-right',   bx:0.8,by:0.0,ctrl: 1,rgb:[0,0,255],    noteHz:659.25,noteType:'sine',    filterId:'orb-glow-b'},
            {edge:'top-left',    bx:0.2,by:0.0,ctrl:-1,rgb:[255,0,255],  noteHz:261.63,noteType:'triangle',filterId:'orb-glow-m'},
            {edge:'bottom-left', bx:0.2,by:1.0,ctrl:-1,rgb:[255,0,0],    noteHz:440.00,noteType:'sine',    filterId:'orb-glow-r'},
            {edge:'bottom-right',bx:0.8,by:1.0,ctrl: 1,rgb:[255,255,0],  noteHz:329.63,noteType:'triangle',filterId:'orb-glow-y'},
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
                    g.gain.setValueAtTime(0.14,t);
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
            // グレーコード
            if(!chordDone && CFG.every(c=>c.phase==='orbiting')){chordDone=true;playGreyChord();}

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
                    const radius=22+pulse*14;
                    div.style.left=bx+'px';div.style.top=by+'px';
                    div.style.width=(radius*2)+'px';div.style.height=(radius*2)+'px';
                    div.style.background=`radial-gradient(circle,rgba(${r},${g},${b},0.82) 0%,rgba(${r},${g},${b},0.22) 52%,transparent 75%)`;
                    div.style.filter='blur(9px)';
                    div.style.opacity=clamp(t/0.25,0,1).toString();
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(tN>=1.0){cfg.phase='flash';cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='flash'){
                    const fp=clamp(t/FLASH_DUR,0,1);
                    if(fp<0.28){
                        const ex=fp/0.28;
                        div.style.left=cfg.p2x+'px';div.style.top=cfg.p2y+'px';
                        div.style.width=(60+ex*60)+'px';div.style.height=(60+ex*60)+'px';
                        div.style.background=`radial-gradient(circle,rgba(255,255,255,0.96) 0%,rgba(255,255,255,0.35) 55%,transparent 78%)`;
                        div.style.filter='blur(5px)';div.style.opacity='1';
                    }else{
                        const sp=easeOut3((fp-0.28)/0.72);
                        const cr=lerp(60,5,sp);
                        div.style.left=cfg.p2x+'px';div.style.top=cfg.p2y+'px';
                        div.style.width=(cr*2)+'px';div.style.height=(cr*2)+'px';
                        div.style.background=cs;
                        div.style.filter=`blur(${lerp(3,0,sp)}px) drop-shadow(0 0 ${lerp(4,10,sp)}px ${cs})`;
                        div.style.opacity='1';
                    }
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(fp>=1.0){cfg.phase='gliding';cfg.glideFromX=cfg.p2x;cfg.glideFromY=cfg.p2y;cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='gliding'){
                    const gp=clamp(t/GLIDE_DUR,0,1);
                    const ge=easeOut3(gp);
                    div.style.left=lerp(cfg.glideFromX,cfg.glideToX,ge)+'px';
                    div.style.top =lerp(cfg.glideFromY,cfg.glideToY,ge)+'px';
                    div.style.width='10px';div.style.height='10px';
                    div.style.background=cs;
                    div.style.filter=`drop-shadow(0 0 8px ${cs})`;
                    div.style.opacity='1';
                    el.setAttribute('r','0');el.setAttribute('opacity','0');
                    if(gp>=1.0){cfg.phase='waiting';cfg.phaseStartAt=elapsed;}

                }else if(cfg.phase==='waiting'){
                    const isNext=FLY_ORDER[absorbStep]===i;
                    div.style.left=idotScrX+'px';div.style.top=idotScrY+'px';
                    div.style.width='10px';div.style.height='10px';
                    div.style.background=cs;
                    div.style.filter=`drop-shadow(0 0 6px ${cs})`;
                    div.style.opacity=isNext?'0.9':'0';
                    el.setAttribute('r','0');el.setAttribute('opacity','0');

                }else if(cfg.phase==='absorbing'){
                    const ap=clamp(t/ABSORB_DUR,0,1);
                    let sz,opacity,glow;
                    if(ap<0.20){
                        const bulge=ap/0.20;
                        sz=lerp(10,15,bulge);opacity=0.9;glow=lerp(6,10,bulge);
                    }else{
                        const pull=easeIn3((ap-0.20)/0.80);
                        sz=lerp(15,0,pull);opacity=lerp(0.9,0,pull);glow=lerp(10,20,pull);
                    }
                    div.style.left=idotScrX+'px';div.style.top=idotScrY+'px';
                    div.style.width=sz+'px';div.style.height=sz+'px';
                    div.style.background=cs;
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
                        el.setAttribute('filter','url(#wave-glow)');
                        el.setAttribute('cx',I_DOT_X.toString());el.setAttribute('cy',I_DOT_Y.toString());
                        el.setAttribute('opacity','1');
                    }else{
                        const fp2=easeOut3((ep-0.10)/0.90);
                        el.setAttribute('cx',lerp(I_DOT_X,orbitX,fp2).toString());
                        el.setAttribute('cy',lerp(I_DOT_Y,orbitY,fp2).toString());
                        el.setAttribute('r',lerp(22,4,fp2).toString());
                        el.setAttribute('fill',cs);
                        el.setAttribute('filter',`url(#${cfg.filterId})`);
                        el.setAttribute('opacity','1');
                    }
                    if(ep>=1.0){cfg.phase='orbiting';}

                }else if(cfg.phase==='orbiting'){
                    el.setAttribute('cx',orbitX.toString());el.setAttribute('cy',orbitY.toString());
                    el.setAttribute('r','4');el.setAttribute('fill',cs);
                    el.setAttribute('filter',`url(#${cfg.filterId})`);el.setAttribute('opacity','1');
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
        //  POST-PROCESSING: Bloom only (masking via scissor)
        // ══════════════════════════════════════════════════════
        let composer = null, bloom = null;
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
            bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0.4, 0.1);
            composer.addPass(bloom);
        } catch (e) { }

        // ══════════════════════════════════════════════════════
        //  UI OVERLAY (HTML/CSS)
        // ══════════════════════════════════════════════════════
        const ldCSS = document.createElement('style');
        ldCSS.textContent = '@keyframes p1In{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes p1Breathe{0%,100%{opacity:.85;filter:drop-shadow(0 0 12px rgba(255,255,255,.12))}50%{opacity:1;filter:drop-shadow(0 0 24px rgba(255,255,255,.25))}}@keyframes p1BarGlow{0%,100%{box-shadow:0 0 6px rgba(255,255,255,.06)}50%{box-shadow:0 0 14px rgba(255,255,255,.14)}}@keyframes p1Slide{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes p1Sq{0%,100%{border-color:rgba(255,255,255,.1);box-shadow:0 0 12px rgba(255,255,255,.03)}50%{border-color:rgba(255,255,255,.22);box-shadow:0 0 24px rgba(255,255,255,.07)}}.p1-orb{position:absolute;border-radius:50%;filter:blur(100px);opacity:.03;pointer-events:none}@keyframes runBob{0%,100%{transform:translateY(0px) rotate(-1.5deg)}25%{transform:translateY(-5px) rotate(0deg)}50%{transform:translateY(-1px) rotate(1.5deg)}75%{transform:translateY(-5px) rotate(0deg)}}@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}';
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

        console.log('bar-wrap:', document.getElementById('bar-wrap'));
        console.log('drag-handle:', document.getElementById('drag-handle'));
        console.log('bar:', document.getElementById('p1-lb'));
        console.log('pct:', document.getElementById('p1-lpct'));

        const bar = document.getElementById('p1-lb');
        const pct = document.getElementById('p1-lpct');
        const logoEl = document.getElementById('ld-logo');
        const barWrap = document.getElementById('bar-wrap');
        const sqBorder = document.getElementById('sq-border');

        // ── AUTO-TICK (自動進行) ──
        setTimeout(() => {
            if (!document.getElementById('bar-wrap')) { console.error('bar-wrap not found'); return; }

            // フェーズごとの自動進行速度 (prog / 秒)
            // 62.5 fps 想定: rate/62.5 = prog/tick
            const AUTO_RATE = {};
            AUTO_RATE[PH.ATTRACT]   = 8.5;  // 0→30%  ≈ 3.5s
            AUTO_RATE[PH.DUALITY]   = 6.5;  // 30→50% ≈ 3.1s
            AUTO_RATE[PH.WARP_GROW] = 6.0;  // 50→75% ≈ 4.2s
            AUTO_RATE[PH.CONSUME]   = 5.0;  // 75→101% ≈ 5.2s

            const EVENT_PHASES = [
                PH.EVENT_FUSE, PH.EVENT_SING,
                PH.EVENT_BREACH, PH.EVENT_COLLAPSE
            ];

            setInterval(() => {
                if (phase === PH.DONE) return;
                if (EVENT_PHASES.includes(phase)) return;
                let rate = AUTO_RATE[phase] !== undefined ? AUTO_RATE[phase] : 5.0;
                // CONSUME フェーズ: 区間ごとに速度変更
                if (phase === PH.CONSUME) {
                    if (prog >= 100) {
                        rate = 80.0;  // 100→101%: 一瞬で跳ぶ
                    } else if (prog >= 99) {
                        rate = 0.8;   // 99→100%: 焦らし（非常に遅い）
                    } else if (prog >= 75) {
                        rate = 2.5;   // 75→99%: やや減速
                    }
                }
                prog = Math.min(101, prog + rate / 62.5);
                showProg(prog);
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
                '  if(edge < 0.0 && u_grey > 0.05) {',
                '    float grain = fbm(uv * 80.0 + u_time * 0.1) * 0.04;',
                '    col += vec3(grain) * (1.0 - u_grey);',
                '  }',
                '',
                '  if(edge > 0.0 && u_grey > 0.05) {',
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
        const newtonRingMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_alpha: { value: 0 },
                u_scale: { value: 1.0 }
            },
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_time, u_alpha, u_scale;',
                '',
                'void main(){',
                '  vec2 p = (vUv - 0.5) * 2.0 * u_scale;',
                '  float dist = length(p);',
                '',
                '  float wl[6];',
                '  wl[0]=0.700; wl[1]=0.600; wl[2]=0.550;',
                '  wl[3]=0.510; wl[4]=0.470; wl[5]=0.430;',
                '',
                '  vec3 wc[6];',
                '  wc[0]=vec3(1.0, 0.05, 0.05);',
                '  wc[1]=vec3(0.0,  1.0,  1.0);',
                '  wc[2]=vec3(1.0,  0.0,  1.0);',
                '  wc[3]=vec3(0.05, 1.0, 0.05);',
                '  wc[4]=vec3(0.05,0.05,  1.0);',
                '  wc[5]=vec3(1.0,  1.0,  0.0);',
                '',
                '  vec3 col = vec3(0.0);',
                '  float speed = u_time * 0.3;',
                '',
                '  for(int i=0; i<6; i++){',
                '    float n = (dist * dist) / (wl[i] * 0.4);',
                '    float ph = n * 6.28318 - speed * (1.0 + float(i) * 0.05);',
                '    float bright = pow(cos(ph * 0.5), 2.0);',
                '    col += wc[i] * bright;',
                '  }',
                '  col /= 6.0;',
                '',
                '  float falloff = exp(-dist * dist * 0.8);',
                '  col *= (0.15 + falloff * 1.2);',
                '',
                '  gl_FragColor = vec4(col, u_alpha);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        const newtonRingPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(sqWorld * 6, sqWorld * 6),
            newtonRingMat
        );
        newtonRingPlane.position.z = -0.5;
        newtonRingPlane.visible = false;
        scene.add(newtonRingPlane);

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
            fragmentShader: 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.502),1.0);}'
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
        let phase = PH.ATTRACT, prog = 0, progPaused = false, eventTimer = 0, tunnelBorn = false, phaseCInited = false, singDimSwitched = false
        , numberRampageActive = false, numberRampageVal = 101, numberRampageStartTime = 0
        , silenceTriggered = false;

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
        }

        // ── MAIN TICK ──
        function tick() {
            if (!alive) return;
            const dt = Math.min(clk.getDelta(), 0.05);
            globalTime += dt;
            bgMat.uniforms.u_time.value = globalTime;
            fieldMat.uniforms.u_time.value = globalTime;
            if (newtonRingPlane.visible) newtonRingMat.uniforms.u_time.value = globalTime;
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
                if (bloom) bloom.strength = 0; // フラットな円 — エフェクトなし
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
                if (bloom) bloom.strength = 0;
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
                if (prog >= 50) { phase = PH.EVENT_SING; eventTimer = 0; prog = 50; showProg(50); progPaused = true; singDimSwitched = false; }

                // ═══ PHASE 3: EVENT_SING (50% — 5s) — 次元転換 ═══
            } else if (phase === PH.EVENT_SING) {
                eventTimer += dt;
                const et = eventTimer;

                // Step 1 (0-0.3s): 衝突フラッシュ
                if (et < 0.3) {
                    updateWin95Status('⚠ DIMENSION SHIFT DETECTED');
                    const t2 = et / 0.3;
                    bDot.position.x += (0 - bDot.position.x) * 0.3;
                    wDot.position.x += (0 - wDot.position.x) * 0.3;
                    bgMat.uniforms.u_flash.value = t2 * t2;
                    if (bloom) bloom.strength = 1.0 + t2 * 4.0;
                }

                // Step 2 (0.3-0.8s): グリッチ — win95-mainジッター + flash点滅
                if (et >= 0.3 && et < 0.8) {
                    const t2 = (et - 0.3) / 0.5;
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.abs(Math.sin(et * 25)) * 0.6 * (1 - t2);

                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        const jx = (Math.random() - 0.5) * 14 * (1 - t2);
                        const jy = (Math.random() - 0.5) * 6 * (1 - t2);
                        win95.style.transform = `translate(${jx}px, ${jy}px)`;
                    }
                    if (bloom) bloom.strength = 1.5 + Math.abs(Math.sin(et * 30)) * 1.5;
                    updateWin95Status('⚠ REALITY.SYS CORRUPTED');
                }

                // Step 3 (0.8s〜): 物理パラメータ解放 (一回だけ)
                if (et >= 0.8 && !singDimSwitched) {
                    singDimSwitched = true;
                    // pixelRatio 0.5 → デバイスネイティブ（setSizeは呼ばない）
                    renderer.setPixelRatio(window.devicePixelRatio);
                    bgMat.uniforms.u_pixelSize.value = 1.0;
                    if (yyMat.uniforms.u_pixelSize) yyMat.uniforms.u_pixelSize.value = 1.0;

                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        win95.style.transform = 'translate(0px, 0px)';
                        win95.querySelectorAll('*').forEach(el => {
                            const ff = el.style.fontFamily;
                            if (ff && (ff.includes('MS Sans Serif') || ff.includes('Tahoma'))) {
                                el.style.fontFamily = "'Courier New', 'Lucida Console', monospace";
                                el.style.fontWeight = '300';
                                el.style.letterSpacing = '0.08em';
                            }
                        });
                    }
                    updateWin95Status('RELOADING DIMENSION...');
                }

                // Step 4 (0.85-1.5s): UIフリッカー → 安定
                if (et >= 0.85 && et < 1.5) {
                    const t2 = (et - 0.85) / 0.65;
                    bgMat.uniforms.u_flash.value = Math.abs(Math.sin(et * 18)) * 0.25 * (1 - t2);
                    if (bloom) bloom.strength = 1.5 - t2 * 0.5;
                }

                // Step 5 (1.5-1.7s): Flash peak + grey sphere出現
                if (et >= 1.5 && et < 1.7) {
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 1.5) / 0.2);
                    bgMat.uniforms.u_grey.value = 1.0;
                    bDot.visible = true; bDot.position.set(0, 0, 0.5);
                    bDot.scale.setScalar(1.0);
                }

                // Step 6 (1.5-2.2s): grey sphere脈動
                if (et >= 1.5 && et < 2.2) {
                    const t2 = (et - 1.5) / 0.7;
                    bDot.visible = true;
                    bDot.scale.setScalar(1.0 + Math.sin(t2 * Math.PI * 3) * 0.2 * (1 - t2));
                    if (bloom) bloom.strength = 1.0 + Math.abs(Math.sin(t2 * Math.PI * 3)) * 1.5 * (1 - t2);
                }

                // Step 7 (2.0-3.0s): Yin-Yang fade-in
                if (et >= 2.0 && et < 3.0) {
                    const t2 = (et - 2.0) / 1.0;
                    bDot.visible = false;
                    yyPlane.visible = true;
                    yyMat.uniforms.u_alpha.value = Math.min(1.0, t2 * 1.5);
                    yyMat.uniforms.u_rot.value = globalTime * 1.5;
                    yyMat.uniforms.u_grey.value = 0.0;
                    if (bloom) bloom.strength = 1.5;
                }

                // Step 8 (3.0-3.5s): Yin-Yang → grey morphing
                if (et >= 3.0 && et < 3.5) {
                    const t2 = (et - 3.0) / 0.5;
                    yyPlane.visible = true;
                    yyMat.uniforms.u_grey.value = t2;
                    yyMat.uniforms.u_rot.value = globalTime * (1.5 + t2 * 8.0);
                    yyMat.uniforms.u_alpha.value = 1.0 - t2 * 0.8;
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

                // Step 9 (3.5-4.0s): Yin-Yang消去 → tunnel born
                if (et >= 3.5 && et < 4.0) {
                    yyPlane.visible = false;
                    yyPlane.position.x = 0;
                    bDot.userData.greySet = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 3.5) / 0.5);
                    tunnelPlane.visible = true;
                    const t2 = (et - 3.5) / 0.5;
                    tunnelMat.uniforms.u_radius.value = 0.05 + t2 * 0.15;
                    tunnelMat.uniforms.u_alpha.value = t2;
                    tunnelMat.uniforms.u_progress.value = t2 * 0.2;
                    if (bloom) bloom.strength = 4.0 * (1 - t2) + 1.5;
                }

                // Step 10 (4.0-5.0s): Tunnel安定成長
                if (et >= 4.0) {
                    const t2 = Math.min((et - 4.0) / 1.0, 1.0);
                    const pulse = 1 + Math.sin(et * 6) * 0.04;
                    tunnelMat.uniforms.u_radius.value = (0.2 + t2 * 0.05) * pulse;
                    tunnelMat.uniforms.u_alpha.value = 1.0;
                    tunnelMat.uniforms.u_progress.value = 0.2 + t2 * 0.1;
                    if (bloom) bloom.strength = 1.5;
                }

                if (et >= 5.0) { phase = PH.WARP_GROW; progPaused = false; }

                // ═══ PHASE 4: WARP_GROW (50→75%) ═══
            } else if (phase === PH.WARP_GROW) {
                // Phase C初期化 (一回だけ実行)
                if (!phaseCInited) {
                    phaseCInited = true;

                    // Win95 UIをフェードアウト
                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        win95.style.transition = 'opacity 0.6s ease-out';
                        win95.style.opacity = '0';
                        setTimeout(() => {
                            if (win95) win95.style.display = 'none';
                        }, 700);
                    }
                    // タスクバーもフェードアウト
                    if (wrap) {
                        const allDivs = wrap.querySelectorAll('div');
                        allDivs.forEach(el => {
                            if (el.style.position === 'absolute' && (el.style.bottom === '0px' || el.style.bottom === '0')) {
                                el.style.transition = 'opacity 0.6s ease-out';
                                el.style.opacity = '0';
                                setTimeout(() => { if (el) el.style.display = 'none'; }, 700);
                            }
                        });
                    }

                    // Phase C プログレスバーを表示
                    const pcBar = document.getElementById('phase-c-bar-wrap');
                    if (pcBar) {
                        pcBar.style.display = 'block';
                        pcBar.style.opacity = '0';
                        pcBar.style.transition = 'opacity 0.8s ease-in';
                        setTimeout(() => { if (pcBar) pcBar.style.opacity = '1'; }, 100);
                    }

                    // bgPlaneを非表示にしてnewtonRingPlaneに切り替え
                    bgPlane.visible = false;
                    renderer.setClearColor(0x000000, 1);
                    newtonRingPlane.visible = true;
                    newtonRingMat.uniforms.u_alpha.value = 0.0;
                    newtonRingMat.uniforms.u_scale.value = 1.5;
                    scissor.enabled = false; // sq-border が display:none になるので scissor を無効化
                    renderer.setScissorTest(false);
                    renderer.setViewport(0, 0, W, H);
                    camera.left = -camW; camera.right = camW;
                    camera.top = camH; camera.bottom = -camH;
                    camera.updateProjectionMatrix();
                }

                // Newton Ring alpha をprogに応じてフェードイン
                const nrAlpha = Math.min(1.0, (prog - 50) / 15);
                newtonRingMat.uniforms.u_alpha.value = nrAlpha;
                newtonRingMat.uniforms.u_scale.value = 1.5 - (prog - 50) / 25 * 0.5;

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
                updateWin95Status('Breaching reality boundary...');
                eventTimer += dt;
                const et = eventTimer;
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
                // 数字暴走初期化 (一回だけ)
                if (!numberRampageActive) {
                    numberRampageActive = true;
                    numberRampageVal = 101;
                    numberRampageStartTime = globalTime;
                }
                eventTimer += dt;
                const et = eventTimer;
                updateWin95Status('Shutting down current dimension...');
                tunnelMat.uniforms.u_radius.value = 0.95 + Math.min(et, 2.0) * 2.0; // expand beyond square
                tunnelMat.uniforms.u_progress.value = 1.0;
                tunnelMat.uniforms.u_alpha.value = 1.0;

                // Step 1 (0-0.5s): UI absorbed into center
                if (et < 0.5) {
                    const t2 = et / 0.5, ease = t2 * t2 * t2;
                    if (barWrap) { barWrap.style.transition = 'none'; barWrap.style.transform = 'translateY(' + (ease * 40) + 'px) scale(' + Math.max(0.01, 1 - ease) + ')'; barWrap.style.opacity = String(1 - ease * 2); barWrap.style.filter = 'blur(' + (ease * 12) + 'px)'; }
                    pct.style.transform = 'scale(' + Math.max(0.01, 1 - ease) + ')'; pct.style.opacity = String(1 - ease * 2);
                    if (logoEl) { const le = Math.max(0, (et - 0.15) / 0.35); if (le > 0) { logoEl.style.transform = 'scale(' + Math.max(0.01, 1 - le * le) + ') rotate(' + (le * le * 120) + 'deg)'; logoEl.style.opacity = String(1 - le * le * 1.5); logoEl.style.filter = 'blur(' + (le * le * 10) + 'px)'; } }
                    // Phase C progress bar 吸収
                    const pcBarWrap = document.getElementById('phase-c-bar-wrap');
                    if (pcBarWrap) {
                        const ease = t2 * t2 * t2;
                        pcBarWrap.style.transition = 'none';
                        pcBarWrap.style.transform = `translateX(-50%) translateY(${ease * 60}px) scale(${Math.max(0.01, 1 - ease)})`;
                        pcBarWrap.style.opacity = String(Math.max(0, 1 - ease * 2));
                    }
                    // UIスパゲッティ: win95-mainを引き伸ばして渦吸い込み
                    const win95s = document.getElementById('win95-main');
                    if (win95s && win95s.style.display !== 'none' && win95s.style.opacity !== '0') {
                        const ease3 = t2 * t2 * t2;
                        const stretchX = 1.0 - ease3 * 0.85; // 横に縮む
                        const stretchY = 1.0 + ease3 * 3.0;  // 縦に伸びる
                        const rotate = ease3 * 180;           // 180°まで回転
                        const translateX = ease3 * (Math.random() - 0.5) * 40;
                        const translateY = ease3 * 80;        // 下方向に引き寄せ
                        win95s.style.transform = `perspective(400px) translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scaleX(${stretchX}) scaleY(${stretchY})`;
                        win95s.style.opacity = String(Math.max(0, 1 - ease3 * 1.5));
                        win95s.style.filter = `blur(${ease3 * 3}px) brightness(${1 + ease3 * 2})`;
                        win95s.style.transformOrigin = '50% 100%'; // 底辺を中心に
                    }
                }
                if (et >= 0.5 && et < 0.55) {
                    if (barWrap) barWrap.style.display = 'none'; pct.style.display = 'none';
                    if (logoEl) logoEl.style.display = 'none';
                    const pcBarWrap2 = document.getElementById('phase-c-bar-wrap');
                    if (pcBarWrap2) pcBarWrap2.style.display = 'none';
                    const win95hide = document.getElementById('win95-main');
                    if (win95hide) win95hide.style.display = 'none';
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
                    if (!silenceTriggered) {
                        silenceTriggered = true;
                        // Web Audioを停止
                        try {
                            if (typeof audioContext !== 'undefined' && audioContext) {
                                // 全アクティブノードを停止してからsuspend
                                audioContext.suspend();
                            }
                        } catch(e) {}
                    }
                    const t2 = (et - 2.5) / 2.5, eased = t2 * t2;
                    sqBorder.style.display = 'none';
                    scissor.enabled = false; // Full screen — no clip
                    camera.position.z = 50 - eased * 40;
                    camera.rotation.z += dt * (0.3 + eased * 1.5);
                    tunnelMat.uniforms.u_warpSpeed.value = 4.0 + eased * 6.0;
                    if (bloom) bloom.strength = 4.5 + eased * 4.0;
                    tunnelMat.uniforms.u_progress.value = 1.0 + eased;
                }

                // Step 3.5 (4.5-5.0s): 完全無音 + 真っ黒（静寂）
                if (et >= 4.5 && et < 5.0) {
                    whiteOv.style.opacity = '0';
                    if (bloom) bloom.strength = 0;
                    tunnelPlane.visible = false;
                    renderer.setClearColor(0x000000, 1);
                    scissor.enabled = false;
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
                    renderer.dispose(); renderer.domElement.remove();
                    whiteOv.remove(); wrap.remove(); ldCSS.remove();
                    // ── P1完了: カスタムイベント発火 ──
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
    });
}
