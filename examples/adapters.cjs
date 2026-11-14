// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
// Two synthetic host conventions. No game or engine packages are imported.
const {math}=require('../src');
const {identity}=math;
const sample=(value,time,ttl=.18)=>({value,sampledAt:time,validUntil:time+ttl});
class MetersRadiansHost {
  constructor(){this.ammo=200;this.command=null;this.held=false;this.shots=0;this.nextShot=0;this.interval=.08;this.log=[];}
  frame(time,sequence){
    return {time,sequence,identity:{world:'demo',entity:'bot-1',life:'life-1',weapon:'automatic-1'},active:true,alive:true,
      weapon:{class:'smg',mode:'primary',execution:'hitscan',ready:true,reloading:false,cycleBusy:false,ammo:this.ammo,
        effectiveView:sample({pitch:0,yaw:0},time)},
      self:{position:{x:0,y:0,z:0},eye:{x:0,y:0,z:1.6},muzzle:{x:0,y:0,z:1.6},velocity:{x:0,y:0,z:0},walking:true,maximumGroundSpeed:6},
      target:{id:'target-1',alive:true,hostile:true,focused:true,radius:.3,
        position:sample({x:10,y:0,z:1.6},time),velocity:sample({x:0,y:0,z:0},time),
        aligned:sample(true,time),eyeClear:sample(true,time),muzzleClear:sample(true,time)},
      ownership:{nativeTaskPriority:false,navigationPriority:false,motion:'idle'},receipts:[]};
  }
  apply(decision,frame){
    // Always bind cleanup to the original world/life. Never apply old-world commands to a new pawn.
    for(const action of decision.actions){
      if(identity(action.identity)!==identity(frame.identity))continue;
      if(action.kind==='hold'){this.held=true;this.command=action;this.log.push({time:frame.time,kind:'start'});}
      if(action.kind==='release'){this.held=false;this.command=null;this.log.push({time:frame.time,kind:'stop'});}
    }
  }
  tick(controller,time,sequence){
    const live=this.frame(time,sequence);
    if(!this.held||!this.command||time+1e-9<this.nextShot)return;
    // An expiring lease never substitutes for checking LIVE engine state here.
    const permission=controller.beforeDischarge(this.command.lease.id,live);
    if(!permission.allowed)return;
    this.ammo--;this.shots++;this.nextShot=time+this.interval;
    controller.recordShot({id:'shot-'+this.shots,kind:'shot',commandId:this.command.id,identity:live.identity,time,actualShots:1});
  }
  close(controller){for(const command of controller.reset('exit'))if(command.kind==='release')this.held=false;this.command=null;}
}
class CentimetersDegreesHost extends MetersRadiansHost {
  frame(time,sequence){
    const raw={position:{right:0,up:160,forward:1000},muzzle:{right:0,up:160,forward:0},yawDegrees:90,pitchDegrees:0};
    // Source axes: +X right,+Y up,+Z forward; source yaw zero=right,90=forward.
    const convert=v=>({x:v.forward/100,y:-v.right/100,z:v.up/100});
    const result=super.frame(time,sequence);
    result.target.position=sample(convert(raw.position),time);
    result.self.muzzle=convert(raw.muzzle);
    result.weapon.effectiveView=sample({yaw:(90-raw.yawDegrees)*Math.PI/180,pitch:raw.pitchDegrees*Math.PI/180},time);
    return result;
  }
}
module.exports={MetersRadiansHost,CentimetersDegreesHost};
