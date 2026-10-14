// ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
'use strict';

/**
 * 离线冒烟测试：不需要启动 VSCode。
 * 用 stub 顶掉 require('vscode')，直接调用生成器，
 * 对**本机已安装工具链**的模板真实编译并核对运行输出。
 *
 *   node test/run-tests.js                  完整测试
 *   node test/run-tests.js --structure-only 只验证生成的文件结构（快）
 */

const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const STRUCTURE_ONLY = process.argv.includes('--structure-only');

/* ── stub vscode ── */
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
  commands: { registerCommand: () => ({ dispose() {} }), executeCommand() {} },
  Uri: { file: (p) => ({ fsPath: p }) },
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'vscode') return stub;
  return origLoad.apply(this, arguments);
};

const ROOT = path.join(__dirname, '..');
const ext = require(path.join(ROOT, 'extension.js'));
const { GENERATORS, LANGUAGES, detect, buildEnv, which } = ext.__internals;
const ENV = buildEnv();

let pass = 0;
let fail = 0;
let skip = 0;

function check(name, fn) {
  try {
    const r = fn();
    if (r === 'skip') {
      console.log('⏭  ' + name);
      skip++;
      return 'skip';
    }
    console.log('✅ ' + name);
    pass++;
    return true;
  } catch (e) {
    console.log('❌ ' + name);
    console.log('   ' + String(e.message).split('\n').join('\n   '));
    fail++;
    return false;
  }
}

const sh = (cmd, args, cwd, extraEnv) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: Object.assign({}, ENV, extraEnv || {}),
    timeout: 900000,
  });

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'npmmenu-'));
console.log('临时目录: ' + TMP);
console.log('模式: ' + (STRUCTURE_ONLY ? '仅结构' : '完整（含编译）') + '\n');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const mustExist = (dir, files) => {
  for (const f of files) {
    if (!fs.existsSync(path.join(dir, f))) throw new Error('缺少文件 ' + f);
  }
};

/* ══════════ 每个模板的期望文件与验证方式 ══════════ */

const VS = ['.vscode/tasks.json'];
const VS_L = ['.vscode/tasks.json', '.vscode/launch.json'];

