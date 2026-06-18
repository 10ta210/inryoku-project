// webgpu/pipeline.js
// Pipeline factory for the P3 WebGPU PoC.
//
// createComputePipeline(device, wgslCode, count)
//   returns { pipeline, layout, bindGroupA, bindGroupB, uniformBuffer,
//             posA, posB, color, count }
//   - Double-buffered position storage (A → B, then flip), color single buffer.
//   - Uniform layout: time, count, behavior, mouseX, mouseY, _pad0, _pad1, _pad2
//
// createParticleRenderer(device, format, posBufferRef, colorBufferRef, count)
//   returns { pipeline, bindGroupFor(posBuffer, colorBuffer), render(pass, posBuf, colBuf) }
//   - Renders gl.POINTS-equivalent: vertex shader reads pos+color from
//     storage, emits one point per vertex.
//
// inryokü: additive blending, clamped color, light=0.5 floor enforced by
// compute shader (clamp 0.15..0.92).

const UNIFORM_FLOATS = 8; // time, count, behavior, mouseX, mouseY, _pad0, _pad1, _pad2

export function createComputePipeline(device, wgslCode, count) {
  const module = device.createShaderModule({ code: wgslCode, label: 'p3-wgsl' });

  const bindGroupLayout = device.createBindGroupLayout({
    label: 'p3-compute-bgl',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ],
  });

  const pipeline = device.createComputePipeline({
    label: 'p3-compute-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module, entryPoint: 'main' },
  });

  const uniformBuffer = device.createBuffer({
    size: UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'p3-uniforms',
  });

  const posA = device.createBuffer({
    size: count * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: 'p3-pos-a',
  });
  const posB = device.createBuffer({
    size: count * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: 'p3-pos-b',
  });
  const color = device.createBuffer({
    size: count * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: 'p3-col',
  });

  // A reads, B writes
  const bindGroupAB = device.createBindGroup({
    label: 'p3-bg-ab',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: posA } },
      { binding: 2, resource: { buffer: posB } },
      { binding: 3, resource: { buffer: color } },
    ],
  });
  // B reads, A writes
  const bindGroupBA = device.createBindGroup({
    label: 'p3-bg-ba',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: posB } },
      { binding: 2, resource: { buffer: posA } },
      { binding: 3, resource: { buffer: color } },
    ],
  });

  return {
    pipeline,
    layout: bindGroupLayout,
    uniformBuffer,
    posA,
    posB,
    color,
    bindGroupAB,
    bindGroupBA,
    count,
    uniformFloats: UNIFORM_FLOATS,
  };
}

// Render pipeline: read position + color from storage buffers, emit point list.
const RENDER_WGSL = /* wgsl */`
struct ViewUniforms {
  mvp : mat4x4<f32>,
  pointSize : f32,
  _p0 : f32, _p1 : f32, _p2 : f32,
};
@group(0) @binding(0) var<uniform> V : ViewUniforms;
@group(0) @binding(1) var<storage, read> pos : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> col : array<vec4<f32>>;

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0)      rgb  : vec3<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid : u32) -> VOut {
  let p = pos[vid].xyz;
  let c = col[vid].rgb;
  var out : VOut;
  out.clip = V.mvp * vec4<f32>(p, 1.0);
  out.rgb  = c;
  return out;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  // inryokü 禁則: never pure white/black. Color already clamped in compute,
  // but enforce again as defense-in-depth.
  let rgb = clamp(in.rgb, vec3<f32>(0.15), vec3<f32>(0.92));
  return vec4<f32>(rgb, 1.0);
}
`;

export function createParticleRenderer(device, format) {
  const module = device.createShaderModule({ code: RENDER_WGSL, label: 'p3-render-wgsl' });

  const bgl = device.createBindGroupLayout({
    label: 'p3-render-bgl',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });

  const pipeline = device.createRenderPipeline({
    label: 'p3-render-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
    vertex: { module, entryPoint: 'vs' },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one',       dstFactor: 'one', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'point-list' },
  });

  const viewBuffer = device.createBuffer({
    size: (16 + 4) * 4, // mat4 + 4 floats
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'p3-view',
  });

  function bindGroupFor(posBuf, colBuf) {
    return device.createBindGroup({
      label: 'p3-render-bg',
      layout: bgl,
      entries: [
        { binding: 0, resource: { buffer: viewBuffer } },
        { binding: 1, resource: { buffer: posBuf } },
        { binding: 2, resource: { buffer: colBuf } },
      ],
    });
  }

  return { pipeline, layout: bgl, viewBuffer, bindGroupFor };
}
