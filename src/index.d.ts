// SPDX-License-Identifier: MIT
// Copyright (c) 2026 达叔同学ya
export type Vec3=Readonly<{x:number;y:number;z:number}>;
export type Rotation=Readonly<{pitch:number;yaw:number}>;
export type Identity=Readonly<{world:string;entity:string;life:string;weapon:string}>;
export type Evidence<T>=Readonly<{value:T;sampledAt:number;validUntil:number}>;
export type WeaponClass='rifle'|'smg'|'machinegun'|'pistol'|'shotgun'|'sniper'|'other';
export interface FireWindow {fireSeconds:number;restSeconds:number}
export interface Parameters {
  fire:{windows:Partial<Record<WeaponClass,FireWindow|null>>;eligibleModes:readonly {mode:string;execution:'hitscan'|'projectile'|'custom'}[];
    sampleMaxAgeSeconds:number;restartRetrySeconds:number;stopRetrySeconds:number};
  aim:{authority:'host'|'library';reactionSeconds:number;maximumTurnRateRadPerSecond:number;
    trackingResponseSeconds:number;recoilResponseSeconds:number;recoilGain:number;predictionSeconds:number;
    maximumCompensationRateRadPerSecond:number;maximumRecoilRadians:number;predictionRadiusRatio:number;stopSpeedRatio:number;
    settleSeconds:number;maximumFrameGapSeconds:number;maximumStepSeconds:number;minimumDistanceMeters:number;
    minimumToleranceRadians:number;maximumToleranceRadians:number;knownSpreadToleranceRatio:number;unknownSpreadToleranceRatio:number;
    enterSpreadRatio:number;holdSpreadRatio:number};
  motion:{enabled:boolean;nativeEvasionCooldownSeconds:number;queueTimeoutSeconds:number;minimumBrakeDelaySeconds:number;
    maximumBrakeDelaySeconds:number;recoveryLeadSeconds:number;fallbackBrakeDelaySeconds:number;maximumDistanceMeters:number;settledSpeedMetersPerSecond:number};
  sniper:{enabled:boolean;minimumScopeHoldSeconds:number;settleSeconds:number;stopSpeedRatio:number;acquireTimeoutSeconds:number;
    lostSightGraceSeconds:number;retryBackoffSeconds:number};
}
export type PartialDeep<T>=T extends readonly unknown[]?T:T extends object?{[K in keyof T]?:PartialDeep<T[K]>}:T;
export type DeepReadonly<T>=T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
export interface Frame {
  time:number;sequence:number;identity:Identity;active:boolean;alive:boolean;
  weapon:{class:WeaponClass;mode:string;execution:'hitscan'|'projectile'|'custom';ready:boolean;reloading:boolean;cycleBusy:boolean;ammo:number;
    effectiveView?:Evidence<Rotation>;recoilOffset?:Evidence<Rotation>;spreadRadians?:Evidence<number>;
    scope?:Evidence<{active:boolean;stationarySpread:boolean;requiredHoldSeconds:number}>};
  self:{position:Vec3;eye:Vec3;muzzle:Vec3;velocity:Vec3;walking:boolean;maximumGroundSpeed:number;inputView?:Evidence<Rotation>};
  target:null|{id:string;alive:boolean;hostile:boolean;focused:boolean;radius?:number;position?:Evidence<Vec3>;velocity?:Evidence<Vec3>;
    aligned:Evidence<boolean>;eyeClear:Evidence<boolean>;muzzleClear:Evidence<boolean>};
  ownership:{nativeTaskPriority:boolean;navigationPriority:boolean;threatEvasionActive?:boolean;motion:'idle'|'queued'|'moving'|'braking'|'settled'};
  motionCandidates?:readonly {id:string;side?:1|-1;destination:Vec3;reachable:Evidence<boolean>;clear:Evidence<boolean>}[];
  receipts?:readonly Receipt[];
}
export interface Lease {readonly id:string;readonly identity:Identity;readonly target:string;readonly mode:string;
  readonly execution:string;readonly weaponClass:WeaponClass;readonly group:number;readonly startedAt:number;
  readonly fireUntil:number;readonly validUntil:number;readonly singleShot:boolean}
