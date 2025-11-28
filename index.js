/**
 * ============================================================================
 * 日记本插件 (sillytavernDIARY)
 * ============================================================================
 *
 * @author    Etaf Cisky
 * @copyright Copyright (c) 2025 Etaf Cisky. All rights reserved.
 * @license   CC BY-NC-ND 4.0
 * @version   3.3.0
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

// 导入SillyTavern核心功能
import { Generate, chat, is_send_press, name2, saveSettingsDebounced, sendMessageAsUser } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { getPresetManager } from '../../../preset-manager.js';
import { executeSlashCommandsWithOptions } from '../../../slash-commands.js';
import {
  createNewWorldInfo,
  createWorldInfoEntry,
  loadWorldInfo,
  saveWorldInfo,
  world_names,
} from '../../../world-info.js';

// 插件基本配置
const extensionName = 'sillytavernDIARY';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const PLUGIN_AUTHOR = {
  name: 'Etaf Cisky',
  github: 'https://github.com/EtafCisky/sillytavernDIARY',
  version: '3.3.0',
  fingerprint: 'EC-STD-2025',
  copyright: 'Copyright (c) 2025 Etaf Cisky',
};

// 自动写日记全局变量
let lastCheckedChatLength = 0; // 记录上次检查的chat长度，避免重复触发

// 主题配置（可扩展）
const THEMES = {
  classic: {
    id: 'classic',
    name: '经典',
    description: '基于2.3版本的古典书本风格，精致的皮革质感和华丽的装饰效果',
    cssFile: 'style-classic.css',
  },
  simple: {
    id: 'simple',
    name: '简洁',
    description: '现代简约设计，清爽的界面和流畅的交互体验',
    cssFile: 'style-simple.css',
  },
  night: {
    id: 'night',
    name: '夜间',
    description: '护眼的夜间主题，以深色调为主，金色点缀，温和的光效保护您的眼睛',
    cssFile: 'style-night.css',
  },
  // 未来可以在这里添加更多主题
  // future_theme: {
  //     id: 'future_theme',
  //     name: '未来主题名',
  //     description: '主题描述',
  //     cssFile: 'style-future-theme.css'
  // }
};

// 默认设置
const defaultSettings = {
  selectedPreset: null, // 用户选择的日记预设
  selectedTheme: 'classic', // 选中的主题（默认为经典主题）
  selectedButtonTheme: 'heart', // 选中的按钮美化（默认为爱心）
  fontColorMode: 'light', // 字体颜色模式（light: 浅色字体, dark: 深色字体）
  floatWindowVisible: true, // 悬浮窗是否可见
  floatWindowPosition: {
    // 悬浮窗位置（将在初始化时计算屏幕中央位置）
    x: 0,
    y: 0,
  },
  autoDiary: {
    // 自动写日记配置
    interval: 0, // 触发间隔（默认0表示未启用）
    // 注意：触发楼层记录现在存储在每个聊天的chatMetadata中，不再使用全局设置
  },
};

// 固定的世界书名称
const DIARY_WORLDBOOK_NAME = '日记本';

// 日记内容正则表达式
const DIARY_REGEX = /［日记标题：([^］]+)］[\s\S]*?［日记时间：([^］]+)］[\s\S]*?［日记内容：([\s\S]*?)］/g;

// 获取当前设置
function getCurrentSettings() {
  return extension_settings[extensionName] || {};
}

// 保存设置
function saveSettings() {
  saveSettingsDebounced();
}

// ===== 自动写日记配置管理 =====

// 获取自动写日记配置
function getAutoDiaryConfig() {
  const settings = getCurrentSettings();
  if (!settings.autoDiary) {
    // 如果不存在，返回默认配置
    return {
      interval: 0,
    };
  }
  return settings.autoDiary;
}

// 保存自动写日记间隔
function saveAutoDiaryInterval(interval) {
  const settings = getCurrentSettings();
  if (!settings.autoDiary) {
    settings.autoDiary = {
      interval: 0,
    };
  }

  // 转换为整数，如果无效则设为0
  const newInterval = parseInt(interval) || 0;
  settings.autoDiary.interval = newInterval;

  // 如果启用了自动写日记（interval > 0），将当前楼层设为起始点
  if (newInterval > 0) {
    const context = getContext();
    const { chatMetadata, saveMetadata } = context;
    const characterName = getCurrentCharacterName();
    const currentFloor = chat.length;
    
    // 在当前聊天的元数据中存储触发楼层
    if (!chatMetadata.sillytavernDIARY) {
      chatMetadata.sillytavernDIARY = {};
    }
    chatMetadata.sillytavernDIARY.lastTriggerFloor = currentFloor;
    chatMetadata.sillytavernDIARY.characterName = characterName;
    chatMetadata.sillytavernDIARY.lastTriggerTime = 0; // 初始化为0，不触发冷却
    saveMetadata();
    
    console.log(`[自动写日记] 已保存触发间隔: ${newInterval}，起始楼层: ${currentFloor}（${characterName}）`);
  } else {
    console.log(`[自动写日记] 已禁用自动写日记功能`);
  }

  saveSettings();
}

// 更新角色的触发楼层记录
function updateLastTriggerFloor(characterName, floor) {
  const context = getContext();
  const { chatMetadata, saveMetadata } = context;
  
  // 在当前聊天的元数据中存储触发楼层
  if (!chatMetadata.sillytavernDIARY) {
    chatMetadata.sillytavernDIARY = {};
  }
  chatMetadata.sillytavernDIARY.lastTriggerFloor = floor;
  chatMetadata.sillytavernDIARY.characterName = characterName;
  // 注意：触发时间戳已在checkAndTriggerAutoDiary中设置，这里不再更新
  saveMetadata();
  
  console.log(`[自动写日记] 已更新"${characterName}"的触发楼层: ${floor}`);
}

// 更新自动写日记状态显示
function updateAutoDiaryStatus() {
  const config = getAutoDiaryConfig();
  const interval = config.interval;

  // 未启用
  if (!interval || interval <= 0) {
    $('#diary_auto_status').text('功能未启用');
    return;
  }

  // 获取当前角色名和楼层
  const context = getContext();
  const { chatMetadata } = context;
  const characterName = getCurrentCharacterName();
  const currentFloor = chat.length;
  const lastFloor = chatMetadata?.sillytavernDIARY?.lastTriggerFloor || 0;
  const remaining = interval - (currentFloor - lastFloor);

  // 根据剩余楼层数显示不同状态
  if (remaining <= 0) {
    $('#diary_auto_status').text(`已达触发条件（间隔${interval}条）`);
  } else {
    $('#diary_auto_status').text(`已启用，还需${remaining}条消息触发（间隔${interval}条）`);
  }
}

// 检查是否需要自动写日记
async function checkAndTriggerAutoDiary() {
  // 检查AI是否正在生成回复
  if (is_send_press) {
    console.log('[自动写日记] AI正在生成回复，跳过检查');
    return;
  }

  // 避免重复检查
  const currentLength = chat.length;
  if (currentLength === lastCheckedChatLength) {
    return;
  }
  lastCheckedChatLength = currentLength;

  const config = getAutoDiaryConfig();
  const interval = config.interval;

  // 未启用
  if (!interval || interval <= 0) {
    return;
  }

  // 从当前聊天的元数据中获取上次触发楼层
  const context = getContext();
  const { chatMetadata } = context;
  const characterName = getCurrentCharacterName();
  const currentFloor = chat.length;
  const lastTriggerFloor = chatMetadata?.sillytavernDIARY?.lastTriggerFloor || 0;

  // 检查冷却时间（10分钟 = 600000毫秒）
  const COOLDOWN_TIME = 10 * 60 * 1000; // 10分钟
  const lastTriggerTime = chatMetadata?.sillytavernDIARY?.lastTriggerTime || 0;
  const currentTime = Date.now();
  const timeSinceLastTrigger = currentTime - lastTriggerTime;

  if (lastTriggerTime > 0 && timeSinceLastTrigger < COOLDOWN_TIME) {
    const remainingCooldown = Math.ceil((COOLDOWN_TIME - timeSinceLastTrigger) / 1000 / 60); // 转换为分钟
    console.log(`[自动写日记] 冷却中，还需等待 ${remainingCooldown} 分钟`);
    return;
  }

  console.log(`[自动写日记] 检查触发条件 - 当前楼层:${currentFloor}, 上次触发:${lastTriggerFloor}, 间隔:${interval}`);

  // 判断是否达到触发条件
  if (currentFloor - lastTriggerFloor >= interval) {
    console.log('[自动写日记] 已达到触发条件，开始自动写日记');
    
    // 立即记录触发时间戳，开始冷却（在执行写日记之前）
    const { saveMetadata } = context;
    if (!chatMetadata.sillytavernDIARY) {
      chatMetadata.sillytavernDIARY = {};
    }
    chatMetadata.sillytavernDIARY.lastTriggerTime = Date.now();
    saveMetadata();
    console.log('[自动写日记] 已设置冷却时间，10分钟内不会再次触发');
    
    toastr.info(`自动写日记触发（${characterName}）`, '日记本');
    await triggerAutoDiary(characterName, currentFloor);
  }

  // 更新状态显示
  updateAutoDiaryStatus();
}

// 自动触发写日记（完全自动，无弹窗）
async function triggerAutoDiary(characterName, currentFloor) {
  try {
    // 第一步：检查和创建日记本世界书
    const worldbookName = DIARY_WORLDBOOK_NAME;

    if (!world_names.includes(worldbookName)) {
      console.log(`[自动写日记] 创建世界书"${worldbookName}"`);
      const success = await createNewWorldInfo(worldbookName, { interactive: false });
      if (success === false) {
        console.error('[自动写日记] 创建世界书失败');
        toastr.error('创建日记本世界书失败', '自动写日记错误');
        return;
      }
    }

    // 第二步：预设切换
    let originalPreset = null;
    let shouldRestorePreset = false;

    try {
      const result = await switchToDiaryPreset();
      originalPreset = result.originalPreset;
      shouldRestorePreset = result.switched;
    } catch (error) {
      console.error('[自动写日记] 预设切换失败，继续使用当前预设:', error);
    }

    // 第三步：发送日记命令（直接使用当前角色名，不替换{{char}}）
    const diaryPrompt =
      '以{{char}}的口吻写一则日记，日记格式为：\n［日记标题：{{标题}}］\n［日记时间：{{时间}}］\n［日记内容：{{内容}}］';

    await sendMessageAsUser(diaryPrompt, '');
    console.log('[自动写日记] 日记命令已发送');

    // 第四步：触发AI回复
    try {
      await Generate('normal');
      console.log('[自动写日记] AI回复已生成');

      // 延时恢复预设
      if (shouldRestorePreset) {
        setTimeout(async () => {
          await restoreOriginalPreset(originalPreset);
        }, 10000);
      }
    } catch (error) {
      console.error('[自动写日记] AI回复生成失败:', error);
      if (shouldRestorePreset) await restoreOriginalPreset(originalPreset);
      toastr.error('AI回复生成失败', '自动写日记错误');
      return;
    }

    // 第五步：解析日记内容
    await new Promise(resolve => setTimeout(resolve, 500));
    const latestMessage = getLatestMessage();
    if (!latestMessage) {
      toastr.error('无法获取最新消息', '自动写日记错误');
      return;
    }

    const diaryData = parseDiaryContent(latestMessage.mes);
    if (!diaryData) {
      toastr.error('未能解析出有效的日记内容', '自动写日记错误');
      return;
    }

    console.log('[自动写日记] 日记内容解析完成:', diaryData.title);

    // 第六步：保存到世界书
    const saveSuccess = await saveDiaryToWorldbook(diaryData, characterName);
    if (!saveSuccess) {
      toastr.error('保存日记到世界书失败', '自动写日记错误');
      return;
    }

    // 第七步：更新触发楼层记录
    updateLastTriggerFloor(characterName, currentFloor);

    // 第八步：自动删除消息
    await autoDeleteMessages();

    toastr.success(`自动写日记完成："${diaryData.title}"`, '日记本', { timeOut: 5000 });
    console.log('[自动写日记] 全部流程完成');
  } catch (error) {
    console.error('[自动写日记] 发生错误:', error);
    toastr.error(`自动写日记出错: ${error.message}`, '自动写日记错误');
  }
}

// ===== 主题管理功能 =====

// 当前加载的主题CSS链接元素
let currentThemeLink = null;
// 插件设置页面CSS样式链接元素
let pluginSettingsStyleLink = null;
let floatWindowStyleLink = null;
let buttonThemeStyleLink = null;

// 悬浮窗基础容器样式（独立于主题和按钮美化）
const FLOAT_WINDOW_BASE_CSS = `
/* ========== 悬浮窗基础样式 ========== */

/* 悬浮窗主容器 */
.diary-float-window {
    position: fixed;
    z-index: 99999;
    user-select: none;
    pointer-events: none;
}

.diary-float-window * {
    pointer-events: auto;
}

/* 主按钮基础容器 */
.diary-float-main-btn {
    width: auto;
    height: auto;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    padding: 4px;
}

/* 菜单容器 */
.diary-float-menu {
    position: absolute;
    top: 0;
    left: 0;
    width: 40px;
    height: 40px;
}

/* 拖拽时的样式 */
.diary-float-window.dragging {
    cursor: grabbing;
}

.diary-float-window.dragging .diary-float-main-btn {
    cursor: grabbing;
    transform: scale(0.9) rotate(-5deg);
}

.diary-float-window.dragging .diary-float-icon {
    animation: none;
    opacity: 0.8;
}
`;

// 子按钮样式（独立管理，不随主按钮美化改变）
const SUB_BUTTONS_CSS = `
/* ========== 子按钮样式 ========== */

/* 子按钮基础样式 - 纯符号设计 */
.diary-float-sub-btn {
    position: absolute;
    width: auto;
    height: auto;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    opacity: 0;
    transform: scale(0.3) translateY(10px);
    animation: diary-sub-btn-appear 0.4s ease forwards;
    padding: 6px;
}

.diary-float-sub-btn:hover {
    transform: translateY(-2px) scale(1.1);
}

.diary-float-sub-btn span {
    font-size: 24px;
    color: #6b7280;
    text-shadow:
        0 0 6px rgba(107, 114, 128, 0.4),
        0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.diary-float-sub-btn:hover span {
    color: #4b5563;
    transform: scale(1.15);
    text-shadow:
        0 0 8px rgba(75, 85, 99, 0.6),
        0 2px 6px rgba(0, 0, 0, 0.3);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
}

/* 为不同功能按钮设置特色颜色 */
.diary-float-book-btn span {
    color: #3b82f6;
}

.diary-float-book-btn:hover span {
    color: #1d4ed8;
    text-shadow:
        0 0 8px rgba(59, 130, 246, 0.6),
        0 2px 6px rgba(0, 0, 0, 0.3);
}

.diary-float-write-btn span {
    color: #f59e0b;
}

.diary-float-write-btn:hover span {
    color: #d97706;
    text-shadow:
        0 0 8px rgba(245, 158, 11, 0.6),
        0 2px 6px rgba(0, 0, 0, 0.3);
}

.diary-float-record-btn span {
    color: #10b981;
}

.diary-float-record-btn:hover span {
    color: #059669;
    text-shadow:
        0 0 8px rgba(16, 185, 129, 0.6),
        0 2px 6px rgba(0, 0, 0, 0.3);
}

/* 子按钮位置 - 围绕主按钮排列 */
.diary-float-book-btn {
    top: -40px;
    left: -8px;
    animation-delay: 0.1s;
}

.diary-float-write-btn {
    top: -25px;
    left: -45px;
    animation-delay: 0.15s;
}

.diary-float-record-btn {
    top: -25px;
    left: 30px;
    animation-delay: 0.2s;
}

/* 注释：diary-heart-pulse 动画已移除，因为默认状态不再需要跳动效果 */

/* 真实心脏跳动动画 - 1秒一次，模仿心脏节律 */
@keyframes diary-heart-beat {
    0% {
        transform: scale(1);
    }
    10% {
        transform: scale(1.15);
    }
    20% {
        transform: scale(1.08);
    }
    30% {
        transform: scale(1.18);
    }
    40% {
        transform: scale(1);
    }
    100% {
        transform: scale(1);
    }
}

/* 注释：diary-glow-pulse 动画已移除，因为默认状态不再需要光晕效果 */

/* 激活状态光晕动画 - 配合心脏跳动节奏 */
@keyframes diary-glow-active {
    0% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
    }
    10% {
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(1.3);
    }
    20% {
        opacity: 0.6;
        transform: translate(-50%, -50%) scale(1.1);
    }
    30% {
        opacity: 0.9;
        transform: translate(-50%, -50%) scale(1.4);
    }
    40%, 100% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
    }
}

