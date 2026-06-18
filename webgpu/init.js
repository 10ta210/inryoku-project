// webgpu/init.js
// Minimal WebGPU bootstrapper. Detects support, requests adapter + device,
// wires up a lost-device callback. Never throws — always resolves with
// { supported, reason } so callers can fall back to CPU cleanly.

export async function initWebGPU(opts = {}) {
  const onLost = opts.onLost || (() => {});
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, reason: 'no-navigator-gpu' };
  }
  let adapter;
  try {
    adapter = await navigator.gpu.requestAdapter({
      powerPreference: opts.powerPreference || 'high-performance',
    });
  } catch (e) {
    return { supported: false, reason: 'adapter-request-failed', error: e };
  }
  if (!adapter) {
    return { supported: false, reason: 'no-adapter' };
  }
  let device;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    return { supported: false, reason: 'device-request-failed', error: e };
  }
  if (!device) {
    return { supported: false, reason: 'no-device' };
  }
  device.lost.then((info) => {
    try { onLost(info); } catch (_) { /* swallow */ }
  });
  return {
    supported: true,
    adapter,
    device,
    queue: device.queue,
  };
}
