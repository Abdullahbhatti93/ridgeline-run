// Ridgeline Run — the renderer. A Canvas 2D pseudo-3D view: a perspective
// terrain mesh painted back-to-front, the river, the town, the runway, the
// target rings, then the chase-view aeroplane, the HUD and the lit
// instrument panel. No images, no fonts fetched: everything is drawn.
import { FIELD, PALETTE, FONT, TRACK } from './config.js';
import { groundHeight, inRiver, onRunway, riverX, townBuildings, makeClouds } from './terrain.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];
}
function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const SKY_TOP = hexToRgb(PALETTE.skyTop);
const SKY_HOR = hexToRgb(PALETTE.skyHorizon);
const MEADOW = hexToRgb(PALETTE.meadow);
const MEADOW_DRY = hexToRgb(PALETTE.meadowDry);
const FOREST = hexToRgb(PALETTE.forest);
const ROCK = hexToRgb(PALETTE.rock);
const SNOW = hexToRgb(PALETTE.snow);
const RIVER = hexToRgb(PALETTE.river);
const SAND = hexToRgb(PALETTE.sand);
const TOWN_G = hexToRgb(PALETTE.townGround);
const RUNWAY = hexToRgb(PALETTE.runway);

/** Ground colour at (x, z, h): river, runway, town apron, else height bands. */
function groundColor(x, z, h) {
  if (onRunway(x, z)) return RUNWAY;
  if (inRiver(x, z)) return RIVER;
  const dRiver = Math.abs(x - riverX(z));
  if (dRiver < 20) return mixRgb(SAND, RIVER, clamp((dRiver - 13) / 7, 0, 1));
  if (Math.abs(x + 215) < 130 && Math.abs(z - 2650) < 160) return TOWN_G;
  const t = clamp((h - 18) / 95, 0, 1);
  let c;
  if (t < 0.45) c = mixRgb(MEADOW, FOREST, t / 0.45);
  else if (t < 0.8) c = mixRgb(FOREST, ROCK, (t - 0.45) / 0.35);
  else c = mixRgb(ROCK, SNOW, (t - 0.8) / 0.2);
  if (hash(Math.floor(x / 60), Math.floor(z / 60)) > 0.6) c = mixRgb(c, MEADOW_DRY, 0.25);
  return c;
}

/** A smoothed chase camera that trails the aeroplane. */
export function createCamera() {
  const cam = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, ready: false };
  return {
    update(world, dt) {
      const fx = Math.sin(world.heading);
      const fz = Math.cos(world.heading);
      const tx = world.x - fx * 26;
      const ty = world.y + 7.5 - world.pitch * 6;
      const tz = world.z - fz * 26;
      if (!cam.ready) {
        cam.x = tx; cam.y = ty; cam.z = tz; cam.heading = world.heading; cam.pitch = world.pitch;
        cam.ready = true;
      } else {
        const k = Math.min(1, dt * 5);
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        cam.z += (tz - cam.z) * k;
        let dh = world.heading - cam.heading;
        while (dh > Math.PI) dh -= TAU;
        while (dh < -Math.PI) dh += TAU;
        cam.heading += dh * Math.min(1, dt * 6);
        cam.pitch += (world.pitch - cam.pitch) * Math.min(1, dt * 4);
      }
    },
    get() {
      return cam;
    },
  };
}

/** Build the per-frame projection from the camera. */
function makeProjector(cam, W, H) {
  const f = (H * 0.5) / Math.tan((68 * Math.PI) / 360);
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  // Forward, right and up basis vectors (yaw then pitch).
  const fwd = [sh * cp, sp, ch * cp];
  const right = [ch, 0, -sh];
  const up = [-sh * sp, cp, -ch * sp];
  return function project(px, py, pz) {
    const dx = px - cam.x;
    const dy = py - cam.y;
    const dz = pz - cam.z;
    const cx = dx * right[0] + dy * right[1] + dz * right[2];
    const cy = dx * up[0] + dy * up[1] + dz * up[2];
    const cz = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
    if (cz < 2) return null;
    return { x: W / 2 + (cx * f) / cz, y: H / 2 - (cy * f) / cz, d: cz };
  };
}

