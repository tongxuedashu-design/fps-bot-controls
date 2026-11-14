# FPS Bot Controls

这套库用来控制 FPS 人机的开火节奏、瞄准、射后移动，以及部署和聊天。你传入游戏状态，库返回控制命令。游戏继续处理感知、导航、碰撞、武器发射和伤害。

核心源码是 JavaScript，使用 CommonJS。TypeScript 接入使用附带的 `.d.ts` 类型声明。当前版本为 `0.1.0`，采用 MIT 许可，运行时没有第三方依赖。

目前已通过离线算法对照、模拟宿主测试和类型编译检查，尚未做真实引擎接入测试。两个示例宿主可以直接运行，用来演示单位转换和命令执行。

## 运行

安装 Node.js 20 或更新版本后，在仓库目录运行示例和测试。这两项都只用 Node.js 自带模块。

```shell
node examples/minimal-host.cjs
npm test
```

做开发时，先安装锁定的 TypeScript 5.9.3，再运行完整检查。

```shell
npm ci --ignore-scripts
npm run verify
```

`verify` 会依次运行行为测试、严格类型编译和示例。TypeScript 只用于开发检查，通过 `npm ci` 安装；Node.js 需要自行安装。

## 最小接入

```js
const { createController } = require('.');
const controller = createController({
  fire: { windows: {
    smg: { fireSeconds: 1, restSeconds: 0.32 },
    machinegun: { fireSeconds: 1.5, restSeconds: 0.32 }
  } },
  aim: { authority: 'host' }
});

// 每个人机一个控制器；同一更新内采样身份、目标、视线和武器。
const frame = adapter.collectFrame();
const decision = controller.update(frame);
adapter.apply(decision.actions);

// 每次真实发射前，先满足宿主的冷却/弹药等条件，再核验许可。
if (adapter.weaponCanEmit()) {
  const live = adapter.collectFrame();
  const gate = controller.beforeDischarge(decision.lease?.id, live);
  if (gate.allowed && adapter.emitWeapon()) {
    controller.recordShot({
      id: adapter.nextPhysicalShotId(), kind: 'shot',
      commandId: adapter.lastHoldCommand.id,
      identity: live.identity, time: live.time, actualShots: 1
    });
  }
}

// 退出时执行原身份清理，再销毁宿主实体。
adapter.apply(controller.reset('exit'));
```

示例中的 `adapter` 需要你按游戏接口实现，可以参考 [minimal-host.cjs](examples/minimal-host.cjs) 和 [adapters.cjs](examples/adapters.cjs)。`hold` 表示持续扣住扳机，每一发仍要经过游戏自己的武器检查和 `beforeDischarge`。请求被接受记为 `accepted`，实际出弹才记为 `shot`。

狙击出弹后，必须同步调用 `recordShot`，赶在下一次 `beforeDischarge` 或 `update` 之前完成。这样才能及时消费单发许可。`beforeDischarge` 只做检查，不预留或扣除一发；自动武器的出弹结果可以在下一帧按实际发生时间回传。

## 模块

| 导出 | 职责 |
| --- | --- |
| createController／BotController | 组合定时开火、逐次许可、回执、停止／恢复及可选控制 |
| BurstWindow | 定时连射与恢复 |
| ShotCadence | 可选按真实发数分组，逐组采样恢复 |
| AimControl | 平滑跟踪、有限预判、后坐补偿及散布许可 |
| SniperControl | 停稳、镜态保持、武器周期、稳定及超时 |
| MotionControl | 宿主可达候选、射后移动、排队超时和刹停 |
| TargetStability | 有效目标保持与显著更近目标切换 |
| createRoster／LoadoutPlanner | 相对队伍名单及逐人逐回合完整装备计划 |
| DeploymentControl | 有界创建、真实就绪屏障、超时及失败清理 |
| DialogueControl | 每场开局顺序、真实事件发言、去重及限流 |

默认连续开火时间为步枪／手枪 0.4 秒、冲锋枪 1 秒、机枪 1.5 秒，之后恢复 0.32 秒。这些值都可以单独调整。

设置 `aim.authority:'library'`、`motion.enabled:true` 或 `sniper.enabled:true`，分别启用库瞄准、射后移动和狙击控制。库瞄准可以和狙击一起用。`ShotCadence` 按发数分组，`BurstWindow` 按时间分组，接入时选定一种射击规则。

## 接入资料

- [接口与生命周期](docs/INTEGRATION.md)，说明状态、命令、执行结果和调用顺序。
- [参数说明](docs/PARAMETERS.md)，列出默认值、单位和调参影响。
- [类型声明](src/index.d.ts)与[类型使用检查](test/types/consumer.cts)。
- [离线验证范围](docs/VALIDATION.md)，记录已经做过的测试及尚未验证的部分。
- [文件摘要清单](FILES.json)、[参考致谢](ACKNOWLEDGEMENTS.md)和[依赖说明](THIRD_PARTY_NOTICES.md)。

`FILES.json` 的 SHA-256 按 LF 行尾计算，便于在不同系统上核对文件内容。

接口使用米、秒和弧度，右手坐标为 X 前、Y 左、Z 上。接入时需要提供世界、实体、生命和武器的稳定标识，并注明状态的采样时间和有效期。游戏原有的任务、导航和实际威胁规避优先执行。

作者为达叔同学ya。许可见 [LICENSE](LICENSE)。
