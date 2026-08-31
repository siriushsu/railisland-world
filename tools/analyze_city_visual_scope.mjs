#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const scope = JSON.parse(fs.readFileSync(path.join(DATA, 'route_scope.json'), 'utf8'));
const EARTH_KM = 6371;

function rad(value) { return value * Math.PI / 180; }
function distanceKm(a, b) {
  const p1 = rad(a[0]), p2 = rad(b[0]);
  const dp = p2 - p1, dl = rad(b[1] - a[1]);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(q)));
}
function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}
function validPoint(point) {
  return Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));
}
function visualShape(diagonalKm, p50Km, p90Km) {
  if (diagonalKm > 800 || p50Km > 80) return '全國尺度';
  if (diagonalKm > 300 || p90Km > 80) return '區域路網過散';
  if (diagonalKm > 120) return '都會＋遠郊混合';
  return '緊湊都會';
}

const rows = [];
for (const system of scope.systems) {
  const trackPath = path.join(DATA, system.file);
  const schedulePath = path.join(DATA, system.file.replace(/\.json$/, '_schedule_dense.json'));
  const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  const stationMap = new Map();
  let networkLengthKm = 0;
  for (const line of track.lines || []) {
    const shape = (line.shape || []).filter(validPoint).map(point => [Number(point[0]), Number(point[1])]);
    for (let i = 1; i < shape.length; i++) networkLengthKm += distanceKm(shape[i - 1], shape[i]);
    for (const station of line.stations || []) {
      const point = [Number(station.lat), Number(station.lon)];
      if (!validPoint(point)) continue;
      stationMap.set(point.map(value => value.toFixed(4)).join(','), point);
    }
  }
  const stations = [...stationMap.values()];
  const lats = stations.map(point => point[0]);
  const lons = stations.map(point => point[1]);
  const center = [percentile(lats, 0.5), percentile(lons, 0.5)];
  const radii = stations.map(point => distanceKm(center, point));
  const diagonalKm = stations.length ? distanceKm(
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ) : 0;
  let noonActive = 0;
  for (const train of schedule.trains || []) {
    const stops = train.stops || [];
    if (!stops.length) continue;
    const first = Number(stops[0].depSec ?? stops[0].arrSec);
    const last = Number(stops.at(-1).arrSec ?? stops.at(-1).depSec);
    if (Number.isFinite(first) && Number.isFinite(last) && first <= 43200 && last >= 43200) noonActive++;
  }
  rows.push({
    id: system.id,
    label: system.label,
    lines: (track.lines || []).length,
    trains: (schedule.trains || []).length,
    noonActive,
    stations: stations.length,
    networkLengthKm: Math.round(networkLengthKm),
    diagonalKm: Math.round(diagonalKm),
    p50RadiusKm: Math.round(percentile(radii, 0.5)),
    p90RadiusKm: Math.round(percentile(radii, 0.9)),
    scheduleMiB: Math.round(fs.statSync(schedulePath).size / 1024 / 1024 * 10) / 10,
    visualShape: visualShape(diagonalKm, percentile(radii, 0.5), percentile(radii, 0.9)),
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
} else {
  console.log('| 地區 | 線／variant | 班次 | 中午同時運行 | 站點 | 對角跨度 | P90 半徑 | 班表大小 | 量化形態 |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const row of rows) {
    console.log(`| ${row.label} | ${row.lines} | ${row.trains} | ${row.noonActive} | ${row.stations} | ${row.diagonalKm} km | ${row.p90RadiusKm} km | ${row.scheduleMiB} MiB | ${row.visualShape} |`);
  }
}