/* 子按钮出现动画 - 简洁的缩放效果 */
@keyframes diary-sub-btn-appear {
    0% {
        opacity: 0;
        transform: scale(0.3) translateY(10px);
    }
    60% {
        opacity: 0.8;
        transform: scale(1.05) translateY(-1px);
    }
    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* 移动端优化 */
@media (max-width: 768px) {
    .diary-float-icon {
        font-size: 36px;
    }

    .diary-float-sub-btn {
        padding: 8px;
    }

    .diary-float-sub-btn span {
        font-size: 26px;
    }

    /* 移动端子按钮位置调整 */
    .diary-float-book-btn {
        top: -45px;
        left: -8px;
    }

    .diary-float-write-btn {
        top: -30px;
        left: -48px;
    }

    .diary-float-record-btn {
        top: -30px;
        left: 35px;
    }
}

/* 拖拽时的样式 */
.diary-float-window.dragging {
    cursor: grabbing;
}

.diary-float-window.dragging .diary-float-main-btn {
    cursor: grabbing;
    transform: scale(0.9) rotate(-5deg);
}

.diary-float-window.dragging .diary-float-icon {
    animation: none;
    opacity: 0.8;
}
`;

// 主按钮美化主题系统
const BUTTON_THEMES = {
  heart: {
    id: 'heart',
    name: '爱心',
    description: '温暖的爱心符号，会跳动的粉色心脏',
    symbol: '❤',
    css: `
/* 主按钮基础交互样式 */
.diary-float-main-btn:hover {
    transform: translateY(-3px) scale(1.1);
}

.diary-float-main-btn.diary-float-expanded {
    transform: scale(1.1);
}

.diary-float-main-btn.diary-float-expanded:hover {
    transform: translateY(-3px) scale(1.2);
}

/* 主按钮图标 - 爱心符号 */
.diary-float-icon {
    font-size: 32px;
    color: #ff6b9d;
    text-shadow:
        0 0 8px rgba(255, 107, 157, 0.6),
        0 0 16px rgba(255, 107, 157, 0.4),
        0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    filter: drop-shadow(0 0 6px rgba(255, 107, 157, 0.5));
    position: relative;
}

/* 光晕效果（仅在展开状态显示） */
.diary-float-icon::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: transparent;
    border-radius: 50%;
    z-index: -1;
    transition: all 0.3s ease;
}

.diary-float-expanded .diary-float-icon {
    color: #e91e63;
    animation: diary-heart-beat 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
    text-shadow:
        0 0 16px rgba(233, 30, 99, 0.9),
        0 0 24px rgba(233, 30, 99, 0.7),
        0 2px 4px rgba(0, 0, 0, 0.4);
}

.diary-float-expanded .diary-float-icon::before {
    background: radial-gradient(circle, rgba(233, 30, 99, 0.4) 0%, transparent 70%);
    animation: diary-glow-active 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

/* 心脏跳动动画 */
@keyframes diary-heart-beat {
    0% {
        transform: scale(1);
    }
    10% {
        transform: scale(1.15);
    }
    20% {
        transform: scale(1.08);
    }
    30% {
        transform: scale(1.18);
    }
    40% {
        transform: scale(1);
    }
    100% {
        transform: scale(1);
    }
}

/* 光晕动画 */
@keyframes diary-glow-active {
    0% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
    }
    10% {
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(1.3);
    }
    20% {
        opacity: 0.6;
        transform: translate(-50%, -50%) scale(1.1);
    }
    30% {
        opacity: 0.9;
        transform: translate(-50%, -50%) scale(1.4);
    }
    40%, 100% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
    }
}

/* 移动端优化 */
@media (max-width: 768px) {
    .diary-float-icon {
        font-size: 36px;
    }
}
        `,
  },
  star: {
    id: 'star',
    name: '星星',
    description: '闪亮的星星符号，会发出温暖的金色光芒',
    symbol: '⭐',
    css: `
/* 主按钮基础交互样式 */
.diary-float-main-btn:hover {
    transform: translateY(-3px) scale(1.1);
}

.diary-float-main-btn.diary-float-expanded {
    transform: scale(1.1);
}

.diary-float-main-btn.diary-float-expanded:hover {
    transform: translateY(-3px) scale(1.2);
}

/* 主按钮图标 - 星星符号 */
.diary-float-icon {
    font-size: 32px;
    color: #fbbf24;
    text-shadow:
        0 0 12px rgba(251, 191, 36, 0.8),
        0 0 20px rgba(251, 191, 36, 0.6),
        0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6));
    position: relative;
}

/* 光晕效果（仅在展开状态显示） */
.diary-float-icon::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: transparent;
    border-radius: 50%;
    z-index: -1;
    transition: all 0.3s ease;
}

.diary-float-expanded .diary-float-icon {
    color: #f59e0b;
    animation: diary-star-twinkle 1.5s ease-in-out infinite alternate;
    text-shadow:
        0 0 20px rgba(245, 158, 11, 1),
        0 0 30px rgba(245, 158, 11, 0.8),
        0 2px 4px rgba(0, 0, 0, 0.4);
}

.diary-float-expanded .diary-float-icon::before {
    background: radial-gradient(circle, rgba(245, 158, 11, 0.5) 0%, transparent 70%);
    animation: diary-star-glow 1.5s ease-in-out infinite alternate;
}

/* 星星闪烁动画 */
@keyframes diary-star-twinkle {
    0% {
        transform: scale(1) rotate(0deg);
    }
    50% {
        transform: scale(1.08) rotate(5deg);
    }
    100% {
        transform: scale(1.15) rotate(0deg);
    }
}

/* 星星光晕动画 */
@keyframes diary-star-glow {
    0% {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1);
    }
    100% {
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(1.4);
    }
}

/* 移动端优化 */
@media (max-width: 768px) {
    .diary-float-icon {
        font-size: 36px;
    }
}
        `,
  },
  flower: {
    id: 'flower',
    name: '花朵',
    description: '优雅的花朵符号，会360度旋转的粉紫色花朵',
    symbol: '🌸',
    css: `
/* 主按钮基础交互样式 */
.diary-float-main-btn:hover {
    transform: translateY(-3px) scale(1.1);
}

.diary-float-main-btn.diary-float-expanded {
    transform: scale(1.1);
}

.diary-float-main-btn.diary-float-expanded:hover {
    transform: translateY(-3px) scale(1.2);
}

/* 主按钮图标 - 花朵符号 */
.diary-float-icon {
    font-size: 32px;
    color: #ec4899;
    text-shadow:
        0 0 10px rgba(236, 72, 153, 0.7),
        0 0 18px rgba(236, 72, 153, 0.5),
        0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.5));
    position: relative;
}

/* 光晕效果（仅在展开状态显示） */
.diary-float-icon::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: transparent;
    border-radius: 50%;
    z-index: -1;
    transition: all 0.3s ease;
}

.diary-float-expanded .diary-float-icon {
    color: #be185d;
    animation: diary-flower-sway 3s linear infinite;
    text-shadow:
        0 0 16px rgba(190, 24, 93, 0.9),
        0 0 24px rgba(190, 24, 93, 0.7),
        0 2px 4px rgba(0, 0, 0, 0.4);
}

.diary-float-expanded .diary-float-icon::before {
    background: radial-gradient(circle, rgba(190, 24, 93, 0.4) 0%, transparent 70%);
    animation: diary-flower-bloom 2s ease-in-out infinite alternate;
}

/* 花朵旋转动画 */
@keyframes diary-flower-sway {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* 花朵绽放动画 */
@keyframes diary-flower-bloom {
    0% {
        opacity: 0.2;
        transform: translate(-50%, -50%) scale(1);
    }
    100% {
        opacity: 0.6;
        transform: translate(-50%, -50%) scale(1.2);
    }
}

/* 移动端优化 */
@media (max-width: 768px) {
    .diary-float-icon {
        font-size: 36px;
    }
}
        `,
  },
  moon: {
    id: 'moon',
    name: '月亮',
    description: '神秘的月亮符号，会散发柔和的蓝白色月光',
    symbol: '🌙',
    css: `
/* 主按钮基础交互样式 */
.diary-float-main-btn:hover {
    transform: translateY(-3px) scale(1.1);
}

.diary-float-main-btn.diary-float-expanded {
    transform: scale(1.1);
}

.diary-float-main-btn.diary-float-expanded:hover {
    transform: translateY(-3px) scale(1.2);
}

/* 主按钮图标 - 月亮符号 */
.diary-float-icon {
    font-size: 32px;
    color: #60a5fa;
    text-shadow:
        0 0 12px rgba(96, 165, 250, 0.8),
        0 0 20px rgba(96, 165, 250, 0.6),
        0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.6));
    position: relative;
}

/* 光晕效果（仅在展开状态显示） */
.diary-float-icon::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: transparent;
    border-radius: 50%;
    z-index: -1;
    transition: all 0.3s ease;
}

.diary-float-expanded .diary-float-icon {
    color: #1d4ed8;
    animation: diary-moon-phase 3s ease-in-out infinite;
    text-shadow:
        0 0 18px rgba(29, 78, 216, 0.9),
        0 0 28px rgba(29, 78, 216, 0.7),
        0 2px 4px rgba(0, 0, 0, 0.4);
}

.diary-float-expanded .diary-float-icon::before {
    background: radial-gradient(circle, rgba(29, 78, 216, 0.3) 0%, transparent 70%);
    animation: diary-moon-glow 3s ease-in-out infinite;
}

/* 月相变化动画 */
@keyframes diary-moon-phase {
    0% {
        transform: scale(1);
        opacity: 0.8;
    }
    50% {
        transform: scale(1.12);
        opacity: 1;
    }
    100% {
        transform: scale(1);
        opacity: 0.8;
    }
}

/* 月光动画 */
@keyframes diary-moon-glow {
    0% {
        opacity: 0.2;
        transform: translate(-50%, -50%) scale(1);
    }
    50% {
        opacity: 0.7;
        transform: translate(-50%, -50%) scale(1.5);
    }
    100% {
        opacity: 0.2;
        transform: translate(-50%, -50%) scale(1);
    }
}

/* 移动端优化 */
@media (max-width: 768px) {
    .diary-float-icon {
        font-size: 36px;
    }
}
        `,
  },
};

// 插件设置页面通用样式（独立于主题）
const PLUGIN_SETTINGS_CSS = `
/* ========== 插件设置页面简洁分栏样式 ========== */
/* 该部分样式独立于主题，确保在任何主题下设置页面样式保持一致 */

/* 主要设置容器 */
.diary-plugin-settings {
    margin: 10px 0;
}

/* ========== 分栏导航样式 ========== */

/* 分栏容器 */
.diary-tabs-container {
    background: linear-gradient(135deg, rgba(176, 196, 222, 0.08), rgba(100, 149, 237, 0.06));
    border-radius: 8px;
    border: 1px solid rgba(176, 196, 222, 0.2);
}

/* 分栏导航栏 */
.diary-tabs-nav {
    display: flex;
    background: rgba(100, 149, 237, 0.05);
    border-bottom: 1px solid rgba(176, 196, 222, 0.15);
    padding: 4px;
    gap: 2px;
}

/* 分栏按钮 */
.diary-tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.diary-tab-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(176, 196, 222, 0.12);
}

.diary-tab-btn.active {
    color: #fff;
    background: rgba(100, 149, 237, 0.2);
}

.diary-tab-text {
    font-weight: 600;
}

/* ========== 分栏内容样式 ========== */

/* 分栏内容容器 */
.diary-tabs-content {
    padding: 16px;
}

/* 分栏面板 */
.diary-tab-pane {
    display: none;
}

.diary-tab-pane.active {
    display: block;
}

/* 分栏标题区域 */
.diary-tab-header {
    margin-bottom: 20px;
    padding: 12px;
    background: rgba(176, 196, 222, 0.08);
    border-radius: 6px;
    border: 1px solid rgba(100, 149, 237, 0.15);
}

.diary-tab-header h3 {
    margin: 0 0 6px 0;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
}

.diary-tab-header p {
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
}

/* ========== 配置组样式 ========== */

/* 配置组 */
.diary-config-group {
    margin-bottom: 20px;
    background: rgba(176, 196, 222, 0.06);
    border-radius: 6px;
    padding: 16px;
    border: 1px solid rgba(100, 149, 237, 0.12);
}

.diary-config-group h4 {
    margin: 0 0 12px 0;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(100, 149, 237, 0.2);
}

/* 配置项 */
.diary-config-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    margin: 10px 0;
}

.diary-config-item:last-child {
    margin-bottom: 0;
}

/* 配置标签 */
.diary-config-label {
    flex: 1;
    margin-right: 12px;
}

.diary-config-title {
    display: block;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 2px;
}

.diary-config-desc {
    display: block;
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    line-height: 1.3;
}

/* 配置值 */
.diary-config-value {
    flex-shrink: 0;
}

/* 配置徽章 */
.diary-config-badge {
    display: inline-block;
    padding: 4px 8px;
    background: rgba(100, 149, 237, 0.25);
    color: #fff;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
}

/* 主题描述特殊样式 */
.diary-theme-desc {
    padding-top: 0;
    border-bottom: none;
}

.diary-theme-description {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-style: italic;
    line-height: 1.4;
}

/* 预设状态特殊样式 */
.diary-preset-status {
    padding-top: 0;
    border-bottom: none;
}

.diary-preset-info {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-style: italic;
}

/* ========== 表单控件样式 ========== */

/* 选择框 */
.diary-select {
    padding: 6px 10px;
    background: rgba(176, 196, 222, 0.12);
    border: 1px solid rgba(100, 149, 237, 0.3);
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    min-width: 120px;
    transition: all 0.2s ease;
}

.diary-select:focus {
    outline: none;
    border-color: rgba(100, 149, 237, 0.5);
    background: rgba(176, 196, 222, 0.18);
}

.diary-select option {
    background: #2d3748;
    color: #fff;
}

/* ========== 按钮样式 ========== */

/* 基础按钮 */
.diary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

/* 主要按钮 */
.diary-btn-primary {
    background: rgba(102, 126, 234, 0.8);
    color: #fff;
}

.diary-btn-primary:hover {
    background: rgba(102, 126, 234, 1);
}

/* 次要按钮 */
.diary-btn-secondary {
    background: rgba(176, 196, 222, 0.15);
    color: #fff;
    border: 1px solid rgba(100, 149, 237, 0.3);
}

.diary-btn-secondary:hover {
    background: rgba(176, 196, 222, 0.22);
}

/* 信息按钮 */
.diary-btn-info {
    background: rgba(49, 130, 206, 0.8);
    color: #fff;
}

.diary-btn-info:hover {
    background: rgba(49, 130, 206, 1);
}

/* ========== 帮助内容样式 ========== */

/* 帮助内容容器 */
.diary-help-content {
    background: rgba(176, 196, 222, 0.04);
    border-radius: 6px;
    padding: 16px;
    border: 1px solid rgba(100, 149, 237, 0.08);
}

/* 帮助章节 */
.diary-help-section {
    margin-bottom: 16px;
}

.diary-help-section:last-child {
    margin-bottom: 0;
}

.diary-help-section h5 {
    margin: 0 0 8px 0;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
}

.diary-help-section ul {
    margin: 0;
    padding-left: 16px;
    color: rgba(255, 255, 255, 0.7);
}

.diary-help-section li {
    margin-bottom: 4px;
    font-size: 12px;
    line-height: 1.4;
}

.diary-help-section li:last-child {
    margin-bottom: 0;
}

