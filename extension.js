// ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
'use strict';

/**
 * 新建项目菜单 (New Project Menu) v3
 *
 * 资源管理器右键 → 新建项目 ▸ 语言 ▸ 模板。
 * 语言可用性由自动检测决定（setContext + when）；
 * 语言/模板清单位于 languages.js。
 */

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { LANGUAGES } = require('./languages');

let output;
let ENV;

/* ══════════════════════════ 环境探测 ══════════════════════════ */

function javaHome() {
  const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
  if (r.status === 0 && (r.stdout || '').trim()) return r.stdout.trim();
  return null;
}

/** Dock 启动的 VSCode 拿不到 shell rc 的 PATH，这里补回常见工具链目录 */
function buildEnv() {
  const home = os.homedir();
  const extra = [
    path.join(home, '.dotnet'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, 'go', 'bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    path.join(home, 'anaconda3', 'bin'),
    path.join(home, 'miniconda3', 'bin'),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const jh = javaHome();
  if (jh) extra.unshift(path.join(jh, 'bin'));

  const current = (process.env.PATH || '').split(':').filter(Boolean);
  const env = Object.assign({}, process.env);
  env.PATH = Array.from(new Set(extra.concat(current))).join(':');
  env.DOTNET_ROOT = env.DOTNET_ROOT || path.join(home, '.dotnet');
  env.DOTNET_CLI_TELEMETRY_OPTOUT = '1';
  env.DOTNET_NOLOGO = '1';
  return env;
}

function env() {
  if (!ENV) ENV = buildEnv();
  return ENV;
}

function isExec(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch (e) {
    return false;
  }
}

function which(cmd) {
  if (!cmd) return null;
  if (cmd.includes('/')) return isExec(cmd) ? cmd : null;
  for (const dir of env().PATH.split(':')) {
    if (!dir) continue;
    const p = path.join(dir, cmd);
    if (isExec(p)) return p;
  }
  return null;
}

function tool(cmd, extraCandidates) {
  for (const c of extraCandidates || []) {
    if (isExec(c)) return c;
  }
  return which(cmd) || cmd;
}

function findDotnet() {
  const home = os.homedir();
  for (const c of [
    path.join(home, '.dotnet', 'dotnet'),
    '/usr/local/share/dotnet/dotnet',
    '/opt/homebrew/bin/dotnet',
    '/usr/local/bin/dotnet',
  ]) {
    if (isExec(c)) return c;
  }
  return which('dotnet');
}

function javaMajor() {
  const javac = tool('javac');
  const r = spawnSync(javac, ['-version'], { env: env(), encoding: 'utf8' });
  const m = ((r.stdout || '') + (r.stderr || '')).match(/(\d+)/);
  const major = m ? parseInt(m[1], 10) : 21;
  return Number.isFinite(major) ? major : 21;
}

/* ══════════════════════════ 执行与文件工具 ══════════════════════════ */

function log(text) {
  const t = String(text);
  const s = t === '' || t.endsWith('\n') ? t : t + '\n';
  if (output) output.append(s);
  else process.stdout.write(s);
}

function run(exe, args, cwd, timeout) {
  if (output) output.show(true);
  log(`$ ${exe} ${args.join(' ')}`);
  log(`  cwd: ${cwd}`);
  const r = spawnSync(exe, args, {
    cwd,
    env: env(),
    encoding: 'utf8',
    timeout: timeout || 300000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.stdout) log(r.stdout);
  if (r.stderr) log(r.stderr);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const tail = ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-8).join('\n');
    throw new Error(`命令失败（退出码 ${r.status}）\n${tail}`);
  }
  return r;
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function jsonFile(file, obj) {
  writeFile(file, JSON.stringify(obj, null, 4) + '\n');
}

function wsPath(abs) {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const f of folders) {
    const root = f.uri.fsPath;
    if (abs === root) return '${workspaceFolder}';
    if (abs.startsWith(root + path.sep)) {
      return '${workspaceFolder}/' + path.relative(root, abs).split(path.sep).join('/');
    }
  }
  return abs.split(path.sep).join('/');
}

function baseDir(uri) {
  if (uri && uri.fsPath) {
    try {
      return fs.statSync(uri.fsPath).isDirectory() ? uri.fsPath : path.dirname(uri.fsPath);
    } catch (e) {
      return path.dirname(uri.fsPath);
    }
  }
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : os.homedir();
}

async function promptName(defaultName) {
  return vscode.window.showInputBox({
    prompt: '新项目名称（同时作为文件夹名）',
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v) return '名称不能为空';
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) return '只能使用字母、数字、下划线，且不能以数字开头';
      return null;
    },
  });
}

function checkTarget(dir, name) {
  const target = path.join(dir, name);
  if (fs.existsSync(target)) {
    let entries = [];
    try {
      entries = fs.readdirSync(target);
    } catch (e) {
      entries = ['?'];
    }
    if (entries.length > 0) throw new Error(`目录已存在且非空：${target}`);
  }
  return target;
}

/* ── .vscode 配置 ── */

function writeTasks(projDir, tasks) {
  jsonFile(path.join(projDir, '.vscode', 'tasks.json'), { version: '2.0.0', tasks });
}

function writeLaunch(projDir, configurations) {
  jsonFile(path.join(projDir, '.vscode', 'launch.json'), { version: '0.2.0', configurations });
}

function shTask(label, command, args, rel, extra) {
  return Object.assign(
    { label, type: 'shell', command, args, options: { cwd: rel }, problemMatcher: [] },
    extra || {}
  );
}

const BUILD_GROUP = { kind: 'build', isDefault: true };

function nativeDebugConfig(rel, program, label) {
  if (vscode.extensions.getExtension('vadimcn.vscode-lldb')) {
    return {
      name: `调试 (CodeLLDB) - ${label}`,
      type: 'lldb',
      request: 'launch',
      program,
      args: [],
      cwd: rel,
      preLaunchTask: 'build',
    };
  }
  return {
    name: `调试 (cppdbg / lldb) - ${label}`,
    type: 'cppdbg',
    request: 'launch',
    program,
    args: [],
    cwd: rel,
    stopAtEntry: false,
    environment: [],
    externalConsole: false,
    MIMode: 'lldb',
    preLaunchTask: 'build',
  };
}

const guard = (n) => n.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();

/* ══════════════════════════ C ══════════════════════════ */