const CASES = {
  /* C */
  'c.console': {
    expect: (n) => ['main.c', 'Makefile', ...VS_L],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },
  'c.lib': {
    expect: (n) => [`${n}.c`, `${n}.h`, 'Makefile', ...VS],
    run: (d, n) => {
      sh('make', [], d);
      if (!fs.existsSync(path.join(d, `lib${n}.a`))) throw new Error('未生成静态库 lib' + n + '.a');
      return 'skip-output';
    },
  },
  'c.multifile': {
    expect: () => ['main.c', 'util.c', 'util.h', 'Makefile', ...VS_L],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },

  /* C++ */
  'cpp.console': {
    expect: () => ['main.cpp', 'Makefile', ...VS_L],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },
  'cpp.class': {
    expect: () => ['main.cpp', 'Greeter.h', 'Greeter.cpp', 'Makefile', ...VS_L],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },
  'cpp.lib': {
    expect: (n) => [`${n}.cpp`, `${n}.h`, 'Makefile', ...VS],
    run: (d, n) => {
      sh('make', [], d);
      if (!fs.existsSync(path.join(d, `lib${n}.a`))) throw new Error('未生成静态库');
      return 'skip-output';
    },
  },

  /* C# */
  'csharp.console': {
    expect: (n) => [`${n}.csproj`, 'Program.cs', ...VS_L],
    run: (d, n) => sh(which('dotnet'), ['run', '--project', path.join(d, n + '.csproj')], d),
  },
  'csharp.webapi': {
    expect: (n) => [`${n}.csproj`, 'Program.cs', ...VS_L],
    buildOnly: (d, n) => sh(which('dotnet'), ['build', path.join(d, n + '.csproj')], d),
  },
  'csharp.classlib': {
    expect: (n) => [`${n}.csproj`, ...VS],
    buildOnly: (d, n) => sh(which('dotnet'), ['build', path.join(d, n + '.csproj')], d),
  },
  'csharp.xunit': {
    expect: (n) => [`${n}.csproj`, ...VS],
    buildOnly: (d, n) => sh(which('dotnet'), ['test', path.join(d, n + '.csproj')], d),
  },

  /* Java */
  'java.console': {
    expect: () => ['pom.xml', 'src/main/java/com/example/App.java', ...VS_L],
    run: (d) => {
      sh(which('javac'), ['-encoding', 'UTF-8', '-d', 'out', 'src/main/java/com/example/App.java'], d);
      return sh(which('java'), ['-cp', 'out', 'com.example.App'], d);
    },
  },
  'java.api': {
    expect: () => [
      'pom.xml',
      'src/main/java/com/example/Application.java',
      'src/main/java/com/example/HelloController.java',
      ...VS,
    ],
    pomCheck: (d) => {
      const pom = fs.readFileSync(path.join(d, 'pom.xml'), 'utf8');
      if (!pom.includes('spring-boot-starter-web')) throw new Error('pom 缺少 web starter');
      if (!pom.includes('spring-boot-maven-plugin')) throw new Error('pom 缺少 spring-boot 插件');
      const ctrl = fs.readFileSync(path.join(d, 'src/main/java/com/example/HelloController.java'), 'utf8');
      if (!ctrl.includes('@RestController')) throw new Error('HelloController 缺少 @RestController');
    },
    mvnCompile: true,
  },
  'java.lib': {
    expect: () => ['pom.xml', 'src/main/java/com/example/Calculator.java', ...VS],
    mvnCompile: true,
  },
  'java.junit': {
    expect: () => ['pom.xml', 'src/test/java/com/example/CalculatorTest.java', ...VS],
    mvnCompile: true,
  },

  /* Python */
  'python.script': {
    expect: () => ['main.py', ...VS_L],
    run: (d) => sh(which('python3'), ['main.py'], d),
  },
  'python.package': {
    expect: (n) => ['main.py', 'pyproject.toml', `src/${n}/__init__.py`, `src/${n}/core.py`, ...VS],
    run: (d) => sh(which('python3'), ['main.py'], d, { PYTHONPATH: 'src' }),
  },
  'python.fastapi': {
    expect: () => ['main.py', 'requirements.txt', ...VS_L],
    depsCheck: (d) => {
      const txt = fs.readFileSync(path.join(d, 'main.py'), 'utf8');
      if (!txt.includes('FastAPI')) throw new Error('main.py 未使用 FastAPI');
      const req = fs.readFileSync(path.join(d, 'requirements.txt'), 'utf8');
      if (!req.includes('fastapi')) throw new Error('requirements.txt 缺少 fastapi');
    },
  },
  'python.pytest': {
    expect: () => ['pyproject.toml', 'src/calculator.py', 'tests/test_calculator.py', ...VS],
    maybePytest: true,
  },

  /* JavaScript */
  'javascript.script': {
    expect: () => ['index.js', 'package.json', ...VS_L],
    run: (d) => sh(which('node'), ['index.js'], d),
  },
  'javascript.express': {
    expect: () => ['server.js', 'package.json', ...VS_L],
    depsCheck: (d) => {
      const pkg = readJson(path.join(d, 'package.json'));
      if (!pkg.dependencies || !pkg.dependencies.express) throw new Error('package.json 缺少 express 依赖');
    },
  },
  'javascript.package': {
    expect: () => ['index.js', 'package.json', 'example.js', ...VS],
    run: (d) => sh(which('node'), ['example.js'], d),
  },

  /* TypeScript */
  'typescript.console': {
    expect: () => ['src/index.ts', 'tsconfig.json', ...VS_L],
    run: (d) => {
      sh(which('tsc'), [], d);
      return sh(which('node'), ['dist/index.js'], d);
    },
  },
  'typescript.express': {
    expect: () => ['src/index.ts', 'tsconfig.json', 'package.json', ...VS_L],
    depsCheck: (d) => {
      const pkg = readJson(path.join(d, 'package.json'));
      if (!pkg.dependencies.express) throw new Error('缺少 express 依赖');
      if (!pkg.devDependencies.typescript) throw new Error('缺少 typescript 依赖');
    },
  },

  /* Go */
  'go.cli': {
    expect: () => ['go.mod', 'main.go', ...VS_L],
    run: (d) => sh(which('go'), ['run', '.'], d),
  },
  'go.http': {
    expect: () => ['go.mod', 'main.go', ...VS_L],
    buildOnly: (d, n) => sh(which('go'), ['build', '-o', n, '.'], d),
  },

  /* Rust */
  'rust.bin': {
    expect: () => ['Cargo.toml', 'src/main.rs', ...VS_L],
    run: (d) => sh(which('cargo'), ['run', '--quiet'], d),
  },
  'rust.lib': {
    expect: () => ['Cargo.toml', 'src/lib.rs', ...VS],
    buildOnly: (d) => sh(which('cargo'), ['build', '--quiet'], d),
  },

  /* Swift */
  'swift.executable': {
    expect: (n) => ['Package.swift', `Sources/${n}/main.swift`, ...VS_L],
    run: (d, n) => sh(which('swift'), ['run', n], d),
  },
  'swift.library': {
    expect: (n) => ['Package.swift', `Sources/${n}/${n}.swift`, ...VS],
    buildOnly: (d) => sh(which('swift'), ['build'], d),
  },

  /* 单模板脚本语言 */
  'ruby.script': { expect: () => ['main.rb', ...VS], run: (d) => sh(which('ruby'), ['main.rb'], d) },
  'perl.script': { expect: () => ['main.pl', ...VS], run: (d) => sh(which('perl'), ['main.pl'], d) },
  'php.script': { expect: () => ['index.php', ...VS], run: (d) => sh(which('php'), ['index.php'], d) },
  'lua.script': { expect: () => ['main.lua', ...VS], run: (d) => sh(which('lua'), ['main.lua'], d) },
  'r.script': { expect: () => ['main.R', ...VS], run: (d) => sh(which('Rscript'), ['main.R'], d) },
  'julia.script': { expect: () => ['main.jl', ...VS], run: (d) => sh(which('julia'), ['main.jl'], d) },
  'kotlin.console': { expect: () => ['Main.kt', ...VS], buildOnly: null },
  'fortran.console': {
    expect: () => ['main.f90', 'Makefile', ...VS_L],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },
  'haskell.console': {
    expect: () => ['Main.hs', 'Makefile', ...VS],
    run: (d, n) => {
      sh('make', [], d);
      return sh('./' + n, [], d);
    },
  },
  'dart.console': { expect: (n) => ['pubspec.yaml', `bin/${n}.dart`, ...VS_L], buildOnly: null },
};