.diary-help-section strong {
    color: #fff;
    font-weight: 600;
}

/* ========== 响应式设计 ========== */

/* 移动设备 */
@media (max-width: 768px) {
    .diary-tabs-nav {
        flex-direction: row;
        gap: 1px;
        padding: 3px;
    }

    .diary-tab-btn {
        flex: 1;
        padding: 10px 4px;
        justify-content: center;
        font-size: 11px;
        min-width: 0;
    }

    .diary-tab-text {
        font-weight: 500;
    }

    .diary-config-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 0;
    }

    .diary-config-label {
        margin-right: 0;
    }

    .diary-config-value {
        width: 100%;
    }

    .diary-select, .diary-btn {
        width: 100%;
    }
}

/* 超小屏幕设备优化 */
@media (max-width: 480px) {
    .diary-tab-btn {
        padding: 8px 2px;
        font-size: 10px;
    }

    .diary-tab-text {
        font-weight: 500;
    }

    .diary-tabs-content {
        padding: 12px;
    }

    .diary-config-group {
        padding: 12px;
    }
}

/* 抽屉展开状态的额外样式 */
.inline-drawer-content .diary-plugin-settings {
    padding: 5px 0;
}

/* ========== 深色字体主题 ========== */
/* 为提高在浅色背景下的可读性，提供深色字体选项 */

.diary-plugin-settings.dark-font .diary-tab-btn {
    color: rgba(26, 32, 44, 0.7);
}

.diary-plugin-settings.dark-font .diary-tab-btn:hover {
    color: rgba(26, 32, 44, 0.9);
}