function makefileExe(name, kind) {
  const cpp = kind === 'cpp';
  return [
    cpp ? 'CXX     := clang++' : 'CC      := clang',
    cpp ? 'CXXFLAGS := -std=c++20 -Wall -Wextra -g -O0' : 'CFLAGS  := -std=c17 -Wall -Wextra -g -O0',
    cpp ? 'COMPILE := $(CXX) $(CXXFLAGS)' : 'COMPILE := $(CC) $(CFLAGS)',
    'TARGET  := ' + name,
    'SRCS    := $(wildcard *.' + (cpp ? 'cpp' : 'c') + ')',
    `OBJS    := $(SRCS:${cpp ? '.cpp' : '.c'}=.o)`,
    '',
    '.PHONY: all clean run',
    '',
    'all: $(TARGET)',
    '',
    '$(TARGET): $(OBJS)',
    '\t$(COMPILE) -o $@ $^',
    '',
    `%.o: %.${cpp ? 'cpp' : 'c'}`,
    '\t$(COMPILE) -c $< -o $@',
    '',
    'run: all',
    '\t./$(TARGET)',
    '',
    'clean:',
    '\trm -f $(OBJS) $(TARGET)',
    '',
  ].join('\n');
}

function makefileLib(name, kind) {
  const cpp = kind === 'cpp';
  return [
    cpp ? 'CXX     := clang++' : 'CC      := clang',
    cpp ? 'CXXFLAGS := -std=c++20 -Wall -Wextra -g -O0' : 'CFLAGS  := -std=c17 -Wall -Wextra -g -O0',
    cpp ? 'COMPILE := $(CXX) $(CXXFLAGS)' : 'COMPILE := $(CC) $(CFLAGS)',
    'TARGET  := lib' + name + '.a',
    'SRCS    := $(wildcard *.' + (cpp ? 'cpp' : 'c') + ')',
    `OBJS    := $(SRCS:${cpp ? '.cpp' : '.c'}=.o)`,
    '',
    '.PHONY: all clean',
    '',
    'all: $(TARGET)',
    '',
    '$(TARGET): $(OBJS)',
    '\tar rcs $@ $^',
    '',
    `%.o: %.${cpp ? 'cpp' : 'c'}`,
    '\t$(COMPILE) -c $< -o $@',
    '',
    'clean:',
    '\trm -f $(OBJS) $(TARGET)',
    '',
  ].join('\n');
}

