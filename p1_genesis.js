/**
 * p1_genesis.js — P1 「ONE BREATH」 50%→101% 完全再設計 (2026-05-31)
 *
 * 司さん「0から / inryokü に沿って / Apple を越える最高のデザイン」
 *
 * 哲学:
 *   - 同じ球が姿だけ変える (切替なし = 1つの存在)
 *   - グレーの中に虹 (50%=現実, 101%=視点の転換)
 *   - 混ぜる (additive 禁止, mix で馴染ませる)
 *   - 引き算: 球と、間(ま)だけ。装飾ゼロ
 *
 * 7段タイムライン (p1_genesis 発火からの秒):
 *   ① 0.0-2.5  陰陽生成   黒い宇宙に球が染み出す、陰陽がゆっくり回る
 *   ② 2.5-5.0  グレー溶解  境界が溶けて完全なグレー (現実)
 *   ③ 5.0-7.0  虹の予兆   グレー内側から虹が脈打つ (まだ出ない = 溜め)
 *   ④ 7.0-8.0  101%開花   一気に虹球へ。bass hit (一度きりの爆発)
 *   ⑤ 8.0-10   光になる    虹→白光へ収束、背景も真っ暗に
 *   ⑥ 10-12    瞳        光の奥に瞳、ゆっくり開眼 (虹彩に虹)
 *   ⑦ 12-14    十字→P2    光の十字、縦軸が伸びてコードの世界へ
 *
 * 単一 Mesh + 単一 ShaderMaterial + 1 timeline driver。
 * 旧 p1_v2_sphere / p1_stage1_taichi は停止 (HTML 側でコメントアウト)。
 *
 * 起動: detail.scene/camera を持つ 'p1_50percent' 相当イベントで init。
 * 無効化: ?genesis=0
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.inryokuP1Genesis) return;
  try { if (/[\?&]genesis=0/.test(location.search)) return; } catch (e) {}

  // ════════════════════════════════════════════════
  //  Shaders
  // ════════════════════════════════════════════════
  var VERT = `
    varying vec3 vPos;
    varying vec3 vWN;
    varying vec3 vWP;
    void main(){
      vPos = position;
      vWN  = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position,1.0);
      vWP  = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

  var FRAG = `
    precision highp float;
    uniform float uTime;
    uniform vec3  uCam;
    uniform float uBirth;     // 0..1 球が宇宙から染み出す (alpha)
    uniform float uYin;       // 1=陰陽くっきり → 0=グレー溶解
    uniform float uGrey;      // 0..1 完全グレー度
    uniform float uOmen;      // 0..1 虹の予兆 (内側から脈打つ)
    uniform float uBloom;     // 0..1 虹球開花
    uniform float uLight;     // 0..1 白光球へ収束
    uniform float uEye;       // 0..1 瞳出現
    uniform float uOpen;      // 0..1 開眼
    uniform float uCross;     // 0..1 十字

    varying vec3 vPos;
    varying vec3 vWN;
    varying vec3 vWP;

    // 6色スペクトル (R→Y→G→C→B→M)
    vec3 spectrum(float t){
      float x = fract(t)*6.0;
      if(x<1.0) return mix(vec3(1,0,0),vec3(1,1,0),x);
      if(x<2.0) return mix(vec3(1,1,0),vec3(0,1,0),x-1.0);
      if(x<3.0) return mix(vec3(0,1,0),vec3(0,1,1),x-2.0);
      if(x<4.0) return mix(vec3(0,1,1),vec3(0,0,1),x-3.0);
      if(x<5.0) return mix(vec3(0,0,1),vec3(1,0,1),x-4.0);
      return mix(vec3(1,0,1),vec3(1,0,0),x-5.0);
    }
    float hash(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yzx+19.19); return fract((p.x+p.y)*p.z); }
    float vnoise(vec3 p){
      vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      float a=hash(i),b=hash(i+vec3(1,0,0)),c=hash(i+vec3(0,1,0)),d=hash(i+vec3(1,1,0));
      float e=hash(i+vec3(0,0,1)),g=hash(i+vec3(1,0,1)),h=hash(i+vec3(0,1,1)),k=hash(i+vec3(1,1,1));
      return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);
    }
    float fbm(vec3 p){ float v=0.,a=.5; for(int i=0;i<5;i++){v+=a*vnoise(p);p*=2.02;a*=.5;} return v; }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    vec2 faceUv(vec3 wn){ return vec2(wn.x,wn.y)*1.05; }

    void main(){
      vec3 p = normalize(vPos);
      vec3 N = normalize(vWN);
      vec3 V = normalize(uCam - vWP);
      float facing = max(dot(N,V),0.0);
      float fres = pow(1.0-facing, 2.2);

      // ── 立体ライティング (key/fill/hemi/spec/sss) ──
      vec3 nP = normalize(N + 0.05*vec3(
        fbm(p*3.0+uTime*0.05), fbm(p*3.0+11.3-uTime*0.04), fbm(p*3.0+27.7))-0.025);
      vec3 keyD=normalize(vec3(.55,.7,.5)), fillD=normalize(vec3(-.6,.1,.4));
      float kd=max(dot(nP,keyD),0.0), fd=max(dot(nP,fillD),0.0)*.45;
      float hemi=.5+.5*nP.y;
      float spec=pow(max(dot(nP,normalize(keyD+V)),0.0),48.0);
      float sss=(1.0-smoothstep(0.0,1.0,length(vPos)))*.5;
      float shade=.42+.72*kd+fd+.18*hemi+sss;

      // ── ① 陰陽 (uYin) ──
      float ang=atan(p.y,p.x);
      float s=sin(ang + sin(p.y*3.6+uTime*0.35)*0.30 + p.z*0.7);
      float yin=smoothstep(-0.05,0.05,s);
      vec3 taichi=mix(vec3(0.02),vec3(0.98),yin);

      // ── ② グレー溶解 (uGrey): 境界から溶ける ──
      vec3 grey=vec3(0.5);
      // 陰陽→グレーは境界(s≈0)優先で溶かす(S字から)
      float dissolve=smoothstep(0.0,0.42, uGrey + (1.0-abs(s))*uGrey*0.6);
      vec3 base=mix(taichi, grey, clamp(dissolve,0.0,1.0));

      // ── ③ 虹の予兆 (uOmen): グレー内側から虹が脈打つ ──
      float pulse=0.5+0.5*sin(uTime*1.6 - length(vPos)*4.0);
      vec3 omenRainbow=spectrum(uTime*0.10 + ang*0.12 + p.y*0.4);
      // 予兆は彩度低く、内側(中心)からだけ薄く
      float omenMask=(1.0-smoothstep(0.0,0.9,length(vPos))) * pulse;
      base=mix(base, mix(base,omenRainbow,0.45), omenMask*uOmen*0.5);

      // ── ④ 虹球開花 (uBloom): 6色メタボール ──
      vec3 ctr[6]; ctr[0]=normalize(vec3(1,.2,.1)); ctr[1]=normalize(vec3(-.8,.7,-.1));
      ctr[2]=normalize(vec3(.1,-1,.2)); ctr[3]=normalize(vec3(-.2,.1,1));
      ctr[4]=normalize(vec3(.5,-.4,-1)); ctr[5]=normalize(vec3(-1,-.2,.3));
      vec3 cc[6]; cc[0]=vec3(1,0,0); cc[1]=vec3(0,1,0); cc[2]=vec3(0,.15,1);
      cc[3]=vec3(0,1,1); cc[4]=vec3(1,0,1); cc[5]=vec3(1,1,0);
      float field=0.0; vec3 csum=vec3(0.0);
      for(int i=0;i<6;i++){
        float fi=float(i);
        vec3 c=normalize(ctr[i]+0.07*vec3(sin(uTime*.4+fi),cos(uTime*.33+fi*1.7),sin(uTime*.27+fi*2.1)));
        float d=length(p-c); float m=pow(exp(-d*d*9.0),1.4);
        field+=m; csum+=cc[i]*m;
      }
      vec3 rgbcmy=csum/max(field,0.001);
      vec3 col=mix(base, mix(base,rgbcmy,0.78), uBloom);

      // Newton リング (開花後の rim 干渉)
      float ring=sin(fres*fres*70.0 - uTime*1.4)*0.5+0.5;
      col=mix(col, mix(col,spectrum(ring*0.7+ang*0.12),0.6), uBloom*fres*0.3);

      // ── 立体陰影適用 (光球以降は弱める) ──
      float litAmt=1.0-clamp(uLight,0.0,1.0)*0.85;
      col=mix(col, col*shade, litAmt);
      col+=spec*0.35*litAmt;
      col+=fres*mix(vec3(.1,.2,.4),col,.5)*0.25*litAmt;

      // ── ⑤ 白光球 (uLight): 虹→内側から白へ収束 ──
      if(uLight>0.001){
        vec3 faded=mix(col,vec3(0.5),uLight*0.7);
        vec3 lc=mix(faded,vec3(1.0),uLight*0.6);
        float core=(1.0-smoothstep(0.0,0.7,length(vPos)))*uLight;
        lc=mix(lc,vec3(1.0),core*0.7);
        lc=mix(lc,vec3(1.0),pow(fres,1.5)*uLight*0.85);
        // 白の中にも虹 (rim だけ)
        lc=mix(lc, mix(vec3(1.0),spectrum(uTime*0.04+ang*0.10),0.55), pow(fres,3.0)*uLight*0.14);
        col=lc;
      }

      // ── ⑥ 瞳 (uEye/uOpen) ──
      float crossP=clamp(uCross,0.0,1.0);
      float eyeFade=1.0-smoothstep(0.02,0.34,crossP);
      float eP=clamp(uEye,0.0,1.0)*eyeFade;
      float eO=clamp(uOpen,0.0,1.0);
      if(eP>0.001){
        vec2 e=faceUv(N); e.y*=1.16;
        float reg=1.0-smoothstep(0.82,1.10,length(e*vec2(.86,1.14)));
        float lid=e.y+0.06*sin(e.x*3.14159);
        float oe=smoothstep(0.08,1.0,eO);
        float ap=mix(0.024,0.46,oe);
        float closed=exp(-lid*lid*1200.0)*(1.0-oe);
        float apM=1.0-smoothstep(ap,ap+0.06,abs(lid));
        float r=length(e*vec2(1.0,0.88));
        float scl=(1.0-smoothstep(0.55,0.75,r))*apM;
        float iris=(1.0-smoothstep(0.32,0.48,r))*smoothstep(0.07,0.16,r)*apM;
        float irisRing=exp(-abs(r-0.36)*32.0)*apM;
        float pup=(1.0-smoothstep(0.105,0.185,r))*apM;
        float cat=1.0-smoothstep(0.035,0.078,length(e-vec2(-.13,.14)));
        float ht=0.52+0.10*sin(uTime*0.5);
        vec3 ic=mix(vec3(0,.16,.34),vec3(0,.85,1),ht);
        float ir2=sin(r*90.0-uTime*1.4)*0.5+0.5;
        vec3 iInt=mix(ic,spectrum(r*1.4+uTime*0.08),0.5);
        col=mix(col,vec3(0.0),closed*reg*eP);
        col=mix(col,vec3(0.96),scl*reg*eP*oe*0.42);
        col=mix(col,ic,iris*reg*eP*oe);
        col=mix(col,iInt,iris*reg*eP*oe*ir2*0.18);
        col=mix(col,vec3(0,.85,1),irisRing*reg*eP*oe*0.32);
        col=mix(col,vec3(0.0),pup*reg*eP*oe);
        col=mix(col,vec3(1.0),cat*reg*eP*oe*0.78);
      }

      // ── ⑦ 十字 (uCross) ──
      if(crossP>0.001){
        vec2 c=faceUv(N);
        float sv=1.0-smoothstep(0.12+crossP*0.8,1.06,abs(c.y));
        float sh=1.0-smoothstep(0.12+crossP*0.8,1.06,abs(c.x));
        float vB=exp(-c.x*c.x*72.0)*sv, hB=exp(-c.y*c.y*72.0)*sh;
        float core=exp(-dot(c,c)*30.0);
        vec3 cb=mix(col,vec3(0.0),hB*crossP*0.96);
        cb=mix(cb,vec3(1.0),vB*crossP*0.98);
        cb+=vec3(1.0)*core*crossP*2.7;
        // 縦軸に虹粒子
        float vp=exp(-c.x*c.x*360.0)*smoothstep(0.0,1.0,sin(c.y*16.0-uTime*3.0)*0.5+0.5);
        cb=mix(cb, mix(vec3(1.0),spectrum(uTime*0.13+c.y),0.6), vp*crossP*0.4*sv);
        col=mix(col,cb,smoothstep(0.02,0.22,crossP));
        col=mix(col,vec3(1.0),crossP*fres*0.35);
      }

      // フィルミック
      col=aces(col*1.18);
      col=pow(col,vec3(0.9));

      // alpha
      float post=max(max(max(uLight,uEye),uCross),uBloom);
      float a=clamp(max(uBirth, post),0.0,1.0);
      gl_FragColor=vec4(col,a);
    }
  `;

  // ════════════════════════════════════════════════
  //  State + lifecycle
  // ════════════════════════════════════════════════
  var state = {
    scene:null, camera:null, renderer:null, mesh:null, mat:null, geo:null,
    t0:0, raf:0, running:false, timers:new Set(),
    firedBreach:false, firedIngest:false, firedP2:false,
  };
  function setT(fn,ms){ var id=setTimeout(function(){state.timers.delete(id); try{fn();}catch(e){}},ms); state.timers.add(id); return id; }

  // ── easing ──
  function ss(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); }            // smoothstep
  function expo(x){ return x>=1?1:1-Math.pow(2,-10*x); }
  function ease(a,b,t){ return ss((t-a)/(b-a)); }                                 // 0..1 between a,b

  // ── 7段タイムライン ──
  //  ① 0-2.5 陰陽生成  ② 2.5-5 グレー溶解  ③ 5-7 虹の予兆
  //  ④ 7-8 開花       ⑤ 8-10.5 光       ⑥ 10.5-13 瞳/開眼  ⑦ 13-15.5 十字→P2
  var T = {
    yinIn:[0.0, 2.5],   // 染み出し + 陰陽くっきり
    grey:[2.5, 5.0],    // グレー溶解
    omen:[5.0, 7.0],    // 虹の予兆 (溜め)
    bloom:[7.0, 8.0],   // 101% 開花
    light:[8.0, 10.5],  // 白光球収束 + 背景吸い込み
    eye:[10.5, 12.2],   // 瞳出現
    open:[12.2, 13.2],  // 開眼
    cross:[13.2, 15.2], // 十字
    p2:15.6,
  };

  function apply(t){
    var u = state.mat.uniforms;
    u.uTime.value = t;
    if (state.camera) u.uCam.value.copy(state.camera.position);
    state.mesh.rotation.y = t * 0.16;
    state.mesh.scale.setScalar(1.0 + Math.sin(t*0.9)*0.02);

    // ① 染み出し alpha + 陰陽 (0-2.5)
    u.uBirth.value = ss(t / 1.2);                       // 1.2s で完全出現
    u.uYin.value   = 1.0;

    // ② グレー溶解 (2.5-5.0)
    u.uGrey.value  = ease(T.grey[0], T.grey[1], t);

    // ③ 虹の予兆 (5.0-7.0) — 開花直前で 0 へ戻して開花に譲る
    var omen = ease(T.omen[0], T.omen[1], t);
    if (t >= T.bloom[0]) omen = Math.max(0, 1.0 - ease(T.bloom[0], T.bloom[0]+0.4, t));
    u.uOmen.value  = omen;

    // ④ 開花 (7.0-8.0) — expo で一気に
    u.uBloom.value = (t < T.bloom[0]) ? 0 : expo(Math.min(1,(t-T.bloom[0])/(T.bloom[1]-T.bloom[0])));
    if (t >= T.bloom[0] && !state.firedBreach){ state.firedBreach=true; try{onBreach();}catch(e){} }

    // ⑤ 白光球 + 背景吸い込み (8.0-10.5)
    u.uLight.value = ease(T.light[0], T.light[1], t);
    if (t >= T.light[0]+0.3 && !state.firedIngest){ state.firedIngest=true; try{onIngest();}catch(e){} }

    // ⑥ 瞳 + 開眼
    u.uEye.value  = ease(T.eye[0], T.eye[1], t);
    u.uOpen.value = ease(T.open[0], T.open[1], t);

    // ⑦ 十字
    u.uCross.value = ease(T.cross[0], T.cross[1], t);

    // P2
    if (t >= T.p2 && !state.firedP2){ state.firedP2=true; try{onP2();}catch(e){} }
  }

  function loop(){
    if(!state.running) return;
    var t=(performance.now()-state.t0)/1000;
    try{ apply(t); state.renderer && state.renderer.render(state.scene,state.camera); }catch(e){}
    state.raf=requestAnimationFrame(loop);
  }

  // ── events ──
  function onBreach(){
    try{ var H=window.inryokuHarmonic; if(H&&H.breach) H.breach(); }catch(e){}
    try{
      var bar=document.getElementById('p1-lpct') || document.querySelector('[id*="lpct"]');
      // バー 101% 表記は既存ローダーに任せる
    }catch(e){}
  }
  function onIngest(){
    // Win95 UI + 背景を球へ吸い込み → 真っ暗 (司さん確定ビジョン)
    try{
      var win=document.getElementById('win95-main');
      if(win){
        var clone=win.cloneNode(true); clone.id='p1-genesis-shell';
        clone.querySelectorAll('canvas').forEach(function(c){c.remove();});
        var r=win.getBoundingClientRect();
        Object.assign(clone.style,{position:'fixed',left:r.left+'px',top:r.top+'px',
          width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'2147482000',
          pointerEvents:'none',transition:'transform 1.6s cubic-bezier(.6,0,.9,.3), opacity 1.6s ease, filter 1.6s ease',
          transformOrigin:'50% 42%'});
        document.body.appendChild(clone); win.style.opacity='0';
        requestAnimationFrame(function(){
          clone.style.transform='scale(0.001) rotate(-720deg)';
          clone.style.opacity='0'; clone.style.filter='blur(8px) hue-rotate(80deg)';
        });
        setT(function(){ try{clone.remove();}catch(e){} },1900);
      }
    }catch(e){}
    // 背景・周辺DOMを真っ暗へ
    try{
      var veil=document.getElementById('p1-genesis-veil');
      if(!veil){ veil=document.createElement('div'); veil.id='p1-genesis-veil';
        veil.style.cssText='position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:-1;transition:opacity 1.6s ease 0.5s;';
        document.body.appendChild(veil); }
      document.body.style.transition='background 1.4s ease 0.5s';
      document.body.style.background='#000';
      ['.phase-1','#win95-desktop','.win95-taskbar','#win95-main','.desktop'].forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(el){
          if(el.querySelector&&el.querySelector('canvas'))return;
          el.style.transition='opacity 1.2s ease 0.3s'; el.style.opacity='0';
        });
      });
      setT(function(){veil.style.opacity='1';},60);
    }catch(e){}
    try{ window.p1FullScreenUnlocked=true; }catch(e){}
  }
  function onP2(){
    try{ var H=window.inryokuHarmonic; if(H&&H.stop) H.stop(1.0); }catch(e){}
    try{
      window.__inryokuP1ToP2={from:'genesis_cross', ts:Date.now()};
      window.dispatchEvent(new CustomEvent('p1_genesis_to_p2',{detail:window.__inryokuP1ToP2}));
    }catch(e){}
  }

  // ── init ──
  function init(detail){
    if(state.running) return;
    if(!detail||!detail.scene||!detail.camera||typeof THREE==='undefined') return;
    state.scene=detail.scene; state.camera=detail.camera; state.renderer=detail.renderer||null;

    // 旧球・旧プレーンを全部黙らせる (二重根絶)。
    //   Stage 0 の 6球/パネル/トンネル等 legacy オブジェクトを名前で非表示。
    ['p1Stage1TaichiSphere','p1-old-grey-sphere','p1-old-dual-bg'].forEach(function(n){
      try{ var o=state.scene.getObjectByName(n); if(o)o.visible=false; }catch(e){}
    });
    // legacy の動的 6球等は stage1Enabled で抑制 (p1_code 側が参照)
    try{ if(!window.inryokuP1) window.inryokuP1={}; window.inryokuP1.stage1Enabled=true; }catch(e){}
    // 名前無しの legacy mesh も、genesis の球以外で z≈0.5 の SphereGeometry を隠す保険
    try{
      state.scene.traverse(function(o){
        if(o.isMesh && o!==state.mesh && o.geometry && o.geometry.type==='SphereGeometry'){
          o.visible=false;
        }
      });
    }catch(e){}

    state.geo=new THREE.SphereGeometry(1.0,96,96);
    state.mat=new THREE.ShaderMaterial({
      vertexShader:VERT, fragmentShader:FRAG,
      uniforms:{
        uTime:{value:0}, uCam:{value:new THREE.Vector3()},
        uBirth:{value:0}, uYin:{value:1}, uGrey:{value:0}, uOmen:{value:0},
        uBloom:{value:0}, uLight:{value:0}, uEye:{value:0}, uOpen:{value:0}, uCross:{value:0},
      },
      transparent:true, depthWrite:false, depthTest:true,
    });
    state.mesh=new THREE.Mesh(state.geo,state.mat);
    state.mesh.renderOrder=999;
    state.scene.add(state.mesh);
    try{ window.__p1genesisMat=state.mat; }catch(e){}
    state.t0=performance.now(); state.running=true;
    try{ console.log('[p1_genesis] init OK — ONE BREATH timeline'); }catch(e){}
    loop();
  }

  // ── 公開 + イベント待ち ──
  window.inryokuP1Genesis={ init:init, state:state, T:T };
  // 既存ローダー (p1_code_for_claude.js) が 50% で投げる正規イベントで起動。
  //   detail = { scene, camera, renderer }
  window.addEventListener('inryoku:p1_50percent', function(e){ init(e.detail||{}); });
})();