.diary-plugin-settings.dark-font .diary-tab-btn.active {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-tab-header h3 {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-tab-header p {
    color: rgba(26, 32, 44, 0.6);
}

.diary-plugin-settings.dark-font .diary-config-group h4 {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-config-title {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-config-desc {
    color: rgba(26, 32, 44, 0.5);
}

.diary-plugin-settings.dark-font .diary-config-badge {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-theme-description {
    color: rgba(26, 32, 44, 0.6);
}

.diary-plugin-settings.dark-font .diary-preset-info {
    color: rgba(26, 32, 44, 0.6);
}

.diary-plugin-settings.dark-font .diary-select {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-btn-secondary {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-help-section h5 {
    color: #1a202c;
}

.diary-plugin-settings.dark-font .diary-help-section ul {
    color: rgba(26, 32, 44, 0.7);
}

.diary-plugin-settings.dark-font .diary-help-section strong {
    color: #1a202c;
}

/* ========== 字体颜色设置区域特殊样式 ========== */
/* 字体颜色设置区域显示与当前设置相反的颜色，方便用户对比和修改 */

/* 当前为浅色字体时，字体颜色设置区域显示深色字体 */
.diary-plugin-settings:not(.dark-font) .diary-font-color-group h4 {
    color: #1a202c;
}

.diary-plugin-settings:not(.dark-font) .diary-font-color-group .diary-config-title {
    color: #1a202c;
}

.diary-plugin-settings:not(.dark-font) .diary-font-color-group .diary-config-desc {
    color: rgba(26, 32, 44, 0.6);
}

.diary-plugin-settings:not(.dark-font) .diary-font-color-group .diary-theme-description {
    color: rgba(26, 32, 44, 0.7);
}

.diary-plugin-settings:not(.dark-font) .diary-font-color-group .diary-select {
    color: #1a202c;
}

/* 当前为深色字体时，字体颜色设置区域显示浅色字体 */
.diary-plugin-settings.dark-font .diary-font-color-group h4 {
    color: #fff !important;
}

.diary-plugin-settings.dark-font .diary-font-color-group .diary-config-title {
    color: #fff !important;
}

.diary-plugin-settings.dark-font .diary-font-color-group .diary-config-desc {
    color: rgba(255, 255, 255, 0.6) !important;
}

.diary-plugin-settings.dark-font .diary-font-color-group .diary-theme-description {
    color: rgba(255, 255, 255, 0.7) !important;
}

.diary-plugin-settings.dark-font .diary-font-color-group .diary-select {
    color: #fff !important;
}

/* ========== 使用帮助页面样式 ========== */
.diary-help-header-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.diary-help-header-text {
    flex: 1;
    min-width: 0;
}

.diary-readme-btn {
    flex-shrink: 0;
    white-space: nowrap;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .diary-help-header-wrapper {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }

    .diary-readme-btn {
        width: 100%;
        margin-top: 8px;
    }
}

/* ========== README文档阅读弹窗样式 ========== */
.diary-readme-dialog {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.diary-readme-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    position: relative;
    margin: auto;
}

.diary-readme-header {
    padding: 20px 24px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}

.diary-readme-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
}

.diary-readme-close {
    background: none;
    border: none;
    font-size: 28px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
}

.diary-readme-close:hover {
    background-color: #f5f5f5;
    color: #333;
}

.diary-readme-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.diary-readme-content-text {
    line-height: 1.8;
    color: #333;
    font-size: 14px;
}

.diary-readme-loading {
    text-align: center;
    padding: 40px;
    color: #999;
    font-size: 16px;
}

/* Markdown样式 */
.diary-readme-content-text h1,
.diary-readme-content-text h2,
.diary-readme-content-text h3 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    color: #222;
    line-height: 1.25;
}

.diary-readme-content-text h1 {
    font-size: 28px;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 12px;
}

.diary-readme-content-text h2 {
    font-size: 22px;
    border-bottom: 1px solid #e8e8e8;
    padding-bottom: 8px;
}

.diary-readme-content-text h3 {
    font-size: 18px;
}

.diary-readme-content-text h4 {
    font-size: 16px;
    margin-top: 16px;
    margin-bottom: 12px;
    color: #333;
}

.diary-readme-content-text p {
    margin: 12px 0;
}

.diary-readme-content-text ul,
.diary-readme-content-text ol {
    margin: 12px 0;
    padding-left: 24px;
}

.diary-readme-content-text li {
    margin: 6px 0;
}

.diary-readme-content-text code {
    background-color: #f6f8fa;
    border-radius: 3px;
    padding: 2px 6px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    color: #e83e8c;
}

.diary-readme-content-text pre {
    background-color: #f6f8fa;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    margin: 16px 0;
}

.diary-readme-content-text pre code {
    background: none;
    padding: 0;
    color: #333;
}

.diary-readme-content-text blockquote {
    border-left: 4px solid #ddd;
    padding-left: 16px;
    margin: 16px 0;
    color: #666;
    font-style: italic;
}

.diary-readme-content-text table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
}

.diary-readme-content-text th,
.diary-readme-content-text td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
}

.diary-readme-content-text th {
    background-color: #f6f8fa;
    font-weight: 600;
}

.diary-readme-content-text hr {
    border: none;
    border-top: 2px solid #e0e0e0;
    margin: 24px 0;
}

.diary-readme-content-text a {
    color: #0366d6;
    text-decoration: none;
}

.diary-readme-content-text a:hover {
    text-decoration: underline;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .diary-readme-content {
        width: 95%;
        max-height: 90vh;
        border-radius: 8px;
    }

    .diary-readme-header {
        padding: 16px;
    }

    .diary-readme-title {
        font-size: 18px;
    }

    .diary-readme-body {
        padding: 16px;
    }

    .diary-readme-content-text {
        font-size: 13px;
    }
}

/* ========== 作者信息样式 ========== */
.diary-author-info {
    background: linear-gradient(135deg, rgba(100, 149, 237, 0.1), rgba(176, 196, 222, 0.08));
    border: 1px solid rgba(100, 149, 237, 0.2);
}

.diary-author-content {
    padding: 8px 0;
}

.diary-author-item {
    display: flex;
    align-items: baseline;
    padding: 6px 0;
    font-size: 12px;
}

.diary-author-label {
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
    min-width: 80px;
}

.diary-author-value {
    color: rgba(255, 255, 255, 0.9);
}

.diary-author-name {
    font-weight: 600;
    color: #fff;
    text-shadow: 0 0 8px rgba(100, 149, 237, 0.3);
}

.diary-author-link {
    color: rgba(102, 126, 234, 0.95);
    text-decoration: none;
    transition: all 0.2s ease;
}

.diary-author-link:hover {
    color: rgba(102, 126, 234, 1);
    text-decoration: underline;
}

.diary-copyright-notice {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(100, 149, 237, 0.15);
}

.diary-copyright-notice p {
    margin: 6px 0;
    font-size: 11px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.7);
}

.diary-copyright-notice p:first-child {
    color: rgba(255, 200, 100, 0.9);
    font-weight: 600;
    font-size: 12px;
}

.diary-copyright-notice strong {
    color: rgba(255, 255, 255, 0.9);
}

/* 深色字体主题下的作者信息样式 */
.diary-plugin-settings.dark-font .diary-author-label {
    color: rgba(26, 32, 44, 0.6);
}

.diary-plugin-settings.dark-font .diary-author-value {
    color: rgba(26, 32, 44, 0.9);
}

.diary-plugin-settings.dark-font .diary-author-name {
    color: #1a202c;
    text-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
}

.diary-plugin-settings.dark-font .diary-copyright-notice p {
    color: rgba(26, 32, 44, 0.7);
}

.diary-plugin-settings.dark-font .diary-copyright-notice p:first-child {
    color: rgba(180, 100, 0, 0.9);
}

.diary-plugin-settings.dark-font .diary-copyright-notice strong {
    color: rgba(26, 32, 44, 0.9);
}
`;

// 加载悬浮窗按钮通用样式（独立于主题）
function loadFloatWindowStyle() {
  console.log('🎨 加载悬浮窗基础样式和子按钮样式');

  // 移除旧的悬浮窗样式（如果存在）
  if (floatWindowStyleLink) {
    floatWindowStyleLink.remove();
    floatWindowStyleLink = null;
  }

  // 创建样式元素（基础样式 + 子按钮样式）
  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'diary-float-window-css';
  style.textContent = FLOAT_WINDOW_BASE_CSS + SUB_BUTTONS_CSS;

  // 添加到head
  document.head.appendChild(style);
  floatWindowStyleLink = style;

  console.log('✅ 悬浮窗基础样式和子按钮样式已加载');
}

// 加载按钮美化主题样式
function loadButtonThemeStyle() {
  const selectedButtonTheme = extension_settings[extensionName].selectedButtonTheme || 'heart';
  console.log(`🎨 加载按钮美化主题: ${selectedButtonTheme}`);

  // 移除旧的按钮主题样式（如果存在）
  if (buttonThemeStyleLink) {
    buttonThemeStyleLink.remove();
    buttonThemeStyleLink = null;
  }

  // 获取选中的按钮主题
  const buttonTheme = BUTTON_THEMES[selectedButtonTheme];
  if (!buttonTheme) {
    console.error(`❌ 未找到按钮主题: ${selectedButtonTheme}`);
    return;
  }

  // 更新悬浮窗的符号
  const floatIcon = document.querySelector('.diary-float-icon');
  if (floatIcon) {
    floatIcon.textContent = buttonTheme.symbol;
  }

  // 创建样式元素
  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'diary-button-theme-css';
  style.textContent = buttonTheme.css;

  // 添加到head
  document.head.appendChild(style);
  buttonThemeStyleLink = style;

  console.log(`✅ 按钮美化主题 ${buttonTheme.name} 已加载`);
}

// 加载插件设置页面通用样式（独立于主题）
function loadPluginSettingsStyle() {
  console.log('🎨 加载插件设置页面通用样式');

  // 移除旧的设置样式（如果存在）
  if (pluginSettingsStyleLink) {
    pluginSettingsStyleLink.remove();
    pluginSettingsStyleLink = null;
  }

  // 创建样式元素
  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'diary-plugin-settings-css';
  style.textContent = PLUGIN_SETTINGS_CSS;

  // 添加到head
  document.head.appendChild(style);
  pluginSettingsStyleLink = style;

  console.log('✅ 插件设置页面通用样式已加载');
}

// 加载主题CSS
function loadTheme(themeId) {
  console.log(`🎨 加载主题: ${themeId}`);

  const theme = THEMES[themeId];
  if (!theme) {
    console.error(`❌ 主题不存在: ${themeId}`);
    return;
  }

  // 移除旧的主题CSS
  if (currentThemeLink) {
    currentThemeLink.remove();
    currentThemeLink = null;
  }

  // 创建新的主题CSS链接
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = `${extensionFolderPath}/${theme.cssFile}`;
  link.id = 'diary-theme-css';

  // 添加到head
  document.head.appendChild(link);
  currentThemeLink = link;

  console.log(`✅ 主题CSS已加载: ${theme.name} (${theme.cssFile})`);
}

// 切换主题
function switchTheme(themeId) {
  console.log(`🎨 切换主题: ${themeId}`);

  const theme = THEMES[themeId];
  if (!theme) {
    console.error(`❌ 主题不存在: ${themeId}`);
    toastr.error('主题不存在', '主题切换');
    return;
  }

  // 加载新主题
  loadTheme(themeId);

  // 保存设置
  const settings = getCurrentSettings();
  settings.selectedTheme = themeId;
  saveSettings();

  // 更新UI
  updateThemeUI();

  toastr.success(`已切换到 ${theme.name} 主题`, '主题切换');
}

// 初始化主题选择器
function initThemeSelector() {
  const $select = $('#diary_theme_select');
  $select.empty();

  // 添加所有主题选项
  Object.values(THEMES).forEach(theme => {
    const option = $('<option>').val(theme.id).text(theme.name);
    $select.append(option);
  });

  // 设置当前选中的主题
  const settings = getCurrentSettings();
  const currentTheme = settings.selectedTheme || 'classic';
  $select.val(currentTheme);

  // 绑定切换事件
  $select.off('change').on('change', function () {
    const themeId = $(this).val();
    switchTheme(themeId);
  });

  console.log('✅ 主题选择器初始化完成');
}

// 更新主题UI显示
function updateThemeUI() {
  const settings = getCurrentSettings();
  const currentTheme = settings.selectedTheme || 'classic';
  const theme = THEMES[currentTheme];

  if (theme) {
    // 更新选择器
    $('#diary_theme_select').val(currentTheme);

    // 更新主题描述
    $('#diary_theme_description').text(theme.description);
  }
}

// 初始化按钮美化选择器
function initButtonThemeSelector() {
  const $select = $('#diary_button_theme_select');
  $select.empty();

  // 添加所有按钮美化选项
  Object.values(BUTTON_THEMES).forEach(buttonTheme => {
    const option = $('<option>').val(buttonTheme.id).text(`${buttonTheme.symbol} ${buttonTheme.name}`);
    $select.append(option);
  });

  // 设置当前选中的按钮美化
  const settings = getCurrentSettings();
  const currentButtonTheme = settings.selectedButtonTheme || 'heart';
  $select.val(currentButtonTheme);

  // 绑定切换事件
  $select.off('change').on('change', function () {
    const buttonThemeId = $(this).val();
    switchButtonTheme(buttonThemeId);
  });

  console.log('✅ 按钮美化选择器初始化完成');
}

// 更新按钮美化UI显示
function updateButtonThemeUI() {
  const settings = getCurrentSettings();
  const currentButtonTheme = settings.selectedButtonTheme || 'heart';
  const buttonTheme = BUTTON_THEMES[currentButtonTheme];

  if (buttonTheme) {
    // 更新选择器
    $('#diary_button_theme_select').val(currentButtonTheme);

    // 更新按钮美化描述
    $('#diary_button_theme_description').text(buttonTheme.description);
  }
}

// 切换按钮美化主题
function switchButtonTheme(buttonThemeId) {
  if (!BUTTON_THEMES[buttonThemeId]) {
    console.error(`❌ 未找到按钮美化主题: ${buttonThemeId}`);
    return;
  }

  // 保存设置
  extension_settings[extensionName].selectedButtonTheme = buttonThemeId;
  saveSettingsDebounced();

  // 加载新的按钮美化
  loadButtonThemeStyle();

  // 更新UI
  updateButtonThemeUI();

  console.log(`✅ 已切换到按钮美化主题: ${BUTTON_THEMES[buttonThemeId].name}`);

  // 显示切换成功的提示
  toastr.success(`已切换到 ${BUTTON_THEMES[buttonThemeId].name} 按钮样式`, '按钮美化');
}

// 初始化字体颜色选择器
function initFontColorSelector() {
  const $select = $('#diary_font_color_select');

  // 设置当前选中的字体颜色
  const settings = getCurrentSettings();
  const currentFontColorMode = settings.fontColorMode || 'light';
  $select.val(currentFontColorMode);

  // 绑定切换事件
  $select.off('change').on('change', function () {
    const fontColorMode = $(this).val();
    switchFontColorMode(fontColorMode);
  });

  console.log('✅ 字体颜色选择器初始化完成');
}

// 更新字体颜色UI显示
function updateFontColorUI() {
  const settings = getCurrentSettings();
  const currentFontColorMode = settings.fontColorMode || 'light';

  // 更新选择器
  $('#diary_font_color_select').val(currentFontColorMode);

  // 更新字体颜色描述
  const descriptions = {
    light: '当前使用浅色字体，适合深色背景环境。本设置区域预览深色字体效果。',
    dark: '当前使用深色字体，适合浅色背景环境。本设置区域预览浅色字体效果。',
  };
  $('#diary_font_color_description').text(descriptions[currentFontColorMode]);
}

// 切换字体颜色模式
function switchFontColorMode(fontColorMode) {
  if (!['light', 'dark'].includes(fontColorMode)) {
    console.error(`❌ 无效的字体颜色模式: ${fontColorMode}`);
    return;
  }

  // 保存设置
  extension_settings[extensionName].fontColorMode = fontColorMode;
  saveSettingsDebounced();

  // 应用字体颜色
  applyFontColorMode();

  // 更新UI
  updateFontColorUI();

  console.log(`✅ 已切换到字体颜色模式: ${fontColorMode}`);

  // 显示切换成功的提示
  const modeNames = {
    light: '浅色字体',
    dark: '深色字体',
  };
  toastr.success(`已切换到 ${modeNames[fontColorMode]}`, '字体颜色');
}

// 应用字体颜色模式
function applyFontColorMode() {
  const settings = getCurrentSettings();
  const fontColorMode = settings.fontColorMode || 'light';
  const $pluginSettings = $('.diary-plugin-settings');

  // 移除旧的字体颜色类
  $pluginSettings.removeClass('dark-font');

  // 应用新的字体颜色类
  if (fontColorMode === 'dark') {
    $pluginSettings.addClass('dark-font');
  }

  console.log(`🎨 已应用字体颜色模式: ${fontColorMode}`);
}

// 加载插件设置
async function loadSettings() {
  // 初始化设置
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // 加载通用样式（独立于主题）
  loadFloatWindowStyle();
  loadPluginSettingsStyle();

  // 加载保存的主题（或使用默认主题）
  const settings = getCurrentSettings();
  const selectedTheme = settings.selectedTheme || 'classic';
  loadTheme(selectedTheme);
  console.log(`📖 已加载主题: ${THEMES[selectedTheme]?.name || selectedTheme}`);

  // 加载保存的按钮美化主题（或使用默认主题）
  const selectedButtonTheme = settings.selectedButtonTheme || 'heart';
  loadButtonThemeStyle();
  console.log(`❤ 已加载按钮美化: ${BUTTON_THEMES[selectedButtonTheme]?.name || selectedButtonTheme}`);

  // 应用字体颜色模式
  applyFontColorMode();

  // 更新UI显示
  updateSettingsUI();
}

// 更新设置界面
function updateSettingsUI() {
  const settings = getCurrentSettings();

  // 初始化主题选择器
  initThemeSelector();

  // 更新主题UI
  updateThemeUI();

  // 初始化按钮美化选择器
  initButtonThemeSelector();

  // 更新按钮美化UI
  updateButtonThemeUI();

  // 初始化字体颜色选择器
  initFontColorSelector();

  // 更新字体颜色UI
  updateFontColorUI();

  // 应用字体颜色模式
  applyFontColorMode();

  // 更新各种设置控件的状态

  // 显示当前选择的预设
  if (settings.selectedPreset) {
    $('#diary_selected_preset').text(`当前预设: ${settings.selectedPreset}`);
  } else {
    $('#diary_selected_preset').text('未选择预设');
  }

  // 加载自动写日记配置
  const autoDiaryConfig = getAutoDiaryConfig();
  $('#diary_auto_interval').val(autoDiaryConfig.interval || '');
  updateAutoDiaryStatus();

  // 绑定自动写日记输入框change事件
  $('#diary_auto_interval')
    .off('change')
    .on('change', function () {
      const value = $(this).val();
      saveAutoDiaryInterval(value);
      updateAutoDiaryStatus();
      console.log('[自动写日记] 用户修改触发间隔:', value || '0 (已禁用)');
    });
}

// 打开日记本界面
async function openDiaryBook() {
  console.log('📖 打开日记本界面...');
  closeFloatMenu();

  // 显示日记本弹窗
  showDiaryBookDialog();
}

// 显示自定义角色选择弹窗
function showCustomCharacterDialog() {
  console.log('👤 显示自定义角色选择弹窗...');

  // 获取当前角色名称作为placeholder
  const currentCharacterName = getCurrentCharacterName();

  // 显示弹窗
  $('#diary-custom-character-dialog').show();
  $('#diary-character-input').attr('placeholder', currentCharacterName);
  $('#diary-character-input').val(''); // 清空输入框
  $('#diary-character-input').focus(); // 自动聚焦到输入框
}

// 隐藏自定义角色选择弹窗
function hideCustomCharacterDialog() {
  console.log('👤 隐藏自定义角色选择弹窗...');
  $('#diary-custom-character-dialog').hide();
}

// 继续写日记流程（从弹窗发送按钮调用）
async function continueWriteDiary() {
  console.log('✏️ 继续写日记流程...');

  // 获取用户输入的自定义角色名
  const customCharacterName = $('#diary-character-input').val().trim();
  console.log('👤 用户输入的角色名:', customCharacterName || '(空，使用默认角色名)');

  // 隐藏弹窗
  hideCustomCharacterDialog();

  // 预设切换：保存当前预设并切换到日记专用预设
  let originalPreset = null;
  let shouldRestorePreset = false;

  try {
    const result = await switchToDiaryPreset();
    originalPreset = result.originalPreset;
    shouldRestorePreset = result.switched;
  } catch (error) {
    console.error('⚠️ 预设切换失败，继续使用当前预设:', error);
  }

  try {
    // 第二步：发送日记命令给AI
    console.log('📝 发送日记命令给AI...');
    toastr.info('正在发送日记命令...', '写日记');

    // 确定最终使用的角色名
    const finalCharacterName = customCharacterName || getCurrentCharacterName();
    console.log('👤 最终使用的角色名:', finalCharacterName);

    // 构建日记提示词，根据用户输入决定是否替换{{char}}
    let diaryPrompt =
      '以{{char}}的口吻写一则日记，日记格式为：\n［日记标题：{{标题}}］\n［日记时间：{{时间}}］\n［日记内容：{{内容}}］';

    if (customCharacterName) {
      // 用户输入了自定义角色名，替换{{char}}
      diaryPrompt = diaryPrompt.replace(/\{\{char\}\}/g, customCharacterName);
      console.log('✅ 已将{{char}}替换为:', customCharacterName);
      toastr.info(`使用角色名：${customCharacterName}`, '写日记');
    } else {
      // 用户未输入，保持原始{{char}}模板
      console.log('✅ 保持原始{{char}}模板');
      toastr.info(`使用角色名：${finalCharacterName}`, '写日记');
    }

    // 发送用户消息
    await sendMessageAsUser(diaryPrompt, '');
    console.log('✅ 日记命令已发送');

    // 第三步：触发AI回复
    console.log('🤖 触发AI回复...');
    toastr.info('等待AI回复日记...', '写日记');

    try {
      await Generate('normal');
      console.log('✅ AI回复生成完成');

      // 预设恢复：等待10秒后恢复原预设
      if (shouldRestorePreset) {
        console.log('⏰ 10秒后将恢复原预设...');
        setTimeout(async () => {
          await restoreOriginalPreset(originalPreset);
        }, 10000); // 10秒延时
      }

      // 第四步：解析日记内容
      console.log('🔍 开始解析最新消息中的日记内容...');
      toastr.info('正在解析日记内容...', '写日记');

      // 等待一小段时间确保消息已更新到chat数组
      await new Promise(resolve => setTimeout(resolve, 500));

      const latestMessage = getLatestMessage();
      if (!latestMessage) {
        toastr.error('无法获取最新消息', '写日记错误');
        // 如果出错，立即恢复预设
        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      const diaryData = parseDiaryContent(latestMessage.mes);
      if (!diaryData) {
        toastr.error('未能解析出有效的日记内容', '写日记错误');
        // 如果出错，立即恢复预设
        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      console.log('✅ 日记内容解析完成:', diaryData);
      toastr.success(`成功解析日记："${diaryData.title}"`, '写日记');

      // 第五步：保存到世界书
      console.log('💾 开始保存日记到世界书...');
      toastr.info('正在保存日记到世界书...', '写日记');

      const saveSuccess = await saveDiaryToWorldbook(diaryData, finalCharacterName);
      if (!saveSuccess) {
        toastr.error('保存日记到世界书失败', '写日记错误');
        // 如果出错，立即恢复预设
        if (shouldRestorePreset) {
          await restoreOriginalPreset(originalPreset);
        }
        return;
      }

      // 成功保存后自动删除最新两个楼层
      console.log('🗑️ 日记保存成功，开始自动删除楼层...');
      const deleteSuccess = await autoDeleteMessages();

      if (deleteSuccess) {
        console.log('🎉 写日记流程全部完成（包括自动删除楼层）！');
        toastr.success(`日记"${diaryData.title}"写作完成！已自动清理聊天记录`, '写日记', { timeOut: 5000 });
      } else {
        console.log('🎉 写日记流程完成（楼层删除失败或跳过）！');
        toastr.success(`日记"${diaryData.title}"写作完成！`, '写日记', { timeOut: 5000 });
      }
    } catch (error) {
      console.error('❌ AI回复生成失败:', error);
      toastr.error('AI回复生成失败，请重试', '写日记错误');
      // 如果出错，立即恢复预设
      if (shouldRestorePreset) {
        await restoreOriginalPreset(originalPreset);
      }
      return;
    }
  } catch (error) {
    console.error('❌ 写日记功能错误:', error);
    toastr.error(`写日记功能出错: ${error.message}`, '写日记错误');
    // 如果出错，立即恢复预设
    if (shouldRestorePreset) {
      await restoreOriginalPreset(originalPreset);
    }
  }
}

// 开始写日记（修改为先显示弹窗）
async function startWriteDiary() {
  console.log('✏️ 开始写日记...');
  closeFloatMenu();

  try {
    // 第一步：检查和创建日记本世界书
    const worldbookName = DIARY_WORLDBOOK_NAME;

    if (!world_names.includes(worldbookName)) {
      console.log(`📚 日记本世界书"${worldbookName}"不存在，正在创建...`);
      toastr.info(`正在创建世界书"${worldbookName}"...`, '写日记');

      const success = await createNewWorldInfo(worldbookName, { interactive: false });

      if (success === false) {
        console.error('❌ 创建日记本世界书失败');
        toastr.error('创建日记本世界书失败', '写日记错误');
        return;
      }

      console.log('✅ 日记本世界书创建成功');
      toastr.success(`世界书"${worldbookName}"创建成功`, '写日记');
    } else {
      console.log(`📚 日记本世界书"${worldbookName}"已存在，跳过创建步骤`);
    }

    // 第二步：显示自定义角色选择弹窗
    showCustomCharacterDialog();
  } catch (error) {
    console.error('❌ 写日记功能错误:', error);
    toastr.error(`写日记功能出错: ${error.message}`, '写日记错误');
  }
}

// 记录日记内容
async function recordDiary() {
  console.log('📝 记录日记内容...');
  closeFloatMenu();

  try {
    // 第一步：检查和创建日记本世界书
    const worldbookName = DIARY_WORLDBOOK_NAME;

    if (!world_names.includes(worldbookName)) {
      console.log(`📚 日记本世界书"${worldbookName}"不存在，正在创建...`);
      toastr.info(`正在创建世界书"${worldbookName}"...`, '记录');

      const success = await createNewWorldInfo(worldbookName, { interactive: false });

      if (success === false) {
        console.error('❌ 创建日记本世界书失败');
        toastr.error('创建日记本世界书失败', '记录错误');
        return;
      }

      console.log('✅ 日记本世界书创建成功');
      toastr.success(`世界书"${worldbookName}"创建成功`, '记录');
    } else {
      console.log(`📚 日记本世界书"${worldbookName}"已存在，跳过创建步骤`);
    }

    // 第二步：获取最新消息
    console.log('📨 获取最新消息...');
    toastr.info('正在获取最新消息...', '记录');

    const latestMessage = getLatestMessage();
    if (!latestMessage) {
      toastr.error('无法获取最新消息', '记录错误');
      return;
    }

    // 第三步：解析日记内容
    console.log('🔍 解析消息中的日记内容...');
    toastr.info('正在解析日记内容...', '记录');

    const diaryData = parseDiaryContent(latestMessage.mes);
    if (!diaryData) {
      toastr.error('未能在最新消息中找到有效的日记内容', '记录错误');
      return;
    }

    console.log('✅ 日记内容解析成功:', diaryData);
    toastr.success(`成功解析日记："${diaryData.title}"`, '记录');

    // 第四步：保存到世界书
    console.log('💾 保存日记到世界书...');
    toastr.info('正在保存日记到世界书...', '记录');

    const saveSuccess = await saveDiaryToWorldbook(diaryData);
    if (!saveSuccess) {
      toastr.error('保存日记到世界书失败', '记录错误');
      return;
    }

    // 成功保存后自动删除最新两个楼层
    console.log('🗑️ 日记保存成功，开始自动删除楼层...');
    const deleteSuccess = await autoDeleteMessages();

    if (deleteSuccess) {
      console.log('🎉 记录日记流程完成（包括自动删除楼层）！');
      toastr.success(`日记"${diaryData.title}"记录完成！已自动清理聊天记录`, '记录', { timeOut: 5000 });
    } else {
      console.log('🎉 记录日记流程完成（楼层删除失败或跳过）！');
      toastr.success(`日记"${diaryData.title}"记录完成！`, '记录', { timeOut: 5000 });
    }
  } catch (error) {
    console.error('❌ 记录日记功能错误:', error);
    toastr.error(`记录日记出错: ${error.message}`, '记录错误');
  }
}

// 预设配置
async function configurePresets() {
  console.log('⚙️ 打开预设配置界面...');
  showPresetDialog();
}

// 检测移动端设备
function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768 ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

// 获取最新的聊天消息
function getLatestMessage() {
  try {
    if (!chat || chat.length === 0) {
      console.warn('⚠️ 聊天记录为空');
      return null;
    }

    const latestMessage = chat[chat.length - 1];
    console.log('📨 获取到最新消息:', {
      index: chat.length - 1,
      content: latestMessage.mes ? latestMessage.mes.substring(0, 100) + '...' : '无内容',
      name: latestMessage.name || '未知发送者',
    });

    return latestMessage;
  } catch (error) {
    console.error('❌ 获取最新消息失败:', error);
    return null;
  }
}

// 解析日记内容
function parseDiaryContent(messageContent) {
  try {
    if (!messageContent || typeof messageContent !== 'string') {
      console.warn('⚠️ 消息内容为空或不是字符串');
      return null;
    }

    console.log('🔍 开始解析日记内容...');
    console.log('📝 原始消息内容:', messageContent.substring(0, 200) + '...');

    // 重置正则表达式的lastIndex
    DIARY_REGEX.lastIndex = 0;

    const matches = DIARY_REGEX.exec(messageContent);

    if (!matches) {
      console.log('❌ 未找到符合格式的日记内容');
      return null;
    }

    const title = matches[1]?.trim();
    const time = matches[2]?.trim();
    const content = matches[3]?.trim();

    console.log('🎯 解析到的日记内容:', {
      标题: title,
      时间: time,
      内容长度: content?.length || 0,
    });

    // 检查是否是模板内容，跳过保存
    if (title === '{{标题}}' || time === '{{时间}}' || content === '{{内容}}') {
      console.log('⚠️ 检测到模板内容，跳过保存');
      toastr.warning('检测到模板格式内容，请让AI生成真实的日记内容', '日记解析');
      return null;
    }

    // 验证内容有效性
    if (!title || !time || !content) {
      console.log('❌ 日记内容不完整:', { title, time, content });
      toastr.warning('日记内容不完整，请检查格式', '日记解析');
      return null;
    }

    console.log('✅ 日记内容解析成功');
    return {
      title,
      time,
      content,
    };
  } catch (error) {
    console.error('❌ 解析日记内容失败:', error);
    return null;
  }
}

// 获取当前角色名称
function getCurrentCharacterName() {
  try {
    // 优先使用name2（当前角色名称）
    if (name2 && typeof name2 === 'string' && name2.trim() !== '') {
      console.log('📝 使用name2获取角色名称:', name2);
      return name2.trim();
    }

    // 备用方法：通过getContext获取
    const context = getContext();
    if (context && context.name2) {
      console.log('📝 通过context获取角色名称:', context.name2);
      return context.name2.trim();
    }

    console.warn('⚠️ 无法获取角色名称，使用默认值');
    return 'Unknown';
  } catch (error) {
    console.error('❌ 获取角色名称失败:', error);
    return 'Unknown';
  }
}

// 自动删除最新两个楼层
async function autoDeleteMessages() {
  try {
    // 自动删除功能始终启用

    console.log('🗑️ 开始自动删除最新两个楼层...');

    // 记录删除前的楼层数量
    const messageCountBefore = chat ? chat.length : 0;
    console.log(`📊 删除前楼层数量: ${messageCountBefore}`);

    if (messageCountBefore < 2) {
      console.log('⚠️ 楼层数量不足2个，跳过删除');
      return false;
    }

    // 执行删除命令
    console.log('🔧 执行删除命令: /del 2');
    await executeSlashCommandsWithOptions('/del 2', {
      handleExecutionErrors: true,
      handleParserErrors: true,
      abortController: null,
    });

    // 等待命令执行完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查删除后的楼层数量
    const messageCountAfter = chat ? chat.length : 0;
    console.log(`📊 删除后楼层数量: ${messageCountAfter}`);

    const deletedCount = messageCountBefore - messageCountAfter;

    if (deletedCount >= 2) {
      console.log(`✅ 成功删除 ${deletedCount} 个楼层`);
      toastr.success(`已自动删除 ${deletedCount} 个聊天楼层`, '自动删除');
      return true;
    } else if (deletedCount > 0) {
      console.log(`⚠️ 只删除了 ${deletedCount} 个楼层，少于预期的2个`);
      toastr.warning(`只删除了 ${deletedCount} 个楼层`, '自动删除');
      return false;
    } else {
      console.log('❌ 删除失败，楼层数量未变化');
      toastr.error('自动删除楼层失败', '自动删除错误');
      return false;
    }
  } catch (error) {
    console.error('❌ 自动删除楼层失败:', error);
    toastr.error(`自动删除楼层失败: ${error.message}`, '自动删除错误');
    return false;
  }
}

// 保存日记到世界书
async function saveDiaryToWorldbook(diaryData, characterName = null) {
  try {
    console.log('💾 开始保存日记到世界书...');

    const worldbookName = DIARY_WORLDBOOK_NAME;

    // 如果没有传入角色名，则使用默认的角色卡名称
    const finalCharacterName = characterName || getCurrentCharacterName();
    console.log('👤 保存日记使用的角色名:', finalCharacterName);

    // 加载世界书数据
    console.log(`📚 加载世界书数据: ${worldbookName}`);
    const worldData = await loadWorldInfo(worldbookName);

    if (!worldData || !worldData.entries) {
      console.error('❌ 无法加载世界书数据');
      toastr.error('无法加载世界书数据', '保存日记错误');
      return false;
    }

    // 创建新的世界书条目
    console.log('📝 创建新的日记条目...');
    const newEntry = createWorldInfoEntry(worldbookName, worldData);

    if (!newEntry) {
      console.error('❌ 无法创建世界书条目');
      toastr.error('无法创建世界书条目', '保存日记错误');
      return false;
    }

    // 设置条目内容
    const entryName = `${diaryData.title}-${diaryData.time}`;

    // 设置条目属性
    newEntry.comment = entryName; // 条目名称
    newEntry.key = [finalCharacterName]; // 关键词：角色目录名
    newEntry.content = diaryData.content; // 条目内容：日记内容
    newEntry.enabled = true; // 启用条目

    console.log('📋 日记条目信息:', {
      UID: newEntry.uid,
      条目名称: entryName,
      关键词: finalCharacterName,
      内容长度: diaryData.content.length,
    });

    // 保存世界书
    console.log('💾 保存世界书数据...');
    await saveWorldInfo(worldbookName, worldData);

    console.log('✅ 日记保存成功');
    toastr.success(`日记"${diaryData.title}"已保存到世界书`, '保存日记');

    return true;
  } catch (error) {
    console.error('❌ 保存日记到世界书失败:', error);
    toastr.error(`保存日记失败: ${error.message}`, '保存日记错误');
    return false;
  }
}

// ===== 悬浮窗功能 =====

// 悬浮窗状态管理
const floatWindow = {
  element: null,
  isExpanded: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  startPos: { x: 0, y: 0 },
  hasMoved: false,
  lastClickTime: 0, // 防止重复触发
};

// 初始化悬浮窗（将HTML移动到body）
function createFloatWindow() {
  // 将悬浮窗从设置面板移动到body
  $('#diary-float-window').appendTo('body');
  floatWindow.element = $('#diary-float-window');

  // 恢复之前保存的位置
  restoreFloatWindowPosition();

  // 绑定悬浮窗事件
  bindFloatWindowEvents();

  console.log('✅ 悬浮窗已初始化');
}

// 绑定悬浮窗事件
function bindFloatWindowEvents() {
  const $mainBtn = $('#diary-float-main-btn');
  const $menu = $('#diary-float-menu');
  const $window = $('#diary-float-window');

  // 主按钮点击事件 - 展开/收起菜单
  // 同时监听 click 和 touchend 事件，确保移动端也能响应
  $mainBtn.on('click touchend', function (e) {
    // 如果是 touchend 并且正在拖拽，不处理
    if (e.type === 'touchend' && floatWindow.isDragging) {
      return;
    }

    // 防止短时间内重复触发（移动端 touchend 和 click 可能都触发）
    const now = Date.now();
    if (now - floatWindow.lastClickTime < 300) {
      console.log('🚫 防止重复触发');
      return;
    }
    floatWindow.lastClickTime = now;

    e.preventDefault();
    e.stopPropagation();

    // 如果刚刚发生了拖拽，不触发菜单切换
    if (floatWindow.hasMoved) {
      console.log('🚫 检测到拖拽，取消菜单切换');
      return;
    }

    console.log('👆 点击悬浮窗，切换菜单状态');
    toggleFloatMenu();
  });

  // 子按钮点击事件
  $('#diary-float-book-btn').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    openDiaryBook();
    closeFloatMenu();
  });

  $('#diary-float-write-btn').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    startWriteDiary();
    closeFloatMenu();
  });

  $('#diary-float-record-btn').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    recordDiary();
    closeFloatMenu();
  });

  // 拖拽功能
  $mainBtn.on('mousedown touchstart', function (e) {
    if (floatWindow.isExpanded) return; // 菜单展开时不允许拖拽

    floatWindow.isDragging = true;
    floatWindow.hasMoved = false;

    const clientX = e.originalEvent.clientX || e.originalEvent.touches[0].clientX;
    const clientY = e.originalEvent.clientY || e.originalEvent.touches[0].clientY;
    const rect = $window[0].getBoundingClientRect();

    // 记录拖拽偏移量和起始位置
    floatWindow.dragOffset = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    floatWindow.startPos = {
      x: clientX,
      y: clientY,
    };

    // 只在桌面端阻止默认行为，移动端需要等待确认是否真的拖拽
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
  });

  // 全局鼠标移动事件
  $(document).on('mousemove touchmove', function (e) {
    if (!floatWindow.isDragging) return;

    const clientX = e.originalEvent.clientX || e.originalEvent.touches[0].clientX;
    const clientY = e.originalEvent.clientY || e.originalEvent.touches[0].clientY;

    // 检查是否移动了足够距离
    // 移动端需要更大的阈值（15px），桌面端5px
    const moveThreshold = e.type === 'touchmove' ? 15 : 5;
    const moveDistance = Math.sqrt(
      Math.pow(clientX - floatWindow.startPos.x, 2) + Math.pow(clientY - floatWindow.startPos.y, 2),
    );

    if (moveDistance > moveThreshold) {
      floatWindow.hasMoved = true;
      // 移动端在确认拖拽后才阻止默认行为
      if (e.type === 'touchmove') {
        e.preventDefault();
      }
    }

    let newX = clientX - floatWindow.dragOffset.x;
    let newY = clientY - floatWindow.dragOffset.y;

    // 边界限制
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    const elementWidth = $window.outerWidth();
    const elementHeight = $window.outerHeight();

    newX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
    newY = Math.max(0, Math.min(newY, windowHeight - elementHeight));

    $window.css({
      left: newX + 'px',
      top: newY + 'px',
    });

    e.preventDefault();
  });

  // 全局鼠标释放事件
  $(document).on('mouseup touchend', function (e) {
    if (floatWindow.isDragging) {
      floatWindow.isDragging = false;

      // 只有在真正移动了的情况下才保存位置
      if (floatWindow.hasMoved) {
        saveFloatWindowPosition();

        // 移动端：延迟重置 hasMoved 标志，避免立即触发点击
        if (e.type === 'touchend') {
          setTimeout(() => {
            floatWindow.hasMoved = false;
          }, 300);
        }
      } else {
        // 没有移动，立即重置标志，允许点击事件触发
        floatWindow.hasMoved = false;
      }
    }
  });

  // 点击外部区域关闭菜单
  $(document).on('click', function (e) {
    if (!$(e.target).closest('#diary-float-window').length && floatWindow.isExpanded) {
      closeFloatMenu();
    }
  });
}

// 切换悬浮菜单显示状态
function toggleFloatMenu() {
  if (floatWindow.isExpanded) {
    closeFloatMenu();
  } else {
    openFloatMenu();
  }
}

// 打开悬浮菜单
function openFloatMenu() {
  $('#diary-float-menu').show();
  $('#diary-float-main-btn').addClass('diary-float-expanded');
  floatWindow.isExpanded = true;
}

// 关闭悬浮菜单
function closeFloatMenu() {
  $('#diary-float-menu').hide();
  $('#diary-float-main-btn').removeClass('diary-float-expanded');
  floatWindow.isExpanded = false;
}

// 显示/隐藏悬浮窗
function toggleFloatWindow() {
  const settings = getCurrentSettings();
  const newState = !settings.floatWindowVisible;

  extension_settings[extensionName].floatWindowVisible = newState;
  saveSettings();

  if (newState) {
    $('#diary-float-window').show();
    toastr.info('悬浮窗已显示', '日记本');
  } else {
    $('#diary-float-window').hide();
    closeFloatMenu();
    toastr.info('悬浮窗已隐藏', '日记本');
  }
}

// 重置悬浮窗位置（居中显示）
function resetFloatWindowPosition() {
  console.log('🎯 开始重置悬浮窗位置...');

  if (!floatWindow.element || floatWindow.element.length === 0) {
    console.error('❌ 悬浮窗元素不存在，无法重置位置');
    toastr.error('悬浮窗元素不存在', '重置位置');
    return;
  }

  console.log('✅ 悬浮窗元素存在，开始处理...');

  // 确保悬浮窗可见（临时显示以获取正确尺寸）
  const wasHidden = !floatWindow.element.is(':visible');
  let originalVisibility = '';

  console.log(`📋 悬浮窗当前状态: ${wasHidden ? '隐藏' : '可见'}`);

  if (wasHidden) {
    originalVisibility = floatWindow.element.css('visibility');
    floatWindow.element.css('visibility', 'hidden').show();
    console.log('👁️ 临时显示悬浮窗以获取尺寸');
  }

  // 强制重新计算布局
  floatWindow.element[0].offsetHeight;

  // 获取视窗尺寸
  const windowWidth = $(window).width();
  const windowHeight = $(window).height();

  // 获取悬浮窗元素尺寸
  let elementWidth = floatWindow.element.outerWidth(true);
  let elementHeight = floatWindow.element.outerHeight(true);

  console.log(`📏 原始元素尺寸: ${elementWidth} x ${elementHeight}`);

  // 如果无法获取正确尺寸，使用默认值
  if (elementWidth <= 0) {
    elementWidth = 60; // 悬浮按钮的大概宽度
    console.log('⚠️ 无法获取元素宽度，使用默认值:', elementWidth);
  }
  if (elementHeight <= 0) {
    elementHeight = 60; // 悬浮按钮的大概高度
    console.log('⚠️ 无法获取元素高度，使用默认值:', elementHeight);
  }

  // 计算中央位置
  const centerX = Math.max(0, Math.floor((windowWidth - elementWidth) / 2));
  const centerY = Math.max(0, Math.floor((windowHeight - elementHeight) / 2));

  console.log(`📏 视窗尺寸: ${windowWidth} x ${windowHeight}`);
  console.log(`📏 最终元素尺寸: ${elementWidth} x ${elementHeight}`);
  console.log(`🎯 计算的中央位置: (${centerX}, ${centerY})`);

  // 记录当前位置用于对比
  const currentLeft = parseInt(floatWindow.element.css('left')) || 0;
  const currentTop = parseInt(floatWindow.element.css('top')) || 0;
  console.log(`📍 当前位置: (${currentLeft}, ${currentTop})`);

  // 设置悬浮窗到中央位置
  floatWindow.element.css({
    left: centerX + 'px',
    top: centerY + 'px',
    position: 'fixed', // 确保使用固定定位
  });

  // 验证位置是否设置成功
  setTimeout(() => {
    const newLeft = parseInt(floatWindow.element.css('left')) || 0;
    const newTop = parseInt(floatWindow.element.css('top')) || 0;
    console.log(`🔍 设置后的位置: (${newLeft}, ${newTop})`);

    if (newLeft === centerX && newTop === centerY) {
      console.log('✅ 位置设置成功！');
    } else {
      console.log('⚠️ 位置设置可能未生效，期望:', `(${centerX}, ${centerY})`, '实际:', `(${newLeft}, ${newTop})`);
    }
  }, 100);

  // 恢复原始可见状态
  if (wasHidden) {
    floatWindow.element.hide().css('visibility', originalVisibility);
    console.log('已恢复原始可见状态');
  }

  // 保存新位置到设置
  extension_settings[extensionName].floatWindowPosition = {
    x: centerX,
    y: centerY,
  };
  saveSettings();

  console.log(`✅ 悬浮窗重置完成: (${centerX}, ${centerY})`);
  toastr.success('悬浮窗位置已重置到屏幕中央', '日记本');
}

// 保存悬浮窗位置
function saveFloatWindowPosition() {
  if (!floatWindow.element) return;

  const position = {
    x: parseInt(floatWindow.element.css('left')),
    y: parseInt(floatWindow.element.css('top')),
  };

  extension_settings[extensionName].floatWindowPosition = position;
  saveSettings();
}

// 恢复悬浮窗位置（从设置中恢复之前保存的位置）
function restoreFloatWindowPosition() {
  console.log('🔄 开始恢复悬浮窗位置...');

  if (!floatWindow.element || floatWindow.element.length === 0) {
    console.error('❌ 悬浮窗元素不存在，无法恢复位置');
    return;
  }

  const settings = getCurrentSettings();
  const savedPosition = settings.floatWindowPosition;

  // 如果没有保存的位置，或者位置为默认的(0,0)，则使用屏幕中央
  if (!savedPosition || (savedPosition.x === 0 && savedPosition.y === 0)) {
    console.log('📍 没有保存的位置或位置为默认值，使用屏幕中央');
    resetFloatWindowPosition();
    return;
  }

  console.log(`📍 恢复到保存的位置: (${savedPosition.x}, ${savedPosition.y})`);

  // 设置悬浮窗到保存的位置
  floatWindow.element.css({
    left: savedPosition.x + 'px',
    top: savedPosition.y + 'px',
    position: 'fixed',
  });

  // 验证位置是否在屏幕范围内，如果不在则重置到中央
  setTimeout(() => {
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    const elementWidth = floatWindow.element.outerWidth(true) || 60;
    const elementHeight = floatWindow.element.outerHeight(true) || 60;

    // 检查位置是否超出屏幕边界
    if (
      savedPosition.x < 0 ||
      savedPosition.y < 0 ||
      savedPosition.x + elementWidth > windowWidth ||
      savedPosition.y + elementHeight > windowHeight
    ) {
      console.log('⚠️ 保存的位置超出屏幕范围，重置到中央');
      resetFloatWindowPosition();
    } else {
      console.log('✅ 悬浮窗位置恢复完成');
    }
  }, 100);
}

// ===== 自定义角色弹窗功能 =====

// 初始化自定义角色选择弹窗（将HTML移动到body）
function createCustomCharacterDialog() {
  console.log('👤 初始化自定义角色选择弹窗...');

  // 将弹窗从设置面板移动到body
  $('#diary-custom-character-dialog').appendTo('body');

  console.log('✅ 自定义角色选择弹窗已初始化');
}

// 绑定自定义角色弹窗事件
function bindCustomCharacterDialogEvents() {
  console.log('👤 绑定自定义角色弹窗事件...');

  // 发送按钮点击事件
  $(document).on('click', '#diary-character-send-btn', async function (e) {
    e.preventDefault();
    console.log('✅ 点击发送按钮，继续写日记流程');

    // 继续写日记流程
    await continueWriteDiary();
  });

  // 取消按钮点击事件
  $(document).on('click', '#diary-character-cancel-btn', function (e) {
    e.preventDefault();
    console.log('❌ 点击取消按钮，中断写日记流程');

    // 隐藏弹窗
    hideCustomCharacterDialog();

    // 显示取消提示
    toastr.info('已取消写日记', '写日记');
  });

  // 关闭按钮点击事件
  $(document).on('click', '#diary-character-close-btn', function (e) {
    e.preventDefault();
    console.log('❌ 点击关闭按钮，中断写日记流程');

    // 隐藏弹窗
    hideCustomCharacterDialog();

    // 显示取消提示
    toastr.info('已取消写日记', '写日记');
  });

  // 点击弹窗外部区域关闭
  $(document).on('click', '#diary-custom-character-dialog', function (e) {
    if (e.target === this) {
      console.log('❌ 点击外部区域，中断写日记流程');

      // 隐藏弹窗
      hideCustomCharacterDialog();

      // 显示取消提示
      toastr.info('已取消写日记', '写日记');
    }
  });

  // 回车键发送
  $(document).on('keypress', '#diary-character-input', async function (e) {
    if (e.which === 13) {
      // Enter键
      e.preventDefault();
      console.log('⌨️ 按下回车键，继续写日记流程');

      // 继续写日记流程
      await continueWriteDiary();
    }
  });

  // ESC键取消
  $(document).on('keydown', function (e) {
    if (e.keyCode === 27 && $('#diary-custom-character-dialog').is(':visible')) {
      // ESC键
      console.log('⌨️ 按下ESC键，中断写日记流程');

      // 隐藏弹窗
      hideCustomCharacterDialog();

      // 显示取消提示
      toastr.info('已取消写日记', '写日记');
    }
  });

  console.log('✅ 自定义角色弹窗事件绑定完成');
}

// ===== 日记本弹窗功能 =====

// 通用视图切换函数
function switchDiaryBookView(targetViewId) {
  console.log(`🔄 切换到视图: ${targetViewId}`);

  // 隐藏所有视图
  const allViews = [
    '#diary-book-cover-view',
    '#diary-book-character-list-view',
    '#diary-book-diary-list-view',
    '#diary-book-detail-view',
  ];
  allViews.forEach(viewId => {
    $(viewId).hide();
    console.log(`🔄 隐藏视图: ${viewId}, 状态: ${$(viewId).is(':visible')}`);
  });

  // 显示目标视图
  $(targetViewId).css('display', 'block').show();

  // 验证视图状态
  allViews.forEach(viewId => {
    const isVisible = $(viewId).is(':visible');
    const displayStyle = $(viewId).css('display');
    console.log(`🔍 视图${viewId}: 可见=${isVisible}, display=${displayStyle}`);
  });

  console.log(`✅ 视图切换完成，当前活动视图: ${targetViewId}`);
}

// ==================== 预设管理功能 ====================

// 预设列表状态
const presetListState = {
  presets: [],
  currentPreset: '', // 系统当前使用的预设
  selectedPreset: null, // 用户选择的日记专用预设
  currentPage: 1,
  pageSize: 8,
  totalPages: 1,
};

// 显示预设列表弹窗
function showPresetDialog() {
  console.log('⚙️ 显示预设列表弹窗...');
  $('#diary-preset-dialog').show();
  loadPresetData();
  renderPresetList();
}

// 隐藏预设列表弹窗
function hidePresetDialog() {
  console.log('⚙️ 隐藏预设列表弹窗...');
  $('#diary-preset-dialog').hide();
}

// ===== README文档弹窗功能 =====

// 显示README文档弹窗
async function showReadmeDialog() {
  console.log('📖 打开README文档弹窗...');
  $('#diary-readme-dialog').css('display', 'flex');

  // 加载README内容
  await loadReadmeContent();
}

// 隐藏README文档弹窗
function hideReadmeDialog() {
  console.log('📖 关闭README文档弹窗...');
  $('#diary-readme-dialog').css('display', 'none');
}

// 加载README.md内容
async function loadReadmeContent() {
  const container = $('#diary-readme-content-container');

  try {
    console.log('📄 正在加载README.md文件...');
    container.html('<div class="diary-readme-loading">正在加载文档...</div>');

    // 从插件目录加载README.md文件
    const readmePath = `${extensionFolderPath}/README.md`;
    const response = await fetch(readmePath);

    if (!response.ok) {
      throw new Error(`加载失败: ${response.status}`);
    }

    const markdown = await response.text();
    console.log('✅ README.md文件加载成功');

    // 简单的Markdown转HTML（基础支持）
    const html = convertMarkdownToHTML(markdown);
    container.html(html);

    // 滚动到顶部
    container.parent().scrollTop(0);
  } catch (error) {
    console.error('❌ 加载README.md失败:', error);
    container.html(`
            <div style="text-align: center; padding: 40px; color: #999;">
                <p style="font-size: 16px; margin-bottom: 12px;">😢 文档加载失败</p>
                <p style="font-size: 14px;">错误信息: ${error.message}</p>
            </div>
        `);
  }
}

// 简单的Markdown转HTML转换器
function convertMarkdownToHTML(markdown) {
  let html = markdown;

  // 转义HTML特殊字符（在代码块外）
  const codeBlocks = [];
  html = html.replace(/```[\s\S]*?```/g, match => {
    codeBlocks.push(match);
    return `__CODEBLOCK_${codeBlocks.length - 1}__`;
  });

  const inlineCode = [];
  html = html.replace(/`[^`]+`/g, match => {
    inlineCode.push(match);
    return `__INLINECODE_${inlineCode.length - 1}__`;
  });

  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

  // 粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 无序列表
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // 有序列表
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // 水平线
  html = html.replace(/^---$/gim, '<hr>');

  // 引用
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 段落
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 清理多余的段落标签
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

  // 恢复代码块
  codeBlocks.forEach((block, i) => {
    const code = block.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, content) => {
      return `<pre><code>${content.trim()}</code></pre>`;
    });
    html = html.replace(`__CODEBLOCK_${i}__`, code);
  });

  // 恢复内联代码
  inlineCode.forEach((code, i) => {
    const content = code.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(`__INLINECODE_${i}__`, content);
  });

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
}

