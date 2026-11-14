// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
'use strict';
const {text,integer,deepFreeze}=require('./math');
function hash(textValue){let n=2166136261;for(const c of textValue){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function createRoster({matchId,allyCount,enemyCount,playerTeam,opponentTeam,maximumPlayers,humanPlayers=1,names={}}){
  text(matchId,'matchId');text(playerTeam,'playerTeam');text(opponentTeam,'opponentTeam');
  if(playerTeam===opponentTeam)throw new RangeError('Teams must differ');
  integer(allyCount,'allyCount');integer(enemyCount,'enemyCount');integer(maximumPlayers,'maximumPlayers',1);integer(humanPlayers,'humanPlayers',1);
  if(allyCount+enemyCount+humanPlayers>maximumPlayers)throw new RangeError('Roster exceeds host capacity');
  const rows=[];
  for(const [relation,count,team] of [['ally',allyCount,playerTeam],['enemy',enemyCount,opponentTeam]]){
    const pool=names[relation]||[];
    if(!Array.isArray(pool))throw new TypeError('Invalid names');
    for(let i=0;i<count;i++)rows.push({id:JSON.stringify([matchId,relation,i]),relation,index:i,team,
      name:text(pool[i]??(relation+'-'+(i+1)),'name'),ready:false});
  }
  return deepFreeze(rows);
}
class LoadoutPlanner {
  constructor({seed,loadouts,admits=()=>true}){
    text(seed,'seed');if(!Array.isArray(loadouts)||!loadouts.length)throw new TypeError('Loadout pool required');
    const ids=new Set();
    for(const row of loadouts){text(row.id,'loadout id');if(ids.has(row.id)||!row.slots||typeof row.slots!=='object'||Array.isArray(row.slots))throw new TypeError('Invalid loadout');
      ids.add(row.id);for(const [slot,item] of Object.entries(row.slots)){text(slot,'slot');text(item,'item');if(admits(slot,item)!==true)throw new RangeError('Item not admitted');}}
    this.seed=seed;this.loadouts=deepFreeze(structuredClone(loadouts));this.assignments=new Map();
  }
  select(matchId,botId,round){
    text(matchId,'matchId');text(botId,'botId');integer(round,'round');
    const key=JSON.stringify([matchId,botId,round]);
    if(!this.assignments.has(key)){
      const row=this.loadouts[hash(JSON.stringify([this.seed,key]))%this.loadouts.length];
      this.assignments.set(key,row.id);
    }
    return this.loadouts.find(row=>row.id===this.assignments.get(key));
  }
  snapshot(){return {seed:this.seed,assignments:[...this.assignments]};}
  restore(snapshot){
    if(!snapshot||snapshot.seed!==this.seed||!Array.isArray(snapshot.assignments))throw new TypeError('Invalid planner snapshot');
    const restored=new Map();
    for(const pair of snapshot.assignments){
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!this.loadouts.some(l=>l.id===pair[1]))throw new TypeError('Unknown loadout assignment');
      const key=JSON.parse(pair[0]);if(!Array.isArray(key)||key.length!==3||typeof key[0]!=='string'||typeof key[1]!=='string'||!Number.isSafeInteger(key[2])||key[2]<0||restored.has(pair[0]))throw new TypeError('Invalid assignment key');
      restored.set(...pair);
    }
    this.assignments=restored;
  }
  clear(){this.assignments.clear();}
}
module.exports={createRoster,LoadoutPlanner};
