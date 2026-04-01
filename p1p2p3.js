'use strict';
let currentPhase = 1;
let audioContext = null;
function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

// ═══ PHASE 1 ═══
function renderPhase1() {
    currentPhase = 1;
    const root = document.getElementById('root');
    root.className = 'phase-1';
    root.innerHTML = `<center style="font-family:'Playfair Display','Georgia','Times New Roman',serif;">
    <h1 id="p1-title" style="font-size:clamp(28px,5vw,52px);font-weight:700;letter-spacing:1px;color:#222;">Welcome to the Internet</h1>
    <hr width="50%" noshade>
    <p><font face="Times New Roman" size="4">You are visitor number: <b id="vc">000000</b></font></p>
    <br><br>
    <!-- inryoku brand icon: circle with lowercase i -->
    <div style="margin:0 auto 28px auto;width:fit-content;">
      <style>
        @keyframes iGlowPulse {
          0%,100% { filter: drop-shadow(0 0 10px #808080) drop-shadow(0 0 30px #808080) drop-shadow(0 0 3px #fff); }
          50%      { filter: drop-shadow(0 0 18px #a0a0a0) drop-shadow(0 0 55px #a0a0a0) drop-shadow(0 0 6px #fff); }
        }
      </style>
      <svg width="240" height="240" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"
           style="display:block;animation:iGlowPulse 2.8s ease-in-out infinite;">
        <!-- outer circle -->
        <circle cx="36" cy="36" r="33" fill="none" stroke="#808080" stroke-width="2.5"/>
        <!-- i dot -->
        <circle cx="36" cy="22" r="3.5" fill="#808080"/>
        <!-- i stem -->
        <rect x="33.5" y="29" width="5" height="22" rx="2.5" fill="#808080"/>
      </svg>
    </div>

    <p style="color:#808080;font-size:15px;font-style:italic;max-width:480px;margin:0 auto;line-height:1.6;">
    Reality is grey. A perfect 50% between black and white.<br>
    But what if you <b>observe</b> it?</p>
    <br><br>
    <button id="evolve-btn" style="font-family:'Playfair Display','Georgia',serif;font-size:16px;padding:10px 32px;background:#C0C0C0;border:2px outset #FFF;cursor:pointer;letter-spacing:4px;">
      <b>ENTER</b>
    </button>
    <br><br>
    <p><font face="MS Gothic" size="2" color="#666">Last updated: 1995-01-01<br>Best viewed in Netscape Navigator 2.0</font></p>
    <br>
    <p><a href="#shop" onclick="event.preventDefault();skipToShop();" style="font-family:'Times New Roman';font-size:12px;color:#999;text-decoration:none;letter-spacing:1px;">Skip to Shop →</a></p>
  </center>`;

    // Visitor counter animation
    let g = 0; const vc = document.getElementById('vc');
    const iv = setInterval(() => { vc.textContent = Math.random().toString(2).substring(2, 8); if (++g > 12) { clearInterval(iv); vc.textContent = '101010'; } }, 120);

    // ── Glitch title: "Welcome to the Internet" → "Welcome to the inryokü" ──
    const titleEl = document.getElementById('p1-title');
    const target = 'Welcome to the inryok\u00fc';
    setTimeout(() => {
        let glitchCount = 0;
        const glitchInterval = setInterval(() => {
            const glitched = target.split('').map((ch) => {
                if (Math.random() < 0.4 && glitchCount < 8) {
                    return String.fromCharCode(33 + Math.floor(Math.random() * 93));
                }
                return ch;
            }).join('');
            titleEl.textContent = glitched;
            glitchCount++;
            if (glitchCount >= 10) {
                clearInterval(glitchInterval);
                titleEl.textContent = target;
            }
        }, 60);
    }, 1500);

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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 1);
        renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
        document.body.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        const aspect = W / H;
        const camH = 5, camW = camH * aspect;
        const camera = new THREE.OrthographicCamera(-camW, camW, camH, -camH, 0.1, 100);
        camera.position.z = 50;

        // Square dimensions in world units
        const sqPx = Math.min(280, Math.round(W * 0.4));
        const sqWorld = sqPx / H * camH * 2; // world units matching pixel size
        const unit = sqWorld / 10; // 1 old-unit = this many world-units

        // ══════════════════════════════════════════════════════
        //  POST-PROCESSING: Bloom only (masking via scissor)
        // ══════════════════════════════════════════════════════
        let composer = null, bloom = null;
        // Scissor rect for square clipping (GL coords: origin at bottom-left)
        const scissor = {
            x: Math.round(W / 2 - sqPx / 2),
            y: Math.round(H / 2 - sqPx / 2),
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
        ldCSS.textContent = '@keyframes p1In{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes p1Breathe{0%,100%{opacity:.85;filter:drop-shadow(0 0 12px rgba(255,255,255,.12))}50%{opacity:1;filter:drop-shadow(0 0 24px rgba(255,255,255,.25))}}@keyframes p1BarGlow{0%,100%{box-shadow:0 0 6px rgba(255,255,255,.06)}50%{box-shadow:0 0 14px rgba(255,255,255,.14)}}@keyframes p1Slide{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes p1Sq{0%,100%{border-color:rgba(255,255,255,.1);box-shadow:0 0 12px rgba(255,255,255,.03)}50%{border-color:rgba(255,255,255,.22);box-shadow:0 0 24px rgba(255,255,255,.07)}}.p1-orb{position:absolute;border-radius:50%;filter:blur(100px);opacity:.03;pointer-events:none}';
        document.head.appendChild(ldCSS);

        // UI container: square at center, other elements above
        const sqTop = Math.round(H / 2 - sqPx / 2);
        const sqLeft = Math.round(W / 2 - sqPx / 2);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10;font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;color:#fff;overflow:hidden;pointer-events:none;';
        wrap.innerHTML = `
          <div class="p1-orb" style="left:12%;top:20%;width:350px;height:350px;background:#2a35cc;"></div>
          <div class="p1-orb" style="right:10%;top:50%;width:280px;height:280px;background:#cc2255;"></div>
          <div class="p1-orb" style="left:40%;bottom:10%;width:250px;height:250px;background:#22ccaa;"></div>
          <div id="ui-above-sq" style="position:absolute;left:50%;bottom:${H - sqTop + 8}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:1;">
            <img id="ld-logo" src="enter.png" alt="inryoku" style="width:100px;height:auto;margin-bottom:28px;animation:p1Breathe 3.5s ease-in-out infinite,p1In 1s ease-out both;" onerror="this.style.display='none';" />
            <div id="bar-wrap" style="width:clamp(220px,42vw,340px);height:3px;background:rgba(255,255,255,.06);border-radius:12px;overflow:hidden;margin-bottom:14px;border:1px solid rgba(255,255,255,.04);animation:p1BarGlow 3s ease-in-out infinite,p1In 1s ease-out .12s both;">
              <div id="p1-lb" style="height:100%;width:0%;background:linear-gradient(90deg,rgba(255,255,255,.85),rgba(180,190,255,.95),rgba(255,255,255,.85));background-size:200% 100%;border-radius:12px;transition:width .2s cubic-bezier(.4,0,.2,1);animation:p1Slide 2.5s linear infinite;"></div>
            </div>
            <p id="p1-lpct" style="color:rgba(255,255,255,.35);font-size:13px;font-weight:500;letter-spacing:3px;margin:0;font-variant-numeric:tabular-nums;animation:p1In 1s ease-out .24s both;">0%</p>
          </div>
          <div id="sq-border" style="width:${sqPx}px;height:${sqPx}px;border:1.5px solid rgba(255,255,255,.1);border-radius:6px;position:absolute;left:${sqLeft}px;top:${sqTop}px;z-index:1;animation:p1Sq 4s ease-in-out infinite,p1In 1s ease-out .36s both;transition:opacity 0.5s,border-color 0.3s,box-shadow 0.3s;"></div>
        `;
        document.body.appendChild(wrap);

        const bar = document.getElementById('p1-lb');
        const pct = document.getElementById('p1-lpct');
        const logoEl = document.getElementById('ld-logo');
        const barWrap = document.getElementById('bar-wrap');
        const sqBorder = document.getElementById('sq-border');
        const whiteOv = document.createElement('div');
        whiteOv.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#fff;opacity:0;pointer-events:none;';
        document.body.appendChild(whiteOv);

        // ══════════════════════════════════════════════════════
        //  SHADERS
        // ══════════════════════════════════════════════════════
        const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

        // ── Scene Lighting (demo_pattern_dと同じ — 球の立体感) ──
        scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(3, 3, 5);
        scene.add(dirLight);

        // ── Background split (square-sized plane) ──
        const bgMat = new THREE.ShaderMaterial({
            uniforms: { u_grey: { value: 0 }, u_flash: { value: 0 }, u_time: { value: 0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;uniform float u_grey,u_flash,u_time;',
                'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
                'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
                'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}',
                'void main(){',
                '  float nx=fbm(vec2(vUv.y*8.0,u_time*0.3))*0.018;float edge=vUv.x-0.5+nx;',
                '  float r=smoothstep(-0.004,0.004,edge);',
                '  vec3 wh=vec3(1.0);',
                '  vec3 bk=vec3(0.0);',
                '  vec3 c=mix(wh,bk,r);',
                '  float greyMix=min(u_grey,1.0);float darkMix=clamp(u_grey-1.0,0.0,1.0);',
                '  c=mix(c,vec3(0.5),greyMix);c=mix(c,vec3(0.0),darkMix);',
                '  float d=1.0-smoothstep(0.0,0.015,abs(edge));',
                '  vec3 ec=vec3(0.5+0.15*sin(vUv.y*12.0+u_time*1.5),0.5,0.5+0.15*cos(vUv.y*10.0+u_time));',
                '  c=mix(c,ec*0.5,d*(1.0-greyMix)*0.5);c=mix(c,vec3(1.0),u_flash);',
                '  gl_FragColor=vec4(c,1.0);',
                '}'
            ].join('\n'), depthWrite: false
        });
        const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld, sqWorld), bgMat);
        bgPlane.position.z = -1; scene.add(bgPlane);

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
        const fieldPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld, sqWorld), fieldMat);
        fieldPlane.position.z = 0.1; fieldPlane.visible = false; scene.add(fieldPlane);

        // ── CMY particles (物質: 水滴のような半透明・屈折・にじみ) ──
        const cmySphereGeo = new THREE.SphereGeometry(0.4 * unit, 32, 32);
        const cmyTriPos = [ // 正三角形（スクエア左半分中心基準）
            [0, 0.8 * unit],         // 上
            [-0.7 * unit, -0.4 * unit], // 左下
            [0.7 * unit, -0.4 * unit],  // 右下
        ];
        const cmyCtr = new THREE.Vector3(-2.5 * unit, 0, 0);
        const cmyColors = [0x00ffff, 0xff00ff, 0xffff00];
        const cmyP = cmyColors.map((c, i) => {
            const col = new THREE.Color(c);
            const mat = new THREE.ShaderMaterial({
                uniforms: { u_color: { value: col }, u_time: { value: 0 } },
                vertexShader: [
                    'varying vec3 vNormal; varying vec3 vViewPos; uniform float u_time;',
                    'void main(){',
                    '  vec3 pos = position;',
                    '  float n = sin(pos.x*8.0+u_time*0.5)*cos(pos.y*8.0+u_time*0.3)*0.02;',
                    '  pos += normal * n;',
                    '  vNormal = normalize(normalMatrix * normal);',
                    '  vec4 mvPos = modelViewMatrix * vec4(pos,1.0);',
                    '  vViewPos = -mvPos.xyz;',
                    '  gl_Position = projectionMatrix * mvPos;',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'precision highp float;',
                    'varying vec3 vNormal; varying vec3 vViewPos;',
                    'uniform vec3 u_color; uniform float u_time;',
                    'void main(){',
                    '  vec3 N = normalize(vNormal);',
                    '  vec3 V = normalize(vViewPos);',
                    '  float fresnel = pow(1.0-max(dot(N,V),0.0), 3.0);',
                    '  vec3 refractColor = u_color * 0.7;',
                    '  vec3 reflectColor = vec3(1.0) * 0.9;',
                    '  vec3 col = mix(refractColor, reflectColor, fresnel * 0.6);',
                    '  float rim = smoothstep(0.0, 0.6, fresnel);',
                    '  col += vec3(1.0) * rim * 0.35;',
                    '  float caustic = sin(vViewPos.x*15.0+u_time)*cos(vViewPos.y*15.0+u_time*0.7)*0.08;',
                    '  col += u_color * max(0.0, caustic);',
                    '  float alpha = 0.55 + fresnel * 0.4;',
                    '  gl_FragColor = vec4(col, alpha);',
                    '}'
                ].join('\n'),
                transparent: true, depthWrite: false
            });
            const m = new THREE.Mesh(cmySphereGeo, mat);
            m.position.set(cmyCtr.x + cmyTriPos[i][0], cmyCtr.y + cmyTriPos[i][1], 0.5);
            m.userData = { ox: m.position.x, oy: m.position.y };
            scene.add(m); return m;
        });

        // ── RGB particles (精神: 内側から光が滲み出す・エッジぼやける) ──
        const rgbSphereGeo = new THREE.SphereGeometry(0.4 * unit, 32, 32);
        const rgbTriPos = [ // 正三角形（スクエア右半分中心基準）
            [0, 0.8 * unit],
            [-0.7 * unit, -0.4 * unit],
            [0.7 * unit, -0.4 * unit],
        ];
        const rgbCtr = new THREE.Vector3(2.5 * unit, 0, 0);
        const rgbColors = [0xff0000, 0x00ff00, 0x0000ff];
        const rgbP = rgbColors.map((c, i) => {
            const col = new THREE.Color(c);
            const mat = new THREE.ShaderMaterial({
                uniforms: { u_color: { value: col }, u_time: { value: 0 } },
                vertexShader: [
                    'varying vec3 vNormal; varying vec3 vPos;',
                    'void main(){',
                    '  vNormal = normalize(normalMatrix * normal);',
                    '  vPos = position;',
                    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'precision highp float;',
                    'varying vec3 vNormal; varying vec3 vPos;',
                    'uniform vec3 u_color; uniform float u_time;',
                    'void main(){',
                    '  float dist = length(vPos);',
                    '  float core = 1.0 - smoothstep(0.0, 0.8, dist);',
                    '  float glow = 1.0 - smoothstep(0.3, 1.0, dist);',
                    '  float pulse = sin(u_time*2.0+dist*5.0)*0.1+0.9;',
                    '  vec3 color = u_color * core * pulse;',
                    '  color += u_color * 0.3 * glow;',
                    '  float alpha = glow * pulse;',
                    '  gl_FragColor = vec4(color, alpha);',
                    '}'
                ].join('\n'),
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const m = new THREE.Mesh(rgbSphereGeo, mat);
            m.position.set(rgbCtr.x + rgbTriPos[i][0], rgbCtr.y + rgbTriPos[i][1], 0.5);
            m.userData = { ox: m.position.x, oy: m.position.y };
            scene.add(m); return m;
        });

        // ── Fused dots ──
        const dotGeo = new THREE.SphereGeometry(0.65 * unit, 16, 16);
        const bDotMat = new THREE.ShaderMaterial({
            vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.02),1.0);}'
        });
        const wDotMat = new THREE.ShaderMaterial({
            vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: 'precision highp float;void main(){gl_FragColor=vec4(vec3(0.98),1.0);}'
        });
        const bDot = new THREE.Mesh(dotGeo, bDotMat); bDot.visible = false; scene.add(bDot);
        const wDot = new THREE.Mesh(dotGeo, wDotMat); wDot.visible = false; scene.add(wDot);

        // ── Grey Sphere (demo_pattern_d移植 — uniform制御、runtime書き換え禁止) ──
        // 旧サイズ: 0.65 * unit ≈ 0.20 → 画面の4%で見えなかった
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
            // デモ(demo_pattern_d.html)と完全同一のシェーダー
            fragmentShader: [
                'precision highp float;',
                'varying vec3 vNormal; varying vec3 vPos;',
                'uniform float u_time, u_glow, u_rainbow, u_opacity;',
                'void main() {',
                '  if (u_opacity < 0.005) discard;',
                '  vec3 N = normalize(vNormal);',
                '  float fresnel = pow(1.0 - max(dot(N, vec3(0,0,1)), 0.0), 3.0);',
                '  float r = length(vPos.xy);',
                '  float ring = sin(r * 40.0 - u_time * 2.0) * 0.5 + 0.5;',
                '  float grey = 0.50 + ring * 0.04;',
                '  vec3 col = vec3(grey);',
                '  vec3 rainbow = vec3(',
                '    0.5+0.5*sin(fresnel*8.0+u_time*1.5),',
                '    0.5+0.5*sin(fresnel*8.0+u_time*1.5+2.094),',
                '    0.5+0.5*sin(fresnel*8.0+u_time*1.5+4.189)',
                '  );',
                '  col = mix(col, rainbow, fresnel * u_rainbow);',
                '  col += vec3(u_glow * 0.4);',
                '  col += vec3(1.0) * fresnel * u_glow * 0.8;',
                '  float diff = max(dot(N, normalize(vec3(1,1,2))), 0.0) * 0.4 + 0.6;',
                '  col *= diff;',
                '  gl_FragColor = vec4(col, u_opacity);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, depthTest: false
        });
        const greySphere = new THREE.Mesh(greySphereGeo, greySphereMat);
        greySphere.visible = false; greySphere.position.z = 0.5; scene.add(greySphere);

        // ── Yin-Yang GLSL ──
        const yyMat = new THREE.ShaderMaterial({
            uniforms: { u_rot: { value: 0 }, u_grey: { value: 0 }, u_alpha: { value: 0 }, u_time: { value: 0 } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;uniform float u_rot,u_grey,u_alpha,u_time;',
                'void main(){',
                '  vec2 p=(vUv-0.5)*2.0;float ca=cos(u_rot),sa=sin(u_rot);',
                '  vec2 rp=vec2(ca*p.x-sa*p.y,sa*p.x+ca*p.y);float r=length(rp);',
                '  if(r>1.05)discard;',
                '  float outerGlow=smoothstep(1.0,0.88,r)*smoothstep(0.78,0.88,r);float aO=atan(p.y,p.x);',
                '  vec3 glC=vec3(0.5+0.5*sin(aO*3.0+u_time),0.5+0.5*sin(aO*3.0+u_time+2.094),0.5+0.5*sin(aO*3.0+u_time+4.189));',
                '  float ring=smoothstep(0.82,0.84,r)*(1.0-smoothstep(0.84,0.86,r));',
                '  float b=rp.x-sin(rp.y*3.14159)*0.28;',
                '  float s1=smoothstep(0.1,0.08,length(rp-vec2(0.0,0.24)));',
                '  float s2=smoothstep(0.1,0.08,length(rp-vec2(0.0,-0.24)));',
                '  float y=smoothstep(-0.01,0.01,b)*step(r,0.84);y=y*(1.0-s1)+s2*step(r,0.84);',
                '  vec3 c=mix(vec3(0.02),vec3(0.97),y)+ring*0.4;c=mix(c,vec3(0.5),u_grey);',
                '  c+=outerGlow*glC*0.35*(1.0-u_grey);',
                '  float a=max(step(r,0.86),outerGlow*0.5)*u_alpha;',
                '  gl_FragColor=vec4(c,a);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false
        });
        const yyPlane = new THREE.Mesh(new THREE.PlaneGeometry(sqWorld * 0.5, sqWorld * 0.5), yyMat);
        yyPlane.visible = false; yyPlane.position.z = 0.5; scene.add(yyPlane);

        // ── RGBCMY Tunnel (3D depth版 — demo_pattern_d移植) ──
        // デモと同じscale=3.0を基準。EVENT_COLLAPSEで動的に拡大
        const tunnelSize = Math.max(camW, camH) * 4;
        const tunnelMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 }, u_progress: { value: 0 },
                u_radius: { value: 0 }, u_alpha: { value: 0 },
                u_warpSpeed: { value: 1.0 }, u_scale: { value: 3.0 },
                u_depth: { value: 0 },          // 奥行き (0=flat, 1=deep)
                u_ringDensity: { value: 3.0 },   // リング密度
                u_scrollMul: { value: 0.2 }      // スクロール速度倍率
            },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;',
                'uniform float u_time,u_progress,u_radius,u_alpha,u_warpSpeed,u_scale,u_depth,u_ringDensity,u_scrollMul;',
                'vec3 ringColor(int i){',
                '  if(i==0)return vec3(1.0,0.0,0.0);',   // Red
                '  if(i==1)return vec3(0.0,1.0,1.0);',   // Cyan
                '  if(i==2)return vec3(0.0,1.0,0.0);',   // Green
                '  if(i==3)return vec3(1.0,0.0,1.0);',   // Magenta
                '  if(i==4)return vec3(0.0,0.0,1.0);',   // Blue
                '  return vec3(1.0,1.0,0.0);',           // Yellow
                '}',
                // ── demo_pattern_d.html と完全同一のトンネルシェーダー ──
                'void main(){',
                '  vec2 p=(vUv-0.5)*2.0*u_scale;',
                '  float r=length(p);',
                '  float mask=1.0-smoothstep(u_radius-0.03,u_radius,r);',
                '  if(mask<0.005)discard;',
                // 3D遠近法
                '  float normR=r/max(u_radius,0.001);',
                '  float depthR=pow(normR,0.6+u_depth*0.6);',
                // スクロール: 奥はゆっくり、手前は速い
                '  float scrollSpeed=(0.8+normR*normR*1.5)*u_scrollMul*u_warpSpeed;',
                '  float phase=depthR*u_ringDensity-u_time*scrollSpeed;',
                '  float band=mod(phase,6.0);',
                '  int idx=int(floor(band));',
                '  float frac_=fract(band);',
                '  vec3 c0=ringColor(int(mod(float(idx),6.0)));',
                '  vec3 c1=ringColor(int(mod(float(idx+1),6.0)));',
                '  float blend=smoothstep(0.3,0.7,frac_);',
                '  vec3 col=mix(c0,c1,blend);',
                // 奥行き明暗（デモと同一）
                '  float depthBright=0.3+normR*1.2;',
                '  col*=depthBright;',
                // トンネル出口の白い光（デモと同一）
                '  float focal=exp(-normR*normR*8.0);',
                '  col=mix(col,vec3(1.4),focal*0.6);',
                // 壁面RGBCMY反射（デモと同一）
                '  float angle=atan(p.y,p.x);',
                '  float wallZone=smoothstep(u_radius,u_radius-0.06,r)*smoothstep(u_radius-0.15,u_radius-0.06,r);',
                '  int wallIdx=int(mod(angle/6.28318*6.0-u_time*0.5,6.0));',
                '  vec3 wallCol=ringColor(wallIdx);',
                '  col+=wallCol*wallZone*0.4*(0.5+normR*0.5);',
                // リング間の暗い隙間（デモと同一）
                '  float ringEdge=abs(frac_-0.5)*2.0;',
                '  float edgeDarken=0.85+0.15*smoothstep(0.0,0.3,ringEdge);',
                '  col*=edgeDarken;',
                // ビネット（デモと同一）
                '  float vignette=1.0-normR*normR*0.3;',
                '  col*=vignette;',
                // u_progressは削除（デモにない余計な明度乗算でコントラスト潰れの原因）
                '  gl_FragColor=vec4(col*mask,mask*u_alpha);',
                '}'
            ].join('\n'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
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

        // ── Solar cross GLSL ──
        const scMat = new THREE.ShaderMaterial({
            uniforms: { u_alpha: { value: 0 }, u_time: { value: 0 }, u_aspect: { value: aspect } },
            vertexShader: VS,
            fragmentShader: [
                'precision highp float;varying vec2 vUv;uniform float u_alpha,u_time,u_aspect;',
                'void main(){',
                '  vec2 uv=(vUv-0.5)*2.0;uv.x*=u_aspect;float r=length(uv);float sz=0.32;',
                '  float ring=abs(r-sz)-0.008;float ringA=1.0-smoothstep(0.0,0.012,ring);',
                '  float cx2=abs(uv.x);float cy2=abs(uv.y);',
                '  float crossH=step(cy2,0.006)*step(cx2,sz);float crossV=step(cx2,0.006)*step(cy2,sz);',
                '  float crossA=max(crossH,crossV);',
                '  float gRing=exp(-ring*ring*800.0)*0.6;',
                '  float gCrossH=exp(-cy2*cy2*8000.0)*step(cx2,sz*1.2)*0.3;',
                '  float gCrossV=exp(-cx2*cx2*8000.0)*step(cy2,sz*1.2)*0.3;',
                '  float halo=exp(-abs(r-sz*1.4)*12.0)*0.15;',
                '  float angle=atan(uv.y,uv.x);float rays=pow(max(0.0,cos(angle*2.0)),40.0)*exp(-r*3.0)*0.2;',
                '  float shape=max(ringA,crossA)+gRing+gCrossH+gCrossV+halo+rays;',
                '  vec3 gold=vec3(0.85,0.72,0.35);',
                '  vec3 col=vec3(1.0)-shape*u_alpha*mix(vec3(0.7),gold,0.3+0.2*sin(u_time*2.0));',
                '  gl_FragColor=vec4(col,1.0);',
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
            bar.style.width = Math.min(pv, 100) + '%';
            pct.textContent = pv + '%';
        }

        // ── MAIN TICK ──
        function tick() {
            if (!alive) return;
            const dt = Math.min(clk.getDelta(), 0.05);
            globalTime += dt;
            bgMat.uniforms.u_time.value = globalTime;
            fieldMat.uniforms.u_time.value = globalTime;
            if (yyPlane.visible) yyMat.uniforms.u_time.value = globalTime;
            if (tunnelPlane.visible) tunnelMat.uniforms.u_time.value = globalTime;
            if (greySphere.visible) greySphereMat.uniforms.u_time.value = globalTime;
            if (haloPlane.visible) haloMat.uniforms.u_time.value = globalTime;
            if (scPlane.visible) scMat.uniforms.u_time.value = globalTime;

            // ═══ PHASE 0: ATTRACT (0→30%) ═══
            if (phase === PH.ATTRACT) {
                const t = prog / 30;
                // CMY: 粘性のある動き（物質）
                cmyP.forEach((p, i) => {
                    p.material.uniforms.u_time.value = globalTime;
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
                    p.material.uniforms.u_time.value = globalTime;
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

                // ═══ PHASE 3: EVENT_SING (50%) — フラッシュ→暗転→グレー球（デモと同じ黒背景） ═══
            } else if (phase === PH.EVENT_SING) {
                eventTimer += dt;
                const et = eventTimer;

                // Step 1 (0-0.3s): 衝突フラッシュ
                if (et < 0.3) {
                    const t2 = et / 0.3;
                    bDot.position.x += (0 - bDot.position.x) * 0.3;
                    wDot.position.x += (0 - wDot.position.x) * 0.3;
                    bgMat.uniforms.u_flash.value = t2 * t2;
                    if (bloom) bloom.strength = 1.0 + t2 * 3.0;
                }

                // Step 2 (0.3-1.5s): フラッシュ減衰 + 背景グレー→黒
                if (et >= 0.3 && et < 1.5) {
                    const t2 = (et - 0.3) / 1.2;
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - t2 * 2.0);
                    // 背景: グレー(0.8)→完全黒(2.0) — デモと同じ黒背景にする
                    bgMat.uniforms.u_grey.value = 0.8 + t2 * 1.2;
                    if (bloom) bloom.strength = Math.max(0.3, 2.0 * (1 - t2));
                }

                // Step 3 (1.5-2.5s): 黒背景にグレー球がふわっと出現 + ハロー
                if (et >= 1.5 && et < 2.5) {
                    const t2 = (et - 1.5) / 1.0;
                    bgMat.uniforms.u_grey.value = 2.0; // 黒維持
                    bgMat.uniforms.u_flash.value = 0;
                    greySphere.visible = true;
                    greySphere.position.set(0, 0, 0.5);
                    const ease = 1 - Math.pow(1 - t2, 2);
                    greySphere.scale.setScalar(0.1 + ease * 0.9);
                    greySphereMat.uniforms.u_opacity.value = ease;
                    greySphereMat.uniforms.u_glow.value = 0.08;
                    // ハロー: 球と同時にふわっと出現
                    haloPlane.visible = true;
                    haloMat.uniforms.u_glow.value = ease * 0.05;
                    if (bloom) bloom.strength = 0.3 + ease * 0.3;
                }

                // Step 4 (2.5-4.5s): グレー球が静かに呼吸（デモPhase1と同じ）
                if (et >= 2.5 && et < 4.5) {
                    const t2 = (et - 2.5) / 2.0;
                    bgMat.uniforms.u_grey.value = 2.0;
                    greySphere.visible = true;
                    greySphereMat.uniforms.u_opacity.value = 1.0;
                    greySphere.rotation.y = et * 0.2;
                    greySphere.rotation.x = Math.sin(et * 0.3) * 0.05;
                    const breath = Math.sin(et * 1.5) * 0.008;
                    greySphere.scale.setScalar(1.0 + breath);
                    greySphereMat.uniforms.u_glow.value = t2 / 4.0 * 0.08;
                    haloMat.uniforms.u_glow.value = 0.05 + t2 * 0.03;
                    if (bloom) bloom.strength = 0.4;
                }

                // Step 5 (4.5-6.5s): 虹フレネルにじみ（デモPhase2と同じ）
                if (et >= 4.5 && et < 6.5) {
                    const t2 = (et - 4.5) / 2.0;
                    const ease = t2 * t2 * t2; // ease-in cubic
                    bgMat.uniforms.u_grey.value = 2.0;
                    greySphere.rotation.y = et * 0.2;
                    haloMat.uniforms.u_glow.value = 0.08 + ease * 0.15;
                    greySphere.rotation.x = Math.sin(et * 0.3) * 0.05;
                    greySphereMat.uniforms.u_glow.value = 0.08 + ease * 0.25;
                    greySphereMat.uniforms.u_rainbow.value = ease * 0.3;
                    const pulse = 1 + Math.sin(et * 2) * 0.01 * (0.3 + ease);
                    greySphere.scale.setScalar(pulse);
                    if (bloom) bloom.strength = 0.6 + ease * 0.5;
                }

                if (et >= 6.5) { phase = PH.WARP_GROW; progPaused = false; }

                // ═══ PHASE 4: WARP_GROW (50→75%) — トンネルの気配、裏からにじみ出る ═══
            } else if (phase === PH.WARP_GROW) {
                const wt = (prog - 50) / 25; // 0→1
                greySphere.rotation.y += dt * 0.2;
                bgMat.uniforms.u_grey.value = 2.0; // 黒維持（EVENT_SINGで既に黒）

                // トンネル: 球の裏からにじみ出る（デモPhase3と同じ値）
                tunnelPlane.visible = true;
                const ease = wt * wt;
                tunnelMat.uniforms.u_radius.value = 0.04 + ease * 0.18;
                tunnelMat.uniforms.u_alpha.value = ease * 0.35;
                tunnelMat.uniforms.u_depth.value = ease * 0.2;
                tunnelMat.uniforms.u_ringDensity.value = 3.0 + ease * 2.0;
                tunnelMat.uniforms.u_scrollMul.value = 0.2 + ease * 0.3;

                // ハロー（デモPhase3と同じ: 0.23+p*0.05）
                haloMat.uniforms.u_glow.value = 0.23 + wt * 0.05;

                // 球: まだほぼ縮まない
                greySphereMat.uniforms.u_glow.value = 0.33 + wt * 0.1;
                greySphereMat.uniforms.u_rainbow.value = 0.3 + wt * 0.2;
                const shrink = 1.0 - ease * 0.08;
                const pulse = 1 + Math.sin(globalTime * 2) * 0.01;
                greySphere.scale.setScalar(shrink * pulse);
                if (bloom) bloom.strength = 0.2 + wt * 0.3;

                if (prog >= 75) { phase = PH.EVENT_BREACH; eventTimer = 0; prog = 75; showProg(75); progPaused = true; }

                // ═══ PHASE 5: EVENT_BREACH (75%) — トンネルが育つ ═══
            } else if (phase === PH.EVENT_BREACH) {
                eventTimer += dt;
                const et = eventTimer;
                const p = Math.min(et / 4.0, 1.0); // 4秒かけて
                const ease = 1 - Math.pow(1 - p, 2);
                greySphere.rotation.y += dt * 0.15;
                bgMat.uniforms.u_grey.value = 2.0; // 背景黒維持

                // トンネル成長（デモPhase4と同じ値）
                tunnelPlane.visible = true;
                tunnelMat.uniforms.u_radius.value = 0.22 + ease * 0.20;
                tunnelMat.uniforms.u_alpha.value = 0.35 + ease * 0.35;
                tunnelMat.uniforms.u_depth.value = 0.2 + ease * 0.4;
                tunnelMat.uniforms.u_ringDensity.value = 5.0 + ease * 3.0;
                tunnelMat.uniforms.u_scrollMul.value = 0.5 + ease * 0.5;
                tunnelMat.uniforms.u_progress.value = 0.5 + ease * 0.2;

                // 球: ゆっくり縮み + 虹強化
                const shrinkEase = p * p;
                greySphereMat.uniforms.u_glow.value = 0.43 - shrinkEase * 0.1;
                greySphereMat.uniforms.u_rainbow.value = 0.5 + p * 0.3;
                greySphere.scale.setScalar((0.92 - shrinkEase * 0.15) * (1 + Math.sin(globalTime * 2.5) * 0.01));
                // ハロー（デモPhase4: 0.28-shrinkEase*0.08）
                haloMat.uniforms.u_glow.value = 0.28 - shrinkEase * 0.08;
                if (bloom) bloom.strength = 0.2 + ease * 0.3; // max 0.5（デモはbloom無し。過多で色がぼける）

                // 境界の光
                if (et < 2.0) {
                    const g = 40 + (et / 2.0) * 30;
                    sqBorder.style.boxShadow = '0 0 ' + g + 'px 15px rgba(255,100,255,0.15),0 0 ' + (g * 1.2) + 'px 30px rgba(100,255,255,0.1)';
                }
                if (et >= 4.0) { phase = PH.CONSUME; progPaused = false; sqBorder.style.borderColor = 'transparent'; }

                // ═══ PHASE 6: CONSUME (75→101%) — 球が溶けてトンネル完成形 ═══
            } else if (phase === PH.CONSUME) {
                const at = (prog - 75) / 25; // 0→~1
                const ease = 1 - Math.pow(1 - at, 2);
                bgMat.uniforms.u_grey.value = 2.0; // 背景黒維持

                // 球フェードアウト
                const shrinkP = at * at;
                greySphere.scale.setScalar(Math.max(0.05, 0.77 * (1 - shrinkP * 0.8)));
                greySphereMat.uniforms.u_opacity.value = Math.max(0, 1.0 - shrinkP * 1.2);
                greySphereMat.uniforms.u_glow.value = 0.33 * (1 - at);
                greySphereMat.uniforms.u_rainbow.value = 0.8;

                // ハロー減衰（球が消えるにつれて）
                haloMat.uniforms.u_glow.value = 0.20 * (1 - shrinkP);

                // トンネル完成へ（デモPhase5と同じ値 + 呼吸アニメ）
                const breathR = Math.sin(globalTime * 1.2) * 0.02; // デモPhase6と同じ呼吸
                tunnelMat.uniforms.u_radius.value = 0.42 + ease * 0.18 + breathR * ease;
                tunnelMat.uniforms.u_alpha.value = 0.70 + ease * 0.25;
                tunnelMat.uniforms.u_depth.value = 0.6 + ease * 0.3;
                tunnelMat.uniforms.u_ringDensity.value = 8.0 + ease * 3.0;
                tunnelMat.uniforms.u_scrollMul.value = 1.0 + ease * 0.4;
                tunnelMat.uniforms.u_progress.value = 0.7 + ease * 0.3;

                const g = 40 + at * 40;
                sqBorder.style.boxShadow = '0 0 ' + g + 'px 15px rgba(255,100,255,0.2),0 0 ' + (g * 1.5) + 'px 30px rgba(100,255,255,0.15)';
                if (bloom) bloom.strength = 0.3 + at * 0.2; // max 0.5（デモはbloom無し。1.0だと色がぼける）
                if (at > 0.5) greySphere.visible = false;

                if (prog >= 100) { phase = PH.EVENT_COLLAPSE; eventTimer = 0; prog = 100; progPaused = true; }

                // ═══ PHASE 7: EVENT_COLLAPSE — すべてがトンネルに吸い込まれる ═══
            } else if (phase === PH.EVENT_COLLAPSE) {
                eventTimer += dt;
                const et = eventTimer;
                greySphere.visible = false;
                haloPlane.visible = false; // ハロー消す
                bgMat.uniforms.u_grey.value = 2.0; // 背景黒維持
                tunnelMat.uniforms.u_alpha.value = 1.0;
                tunnelMat.uniforms.u_depth.value = 0.9;
                tunnelMat.uniforms.u_ringDensity.value = 11.0;

                // Step 1 (0-0.8s): UIがトンネル中心に吸い込まれる
                if (et < 0.8) {
                    const t2 = et / 0.8, ease = t2 * t2 * t2;
                    if (barWrap) { barWrap.style.transition = 'none'; barWrap.style.transform = 'scale(' + Math.max(0.01, 1 - ease) + ')'; barWrap.style.opacity = String(1 - ease * 2); barWrap.style.filter = 'blur(' + (ease * 12) + 'px)'; }
                    pct.style.transform = 'scale(' + Math.max(0.01, 1 - ease) + ')'; pct.style.opacity = String(1 - ease * 2);
                    if (logoEl) { const le = Math.max(0, (et - 0.2) / 0.6); if (le > 0) { logoEl.style.transform = 'scale(' + Math.max(0.01, 1 - le * le) + ')'; logoEl.style.opacity = String(1 - le * le * 1.5); logoEl.style.filter = 'blur(' + (le * le * 10) + 'px)'; } }
                    // デモ完成形（radius=0.60）からスタート
                    tunnelMat.uniforms.u_radius.value = 0.60 + ease * 0.40;
                    tunnelMat.uniforms.u_scrollMul.value = 1.4;
                }
                if (et >= 0.8 && et < 0.85) {
                    if (barWrap) barWrap.style.display = 'none'; pct.style.display = 'none';
                    if (logoEl) logoEl.style.display = 'none';
                    wrap.querySelectorAll('.p1-orb').forEach(o => o.style.display = 'none');
                    bgPlane.visible = false; fieldPlane.visible = false;
                    bDot.visible = false; wDot.visible = false;
                    yyPlane.visible = false;
                    cmyP.forEach(p => p.visible = false);
                    rgbP.forEach(p => p.visible = false);
                }

                // Step 2 (0.8-3.0s): トンネルが画面全体を覆う（u_scaleを拡大）
                if (et >= 0.8 && et < 3.0) {
                    const t2 = (et - 0.8) / 2.2, eased = t2 * t2;
                    sqBorder.style.opacity = String(Math.max(0, 1 - eased * 3));
                    const curW = sqPx + (W - sqPx) * eased;
                    const curH = sqPx + (H - sqPx) * eased;
                    scissor.x = Math.round(W / 2 - curW / 2);
                    scissor.y = Math.round(H / 2 - curH / 2);
                    scissor.w = Math.round(curW);
                    scissor.h = Math.round(curH);
                    // scale拡大でトンネルが画面を覆う + radius拡大
                    tunnelMat.uniforms.u_scale.value = 3.0 - eased * 1.5;
                    tunnelMat.uniforms.u_radius.value = 1.0 + eased * 2.0;
                    tunnelMat.uniforms.u_warpSpeed.value = 1.0 + eased * 4.0;
                    tunnelMat.uniforms.u_scrollMul.value = 1.4 + eased * 3.0;
                    if (bloom) bloom.strength = 0.8 + eased * 1.5;
                }

                // Step 3 (3.0-5.5s): トンネル中心に吸い込まれる — 暗転収束
                if (et >= 3.0 && et < 5.5) {
                    const t2 = (et - 3.0) / 2.5, eased = t2 * t2;
                    sqBorder.style.display = 'none';
                    scissor.enabled = false;
                    // カメラが前進 — トンネル中心に突入
                    camera.position.z = 50 - eased * 42;
                    camera.rotation.z += dt * (0.2 + eased * 1.2);
                    tunnelMat.uniforms.u_scale.value = 1.5 - eased * 0.5;
                    tunnelMat.uniforms.u_radius.value = 3.0 + eased * 3.0;
                    tunnelMat.uniforms.u_warpSpeed.value = 5.0 + eased * 8.0;
                    tunnelMat.uniforms.u_scrollMul.value = 4.4 + eased * 6.0;
                    tunnelMat.uniforms.u_ringDensity.value = 11.0 + eased * 4.0;
                    if (bloom) bloom.strength = 1.5 + eased * 2.0;
                    tunnelMat.uniforms.u_progress.value = 1.0 + eased * 0.5;
                    scene.background = new THREE.Color(0, 0, 0);
                    whiteOv.style.opacity = '0';
                }

                // Step 4 (5.5-6.5s): 完全にトンネル中心 → 暗転 → P2へ
                if (et >= 5.5 && et < 6.5) {
                    const t2 = (et - 5.5) / 1.0;
                    // トンネルの色が中心に収束、暗くなる
                    tunnelMat.uniforms.u_progress.value = Math.max(0, 1.5 - t2 * 2.0);
                    tunnelMat.uniforms.u_alpha.value = Math.max(0, 1.0 - t2 * 1.2);
                    tunnelMat.uniforms.u_warpSpeed.value = 13.0 + t2 * 20.0;
                    if (t2 > 0.5) tunnelPlane.visible = false;
                    bgPlane.visible = false;
                    renderer.setClearColor(0x000000, 1);
                    if (bloom) bloom.strength = Math.max(0, 3.0 - t2 * 4.0);
                }

                // Step 5 (6.5s): P2遷移
                if (et >= 6.5 && phase !== PH.DONE) {
                    phase = PH.DONE; alive = false;
                    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.dispose) o.material.dispose(); } });
                    if (composer) { composer.passes.forEach(p => { if (p.dispose) p.dispose(); }); }
                    renderer.dispose(); renderer.domElement.remove();
                    whiteOv.remove(); wrap.remove();
                    renderPhase5();
                }
            }
        }

        // ══════════════════════════════════════════════════════
        //  PROGRESS ENGINE
        // ══════════════════════════════════════════════════════
        const progIv = setInterval(() => {
            if (progPaused) { tick(); return; }
            prog += Math.random() * 0.7 + 0.25;
            if (phase === PH.ATTRACT && prog > 30) prog = 30;
            if (phase === PH.DUALITY && prog > 50) prog = 50;
            if (phase === PH.WARP_GROW && prog > 75) prog = 75;
            if (phase === PH.CONSUME && prog > 101) prog = 101;
            showProg(prog);
            tick();
            if (phase === PH.DONE) clearInterval(progIv);
        }, 80);




        // Scissor is pre-calculated from sqTop/sqLeft (no DOM sync needed)
        // Square is at exact screen center → scissor matches Three.js origin

        // ══════════════════════════════════════════════════════
        //  RENDER LOOP
        // ══════════════════════════════════════════════════════
        (function renderLoop() {
            if (!alive) return;
            if (scissor.enabled) {
                renderer.setScissorTest(true);
                renderer.setScissor(scissor.x, scissor.y, scissor.w, scissor.h);
                renderer.setViewport(0, 0, W, H);
            } else {
                renderer.setScissorTest(false);
            }
            if (composer) composer.render(); else renderer.render(scene, camera);
            requestAnimationFrame(renderLoop);
        })();
    });
}






