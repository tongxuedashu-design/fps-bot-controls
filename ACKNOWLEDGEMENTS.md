# 参考致谢

整理这套 FPS 人机接口时，我们参考了下面这些开源项目，用来理解控制机制和模块组织。表中记录了实际阅读内容，仓库没有包含这些项目的成品实现。

| 项目与固定证据 | 参考内容 | 已观察到的许可及使用关系 |
| --- | --- | --- |
| YaPB，9395138f1424c137411cd36341356d0c82dce4fc | 目标稳定、射击暂停、任务与武器协调 | UNLICENSE；本库未包含其成品实现 |
| ReGameDLL_CS，4a50c42e85fd3778c2b7d24731c7d30c83bbab01 | 瞄准门槛、停稳、短射和交战移动 | 根LICENSE为MIT；保存的cs_bot_weapon.cpp头为GPL-2.0-or-later及HL链接例外，逐文件区分；本库未包含该文件实现 |
| CSMoE，f1da7962e856e245ad05b4d9695e73e6e6bd424c | 感知、任务及动作执行的职责划分 | 根LICENSE.md为GPLv3文本，具体文件仍保持其声明；本库未包含其成品实现 |
| Yuka，src/steering/SteeringManager.js | 显式实体输入与独立模块组织 | 当时读取master；历史记录未保存此次固定提交或文件摘要，不推定版本；未包含其实现 |
| RecastNavigation | 导航职责及库组织的准备阶段比较 | 阅读参考；未包含导航实现 |

项目地址分别为 [YaPB](https://github.com/yapb/yapb)、[ReGameDLL_CS](https://github.com/rehlds/ReGameDLL_CS)、[CSMoE](https://github.com/MoeMod/CSMoE)、[Yuka](https://github.com/Mugen87/yuka) 和 [RecastNavigation](https://github.com/recastnavigation/recastnavigation)。来源核对使用保存的本地资料，已知固定提交列在上表。

仓库文件的 SHA-256 摘要见 [FILES.json](FILES.json)。参考项目的作者、维护者和许可声明保留原有归属。