export type CommandKind='hold'|'release'|'delegate'|'move'|'brake'|'aim'|'scope-enter'|'scope-release';
export interface Command {readonly id:string;readonly kind:CommandKind;readonly identity:Identity;readonly time:number;
  readonly lease?:Lease;readonly cleanup?:boolean;readonly reason?:string;readonly goal?:Rotation;readonly maximumTurnRateRadPerSecond?:number;
  readonly group?:number;readonly candidateId?:string;readonly validUntil?:number}
export interface Receipt {id:string;commandId:string;identity:Identity;time:number;
  kind:'accepted'|'rejected'|'stopped'|'shot'|'motion-started'|'motion-ended';actualShots?:number}
export interface Metrics {shots:number;accepted:number;rejected:number;ignoredReceipts:number;groups:number}
export interface MotionStatus {phase:'idle'|'queued'|'moving'|'braking'|'settled'|'native_priority';ready:boolean;hold:boolean;
  reason?:string;group?:string|number;candidateId?:string;startedAt?:number|null;brakeAt?:number;deadline?:number;distance?:number;speed?:number}
export interface Decision {readonly sequence:number;readonly identity:Identity|null;readonly time:number;readonly reason:string;
  readonly actions:readonly Command[];readonly aim:AimDecision|null;readonly lease:Lease|null;readonly phase:string;
  readonly motion:Readonly<MotionStatus>;readonly metrics:Readonly<Metrics>}
export class BotController {
  constructor(parameters?:PartialDeep<Parameters>);
  readonly parameters:DeepReadonly<Parameters>;readonly metrics:Metrics;
  update(frame:Frame):Decision;
  beforeDischarge(leaseId:string|null|undefined,liveFrame:Frame):{allowed:boolean;reason:string;lease?:Lease};
  recordShot(receipt:Receipt):boolean;
  reset(reason?:string):Command[];
}
export function createController(parameters?:PartialDeep<Parameters>):BotController;
export const DEFAULT_PARAMETERS:DeepReadonly<Parameters>;
export function parameters(input?:PartialDeep<Parameters>):DeepReadonly<Parameters>;
export class BurstWindow {
  constructor(fireSeconds?:number,restSeconds?:number);readonly fireSeconds:number;readonly restSeconds:number;
  phase:'idle'|'fire'|'rest';fireUntil:number;restUntil:number;last:number|null;
  begin(time:number):boolean;advance(time:number):boolean;end(time:number):boolean;reset():void;
  snapshot():{phase:string;fireUntil:number;restUntil:number};
}
export interface AimSample {now:number;identity:string;targetId:string;verified:boolean;eligible:boolean;
  muzzle:Vec3;target:Vec3;targetVelocity:Vec3;selfVelocity:Vec3;inputView:Rotation;recoil:Rotation;speed:number;groundSpeed:number;radius:number;
  visible:boolean;lineClear:boolean;spreadRadians?:number;reloading?:boolean;weaponReady?:boolean;recoverUntil?:number;postBurstMoving?:boolean}
export interface AimDecision {mode:'delegate'|'control';fire:boolean;reason:string;desiredView?:Rotation;inputGoal?:Rotation;effectiveView?:Rotation;
  recoil?:Rotation;compensation?:Rotation;prediction?:Vec3;distance?:number;tolerance?:number;stopSpeed?:number;maxTurnRate?:number;
  turnResponse?:number;error?:number;spreadVerified?:boolean;spreadRadians?:number|null;yaw?:number;pitch?:number}
export class AimControl {constructor(options?:Partial<Parameters['aim']>);step(sample:AimSample):AimDecision;reset():void}
export interface SniperSample {now:number;identity:string;target:string;eligible:boolean;busy:boolean;reload:boolean;visible:boolean;
  speed:number;groundSpeed:number;stationarySpread:boolean;aligned:boolean;scope:number;nativeScopeTime:number}
export interface SniperDecision {control:boolean;fire:boolean;release?:boolean;brake?:boolean;enter?:boolean;reason:string}
export class SniperControl {constructor(options?:Partial<Parameters['sniper']>);step(sample:SniperSample):SniperDecision;
  reset():void;entered(time:number):void;fired(time:number):void;release(time:number,reason:string,retry:boolean):SniperDecision}
export class MotionControl {constructor(options?:Partial<Parameters['motion']>);request(frame:Frame,group:string|number,recoveryUntil:number):Partial<MotionStatus>&{accepted:boolean};
  started(frame:Frame):void;status(frame:Frame):MotionStatus;cancel(reason?:string):MotionStatus;reset():void}