// ═══ PHASE 2: CMY — 3D SOLID SPHERES (Three.js MultiplyBlending) ═══
function renderPhase2() {
    currentPhase = 2;
    const root = document.getElementById('root');
    root.className = 'phase-2';
    root.innerHTML = `
    <div id="p2-three" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;"></div>
    <div id="mb2-labels" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4;"></div>
    <div class="web2-header"><h1 class="web2-title">The Material World</h1><p class="web2-subtitle">CMY · Subtractive · Heavy Gravity</p></div>
    <div class="web2-description"><p>Drag the pigments together.</p><p>When all three merge, darkness is born.</p></div>`;
    playDialupSound();
    if (typeof THREE === 'undefined') { initMetaballs('mb2', 2, 'heavy', [{ color: [0, 255, 255], name: 'CYAN' }, { color: [255, 0, 255], name: 'MAGENTA' }, { color: [255, 255, 0], name: 'YELLOW' }], false); return; }
    initCMYThree('p2-three', 'mb2-labels', 2);
}

// ═══ PHASE 3: RGB — HOLOGRAM WIREFRAME (Three.js AdditiveBlending) ═══
function renderPhase3() {
    currentPhase = 3;
    const root = document.getElementById('root');
    root.className = 'phase-3';
    root.innerHTML = `
    <div id="p3-three" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;background:#000;"></div>
    <div id="mb3-labels" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4;"></div>
    <div style="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:5;text-align:center;pointer-events:none;">
      <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;color:#0f0;opacity:0.7;text-shadow:0 0 8px #0f0;">LIGHT_FUSION_PROTOCOL::ACTIVE</div>
    </div>`;
    playDivineSound();
    if (typeof THREE === 'undefined') { initMetaballs('mb3', 3, 'zero', [{ color: [255, 0, 0], name: 'RED' }, { color: [0, 255, 0], name: 'GREEN' }, { color: [0, 0, 255], name: 'BLUE' }], true); return; }
    initRGBThree('p3-three', 'mb3-labels', 3);
}