// 加载预设数据
async function loadPresetData() {
  try {
    console.log('📚 从预设管理器加载预设数据...');

    const presetManager = getPresetManager();

    if (!presetManager) {
      console.log('❌ 预设管理器不可用');
      presetListState.presets = [];
      presetListState.currentPreset = '未选择预设';
      presetListState.selectedPreset = null;
      return;
    }

    // 获取所有预设
    const allPresets = presetManager.getAllPresets();
    console.log('📊 获取到的预设列表:', allPresets);

    // 获取当前选中的预设（系统当前使用的预设）
    const currentPreset = presetManager.getSelectedPresetName();
    console.log('📊 系统当前预设:', currentPreset);

    // 获取用户保存的日记专用预设
    const savedPreset = extension_settings[extensionName]?.selectedPreset;
    console.log('📊 用户选择的日记预设:', savedPreset);

    // 更新状态
    presetListState.presets = allPresets || [];
    presetListState.currentPreset = currentPreset || '未选择预设';
    presetListState.selectedPreset = savedPreset || null;
    presetListState.totalPages = Math.max(1, Math.ceil(presetListState.presets.length / presetListState.pageSize));
    presetListState.currentPage = 1;

    // 更新设置页面显示
    updatePresetDisplayText();

    console.log(
      `✅ 加载完成: ${presetListState.presets.length}个预设, 系统当前: ${presetListState.currentPreset}, 日记预设: ${presetListState.selectedPreset || '未设置'}`,
    );
  } catch (error) {
    console.error('❌ 加载预设数据失败:', error);
    presetListState.presets = [];
    presetListState.currentPreset = '加载失败';
    presetListState.selectedPreset = null;
    toastr.error('加载预设列表失败', '预设管理');
  }
}

