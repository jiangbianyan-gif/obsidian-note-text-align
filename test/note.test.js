'use strict';
/* Note Text Align — unit tests.
 *
 *   node test/note.test.js        (or: npm test)
 *
 * How it works: `main.js` is loaded by Obsidian's plugin loader, so a bare
 * `require()` would fail on `require('obsidian')`. The "constants + pure
 * functions" region is sliced out of the source and evaluated with `new
 * Function`, which keeps the test honest: it runs the exact shipped code.
 * A second pass loads the WHOLE file with a stub `obsidian` module, so a
 * mistake in the plugin class body is caught here too.
 *
 * The last group of assertions pins down things that cannot be observed from
 * outside the app but break the plugin silently: which menu event is
 * registered, the `.md` guard, and the class names the stylesheet must have.
 *
 * No dependencies, no test framework.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'main.js');
const src = fs.readFileSync(SRC, 'utf8');

function slice(startMark, endMark) {
  const i = src.indexOf(startMark);
  const j = src.indexOf(endMark);
  if (i < 0 || j < 0 || j <= i) throw new Error('slice failed: ' + startMark);
  return src.slice(i, j);
}

/* 常量表 + 纯函数。从 `const MODES` 到插件类之前。 */
const code =
  slice('const MODES = [', 'module.exports = class') +
  '\nreturn {toArray, mergeAlignClass, alignFromClasses, isOurs, ' +
  'MODES, MODE_BY_KEY, PREFIX, LEGACY_PREFIX, MENU_TITLE, JUSTIFY_LAST_CLS, DEFAULT_SETTINGS};';
const A = new Function(code)();

let pass = 0;
let fail = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log('  x ' + name + '\n      actual:   ' + a + '\n      expected: ' + e);
  }
}

/* ---------- toArray ---------- */
eq(A.toArray(null), [], 'null -> []');
eq(A.toArray(undefined), [], 'undefined -> []');
eq(A.toArray('nta-left'), ['nta-left'], 'string -> single-item array');
eq(A.toArray(['a', 'b']), ['a', 'b'], 'array is copied');
eq(A.toArray([]), [], 'empty array stays empty');

/* ---------- mergeAlignClass：写 cssclasses ---------- */
eq(A.mergeAlignClass(null, 'center'), ['nta-center'], 'creates cssclasses when missing');
eq(A.mergeAlignClass(['my-class'], 'center'), ['my-class', 'nta-center'],
   "keeps the user's own classes");
eq(A.mergeAlignClass(['nta-left', 'my-class'], 'right'), ['my-class', 'nta-right'],
   'switching alignment replaces the old class');
eq(A.mergeAlignClass('nta-left', 'center'), ['nta-center'], 'accepts the string form');
eq(A.mergeAlignClass(['nta-center'], 'center'), ['nta-center'], 'setting the same value twice is stable');
eq(A.mergeAlignClass(['cta-note-left'], 'center'), ['nta-center'],
   '★ 旧前缀（cta-note-*）会被换成新前缀，不会两套并存');
eq(A.mergeAlignClass(['nta-left', 'cta-note-right'], 'center'), ['nta-center'],
   '新旧两套一起存在时也清干净');
eq(A.mergeAlignClass(['nta-center', 'nta-right', 'keep'], 'left'), ['keep', 'nta-left'],
   'several stale values are all cleared');
eq(A.mergeAlignClass(['nta-center'], null), [], 'clearing leaves an empty array when nothing else is there');
eq(A.mergeAlignClass(['my-class', 'nta-center'], null), ['my-class'],
   'clearing keeps the user own class');

// 前缀是我们家的，但后缀不是我们定义的 ⇒ 不要吃掉用户的类名
eq(A.mergeAlignClass(['nta-blue', 'my-class'], 'left'), ['nta-blue', 'my-class', 'nta-left'],
   '★ 同前缀但后缀不是已知模式 ⇒ 当用户自己的类名留着');
