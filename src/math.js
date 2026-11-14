// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const wrap = v => ((v + Math.PI) % TAU + TAU) % TAU - Math.PI;
const vector = v => !!v && [v.x, v.y, v.z].every(Number.isFinite);
const rotation = v => !!v && [v.pitch, v.yaw].every(Number.isFinite);
const speed = v => Math.hypot(v.x, v.y);
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
const direction = (a,b) => ({yaw:Math.atan2(b.y-a.y,b.x-a.x),pitch:Math.atan2(b.z-a.z,Math.hypot(b.x-a.x,b.y-a.y))});
const angularError = (a,b) => Math.hypot(wrap(a.yaw-b.yaw),wrap(a.pitch-b.pitch));
function number(v, name, low=0, high=Infinity, open=false) {
  if (!Number.isFinite(v) || (open ? v<=low : v<low) || v>high) throw new RangeError('Invalid '+name);
  return v;
}
function integer(v,name,low=0,high=Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(v) || v<low || v>high) throw new RangeError('Invalid '+name);
  return v;
}
function text(v,name) {
  if (typeof v!=='string' || !v.length || v.length>256) throw new TypeError('Invalid '+name);
  return v;
}
function identity(v) {
  if (!v) return null;
  const keys=['world','entity','life','weapon'];
  return keys.every(k=>typeof v[k]==='string' && v[k].length>0 && v[k].length<=256) ? JSON.stringify(keys.map(k=>v[k])) : null;
}
function fresh(e,time,maxAge=Infinity) {
  return !!e && Number.isFinite(time) && Number.isFinite(e.sampledAt) && Number.isFinite(e.validUntil) &&
    e.sampledAt<=time && time<=e.validUntil && time-e.sampledAt<=maxAge;
}
function deepFreeze(value) {
  if (value && typeof value==='object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
module.exports={TAU,clamp,wrap,vector,rotation,speed,distance,direction,angularError,number,integer,text,identity,fresh,deepFreeze};
