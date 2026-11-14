# 参数说明 0.1.0

创建控制器时，只传你要调整的字段，其余使用默认值。库会校验、复制并冻结参数。运行中需要换配置时，先执行旧控制器 `reset` 返回的清理命令，再创建新实例。

时间用秒，距离用米，速度用米／秒，角度用弧度，角速度用弧度／秒。下面的字段对应 `src/parameters.js`，取值范围按源码校验和类型声明检查。

## 连射窗口 fire

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| windows.rifle／pistol | fireSeconds=0.4，restSeconds=0.32 | 每组保持射击及恢复时长 |
| windows.smg | 1，0.32 | 冲锋枪连续窗口及恢复 |
| windows.machinegun | 1.5，0.32 | 机枪连续窗口及恢复 |
| windows.shotgun／sniper／other | null | 交给宿主；接入方可显式配置时间窗口 |
| eligibleModes | primary + hitscan | 接管的具体模式与执行类型组合；允许显式加入projectile／custom |
| sampleMaxAgeSeconds | 0.18 | 状态最大年龄和每次许可的时间上限 |
| restartRetrySeconds | 0.12 | 重发hold请求间隔，不代表真实射速 |
| stopRetrySeconds | 0.12 | 等待stopped回执期间的release重试间隔 |

`fireSeconds` 和 `restSeconds` 都要大于 0、至多 2.5 秒。增加前者会延长连射，后者控制两组连射之间的停顿。射速、弹药、换弹、弹丸和伤害仍由游戏处理。接入新武器时，映射好 `class`、`mode` 和 `execution`，投射物的弹道提前量也由游戏提供。

`sampleMaxAgeSeconds` 要覆盖正常更新间隔，也要符合游戏能接受的状态延迟。状态超过期限就撤销许可。重试间隔只影响命令重发，连射窗口仍按原期限结束，每一发都要调用 `beforeDischarge`。

## 瞄准 aim

默认 `authority:'host'`，使用游戏原有的瞄准。设为 `library` 后，库按下面的参数规划瞄准，需要游戏提供目标位置、速度、半径、`inputView`、`recoilOffset` 和实际 `effectiveView` 等数据。

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| reactionSeconds | 0.09 | 获得新目标后的等待 |
| maximumTurnRateRadPerSecond | 约4.60194 | 交给宿主执行的最大视角转速 |
| trackingResponseSeconds | 0.035 | 目标速度平滑响应时间 |
| recoilResponseSeconds | 0.045 | 后坐补偿响应时间 |
| recoilGain | 0.94 | 后坐补偿增益，0～1 |
| predictionSeconds | 0.065 | 有限跟踪预判时间 |
| maximumCompensationRateRadPerSecond | 约1.72573 | 补偿变化率上限 |
| maximumRecoilRadians | π/4 | 接受的单轴后坐偏移范围 |
| predictionRadiusRatio | 0.7 | 预判位移相对目标半径的上限 |
| stopSpeedRatio | 0.055 | 允许开火时地面速度相对最大地速的比例 |
| settleSeconds | 0.06 | 对准后持续稳定等待 |
| maximumFrameGapSeconds | 0.5 | 超过此更新间隔后重新获取目标 |
| maximumStepSeconds | 0.15 | 单步平滑计算时间上限 |
| minimumDistanceMeters | 0.01 | 重叠目标排除距离 |
| minimumToleranceRadians | 约0.002301 | 规划器角误差容许下限 |
| maximumToleranceRadians | 约0.104694 | 规划器角误差容许上限 |
| knownSpreadToleranceRatio | 0.7 | 已知散布时，相对目标角半径的跟踪容许比例 |
| unknownSpreadToleranceRatio | 0.45 | 未提供散布时的跟踪比例 |
| enterSpreadRatio | 0.8 | 初次进入可开火状态时，散布加误差的比例上限 |
| holdSpreadRatio | 0.95 | 已就绪时的散布加误差比例上限 |

缩短响应时间会加快跟踪，缩短反应和稳定等待会更早允许开火。放宽误差阈值后，出弹前仍要复查实际枪线。`enterSpreadRatio` 要小于或等于 `holdSpreadRatio`。预判位移受目标半径限制，游戏也可以另行提供弹道瞄点。

