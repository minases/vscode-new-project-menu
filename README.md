# 新建项目菜单 (New Project Menu) v3

> ## ⚠️ AI 生成声明
>
> **本项目的全部内容 —— 源代码、`package.json` 清单、构建/调试配置、测试脚本与本文档 —— 均由 AI 编码助手生成，未经人工逐行审查。**
>
> - 可能存在错误、遗漏或不符合最佳实践之处，请自行评估后再使用
> - 生成的 `.vscode/tasks.json` / `launch.json` 会写入编译器的**绝对路径**，换机器后需自行调整
> - 构建任务会**自动执行编译命令**，使用前请确认内容符合预期
>
> 使用者自行承担使用风险。

一个本地 VS Code 扩展：在资源管理器右键菜单里加 **「新建项目」** 三级菜单。

```
右键文件夹
 └─ 新建项目 ▸
     ├─ C ▸  控制台程序 / 静态库 / 多文件项目
     ├─ C++ ▸  控制台程序 / 类（头文件-实现分离）/ 静态库
     ├─ C# ▸  控制台应用 / Web API 接口 / 类库 / 单元测试 (xUnit)
     ├─ Java ▸  控制台应用 (Maven) / REST 接口 (Spring Boot) / 类库 / 单元测试 (JUnit 5)
     ├─ Python ▸  脚本 / 包（可安装模块）/ Web 接口 (FastAPI) / 单元测试 (pytest)
     ├─ JavaScript ▸  脚本 / Express 接口 / npm 包
     ├─ TypeScript ▸  控制台程序 / Express 接口
     ├─ Go ▸  命令行程序 / HTTP 接口
     ├─ Rust ▸  二进制程序 / 库
     ├─ Swift ▸  可执行程序 / 库
     ├─ Ruby / Perl / PHP / Lua / R / Julia / Kotlin / Fortran / Haskell / Dart
     │     （单模板，直接就是命令项，不多套一层）
     └─ …
```

**只有 1 个模板的语言不会多套一层子菜单**，避免无意义的点击。

## 自动检测

`contributes.menus` 在 VS Code 里是静态的，运行时不能增删菜单项。所以用的是标准变通法：

1. `package.json` 里声明全部语言/模板的菜单项，带 `when: "newProjectMenu.lang.<id>"`；
2. 扩展用 `activationEvents: ["onStartupFinished"]` 激活，遍历每种语言的探测命令；
3. 找到就 `setContext` 设为 `true`，没找到设为 `false`；
4. VS Code 按 `when` 自动隐藏未安装的语言。

新装了工具链后，执行命令面板里的 **「新建项目: 重新检测已安装的语言」** 即可刷新（无需重启），
它会把每种语言的**实际探测路径和可用模板**打印到「新建项目」输出面板。

想强行看到全部语言：设置里打开 `newProjectMenu.showAllLanguages`。

## 模板一览

| 语言 | 探测命令 | 模板 |
|---|---|---|
| C | `clang` / `gcc` / `cc` | 控制台程序、静态库(`.a`)、多文件项目 |
| C++ | `clang++` / `g++` | 控制台程序(C++20)、类、静态库 |
| C# | `dotnet` | 控制台、Web API、类库、xUnit |
| Java | `javac` | 控制台(Maven)、Spring Boot REST、类库、JUnit 5 |
| Python | `python3` | 脚本、包、FastAPI、pytest |
| JavaScript | `node` | 脚本、Express、npm 包 |
| TypeScript | `tsc` | 控制台、Express |
| Go | `go` | 命令行、HTTP 接口 |
| Rust | `cargo` | 二进制、库 |
| Swift | `swift` | 可执行、库 |
| Kotlin / Fortran / Haskell / Dart | `kotlinc` / `gfortran` / `ghc` / `dart` | 控制台程序 |
| Ruby / Perl / PHP / Lua / R / Julia | 同名命令 | 脚本 |

### 需要联网的模板

以下模板生成时只写代码和依赖清单，**首次 `Ctrl+Shift+B` 构建时才会联网拉依赖**：

- Java：Spring Boot REST（Maven 拉 spring-boot-starter-web）、JUnit 5
- Python：FastAPI（`pip install -r requirements.txt`）、pytest
- JavaScript / TypeScript：Express（`npm install`）
- C#：Web API / 类库 / xUnit（NuGet）

## 「编译时自动调用相应条件」

每个项目都会生成 `.vscode/tasks.json`（和能确定调试器时的 `launch.json`），**并写入编译器的绝对路径**：

- `Ctrl+Shift+B` → 该语言的默认 build 任务（多项目时为触发任务的目录）
- `F5` → 按 `launch.json` 调试

**为什么写绝对路径**：从 Dock 启动的 VS Code 拿不到 `~/.zshrc` 的 PATH。扩展内部也把
`~/.dotnet`、`~/.cargo/bin`、`~/go/bin`、`/opt/homebrew/bin`、anaconda，以及
`/usr/libexec/java_home` 给出的 JDK 目录补进 PATH 后再探测。

Java 的 `maven.compiler.release` 会跟随本机实际 JDK（取 21 与实际主版本的较小值），
JDK 17 / 21 / 27 都能直接编译。

## 文件结构

```
vscode-new-project-menu/
├── languages.js          语言 + 模板清单（单一数据源）
├── extension.js          主逻辑：环境探测、39 个模板生成器、菜单显隐
├── package.json          由 languages.js 生成，不要手改
├── tools/gen-manifest.js 清单生成器（单模板→命令，多模板→嵌套子菜单）
├── test/run-tests.js     离线冒烟测试（真调用编译器）
└── install.sh            同步安装到 ~/.vscode/extensions
```

## 加模板 / 加语言

1. 在 `languages.js` 对应语言的 `templates` 里加一项（id / label / defaultName / mainFile）；
2. 在 `extension.js` 的 `GENERATORS[语言id]` 里加同名生成器（脚本型语言可套 `simpleLang({...})`）；
3. 在 `test/run-tests.js` 的 `CASES` 里加一条用例；
4. `node tools/gen-manifest.js` → `./install.sh` → `Developer: Reload Window`。

## 测试

```bash
node test/run-tests.js --structure-only   # 只验证生成结构（快）
node test/run-tests.js                    # 完整：真实编译 + 核对运行输出
node test/check-activation.js             # 验证菜单显隐上下文与命令注册
```

完整测试会对**本机已安装工具链**的每个模板真实编译并核对 `Hello, <项目名>!` 输出；
未安装的语言自动跳过。需要联网拉依赖的模板单独标注。

## 卸载

```bash
rm -rf ~/.vscode/extensions/local.new-project-menu-1.0.0
```
