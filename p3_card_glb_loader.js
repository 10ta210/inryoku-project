/**
 * p3_card_glb_loader.js — 商品カードに服を着たピクトグラム 3D を表示
 *
 * 2026-05-23 司さん指示「過程 C: 商品カードにピクトグラムモデル」
 * 既存の <div class="product-card-img" data-3d-slot data-glb="...">
 * 属性から GLB ファイルを自動ロードして表示する。
 *
 * 動作:
 *   1. threeAddonsReady イベント (three-addons-bridge.js) を待つ
 *   2. document.querySelectorAll('[data-3d-slot][data-glb]') を走査
 *   3. data-glb が非空のものだけ、独立 mini scene で GLTFLoader.load()
 *   4. ロード成功 → スロット内に WebGL canvas 挿入、軽い自動回転
 *   5. ロード失敗 → 既存 <img> が残るのでフォールバック
 *
 * 哲学整合:
 *   - 全商品をピクトグラムがモデルとして着る
 *   - モデル = ユーザーのアバターと同じ存在
 *   - 一発で inryokü と分かる
 *
 * 制約:
 *   - data-glb が空 ('') または属性なしのカードはスキップ (静止画継続)
 *   - 既存 .product-card-img の <img> 子要素は GLB 成功時に非表示化
 *   - prefers-reduced-motion で自動回転停止
 *   - 各カード独立 renderer (8 商品 = 8 renderer) はオーバーキルなので、
 *     **シングル renderer + render-to-texture** や **HTMLCanvasElement 共有**
 *     等の最適化は次の段階 (まず動かす)
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__p3CardGLBLoaderActive) return;
  window.__p3CardGLBLoaderActive = true;

  var prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  // GLB ロード単体
  function loadGLBIntoSlot(slot, glbPath) {
    if (!slot || !glbPath || typeof THREE === 'undefined' || !THREE.GLTFLoader) {
      return;
    }
    if (slot.dataset.glbLoaded === '1') return;
    slot.dataset.glbLoaded = '1';

    var loader = new THREE.GLTFLoader();
    // 既存 <img> を fade out 用に保持
    var img = slot.querySelector('img');

    loader.load(
      glbPath,
      // onLoad
      function (gltf) {
        try {
          // mini scene 構築
          var w = slot.clientWidth  || 200;
          var h = slot.clientHeight || 200;
          var scene  = new THREE.Scene();
          var camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 50);
          camera.position.set(0, 0.2, 2.4);
          camera.lookAt(0, 0, 0);

          // ライト 2 灯 (key + rim、テクスチャ含む GLB を映す)
          var key = new THREE.DirectionalLight(0xffffff, 1.4);
          key.position.set(2, 3, 2);
          scene.add(key);
          var rim = new THREE.DirectionalLight(0xcce8ff, 0.6);
          rim.position.set(-2, 1, -1.5);
          scene.add(rim);
          scene.add(new THREE.AmbientLight(0xffffff, 0.35));

          // モデル追加
          var model = gltf.scene;
          // スケール / 中央寄せ
          var box = new THREE.Box3().setFromObject(model);
          var size = box.getSize(new THREE.Vector3());
          var maxDim = Math.max(size.x, size.y, size.z) || 1;
          var scale = 1.2 / maxDim;
          model.scale.setScalar(scale);
          var center = box.getCenter(new THREE.Vector3());
          model.position.sub(center.multiplyScalar(scale));
          scene.add(model);

          // renderer
          var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
          renderer.setSize(w, h, false);
          renderer.setClearColor(0x000000, 0);
          renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;

          // <img> を fade out
          if (img) {
            img.style.transition = 'opacity 320ms ease';
            img.style.opacity = '0';
            setTimeout(function () { img.style.display = 'none'; }, 360);
          }
          // canvas 挿入
          renderer.domElement.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;';
          slot.style.position = slot.style.position || 'relative';
          slot.appendChild(renderer.domElement);

          // 自動回転 (軽い)
          var start = performance.now();
          var alive = true;
          var hover = false;
          renderer.domElement.addEventListener('pointerenter', function () { hover = true; });
          renderer.domElement.addEventListener('pointerleave', function () { hover = false; });

          // dispose 用 ref
          slot._p3glb = { renderer: renderer, scene: scene, dispose: function () {
            alive = false;
            try { renderer.dispose(); } catch (e) {}
            try { scene.traverse(function (o) {
              if (o.geometry) o.geometry.dispose();
              if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose && m.dispose(); });
                else o.material.dispose && o.material.dispose();
              }
            }); } catch (e) {}
          }};

          function frame() {
            if (!alive) return;
            var t = (performance.now() - start) / 1000;
            if (!prefersReducedMotion) {
              // hover で回転加速
              var speed = hover ? 0.55 : 0.18;
              model.rotation.y = t * speed;
              model.rotation.x = Math.sin(t * 0.3) * 0.06;
            }
            renderer.render(scene, camera);
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        } catch (e) {
          console.warn('[p3-card-glb] setup failed:', e);
          slot.dataset.glbLoaded = '0';
        }
      },
      // onProgress
      undefined,
      // onError
      function (err) {
        // 静かに失敗 (<img> がそのまま残る)
        console.warn('[p3-card-glb] load failed for', glbPath, err);
        slot.dataset.glbLoaded = '0';
      }
    );
  }

  // 全スロット走査
  function scanAndLoad() {
    var slots = document.querySelectorAll('[data-3d-slot][data-glb]');
    var loaded = 0;
    slots.forEach(function (slot) {
      var glb = slot.getAttribute('data-glb');
      if (!glb || glb === '') return;
      // 拡張子チェック
      if (!/\.(glb|gltf)(\?|$)/i.test(glb)) return;
      loadGLBIntoSlot(slot, glb);
      loaded++;
    });
    if (loaded > 0) {
      console.info('[p3-card-glb] queued ' + loaded + ' GLB loads');
    }
  }

  // bridge ready or already
  if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
    scanAndLoad();
  } else {
    window.addEventListener('threeAddonsReady', scanAndLoad, { once: true });
  }

  // DOM が後から追加される場合に対応 (showProductModal 等)
  var observer = new MutationObserver(function () {
    if (typeof THREE !== 'undefined' && THREE.GLTFLoader) scanAndLoad();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
    window.__p3CardGLBObserver = observer;
  } catch (e) {}
})();