## 射后移动 motion

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| enabled | false | 启用后需要宿主可达候选与运动回执 |
| nativeEvasionCooldownSeconds | 0.65 | 已记录移动开始之后的请求冷却 |
| queueTimeoutSeconds | 0.55 | 已排队但尚未开始的移动超时 |
| minimumBrakeDelaySeconds／maximumBrakeDelaySeconds | 0.08／0.35 | 射后刹停延迟的上下限 |
| recoveryLeadSeconds | 0.08 | 相对连射恢复结束提前刹停 |
| fallbackBrakeDelaySeconds | 0.18 | 未提供有效恢复期限时的刹停延迟 |
| maximumDistanceMeters | 0.9 | 单次横移距离上限 |
| settledSpeedMetersPerSecond | 0.18 | 认定已停稳的地面速度阈值 |

0.9 米和 0.18 米／秒是起始默认值，需要按你的游戏尺度和移动速度调整。路径、碰撞和候选有效期由游戏决定，原有任务、导航及实际威胁规避优先。`enabled` 控制组合控制器是否使用移动模块，独立的 `MotionControl` 可以直接调用。

## 狙击 sniper

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| enabled | false | 组合控制器启用独立狙击状态机 |
| minimumScopeHoldSeconds | 0.2 | 开镜保持下限，与宿主真实所需时间取较大值 |
| settleSeconds | 0.1 | 停稳且对准后的持续等待 |
| stopSpeedRatio | 0.025 | 停稳速度相对最大地速比例 |
| acquireTimeoutSeconds | 1.2 | 获取稳定开火状态的超时 |
| lostSightGraceSeconds | 0.25 | 遮挡后的镜态宽限；遮挡期间撤销开火许可 |
| retryBackoffSeconds | 0.5 | 超时／丢失后的再次尝试等待 |

狙击需要真实镜态、稳定散布和原枪械周期。实际出弹后同步调用 `recordShot` 消费单发许可，具体顺序见 [接入说明](INTEGRATION.md)。启用独立狙击时，保留 `windows.sniper:null`，由狙击状态机控制开火许可。

## 可独立使用的模块

| 模块 | 参数与默认值 | 使用说明 |
| --- | --- | --- |
| ShotCadence | minimumShots=2，maximumShots=4；maximumBurstSeconds=2.5；minimumRecoverySeconds=0.28，maximumRecoverySeconds=0.36 | 每组只采样一次；真实发射后committed，发射前allows；与定时窗口选择明确的一种规则 |
| TargetStability | minimumHoldSeconds=0.55，closerDistanceRatio=0.55 | 在最短保持期内，显著更近的有效候选可切换；感知／威胁排序由宿主给出 |
| DeploymentControl | maximumInFlight=1，maximumCreatesPerTick=1，timeoutSeconds=30 | 创建按帧有界分发，全部实体／装备真实ready后解除冻结；失败及超时返回清理命令 |
| DialogueControl | globalCooldownSeconds=3，botCooldownSeconds=45，eventTtlSeconds=8；minimumDelaySeconds=0.8，maximumDelaySeconds=2；maximumQueue=8 | 真实击杀／死亡事件入队，成功显示后commit；概率和短句由接入方传入 |
| DialogueControl开局 | openingGapSeconds=3，openingStartDelaySeconds=0 | 每场一次、按顺序发送；开局队列也占maximumQueue容量 |
| createRoster／LoadoutPlanner | 人数、相对队伍、姓名、seed、完整装备包、admits | 数量受宿主容量约束；逐人逐回合计划稳定；字符串ID映射游戏物品 |

`ShotCadence` 和 `DialogueControl` 可以传入返回 [0,1) 的 `random`，方便重放相同结果。部署期间要使用持续前进的加载或控制时钟，即使 `freeze` 暂停了比赛，仍要调用 `update` 并检查超时。

独立模块的输入、返回值和清理方法见 `src/index.d.ts`。按游戏能提供的数据启用相应模块，接入后再检查单位转换、调用时序和性能。