// ═══ CMY 3D ENGINE (Phase 2) ════════════════════════════════════════════════
function initCMYThree(containerId, labelsDivId, phase) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const W = window.innerWidth, H = window.innerHeight, mob = W < 768, R = mob ? 55 : 75;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xf0ede8, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);
    camera.position.set(0, 0, 14);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.4);
    key.position.set(4, 7, 10); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe0f0ff, 0.4);
    fill.position.set(-6, -2, 5); scene.add(fill);
    const back = new THREE.DirectionalLight(0xffffff, 0.2);
    back.position.set(0, -8, -6); scene.add(back);

    const GEO = new THREE.SphereGeometry(1, 64, 64);
    const CMY = [
        { sc: [0, 1, 1], name: 'CYAN' },
        { sc: [1, 0, 1], name: 'MAGENTA' },
        { sc: [1, 1, 0], name: 'YELLOW' }
    ];

    // ── Triangle placement (matching P3) ──
    const TRIANGLE_ANGLES = [
        -Math.PI / 2,
        -Math.PI / 2 + 2.094,
        -Math.PI / 2 + 4.189
    ];
    const triDist = Math.min(W, H) * 0.22;

    // Physics blobs (screen space) — smooth matte cells
    const blobs = CMY.map((d, i) => {
        const angle = TRIANGLE_ANGLES[i];
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(d.sc[0], d.sc[1], d.sc[2]),
            roughness: 0.85,
            metalness: 0.0,
            blending: THREE.MultiplyBlending,
            transparent: true, opacity: 1.0, depthWrite: false
        });

        const mesh = new THREE.Mesh(GEO, mat);
        scene.add(mesh);

        // Color shadow beneath sphere
        const shadowGeo = new THREE.PlaneGeometry(2.5, 1.2);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(d.sc[0], d.sc[1], d.sc[2]),
            transparent: true, opacity: 0.08,
            blending: THREE.MultiplyBlending, depthWrite: false
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -1.5;
        scene.add(shadow);

        return {
            sx: W / 2 + Math.cos(angle) * triDist, sy: H / 2 + Math.sin(angle) * triDist,
            vx: (Math.random() - .5) * 1.0, vy: (Math.random() - .5) * 1.0,
            r: R, color: [...d.sc], name: d.name, mass: 1, alive: true, mesh, shadow
        };
    });

    // Screen → World conversion
    function s2w(sx, sy) {
        const v = new THREE.Vector3((sx / W) * 2 - 1, -(sy / H) * 2 + 1, 0.5).unproject(camera);
        const d = v.sub(camera.position).normalize();
        return camera.position.clone().add(d.multiplyScalar(-camera.position.z / d.z));
    }

    let drag = null, mDown = false, mx = W / 2, my = H / 2, done = false;
    let shakeX = 0, shakeY = 0, shakeDecay = 0;
    const HEAVY = { drag: .87, bounce: .32, gravity: .12 };
    const labelsDiv = document.getElementById(labelsDivId);

    function findB(px, py) { for (const b of blobs) if (b.alive && Math.hypot(px - b.sx, py - b.sy) < b.r * 1.3) return b; return null; }
    function getPos(e) { const rc = renderer.domElement.getBoundingClientRect(); return e.touches ? { x: e.touches[0].clientX - rc.left, y: e.touches[0].clientY - rc.top } : { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
    renderer.domElement.addEventListener('mousedown', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); });
    renderer.domElement.addEventListener('mousemove', e => { e.preventDefault(); const p = getPos(e); mx = p.x; my = p.y; if (drag) { drag.vx += (p.x - drag.sx) * .3; drag.vy += (p.y - drag.sy) * .3; drag.sx = p.x; drag.sy = p.y; } });
    renderer.domElement.addEventListener('mouseup', () => { mDown = false; drag = null; });
    renderer.domElement.addEventListener('touchstart', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); }, { passive: false });
    renderer.domElement.addEventListener('touchmove', e => { e.preventDefault(); const p = getPos(e); mx = p.x; my = p.y; if (drag) { drag.vx += (p.x - drag.sx) * .3; drag.vy += (p.y - drag.sy) * .3; drag.sx = p.x; drag.sy = p.y; } }, { passive: false });
    renderer.domElement.addEventListener('touchend', () => { mDown = false; drag = null; });

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9;pointer-events:none;background:#000;opacity:0;';
    document.body.appendChild(overlay);
    let overlayAlpha = 0;

    function checkMerge(alive) {
        for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i], b = alive[j];
            if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < (a.r + b.r) * 0.55) {
                playWaterSplashSound();
                shakeX = (Math.random() - .5) * 8; shakeY = (Math.random() - .5) * 8; shakeDecay = 1.0;
                const tm = a.mass + b.mass;
                a.sx = (a.sx * a.mass + b.sx * b.mass) / tm; a.sy = (a.sy * a.mass + b.sy * b.mass) / tm;
                a.vx = (a.vx * a.mass + b.vx * b.mass) / tm; a.vy = (a.vy * a.mass + b.vy * b.mass) / tm;
                a.color = a.color.map((v, k) => Math.min(v, b.color[k]));
                a.mesh.material.color.setRGB(...a.color);
                a.r = Math.sqrt(a.r * a.r + b.r * b.r); a.mass = tm; a.name = '';
                scene.remove(b.mesh); b.mesh.material.dispose(); b.alive = false;
                if (b.shadow) scene.remove(b.shadow);
                return true;
            }
        }
    }

    function update(alive) {
        alive.forEach(b => {
            if (b === drag) return;
            b.sx += b.vx; b.sy += b.vy; b.vx *= HEAVY.drag; b.vy *= HEAVY.drag;
            b.vy += HEAVY.gravity;
            if (b.sx < b.r) { b.vx = Math.abs(b.vx) * HEAVY.bounce; b.sx = b.r; }
            if (b.sx > W - b.r) { b.vx = -Math.abs(b.vx) * HEAVY.bounce; b.sx = W - b.r; }
            if (b.sy < b.r) { b.vy = Math.abs(b.vy) * HEAVY.bounce; b.sy = b.r; }
            if (b.sy > H - b.r) { b.vy = -Math.abs(b.vy) * HEAVY.bounce; b.sy = H - b.r; }
        });
    }

    let rAlive = true;
    function render() {
        if (currentPhase !== phase || !rAlive) return;
        const alive = blobs.filter(b => b.alive);
        checkMerge(alive); update(alive);

        // Update mesh + shadow positions
        blobs.filter(b => b.alive).forEach(b => {
            const wp = s2w(b.sx, b.sy);
            b.mesh.position.set(wp.x, wp.y, 0);
            b.mesh.scale.setScalar(b.r / R);
            if (b.shadow) {
                b.shadow.position.x = wp.x;
                b.shadow.position.z = 0;
            }
        });

        // Camera shake
        if (shakeDecay > .01) { camera.position.x = shakeX * shakeDecay * .015; camera.position.y = shakeY * shakeDecay * .015; shakeDecay *= .85; }
        else { camera.position.x = 0; camera.position.y = 0; }

        // Labels
        if (labelsDiv) labelsDiv.innerHTML = blobs.filter(b => b.alive && b.name).map(b => `<div style="position:absolute;left:${b.sx}px;top:${b.sy}px;transform:translate(-50%,-50%);font-family:'Courier New',monospace;font-size:${Math.floor(b.r * .24)}px;font-weight:bold;color:#222;text-shadow:0 0 5px rgba(255,255,255,.8);pointer-events:none;letter-spacing:1px;">${b.name}</div>`).join('');

        renderer.render(scene, camera);

        // 融合完了チェック → ブラックアウト → Phase 3
        const al = blobs.filter(b => b.alive);
        if (al.length === 1 && !done) {
            const avg = al[0].color[0] + al[0].color[1] + al[0].color[2];
            if (avg < 0.4) {
                done = true;
                setTimeout(() => {
                    let t = 0;
                    const fadeOut = setInterval(() => {
                        t += 0.02; overlayAlpha = Math.min(1, t);
                        overlay.style.opacity = overlayAlpha;
                        if (t >= 1) { clearInterval(fadeOut); rAlive = false; GEO.dispose(); renderer.dispose(); overlay.remove(); playDivineSound(); renderPhase3(); }
                    }, 16);
                }, 1800);
                return;
            }
        }
        requestAnimationFrame(render);
    }
    render();
}