function genCConsole(d, n, r) {
  writeFile(path.join(d, 'main.c'), ['#include <stdio.h>', '', 'int main(void) {', `    printf("Hello, ${n}!\\n");`, '    return 0;', '}', ''].join('\n'));
  writeFile(path.join(d, 'Makefile'), makefileExe(n, 'c'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/${n}`, 'C')]);
  writeFile(path.join(d, '.gitignore'), [n, '*.o', '*.dSYM/', ''].join('\n'));
}

function genCLib(d, n, r) {
  writeFile(
    path.join(d, `${n}.h`),
    [`#ifndef ${guard(n)}_H`, `#define ${guard(n)}_H`, '', 'int add(int a, int b);', '', `#endif /* ${guard(n)}_H */`, ''].join('\n')
  );
  writeFile(path.join(d, `${n}.c`), [`#include "${n}.h"`, '', 'int add(int a, int b) {', '    return a + b;', '}', ''].join('\n'));
  writeFile(path.join(d, 'Makefile'), makefileLib(n, 'c'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['*.o', '*.a', ''].join('\n'));
}

function genCMulti(d, n, r) {
  writeFile(
    path.join(d, 'util.h'),
    ['#ifndef UTIL_H', '#define UTIL_H', '', 'const char *greet(void);', '', '#endif /* UTIL_H */', ''].join('\n')
  );
  writeFile(path.join(d, 'util.c'), ['#include "util.h"', '', 'const char *greet(void) {', `    return "Hello, ${n}!";`, '}', ''].join('\n'));
  writeFile(
    path.join(d, 'main.c'),
    ['#include <stdio.h>', '#include "util.h"', '', 'int main(void) {', '    printf("%s\\n", greet());', '    return 0;', '}', ''].join('\n')
  );
  writeFile(path.join(d, 'Makefile'), makefileExe(n, 'c'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/${n}`, 'C')]);
  writeFile(path.join(d, '.gitignore'), [n, '*.o', '*.dSYM/', ''].join('\n'));
}

/* ══════════════════════════ C++ ══════════════════════════ */

function genCppConsole(d, n, r) {
  writeFile(
    path.join(d, 'main.cpp'),
    ['#include <iostream>', '', 'int main() {', `    std::cout << "Hello, ${n}!" << std::endl;`, '    return 0;', '}', ''].join('\n')
  );
  writeFile(path.join(d, 'Makefile'), makefileExe(n, 'cpp'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/${n}`, 'C++')]);
  writeFile(path.join(d, '.gitignore'), [n, '*.o', '*.dSYM/', ''].join('\n'));
}

function genCppClass(d, n, r) {
  writeFile(
    path.join(d, 'Greeter.h'),
    ['#pragma once', '', '#include <string>', '', 'class Greeter {', 'public:', '    explicit Greeter(std::string name);', '    std::string greet() const;', '', 'private:', '    std::string name_;', '};', ''].join('\n')
  );
  writeFile(
    path.join(d, 'Greeter.cpp'),
    ['#include "Greeter.h"', '', '#include <utility>', '', 'Greeter::Greeter(std::string name) : name_(std::move(name)) {}', '', 'std::string Greeter::greet() const {', '    return "Hello, " + name_ + "!";', '}', ''].join('\n')
  );
  writeFile(
    path.join(d, 'main.cpp'),
    ['#include <iostream>', '#include "Greeter.h"', '', 'int main() {', `    Greeter greeter("${n}");`, '    std::cout << greeter.greet() << std::endl;', '    return 0;', '}', ''].join('\n')
  );
  writeFile(path.join(d, 'Makefile'), makefileExe(n, 'cpp'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/${n}`, 'C++')]);
  writeFile(path.join(d, '.gitignore'), [n, '*.o', '*.dSYM/', ''].join('\n'));
}

function genCppLib(d, n, r) {
  writeFile(
    path.join(d, `${n}.h`),
    ['#pragma once', '', `namespace ${n} {`, 'int add(int a, int b);', '}', ''].join('\n')
  );
  writeFile(
    path.join(d, `${n}.cpp`),
    [`#include "${n}.h"`, '', `namespace ${n} {`, 'int add(int a, int b) {', '    return a + b;', '}', '}', ''].join('\n')
  );
  writeFile(path.join(d, 'Makefile'), makefileLib(n, 'cpp'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['*.o', '*.a', ''].join('\n'));
}

/* ══════════════════════════ C# (.NET) ══════════════════════════ */

function readTfm(csproj) {
  try {
    const m = fs.readFileSync(csproj, 'utf8').match(/<TargetFramework>\s*([^<\s]+)\s*<\/TargetFramework>/);
    if (m) return m[1];
  } catch (e) {
    /* 用默认值 */
  }
  return 'net10.0';
}

function genDotnet(d, n, r, opt) {
  const dotnet = findDotnet();
  if (!dotnet) throw new Error('找不到 dotnet，请确认已安装 .NET SDK');

  run(dotnet, ['new', opt.template, '-o', d, '-n', n], path.dirname(d), 300000);

  if (opt.program) writeFile(path.join(d, 'Program.cs'), opt.program(n));

  const csproj = wsPath(path.join(d, n + '.csproj'));
  const tfm = readTfm(path.join(d, n + '.csproj'));

  const tasks = [
    { label: 'build', command: dotnet, type: 'process', args: ['build', csproj], problemMatcher: '$msCompile', group: BUILD_GROUP },
  ];
  if (opt.run) {
    tasks.push({ label: 'run', command: dotnet, type: 'process', args: ['run', '--project', csproj], problemMatcher: '$msCompile' });
  }
  if (opt.test) {
    tasks.push({ label: 'test', command: dotnet, type: 'process', args: ['test', csproj], problemMatcher: '$msCompile' });
  }
  tasks.push({ label: 'clean', command: dotnet, type: 'process', args: ['clean', csproj], problemMatcher: [] });
  writeTasks(d, tasks);

  if (opt.launch) {
    writeLaunch(d, [
      {
        name: '调试 (.NET)',
        type: 'coreclr',
        request: 'launch',
        preLaunchTask: 'build',
        program: `${r}/bin/Debug/${tfm}/${n}.dll`,
        args: [],
        cwd: r,
        console: 'internalConsole',
        stopAtEntry: false,
      },
    ]);
  }
  return dotnet;
}

const genCSharpConsole = (d, n, r) =>
  genDotnet(d, n, r, { template: 'console', program: (x) => `Console.WriteLine("Hello, ${x}!");\n`, run: true, launch: true });

const genCSharpWebApi = (d, n, r) =>
  genDotnet(d, n, r, {
    template: 'webapi',
    program: (x) =>
      [
        'var builder = WebApplication.CreateBuilder(args);',
        'var app = builder.Build();',
        '',
        `app.MapGet("/hello", () => "Hello, ${x}!");`,
        '',
        'app.Run();',
        '',
      ].join('\n'),
    run: true,
    launch: true,
  });

const genCSharpClassLib = (d, n, r) => genDotnet(d, n, r, { template: 'classlib' });
const genCSharpXunit = (d, n, r) => genDotnet(d, n, r, { template: 'xunit', test: true });

/* ══════════════════════════ Java ══════════════════════════ */

function pomBase(name, release, groupId) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<project xmlns="http://maven.apache.org/POM/4.0.0"',
    '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">',
    '  <modelVersion>4.0.0</modelVersion>',
    '',
    `  <groupId>${groupId || 'com.example'}</groupId>`,
    `  <artifactId>${name}</artifactId>`,
    '  <version>1.0-SNAPSHOT</version>',
    '  <packaging>jar</packaging>',
    '',
    '  <properties>',
    '    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    `    <maven.compiler.release>${release}</maven.compiler.release>`,
  ];
}

function pomEnd(extraLines) {
  return [''].concat(extraLines || []).concat(['</project>', '']);
}

function mvnTask(mvn, args, r) {
  return shTask('build', mvn, args, r, { group: BUILD_GROUP });
}

function genJavaConsole(d, n, r) {
  const release = javaMajor() >= 21 ? 21 : javaMajor();
  const pom = pomBase(n, release)
    .concat(['    <exec.mainClass>com.example.App</exec.mainClass>', '  </properties>', '', '  <build>', '    <plugins>', '      <plugin>', '        <groupId>org.codehaus.mojo</groupId>', '        <artifactId>exec-maven-plugin</artifactId>', '        <version>3.5.0</version>', '      </plugin>', '    </plugins>', '  </build>'])
    .concat(pomEnd())
    .join('\n');
  writeFile(path.join(d, 'pom.xml'), pom);
  writeFile(
    path.join(d, 'src', 'main', 'java', 'com', 'example', 'App.java'),
    ['package com.example;', '', 'public class App {', '    public static void main(String[] args) {', `        System.out.println("Hello, ${n}!");`, '    }', '}', ''].join('\n')
  );
  const mvn = tool('mvn', ['/opt/homebrew/bin/mvn', '/usr/local/bin/mvn']);
  const jh = javaHome();
  const javac = tool('javac', jh ? [path.join(jh, 'bin', 'javac')] : []);
  writeTasks(d, [
    mvnTask(mvn, ['-q', '-DskipTests', 'package'], r),
    shTask('run', mvn, ['-q', 'exec:java'], r),
    shTask('build (javac 离线)', javac, ['-encoding', 'UTF-8', '-d', `${r}/out`, `${r}/src/main/java/com/example/App.java`], r, { problemMatcher: ['$javac'] }),
    shTask('clean', mvn, ['-q', 'clean'], r),
  ]);
  writeLaunch(d, [{ type: 'java', name: '调试 (Java)', request: 'launch', mainClass: 'com.example.App', projectName: n }]);
  writeFile(path.join(d, '.gitignore'), ['target/', 'out/', '*.class', ''].join('\n'));
}

function genJavaApi(d, n, r) {
  const release = javaMajor() >= 21 ? 21 : javaMajor();
  const pom = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<project xmlns="http://maven.apache.org/POM/4.0.0"',
    '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">',
    '  <modelVersion>4.0.0</modelVersion>',
    '',
    '  <parent>',
    '    <groupId>org.springframework.boot</groupId>',
    '    <artifactId>spring-boot-starter-parent</artifactId>',
    '    <version>3.3.5</version>',
    '    <relativePath/>',
    '  </parent>',
    '',
    '  <groupId>com.example</groupId>',
    `  <artifactId>${n}</artifactId>`,
    '  <version>1.0-SNAPSHOT</version>',
    '  <packaging>jar</packaging>',
    '',
    '  <properties>',
    '    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    `    <java.version>${release}</java.version>`,
    '  </properties>',
    '',
    '  <dependencies>',
    '    <dependency>',
    '      <groupId>org.springframework.boot</groupId>',
    '      <artifactId>spring-boot-starter-web</artifactId>',
    '    </dependency>',
    '  </dependencies>',
    '',
    '  <build>',
    '    <plugins>',
    '      <plugin>',
    '        <groupId>org.springframework.boot</groupId>',
    '        <artifactId>spring-boot-maven-plugin</artifactId>',
    '      </plugin>',
    '    </plugins>',
    '  </build>',
    '</project>',
    '',
  ].join('\n');
  writeFile(path.join(d, 'pom.xml'), pom);
  writeFile(
    path.join(d, 'src', 'main', 'java', 'com', 'example', 'Application.java'),
    [
      'package com.example;',
      '',
      'import org.springframework.boot.SpringApplication;',
      'import org.springframework.boot.autoconfigure.SpringBootApplication;',
      '',
      '@SpringBootApplication',
      'public class Application {',
      '    public static void main(String[] args) {',
      '        SpringApplication.run(Application.class, args);',
      '    }',
      '}',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(d, 'src', 'main', 'java', 'com', 'example', 'HelloController.java'),
    [
      'package com.example;',
      '',
      'import org.springframework.web.bind.annotation.GetMapping;',
      'import org.springframework.web.bind.annotation.RestController;',
      '',
      '@RestController',
      'public class HelloController {',
      '',
      '    @GetMapping("/hello")',
      '    public String hello() {',
      `        return "Hello, ${n}!";`,
      '    }',
      '}',
      '',
    ].join('\n')
  );
  const mvn = tool('mvn', ['/opt/homebrew/bin/mvn', '/usr/local/bin/mvn']);
  writeTasks(d, [
    mvnTask(mvn, ['-q', '-DskipTests', 'package'], r),
    shTask('run', mvn, ['spring-boot:run'], r),
    shTask('clean', mvn, ['-q', 'clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['target/', '*.class', ''].join('\n'));
}

function genJavaLib(d, n, r) {
  const release = javaMajor() >= 21 ? 21 : javaMajor();
  const pom = pomBase(n, release)
    .concat(['  </properties>'])
    .concat(pomEnd())
    .join('\n');
  writeFile(path.join(d, 'pom.xml'), pom);
  writeFile(
    path.join(d, 'src', 'main', 'java', 'com', 'example', 'Calculator.java'),
    [
      'package com.example;',
      '',
      'public class Calculator {',
      '    public int add(int a, int b) {',
      '        return a + b;',
      '    }',
      '}',
      '',
    ].join('\n')
  );
  const mvn = tool('mvn', ['/opt/homebrew/bin/mvn', '/usr/local/bin/mvn']);
  writeTasks(d, [mvnTask(mvn, ['-q', '-DskipTests', 'package'], r), shTask('clean', mvn, ['-q', 'clean'], r)]);
  writeFile(path.join(d, '.gitignore'), ['target/', '*.class', ''].join('\n'));
}

function genJavaJunit(d, n, r) {
  const release = javaMajor() >= 21 ? 21 : javaMajor();
  const pom = pomBase(n, release)
    .concat([
      '  </properties>',
      '',
      '  <dependencies>',
      '    <dependency>',
      '      <groupId>org.junit.jupiter</groupId>',
      '      <artifactId>junit-jupiter</artifactId>',
      '      <version>5.10.2</version>',
      '      <scope>test</scope>',
      '    </dependency>',
      '  </dependencies>',
      '',
      '  <build>',
      '    <plugins>',
      '      <plugin>',
      '        <groupId>org.apache.maven.plugins</groupId>',
      '        <artifactId>maven-surefire-plugin</artifactId>',
      '        <version>3.2.5</version>',
      '      </plugin>',
      '    </plugins>',
      '  </build>',
    ])
    .concat(pomEnd())
    .join('\n');
  writeFile(path.join(d, 'pom.xml'), pom);
  writeFile(
    path.join(d, 'src', 'main', 'java', 'com', 'example', 'Calculator.java'),
    ['package com.example;', '', 'public class Calculator {', '    public int add(int a, int b) {', '        return a + b;', '    }', '}', ''].join('\n')
  );
  writeFile(
    path.join(d, 'src', 'test', 'java', 'com', 'example', 'CalculatorTest.java'),
    [
      'package com.example;',
      '',
      'import org.junit.jupiter.api.Test;',
      '',
      'import static org.junit.jupiter.api.Assertions.assertEquals;',
      '',
      'class CalculatorTest {',
      '',
      '    @Test',
      '    void addWorks() {',
      '        assertEquals(5, new Calculator().add(2, 3));',
      '    }',
      '}',
      '',
    ].join('\n')
  );
  const mvn = tool('mvn', ['/opt/homebrew/bin/mvn', '/usr/local/bin/mvn']);
  writeTasks(d, [
    shTask('build', mvn, ['-q', '-DskipTests', 'package'], r, { group: BUILD_GROUP }),
    shTask('test', mvn, ['-q', 'test'], r),
    shTask('clean', mvn, ['-q', 'clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['target/', '*.class', ''].join('\n'));
}

/* ══════════════════════════ Python ══════════════════════════ */

function pythonPath() {
  return tool('python3', [
    path.join(os.homedir(), 'anaconda3', 'bin', 'python3'),
    '/opt/homebrew/bin/python3',
    '/usr/bin/python3',
  ]);
}

function genPythonScript(d, n, r) {
  const py = pythonPath();
  writeFile(path.join(d, 'main.py'), ['def main():', `    print("Hello, ${n}!")`, '', '', 'if __name__ == "__main__":', '    main()', ''].join('\n'));
  writeTasks(d, [shTask('run', py, ['main.py'], r, { group: BUILD_GROUP })]);
  writeLaunch(d, [{ name: '调试 (debugpy)', type: 'debugpy', request: 'launch', program: `${r}/main.py`, console: 'integratedTerminal', cwd: r }]);
  writeFile(path.join(d, '.gitignore'), ['__pycache__/', '*.pyc', '.venv/', ''].join('\n'));
}

function genPythonPackage(d, n, r) {
  const py = pythonPath();
  writeFile(
    path.join(d, 'src', n, '__init__.py'),
    [`from .core import greet`, '', `__all__ = ["greet"]`, ''].join('\n')
  );
  writeFile(
    path.join(d, 'src', n, 'core.py'),
    ['def greet(name: str = "' + n + '") -> str:', '    return f"Hello, {name}!"', ''].join('\n')
  );
  writeFile(
    path.join(d, 'pyproject.toml'),
    [
      '[build-system]',
      'requires = ["setuptools>=68"]',
      'build-backend = "setuptools.build_meta"',
      '',
      '[project]',
      `name = "${n}"`,
      'version = "0.1.0"',
      'requires-python = ">=3.9"',
      '',
      '[tool.setuptools.packages.find]',
      'where = ["src"]',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(d, 'main.py'),
    [`from ${n} import greet`, '', 'if __name__ == "__main__":', `    print(greet("${n}"))`, ''].join('\n')
  );
  writeTasks(d, [
    shTask('run', py, ['main.py'], r, { group: BUILD_GROUP, env: { PYTHONPATH: 'src' } }),
    shTask('build', py, ['-m', 'build'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['__pycache__/', '*.pyc', 'dist/', 'build/', '*.egg-info/', ''].join('\n'));
}

function genPythonFastApi(d, n, r) {
  const py = pythonPath();
  writeFile(
    path.join(d, 'main.py'),
    [
      'from fastapi import FastAPI',
      '',
      'app = FastAPI(title="' + n + '")',
      '',
      '',
      '@app.get("/hello")',
      'def hello():',
      `    return {"message": "Hello, ${n}!"}`,
      '',
    ].join('\n')
  );
  writeFile(path.join(d, 'requirements.txt'), ['fastapi>=0.110', 'uvicorn[standard]>=0.29', ''].join('\n'));
  writeTasks(d, [
    shTask('run', py, ['-m', 'uvicorn', 'main:app', '--reload'], r, { group: BUILD_GROUP }),
    shTask('install', py, ['-m', 'pip', 'install', '-r', 'requirements.txt'], r),
  ]);
  writeLaunch(d, [
    {
      name: '调试 (uvicorn)',
      type: 'debugpy',
      request: 'launch',
      module: 'uvicorn',
      args: ['main:app', '--reload'],
      console: 'integratedTerminal',
      cwd: r,
    },
  ]);
  writeFile(path.join(d, '.gitignore'), ['__pycache__/', '*.pyc', '.venv/', ''].join('\n'));
}

function genPythonPytest(d, n, r) {
  const py = pythonPath();
  writeFile(path.join(d, 'src', 'calculator.py'), ['def add(a: int, b: int) -> int:', '    return a + b', ''].join('\n'));
  writeFile(
    path.join(d, 'tests', 'test_calculator.py'),
    ['from calculator import add', '', '', 'def test_add():', '    assert add(2, 3) == 5', '', '', 'def test_add_negative():', '    assert add(-1, 1) == 0', ''].join('\n')
  );
  writeFile(
    path.join(d, 'pyproject.toml'),
    [
      '[project]',
      `name = "${n}"`,
      'version = "0.1.0"',
      'requires-python = ">=3.9"',
      '',
      '[tool.pytest.ini_options]',
      'pythonpath = ["src"]',
      'testpaths = ["tests"]',
      '',
    ].join('\n')
  );
  writeTasks(d, [
    shTask('test', py, ['-m', 'pytest', '-q'], r, { group: BUILD_GROUP }),
    shTask('install pytest', py, ['-m', 'pip', 'install', 'pytest'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['__pycache__/', '*.pyc', '.pytest_cache/', '.venv/', ''].join('\n'));
}

/* ══════════════════════════ JavaScript / TypeScript ══════════════════════════ */

function genJavaScriptScript(d, n, r) {
  const node = tool('node');
  writeFile(path.join(d, 'index.js'), ['function main() {', `  console.log("Hello, ${n}!");`, '}', '', 'main();', ''].join('\n'));
  jsonFile(path.join(d, 'package.json'), {
    name: n.toLowerCase().replace(/_/g, '-'),
    version: '1.0.0',
    private: true,
    main: 'index.js',
    scripts: { start: 'node index.js' },
  });
  writeTasks(d, [shTask('run', node, ['index.js'], r, { group: BUILD_GROUP })]);
  writeLaunch(d, [{ name: '调试 (node)', type: 'node', request: 'launch', program: `${r}/index.js`, cwd: r, console: 'integratedTerminal' }]);
}

function genJavaScriptExpress(d, n, r) {
  const node = tool('node');
  writeFile(
    path.join(d, 'server.js'),
    [
      "const express = require('express');",
      '',
      'const app = express();',
      'const PORT = process.env.PORT || 3000;',
      '',
      "app.get('/hello', (req, res) => {",
      `  res.json({ message: 'Hello, ${n}!' });`,
      '});',
      '',
      'app.listen(PORT, () => {',
      '  console.log(`服务已启动: http://localhost:${PORT}/hello`);',
      '});',
      '',
    ].join('\n')
  );
  jsonFile(path.join(d, 'package.json'), {
    name: n.toLowerCase().replace(/_/g, '-'),
    version: '1.0.0',
    private: true,
    main: 'server.js',
    scripts: { start: 'node server.js' },
    dependencies: { express: '^4.19.2' },
  });
  writeTasks(d, [
    shTask('run', node, ['server.js'], r, { group: BUILD_GROUP }),
    shTask('install', 'npm', ['install'], r),
  ]);
  writeLaunch(d, [{ name: '调试 (node)', type: 'node', request: 'launch', program: `${r}/server.js`, cwd: r, console: 'integratedTerminal' }]);
  writeFile(path.join(d, '.gitignore'), ['node_modules/', ''].join('\n'));
}

function genJavaScriptPackage(d, n, r) {
  writeFile(
    path.join(d, 'index.js'),
    ['/**', ` * ${n}`, ' */', "function greet(name) {", '  return `Hello, ${name}!`;', '}', '', 'module.exports = { greet };', ''].join('\n')
  );
  jsonFile(path.join(d, 'package.json'), {
    name: n.toLowerCase().replace(/_/g, '-'),
    version: '1.0.0',
    description: 'A demo npm package',
    main: 'index.js',
    scripts: { test: 'echo "no tests yet" && exit 0' },
    license: 'MIT',
  });
  writeFile(
    path.join(d, 'example.js'),
    [`const { greet } = require('./index');`, '', `console.log(greet('${n}'));`, ''].join('\n')
  );
  const node = tool('node');
  writeTasks(d, [shTask('run', node, ['example.js'], r, { group: BUILD_GROUP })]);
  writeFile(path.join(d, '.gitignore'), ['node_modules/', ''].join('\n'));
}

function tsconfig() {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*.ts'],
  };
}

function genTypeScriptConsole(d, n, r) {
  const tsc = tool('tsc');
  const node = tool('node');
  writeFile(path.join(d, 'src', 'index.ts'), [`const message: string = "Hello, ${n}!";`, 'console.log(message);', ''].join('\n'));
  jsonFile(path.join(d, 'tsconfig.json'), tsconfig());
  writeTasks(d, [
    shTask('build', tsc, [], r, { group: BUILD_GROUP, problemMatcher: ['$tsc'] }),
    shTask('run', node, ['dist/index.js'], r, { dependsOn: 'build' }),
  ]);
  writeLaunch(d, [{ name: '调试 (node)', type: 'node', request: 'launch', program: `${r}/dist/index.js`, preLaunchTask: 'build', cwd: r }]);
  writeFile(path.join(d, '.gitignore'), ['node_modules/', 'dist/', ''].join('\n'));
}

function genTypeScriptExpress(d, n, r) {
  const tsc = tool('tsc');
  const node = tool('node');
  writeFile(
    path.join(d, 'src', 'index.ts'),
    [
      "import express from 'express';",
      '',
      'const app = express();',
      'const PORT: number = Number(process.env.PORT) || 3000;',
      '',
      "app.get('/hello', (req, res) => {",
      `  res.json({ message: 'Hello, ${n}!' });`,
      '});',
      '',
      'app.listen(PORT, () => {',
      '  console.log(`服务已启动: http://localhost:${PORT}/hello`);',
      '});',
      '',
    ].join('\n')
  );
  jsonFile(path.join(d, 'tsconfig.json'), tsconfig());
  jsonFile(path.join(d, 'package.json'), {
    name: n.toLowerCase().replace(/_/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: { build: 'tsc', start: 'node dist/index.js' },
    dependencies: { express: '^4.19.2' },
    devDependencies: { '@types/express': '^4.17.21', '@types/node': '^20.12.7', typescript: '^5.4.5' },
  });
  writeTasks(d, [
    shTask('build', tsc, [], r, { group: BUILD_GROUP, problemMatcher: ['$tsc'] }),
    shTask('run', node, ['dist/index.js'], r, { dependsOn: 'build' }),
    shTask('install', 'npm', ['install'], r),
  ]);
  writeLaunch(d, [{ name: '调试 (node)', type: 'node', request: 'launch', program: `${r}/dist/index.js`, preLaunchTask: 'build', cwd: r }]);
  writeFile(path.join(d, '.gitignore'), ['node_modules/', 'dist/', ''].join('\n'));
}

/* ══════════════════════════ Go ══════════════════════════ */

function goBin() {
  return tool('go', [path.join(os.homedir(), 'go', 'bin', 'go'), '/opt/homebrew/bin/go', '/usr/local/go/bin/go']);
}

function genGoCli(d, n, r) {
  fs.mkdirSync(d, { recursive: true });
  const go = goBin();
  try {
    run(go, ['mod', 'init', n], d, 120000);
  } catch (e) {
    /* 已有 go.mod 时忽略 */
  }
  writeFile(path.join(d, 'main.go'), ['package main', '', 'import "fmt"', '', 'func main() {', `\tfmt.Println("Hello, ${n}!")`, '}', ''].join('\n'));
  writeTasks(d, [
    shTask('build', go, ['build', '-o', n, '.'], r, { group: BUILD_GROUP }),
    shTask('run', go, ['run', '.'], r),
    shTask('clean', 'rm', ['-f', n], r),
  ]);
  writeLaunch(d, [{ name: '调试 (Go)', type: 'go', request: 'launch', mode: 'auto', program: r }]);
}

function genGoHttp(d, n, r) {
  fs.mkdirSync(d, { recursive: true });
  const go = goBin();
  try {
    run(go, ['mod', 'init', n], d, 120000);
  } catch (e) {
    /* 忽略 */
  }
  writeFile(
    path.join(d, 'main.go'),
    [
      'package main',
      '',
      'import (',
      '\t"fmt"',
      '\t"net/http"',
      ')',
      '',
      'func main() {',
      '\thttp.HandleFunc("/hello", func(w http.ResponseWriter, req *http.Request) {',
      `\t\tfmt.Fprintln(w, "Hello, ${n}!")`,
      '\t})',
      '',
      '\tfmt.Println("服务已启动: http://localhost:8080/hello")',
      '\thttp.ListenAndServe(":8080", nil)',
      '}',
      '',
    ].join('\n')
  );
  writeTasks(d, [
    shTask('build', go, ['build', '-o', n, '.'], r, { group: BUILD_GROUP }),
    shTask('run', go, ['run', '.'], r),
    shTask('clean', 'rm', ['-f', n], r),
  ]);
  writeLaunch(d, [{ name: '调试 (Go)', type: 'go', request: 'launch', mode: 'auto', program: r }]);
}

/* ══════════════════════════ Rust ══════════════════════════ */

function cargoBin() {
  return tool('cargo', [path.join(os.homedir(), '.cargo', 'bin', 'cargo')]);
}

function genRustBin(d, n, r) {
  const cargo = cargoBin();
  run(cargo, ['new', d, '--name', n, '--vcs', 'none'], path.dirname(d), 180000);
  writeTasks(d, [
    shTask('build', cargo, ['build'], r, { group: BUILD_GROUP }),
    shTask('run', cargo, ['run'], r),
    shTask('clean', cargo, ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/target/debug/${n}`, 'Rust')]);
}

function genRustLib(d, n, r) {
  const cargo = cargoBin();
  run(cargo, ['new', d, '--name', n, '--lib', '--vcs', 'none'], path.dirname(d), 180000);
  writeTasks(d, [
    shTask('build', cargo, ['build'], r, { group: BUILD_GROUP }),
    shTask('test', cargo, ['test'], r),
    shTask('clean', cargo, ['clean'], r),
  ]);
}

/* ══════════════════════════ Swift ══════════════════════════ */

function genSwiftExecutable(d, n, r) {
  const swift = tool('swift', ['/usr/bin/swift']);
  writeFile(
    path.join(d, 'Package.swift'),
    [
      '// swift-tools-version:5.9',
      'import PackageDescription',
      '',
      'let package = Package(',
      `    name: "${n}",`,
      '    targets: [',
      `        .executableTarget(name: "${n}", path: "Sources/${n}")`,
      '    ]',
      ')',
      '',
    ].join('\n')
  );
  writeFile(path.join(d, 'Sources', n, 'main.swift'), `print("Hello, ${n}!")\n`);
  writeTasks(d, [
    shTask('build', swift, ['build'], r, { group: BUILD_GROUP }),
    shTask('run', swift, ['run', n], r),
    shTask('clean', swift, ['package', 'clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/.build/debug/${n}`, 'Swift')]);
  writeFile(path.join(d, '.gitignore'), ['.build/', '*.xcodeproj', ''].join('\n'));
}

function genSwiftLibrary(d, n, r) {
  const swift = tool('swift', ['/usr/bin/swift']);
  writeFile(
    path.join(d, 'Package.swift'),
    [
      '// swift-tools-version:5.9',
      'import PackageDescription',
      '',
      'let package = Package(',
      `    name: "${n}",`,
      '    products: [',
      `        .library(name: "${n}", targets: ["${n}"])`,
      '    ],',
      '    targets: [',
      `        .target(name: "${n}", path: "Sources/${n}")`,
      '    ]',
      ')',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(d, 'Sources', n, `${n}.swift`),
    ['public func greet() -> String {', `    return "Hello, ${n}!"`, '}', ''].join('\n')
  );
  writeTasks(d, [
    shTask('build', swift, ['build'], r, { group: BUILD_GROUP }),
    shTask('clean', swift, ['package', 'clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), ['.build/', '*.xcodeproj', ''].join('\n'));
}

/* ══════════════════════════ 其余单模板语言 ══════════════════════════ */

function simpleLang(opt) {
  return function (d, n, r) {
    const interp = tool(opt.cmd);
    writeFile(path.join(d, opt.file), opt.src(n));
    writeTasks(d, [shTask('run', interp, [opt.file], r, { group: BUILD_GROUP })]);
    if (opt.gitignore) writeFile(path.join(d, '.gitignore'), opt.gitignore);
  };
}

function genKotlin(d, n, r) {
  const kotlinc = tool('kotlinc');
  const jh = javaHome();
  const java = tool('java', jh ? [path.join(jh, 'bin', 'java')] : []);
  writeFile(path.join(d, 'Main.kt'), ['fun main() {', `    println("Hello, ${n}!")`, '}', ''].join('\n'));
  writeTasks(d, [
    shTask('build', kotlinc, ['Main.kt', '-include-runtime', '-d', `${n}.jar`], r, { group: BUILD_GROUP }),
    shTask('run', java, ['-jar', `${n}.jar`], r, { dependsOn: 'build' }),
  ]);
  writeFile(path.join(d, '.gitignore'), ['*.jar', '*.class', ''].join('\n'));
}

function makefileSimple(name, varName, cmd, flags, src, extras) {
  return [
    `${varName} := ${cmd}`,
    `${varName}FLAGS := ${flags}`,
    'TARGET  := ' + name,
    '',
    '.PHONY: all clean run',
    '',
    'all: $(TARGET)',
    '',
    `$(TARGET): ${src}`,
    `\t$(${varName}) $(${varName}FLAGS) -o $@ $<`,
    '',
    'run: all',
    '\t./$(TARGET)',
    '',
    'clean:',
    `\trm -f $(TARGET)${extras || ''}`,
    '',
  ].join('\n');
}

function genFortran(d, n, r) {
  writeFile(path.join(d, 'main.f90'), ['program main', '    implicit none', `    print *, "Hello, ${n}!"`, 'end program main', ''].join('\n'));
  writeFile(path.join(d, 'Makefile'), makefileSimple(n, 'FC', 'gfortran', '-Wall -Wextra -g -O0 -std=f2018', 'main.f90', ' *.mod'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP, problemMatcher: ['$gcc'] }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeLaunch(d, [nativeDebugConfig(r, `${r}/${n}`, 'Fortran')]);
  writeFile(path.join(d, '.gitignore'), [n, '*.mod', '*.o', ''].join('\n'));
}

function genHaskell(d, n, r) {
  writeFile(path.join(d, 'Main.hs'), ['module Main where', '', 'main :: IO ()', `main = putStrLn "Hello, ${n}!"`, ''].join('\n'));
  writeFile(path.join(d, 'Makefile'), makefileSimple(n, 'GHC', 'ghc', '-Wall -O0', 'Main.hs', ' *.hi *.o'));
  writeTasks(d, [
    shTask('build', 'make', [], r, { group: BUILD_GROUP }),
    shTask('run', 'make', ['run'], r),
    shTask('clean', 'make', ['clean'], r),
  ]);
  writeFile(path.join(d, '.gitignore'), [n, '*.hi', '*.o', ''].join('\n'));
}

function genDart(d, n, r) {
  const dart = tool('dart');
  run(dart, ['create', '-t', 'console', '--force', d], path.dirname(d), 300000);
  writeTasks(d, [
    shTask('run', dart, ['run', `bin/${n}.dart`], r, { group: BUILD_GROUP }),
    shTask('build', dart, ['compile', 'exe', `bin/${n}.dart`, '-o', `build/${n}`], r),
  ]);
  writeLaunch(d, [{ name: '调试 (Dart)', type: 'dart', request: 'launch', program: `${r}/bin/${n}.dart`, cwd: r }]);
}

/* ══════════════════════════ 生成器注册表 ══════════════════════════ */

const GENERATORS = {
  c: { console: genCConsole, lib: genCLib, multifile: genCMulti },
  cpp: { console: genCppConsole, class: genCppClass, lib: genCppLib },
  csharp: {
    console: genCSharpConsole,
    webapi: genCSharpWebApi,
    classlib: genCSharpClassLib,
    xunit: genCSharpXunit,
  },
  java: { console: genJavaConsole, api: genJavaApi, lib: genJavaLib, junit: genJavaJunit },
  rust: { bin: genRustBin, lib: genRustLib },
  go: { cli: genGoCli, http: genGoHttp },
  swift: { executable: genSwiftExecutable, library: genSwiftLibrary },
  python: {
    script: genPythonScript,
    package: genPythonPackage,
    fastapi: genPythonFastApi,
    pytest: genPythonPytest,
  },
  javascript: { script: genJavaScriptScript, express: genJavaScriptExpress, package: genJavaScriptPackage },
  typescript: { console: genTypeScriptConsole, express: genTypeScriptExpress },
  kotlin: { console: genKotlin },
  fortran: { console: genFortran },
  haskell: { console: genHaskell },
  dart: { console: genDart },
  ruby: {
    script: simpleLang({
      cmd: 'ruby',
      file: 'main.rb',
      src: (n) => ['def main', `  puts "Hello, ${n}!"`, 'end', '', 'main', ''].join('\n'),
    }),
  },
  perl: {
    script: simpleLang({
      cmd: 'perl',
      file: 'main.pl',
      src: (n) => ['#!/usr/bin/env perl', 'use strict;', 'use warnings;', '', `print "Hello, ${n}!\\n";`, ''].join('\n'),
    }),
  },
  php: {
    script: simpleLang({ cmd: 'php', file: 'index.php', src: (n) => ['<?php', `echo "Hello, ${n}!\\n";`, ''].join('\n') }),
  },
  lua: {
    script: simpleLang({ cmd: 'lua', file: 'main.lua', src: (n) => [`print("Hello, ${n}!")`, ''].join('\n') }),
  },
  r: {
    script: simpleLang({ cmd: 'Rscript', file: 'main.R', src: (n) => [`cat("Hello, ${n}!\\n")`, ''].join('\n') }),
  },
  julia: {
    script: simpleLang({ cmd: 'julia', file: 'main.jl', src: (n) => [`println("Hello, ${n}!")`, ''].join('\n') }),
  },
};

/* ══════════════════════════ 检测与菜单显隐 ══════════════════════════ */

function detect() {
  const result = {};
  for (const lang of LANGUAGES) {
    let found = null;
    for (const cmd of lang.probe) {
      const p = which(cmd);
      if (p) {
        found = p;
        break;
      }
    }
    result[lang.id] = { ok: !!found, found: found || null };
  }
  return result;
}

function showAllLanguages() {
  try {
    return vscode.workspace.getConfiguration('newProjectMenu').get('showAllLanguages') === true;
  } catch (e) {
    return false;
  }
}

function applyContext(det) {
  const forceAll = showAllLanguages();
  let any = false;
  for (const lang of LANGUAGES) {
    const ok = forceAll || det[lang.id].ok;
    if (ok) any = true;
    vscode.commands.executeCommand('setContext', `newProjectMenu.lang.${lang.id}`, ok);
  }
  vscode.commands.executeCommand('setContext', 'newProjectMenu.available', any);
  return any;
}

/* ══════════════════════════ 命令 ══════════════════════════ */

async function create(langId, templateId, uri) {
  const lang = LANGUAGES.find((l) => l.id === langId);
  if (!lang) throw new Error(`未知语言：${langId}`);
  const tpl = lang.templates.find((t) => t.id === templateId);
  if (!tpl) throw new Error(`语言 ${langId} 下没有模板 ${templateId}`);
  const gen = (GENERATORS[langId] || {})[templateId];
  if (!gen) throw new Error(`模板 ${langId}.${templateId} 还没有生成器`);

  const dir = baseDir(uri);
  const name = await promptName(tpl.defaultName);
  if (!name) return;

  const projDir = checkTarget(dir, name);
  const rel = wsPath(projDir);

  if (output) output.show(true);
  log(`══════ 新建项目：${lang.label} / ${tpl.label} → ${projDir} ══════`);

  gen(projDir, name, rel);

  const mainRel = (tpl.mainFile || '').replace('{name}', name);
  if (mainRel) {
    const mainAbs = path.join(projDir, mainRel);
    if (fs.existsSync(mainAbs)) {
      const doc = await vscode.workspace.openTextDocument(mainAbs);
      await vscode.window.showTextDocument(doc);
    }
  }

  log('✔ 完成');
  vscode.window.showInformationMessage(`已创建项目：${name}`, '在访达中显示').then((pick) => {
    if (pick === '在访达中显示') {
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projDir));
    }
  });
}

function handler(langId, templateId) {
  return async (uri) => {
    try {
      await create(langId, templateId, uri);
    } catch (e) {
      vscode.window.showErrorMessage(`新建项目失败：${e.message}`);
    }
  };
}

async function refresh() {
  const det = detect();
  applyContext(det);

  output.show(true);
  output.appendLine('');
  output.appendLine('═══════ 语言环境检测 ═══════');
  for (const lang of LANGUAGES) {
    const d = det[lang.id];
    const tpls = lang.templates.map((t) => t.label).join(' / ');
    if (d.ok) output.appendLine(`✅ ${lang.label.padEnd(12)} ${d.found}    [${tpls}]`);
    else output.appendLine(`❌ ${lang.label.padEnd(12)} 未找到：${lang.probe.join(' / ')}`);
  }

  const ok = LANGUAGES.filter((l) => det[l.id].ok).map((l) => l.label);
  const templates = LANGUAGES.filter((l) => det[l.id].ok).reduce((s, l) => s + l.templates.length, 0);
  const miss = LANGUAGES.length - ok.length;
  vscode.window.showInformationMessage(
    `可用 ${ok.length} 种语言 / ${templates} 个模板：${ok.join('、')}` +
      (miss ? `（另有 ${miss} 种未安装工具链，已从菜单隐藏）` : '')
  );
}

/* ══════════════════════════ 生命周期 ══════════════════════════ */

function activate(context) {
  ENV = buildEnv();
  output = vscode.window.createOutputChannel('新建项目');
  context.subscriptions.push(output);

  for (const lang of LANGUAGES) {
    vscode.commands.executeCommand('setContext', `newProjectMenu.lang.${lang.id}`, false);
  }
  applyContext(detect());

  for (const lang of LANGUAGES) {
    for (const tpl of lang.templates) {
      context.subscriptions.push(
        vscode.commands.registerCommand(`newProjectMenu.create.${lang.id}.${tpl.id}`, handler(lang.id, tpl.id))
      );
    }
  }
  context.subscriptions.push(vscode.commands.registerCommand('newProjectMenu.refresh', refresh));

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('newProjectMenu.showAllLanguages')) applyContext(detect());
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  __internals: {
    GENERATORS,
    LANGUAGES,
    detect,
    buildEnv,
    which,
    findDotnet,
    javaMajor,
    makefileExe,
    makefileLib,
    writeTasks,
    writeLaunch,
    shTask,
  },
};
