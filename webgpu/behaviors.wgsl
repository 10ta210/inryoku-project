// behaviors.wgsl
// inryokü P3 GPU compute shader. Ports CPU step() per particle to WGSL.
// Layout:
//   group(0) binding(0): uniforms (time, count, behaviorId, mouseX, mouseY, _pad)
//   group(0) binding(1): positions_in  (read)   array<vec4<f32>>
//   group(0) binding(2): positions_out (write)  array<vec4<f32>>
//   group(0) binding(3): colors_out    (write)  array<vec4<f32>>
// Each invocation handles one particle. Workgroup size 64.
//
// inryokü White/black 禁則: HSL light pinned to 0.5. We convert HSL→RGB then
// emit RGBA; renderer applies additive blending. Grey baseline saturation
// stays modest for idle, higher for speaking.

struct Uniforms {
  time      : f32,
  count     : f32,
  behavior  : f32,   // 0 breathing_sphere, 1 ring_resonance, 2 torus_knot
  mouseX    : f32,
  mouseY    : f32,
  _pad0     : f32,
  _pad1     : f32,
  _pad2     : f32,
};

@group(0) @binding(0) var<uniform> U : Uniforms;
@group(0) @binding(1) var<storage, read>        posIn  : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write>  posOut : array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write>  colOut : array<vec4<f32>>;

const GOLDEN : f32 = 2.39996322972865332;
const TAU    : f32 = 6.28318530717958647;
const PI     : f32 = 3.14159265358979323;

// HSL → RGB with l clamped to 0.5 (禁則: never pure white / pure black).
fn hue2rgb(p: f32, q: f32, t_in: f32) -> f32 {
  var t = t_in;
  if (t < 0.0) { t = t + 1.0; }
  if (t > 1.0) { t = t - 1.0; }
  if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
  if (t < 0.5)       { return q; }
  if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
  return p;
}

fn hslToRgb(h_in: f32, s_in: f32, l_in: f32) -> vec3<f32> {
  // light forced to 0.5 — grey-anchored RGBCMY.
  let l = 0.5;
  let s = clamp(s_in, 0.0, 1.0);
  var h = h_in - floor(h_in);
  if (s <= 0.0) { return vec3<f32>(l, l, l); }
  let q = l + s - l * s; // l<0.5 path: l*(1+s); l=0.5 => 0.5+s*0.5
  // Use the standard formulation for clarity.
  let q2 = select(l + s - l * s, l * (1.0 + s), l < 0.5);
  let p  = 2.0 * l - q2;
  return vec3<f32>(
    hue2rgb(p, q2, h + 1.0 / 3.0),
    hue2rgb(p, q2, h),
    hue2rgb(p, q2, h - 1.0 / 3.0),
  );
}

// ---- step result ----------------------------------------------------------
struct Step {
  pos : vec3<f32>,
  rgb : vec3<f32>,
};

fn step_breathing(i: f32, count: f32, time: f32) -> Step {
  let u = i / max(1.0, count);
  let phi   = acos(2.0 * u - 1.0);
  let theta = i * GOLDEN;
  let r     = 16.0 + 0.9 * sin(time * 0.6 + u * TAU);
  let sp    = sin(phi);
  let pos = vec3<f32>(
    r * sp * cos(theta),
    r * cos(phi),
    r * sp * sin(theta),
  );
  let hue = fract(time * 0.02 + u * 0.1);
  let sat = max(0.0, 0.30 + 0.18 * sin(time + u * 14.0));
  return Step(pos, hslToRgb(hue, sat, 0.5));
}

// ---- ring_resonance -------------------------------------------------------
fn step_ring(i: f32, count: f32, time: f32) -> Step {
  let tick   = f32(i32(i) % 12);
  let u      = i / max(1.0, count);
  let ang    = u * PI * 48.0 + time * 0.5;
  let radius = 4.0 + tick * 1.6 + sin(time * 1.2 + tick) * 0.4;
  let pos = vec3<f32>(
    cos(ang) * radius,
    sin(ang) * radius,
    sin(time + u * PI * 5.0) * 1.6,
  );
  let hue = fract(tick / 12.0 + time * 0.08);
  return Step(pos, hslToRgb(hue, 0.9, 0.5));
}

// ---- torus_knot -----------------------------------------------------------
// (p,q)-torus knot with slow drift; rings parametrised by i along the curve.
fn step_torus(i: f32, count: f32, time: f32) -> Step {
  let u  = i / max(1.0, count);
  let p  = 2.0;
  let q  = 3.0;
  let t  = u * TAU + time * 0.15;
  let R  = 12.0;
  let rr = 4.5;
  let cosqt = cos(q * t);
  let sinqt = sin(q * t);
  let cospt = cos(p * t);
  let sinpt = sin(p * t);
  // standard (p,q) torus knot, tube radius 'rr' on major R.
  let cx = (R + rr * cosqt) * cospt;
  let cy = (R + rr * cosqt) * sinpt;
  let cz = rr * sinqt;
  // add tube thickness via small offset using golden index spread.
  let phi = i * GOLDEN;
  let off = 0.6 * vec3<f32>(cos(phi), sin(phi), cos(phi * 0.5));
  let pos = vec3<f32>(cx, cz, cy) + off;
  let hue = fract(u + time * 0.04);
  let sat = 0.55 + 0.25 * sin(time * 0.7 + u * 8.0);
  return Step(pos, hslToRgb(hue, sat, 0.5));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (f32(idx) >= U.count) { return; }
  let i    = f32(idx);
  let t    = U.time;
  var s : Step;
  let b = i32(U.behavior + 0.5);
  if (b == 0) {
    s = step_breathing(i, U.count, t);
  } else if (b == 1) {
    s = step_ring(i, U.count, t);
  } else {
    s = step_torus(i, U.count, t);
  }
  // mouse-driven gentle drift: pull toward XY plane offset.
  let mouseOff = vec3<f32>(U.mouseX * 2.0, U.mouseY * 2.0, 0.0);
  posOut[idx] = vec4<f32>(s.pos + mouseOff * 0.05, 1.0);
  // 禁則 enforce: clamp each channel into [0.15, 0.92] so no pure white/black.
  let rgb = clamp(s.rgb, vec3<f32>(0.15), vec3<f32>(0.92));
  colOut[idx] = vec4<f32>(rgb, 1.0);
}