// 更新设置页面的预设显示文本
function updatePresetDisplayText() {
  const displayText = presetListState.selectedPreset
    ? `日记预设: ${presetListState.selectedPreset}`
    : '未选择日记预设（将使用系统当前预设）';
  $('#diary_selected_preset').text(displayText);
}

// 渲染预设列表
function renderPresetList() {
  console.log(`🎨 渲染预设列表 (第${presetListState.currentPage}页/${presetListState.totalPages}页)...`);

  const $grid = $('#diary-preset-grid');
  const $empty = $('#diary-preset-empty');
  const $systemPreset = $('#diary-preset-system-name');
  const $selectedPreset = $('#diary-preset-selected-name');

  // 更新系统当前预设和日记选中预设显示
  $systemPreset.text(presetListState.currentPreset);
  $selectedPreset.text(presetListState.selectedPreset || '未设置（将使用系统预设）');

  // 清空列表
  $grid.empty();

  if (presetListState.presets.length === 0) {
    $grid.hide();
    $empty.show();
    updatePresetPagination();
    return;
  }

  $empty.hide();
  $grid.show();

  const startIndex = (presetListState.currentPage - 1) * presetListState.pageSize;
  const endIndex = Math.min(startIndex + presetListState.pageSize, presetListState.presets.length);
  const currentPagePresets = presetListState.presets.slice(startIndex, endIndex);

  currentPagePresets.forEach((presetName, index) => {
    const presetCard = createPresetCard(presetName, startIndex + index);
    $grid.append(presetCard);
    console.log(`⚙️ 添加预设卡片 ${index + 1}: ${presetName}`);
  });

  updatePresetPagination();
  console.log(`✅ 渲染完成: 显示${currentPagePresets.length}个预设`);
}

// 创建预设卡片
function createPresetCard(presetName, index) {
  const isSystemCurrent = presetName === presetListState.currentPreset;
  const isSelected = presetName === presetListState.selectedPreset;

  // 样式类
  let cardClasses = 'diary-preset-item';
  if (isSelected) {
    cardClasses += ' diary-preset-item-selected';
  } else if (isSystemCurrent) {
    cardClasses += ' diary-preset-item-current';
  }

  // 徽章
  let badges = '';
  if (isSystemCurrent) {
    badges += '<span class="diary-preset-badge diary-preset-badge-current">系统当前</span>';
  }
  if (isSelected) {
    badges += '<span class="diary-preset-badge diary-preset-badge-selected">✓ 已选择</span>';
  }

  return `
        <div class="${cardClasses}" data-preset-name="${presetName}">
            <div class="diary-preset-item-info">
                <div class="diary-preset-item-name">${presetName}</div>
            </div>
            ${badges}
        </div>
    `;
}

// 更新预设列表分页信息
function updatePresetPagination() {
  const $pageInfo = $('#diary-preset-page-info');
  const $prevBtn = $('#diary-preset-prev-page');
  const $nextBtn = $('#diary-preset-next-page');

  $pageInfo.text(`第 ${presetListState.currentPage} 页，共 ${presetListState.totalPages} 页`);

  $prevBtn.prop('disabled', presetListState.currentPage === 1);
  $nextBtn.prop('disabled', presetListState.currentPage === presetListState.totalPages);
}

// 选择预设
async function selectPresetForDiary(presetName) {
  try {
    console.log(`📌 选择日记预设: ${presetName}`);

    // 更新状态
    presetListState.selectedPreset = presetName;

    // 保存到设置
    extension_settings[extensionName].selectedPreset = presetName;
    saveSettingsDebounced();

    // 更新显示
    updatePresetDisplayText();
    renderPresetList();

    // 提示用户
    toastr.success(`已选择预设: ${presetName}`, '预设设置');

    console.log(`✅ 预设选择已保存: ${presetName}`);
  } catch (error) {
    console.error('❌ 保存预设选择失败:', error);
    toastr.error('保存预设设置失败', '预设管理');
  }
}

// 取消选择预设（使用系统当前预设）
async function unselectPresetForDiary() {
  try {
    console.log('🔄 取消日记预设选择，将使用系统当前预设');

    // 更新状态
    presetListState.selectedPreset = null;

    // 保存到设置
    extension_settings[extensionName].selectedPreset = null;
    saveSettingsDebounced();

    // 更新显示
    updatePresetDisplayText();
    renderPresetList();

    // 提示用户
    toastr.info('已取消选择，写日记时将使用系统当前预设', '预设设置');

    console.log('✅ 已重置为使用系统当前预设');
  } catch (error) {
    console.error('❌ 重置预设设置失败:', error);
    toastr.error('重置预设设置失败', '预设管理');
  }
}

// 切换到日记专用预设
async function switchToDiaryPreset() {
  const result = {
    switched: false,
    originalPreset: null,
  };

  try {
    // 检查是否设置了日记专用预设
    const diaryPresetName = extension_settings[extensionName]?.selectedPreset;

    if (!diaryPresetName) {
      console.log('ℹ️ 未设置日记专用预设，使用系统当前预设');
      return result;
    }

    // 获取预设管理器
    const presetManager = getPresetManager();
    if (!presetManager) {
      console.log('⚠️ 预设管理器不可用');
      return result;
    }

    // 保存当前预设
    const currentPresetName = presetManager.getSelectedPresetName();
    console.log(`💾 当前预设: ${currentPresetName}`);

    // 检查是否已经是目标预设
    if (currentPresetName === diaryPresetName) {
      console.log(`ℹ️ 已经是目标预设: ${diaryPresetName}，无需切换`);
      return result;
    }

    // 查找日记预设的值
    const diaryPresetValue = presetManager.findPreset(diaryPresetName);
    if (!diaryPresetValue) {
      console.log(`⚠️ 未找到日记预设: ${diaryPresetName}`);
      toastr.warning(`预设"${diaryPresetName}"不存在，使用当前预设`, '预设切换');
      return result;
    }

    // 切换到日记预设
    console.log(`🔄 切换预设: ${currentPresetName} → ${diaryPresetName}`);
    presetManager.selectPreset(diaryPresetValue);

    toastr.success(`已切换到日记预设: ${diaryPresetName}`, '预设切换', { timeOut: 2000 });

    // 更新结果
    result.switched = true;
    result.originalPreset = currentPresetName;

    console.log(`✅ 预设切换成功，将在10秒后恢复到: ${currentPresetName}`);
  } catch (error) {
    console.error('❌ 切换到日记预设失败:', error);
    toastr.error('预设切换失败，使用当前预设', '预设切换');
  }

  return result;
}

