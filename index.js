/**
 * ============================================================================
 * 日记本插件 (sillytavernDIARY)
 * ============================================================================
 *
 * @author    Etaf Cisky
 * @copyright Copyright (c) 2025 Etaf Cisky. All rights reserved.
 * @license   CC BY-NC-ND 4.0
 * @version   7.2.0
 * @link      https://github.com/EtafCisky/sillytavernDIARY
 *
 * ============================================================================
 * 版权声明 (COPYRIGHT NOTICE)
 * ============================================================================
 *
 * 本作品采用 CC BY-NC-ND 4.0 许可协议。
 *
 * 使用条款：
 * ✓ 署名 - 必须保留原作者署名（Etaf Cisky）
 * ✗ 非商业性使用 - 禁止用于商业目的
 * ✗ 禁止演绎 - 禁止修改、改编本作品
 *
 * 删除或伪造作者信息、商业使用、修改作品均违反许可证。
 *
 * This work is licensed under CC BY-NC-ND 4.0.
 *
 * License Terms:
 * ✓ Attribution - Must retain original author (Etaf Cisky)
 * ✗ NonCommercial - Commercial use prohibited
 * ✗ NoDerivatives - Modification prohibited
 *
 * Removing author info, commercial use, or modification violates this license.
 *
 * ============================================================================
 * 功能说明
 * ============================================================================
 *
 * 为SillyTavern提供智能日记管理功能，包括：
 * - 智能AI写日记
 * - 自动触发写日记
 * - 日记本浏览和管理
 * - 多主题支持
 * - 悬浮窗交互
 *
 * ============================================================================
 */

import { createDiaryPluginApp } from './src/app/create-diary-plugin-app.js';

const pluginApp = createDiaryPluginApp();
pluginApp.initializeOnReady();