eq(A.isOurs('nta-center'), true, 'isOurs: 已知模式');
eq(A.isOurs('nta-blue'), false, 'isOurs: 未知后缀不算我们的');
eq(A.isOurs('cta-note-left'), true, 'isOurs: 旧前缀也算');
eq(A.isOurs('my-class'), false, 'isOurs: 别人的类名');
eq(A.isOurs('ntaleft'), false, 'isOurs: 前缀必须带连字符');

/* ---------- alignFromClasses：读当前对齐（给右键打勾） ---------- */
eq(A.alignFromClasses(['nta-center']), 'center', 'reads the current alignment');
eq(A.alignFromClasses('nta-left'), 'left', 'accepts the string form');
eq(A.alignFromClasses(['my-class', 'nta-justify']), 'justify', 'picks ours out of a list');
eq(A.alignFromClasses(['cta-note-right']), 'right', '★ 读得出旧前缀（老笔记照样打勾）');
eq(A.alignFromClasses(['nta-left', 'cta-note-right']), 'left', '新前缀优先于旧前缀');
eq(A.alignFromClasses(['my-class']), null, 'only user classes -> null');
eq(A.alignFromClasses([]), null, 'empty -> null');
eq(A.alignFromClasses(null), null, 'null -> null');
eq(A.alignFromClasses(undefined), null, 'undefined -> null');
eq(A.alignFromClasses(['nta-']), null, 'prefix without a suffix -> null');
eq(A.alignFromClasses(['nta-bogus']), null, 'unknown suffix -> null');
eq(A.alignFromClasses(['ntaleft']), null, 'prefix without hyphen -> null');

/* ---------- 模式表 ---------- */
eq(A.MODES.map(function (m) { return m.key; }), ['left', 'center', 'right', 'justify'],
   '四种水平对齐，顺序稳定（顺序变了会改变右键菜单的肌肉记忆）');
eq(Object.keys(A.MODE_BY_KEY).length, 4, 'MODE_BY_KEY 覆盖全部四种');
eq(A.MODES.filter(function (m) { return m.key === 'justify'; }).length, 1,
   '笔记保留两端对齐（真 Markdown，段落会折行）');
A.MODES.forEach(function (m) {
  eq(typeof m.label === 'string' && m.label.length > 0 && m.label.length <= 4, true,
     '标签够短：' + m.key);
  eq(typeof m.icon === 'string' && m.icon.length > 0, true, '有图标：' + m.key);
  eq(A.MODE_BY_KEY[m.key] === m, true, 'MODE_BY_KEY 指回同一个对象：' + m.key);
});

/* ---------- 常量契约 ---------- */
eq(A.PREFIX, 'nta-', '★ 类名前缀是稳定接口 —— 改了已有笔记就失效');
eq(A.LEGACY_PREFIX, 'cta-note-', '旧前缀仍是 cta-note-（Canvas Node Align 写的那个）');
eq(A.MENU_TITLE, '笔记对齐', '右键里那一项叫「笔记对齐」');
eq(A.JUSTIFY_LAST_CLS, 'nta-justify-last', 'body 开关类名');
eq(A.DEFAULT_SETTINGS.justifyLast, false, '末行拉满默认关闭');
eq(/^[a-z-]+$/.test(A.PREFIX), true, '前缀只用小写字母和连字符');

/* ---------- 整份加载（假 require）：类体里写错会在这里炸 ---------- */
const stub = function (id) {
  if (id === 'obsidian') {
    return {
      Plugin: function () {}, PluginSettingTab: function () {},
      Setting: function () {}, Notice: function () {}, Menu: function () {}
    };
  }
  throw new Error('unexpected require: ' + id);
};
const mod = { exports: {} };
new Function('require', 'module', 'exports', src)(stub, mod, {});
eq(typeof mod.exports, 'function', 'module.exports 是插件类（Obsidian 靠它加载）');
eq(typeof mod.exports.__pure, 'object', '纯函数挂载成功（整份文件能解析）');
eq(mod.exports.__pure.MODES.length, 4, '挂载出去的 MODES 就是那四种');

