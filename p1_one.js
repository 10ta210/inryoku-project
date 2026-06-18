/**
 * p1_one.js — P1 完全自己完結版 (2026-06-04, 司さん「0から作り直し」)
 *
 * 1ファイルで全部:
 *   - Win95 ローディング DOM (ウィンドウ + バー)
 *   - Three.js 球 (単一 Mesh + 単一 ShaderMaterial、立体ライティング)
 *   - 進行ドライバ (prog 0→101、バーと球を完全同期 = ズレ/二重/段見え 根絶)
 *
 * 流れ (prog がバーも球も両方駆動):
 *   0→50    二元の誕生   左CMY(→黒) / 右RGB(→白) が育ち、50%で衝突→球誕生
 *   50→82   陰陽溶解     陰陽が境界から溶けて完全グレー(現実)
 *   82→97   虹の予兆     グレー内側から虹が脈打つ(溜め)
 *   97→100  タメ        ほぼ停止、息を呑む間
 *   100→101 開花+breach  虹球開花 + bass hit
 *   101後    白光球→瞳→開眼→十字→P2
 *
 * 旧 p1_code/taichi/v2/genesis は読まない (HTMLで停止)。
 * 哲学: 同じ球が姿を変える / グレーの中に虹 / 混ぜる / OKLCH。
 * 無効化: ?one=0
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.inryokuP1One) return;
  try { if (/[\?&]one=0/.test(location.search)) return; } catch (e) {}

  var THREE = window.THREE;

  // ════════════════════════════════════════════════
  //  Shaders — 単一球で 0→101% 全段を表現
  // ════════════════════════════════════════════════
  var VERT = `
    varying vec3 vPos; varying vec3 vN; varying vec3 vWP;
    void main(){
      vPos=position; vN=normalize(mat3(modelMatrix)*normal);
      vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `;

  var FRAG = `
    precision highp float;
    uniform float uTime, uCam0,uCam1,uCam2;
    uniform float uBirth;   // 0..1 球が宇宙から染み出す
    uniform float uGrey;    // 0=陰陽くっきり → 1=完全グレー
    uniform float uOmen;    // 0..1 虹の予兆
    uniform float uBloom;   // 0..1 虹球開花
    uniform float uLight;   // 0..1 白光球
    uniform float uEye;     // 0..1 瞳
    uniform float uOpen;    // 0..1 開眼
    uniform float uCross;   // 0..1 十字
    varying vec3 vPos; varying vec3 vN; varying vec3 vWP;

    vec3 spectrum(float t){
      float x=fract(t)*6.0;
      if(x<1.0)return mix(vec3(1,0,0),vec3(1,1,0),x);
      if(x<2.0)return mix(vec3(1,1,0),vec3(0,1,0),x-1.0);
      if(x<3.0)return mix(vec3(0,1,0),vec3(0,1,1),x-2.0);
      if(x<4.0)return mix(vec3(0,1,1),vec3(0,0,1),x-3.0);
      if(x<5.0)return mix(vec3(0,0,1),vec3(1,0,1),x-4.0);
      return mix(vec3(1,0,1),vec3(1,0,0),x-5.0);
    }
    float hash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
    float vnoise(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      float a=hash(i),b=hash(i+vec3(1,0,0)),c=hash(i+vec3(0,1,0)),d=hash(i+vec3(1,1,0));
      float e=hash(i+vec3(0,0,1)),g=hash(i+vec3(1,0,1)),h=hash(i+vec3(0,1,1)),k=hash(i+vec3(1,1,1));
      return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);
    }
    float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p*=2.02;a*=.5;}return v;}
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    vec2 faceUv(vec3 n){return vec2(n.x,n.y)*1.05;}

    void main(){
      vec3 p=normalize(vPos);
      vec3 N=normalize(vN);
      vec3 cam=vec3(uCam0,uCam1,uCam2);
      vec3 V=normalize(cam-vWP);
      float facing=max(dot(N,V),0.0);
      float fres=pow(1.0-facing,2.2);

      // 立体ライティング
      vec3 nP=normalize(N+0.05*vec3(fbm(p*3.0+uTime*0.05),fbm(p*3.0+11.3-uTime*0.04),fbm(p*3.0+27.7))-0.025);
      vec3 keyD=normalize(vec3(.55,.7,.5)),fillD=normalize(vec3(-.6,.1,.4));
      float kd=max(dot(nP,keyD),0.0),fd=max(dot(nP,fillD),0.0)*.45,hemi=.5+.5*nP.y;
      float spec=pow(max(dot(nP,normalize(keyD+V)),0.0),48.0);
      float sss=(1.0-smoothstep(0.0,1.0,length(vPos)))*.5;
      float shade=.42+.72*kd+fd+.18*hemi+sss;

      // ── 陰陽 (連続シェーダー、段なし) ──
      float ang=atan(p.y,p.x);
      float s=sin(ang+sin(p.y*3.6+uTime*0.35)*0.30+p.z*0.7);
      float yin=smoothstep(-0.06,0.06,s);
      vec3 taichi=mix(vec3(0.02),vec3(0.98),yin);

      // ── グレー溶解 (境界 s≈0 から溶ける = 自然) ──
      float diss=smoothstep(0.0,0.5,uGrey+(1.0-abs(s))*uGrey*0.55);
      vec3 base=mix(taichi,vec3(0.5),clamp(diss,0.0,1.0));

      // ── 虹の予兆 (内側から脈打つ) ──
      float pls=0.5+0.5*sin(uTime*1.6-length(vPos)*4.0);
      float omenMask=(1.0-smoothstep(0.0,0.9,length(vPos)))*pls;
      base=mix(base,mix(base,spectrum(uTime*0.10+ang*0.12+p.y*0.4),0.45),omenMask*uOmen*0.5);

      // ── 虹球開花 (6色メタボール) ──
      vec3 ctr[6];ctr[0]=normalize(vec3(1,.2,.1));ctr[1]=normalize(vec3(-.8,.7,-.1));
      ctr[2]=normalize(vec3(.1,-1,.2));ctr[3]=normalize(vec3(-.2,.1,1));
      ctr[4]=normalize(vec3(.5,-.4,-1));ctr[5]=normalize(vec3(-1,-.2,.3));
      vec3 cc[6];cc[0]=vec3(1,0,0);cc[1]=vec3(0,1,0);cc[2]=vec3(0,.15,1);
      cc[3]=vec3(0,1,1);cc[4]=vec3(1,0,1);cc[5]=vec3(1,1,0);
      float fld=0.0;vec3 csm=vec3(0.0);
      for(int i=0;i<6;i++){float fi=float(i);
        vec3 c=normalize(ctr[i]+0.07*vec3(sin(uTime*.4+fi),cos(uTime*.33+fi*1.7),sin(uTime*.27+fi*2.1)));
        float d=length(p-c);float m=pow(exp(-d*d*9.0),1.4);fld+=m;csm+=cc[i]*m;}
      vec3 rgbcmy=csm/max(fld,0.001);
      vec3 col=mix(base,mix(base,rgbcmy,0.78),uBloom);
      float ring=sin(fres*fres*70.0-uTime*1.4)*0.5+0.5;
      col=mix(col,mix(col,spectrum(ring*0.7+ang*0.12),0.6),uBloom*fres*0.3);

      // 立体陰影 (光球以降は弱める)
      float lit=1.0-clamp(uLight,0.0,1.0)*0.85;
      col=mix(col,col*shade,lit);
      col+=spec*0.35*lit;
      col+=fres*mix(vec3(.1,.2,.4),col,.5)*0.25*lit;

      // ── 白光球 ──
      if(uLight>0.001){
        vec3 fa=mix(col,vec3(0.5),uLight*0.7);
        vec3 lc=mix(fa,vec3(1.0),uLight*0.6);
        float core=(1.0-smoothstep(0.0,0.7,length(vPos)))*uLight;
        lc=mix(lc,vec3(1.0),core*0.7);
        lc=mix(lc,vec3(1.0),pow(fres,1.5)*uLight*0.85);
        lc=mix(lc,mix(vec3(1.0),spectrum(uTime*0.04+ang*0.10),0.55),pow(fres,3.0)*uLight*0.14);
        col=lc;
      }

      // ── 瞳 + 開眼 ──
      float cP=clamp(uCross,0.0,1.0);
      float ef=1.0-smoothstep(0.02,0.34,cP);
      float eP=clamp(uEye,0.0,1.0)*ef, eO=clamp(uOpen,0.0,1.0);
      if(eP>0.001){
        vec2 e=faceUv(N);e.y*=1.16;
        float reg=1.0-smoothstep(0.82,1.10,length(e*vec2(.86,1.14)));
        float lid=e.y+0.06*sin(e.x*3.14159);
        float oe=smoothstep(0.08,1.0,eO);
        float ap=mix(0.024,0.46,oe);
        float closed=exp(-lid*lid*1200.0)*(1.0-oe);
        float apM=1.0-smoothstep(ap,ap+0.06,abs(lid));
        float r=length(e*vec2(1.0,0.88));
        float scl=(1.0-smoothstep(0.55,0.75,r))*apM;
        float iris=(1.0-smoothstep(0.32,0.48,r))*smoothstep(0.07,0.16,r)*apM;
        float iRing=exp(-abs(r-0.36)*32.0)*apM;
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
        col=mix(col,vec3(0,.85,1),iRing*reg*eP*oe*0.32);
        col=mix(col,vec3(0.0),pup*reg*eP*oe);
        col=mix(col,vec3(1.0),cat*reg*eP*oe*0.78);
      }

      // ── 十字 ──
      if(cP>0.001){
        vec2 c=faceUv(N);
        float sv=1.0-smoothstep(0.12+cP*0.8,1.06,abs(c.y));
        float sh=1.0-smoothstep(0.12+cP*0.8,1.06,abs(c.x));
        float vB=exp(-c.x*c.x*72.0)*sv,hB=exp(-c.y*c.y*72.0)*sh;
        float core=exp(-dot(c,c)*30.0);
        vec3 cb=mix(col,vec3(0.0),hB*cP*0.96);
        cb=mix(cb,vec3(1.0),vB*cP*0.98);
        cb+=vec3(1.0)*core*cP*2.7;
        float vp=exp(-c.x*c.x*360.0)*smoothstep(0.0,1.0,sin(c.y*16.0-uTime*3.0)*0.5+0.5);
        cb=mix(cb,mix(vec3(1.0),spectrum(uTime*0.13+c.y),0.6),vp*cP*0.4*sv);
        col=mix(col,cb,smoothstep(0.02,0.22,cP));
        col=mix(col,vec3(1.0),cP*fres*0.35);
      }

      col=aces(col*1.18);
      col=pow(col,vec3(0.9));
      float post=max(max(max(uLight,uEye),uCross),uBloom);
      float a=clamp(max(uBirth,post),0.0,1.0);
      gl_FragColor=vec4(col,a);
    }
  `;

  // ════════════════════════════════════════════════
  //  二元パネル (0→50% の DOM: 左CMY白 / 右RGB黒)
  // ════════════════════════════════════════════════
  function buildDualityDom() {
    var wrap = document.createElement('div');
    wrap.id = 'p1one-duality';
    wrap.style.cssText='position:fixed;inset:0;z-index:2;display:flex;pointer-events:none;transition:opacity 0.8s ease;';
    wrap.innerHTML =
      '<div id="p1one-left" style="flex:1;background:#fff;position:relative;overflow:hidden;"></div>'+
      '<div id="p1one-right" style="flex:1;background:#000;position:relative;overflow:hidden;"></div>';
    var L=wrap.querySelector('#p1one-left'), R=wrap.querySelector('#p1one-right');
    // CMY 3球 (左) / RGB 3球 (右)
    var cmy=[['#00ffff','22%','30%'],['#ff00ff','30%','62%'],['#ffff00','62%','58%']];
    var rgb=[['#ff2222','58%','28%'],['#22ff44','30%','60%'],['#3344ff','66%','62%']];
    function ball(c,x,y){
      var b=document.createElement('div');
      b.className='p1one-ball';
      b.style.cssText='position:absolute;width:13%;aspect-ratio:1;border-radius:50%;background:'+c+
        ';left:'+x+';top:'+y+';transform:translate(-50%,-50%);filter:blur(0.5px);'+
        'box-shadow:0 0 24px '+c+'88;transition:all 1.0s cubic-bezier(.6,0,.4,1);';
      return b;
    }
    cmy.forEach(function(d){L.appendChild(ball(d[0],d[1],d[2]));});
    rgb.forEach(function(d){R.appendChild(ball(d[0],d[1],d[2]));});
    document.body.appendChild(wrap);
    return { wrap:wrap, left:L, right:R };
  }

  // ════════════════════════════════════════════════
  //  ローディングバー DOM (Win95)
  // ════════════════════════════════════════════════
  function buildBarDom() {
    var w=document.createElement('div');
    w.id='p1one-win';
    w.style.cssText='position:fixed;left:50%;top:38px;transform:translateX(-50%);z-index:6;'+
      'width:min(560px,86vw);background:#c0c0c0;border:2px solid #fff;border-right-color:#404040;'+
      'border-bottom-color:#404040;box-shadow:2px 2px 0 #000;font-family:"MS Sans Serif",Arial,sans-serif;';
    w.innerHTML =
      '<div style="background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-size:12px;'+
        'font-weight:bold;padding:3px 6px;display:flex;justify-content:space-between;">'+
        '<span>inryokü — Loading Reality</span><span style="font-family:monospace;">×</span></div>'+
      '<div style="padding:12px 14px;">'+
        '<div style="font-size:12px;color:#000;margin-bottom:6px;">'+
          '<span id="p1one-msg">Initializing reality engine...</span> '+
          '<span id="p1one-pct" style="float:right;font-family:monospace;">0%</span></div>'+
        '<div style="height:20px;background:#fff;border:2px inset #c0c0c0;padding:2px;">'+
          '<div id="p1one-bar" style="height:100%;width:0%;background:#000080;'+
            'background-image:repeating-linear-gradient(90deg,#000080 0,#000080 8px,#1084d0 8px,#1084d0 10px);"></div>'+
        '</div></div>';
    document.body.appendChild(w);
    return w;
  }

  // ════════════════════════════════════════════════
  //  State
  // ════════════════════════════════════════════════
  var S = {
    scene:null,camera:null,renderer:null,canvas:null,mesh:null,mat:null,
    duality:null,win:null,bar:null,pct:null,msg:null,
    prog:0, t0:0, raf:0, running:false, firedBass:false, firedP2:false, timers:new Set(),
  };
  function setT(fn,ms){var id=setTimeout(function(){S.timers.delete(id);try{fn();}catch(e){}},ms);S.timers.add(id);return id;}
  function ss(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
  function map(v,a,b){return Math.max(0,Math.min(1,(v-a)/(b-a)));}

  // ════════════════════════════════════════════════
  //  進行 → バー + 球 + 二元パネル を同期更新
  // ════════════════════════════════════════════════
  function update(dt) {
    // prog を進める (0→50 はゆっくり、50→100 もゆっくり、100→101 はタメ後ジャンプ)
    // rate = %/秒。0→50 を約11s、50→97 を約9s、97→100 タメ、100→101 breach。
    var rate;
    if (S.prog < 50)       rate = 4.5;   // 二元 (約11s、ゆっくり育つ)
    else if (S.prog < 82)  rate = 6.0;   // 陰陽→グレー (約5s)
    else if (S.prog < 97)  rate = 4.0;   // 虹の予兆 (約4s、じっくり)
    else if (S.prog < 100) rate = 1.0;   // タメ (約3s、息を呑む)
    else if (S.prog < 101) rate = 0.5;   // 101% breach 直前の溜め
    else                   rate = 0;     // 101 到達後は時間ベース
    S.prog = Math.min(101, S.prog + rate * dt);

    var pInt = Math.min(101, Math.floor(S.prog));
    if (S.bar) S.bar.style.width = Math.min(100, S.prog) + '%';
    if (S.pct) S.pct.textContent = pInt + '%';
    if (S.msg) {
      S.msg.textContent =
        S.prog < 50 ? 'Initializing reality engine...' :
        S.prog < 82 ? 'Dissolving duality...' :
        S.prog < 100 ? 'Grey contains every color...' :
        S.prog < 101 ? 'Breaching 100%...' : '101% — The Source';
    }

    // ── 二元パネル (0→50) ──
    if (S.duality) {
      var d = map(S.prog, 0, 50);
      // 球が中央へ寄り、融合 (CSS で left/top を寄せる演出は簡易に opacity+scale)
      S.duality.wrap.style.opacity = String(1 - ss(map(S.prog, 42, 52)));
      // 左パネル白→黒、右パネル黒のまま (物質=黒へ)
      S.duality.left.style.background = 'rgb('+Math.round(255*(1-d))+','+Math.round(255*(1-d))+','+Math.round(255*(1-d))+')';
      S.duality.wrap.querySelectorAll('.p1one-ball').forEach(function(b,i){
        var k=ss(d);
        b.style.transform='translate(-50%,-50%) scale('+(1-k*0.5)+')';
        b.style.left='50%'; b.style.opacity=String(1-k*0.7);
        b.style.top=(i<3? (50 - (50-parseFloat(b.dataset.y||'50'))*(1-k)) : 50)+'%';
      });
    }

    // ── 球 uniforms (50→101) ──
    var u = S.mat.uniforms;
    var t = (performance.now()-S.t0)/1000;
    u.uTime.value = t;
    if (S.camera){ u.uCam0.value=S.camera.position.x; u.uCam1.value=S.camera.position.y; u.uCam2.value=S.camera.position.z; }
    S.mesh.rotation.y = t*0.16;
    S.mesh.scale.setScalar(1.0+Math.sin(t*0.9)*0.02);

    u.uBirth.value = ss(map(S.prog, 48, 56));         // 50%付近で染み出す
    u.uGrey.value  = ss(map(S.prog, 56, 82));         // 陰陽→グレー
    var omen = ss(map(S.prog, 82, 97));
    if (S.prog >= 100) omen = Math.max(0, 1 - map(S.prog,100,100.4));
    u.uOmen.value  = omen;
    u.uBloom.value = ss(map(S.prog, 100, 101));        // 開花
    if (S.prog >= 100 && !S.firedBass){ S.firedBass=true; try{ var H=window.inryokuHarmonic; if(H&&H.breach)H.breach(); }catch(e){} ingest(); }

    // 101 到達後は時間ベースで白光→瞳→十字
    if (S.prog >= 101) {
      if (!S._t101) S._t101 = t;
      var tt = t - S._t101;
      u.uLight.value = ss(map(tt, 0.3, 2.5));
      u.uEye.value   = ss(map(tt, 2.5, 4.2));
      u.uOpen.value  = ss(map(tt, 4.2, 5.2));
      u.uCross.value = ss(map(tt, 5.2, 7.2));
      if (tt >= 7.6 && !S.firedP2){ S.firedP2=true; toP2(); }
    }
  }

  function ingest() {
    // Win95 バー窓 + 二元 → 真っ暗へ
    try {
      if (S.win){ S.win.style.transition='transform 1.4s cubic-bezier(.6,0,.9,.3),opacity 1.4s ease,filter 1.4s ease';
        S.win.style.transformOrigin='50% 60%';
        requestAnimationFrame(function(){ S.win.style.transform='translateX(-50%) scale(0.02) rotate(-540deg)'; S.win.style.opacity='0'; S.win.style.filter='blur(6px)'; });
        setT(function(){ if(S.win)S.win.style.display='none'; },1500); }
      if (S.duality){ S.duality.wrap.style.opacity='0'; setT(function(){ if(S.duality)S.duality.wrap.style.display='none'; },900); }
      document.body.style.background='#000';
    } catch(e){}
  }

  function toP2() {
    try{ var H=window.inryokuHarmonic; if(H&&H.stop)H.stop(1.0); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('p1_one_to_p2',{detail:{ts:Date.now()}})); }catch(e){}
  }

  // ════════════════════════════════════════════════
  //  Boot
  // ════════════════════════════════════════════════
  function boot() {
    THREE = window.THREE;
    if (!THREE || !THREE.WebGLRenderer) return false;

    document.body.style.background = '#000';
    document.body.style.overflow = 'hidden';

    // canvas + three
    S.canvas=document.createElement('canvas');
    S.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;display:block;';
    document.body.appendChild(S.canvas);
    S.renderer=new THREE.WebGLRenderer({canvas:S.canvas,antialias:true,alpha:true});
    S.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    S.renderer.setSize(window.innerWidth,window.innerHeight,false);
    S.renderer.setClearColor(0x000000,0);
    S.scene=new THREE.Scene();
    S.camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,0.1,50);
    S.camera.position.set(0,0,3.2); S.camera.lookAt(0,0,0);

    S.mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,
      uniforms:{uTime:{value:0},uCam0:{value:0},uCam1:{value:0},uCam2:{value:3.2},
        uBirth:{value:0},uGrey:{value:0},uOmen:{value:0},uBloom:{value:0},
        uLight:{value:0},uEye:{value:0},uOpen:{value:0},uCross:{value:0}},
      transparent:true,depthWrite:false});
    S.mesh=new THREE.Mesh(new THREE.SphereGeometry(1.0,96,96),S.mat);
    S.scene.add(S.mesh);

    // DOM
    S.duality=buildDualityDom();
    S.win=buildBarDom();
    S.bar=document.getElementById('p1one-bar');
    S.pct=document.getElementById('p1one-pct');
    S.msg=document.getElementById('p1one-msg');

    window.addEventListener('resize',function(){
      S.renderer.setSize(window.innerWidth,window.innerHeight,false);
      S.camera.aspect=window.innerWidth/window.innerHeight; S.camera.updateProjectionMatrix();
    });

    S.t0=performance.now(); S.running=true; S._last=performance.now();
    try{ window.__p1oneMat=S.mat; window.__p1one=S; }catch(e){}
    try{ var H=window.inryokuHarmonic; if(H&&H.start)H.start(); }catch(e){}
    console.log('[p1_one] boot OK — self-contained P1');
    loop();
    return true;
  }

  function loop(){
    if(!S.running) return;
    var now=performance.now();
    var dt=Math.min(0.05,(now-(S._last||now))/1000); S._last=now;
    var ff = 1; try{ if(/[\?&]at=50/.test(location.search)) ff=4; }catch(e){}
    try{ update(dt*ff); S.renderer.render(S.scene,S.camera); }catch(e){ console.warn('[p1_one]',e); }
    S.raf=requestAnimationFrame(loop);
  }

  // P0(Welcome) を抜けたら起動。?skip=intro で即起動、それ以外は ENTER 後。
  window.inryokuP1One = { boot:boot, state:S };
  function tryBoot(){ if(!S.running) boot(); }
  if (typeof window.THREE!=='undefined' && window.THREE.WebGLRenderer){
    // DOM ready 後すぐ起動 (P0 はこのページでは別途。?skip=intro 前提)
    if (document.readyState==='complete'||document.readyState==='interactive') setTimeout(tryBoot,100);
    else window.addEventListener('DOMContentLoaded',function(){setTimeout(tryBoot,100);});
  }
})();
