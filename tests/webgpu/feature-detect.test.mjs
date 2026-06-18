// tests/webgpu/feature-detect.test.mjs
// node-runnable: verify initWebGPU returns { supported: false } cleanly when
// navigator.gpu is missing, returns null adapter, throws, etc. No real GPU.
//
// Usage:  node --test tests/webgpu/feature-detect.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initWebGPU } from '../../webgpu/init.js';

function resetGlobals() {
  if (globalThis.navigator) delete globalThis.navigator;
}

test('no navigator → supported:false / no-navigator-gpu', async () => {
  resetGlobals();
  const r = await initWebGPU();
  assert.equal(r.supported, false);
  assert.equal(r.reason, 'no-navigator-gpu');
});

test('navigator without gpu → supported:false / no-navigator-gpu', async () => {
  globalThis.navigator = {};
  const r = await initWebGPU();
  assert.equal(r.supported, false);
  assert.equal(r.reason, 'no-navigator-gpu');
  resetGlobals();
});

test('adapter request returns null → no-adapter', async () => {
  globalThis.navigator = { gpu: { requestAdapter: async () => null } };
  const r = await initWebGPU();
  assert.equal(r.supported, false);
  assert.equal(r.reason, 'no-adapter');
  resetGlobals();
});

test('adapter request throws → adapter-request-failed', async () => {
  globalThis.navigator = { gpu: { requestAdapter: async () => { throw new Error('boom'); } } };
  const r = await initWebGPU();
  assert.equal(r.supported, false);
  assert.equal(r.reason, 'adapter-request-failed');
  assert.ok(r.error instanceof Error);
  resetGlobals();
});

test('device request throws → device-request-failed', async () => {
  const fakeAdapter = { requestDevice: async () => { throw new Error('dev boom'); } };
  globalThis.navigator = { gpu: { requestAdapter: async () => fakeAdapter } };
  const r = await initWebGPU();
  assert.equal(r.supported, false);
  assert.equal(r.reason, 'device-request-failed');
  resetGlobals();
});

test('happy path mock → supported:true with device/queue/adapter', async () => {
  const fakeDevice = {
    queue: { __mock: true },
    lost: new Promise(() => {}), // never resolves in test
  };
  const fakeAdapter = { requestDevice: async () => fakeDevice };
  globalThis.navigator = { gpu: { requestAdapter: async () => fakeAdapter } };
  const r = await initWebGPU();
  assert.equal(r.supported, true);
  assert.equal(r.device, fakeDevice);
  assert.equal(r.queue, fakeDevice.queue);
  assert.equal(r.adapter, fakeAdapter);
  resetGlobals();
});
