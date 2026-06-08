// 主题配置（可扩展）
export const THEMES = {
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


export const FLOAT_WINDOW_BASE_CSS = `
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
export const SUB_BUTTONS_CSS = `
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

.diary-float-recycle-btn span {
    color: #f59e0b;
}

.diary-float-recycle-btn:hover span {
    color: #d97706;
    text-shadow:
        0 0 8px rgba(245, 158, 11, 0.6),
        0 0 20px rgba(245, 158, 11, 0.4),
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

.diary-float-recycle-btn {
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

/* 注意：保存成功弹窗CSS样式已迁移到各个主题CSS文件中 */

/* ===== 回收站管理样式 ===== */

/* 回收站弹窗主容器 */
.diary-dialog {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.diary-dialog-content {
    background: #1a1a1a;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    min-width: 600px;
    max-width: 800px;
    max-height: 80vh;
    overflow: hidden;
    border: 1px solid #444;
}

.diary-dialog-header {
    background: #2a2a2a;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #444;
}

.diary-dialog-header h3 {
    color: #fff;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.diary-close-btn {
    background: none;
    border: none;
    color: #aaa;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.diary-close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}

.diary-dialog-body {
    padding: 20px;
    background: #1a1a1a;
    max-height: 60vh;
    overflow-y: auto;
}

/* 回收站控制按钮 */
.recycle-bin-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #444;
}

.recycle-bin-controls button {
    padding: 5px 12px;
    border: 1px solid #555;
    background: #333;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.recycle-bin-controls button:hover {
    background: #444;
}

/* 回收站列表 */
.recycle-bin-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #444;
    border-radius: 4px;
}

/* 移动端适配 - 回收站弹窗 */
@media (max-width: 768px) {
    .diary-dialog {
        height: 100vh;
        height: 100dvh;
    }

    .diary-dialog-content {
        min-width: 320px;
        margin: 20px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 40px);
    }

    .diary-dialog-body {
        max-height: calc(100vh - 200px);
        padding: 15px;
    }

    .recycle-bin-item-preview {
        max-width: 200px;
    }
}

/* 角色分组样式 */
.recycle-character-group {
    margin-bottom: 15px;
}

.recycle-character-header {
    background: #333;
    padding: 8px 12px;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    border-left: 3px solid #f59e0b;
    cursor: pointer;
    transition: background 0.2s ease;
}

.recycle-character-header:hover {
    background: #3a3a3a;
}

.recycle-character-toggle {
    color: #f59e0b;
    margin-right: 8px;
    font-size: 12px;
    transition: transform 0.2s ease;
    user-select: none;
}

.recycle-character-name {
    color: #f59e0b;
    font-weight: 600;
    font-size: 14px;
}

.recycle-character-count {
    color: #aaa;
    font-size: 12px;
}

.recycle-character-items {
    margin-left: 10px;
}

.recycle-bin-item {
    padding: 10px;
    border-bottom: 1px solid #333;
    border-left: 3px solid transparent;
    cursor: pointer;
    background: #2a2a2a;
    transition: all 0.2s ease;
}

/* 交换日记条目特殊样式 */
.exchange-diary-item {
    border-left-color: #ec4899 !important;
}

.exchange-diary-item .recycle-bin-item-header {
    background: rgba(236, 72, 153, 0.1);
}

.exchange-diary-item:hover {
    border-left-color: #f472b6 !important;
}

.recycle-bin-item:hover {
    background: #3a3a3a;
}

.recycle-bin-item:last-child {
    border-bottom: none;
}

.recycle-bin-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
}

.recycle-bin-item-name {
    font-weight: bold;
    color: #fff;
}

.recycle-bin-item-preview {
    color: #aaa;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
}

/* 回收站详情 */
.recycle-bin-detail {
    margin-top: 15px;
}

.recycle-bin-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #444;
}

.recycle-bin-detail-header h4 {
    margin: 0;
    color: #fff;
}

.recycle-bin-detail-header button {
    padding: 5px 10px;
    border: 1px solid #555;
    background: #333;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.recycle-bin-detail-header button:hover {
    background: #444;
}

.recycle-bin-detail-body textarea {
    width: 100%;
    height: 200px;
    background: #1a1a1a;
    border: 1px solid #444;
    color: #fff;
    padding: 10px;
    border-radius: 4px;
    resize: vertical;
    font-family: monospace;
    font-size: 12px;
    margin-bottom: 10px;
}

.recycle-bin-detail-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.recycle-bin-detail-actions button {
    padding: 8px 15px;
    border: 1px solid #555;
    background: #333;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.recycle-bin-detail-actions button:hover {
    background: #444;
}

/* 回收站为空时的显示 */
.recycle-bin-empty {
    text-align: center;
    padding: 40px;
    color: #666;
}

.recycle-bin-empty-icon {
    font-size: 48px;
    margin-bottom: 10px;
}


/* 修复滚动条样式 - 避免focus-visible与webkit-scrollbar冲突 */
.recycle-bin-list::-webkit-scrollbar {
    width: 8px;
}

.recycle-bin-list::-webkit-scrollbar-track {
    background: #2a2a2a;
    border-radius: 4px;
}

.recycle-bin-list::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 4px;
}

.recycle-bin-list::-webkit-scrollbar-thumb:hover {
    background: #666;
}

`;

// 主按钮美化主题系统
export const BUTTON_THEMES = {
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
export const PLUGIN_SETTINGS_CSS = `
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

/* 交换日记触发窗口输入框容器 */
.diary-exchange-trigger-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* 交换日记触发窗口输入框 */
.diary-exchange-trigger-input {
    width: 60px !important;
    min-width: 60px !important;
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

/* ========== 更新通知弹窗样式 ========== */

.diary-update-notification {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
}

.diary-update-content {
    background: #fff;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    position: relative;
    margin: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.diary-update-header {
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 18px;
    font-weight: 600;
    color: #333;
    flex-shrink: 0;
}

.diary-update-close {
    background: none;
    border: none;
    color: #999;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
}

.diary-update-close:hover {
    background: #f5f5f5;
    color: #333;
}

.diary-update-body {
    padding: 20px;
    overflow-y: auto;
    color: #666;
    font-size: 14px;
    line-height: 1.8;
    flex: 1;
    min-height: 0;
}

.diary-update-message p {
    margin: 0 0 12px 0;
}

.diary-update-message strong {
    color: #333;
}

.diary-update-message ul,
.diary-update-message ol {
    margin: 8px 0 16px 0;
    padding-left: 24px;
}

.diary-update-message li {
    margin-bottom: 6px;
}

.diary-update-footer {
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
}

.diary-update-btn {
    padding: 8px 24px;
    font-size: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: #007bff;
    color: #fff;
    transition: all 0.2s;
}

.diary-update-btn:hover {
    background: #0056b3;
}

@media (max-width: 768px) {
    .diary-update-content {
        width: 95%;
        max-height: 90vh;
    }
}
`;