// 恢复原预设
async function restoreOriginalPreset(originalPresetName) {
  try {
    if (!originalPresetName) {
      console.log('ℹ️ 无需恢复预设');
      return;
    }

    // 获取预设管理器
    const presetManager = getPresetManager();
    if (!presetManager) {
      console.log('⚠️ 预设管理器不可用，无法恢复预设');
      return;
    }

    // 查找原预设的值
    const originalPresetValue = presetManager.findPreset(originalPresetName);
    if (!originalPresetValue) {
      console.log(`⚠️ 未找到原预设: ${originalPresetName}`);
      return;
    }

    // 恢复原预设
    const currentPresetName = presetManager.getSelectedPresetName();
    console.log(`🔄 恢复预设: ${currentPresetName} → ${originalPresetName}`);

    presetManager.selectPreset(originalPresetValue);

    console.log(`✅ 预设已恢复: ${originalPresetName}`);
  } catch (error) {
    console.error('❌ 恢复原预设失败:', error);
    toastr.warning('预设恢复失败', '预设恢复');
  }
}

// ==================== 日记本浏览界面 ====================

// 显示日记本弹窗
function showDiaryBookDialog() {
  console.log('📖 显示日记本弹窗...');

  // 显示弹窗
  $('#diary-book-dialog').show();

  // 显示封面视图
  showDiaryBookCover();
}

// 隐藏日记本弹窗
function hideDiaryBookDialog() {
  console.log('📖 隐藏日记本弹窗...');
  $('#diary-book-dialog').hide();
}

// 显示日记本封面
function showDiaryBookCover() {
  console.log('📖 显示日记本封面...');

  // 使用通用视图切换
  switchDiaryBookView('#diary-book-cover-view');

  // 更新封面信息
  updateDiaryBookCover();
}

// 更新日记本封面信息
async function updateDiaryBookCover() {
  try {
    console.log('📖 更新日记本封面信息...');

    // 检查世界书是否存在
    const worldbookName = DIARY_WORLDBOOK_NAME;
    if (!world_names.includes(worldbookName)) {
      // 世界书不存在，显示空状态
      $('#diary-book-total-count').text('0');
      $('#diary-book-character-count').text('0');
      return;
    }

    // 加载世界书数据
    const worldData = await loadWorldInfo(worldbookName);
    if (!worldData || !worldData.entries) {
      $('#diary-book-total-count').text('0');
      $('#diary-book-character-count').text('0');
      return;
    }

    // 统计日记数量和角色数量
    const entries = Object.values(worldData.entries);
    const totalDiaries = entries.length;

    // 统计不同角色的数量
    const characters = new Set();
    entries.forEach(entry => {
      if (entry.key && entry.key.length > 0) {
        entry.key.forEach(keyword => characters.add(keyword));
      }
    });

    // 更新封面显示
    $('#diary-book-total-count').text(totalDiaries);
    $('#diary-book-character-count').text(characters.size);

    console.log(`📊 日记本统计: ${totalDiaries}篇日记, ${characters.size}个角色`);
  } catch (error) {
    console.error('❌ 更新日记本封面信息失败:', error);
    $('#diary-book-total-count').text('?');
    $('#diary-book-character-count').text('?');
  }
}

// 初始化预设列表弹窗（将HTML移动到body）
function createPresetDialog() {
  console.log('⚙️ 初始化预设列表弹窗...');

  // 将弹窗从设置面板移动到body
  $('#diary-preset-dialog').appendTo('body');

  console.log('✅ 预设列表弹窗已初始化');

  // 绑定事件
  bindPresetDialogEvents();
}

// 绑定预设弹窗事件
function bindPresetDialogEvents() {
  console.log('🔗 绑定预设弹窗事件...');

  // 关闭按钮
  $(document).on('click', '#diary-preset-close-btn', function () {
    console.log('❌ 点击关闭按钮');
    hidePresetDialog();
  });

  // 点击弹窗外部区域关闭
  $(document).on('click', '#diary-preset-dialog', function (e) {
    if (e.target === this) {
      console.log('❌ 点击外部区域，关闭预设列表');
      hidePresetDialog();
    }
  });

  // ESC键关闭
  $(document).on('keydown', function (e) {
    if (e.keyCode === 27 && $('#diary-preset-dialog').is(':visible')) {
      // ESC键
      console.log('⌨️ 按下ESC键，关闭预设列表');
      hidePresetDialog();
    }
  });

  // 预设卡片点击事件
  $(document).on('click', '.diary-preset-item', function () {
    const presetName = $(this).data('preset-name');
    const isCurrentlySelected = presetName === presetListState.selectedPreset;

    console.log(`👆 点击预设卡片: ${presetName}, 当前选中: ${isCurrentlySelected}`);

    // 如果点击的是已选中的预设，则取消选择
    if (isCurrentlySelected) {
      unselectPresetForDiary();
    } else {
      // 否则选择该预设
      selectPresetForDiary(presetName);
    }
  });

  // 分页按钮
  $(document).on('click', '#diary-preset-prev-page', function () {
    if (presetListState.currentPage > 1) {
      presetListState.currentPage--;
      renderPresetList();
    }
  });

  $(document).on('click', '#diary-preset-next-page', function () {
    if (presetListState.currentPage < presetListState.totalPages) {
      presetListState.currentPage++;
      renderPresetList();
    }
  });

  console.log('✅ 预设弹窗事件绑定完成');
}

// 绑定README文档弹窗事件
function bindReadmeDialogEvents() {
  console.log('🔗 绑定README文档弹窗事件...');

  // 打开按钮
  $(document).on('click', '#diary-readme-open-btn', function () {
    console.log('📖 点击打开README文档按钮');
    showReadmeDialog();
  });

  // 关闭按钮
  $(document).on('click', '#diary-readme-close-btn', function () {
    console.log('❌ 点击关闭按钮');
    hideReadmeDialog();
  });

  // 点击弹窗外部区域关闭
  $(document).on('click', '#diary-readme-dialog', function (e) {
    if (e.target === this) {
      console.log('❌ 点击外部区域，关闭README文档');
      hideReadmeDialog();
    }
  });

  // ESC键关闭
  $(document).on('keydown', function (e) {
    if (e.keyCode === 27 && $('#diary-readme-dialog').is(':visible')) {
      console.log('⌨️ 按下ESC键，关闭README文档');
      hideReadmeDialog();
    }
  });

  console.log('✅ README文档弹窗事件绑定完成');
}

// 初始化README文档弹窗（将HTML移动到body）
function createReadmeDialog() {
  console.log('📖 初始化README文档弹窗...');

  // 将弹窗移动到body
  $('#diary-readme-dialog').appendTo('body');

  console.log('✅ README文档弹窗已初始化');
}

// 初始化日记本弹窗（将HTML移动到body）
function createDiaryBookDialog() {
  console.log('📖 初始化日记本弹窗...');

  // 将弹窗从设置面板移动到body
  $('#diary-book-dialog').appendTo('body');

  console.log('✅ 日记本弹窗已初始化');
}

// 绑定日记本弹窗事件
function bindDiaryBookDialogEvents() {
  console.log('📖 绑定日记本弹窗事件...');

  // 关闭按钮点击事件
  $(document).on('click', '#diary-book-close-btn', function (e) {
    e.preventDefault();
    console.log('❌ 点击关闭按钮，关闭日记本');
    hideDiaryBookDialog();
  });

  // 点击弹窗外部区域关闭
  $(document).on('click', '#diary-book-dialog', function (e) {
    if (e.target === this) {
      console.log('❌ 点击外部区域，关闭日记本');
      hideDiaryBookDialog();
    }
  });

  // ESC键关闭
  $(document).on('keydown', function (e) {
    if (e.keyCode === 27 && $('#diary-book-dialog').is(':visible')) {
      // ESC键
      console.log('⌨️ 按下ESC键，关闭日记本');
      hideDiaryBookDialog();
    }
  });

  // 进入日记本按钮点击事件
  $(document).on('click', '#diary-book-enter-btn', function (e) {
    e.preventDefault();
    console.log('📖 点击进入日记本按钮');

    // 显示角色列表视图
    showDiaryBookCharacterList();
  });

  // 返回封面按钮点击事件
  $(document).on('click', '#diary-book-back-to-cover', function (e) {
    e.preventDefault();
    console.log('🔙 返回日记本封面');

    // 显示封面视图
    showDiaryBookCover();
  });

  // 分页按钮事件
  $(document).on('click', '#diary-book-prev-page', function (e) {
    e.preventDefault();
    console.log('⬅️ 点击上一页');
    goToPreviousCharacterPage();
  });

  $(document).on('click', '#diary-book-next-page', function (e) {
    e.preventDefault();
    console.log('➡️ 点击下一页');
    goToNextCharacterPage();
  });

  // 角色卡片点击事件
  $(document).on('click', '.diary-book-character-card', function (e) {
    e.preventDefault();
    const characterName = $(this).data('character');
    console.log(`👤 点击角色卡片: ${characterName}`);

    // 显示该角色的日记列表
    showDiaryBookDiaryList(characterName);
  });

  // 返回角色列表按钮点击事件
  $(document).on('click', '#diary-book-back-to-character-list', function (e) {
    e.preventDefault();
    console.log('🔙 返回角色列表');

    // 显示角色列表视图
    showDiaryBookCharacterList();
  });

  // 日记分页按钮事件
  $(document).on('click', '#diary-book-diary-prev-page', function (e) {
    e.preventDefault();
    console.log('⬅️ 日记列表：点击上一页');
    goToPreviousDiaryPage();
  });

  $(document).on('click', '#diary-book-diary-next-page', function (e) {
    e.preventDefault();
    console.log('➡️ 日记列表：点击下一页');
    goToNextDiaryPage();
  });

  // 日记卡片点击事件
  $(document).on('click', '.diary-book-diary-card', function (e) {
    e.preventDefault();
    const entryId = $(this).data('entry-id');
    const diaryTitle = $(this).data('diary-title');
    console.log(`📖 点击日记卡片: ${diaryTitle} (ID: ${entryId})`);

    // 显示日记详情
    showDiaryBookDetail(entryId);
  });

  // 返回日记列表按钮点击事件
  $(document).on('click', '#diary-book-back-to-diary-list', function (e) {
    e.preventDefault();
    console.log('🔙 从日记详情返回日记列表');

    // 返回到当前角色的日记列表
    if (diaryListState.currentCharacter) {
      showDiaryBookDiaryList(diaryListState.currentCharacter);
    }
  });

  // 删除日记按钮点击事件
  $(document).on('click', '#diary-book-delete-btn', async function (e) {
    e.preventDefault();
    console.log('🗑️ 点击删除日记按钮');

    // 确认删除
    const confirmDelete = confirm('确定要删除这篇日记吗？此操作无法撤销。');
    if (!confirmDelete) {
      console.log('❌ 用户取消删除');
      return;
    }

    // 执行删除
    await deleteDiary();
  });

  console.log('✅ 日记本弹窗事件绑定完成');
}

// ===== 角色列表功能 =====

// 角色列表状态
const characterListState = {
  characters: [], // 所有角色数据
  currentPage: 1, // 当前页码
  pageSize: 8, // 每页显示角色数
  totalPages: 1, // 总页数
};

// 显示角色列表视图
async function showDiaryBookCharacterList() {
  console.log('👥 显示角色列表视图...');

  // 使用通用视图切换
  switchDiaryBookView('#diary-book-character-list-view');

  // 加载角色数据
  await loadCharacterData();

  // 渲染角色列表
  renderCharacterList();
}

// 从世界书加载角色数据
async function loadCharacterData() {
  try {
    console.log('📚 从世界书加载角色数据...');

    characterListState.characters = [];

    // 检查世界书是否存在
    const worldbookName = DIARY_WORLDBOOK_NAME;
    if (!world_names.includes(worldbookName)) {
      console.log('❌ 世界书不存在，无角色数据');
      return;
    }

    // 加载世界书数据
    const worldData = await loadWorldInfo(worldbookName);
    if (!worldData || !worldData.entries) {
      console.log('❌ 世界书数据为空');
      return;
    }

    // 统计每个角色的日记数量
    const characterStats = new Map();
    const entries = Object.values(worldData.entries);

    entries.forEach(entry => {
      if (entry.key && entry.key.length > 0) {
        entry.key.forEach(keyword => {
          if (!characterStats.has(keyword)) {
            characterStats.set(keyword, {
              name: keyword,
              count: 0,
            });
          }

          const charData = characterStats.get(keyword);
          charData.count++;
        });
      }
    });

    // 转换为数组并按日记数量排序
    characterListState.characters = Array.from(characterStats.values()).sort((a, b) => b.count - a.count);

    // 计算总页数
    characterListState.totalPages = Math.max(
      1,
      Math.ceil(characterListState.characters.length / characterListState.pageSize),
    );
    characterListState.currentPage = 1;

    console.log(`📊 加载完成: ${characterListState.characters.length}个角色, ${characterListState.totalPages}页`);
  } catch (error) {
    console.error('❌ 加载角色数据失败:', error);
    characterListState.characters = [];
    characterListState.totalPages = 1;
    characterListState.currentPage = 1;
  }
}

// 渲染角色列表
function renderCharacterList() {
  console.log(`🎨 渲染角色列表 (第${characterListState.currentPage}页/${characterListState.totalPages}页)...`);

  const $grid = $('#diary-book-character-grid');
  const $empty = $('#diary-book-character-empty');

  // 清空网格
  $grid.empty();

  // 检查是否有角色数据
  if (characterListState.characters.length === 0) {
    $grid.hide();
    $empty.show();
    updateCharacterPagination();
    return;
  }

  $empty.hide();
  $grid.show();

  // 计算当前页显示的角色范围
  const startIndex = (characterListState.currentPage - 1) * characterListState.pageSize;
  const endIndex = Math.min(startIndex + characterListState.pageSize, characterListState.characters.length);
  const currentPageCharacters = characterListState.characters.slice(startIndex, endIndex);

  // 渲染角色卡片
  currentPageCharacters.forEach((character, index) => {
    const characterCard = createCharacterCard(character);
    $grid.append(characterCard);
    console.log(`🎭 添加角色卡片 ${index + 1}: ${character.name} (${character.count}篇日记)`);
  });

  // 更新分页信息
  updateCharacterPagination();

  // 调试：检查渲染结果
  console.log(`🎨 网格元素数量: ${$grid.children().length}`);
  console.log(`🎨 网格可见状态: ${$grid.is(':visible')}`);
  console.log(`🎨 网格HTML长度: ${$grid.html().length}`);

  console.log(`✅ 渲染完成: 显示${currentPageCharacters.length}个角色`);
}

// 创建角色卡片HTML
function createCharacterCard(character) {
  const avatar = character.name.charAt(0).toUpperCase();

  return `
        <div class="diary-book-character-card" data-character="${character.name}">
            <div class="diary-book-character-avatar">${avatar}</div>
            <div class="diary-book-character-info">
                <div class="diary-book-character-name">${character.name}</div>
                <div class="diary-book-character-stats">
                    <span class="diary-book-character-count">${character.count}</span>
                    <span class="diary-book-character-count-label">篇日记</span>
                </div>
            </div>
            <div class="diary-book-character-arrow">›</div>
        </div>
    `;
}

// 更新分页信息
function updateCharacterPagination() {
  console.log('📄 更新分页信息...');

  const $prevBtn = $('#diary-book-prev-page');
  const $nextBtn = $('#diary-book-next-page');
  const $pageInfo = $('#diary-book-page-info');

  // 更新页码信息
  $pageInfo.text(`第 ${characterListState.currentPage} 页，共 ${characterListState.totalPages} 页`);

  // 更新按钮状态
  $prevBtn.prop('disabled', characterListState.currentPage <= 1);
  $nextBtn.prop('disabled', characterListState.currentPage >= characterListState.totalPages);

  console.log(`📄 分页更新: ${characterListState.currentPage}/${characterListState.totalPages}`);
}

// 上一页
function goToPreviousCharacterPage() {
  if (characterListState.currentPage > 1) {
    characterListState.currentPage--;
    console.log(`⬅️ 切换到第${characterListState.currentPage}页`);
    renderCharacterList();
  }
}