/* ══════════ 1. 清单一致性 ══════════ */

check('package.json 与 languages.js / GENERATORS 三方一致', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const c = pkg.contributes;

  const expectedCmds = [];
  for (const l of LANGUAGES) {
    for (const t of l.templates) expectedCmds.push(`newProjectMenu.create.${l.id}.${t.id}`);
  }
  expectedCmds.push('newProjectMenu.refresh');
  const declared = c.commands.map((x) => x.command).sort();
  if (JSON.stringify(declared) !== JSON.stringify(expectedCmds.sort())) {
    throw new Error('命令声明不一致\n  实际: ' + declared.length + ' 条\n  期望: ' + expectedCmds.length + ' 条');
  }

  // 每个声明的模板都必须有生成器
  for (const l of LANGUAGES) {
    for (const t of l.templates) {
      const g = (GENERATORS[l.id] || {})[t.id];
      if (!g) throw new Error(`GENERATORS 缺少 ${l.id}.${t.id}`);
      if (!CASES[`${l.id}.${t.id}`]) throw new Error(`测试缺少用例 ${l.id}.${t.id}`);
    }
  }

  // 菜单结构：单模板 → 命令；多模板 → 子菜单
  const top = c.menus['newProjectMenu.submenu'];
  if (top.length !== LANGUAGES.length) throw new Error('顶层菜单项数量应为语言数');
  const subIds = c.submenus.map((s) => s.id);
  for (const l of LANGUAGES) {
    const multi = l.templates.length > 1;
    const it = top.find((x) => (multi ? x.submenu === `newProjectMenu.menu.${l.id}` : x.command && x.command.startsWith(`newProjectMenu.create.${l.id}.`)));
    if (!it) throw new Error(`${l.id} 顶层菜单项缺失`);
    if (it.when !== `newProjectMenu.lang.${l.id}`) throw new Error(`${l.id} when 条件错误: ${it.when}`);
    if (multi) {
      if (!subIds.includes(`newProjectMenu.menu.${l.id}`)) throw new Error(`${l.id} 子菜单未声明`);
      const items = c.menus[`newProjectMenu.menu.${l.id}`];
      if (!items || items.length !== l.templates.length) throw new Error(`${l.id} 子菜单项数量不符`);
    } else if (subIds.includes(`newProjectMenu.menu.${l.id}`)) {
      throw new Error(`${l.id} 只有 1 个模板，不应有子菜单`);
    }
  }

  if (c.menus['explorer/context'][0].when !== 'newProjectMenu.available') throw new Error('explorer/context 未绑定 available');
  if (!pkg.activationEvents.includes('onStartupFinished')) throw new Error('缺少 onStartupFinished');
});

