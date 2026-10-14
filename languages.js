// ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
'use strict';

/**
 * 语言 / 模板清单 —— 单一数据源。
 *
 * package.json 的菜单与命令贡献由 tools/gen-manifest.js 读这份表生成，
 * 所以增删模板只需要改这里 + 在 extension.js 的 GENERATORS 里加/改一个生成器。
 *
 * 结构：
 *   LANGUAGES[] = {
 *     id          语言 id，同时也是检测上下文的键：newProjectMenu.lang.<id>
 *     label       菜单里显示的语言名
 *     group       排序分组
 *     probe       检测命令，**任一**存在即认为该语言可用
 *     templates[] 该语言下的项目模板
 *   }
 *
 *   templates[] = {
 *     id          模板 id → 命令 newProjectMenu.create.<langId>.<templateId>
 *     label       模板名（多模板语言会显示为二级菜单项）
 *     defaultName 新建对话框默认项目名
 *     mainFile    生成后自动打开的文件，支持 {name} 占位；null = 不打开
 *   }
 *
 * 只有 1 个模板的语言，菜单里直接显示为命令项（不再多套一层子菜单）。
 */

const LANGUAGES = [
  /* ══════════════ 原生编译型 ══════════════ */
  {
    id: 'c',
    label: 'C',
    group: '1_native',
    probe: ['clang', 'gcc', 'cc'],
    templates: [
      { id: 'console', label: '控制台程序', defaultName: 'hello_c', mainFile: 'main.c' },
      { id: 'lib', label: '静态库', defaultName: 'mylib', mainFile: 'mylib.c' },
      { id: 'multifile', label: '多文件项目', defaultName: 'hello_multi', mainFile: 'main.c' },
    ],
  },
  {
    id: 'cpp',
    label: 'C++',
    group: '1_native',
    probe: ['clang++', 'g++', 'c++'],
    templates: [
      { id: 'console', label: '控制台程序', defaultName: 'hello_cpp', mainFile: 'main.cpp' },
      { id: 'class', label: '类（头文件/实现分离）', defaultName: 'hello_class', mainFile: 'main.cpp' },
      { id: 'lib', label: '静态库', defaultName: 'mylib', mainFile: 'mylib.cpp' },
    ],
  },
  {
    id: 'csharp',
    label: 'C#',
    group: '1_native',
    probe: ['dotnet'],
    templates: [
      { id: 'console', label: '控制台应用', defaultName: 'HelloCSharp', mainFile: 'Program.cs' },
      { id: 'webapi', label: 'Web API 接口', defaultName: 'HelloApi', mainFile: 'Program.cs' },
      { id: 'classlib', label: '类库', defaultName: 'HelloLib', mainFile: 'Class1.cs' },
      { id: 'xunit', label: '单元测试 (xUnit)', defaultName: 'HelloTests', mainFile: 'UnitTest1.cs' },
    ],
  },
  {
    id: 'java',
    label: 'Java',
    group: '1_native',
    probe: ['javac'],
    templates: [
      { id: 'console', label: '控制台应用 (Maven)', defaultName: 'hello_java', mainFile: 'src/main/java/com/example/App.java' },
      { id: 'api', label: 'REST 接口 (Spring Boot)', defaultName: 'hello_api', mainFile: 'src/main/java/com/example/HelloController.java' },
      { id: 'lib', label: '类库 (Maven)', defaultName: 'hello_lib', mainFile: 'src/main/java/com/example/Calculator.java' },
      { id: 'junit', label: '单元测试 (JUnit 5)', defaultName: 'hello_junit', mainFile: 'src/test/java/com/example/CalculatorTest.java' },
    ],
  },
  {
    id: 'rust',
    label: 'Rust',
    group: '1_native',
    probe: ['cargo'],
    templates: [
      { id: 'bin', label: '二进制程序', defaultName: 'hello_rust', mainFile: 'src/main.rs' },
      { id: 'lib', label: '库', defaultName: 'hello_lib', mainFile: 'src/lib.rs' },
    ],
  },
  {
    id: 'go',
    label: 'Go',
    group: '1_native',
    probe: ['go'],
    templates: [
      { id: 'cli', label: '命令行程序', defaultName: 'hello_go', mainFile: 'main.go' },
      { id: 'http', label: 'HTTP 接口', defaultName: 'hello_api', mainFile: 'main.go' },
    ],
  },
  {
    id: 'swift',
    label: 'Swift',
    group: '1_native',
    probe: ['swift'],
    templates: [
      { id: 'executable', label: '可执行程序', defaultName: 'HelloSwift', mainFile: 'Sources/{name}/main.swift' },
      { id: 'library', label: '库', defaultName: 'HelloLib', mainFile: 'Sources/{name}/{name}.swift' },
    ],
  },

  /* ══════════════ 其余单模板语言 ══════════════ */
  {
    id: 'kotlin',
    label: 'Kotlin',
    group: '3_more',
    probe: ['kotlinc'],
    templates: [{ id: 'console', label: '控制台程序', defaultName: 'HelloKotlin', mainFile: 'Main.kt' }],
  },
  {
    id: 'fortran',
    label: 'Fortran',
    group: '3_more',
    probe: ['gfortran'],
    templates: [{ id: 'console', label: '控制台程序', defaultName: 'hello_fortran', mainFile: 'main.f90' }],
  },
  {
    id: 'haskell',
    label: 'Haskell',
    group: '3_more',
    probe: ['ghc', 'runghc'],
    templates: [{ id: 'console', label: '控制台程序', defaultName: 'hello_haskell', mainFile: 'Main.hs' }],
  },
  {
    id: 'dart',
    label: 'Dart',
    group: '3_more',
    probe: ['dart'],
    templates: [{ id: 'console', label: '控制台程序', defaultName: 'hello_dart', mainFile: 'bin/{name}.dart' }],
  },

  /* ══════════════ 脚本型 ══════════════ */
  {
    id: 'python',
    label: 'Python',
    group: '2_script',
    probe: ['python3', 'python'],
    templates: [
      { id: 'script', label: '脚本', defaultName: 'hello_python', mainFile: 'main.py' },
      { id: 'package', label: '包（可安装模块）', defaultName: 'mypackage', mainFile: 'src/{name}/__init__.py' },
      { id: 'fastapi', label: 'Web 接口 (FastAPI)', defaultName: 'hello_api', mainFile: 'main.py' },
      { id: 'pytest', label: '单元测试 (pytest)', defaultName: 'hello_pytest', mainFile: 'tests/test_core.py' },
    ],
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    group: '2_script',
    probe: ['node'],
    templates: [
      { id: 'script', label: '脚本', defaultName: 'hello_js', mainFile: 'index.js' },
      { id: 'express', label: 'Express 接口', defaultName: 'hello_api', mainFile: 'server.js' },
      { id: 'package', label: 'npm 包', defaultName: 'hello_pkg', mainFile: 'index.js' },
    ],
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    group: '2_script',
    probe: ['tsc'],
    templates: [
      { id: 'console', label: '控制台程序', defaultName: 'hello_ts', mainFile: 'src/index.ts' },
      { id: 'express', label: 'Express 接口', defaultName: 'hello_api', mainFile: 'src/index.ts' },
    ],
  },
  {
    id: 'ruby',
    label: 'Ruby',
    group: '2_script',
    probe: ['ruby'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_ruby', mainFile: 'main.rb' }],
  },
  {
    id: 'perl',
    label: 'Perl',
    group: '2_script',
    probe: ['perl'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_perl', mainFile: 'main.pl' }],
  },
  {
    id: 'php',
    label: 'PHP',
    group: '2_script',
    probe: ['php'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_php', mainFile: 'index.php' }],
  },
  {
    id: 'lua',
    label: 'Lua',
    group: '2_script',
    probe: ['lua'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_lua', mainFile: 'main.lua' }],
  },
  {
    id: 'r',
    label: 'R',
    group: '2_script',
    probe: ['Rscript'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_r', mainFile: 'main.R' }],
  },
  {
    id: 'julia',
    label: 'Julia',
    group: '2_script',
    probe: ['julia'],
    templates: [{ id: 'script', label: '脚本', defaultName: 'hello_julia', mainFile: 'main.jl' }],
  },
];

module.exports = { LANGUAGES };
