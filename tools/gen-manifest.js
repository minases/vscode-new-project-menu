// ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
'use strict';

/**
 * 由 languages.js 生成 package.json。
 *
 *   node tools/gen-manifest.js
 *
 * 规则：
 *   - 单模板语言 → 「新建项目」下直接是一个命令项
 *   - 多模板语言 → 「新建项目 ▸ 语言 ▸ 模板」嵌套子菜单
 *
 * 菜单项、命令声明、when 条件全部由语言表推导，不会出现
 * 「菜单项引用了未声明的命令」或「when 绑定错语言」这类不一致。
 */

const fs = require('fs');
const path = require('path');
const { LANGUAGES } = require('../languages');

const ROOT = path.join(__dirname, '..');
const pad = (n) => String(n).padStart(2, '0');
const cmdId = (l, t) => `newProjectMenu.create.${l.id}.${t.id}`;

const commands = [];
const langSubmenus = [];
const topItems = [];
const templateMenus = {};
const paletteItems = [];

LANGUAGES.forEach((lang, i) => {
  const ctx = `newProjectMenu.lang.${lang.id}`;
  const group = `${lang.group}@${pad(i)}`;
  const single = lang.templates.length === 1;

  if (single) {
    const t = lang.templates[0];
    const id = cmdId(lang, t);
    commands.push({ command: id, title: `创建 ${lang.label} 项目`, category: '新建项目' });
    topItems.push({ command: id, when: ctx, group });
    paletteItems.push({ command: id, when: ctx });
    return;
  }

  const subId = `newProjectMenu.menu.${lang.id}`;
  langSubmenus.push({ id: subId, label: lang.label });
  topItems.push({ submenu: subId, when: ctx, group });

  templateMenus[subId] = lang.templates.map((t, j) => {
    const id = cmdId(lang, t);
    commands.push({ command: id, title: `${lang.label}：${t.label}`, category: '新建项目' });
    paletteItems.push({ command: id, when: ctx });
    return { command: id, group: `1@${pad(j)}` };
  });
});

commands.push({ command: 'newProjectMenu.refresh', title: '重新检测已安装的语言', category: '新建项目' });
paletteItems.push({ command: 'newProjectMenu.refresh' });

const pkg = {
  name: 'new-project-menu',
  displayName: '新建项目菜单',
  description:
    '在资源管理器右键菜单中添加「新建项目」子菜单。自动检测系统已安装的语言工具链，' +
    '只为可用的语言显示菜单项，每种语言下提供多种项目模板（控制台 / 类库 / Web 接口 / 单元测试…），' +
    '并自动生成构建与调试配置。',
  version: '3.0.0',
  publisher: 'local',
  author: 'AI generated (see README)',
  license: 'MIT',
  engines: { vscode: '^1.85.0' },
  categories: ['Other'],
  main: './extension.js',
  activationEvents: ['onStartupFinished'],
  contributes: {
    configuration: {
      title: '新建项目菜单',
      properties: {
        'newProjectMenu.showAllLanguages': {
          type: 'boolean',
          default: false,
          description:
            '忽略自动检测结果，始终显示全部语言的菜单项。默认关闭——只显示系统里工具链确实可用的语言。',
        },
      },
    },
    commands,
    submenus: [{ id: 'newProjectMenu.submenu', label: '新建项目' }].concat(langSubmenus),
    menus: Object.assign(
      {
        'explorer/context': [
          { submenu: 'newProjectMenu.submenu', when: 'newProjectMenu.available', group: 'navigation@1' },
        ],
        'view/title': [
          {
            submenu: 'newProjectMenu.submenu',
            when: 'view == workbench.explorer.fileView && newProjectMenu.available',
            group: 'navigation@1',
          },
        ],
        'file/newFile': [
          { submenu: 'newProjectMenu.submenu', when: 'newProjectMenu.available', group: 'navigation@1' },
        ],
        'newProjectMenu.submenu': topItems,
        commandPalette: paletteItems,
      },
      templateMenus
    ),
  },
};

fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const total = LANGUAGES.reduce((n, l) => n + l.templates.length, 0);
console.log(
  `✅ 已生成 package.json：${LANGUAGES.length} 种语言 / ${total} 个模板 / ` +
    `${commands.length} 条命令 / ${langSubmenus.length} 个语言子菜单`
);