export interface RosterMember {readonly id:string;readonly relation:'ally'|'enemy';readonly index:number;readonly team:string;readonly name:string;readonly ready:boolean}
export function createRoster(options:{matchId:string;allyCount:number;enemyCount:number;playerTeam:string;opponentTeam:string;maximumPlayers:number;humanPlayers?:number;
  names?:{ally?:string[];enemy?:string[]}}):readonly RosterMember[];
export interface Loadout {id:string;slots:Record<string,string>}
export class LoadoutPlanner {constructor(options:{seed:string;loadouts:Loadout[];admits?:(slot:string,item:string)=>boolean});
  select(matchId:string,botId:string,round:number):DeepReadonly<Loadout>;snapshot():{seed:string;assignments:[string,string][]};
  restore(snapshot:{seed:string;assignments:[string,string][]}):void;clear():void}
export type DeploymentRow=Readonly<Pick<RosterMember,'id'>&Partial<Omit<RosterMember,'id'>>>;
export interface DeploymentCommand {readonly id:string;readonly kind:'create-and-equip'|'remove'|'unfreeze';readonly matchId:string;
  readonly botId?:string;readonly roster?:DeploymentRow;readonly reason?:string}
export interface DeploymentState {readonly matchId:string|null;readonly phase:string;readonly freeze:boolean;readonly ready:boolean;
  readonly commands:readonly DeploymentCommand[];readonly completed:number;readonly total:number}
export class DeploymentControl {constructor(options?:{maximumInFlight?:number;maximumCreatesPerTick?:number;timeoutSeconds?:number});
  begin(matchId:string,rows:readonly DeploymentRow[],now:number):DeploymentState;
  update(now:number,receipts?:readonly {matchId:string;botId:string;commandId:string;kind:'ready'|'failed';time:number}[]):DeploymentState;
  cancel():DeploymentCommand[];reset():void}
export interface DialogueMessage {readonly id:string;readonly matchId:string;readonly trigger:string;readonly speaker:string;readonly round:number|null;
  readonly text:string;readonly due:number;readonly expires?:number}
export class DialogueControl {constructor(options?:{random?:()=>number;probability?:Record<string,number>;phrases?:Record<string,string[]>;maximumQueue?:number;
  minimumDelaySeconds?:number;maximumDelaySeconds?:number;globalCooldownSeconds?:number;botCooldownSeconds?:number;eventTtlSeconds?:number;
  openingGapSeconds?:number;openingStartDelaySeconds?:number});
  startMatch(matchId:string,lines:{speaker:string;text:string}[],now:number):boolean;
  offer(event:{id:string;trigger:string;speaker:string;round:number;now:number}):boolean;
  peek(time:number,round:number):DialogueMessage|null;commit(id:string,time:number):boolean;clear():void;reset():void}
export class TargetStability {constructor(options?:{minimumHoldSeconds?:number;closerDistanceRatio?:number});
  select(time:number,candidates:{id:string;distance:number;alive:boolean;hostile:boolean;visible:boolean}[],preferredId?:string):string|null;reset():void}
export interface CadenceState {readonly phase:string;readonly shots:number;readonly limit:number;readonly fireUntil:number;readonly recoverUntil:number}
export class ShotCadence {constructor(options?:{minimumShots?:number;maximumShots?:number;maximumBurstSeconds?:number;
  minimumRecoverySeconds?:number;maximumRecoverySeconds?:number;random?:()=>number});
  allows(identity:string,time:number):CadenceState&{allowed:boolean;reason:string};
  committed(receipt:{id:string;identity:string;time:number}):boolean;end(time:number):boolean;reset():void;snapshot():CadenceState}
export const math:{TAU:number;clamp:(value:number,low:number,high:number)=>number;wrap:(radians:number)=>number;
  vector:(value:unknown)=>boolean;rotation:(value:unknown)=>boolean;speed:(value:Vec3)=>number;distance:(a:Vec3,b:Vec3)=>number;
  direction:(a:Vec3,b:Vec3)=>Rotation;angularError:(a:Rotation,b:Rotation)=>number;identity:(value:Identity)=>string|null;
  fresh:(value:Evidence<unknown>,time:number,maximumAge?:number)=>boolean;
  number:(value:number,name:string,minimum?:number,maximum?:number,openMinimum?:boolean)=>number;
  integer:(value:number,name:string,minimum?:number,maximum?:number)=>number;
  text:(value:string,name:string)=>string;deepFreeze:<T>(value:T)=>DeepReadonly<T>};