function quad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function fmt(n, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** Draw the whole scene for `world` plus the screen state in `ui`. */
export function draw(ctx, world, ui) {
  const W = FIELD.width;
  const H = FIELD.height;
  const cam = ui.camera.get();
  const project = makeProjector(cam, W, H);

  // --- Sky ---
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(0.55, PALETTE.skyMid);
  sky.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.62 + 2);

  // Sun, placed by heading so it stays put as you turn.
  const sunAngle = 0.9 - cam.heading;
  const sunX = W / 2 + Math.sin(sunAngle) * W * 0.42;
  const sunY = H * 0.16 - Math.cos(sunAngle) * H * 0.05;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
  sunGrad.addColorStop(0, 'rgba(255,243,196,0.95)');
  sunGrad.addColorStop(0.35, 'rgba(255,243,196,0.45)');
  sunGrad.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 22, 0, TAU);
  ctx.fill();

  // Distant ridge silhouette on the horizon.
  ctx.fillStyle = 'rgba(90,110,140,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.62);
  for (let sx = 0; sx <= W; sx += 32) {
    const a = cam.heading + (sx / W - 0.5) * 1.6;
    const ridge = H * 0.62 - 26 - 34 * Math.abs(Math.sin(a * 2.3 + 1.1)) - 18 * Math.abs(Math.sin(a * 5.1));
    ctx.lineTo(sx, ridge);
  }
  ctx.lineTo(W, H * 0.62);
  ctx.closePath();
  ctx.fill();

  // --- Clouds (billboards, far to near) ---
  const clouds = ui.clouds;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = clouds.length - 1; i >= 0; i -= 1) {
    const c = clouds[i];
    const p = project(c.x, c.y, c.z);
    if (!p) continue;
    const r = (c.r * (H * 0.5)) / p.d / 60;
    if (r < 2) continue;
    ctx.globalAlpha = clamp(1 - p.d / 2400, 0.25, 0.9);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 2.2, r * 0.75, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- Ground base: fills any gap the mesh leaves, so the frame never shows black. ---
  ctx.fillStyle = '#4a7a37';
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // --- Terrain mesh, far rows first ---
  const rowStep = 60;
  const colStep = 60;
  const zStart = Math.ceil((cam.z - 120) / rowStep) * rowStep;
  const zEnd = cam.z + 1500;
  const x0 = Math.floor((cam.x - 820) / colStep) * colStep;
  const x1 = cam.x + 820;
  for (let z = zEnd; z >= zStart; z -= rowStep) {
    for (let x = x0; x < x1; x += colStep) {
      const h00 = groundHeight(x, z);
      const h10 = groundHeight(x + colStep, z);
      const h01 = groundHeight(x, z + rowStep);
      const h11 = groundHeight(x + colStep, z + rowStep);
      const p00 = project(x, h00, z);
      const p10 = project(x + colStep, h10, z);
      const p01 = project(x, h01, z + rowStep);
      const p11 = project(x + colStep, h11, z + rowStep);
      if (!p00 || !p10 || !p01 || !p11) continue;
      const cx = x + colStep / 2;
      const cz = z + rowStep / 2;
      const ch = (h00 + h10 + h01 + h11) / 4;
      let col = groundColor(cx, cz, ch);
      const fog = clamp((cz - cam.z - 240) / 1150, 0, 0.82);
      if (fog > 0) col = mixRgb(col, SKY_HOR, fog);
      ctx.fillStyle = rgb(col);
      quad(ctx, p00, p10, p11, p01);
    }
  }

  // --- Runway markings (centreline dashes + threshold bars) ---
  ctx.fillStyle = PALETTE.runwayMark;
  for (let z = TRACK.runwayZ + 24; z <= TRACK.runwayZ + 396; z += 48) {
    const a = project(-1.2, TRACK.runwayElev + 0.4, z);
    const b = project(1.2, TRACK.runwayElev + 0.4, z);
    const c = project(1.2, TRACK.runwayElev + 0.4, z + 22);
    const d = project(-1.2, TRACK.runwayElev + 0.4, z + 22);
    if (a && b && c && d) quad(ctx, a, b, c, d);
  }
  for (const bx of [-11, -4, 4, 11]) {
    const a = project(bx - 2.4, TRACK.runwayElev + 0.4, TRACK.runwayZ + 10);
    const b = project(bx + 2.4, TRACK.runwayElev + 0.4, TRACK.runwayZ + 10);
    const c = project(bx + 2.4, TRACK.runwayElev + 0.4, TRACK.runwayZ + 34);
    const d = project(bx - 2.4, TRACK.runwayElev + 0.4, TRACK.runwayZ + 34);
    if (a && b && c && d) quad(ctx, a, b, c, d);
  }

  // --- Town buildings as simple shaded boxes ---
  for (const b of ui.buildings) {
    const dz = b.z - cam.z;
    if (dz < -40 || dz > 1500) continue;
    const g = groundHeight(b.x, b.z);
    const hw = b.w / 2;
    const hd = b.d / 2;
    const corners = [
      [b.x - hw, g, b.z - hd], [b.x + hw, g, b.z - hd], [b.x + hw, g, b.z + hd], [b.x - hw, g, b.z + hd],
      [b.x - hw, g + b.h, b.z - hd], [b.x + hw, g + b.h, b.z - hd], [b.x + hw, g + b.h, b.z + hd], [b.x - hw, g + b.h, b.z + hd],
    ].map((p) => project(p[0], p[1], p[2]));
    if (corners.some((p) => !p)) continue;
    const shade = b.hue > 0.5 ? '#c9b18a' : '#a89a80';
    const roof = '#7a4a3a';
    ctx.fillStyle = shade;
    quad(ctx, corners[4], corners[5], corners[1], corners[0]); // front face
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    quad(ctx, corners[5], corners[6], corners[2], corners[1]); // side face
    ctx.fillStyle = roof;
    quad(ctx, corners[4], corners[7], corners[6], corners[5]); // roof
  }

  // --- Target rings ---
  const now = ui.now;
  world.rings.forEach((ring, i) => {
    const dz = ring.z - cam.z;
    if (dz < -30 || dz > 1500) return;
    const isNext = i === world.ringsPassed;
    const pulse = isNext ? 1 + 0.06 * Math.sin(now / 160) : 1;
    const col = ring.passed ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ring;
    const pts = [];
    for (let k = 0; k <= 28; k += 1) {
      const a = (k / 28) * TAU;
      const p = project(ring.x + Math.cos(a) * ring.radius * pulse, ring.y + Math.sin(a) * ring.radius * pulse, ring.z);
      pts.push(p);
    }
    ctx.globalAlpha = ring.passed ? 0.55 : 0.95;
    ctx.strokeStyle = col;
    ctx.lineWidth = isNext ? 7 : 5;
    ctx.shadowColor = col;
    ctx.shadowBlur = isNext ? 18 : 8;
    ctx.beginPath();
    let penDown = false;
    for (const p of pts) {
      if (!p) { penDown = false; continue; }
      if (!penDown) { ctx.moveTo(p.x, p.y); penDown = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    // A faint tether from the ring down to the ground, for depth.
    const top = project(ring.x, ring.y, ring.z);
    const bot = project(ring.x, groundHeight(ring.x, ring.z), ring.z);
    if (top && bot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bot.x, bot.y);
      ctx.stroke();
    }
  });

  // --- The aeroplane's shadow on the ground ---
  const gBelow = groundHeight(world.x, world.z);
  const sh = project(world.x, gBelow + 0.6, world.z);
  if (sh && world.y - gBelow < 260) {
    const s = clamp(1 - (world.y - gBelow) / 260, 0.15, 1) * 46;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, s, s * 0.32, 0, 0, TAU);
    ctx.fill();
  }

  drawPlane(ctx, world, W, H, ui);

  // --- HUD + instruments ---
  drawHud(ctx, world, ui, W, H);
  drawPanel(ctx, world, ui, W, H);

  // --- Screen overlays ---
  if (ui.screen === 'title') drawTitle(ctx, world, ui, W, H);
  else if (ui.screen === 'paused') drawCenterCard(ctx, W, H, 'PAUSED', 'Press P or click to keep flying', `Score ${fmt(world.score)}  •  Rings ${world.ringsPassed}/${TRACK.ringCount}`);
  else if (ui.screen === 'crashed') drawCenterCard(ctx, W, H, 'CRASHED', world.message || 'The flight is over', `Score ${fmt(world.score)}  •  Rings ${world.ringsPassed}/${TRACK.ringCount}  •  Press R or Enter to fly again`);
  else if (ui.screen === 'landed') {
    const bonus = world.timeBonus || 0;
    drawCenterCard(ctx, W, H, 'TOUCHDOWN!', 'A clean landing at Ridgeline Field', `Score ${fmt(world.score)}  •  Rings ${world.ringsPassed}/${TRACK.ringCount}  •  Time bonus +${fmt(bonus)}  •  Press R or Enter to fly again`);
  }
}