// ═══ RGB PURE LIGHT ENGINE (Phase 3) ════════════════════════════════════════
// Sprite + CanvasTexture (radial gradient) + AdditiveBlending
// 純粋な光の三原色: ドラッグして重ねると Y/M/C → 三色 = 純白
function initRGBThree(containerId, labelsDivId, phase) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const W = window.innerWidth, H = window.innerHeight, mob = W < 768, R = mob ? 55 : 75;

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);
    camera.position.set(0, 0, 14);

    // worldUnits per pixel at z=0
    const wupp = (2 * camera.position.z * Math.tan((45 / 2) * Math.PI / 180)) / H;

    // Glowing Sprite texture from Canvas radial gradient
    function makeGlowTex(r255, g255, b255) {
        const SZ = 256;
        const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
        const cx = cv.getContext('2d');
        const grd = cx.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
        grd.addColorStop(0, `rgba(${r255},${g255},${b255},1.0)`);
        grd.addColorStop(0.25, `rgba(${r255},${g255},${b255},0.9)`);
        grd.addColorStop(0.55, `rgba(${r255},${g255},${b255},0.45)`);
        grd.addColorStop(0.8, `rgba(${r255},${g255},${b255},0.1)`);
        grd.addColorStop(1.0, 'rgba(0,0,0,0)');
        cx.fillStyle = grd; cx.fillRect(0, 0, SZ, SZ);
        return new THREE.CanvasTexture(cv);
    }

    // R / G / B の光の玉
    const RGB = [
        { rgb: [255, 0, 0], name: 'RED' },
        { rgb: [0, 255, 0], name: 'GREEN' },
        { rgb: [0, 0, 255], name: 'BLUE' }
    ];

    // Sprite mat
    const textures = RGB.map(d => makeGlowTex(...d.rgb));
    const blobs = RGB.map((d, i) => {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const dist = Math.min(W, H) * 0.25;
        const spriteMat = new THREE.SpriteMaterial({
            map: textures[i],
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.95
        });
        const sprite = new THREE.Sprite(spriteMat);
        scene.add(sprite);
        return {
            sx: W / 2 + Math.cos(angle) * dist,
            sy: H / 2 + Math.sin(angle) * dist,
            vx: 0, vy: 0,
            r: R, color: d.rgb.map(v => v / 255), name: d.name,
            mass: 1, alive: true, sprite, spriteMat
        };
    });

    // screen → world (z=0)
    function s2w(sx, sy) {
        return new THREE.Vector3((sx - W / 2) * wupp, -(sy - H / 2) * wupp, 0);
    }

    let drag = null, mDown = false, done = false;
    let shakeX = 0, shakeY = 0, shakeDecay = 0;
    const ZERO = { drag: .97, bounce: .88 };
    const labelsDiv = document.getElementById(labelsDivId);

    function findB(px, py) { for (const b of blobs) if (b.alive && Math.hypot(px - b.sx, py - b.sy) < b.r * 1.4) return b; return null; }
    function getPos(e) { const rc = renderer.domElement.getBoundingClientRect(); return e.touches ? { x: e.touches[0].clientX - rc.left, y: e.touches[0].clientY - rc.top } : { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
    renderer.domElement.addEventListener('mousedown', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); });
    renderer.domElement.addEventListener('mousemove', e => { e.preventDefault(); const p = getPos(e); if (drag) { drag.vx += (p.x - drag.sx) * .35; drag.vy += (p.y - drag.sy) * .35; drag.sx = p.x; drag.sy = p.y; } });
    renderer.domElement.addEventListener('mouseup', () => { mDown = false; drag = null; });
    renderer.domElement.addEventListener('touchstart', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); }, { passive: false });
    renderer.domElement.addEventListener('touchmove', e => { e.preventDefault(); const p = getPos(e); if (drag) { drag.vx += (p.x - drag.sx) * .35; drag.vy += (p.y - drag.sy) * .35; drag.sx = p.x; drag.sy = p.y; } }, { passive: false });
    renderer.domElement.addEventListener('touchend', () => { mDown = false; drag = null; });

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9;pointer-events:none;background:#fff;opacity:0;';
    document.body.appendChild(overlay);

    function checkMerge(alive) {
        for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i], b = alive[j];
            if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < (a.r + b.r) * 0.55) {
                playWaterSplashSound();
                shakeX = (Math.random() - .5) * 5; shakeY = (Math.random() - .5) * 5; shakeDecay = 1.0;
                const tm = a.mass + b.mass;
                a.sx = (a.sx * a.mass + b.sx * b.mass) / tm; a.sy = (a.sy * a.mass + b.sy * b.mass) / tm;
                a.vx = (a.vx * a.mass + b.vx * b.mass) / tm; a.vy = (a.vy * a.mass + b.vy * b.mass) / tm;
                // RGB加法混色: clamped sum → merged color texture
                const nc = a.color.map((v, k) => Math.min(1, v + b.color[k]));
                a.color = nc;
                const nr = Math.round(nc[0] * 255), ng = Math.round(nc[1] * 255), nb = Math.round(nc[2] * 255);
                const newTex = makeGlowTex(nr, ng, nb);
                a.spriteMat.map = newTex;
                a.r = Math.sqrt(a.r * a.r + b.r * b.r); a.mass = tm; a.name = '';
                scene.remove(b.sprite); b.spriteMat.map.dispose(); b.spriteMat.dispose(); b.alive = false;
                return true;
            }
        }
    }

    // 自動引力なし: 無重力 + 壁バウンスのみ
    function update(alive) {
        alive.forEach(b => {
            if (b === drag) return;
            b.sx += b.vx; b.sy += b.vy; b.vx *= ZERO.drag; b.vy *= ZERO.drag;
            if (b.sx < b.r) { b.vx = Math.abs(b.vx) * ZERO.bounce; b.sx = b.r; }
            if (b.sx > W - b.r) { b.vx = -Math.abs(b.vx) * ZERO.bounce; b.sx = W - b.r; }
            if (b.sy < b.r) { b.vy = Math.abs(b.vy) * ZERO.bounce; b.sy = b.r; }
            if (b.sy > H - b.r) { b.vy = -Math.abs(b.vy) * ZERO.bounce; b.sy = H - b.r; }
        });
    }

    let rAlive = true;
    function render() {
        if (currentPhase !== phase || !rAlive) return;
        const alive = blobs.filter(b => b.alive);
        checkMerge(alive); update(alive);

        // Sprite position + scale
        blobs.filter(b => b.alive).forEach(b => {
            const wp = s2w(b.sx, b.sy);
            b.sprite.position.set(wp.x, wp.y, 0);
            const sc = b.r * wupp * 3.6; // P2と同じ視覚的サイズ
            b.sprite.scale.set(sc, sc, 1);
        });

        if (shakeDecay > .01) { camera.position.x = shakeX * shakeDecay * .01; camera.position.y = shakeY * shakeDecay * .01; shakeDecay *= .85; }
        else { camera.position.x = 0; camera.position.y = 0; }

        // HUDラベル — glow
        if (labelsDiv) labelsDiv.innerHTML = blobs.filter(b => b.alive && b.name).map(b => {
            const [cr, cg, cb_] = b.color.map(v => Math.round(v * 255));
            return `<div style="position:absolute;left:${b.sx}px;top:${b.sy + b.r * .65}px;transform:translate(-50%,-50%);font-family:'Courier New',monospace;font-size:${Math.floor(b.r * .2)}px;font-weight:bold;color:rgb(${cr},${cg},${cb_});text-shadow:0 0 8px rgb(${cr},${cg},${cb_}),0 0 20px rgb(${cr},${cg},${cb_});pointer-events:none;letter-spacing:2px;">${b.name}</div>`;
        }).join('');

        renderer.render(scene, camera);

        // 融合完了 → ホワイトアウト → Phase 4
        const al = blobs.filter(b => b.alive);
        if (al.length === 1 && !done) {
            const avg = al[0].color[0] + al[0].color[1] + al[0].color[2];
            if (avg > 2.5) {
                done = true;
                // 2秒の余韻: 「純白の光」を鑑賞する時間
                const merged = al[0];
                let expandT = 0;
                const expandAnim = setInterval(() => {
                    expandT += 0.008;
                    if (merged.alive) {
                        merged.r += 0.3; // 光が微かに膏張
                    }
                    if (expandT >= 1) clearInterval(expandAnim);
                }, 16);
                setTimeout(() => {
                    let t = 0, glitchCount = 0;
                    // ドラマチックなホワイトアウト: 光が膏張しながら画面を飲み込む
                    const fin = setInterval(() => {
                        t += 0.015; glitchCount++;
                        if (merged.alive) merged.r += 1.5; // 加速膏張
                        if (glitchCount % 5 === 0) applyRGBGlitch();
                        overlay.style.opacity = Math.min(1, t * t * 1.5);
                        if (t >= 1) {
                            clearInterval(fin); clearInterval(expandAnim);
                            rAlive = false;
                            textures.forEach(tx => tx.dispose()); renderer.dispose();
                            overlay.remove(); playGlitchSound();
                            setTimeout(() => renderPhase4(), 400);
                        }
                    }, 16);
                }, 2000);
                return;
            }
        }
        requestAnimationFrame(render);
    }

    function applyRGBGlitch() {
        const f = document.createElement('div');
        f.style.cssText = `position:fixed;top:${Math.random() * 100}%;left:0;width:100%;height:${2 + Math.random() * 5}px;background:rgba(${Math.random() < .5 ? '255,0,0' : '0,0,255'},0.35);pointer-events:none;z-index:8;transform:translateX(${(Math.random() - .5) * 35}px);`;
        document.body.appendChild(f); setTimeout(() => f.remove(), 80);
    }
    render();
}


