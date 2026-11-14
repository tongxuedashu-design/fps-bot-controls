# 第三方依赖与许可说明

本库代码采用 MIT，见 LICENSE 和源文件的 SPDX 头。仓库中没有打包已知上游的成品实现、游戏资源、引擎源码或第三方二进制。仓库文件摘要记在 FILES.json，阅读参考记在 ACKNOWLEDGEMENTS.md。

## 开发依赖

| 项目 | 版本 | 许可 | 交付方式 |
| --- | --- | --- | --- |
| TypeScript | 5.9.3 | Apache-2.0 | 仅用于类型检查；package-lock锁定npm源与SHA512；npm ci时另行取得，仓库不含其实现 |
| Node.js | 20或更新版本 | Node.js分发包自带许可及通知 | 宿主／测试运行环境，另行安装，仓库不附运行时 |

安装 TypeScript 时，保留包内的 LICENSE.txt、ThirdPartyNoticeText.txt 及其他原有声明。编译器和运行环境继续使用各自的许可，本库 MIT 只适用于本库自有部分。运行时没有外部 npm 依赖。

## 参考材料

YaPB、ReGameDLL_CS、CSMoE、Yuka 和 RecastNavigation 用于理解机制或接口组织。已保存的 ReGameDLL_CS 资料里，根许可为 MIT，bot 文件头另有 GPL-2.0-or-later 和 HL 链接例外，两者分别记录。CSMoE 根许可是 GPLv3 文本。这些上游文件保留各自的声明，阅读参考也未列为本库源码依赖。

本版核对了保存的参考片段、许可原文和仓库文件。片段比对只覆盖这批材料，方法和限度见 [docs/VALIDATION.md](docs/VALIDATION.md)。