/* ══════════ 2. 自动检测 ══════════ */

const det = detect();
check('自动检测：识别已安装语言', () => {
  const ok = Object.keys(det).filter((k) => det[k].ok);
  console.log('   可用: ' + ok.join(', '));
  for (const want of ['c', 'cpp', 'csharp', 'java', 'python', 'javascript', 'ruby', 'perl', 'swift']) {
    if (!det[want].ok) throw new Error(`应检测到 ${want} 可用`);
  }
});

check('自动检测：未安装语言判定为不可用', () => {
  const wrongly = ['rust', 'go', 'typescript', 'php', 'lua', 'kotlin', 'dart', 'r', 'julia', 'fortran', 'haskell'].filter(
    (k) => det[k].ok
  );
  if (wrongly.length) throw new Error('误判为可用: ' + wrongly.join(','));
});

/* ══════════ 3. 逐模板生成 + 编译 ══════════ */

const summary = [];

for (const lang of LANGUAGES) {
  if (!det[lang.id].ok) {
    for (const t of lang.templates) {
      summary.push(`⏭  ${lang.id}.${t.id}（未安装 ${lang.name || lang.label}）`);
      skip++;
    }
    continue;
  }

  for (const tpl of lang.templates) {
    const key = `${lang.id}.${tpl.id}`;
    const cs = CASES[key];
    const name = tpl.defaultName;
    let dir = null;

    const okStruct = check(`${key}: 生成结构`, () => {
      dir = path.join(TMP, lang.id, tpl.id, name);
      fs.mkdirSync(dir, { recursive: true });
      GENERATORS[lang.id][tpl.id](dir, name, dir);
      mustExist(dir, cs.expect(name));

      const tasks = readJson(path.join(dir, '.vscode', 'tasks.json'));
      if (!tasks.tasks.length) throw new Error('tasks.json 为空');
      if (!tasks.tasks.some((x) => x.group && x.group.kind === 'build' && x.group.isDefault)) {
        throw new Error('没有默认 build 任务');
      }
      const lp = path.join(dir, '.vscode', 'launch.json');
      if (fs.existsSync(lp)) {
        const lc = readJson(lp);
        if (!lc.configurations.length) throw new Error('launch.json 无配置');
        if (!lc.configurations[0].type) throw new Error('launch 配置缺 type');
      }
      if (cs.pomCheck) cs.pomCheck(dir);
      if (cs.depsCheck) cs.depsCheck(dir);
    });

    if (okStruct === false) {
      summary.push(`❌ ${key}`);
      continue;
    }

    if (STRUCTURE_ONLY) {
      summary.push(`✅ ${key}（结构）`);
      continue;
    }

    const okBuild = check(`${key}: 编译/运行`, () => {
      if (cs.run) {
        const out = cs.run(dir, name);
        if (out === 'skip-output') return;
        if (!out.includes(`Hello, ${name}!`)) {
          throw new Error('运行输出不符: ' + String(out).trim().slice(0, 200));
        }
        return;
      }
      if (cs.buildOnly) {
        cs.buildOnly(dir, name);
        return;
      }
      if (cs.mvnCompile) {
        const mvn = which('mvn') || '/opt/homebrew/bin/mvn';
        try {
          sh(mvn, ['-q', '-o', 'compile'], dir); // 先试离线（依赖已缓存时很快）
        } catch (e) {
          sh(mvn, ['-q', 'compile'], dir); // 缓存缺失则联网拉取
        }
        return;
      }
      if (cs.maybePytest) {
        const has = spawnSync(which('python3'), ['-m', 'pytest', '--version'], { env: ENV, encoding: 'utf8' });
        if (has.status !== 0) return 'skip';
        sh(which('python3'), ['-m', 'pytest', '-q'], dir);
        return;
      }
      return 'skip';
    });

    summary.push(okBuild === false ? `❌ ${key}` : `✅ ${key}`);
  }
}

/* ══════════ 汇总 ══════════ */

console.log('\n────────────────────────');
console.log(`通过 ${pass}，跳过 ${skip}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