// ═══ METABALL ENGINE ═══
function initMetaballs(canvasId, phase, gravityMode, blobDefs, darkBg) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, mob = W < 768, R = mob ? 55 : 75;
    const HEAVY = { drag: .85, mouseForce: .18, mouseThresh: 280, bounce: .35, initSpd: 1.0 };
    const ZERO = { drag: .995, mouseForce: 2.5, mouseThresh: 500, bounce: .9, initSpd: 3.0 };
    const phys = gravityMode === 'heavy' ? HEAVY : ZERO;
    const blobs = blobDefs.map((d, i) => {
        const angle = (i / blobDefs.length) * Math.PI * 2, dist = Math.min(W, H) * .28;
        return {
            x: W / 2 + Math.cos(angle) * dist, y: H / 2 + Math.sin(angle) * dist,
            vx: (Math.random() - .5) * phys.initSpd, vy: (Math.random() - .5) * phys.initSpd,
            r: R, color: [...d.color], name: d.name, mass: 1, sx: 1, sy: 1, svx: 0, svy: 0, alive: true
        };
    });
    let drag = null, mDown = false, mx = W / 2, my = H / 2, done = false;
    let shakeX = 0, shakeY = 0, shakeDecay = 0; // 画面シェイク
    let snapTriggered = false; // 引力スナップ済みフラグ

    function getPos(e) {
        const rc = canvas.getBoundingClientRect();
        if (e.touches) return { x: e.touches[0].clientX - rc.left, y: e.touches[0].clientY - rc.top };
        return { x: e.clientX - rc.left, y: e.clientY - rc.top };
    }
    function findB(px, py) { for (const b of blobs) if (b.alive && Math.hypot(px - b.x, py - b.y) < b.r * 1.3) return b; return null; }
    canvas.addEventListener('mousedown', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); });
    canvas.addEventListener('mousemove', e => {
        e.preventDefault(); const p = getPos(e); mx = p.x; my = p.y;
        if (drag) {
            if (gravityMode === 'zero') { drag.x = p.x; drag.y = p.y; drag.vx = 0; drag.vy = 0; }
            else { drag.vx += (p.x - drag.x) * .3; drag.vy += (p.y - drag.y) * .3; drag.x = p.x; drag.y = p.y; }
        }
    });
    canvas.addEventListener('mouseup', () => { mDown = false; drag = null; });
    canvas.addEventListener('touchstart', e => { e.preventDefault(); const p = getPos(e); mDown = true; drag = findB(p.x, p.y); }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault(); const p = getPos(e); mx = p.x; my = p.y;
        if (drag) {
            if (gravityMode === 'zero') { drag.x = p.x; drag.y = p.y; drag.vx = 0; drag.vy = 0; }
            else { drag.vx += (p.x - drag.x) * .3; drag.vy += (p.y - drag.y) * .3; drag.x = p.x; drag.y = p.y; }
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { mDown = false; drag = null; });

    // ── CMY専用: CSS filter メタボール描画 ──────────────────────
    // canvas自体に filter:blur(16px) contrast(22) をCSS適用済み
    // ラベルは別div(#mb2-labels)に配置してブラーの影響を回避する
    const labelsDiv = !darkBg ? document.getElementById('mb2-labels') : null;
    function drawCMYBlobs(alive) {
        // 毎フレーム完全クリア (ghostingなし): CSS blur との相乗効果のため
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // CMY各ボールをmultiplyで重ねる
        // blur+contrastが自動的に跳び継ぎ部分でぽっぽり内側から色が漏れる
        alive.forEach(b => {
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';

            // グラデーション半径を大きく (r*2.0) → blurとの相乗効果で滑らかなネックが出る
            const R2 = b.r * 2.0;
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R2);
            grad.addColorStop(0, `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`);
            grad.addColorStop(0.35, `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`);
            grad.addColorStop(0.65, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.6)`);
            grad.addColorStop(1.0, 'rgba(255,255,255,1)'); // white = no effect in multiply
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(b.x, b.y, R2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // ラベルを別divに配置 (ブラーの山の影響を受けない)
        if (labelsDiv) {
            labelsDiv.innerHTML = alive.filter(b => b.name).map(b => {
                const fs = Math.floor(b.r * 0.25);
                const [r, g, bl_] = b.color;
                // CMY色から暗めの文字色を計算 (C→暗い青緑, M→暗い赤紫, Y→暗い黄)
                const fc = `rgb(${Math.max(0, r - 100)},${Math.max(0, g - 100)},${Math.max(0, bl_ - 100)})`;
                return `<div style="position:absolute;left:${b.x}px;top:${b.y}px;
                    transform:translate(-50%,-50%);
                    font-family:'Courier New',monospace;
                    font-size:${fs}px;font-weight:bold;
                    color:${fc};
                    pointer-events:none;user-select:none;
                    text-shadow:0 0 4px rgba(255,255,255,0.9);
                    letter-spacing:1px;">${b.name}</div>`;
            }).join('');
        }
    }

    // ── RGB描画 (Phase 3 — デジタル・光・加法混色) ───────────────
    function drawBlobGroup(alive) {
        // スキャンラインタイマー
        if (typeof drawBlobGroup._t === 'undefined') drawBlobGroup._t = 0;
        drawBlobGroup._t++;

        // 加法混色: screen合成で各RGBボールを重ねる
        alive.forEach(b => {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            // コアグロー (HDR光源っぽい)
            const coreGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.2);
            coreGrad.addColorStop(0, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},1.0)`);
            coreGrad.addColorStop(0.3, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.85)`);
            coreGrad.addColorStop(0.7, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.3)`);
            coreGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
            ctx.fillStyle = coreGrad;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        });

        // スキャンライン (CRTモニター) — source-over で暗い横線をのせる
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 0; y < H; y += 3) {
            ctx.fillRect(0, y, W, 1);
        }
        ctx.restore();

        // 各ボールのデジタルシェル + ラベル + ワイヤーリング
        alive.forEach(b => {
            ctx.save();
            ctx.translate(b.x, b.y); ctx.scale(b.sx, b.sy);

            // 鋭いエッジ (クリップ + 内側グロー)
            ctx.globalCompositeOperation = 'source-over';
            const edgeGrad = ctx.createRadialGradient(0, 0, b.r * 0.78, 0, 0, b.r);
            edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
            edgeGrad.addColorStop(1, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.6)`);
            ctx.fillStyle = edgeGrad;
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();

            // ワイヤーフレームリング (2本)
            ctx.globalCompositeOperation = 'screen';
            ctx.strokeStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.5)`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, b.r * 0.98, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.25)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(0, 0, b.r * 0.80, 0, Math.PI * 2); ctx.stroke();

            // 内部ノイズパターン (点滅するデータフロー感)
            ctx.globalCompositeOperation = 'screen';
            const t = drawBlobGroup._t;
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2 + t * 0.05;
                const rd = b.r * (0.3 + 0.4 * Math.abs(Math.sin(t * 0.03 + i)));
                const px = Math.cos(ang) * rd, py = Math.sin(ang) * rd;
                ctx.fillStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},${0.3 + 0.4 * Math.abs(Math.sin(t * 0.07 + i * 1.3))})`;
                ctx.fillRect(px - 1, py - 1, 2, 2);
            }

            // ラベル— Courier New + 強いglow + 周期的グリッチ
            if (b.name) {
                ctx.globalCompositeOperation = 'source-over';
                const fs = Math.floor(b.r * 0.22);
                ctx.font = `${fs}px 'Courier New', monospace`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                // グローレイヤーを3層 (外偵から内側へ明るく)
                const cr = b.color[0], cg = b.color[1], cb2 = b.color[2];
                ctx.shadowColor = `rgb(${cr},${cg},${cb2})`;
                ctx.shadowBlur = 18;
                ctx.fillStyle = `rgba(${cr},${cg},${cb2},0.5)`;
                ctx.fillText(b.name, 0, 0);
                ctx.shadowBlur = 10;
                ctx.fillStyle = `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 80)},${Math.min(255, cb2 + 80)},0.85)`;
                ctx.fillText(b.name, 0, 0);
                ctx.shadowBlur = 4;
                ctx.fillStyle = '#ffffff';
                ctx.fillText(b.name, 0, 0);
                ctx.shadowBlur = 0;
                // 周期的グリッチ: 60フレームに1回程度文字がいっクりずれる
                if (t % 60 < 3) {
                    const dx = (Math.random() - 0.5) * 4;
                    ctx.fillStyle = `rgba(${cr},${cg},${cb2},0.6)`;
                    ctx.fillText(b.name, dx, 0);
                }
            }

            ctx.restore();
        });

        ctx.globalCompositeOperation = 'source-over';
    }

    function checkMerge(alive) {
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i], b = alive[j];
                if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * .60) {
                    playWaterSplashSound(); a.svx -= .4; a.svy += .4; b.svx += .4; b.svy -= .4;
                    // 画面シェイク
                    shakeX = (Math.random() - 0.5) * 6; shakeY = (Math.random() - 0.5) * 6; shakeDecay = 1.0;
                    const tm = a.mass + b.mass;
                    a.x = (a.x * a.mass + b.x * b.mass) / tm; a.y = (a.y * a.mass + b.y * b.mass) / tm;
                    a.vx = (a.vx * a.mass + b.vx * b.mass) / tm; a.vy = (a.vy * a.mass + b.vy * b.mass) / tm;
                    if (darkBg) {
                        // RGB加法混色: 足し算
                        a.color = a.color.map((_, k) => Math.min(255, a.color[k] + b.color[k]));
                    } else {
                        // CMY減法混色: min合成 (multiply相当)
                        // C=(0,255,255) M=(255,0,255) → min = (0,0,255) = Blue ✓
                        a.color = a.color.map((_, k) => Math.min(a.color[k], b.color[k]));
                    }
                    a.r = Math.sqrt(a.r * a.r + b.r * b.r); a.mass = tm; a.name = ''; b.alive = false; return true;
                }
            }
        } return false;
    }

    function update(alive) {
        // ── 引力スナップ (CMY Phase 2専用) ──────────────────────
        if (!darkBg && alive.length >= 3 && !snapTriggered) {
            // 3つの中心を計算
            const cx = alive.reduce((s, b) => s + b.x, 0) / alive.length;
            const cy = alive.reduce((s, b) => s + b.y, 0) / alive.length;
            // 全球が一定距離内に入ったか
            const maxDist = Math.max(...alive.map(b => Math.hypot(b.x - cx, b.y - cy)));
            if (maxDist < R * 3.5) {
                // 強磁場発動！
                snapTriggered = true;
                alive.forEach(b => {
                    if (b === drag) return;
                    const dx = cx - b.x, dy = cy - b.y;
                    b.vx = dx * 0.15;
                    b.vy = dy * 0.15;
                });
                shakeX = (Math.random() - 0.5) * 8; shakeY = (Math.random() - 0.5) * 8; shakeDecay = 1.0;
                vibrate([30, 20, 30]);
            }
        }
        // 2つの引力 (CMY)
        if (!darkBg && alive.length >= 2) {
            for (let i = 0; i < alive.length; i++) {
                for (let j = i + 1; j < alive.length; j++) {
                    const a = alive[i], b = alive[j];
                    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + 0.1;
                    if (d < (a.r + b.r) * 2.5) {
                        const f = 0.06 * (1 - d / ((a.r + b.r) * 2.5));
                        if (a !== drag) { a.vx += (dx / d) * f; a.vy += (dy / d) * f; }
                        if (b !== drag) { b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; }
                    }
                }
            }
        }

        alive.forEach(b => {
            if (b === drag) return;
            if (mDown && !drag) {
                const dx = mx - b.x, dy = my - b.y, d = Math.sqrt(dx * dx + dy * dy) + .1;
                if (d < phys.mouseThresh) { const f = phys.mouseForce * (1 - d / phys.mouseThresh); b.vx += dx / d * f; b.vy += dy / d * f; }
            }
            b.x += b.vx; b.y += b.vy; b.vx *= phys.drag; b.vy *= phys.drag;
            if (gravityMode === 'heavy') b.vy += .12;
            if (b.x < b.r) { b.vx = Math.abs(b.vx) * phys.bounce; b.x = b.r; b.svx += .35; }
            if (b.x > W - b.r) { b.vx = -Math.abs(b.vx) * phys.bounce; b.x = W - b.r; b.svx += .35; }
            if (b.y < b.r) { b.vy = Math.abs(b.vy) * phys.bounce; b.y = b.r; b.svy += .35; }
            if (b.y > H - b.r) { b.vy = -Math.abs(b.vy) * phys.bounce; b.y = H - b.r; b.svy += .35; }
            b.svx += (1 - b.sx) * .25; b.svy += (1 - b.sy) * .25; b.svx *= .72; b.svy *= .72;
            b.sx += b.svx; b.sy += b.svy; b.sx = Math.max(.55, Math.min(1.75, b.sx)); b.sy = Math.max(.55, Math.min(1.75, b.sy));
        });
    }
    function loop() {
        if (currentPhase !== phase || done) return;

        // 画面シェイク適用
        if (shakeDecay > 0.01) {
            ctx.save();
            ctx.translate(shakeX * shakeDecay, shakeY * shakeDecay);
            shakeDecay *= 0.85;
        }

        // RGB(darkBg)のみghosted残像fill。CMYはdrawCMYBlobs内で白クリア済み
        if (darkBg) {
            ctx.fillStyle = 'rgba(0,0,0,.12)';
            ctx.fillRect(0, 0, W, H);
        }
        const alive = blobs.filter(b => b.alive);
        checkMerge(alive); update(alive);

        // CMYとRGBで異なる描画
        const drawAlive = blobs.filter(b => b.alive);
        if (darkBg) {
            drawBlobGroup(drawAlive);
        } else {
            drawCMYBlobs(drawAlive);
        }

        if (shakeDecay > 0.01) ctx.restore();


        const al2 = blobs.filter(b => b.alive);
        if (al2.length === 1 && !done) {
            const b = al2[0], avg = (b.color[0] + b.color[1] + b.color[2]) / 3;
            const merged = darkBg ? avg > 200 : avg < 90;
            if (merged) { done = true; flashThenNext(canvas, ctx, b, darkBg, phase); return; }
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// ── グリッチ演出 (Phase 3 → Phase 4 遷移) ──────────────────────
function applyGlitch(ctx, W, H, intensity) {
    const sliceCount = Math.floor(intensity * 12);
    for (let i = 0; i < sliceCount; i++) {
        const y = Math.floor(Math.random() * H);
        const sh = 2 + Math.floor(Math.random() * 8);
        const offset = (Math.random() - 0.5) * intensity * 35;
        try {
            const img = ctx.getImageData(0, y, W, sh);
            ctx.putImageData(img, offset, y);
        } catch (e) { }
    }
    // 色収差: Rチャンネルを右に、Bチャンネルを左にずらす
    const aberration = intensity * 8;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = intensity * 0.3;
    // 赤チャンネルシフト
    ctx.fillStyle = 'rgba(255,0,0,1)';
    ctx.translate(aberration, 0);
    ctx.restore();
}

function flashThenNext(canvas, ctx, blob, darkBg, phase) {
    let f = 0;
    const cx = blob.x, cy = blob.y;
    const tColor = darkBg ? [255, 255, 255] : [10, 10, 10];
    const W = canvas.width, H = canvas.height;
    let glitchActive = darkBg; // RGB(Phase3)のみグリッチ

    function fin() {
        f++;
        const pulse = blob.r * (1 + Math.sin(f * .25) * .08);
        ctx.fillStyle = darkBg ? 'rgba(0,0,0,.06)' : 'rgba(235,235,235,.06)';
        ctx.fillRect(0, 0, W, H);

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulse * 2);
        g.addColorStop(0, `rgba(${tColor},1)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, pulse * 2, 0, Math.PI * 2); ctx.fill();

        // グリッチ演出 (RGB Phase 3のみ、f20〜f65)
        if (glitchActive && f > 20 && f < 65) {
            const intensity = Math.min(1.0, (f - 20) / 30);
            applyGlitch(ctx, W, H, intensity * 0.8);

            // 色収差オーバーレイ
            if (f % 3 === 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = intensity * 0.15;
                // Rチャンネル右ずれ
                const shift = intensity * 6;
                ctx.fillStyle = 'rgb(255,0,0)';
                ctx.beginPath(); ctx.arc(cx + shift, cy, pulse * 1.5, 0, Math.PI * 2); ctx.fill();
                // Bチャンネル左ずれ
                ctx.fillStyle = 'rgb(0,0,255)';
                ctx.beginPath(); ctx.arc(cx - shift, cy, pulse * 1.5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            // デジタルノイズスキャンライン
            if (f % 4 === 0) {
                ctx.save();
                ctx.globalAlpha = intensity * 0.08;
                const noiseY = Math.floor(Math.random() * H);
                ctx.fillStyle = 'rgb(255,255,255)';
                ctx.fillRect(0, noiseY, W, 1 + Math.floor(Math.random() * 3));
                ctx.restore();
            }
        }

        // フラッシュピーク (f65〜f80)
        if (darkBg && f >= 65 && f < 80) {
            const flashT = (f - 65) / 15;
            ctx.save();
            ctx.globalAlpha = Math.sin(flashT * Math.PI) * 0.9;
            ctx.fillStyle = 'rgb(255,255,255)';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        if (f < 80) requestAnimationFrame(fin);
        else {
            if (darkBg) playGlitchSound();
            else playDivineSound();
            setTimeout(() => { if (phase === 2) renderPhase3(); else renderPhase4(); }, 1200);
        }
    }
    fin();
}