/** The chase-view aeroplane, drawn as vector art, banked with the roll. */
function drawPlane(ctx, world, W, H, ui) {
  const cx = W / 2;
  const cy = H * 0.68 - world.pitch * 120;
  const bank = world.roll;
  const spin = ui.now / 28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank * 0.9);
  ctx.scale(0.88, 0.88);
  const S = 1; // wingspan ≈ 300 px at 1280 wide
  // Wings (tapered, slight dihedral).
  ctx.fillStyle = '#e8b13c';
  ctx.beginPath();
  ctx.moveTo(-150 * S, 6); ctx.lineTo(-18 * S, -8); ctx.lineTo(-18 * S, 14); ctx.lineTo(-150 * S, 26); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150 * S, 6); ctx.lineTo(18 * S, -8); ctx.lineTo(18 * S, 14); ctx.lineTo(150 * S, 26); ctx.closePath();
  ctx.fill();
  // Wing stripes.
  ctx.fillStyle = '#c98f1e';
  ctx.fillRect(-150 * S, 14, 132 * S, 5);
  ctx.fillRect(18 * S, 14, 132 * S, 5);
  // Fuselage: rear view, tapering toward the nose (up).
  const fus = ctx.createLinearGradient(-16, -70, 16, 40);
  fus.addColorStop(0, '#f4f7fa');
  fus.addColorStop(0.6, '#dfe6ec');
  fus.addColorStop(1, '#b9c4cd');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(-13, -72);
  ctx.quadraticCurveTo(-20, -20, -17, 34);
  ctx.quadraticCurveTo(-12, 52, 0, 52);
  ctx.quadraticCurveTo(12, 52, 17, 34);
  ctx.quadraticCurveTo(20, -20, 13, -72);
  ctx.quadraticCurveTo(0, -80, -13, -72);
  ctx.fill();
  // Canopy stripe.
  ctx.fillStyle = '#274b63';
  ctx.beginPath();
  ctx.ellipse(0, -58, 9, 16, 0, 0, TAU);
  ctx.fill();
  // Tail fin + stabiliser.
  ctx.fillStyle = '#e8b13c';
  ctx.beginPath();
  ctx.moveTo(-4, 30); ctx.lineTo(-4, 74); ctx.lineTo(4, 74); ctx.lineTo(4, 30); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d64541';
  ctx.beginPath();
  ctx.moveTo(0, 30); ctx.lineTo(-7, 76); ctx.lineTo(7, 76); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b13c';
  ctx.beginPath();
  ctx.moveTo(-58, 44); ctx.lineTo(-10, 38); ctx.lineTo(-10, 50); ctx.lineTo(-58, 56); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 44); ctx.lineTo(10, 38); ctx.lineTo(10, 50); ctx.lineTo(58, 56); ctx.closePath();
  ctx.fill();
  // Propeller blur arc above the nose (the prop spins at the front).
  ctx.strokeStyle = 'rgba(40,50,60,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, -72, 26 + 6 * Math.sin(spin), 8, 0, 0, TAU);
  ctx.stroke();
  // Navigation lights, lit: red port, green starboard, white tail.
  const blink = Math.sin(ui.now / 240) > 0 ? 1 : 0.35;
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.arc(-150 * S, 16, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#39e585';
  ctx.beginPath(); ctx.arc(150 * S, 16, 5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 76, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Top HUD: altitude / speed / heading, score, rings, fuel, timer, guidance. */
function drawHud(ctx, world, ui, W, H) {
  const altFt = Math.max(0, (world.y - TRACK.runwayElev) * 3.28084);
  const spdKt = Math.max(0, world.speed * 1.94384);
  const hdg = ((world.heading * 180) / Math.PI % 360 + 360) % 360;
  ctx.font = `700 26px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  // Top-left instrument readouts.
  const items = [
    [`ALT`, `${fmt(altFt)} ft`],
    [`SPD`, `${fmt(spdKt)} kt`],
    [`HDG`, `${fmt(hdg, 0)}°`],
  ];
  items.forEach(([label, value], i) => {
    const x = 24 + i * 190;
    ctx.fillStyle = 'rgba(10,16,24,0.55)';
    ctx.fillRect(x - 8, 14, 176, 58);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(label, x, 34);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(value, x, 62);
  });
  // Top-right: score, rings, fuel, time.
  const rx = W - 24;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(rx - 330, 14, 330, 58);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('SCORE', rx - 238, 34);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(fmt(world.score), rx - 238, 62);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('RINGS', rx - 128, 34);
  ctx.fillStyle = world.ringsPassed >= TRACK.ringCount ? PALETTE.litGreen : PALETTE.hudText;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`${world.ringsPassed}/${TRACK.ringCount}`, rx - 128, 62);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('TIME', rx - 8, 34);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 26px ${FONT}`;
  const mm = Math.floor(world.time / 60);
  const ss = Math.floor(world.time % 60);
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, rx - 8, 62);
  ctx.textAlign = 'left';
  // Fuel bar under the score box.
  const fw = 200;
  ctx.fillStyle = 'rgba(10,16,24,0.55)';
  ctx.fillRect(rx - fw, 80, fw, 18);
  ctx.fillStyle = world.fuel < 20 ? PALETTE.litRed : PALETTE.litGreen;
  ctx.fillRect(rx - fw + 2, 82, (fw - 4) * (world.fuel / 100), 14);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(`FUEL ${fmt(world.fuel)}%`, rx - fw, 112);
  // Next-ring guidance: arrow + distance, centred near the top.
  const next = world.rings[world.ringsPassed];
  if (next && ui.screen === 'play') {
    const dx = next.x - world.x;
    const dz = next.z - world.z;
    const dist = Math.hypot(dx, dz);
    let rel = Math.atan2(dx, dz) - world.heading;
    while (rel > Math.PI) rel -= TAU;
    while (rel < -Math.PI) rel += TAU;
    const ax = W / 2 + clamp(rel * 320, -360, 360);
    const ay = 96;
    ctx.fillStyle = 'rgba(10,16,24,0.55)';
    ctx.beginPath();
    ctx.arc(ax, ay, 26, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(clamp(rel, -1.2, 1.2));
    ctx.fillStyle = PALETTE.ringNext;
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(11, 10); ctx.lineTo(0, 4); ctx.lineTo(-11, 10); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`RING ${world.ringsPassed + 1}  •  ${fmt(dist)} m`, ax, ay + 44);
    ctx.textAlign = 'left';
  } else if (!next && ui.screen === 'play') {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ALL RINGS CLEAR — LAND ON THE RUNWAY  •  GEAR DOWN WITH G', W / 2, 100);
    ctx.textAlign = 'left';
  }
  // Message banner (not over the end-of-flight cards, which carry it).
  if (world.message && world.time < world.messageUntil && ui.screen !== 'landed' && ui.screen !== 'crashed') {
    ctx.font = `700 22px ${FONT}`;
    const tw = ctx.measureText(world.message).width;
    ctx.fillStyle = 'rgba(10,16,24,0.65)';
    ctx.fillRect(W / 2 - tw / 2 - 18, 138, tw + 36, 40);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(world.message, W / 2, 166);
    ctx.textAlign = 'left';
  }
  void H;
}

/** The lit instrument panel along the bottom: horizon, tapes, fuel, gear. */
function drawPanel(ctx, world, ui, W, H) {
  const ph = 108;
  const py = H - ph;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, py, W, ph);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, py, W, 2);
  const cx = 150;
  const cy = py + 46;
  const R = 38;
  // Artificial horizon.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-world.roll);
  const pitchPx = clamp(world.pitch * 90, -R, R);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-R, -R - pitchPx, R * 2, R + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-R, pitchPx, R * 2, R - pitchPx + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-R, pitchPx); ctx.lineTo(R, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.litAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillRect(cx - 16, cy - 1.5, 12, 3);
  ctx.fillRect(cx + 4, cy - 1.5, 12, 3);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, py + ph - 8);
  ctx.textAlign = 'left';

  // Altimeter + airspeed tapes (digital, lit).
  const tapes = [
    { label: 'ALTITUDE', value: `${fmt(Math.max(0, (world.y - TRACK.runwayElev) * 3.28084))} FT`, x: 260 },
    { label: 'AIRSPEED', value: `${fmt(Math.max(0, world.speed * 1.94384))} KT`, x: 430 },
    { label: 'VERT SPEED', value: `${world.verticalSpeed >= 0 ? '+' : ''}${fmt(world.verticalSpeed * 196.85)} FT/MIN`, x: 600 },
  ];
  for (const t of tapes) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(t.label, t.x, py + 26);
    ctx.fillStyle = PALETTE.litGreen;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(t.value, t.x, py + 56);
  }

  // Compass dial: only the headings near the nose are labelled, spaced
  // evenly so they never pile up.
  const ccx = 800;
  const ccy = py + 46;
  const hdg = ((world.heading * 180) / Math.PI % 360 + 360) % 360;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, 0, TAU);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, 0, TAU);
  ctx.clip();
  ctx.translate(ccx, ccy);
  for (let d = 0; d < 360; d += 30) {
    const rel = ((d - hdg + 540) % 360) - 180;
    if (Math.abs(rel) > 45) continue;
    const x = (rel / 45) * R * 0.7;
    const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d);
    ctx.fillStyle = d % 90 === 0 ? PALETTE.litAmber : PALETTE.hudText;
    ctx.font = `700 ${d % 90 === 0 ? 13 : 10}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, -R + 18);
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.litAmber;
  ctx.beginPath();
  ctx.moveTo(ccx - 6, ccy - R - 2); ctx.lineTo(ccx + 6, ccy - R - 2); ctx.lineTo(ccx, ccy - R + 8); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('HEADING', ccx, py + ph - 8);
  ctx.textAlign = 'left';

  // Throttle lever.
  const tx = 950;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('THROTTLE', tx, py + 26);
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(tx, py + 34, 150, 12);
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillRect(tx, py + 34, 150 * world.throttle, 12);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(`${fmt(world.throttle * 100)}%`, tx, py + 68);

  // Gear light + mute state, right side.
  const gx = 1140;
  ctx.fillStyle = world.gearDown ? PALETTE.litGreen : PALETTE.litAmber;
  ctx.beginPath();
  ctx.arc(gx, py + 40, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(world.gearDown ? 'GEAR DOWN' : 'GEAR UP', gx + 16, py + 45);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(ui.muted ? 'SOUND OFF (M)' : 'SOUND ON (M)', gx, py + 70);
  void ui;
}

function drawCenterCard(ctx, W, H, title, line1, line2) {
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 0, W, H);
  const cw = 620;
  const ch = 190;
  const x = (W - cw) / 2;
  const y = (H - ch) / 2 - 110;
  ctx.fillStyle = 'rgba(16,22,30,0.92)';
  ctx.fillRect(x, y, cw, ch);
  ctx.strokeStyle = PALETTE.litAmber;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, cw, ch);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `800 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, y + 58);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(line1, W / 2, y + 100);
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(line2, W / 2, y + 136);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, world, ui, W, H) {
  ctx.fillStyle = 'rgba(8,12,18,0.45)';
  ctx.fillRect(0, 0, W, H * 0.42);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `800 64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('RIDGELINE RUN', W / 2, 122);
  ctx.fillStyle = PALETTE.ringNext;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('Fly the valley. Thread all eight rings. Land on the runway.', W / 2, 160);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('↑ ↓ pitch   •   ← → bank & turn   •   Shift / Ctrl throttle   •   G landing gear   •   Mouse steers too', W / 2, 196);
  ctx.fillText('Watch your fuel — a stalled wing stops flying. Press Enter or click to take off.', W / 2, 224);
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.litGreen;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`Best score: ${fmt(world.best)}`, W / 2, 258);
  }
  const blink = Math.sin(ui.now / 300) > 0;
  if (blink) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('— PRESS ENTER TO FLY —', W / 2, 300);
  }
  ctx.textAlign = 'left';
}
