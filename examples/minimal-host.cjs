// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const assert=require('node:assert/strict');
const {createController}=require('../src');
const {MetersRadiansHost,CentimetersDegreesHost}=require('./adapters.cjs');
function run(Host){
  const host=new Host(),controller=createController();let decision;
  for(let i=0;i<=200;i++){
    const time=i/100;
    // Host state is sampled every 40 ms; actual weapon emission checks every 10 ms.
    if(i%4===0){const f=host.frame(time,i);decision=controller.update(f);host.apply(decision,f);}
    host.tick(controller,time,i);
  }
  const metrics={...controller.metrics};host.close(controller);
  assert.equal(host.held,false);assert.equal(metrics.shots,host.shots);
  return {shots:host.shots,metrics,timeline:host.log};
}
if(require.main===module){
  const a=run(MetersRadiansHost),b=run(CentimetersDegreesHost);assert.deepEqual(a,b);
  console.log(JSON.stringify({status:'PASS',syntheticHostConventions:2,identicalResults:true,...a},null,2));
}
module.exports={run};
