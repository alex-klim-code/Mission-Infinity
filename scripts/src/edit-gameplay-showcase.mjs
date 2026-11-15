/**
 * Edit genuine browser recordings; never generates or substitutes gameplay.
 * Usage: node scripts/src/edit-gameplay-showcase.mjs <edit.json>
 * Each scene: { shots: [{ file, start, duration, frames }] }.
 * Source times are seconds; shot frames must sum to SCENE_FRAMES below.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const FPS = 30;
// Each cut overlaps six frames. Boundaries are centred at 3/5/10/13/16/20/23s.
const SCENE_FRAMES = [93, 66, 156, 96, 96, 126, 96, 93];
const EXPECTED_TIMELINE = [
  ['Title and character', 0, 3],
  ['Crew and mission start', 3, 5],
  ['Rocket Builder', 5, 10],
  ['Scientific Instruments', 10, 13],
  ['Fuel and payload', 13, 16],
  ['Launch and spaceflight', 16, 20],
  ['Landing and sample collection', 20, 23],
  ['Return, report and branding', 23, 26],
];
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Pass a JSON edit decision list.');
const edit = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(edit.scenes) || edit.scenes.length !== 8) throw new Error('Exactly eight scenes are required.');
const outDir = resolve(edit.outputDir ?? 'generated-artifacts/gameplay-showcase');
mkdirSync(outDir, { recursive: true });
const probes = new Map();
function run(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y', ...args], { stdio: 'inherit' });
}
function probe(file) {
  if (!probes.has(file)) probes.set(file, JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_format', '-show_streams', '-of', 'json', file,
  ], { encoding: 'utf8' })));
  return probes.get(file);
}
const scenes = [];
const evidence = [];
for (const [index, scene] of edit.scenes.entries()) {
  if (!Array.isArray(scene.shots) || !scene.shots.length) throw new Error(`Missing footage for scene ${index + 1}.`);
  if (scene.shots.reduce((sum, shot) => sum + shot.frames, 0) !== SCENE_FRAMES[index])
    throw new Error(`Scene ${index + 1} must contain ${SCENE_FRAMES[index]} frames including transition handles.`);
  const inputs = [];
  const filters = [];
  for (const [n, shot] of scene.shots.entries()) {
    const file = resolve(shot.file);
    if (!existsSync(file)) throw new Error(`Recording not found: ${file}`);
    const metadata = probe(file);
    const stream = metadata.streams.find(s => s.codec_type === 'video');
    const length = Number(metadata.format.duration);
    if (!stream || !Number.isFinite(length)) throw new Error(`Invalid source recording: ${file}`);
    if (!(shot.start >= 0 && shot.duration > 0 && Number.isInteger(shot.frames) && shot.frames > 0) ||
      shot.start + shot.duration > length + 0.03) throw new Error(`Out-of-bounds edit: ${file}`);
    inputs.push('-threads', '1', '-ss', String(shot.start), '-t', String(shot.duration), '-i', file);
    const ratio = shot.frames / FPS / shot.duration;
    filters.push(`[${n}:v]setpts=(PTS-STARTPTS)*${ratio},scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x050b14,setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=${shot.frames},setpts=PTS-STARTPTS,format=yuv420p[v${n}]`);
    evidence.push({ scene: index + 1, file, start: shot.start, duration: shot.duration, outputFrames: shot.frames, sourceResolution: `${stream.width}x${stream.height}` });
  }
  const labels = scene.shots.map((_, n) => `[v${n}]`).join('');
  filters.push(`${labels}concat=n=${scene.shots.length}:v=1:a=0[scene]`);
  const output = join(outDir, `scene-${index + 1}.mp4`);
  console.log(`Encoding ${EXPECTED_TIMELINE[index][0]}`);
  run([...inputs, '-filter_complex_threads', '1', '-filter_complex', filters.join(';'),
    '-map', '[scene]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
    '-threads', '2', '-r', '30', '-frames:v', String(SCENE_FRAMES[index]), '-pix_fmt', 'yuv420p', output]);
  scenes.push(output);
}
const inputs = scenes.flatMap(file => ['-threads', '1', '-i', file]);
const logoSource = resolve('artifacts/mission-infinity/public/logo.svg');
if (!existsSync(logoSource)) throw new Error('The original game logo is required.');
const logoPath = join(outDir, 'game-logo.png');
run(['-i', logoSource, '-vf', 'scale=64:64', '-frames:v', '1', '-threads', '1', logoPath]);
inputs.push('-threads', '1', '-i', logoPath);
const filters = scenes.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[v${i}]`);
let previous = 'v0';
let frames = SCENE_FRAMES[0];
for (let i = 1; i < 8; i++) {
  const name = `mix${i}`;
  filters.push(`[${previous}][v${i}]xfade=transition=fade:duration=0.2:offset=${(frames - 6) / FPS}[${name}]`);
  previous = name;
  frames += SCENE_FRAMES[i] - 6;
}
if (frames !== 780) throw new Error('Timeline must resolve to exactly 780 frames.');
const titlePath = join(outDir, 'brand-title.txt');
writeFileSync(titlePath, 'MISSION: INFINITY', 'utf8');
// A restrained editorial wordmark over footage, not a fabricated game control.
const escapedTitle = titlePath.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "'\\''");
filters.push(`[${previous}]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${escapedTitle}':fontsize=46:fontcolor=0xe7f3fa:shadowcolor=0x050b14:shadowx=2:shadowy=2:box=1:boxcolor=0x050b14@0.78:boxborderw=18:x=(w-text_w)/2+36:y=h-text_h-65:enable='lt(t,0.8)+gte(t,25.1)'[brand]`);
filters.push(`[brand][8:v]overlay=x=(W-520)/2-30:y=H-121:enable='lt(t,0.8)+gte(t,25.1)',trim=end_frame=780,setpts=PTS-STARTPTS[out]`);
const finalPath = join(outDir, 'mission-infinity-gameplay.mp4');
run([...inputs, '-filter_complex_threads', '1', '-filter_complex', filters.join(';'),
  '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-threads', '2', '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p',
  '-r', '30', '-frames:v', '780', '-video_track_timescale', '30000', '-movflags', '+faststart',
  '-metadata', 'title=Mission: Infinity — Gameplay Showcase', finalPath]);
const finalProbe = probe(finalPath);
const video = finalProbe.streams.find(s => s.codec_type === 'video');
if (video.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080 ||
  video.r_frame_rate !== '30/1' || Number(video.nb_frames) !== 780 ||
  Math.abs(Number(video.duration) - 26) > 0.00001 ||
  Math.abs(Number(finalProbe.format.duration) - 26) > 0.00001) throw new Error('Final media specification failed validation.');
const report = { file: finalPath, timeline: EXPECTED_TIMELINE, durationSeconds: 26, fps: 30, frames: 780,
  codec: video.codec_name, width: video.width, height: video.height, sources: evidence };
writeFileSync(join(outDir, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