// 下一页
function goToNextCharacterPage() {
  if (characterListState.currentPage < characterListState.totalPages) {
    characterListState.currentPage++;
    console.log(`➡️ 切换到第${characterListState.currentPage}页`);
    renderCharacterList();
  }
}

// ===== 日记列表功能 =====

// 日记列表状态
const diaryListState = {
  currentCharacter: '', // 当前角色名
  diaries: [], // 当前角色的所有日记
  currentPage: 1, // 当前页码
  pageSize: 8, // 每页显示日记数
  totalPages: 1, // 总页数
};

// 显示日记列表视图
async function showDiaryBookDiaryList(characterName) {
  console.log(`📚 显示${characterName}的日记列表...`);

  // 设置当前角色
  diaryListState.currentCharacter = characterName;

  // 使用通用视图切换
  switchDiaryBookView('#diary-book-diary-list-view');

  // 更新标题
  $('#diary-book-character-name').text(`${characterName}的日记`);

  // 加载该角色的日记数据
  await loadDiaryData(characterName);

  // 渲染日记列表
  renderDiaryList();
}

// 从世界书加载指定角色的日记数据
async function loadDiaryData(characterName) {
  try {
    console.log(`📚 从世界书加载${characterName}的日记数据...`);

    diaryListState.diaries = [];

    // 检查世界书是否存在
    const worldbookName = DIARY_WORLDBOOK_NAME;
    if (!world_names.includes(worldbookName)) {
      console.log('❌ 世界书不存在，无日记数据');
      return;
    }

    // 加载世界书数据
    const worldData = await loadWorldInfo(worldbookName);
    if (!worldData || !worldData.entries) {
      console.log('❌ 世界书数据为空');
      return;
    }

    // 筛选该角色的日记条目
    const entries = Object.values(worldData.entries);
    entries.forEach(entry => {
      if (entry.key && entry.key.includes(characterName)) {
        // 解析日记标题和时间 (格式: "标题-时间")
        let title = '无标题';
        let time = '未知时间';

        if (entry.comment && entry.comment.includes('-')) {
          const parts = entry.comment.split('-');
          title = parts[0].trim();
          time = parts[1].trim();
        }

        // 添加到日记列表
        diaryListState.diaries.push({
          id: entry.uid,
          title: title,
          time: time,
          content: entry.content || '',
          originalTitle: entry.comment || title,
        });
      }
    });

    // 按时间排序（最新的在前面）
    diaryListState.diaries.sort((a, b) => {
      // 简单的时间比较，实际可能需要更复杂的解析
      return b.time.localeCompare(a.time);
    });

    // 计算总页数
    diaryListState.totalPages = Math.max(1, Math.ceil(diaryListState.diaries.length / diaryListState.pageSize));
    diaryListState.currentPage = 1;

    console.log(
      `📊 加载完成: ${characterName}共有${diaryListState.diaries.length}篇日记, ${diaryListState.totalPages}页`,
    );
  } catch (error) {
    console.error(`❌ 加载${characterName}的日记数据失败:`, error);
    diaryListState.diaries = [];
    diaryListState.totalPages = 1;
    diaryListState.currentPage = 1;
  }
}

// 渲染日记列表
function renderDiaryList() {
  console.log(`🎨 渲染日记列表 (第${diaryListState.currentPage}页/${diaryListState.totalPages}页)...`);

  const $grid = $('#diary-book-diary-grid');
  const $empty = $('#diary-book-diary-empty');

  // 清空网格
  $grid.empty();

  // 检查是否有日记数据
  if (diaryListState.diaries.length === 0) {
    $grid.hide();
    $empty.show();
    updateDiaryPagination();
    return;
  }

  $empty.hide();
  $grid.show();

  // 计算当前页显示的日记范围
  const startIndex = (diaryListState.currentPage - 1) * diaryListState.pageSize;
  const endIndex = Math.min(startIndex + diaryListState.pageSize, diaryListState.diaries.length);
  const currentPageDiaries = diaryListState.diaries.slice(startIndex, endIndex);

  // 渲染日记卡片
  currentPageDiaries.forEach((diary, index) => {
    const diaryCard = createDiaryCard(diary);
    $grid.append(diaryCard);
    console.log(`📝 添加日记卡片 ${index + 1}: ${diary.title} (${diary.time})`);
  });

  // 更新分页信息
  updateDiaryPagination();

  // 调试：检查渲染结果
  console.log(`🎨 日记网格元素数量: ${$grid.children().length}`);
  console.log(`🎨 日记网格可见状态: ${$grid.is(':visible')}`);

  console.log(`✅ 渲染完成: 显示${currentPageDiaries.length}篇日记`);
}

// 创建日记卡片HTML
function createDiaryCard(diary) {
  // 截断标题（超过7个字用省略号替代）
  const truncatedTitle = truncateTitle(diary.title, 7);

  return `
        <div class="diary-book-diary-card" data-entry-id="${diary.id}" data-diary-title="${diary.title}">
            <div class="diary-book-diary-header">
                <div class="diary-book-diary-meta">
                    <div class="diary-book-diary-title" title="${diary.title}">${truncatedTitle}</div>
                    <div class="diary-book-diary-time">${diary.time}</div>
                </div>
            </div>
            <div class="diary-book-diary-arrow">›</div>
        </div>
    `;
}

// 截断标题函数
function truncateTitle(title, maxLength) {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength) + '…';
}

// 更新日记分页信息
function updateDiaryPagination() {
  console.log('📄 更新日记分页信息...');

  const $prevBtn = $('#diary-book-diary-prev-page');
  const $nextBtn = $('#diary-book-diary-next-page');
  const $pageInfo = $('#diary-book-diary-page-info');

  // 更新页码信息
  $pageInfo.text(`第 ${diaryListState.currentPage} 页，共 ${diaryListState.totalPages} 页`);

  // 更新按钮状态
  $prevBtn.prop('disabled', diaryListState.currentPage <= 1);
  $nextBtn.prop('disabled', diaryListState.currentPage >= diaryListState.totalPages);

  console.log(`📄 日记分页更新: ${diaryListState.currentPage}/${diaryListState.totalPages}`);
}

// 上一页
function goToPreviousDiaryPage() {
  if (diaryListState.currentPage > 1) {
    diaryListState.currentPage--;
    console.log(`⬅️ 日记列表切换到第${diaryListState.currentPage}页`);
    renderDiaryList();
  }
}

// 下一页
function goToNextDiaryPage() {
  if (diaryListState.currentPage < diaryListState.totalPages) {
    diaryListState.currentPage++;
    console.log(`➡️ 日记列表切换到第${diaryListState.currentPage}页`);
    renderDiaryList();
  }
}

// ===== 日记详情功能 =====

// 日记详情状态
const diaryDetailState = {
  currentEntry: null, // 当前日记条目数据
};

// 显示日记详情视图
async function showDiaryBookDetail(entryId) {
  console.log(`📖 显示日记详情: ${entryId}...`);

  try {
    // 加载日记详情数据
    const diaryData = await loadDiaryDetailData(entryId);

    if (!diaryData) {
      toastr.error('无法加载日记详情', '日记本');
      return;
    }

    // 保存当前日记数据
    diaryDetailState.currentEntry = diaryData;

    // 使用通用视图切换
    switchDiaryBookView('#diary-book-detail-view');

    // 渲染日记详情
    renderDiaryDetail(diaryData);
  } catch (error) {
    console.error('❌ 显示日记详情失败:', error);
    toastr.error('显示日记详情失败', '日记本');
  }
}

// 从世界书加载日记详情数据
async function loadDiaryDetailData(entryId) {
  try {
    console.log(`📚 从世界书加载日记详情: ${entryId}...`);

    // 检查世界书是否存在
    const worldbookName = DIARY_WORLDBOOK_NAME;
    if (!world_names.includes(worldbookName)) {
      console.log('❌ 世界书不存在');
      return null;
    }

    // 加载世界书数据
    const worldData = await loadWorldInfo(worldbookName);
    if (!worldData || !worldData.entries) {
      console.log('❌ 世界书数据为空');
      return null;
    }

    // 查找指定的日记条目
    const entry = worldData.entries[entryId];
    if (!entry) {
      console.log(`❌ 找不到日记条目: ${entryId}`);
      return null;
    }

    // 解析日记标题和时间
    let title = '无标题';
    let time = '未知时间';

    if (entry.comment && entry.comment.includes('-')) {
      const parts = entry.comment.split('-');
      title = parts[0].trim();
      time = parts[1].trim();
    }

    // 获取角色名（从关键词中）
    let characterName = '未知角色';
    if (entry.key && entry.key.length > 0) {
      characterName = entry.key[0];
    }

    const diaryData = {
      id: entry.uid,
      title: title,
      time: time,
      content: entry.content || '暂无内容',
      character: characterName,
      originalTitle: entry.comment || title,
    };

    console.log(`✅ 加载完成: 日记《${diaryData.title}》`);
    return diaryData;
  } catch (error) {
    console.error(`❌ 加载日记详情失败:`, error);
    return null;
  }
}

// 渲染日记详情
function renderDiaryDetail(diaryData) {
  console.log(`🎨 渲染日记详情: ${diaryData.title}...`);

  try {
    // 更新日记标题
    $('#diary-book-detail-title').text(diaryData.title);

    // 更新日记时间
    $('#diary-book-detail-time').text(diaryData.time);

    // 更新日记内容
    const formattedContent = formatDiaryContent(diaryData.content);
    $('#diary-book-detail-text').html(formattedContent);

    console.log(`✅ 渲染完成: 日记《${diaryData.title}》`);
  } catch (error) {
    console.error('❌ 渲染日记详情失败:', error);

    // 设置错误状态
    $('#diary-book-detail-title').text('加载失败');
    $('#diary-book-detail-time').text('');
    $('#diary-book-detail-text').text('无法显示日记内容');
  }
}

// 删除日记
async function deleteDiary() {
  try {
    if (!diaryDetailState.currentEntry) {
      console.error('❌ 没有当前日记数据');
      toastr.error('没有当前日记数据', '删除日记');
      return;
    }

    const entryId = diaryDetailState.currentEntry.id;
    const characterName = diaryDetailState.currentEntry.characterName;
    console.log(`🗑️ 删除日记: ${entryId}...`);

    // 检查世界书是否存在
    const worldbookName = DIARY_WORLDBOOK_NAME;
    if (!world_names.includes(worldbookName)) {
      console.log('❌ 世界书不存在');
      toastr.error('世界书不存在', '删除日记');
      return;
    }

    // 加载世界书数据
    const worldData = await loadWorldInfo(worldbookName);
    if (!worldData || !worldData.entries) {
      console.log('❌ 世界书数据为空');
      toastr.error('世界书数据为空', '删除日记');
      return;
    }

    // 检查条目是否存在
    if (!worldData.entries[entryId]) {
      console.log('❌ 日记条目不存在');
      toastr.error('日记条目不存在', '删除日记');
      return;
    }

    // 删除条目
    delete worldData.entries[entryId];
    console.log(`✅ 已从世界书中删除条目: ${entryId}`);

    // 保存世界书
    await saveWorldInfo(worldbookName, worldData);
    console.log('💾 世界书已保存');

    toastr.success('日记已删除', '日记本');

    // 清空当前日记状态
    diaryDetailState.currentEntry = null;

    // 返回到日记列表
    if (characterName) {
      await showDiaryBookDiaryList(characterName);
    } else {
      // 如果没有角色名，返回角色列表
      await showDiaryBookCharacterList();
    }
  } catch (error) {
    console.error('❌ 删除日记失败:', error);
    toastr.error(`删除日记失败: ${error.message}`, '删除日记');
  }
}

// 格式化日记内容（处理换行等）
function formatDiaryContent(content) {
  if (!content || content.trim().length === 0) {
    return '<p class="diary-book-detail-empty">此日记暂无内容</p>';
  }

  // 将换行符转换为HTML换行
  let formattedContent = content
    .replace(/\n\n/g, '</p><p>') // 双换行转为段落
    .replace(/\n/g, '<br>'); // 单换行转为<br>

  // 包装在段落中
  if (!formattedContent.startsWith('<p>')) {
    formattedContent = '<p>' + formattedContent;
  }
  if (!formattedContent.endsWith('</p>')) {
    formattedContent = formattedContent + '</p>';
  }

  return formattedContent;
}

// ===== 设置页面分栏切换功能 =====

// 切换分栏标签
function switchSettingsTab(targetTab) {
  console.log(`🔄 切换设置分栏: ${targetTab}`);

  try {
    // 移除所有活动状态
    $('.diary-tab-btn').removeClass('active');
    $('.diary-tab-pane').removeClass('active');

    // 设置新的活动状态
    $(`.diary-tab-btn[data-tab="${targetTab}"]`).addClass('active');
    $(`#diary-tab-${targetTab}`).addClass('active');

    console.log(`✅ 分栏切换完成: ${targetTab}`);
  } catch (error) {
    console.error(`❌ 分栏切换失败:`, error);
  }
}

// 绑定设置页面分栏事件
function bindSettingsTabEvents() {
  console.log('🔗 绑定设置页面分栏事件...');

  // 绑定分栏按钮点击事件
  $(document).on('click', '.diary-tab-btn', function (e) {
    e.preventDefault();
    e.stopPropagation();

    const targetTab = $(this).data('tab');
    if (targetTab) {
      switchSettingsTab(targetTab);
    }
  });

  // 初始化时显示第一个分栏
  switchSettingsTab('config');

  console.log('✅ 设置页面分栏事件绑定完成');
}

// ============================================================================
// 版权声明
// ============================================================================
// 作者: Etaf Cisky
// 版本: v3.3.0
// 许可证: CC BY-NC-ND 4.0
// GitHub: github.com/EtafCisky/sillytavernDIARY
// Copyright 2025 Etaf Cisky. All rights reserved.
// ============================================================================

jQuery(async () => {
  console.log('🚀 日记本插件开始初始化...');
  console.log('📖 日记本插件 (sillytavernDIARY) v3.3.0');
  console.log('作者: Etaf Cisky | 许可证: CC BY-NC-ND 4.0');

  try {
    // 加载HTML界面
    const settingsHtml = await $.get(`${extensionFolderPath}/index.html`);

    // 将设置界面添加到扩展设置面板
    $('#extensions_settings2').append(settingsHtml);

    // 绑定事件处理器

    // 绑定悬浮窗控制按钮
    $('#diary_toggle_float_window').on('click', toggleFloatWindow);
    $('#diary_reset_float_position').on('click', resetFloatWindowPosition);
    $('#diary_configure_presets').on('click', configurePresets);

    // 绑定设置页面分栏切换事件
    bindSettingsTabEvents();

    // 加载设置
    await loadSettings();

    // 加载插件设置页面通用样式（独立于主题）
    loadPluginSettingsStyle();

    // 创建悬浮窗
    createFloatWindow();

    // 创建自定义角色选择弹窗
    createCustomCharacterDialog();

    // 创建预设列表弹窗
    createPresetDialog();

    // 创建日记本弹窗
    createDiaryBookDialog();

    // 创建README文档弹窗
    createReadmeDialog();

    // 加载预设数据并更新显示
    await loadPresetData();

    // 绑定弹窗事件
    bindCustomCharacterDialogEvents();

    // 绑定日记本弹窗事件
    bindDiaryBookDialogEvents();

    // 绑定README文档弹窗事件
    bindReadmeDialogEvents();

    // 根据设置显示或隐藏悬浮窗
    const settings = getCurrentSettings();
    if (settings.floatWindowVisible) {
      $('#diary-float-window').show();
    } else {
      $('#diary-float-window').hide();
    }

    // 启动自动写日记检查定时器（每3秒检查一次）
    setInterval(() => {
      checkAndTriggerAutoDiary();
    }, 3000);
    console.log('🤖 自动写日记检查定时器已启动');

    console.log('✅ 日记本插件初始化完成');
  } catch (error) {
    console.error('❌ 日记本插件初始化失败:', error);
    toastr.error(`插件初始化失败: ${error.message}`, '日记本插件');
  }
});
