// ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
'use strict';

/**
 * 激活链路验证：用 stub 模拟 VS Code 调用 activate()，
 * 断言 setContext 按自动检测结果设置、所有模板命令都注册了。
 *
 *   node test/check-activation.js
 */

const Module = require('module');
const path = require('path');

const contexts = {};
const registered = [];
const subs = [];

const stub = {
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: () => undefined }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
    openTextDocument: async () => ({}),
  },
  extensions: { getExtension: () => undefined },
  window: {
    createOutputChannel: () => ({ append() {}, appendLine() {}, show() {}, dispose() {} }),
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: (m) => console.error('   [扩展报错]', m),
    showInputBox: async () => null,
    showTextDocument: async () => {},
  },
  commands: {
    registerCommand: (id) => {
      registered.push(id);
      return { dispose() {} };
    },
    executeCommand: (cmd, key, val) => {
      if (cmd === 'setContext') contexts[key] = val;
    },
  },
  Uri: { file: (p) => ({ fsPath: p }) },
};

const origLoad = Module._load;
Module._load = function (r) {
  if (r === 'vscode') return stub;
  return origLoad.apply(this, arguments);
};

const ext = require(path.join(__dirname, '..', 'extension.js'));
const { LANGUAGES, detect } = ext.__internals;

ext.activate({ subscriptions: subs });

const det = detect();
let fail = 0;

for (const l of LANGUAGES) {
  const key = `newProjectMenu.lang.${l.id}`;
  if (!(key in contexts)) {
    console.log(`❌ 未设置 ${key}`);
    fail++;
  } else if (contexts[key] !== det[l.id].ok) {
    console.log(`❌ ${key} = ${contexts[key]}，期望 ${det[l.id].ok}`);
    fail++;
  }
}

const anyOk = LANGUAGES.some((l) => det[l.id].ok);
if (contexts['newProjectMenu.available'] !== anyOk) {
  console.log(`❌ newProjectMenu.available 期望 ${anyOk}`);
  fail++;
}

const expectCmds = [];
for (const l of LANGUAGES) {
  for (const t of l.templates) expectCmds.push(`newProjectMenu.create.${l.id}.${t.id}`);
}
expectCmds.push('newProjectMenu.refresh');

const missing = expectCmds.filter((c) => !registered.includes(c));
if (missing.length) {
  console.log('❌ 未注册命令: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ` …共 ${missing.length} 条` : ''));
  fail++;
}

console.log('语言 / 模板菜单显隐上下文：');
let shownTemplates = 0;
for (const l of LANGUAGES) {
  const on = contexts[`newProjectMenu.lang.${l.id}`];
  if (on) shownTemplates += l.templates.length;
  const tpls = l.templates.map((t) => t.label).join(' / ');
  console.log(`  ${on ? '✅' : '⛔'} ${l.label.padEnd(11)} ${String(l.templates.length).padStart(2)} 个模板   ${on ? tpls : '（已隐藏）'}`);
}

console.log(`\nnewProjectMenu.available = ${contexts['newProjectMenu.available']}`);
console.log(`注册命令: ${registered.length} / 期望 ${expectCmds.length}`);
console.log(`菜单可见模板数: ${shownTemplates}`);
console.log(`订阅释放项: ${subs.length}`);

console.log(fail === 0 ? '\n✅ 激活链路验证通过' : `\n❌ ${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
