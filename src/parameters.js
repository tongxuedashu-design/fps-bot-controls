// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {number,deepFreeze}=require('./math');
const DEFAULT_PARAMETERS=deepFreeze({
  fire:{windows:{rifle:{fireSeconds:.4,restSeconds:.32},smg:{fireSeconds:1,restSeconds:.32},
    machinegun:{fireSeconds:1.5,restSeconds:.32},pistol:{fireSeconds:.4,restSeconds:.32},shotgun:null,sniper:null,other:null},
    eligibleModes:[{mode:'primary',execution:'hitscan'}],sampleMaxAgeSeconds:.18,
    restartRetrySeconds:.12,stopRetrySeconds:.12},
  aim:{authority:'host',reactionSeconds:.09,maximumTurnRateRadPerSecond:4.601942363656923,
    trackingResponseSeconds:.035,recoilResponseSeconds:.045,recoilGain:.94,predictionSeconds:.065,
    maximumCompensationRateRadPerSecond:1.7257283863713464,maximumRecoilRadians:Math.PI/4,
    predictionRadiusRatio:.7,stopSpeedRatio:.055,settleSeconds:.06,maximumFrameGapSeconds:.5,
    maximumStepSeconds:.15,minimumDistanceMeters:.01,minimumToleranceRadians:.0023009711818284618,
    maximumToleranceRadians:.10469418877319502,knownSpreadToleranceRatio:.7,unknownSpreadToleranceRatio:.45,
    enterSpreadRatio:.8,holdSpreadRatio:.95},
  motion:{enabled:false,nativeEvasionCooldownSeconds:.65,queueTimeoutSeconds:.55,
    minimumBrakeDelaySeconds:.08,maximumBrakeDelaySeconds:.35,recoveryLeadSeconds:.08,
    fallbackBrakeDelaySeconds:.18,maximumDistanceMeters:.9,settledSpeedMetersPerSecond:.18},
  sniper:{enabled:false,minimumScopeHoldSeconds:.2,settleSeconds:.1,stopSpeedRatio:.025,
    acquireTimeoutSeconds:1.2,lostSightGraceSeconds:.25,retryBackoffSeconds:.5}
});
function merge(template,input,path='parameters') {
  if(input===undefined)return structuredClone(template);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Invalid '+path);
  for(const key of Object.keys(input))if(!Object.hasOwn(template,key))throw new TypeError('Unknown '+path+'.'+key);
  const out=structuredClone(template);
  for(const [key,value] of Object.entries(input)) {
    if(value && typeof value==='object' && !Array.isArray(value) && template[key] && typeof template[key]==='object' && !Array.isArray(template[key]))
      out[key]=merge(template[key],value,path+'.'+key);
    else out[key]=structuredClone(value);
  }
  return out;
}
function parameters(input={}) {
  const p=merge(DEFAULT_PARAMETERS,input);
  for(const [kind,w] of Object.entries(p.fire.windows)) {
    if(w===null)continue;
    if(!['rifle','smg','machinegun','pistol','shotgun','sniper','other'].includes(kind))throw new TypeError('Invalid weapon class');
    if(!w||Object.keys(w).sort().join()!=='fireSeconds,restSeconds')throw new TypeError('Invalid firing window');
    number(w.fireSeconds,'fireSeconds',0,2.5,true);number(w.restSeconds,'restSeconds',0,2.5,true);
  }
  if(!Array.isArray(p.fire.eligibleModes)||!p.fire.eligibleModes.length)throw new TypeError('Invalid eligibleModes');
  for(const mode of p.fire.eligibleModes)if(!mode||typeof mode.mode!=='string'||!mode.mode||
      !['hitscan','projectile','custom'].includes(mode.execution)||Object.keys(mode).length!==2)throw new TypeError('Invalid mode');
  for(const key of ['sampleMaxAgeSeconds','restartRetrySeconds','stopRetrySeconds'])number(p.fire[key],key,0,Infinity,true);
  if(!['host','library'].includes(p.aim.authority))throw new TypeError('Invalid aiming authority');
  for(const [key,value] of Object.entries(p.aim))if(key!=='authority')number(value,key,0,Infinity,
    ['trackingResponseSeconds','recoilResponseSeconds','maximumTurnRateRadPerSecond','maximumStepSeconds','maximumFrameGapSeconds'].includes(key));
  if(p.aim.minimumToleranceRadians>p.aim.maximumToleranceRadians)throw new RangeError('Invalid angle tolerances');
  for(const key of ['recoilGain','predictionRadiusRatio','stopSpeedRatio','knownSpreadToleranceRatio','unknownSpreadToleranceRatio','enterSpreadRatio','holdSpreadRatio'])number(p.aim[key],key,0,1);
  if(p.aim.enterSpreadRatio>p.aim.holdSpreadRatio)throw new RangeError('Invalid spread hysteresis');
  if(typeof p.motion.enabled!=='boolean')throw new TypeError('Invalid motion.enabled');
  for(const [key,value] of Object.entries(p.motion))if(key!=='enabled')number(value,key,0,Infinity,key==='queueTimeoutSeconds');
  if(p.motion.minimumBrakeDelaySeconds>p.motion.maximumBrakeDelaySeconds)throw new RangeError('Invalid brake delays');
  if(typeof p.sniper.enabled!=='boolean')throw new TypeError('Invalid sniper.enabled');
  for(const [key,value] of Object.entries(p.sniper))if(key!=='enabled')number(value,key,0,Infinity,key==='acquireTimeoutSeconds');
  number(p.sniper.stopSpeedRatio,'sniper.stopSpeedRatio',0,1);
  return deepFreeze(p);
}
module.exports={DEFAULT_PARAMETERS,parameters};
