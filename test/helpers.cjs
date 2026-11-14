// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const evidence=(value,time=0,ttl=.18)=>({value,sampledAt:time,validUntil:time+ttl});
function frame(time=0,sequence=0,change={}){
  const f={time,sequence,identity:{world:'arena',entity:'bot',life:'life-1',weapon:'weapon-1'},active:true,alive:true,
    weapon:{class:'smg',mode:'primary',execution:'hitscan',ready:true,reloading:false,cycleBusy:false,ammo:100,
      effectiveView:evidence({pitch:0,yaw:0},time),recoilOffset:evidence({pitch:0,yaw:0},time),spreadRadians:evidence(0,time)},
    self:{position:{x:0,y:0,z:0},eye:{x:0,y:0,z:1.6},muzzle:{x:0,y:0,z:1.6},velocity:{x:0,y:0,z:0},
      walking:true,maximumGroundSpeed:6,inputView:evidence({pitch:0,yaw:0},time)},
    target:{id:'enemy',alive:true,hostile:true,focused:true,position:evidence({x:10,y:0,z:1.6},time),
      velocity:evidence({x:0,y:0,z:0},time),radius:.3,aligned:evidence(true,time),eyeClear:evidence(true,time),muzzleClear:evidence(true,time)},
    ownership:{nativeTaskPriority:false,navigationPriority:false,motion:'idle'},receipts:[],motionCandidates:[]};
  for(const [key,value] of Object.entries(change))f[key]=typeof value==='function'?value(f[key]):value;
  return f;
}
module.exports={frame,evidence};