/* ---------- 接线守卫 ----------
 * 这些都是"改坏了不会报错、只会静默少功能"的类型，而且只能在真机上观察，
 * 所以在这里钉住源码里的关键痕迹。 */
eq(src.indexOf("on('editor-menu'") >= 0, true,
   '★ 注册的是 editor-menu —— 笔记的右键是这套事件，挂别人的没用');
eq(src.indexOf("file.extension !== 'md'") >= 0, true,
   '★★ 必须判 .md：白板里双击卡片也会进编辑态，给 .canvas 写 frontmatter 会毁文件');
eq(src.indexOf('processFrontMatter') >= 0, true, '用 processFrontMatter 写（保留其它字段）');
const srcCode = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
eq((srcCode.match(/processFrontMatter/g) || []).length, 1,
   '真正写 frontmatter 的只有一处（注释里提到不算）');
eq(src.indexOf('addSeparator') >= 0, true, '右键里有一分隔线把「清除」分开');

// 提交规则：不联网、不用 Node 内置模块、命令 id 不能重复插件 id
eq(/fetch\s*\(|XMLHttpRequest|requestUrl/.test(src), false, '不联网');
eq(/eval\s*\(/.test(src), false, '不用 eval');
eq(/new Function/.test(src), false, '不用 new Function（混淆/动态代码的特征）');
const requires = src.match(/require\(['"][^'"]+['"]\)/g) || [];
eq(requires, ["require('obsidian')"], '只 require obsidian，不用 Node 内置模块');
eq(src.indexOf("id: 'note-text-align") >= 0, false, '命令 id 不重复插件 id');
eq(src.indexOf("id: 'align-'") >= 0, true, '命令 id 用 align- 前缀');

/* ---------- 样式守卫 ---------- */
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, '');

eq(/:has\s*\(/.test(cssNoComment), false, 'styles.css 规则里没有 :has(（目录的 CSS LINT 会警告）');
// 注释里也不能出现它的完整字面形式（带括号那个）：tools/build.mjs 扫的是**原文**，
// 注释里出现同样会报警告 —— 所以这里连原文一起断言。
eq(/:has\s*\(/.test(css), false, 'styles.css 原文里（含注释）都不出现那个伪类');
eq(/\s!important/.test(cssNoComment), false, '不用 !important（不跟用户的主题/片段打架）');

// 四种对齐：新前缀和旧前缀各一套，每套都要同时覆盖渲染态和 CM6
A.MODES.forEach(function (m) {
  const want = [
    '.' + A.PREFIX + m.key + ' .markdown-preview-view.markdown-rendered',
    '.' + A.PREFIX + m.key + ' .markdown-source-view.mod-cm6 .cm-content',
    '.' + A.PREFIX + m.key + ' .markdown-source-view.mod-cm6 .cm-line'
  ];
  want.forEach(function (sel) {
    eq(cssNoComment.indexOf(sel) >= 0, true, '有这条选择器：' + sel);
  });
  eq(new RegExp('\\n\\.' + A.LEGACY_PREFIX + m.key + ' \\.markdown-preview-view').test(cssNoComment), true,
     '旧类名 ' + A.LEGACY_PREFIX + m.key + ' 也在（老笔记不能突然失去对齐）');
  eq(new RegExp('\\.' + A.PREFIX + m.key + '[^{]*\\{[^}]*text-align:\\s*' + m.key).test(cssNoComment), true,
     '这条规则真的写了 text-align: ' + m.key);
});

// 末行拉满那条规则：类名必须和 main.js 里的常量一致
eq(cssNoComment.indexOf('body.' + A.JUSTIFY_LAST_CLS) >= 0, true,
   'body 上的开关类名和 CSS 对得上：' + A.JUSTIFY_LAST_CLS);
eq(/\.nta-justify .markdown-preview-view[^{]*\{[^}]*text-align-last:\s*justify/.test(cssNoComment), true,
   '末行拉满只打在两端对齐上，不影响其它三种');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
