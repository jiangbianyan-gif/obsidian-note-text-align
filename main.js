'use strict';

/* ============================================================================
   Note Text Align —— Markdown 笔记正文的水平对齐
   Note Text Align — horizontal text alignment for Markdown note bodies
   ----------------------------------------------------------------------------
   由来：这个功能原本长在 Canvas Node Align（白板卡片对齐）里，两件事混在一个
        插件里。现在拆开 —— 白板的归白板，笔记的归笔记，各自只做一件事。

   设计原则：插件只往 frontmatter 写一个类名，渲染一律交给 CSS。

   ★ 笔记只有**水平**一个方向。
     白板卡片之所以有垂直对齐（顶部/居中/底部），是因为卡片有固定高度、
     文字可能比卡片矮。整篇笔记没有这个问题：它本来就从顶部开始、按需滚动。
     给长文做"垂直居中"没有意义，所以这里只有 4 种水平对齐。

   ★ 怎么实现：往笔记 frontmatter 的 cssclasses 里写一个 nta-<key>
       cssclasses: [nta-center]
     · 正文一个字符都不动（比"往文字里插标记"干净得多）
     · 「属性」面板里看得见，删掉那一行就还原
     · 代价：卸载插件后 CSS 没了，对齐会回到左对齐（见 README 已知限制）

   ★ 两个入口，同一套逻辑：
       · 在笔记里右键 →「笔记对齐 ▸」，当前生效的那项打勾
       · 命令面板 → 笔记正文：左对齐 / 居中 / 右对齐 / 两端对齐 / 清除
     ★ 右键只在**编辑视图**（实时预览 / 源码模式）出现：阅读视图里没有编辑器，
       editor-menu 事件不会触发。阅读视图下请用命令面板。

   ★★ 安全红线：写 frontmatter 之前必须确认目标是 .md
      白板里双击卡片也会进入编辑态（同样是 CodeMirror），editor-menu 在那种
      情况下也可能触发，此时 info.file 是 .canvas 而不是 .md。
      给 .canvas 写 YAML frontmatter 会把白板的 JSON 直接毁掉 ——
      见 registerMenu() 里那行扩展名判断，**改代码时不要删**。

   ★ 旧类名兼容：这个功能以前由 Canvas Node Align 提供，写的类名是 cta-note-*。
     本插件读得出旧类名，但不主动改用户文件；等他在那篇笔记上重新点一次对齐，
     类名就会换成 nta-*。

   用到的 Obsidian 接口（都是公开 API）：
     workspace.on('editor-menu', (menu, editor, info) => ...)
     app.metadataCache.getFileCache(file).frontmatter   // 同步读，给当前项打勾
     app.fileManager.processFrontMatter(file, fm => ...) // 写 frontmatter，会保留其它字段
     menu.addItem(i => i.setTitle(..).setSubmenu().addItem(..)) / addSeparator()
     item 上的 setTitle / setIcon / setSection / setChecked / onClick
   ============================================================================ */

const { Plugin, PluginSettingTab, Setting, Notice, Menu } = require('obsidian');


/* ══════════════════════════════════════════════════════════ 常量表 */

// 四种水平对齐。key 同时是 frontmatter 类名的后缀和命令 id 的后半截。
// 图标名对着 obsidian.asar 自带的那套核实过（可以不带 lucide- 前缀）。
const MODES = [
  { key: 'left',    label: '左对齐',   icon: 'align-left' },
  { key: 'center',  label: '居中',     icon: 'align-center' },
  { key: 'right',   label: '右对齐',   icon: 'align-right' },
  { key: 'justify', label: '两端对齐', icon: 'align-justify' }
];
const MODE_BY_KEY = {};
MODES.forEach(function (m) { MODE_BY_KEY[m.key] = m; });

/* 本插件写进 frontmatter 的类名前缀。
   ★ 这是稳定接口 —— 已经写进用户笔记的类名改不得，改了老笔记就失效。 */
const PREFIX = 'nta-';

/* 旧前缀（只读兼容）：同一个功能以前由 Canvas Node Align 写，用的是 cta-note-*。
   只读不改写 —— 用户重新点一次对齐时自然会换成新前缀。 */
const LEGACY_PREFIX = 'cta-note-';

// 右键里那一项的标题。笔记里动的是整篇笔记，所以不沿用卡片那边的叫法。
const MENU_TITLE = '笔记对齐';

// 「两端对齐时最后一行也拉满」开启时挂在 body 上的类名（CSS 里对应一条规则）
const JUSTIFY_LAST_CLS = 'nta-justify-last';

// 出厂设置。justifyLast 是唯一的设置项，说明见设置面板。
const DEFAULT_SETTINGS = {
  justifyLast: false
};


/* ══════════════════════════════════════════════════════════ 纯函数（可单测） */

/* ---------- A. frontmatter 的 cssclasses ---------- */

// cssclasses 可能是字符串、数组，也可能不存在 —— 统一成数组。
function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v.slice() : [v];
}

// 这个类名是不是本插件管的（新前缀或旧前缀，且后缀是我们认识的四种之一）？
// ★ 只认"前缀 + 已知后缀"：用户万一自己写了个 nta-blue 之类的类名，不该被我们吃掉。
//   前缀对但后缀不认识的，留着不管 —— 它没有对应样式，是无害的。
function isOurs(c) {
  const s = String(c);
  const prefixes = [PREFIX, LEGACY_PREFIX];
  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i];
    if (s.indexOf(p) === 0 && MODE_BY_KEY[s.slice(p.length)]) return true;
  }
  return false;
}

/* 算出「设成 mode 后」的 cssclasses 数组；mode 为 null = 只清除。
   ★ 用户自己写的其它类名一律保留，只增删本插件管的那些（新前缀和旧前缀都
     算"我们的" —— 这样切换对齐时旧类名会被一并去掉，不会两套前缀同时存在）。 */
function mergeAlignClass(current, mode) {
  const kept = toArray(current).filter(function (c) { return !isOurs(c); });
  if (mode) kept.push(PREFIX + mode);
  return kept;
}

/* 从 cssclasses 反查这篇笔记当前的对齐，没设过 / 后缀不认识 ⇒ null。
   新前缀优先于旧前缀（两套同时存在时以新为准）。
   ★ 只认自己的前缀，用户自己的类名一概忽略。 */
function alignFromClasses(cssclasses) {
  const list = toArray(cssclasses).map(String);
  const pick = function (prefix) {
    const hit = list.filter(function (c) { return c.indexOf(prefix) === 0; })[0];
    if (!hit) return null;
    const key = hit.slice(prefix.length);
    return MODE_BY_KEY[key] ? key : null;
  };
  return pick(PREFIX) || pick(LEGACY_PREFIX);
}


/* ══════════════════════════════════════════════════════════ 插件本体 */

module.exports = class NoteTextAlign extends Plugin {

  async loadSettings() {
    const raw = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onload() {
    await this.loadSettings();

    // 有没有"给菜单项挂子菜单"的能力（很老的 Obsidian 没有 ⇒ 平铺，不报错）
    this.useSubmenu = canUseSubmenu();

    this.applyBodyClasses();
    this.registerCommands();
    this.registerMenu();
    this.addSettingTab(new NoteTextAlignSettingTab(this.app, this));

    const firstLoad = !this.settings._lastLoad;
    this._loadedAt = new Date().toISOString();
    // 往 data.json 写个戳记：只要它每次都在变，就说明插件真的被加载过。
    // "设置里找不到插件"绝大多数是没关受限模式，这个戳记能把两种情况分开。
    this.settings._lastLoad = this._loadedAt;
    this.settings._lastVersion = (this.manifest && this.manifest.version) || '';
    this.saveSettings();

    console.log('[note-text-align] loaded v' + this.settings._lastVersion);
    if (firstLoad) {
      new Notice('Note Text Align 已启动 —— 在笔记里右键即可看到「笔记对齐」', 6000);
    }
  }

  onunload() {
    // 把挂在 body 上的开关类名撤掉，免得禁用插件后样式还留着
    document.body.classList.remove(JUSTIFY_LAST_CLS);
  }

  // 挂在 body 上的开关类名：两端对齐是否拉满最后一行。
  // 用 body 类名而不是逐篇挂，因为这是"全局排版口味"，不是逐篇设置。
  applyBodyClasses() {
    document.body.classList.toggle(JUSTIFY_LAST_CLS, !!this.settings.justifyLast);
  }


  /* ─────────────────────────────────────────────── 命令面板 */

  registerCommands() {
    // 四种水平对齐 + 清除。checkCallback 的 checking 分支只判断可用性，
    // 所以命令面板里"当前笔记不是 Markdown"时这些项根本不出现。
    MODES.forEach((m) => {
      this.addCommand({
        id: 'align-' + m.key,
        name: '笔记正文：' + m.label,
        checkCallback: (checking) => {
          const file = this.activeMarkdownFile();
          if (!file) return false;
          if (!checking) this.setAlign(file, m.key);
          return true;
        }
      });
    });

    this.addCommand({
      id: 'align-clear',
      name: '笔记正文：清除对齐（恢复默认）',
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) this.setAlign(file, null);
        return true;
      }
    });

    this.addCommand({
      id: 'doctor',
      name: '自检：插件与当前笔记的状态',
      callback: () => this.showDoctor()
    });
  }


  /* ─────────────────────────────────────────────── 右键菜单 */

  /* 笔记的右键菜单。
     ★ 必须挂在 **editor-menu** 上 —— 这是和白板那套 canvas:* 完全不同的事件。
     ★★ 扩展名判断是安全红线，不要删（原因见文件头）。 */
  registerMenu() {
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        if (!menu || typeof menu.addItem !== 'function') return;
        const file = (info && info.file) || this.activeMarkdownFile();
        if (!file || file.extension !== 'md') return;
        this.addAlignMenu(menu, file);
      })
    );
  }

  // 读这篇笔记当前的 cssclasses（同步，metadataCache 里已经是缓存的）。
  // 只用来给当前那一项打勾，读不到就当"没设过"。
  noteClasses(file) {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache && cache.frontmatter;
      return fm ? fm.cssclasses : null;
    } catch (e) {
      return null;
    }
  }

  // 当前生效的对齐（新前缀优先，其次旧前缀）。没设过返回 null。
  currentAlign(file) {
    return alignFromClasses(this.noteClasses(file));
  }

  // 在右键菜单里加「笔记对齐」。子菜单挂不上就平铺 —— 功能一个不少。
  addAlignMenu(menu, file) {
    const current = this.currentAlign(file);
    const pick = (key) => this.setAlign(file, key);
    if (this.useSubmenu) {
      menu.addItem((item) => {
        item.setTitle(MENU_TITLE).setIcon('align-left').setSection('action');
        this.fillItems(item.setSubmenu(), current, pick);
      });
    } else {
      this.fillItems(menu, current, pick, MENU_TITLE);
    }
  }

  // 铺开 4 种对齐 + 分隔线 + 清除。当前生效的打勾；没设过则「清除」打勾。
  fillItems(menu, current, handler, section) {
    MODES.forEach((m) => {
      menu.addItem((item) => {
        item.setTitle(m.label).setIcon(m.icon).setChecked(m.key === current);
        if (section) item.setSection(section);
        item.onClick(() => handler(m.key));
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle('清除（跟随默认）').setIcon('remove-formatting').setChecked(!current);
      if (section) item.setSection(section);
      item.onClick(() => handler(null));
    });
  }


  /* ─────────────────────────────────────────────── 改对齐 */

  /* 写 frontmatter。processFrontMatter 只会动我们改的那个键，
     其余字段（tags / aliases / 用户自己的 cssclasses）原样保留。
     mode 为 null = 清除本插件的类名（顺手把旧前缀也清掉）。 */
  async setAlign(file, mode) {
    if (!file || file.extension !== 'md') return false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const next = mergeAlignClass(fm.cssclasses, mode);
      if (next.length) fm.cssclasses = next;
      else delete fm.cssclasses;
    });
    const name = mode ? (MODE_BY_KEY[mode] || {}).label || mode : '默认（左对齐）';
    new Notice('笔记正文对齐已设为：' + name);
    return true;
  }

  // 当前活动叶子上的 Markdown 笔记（命令面板用）。
  // 右键那条路不依赖它 —— editor-menu 直接把 info.file 给了我们。
  activeMarkdownFile() {
    const leaf = this.app.workspace.activeLeaf;
    const view = leaf && leaf.view;
    if (!view || typeof view.getViewType !== 'function') return null;
    if (view.getViewType() !== 'markdown') return null;
    return view.file || null;
  }

  // 自检：出问题时让用户把这段贴给我，比截图管用
  showDoctor() {
    const v = (this.manifest && this.manifest.version) || '?';
    const file = this.activeMarkdownFile();
    const cur = file ? this.currentAlign(file) : null;
    const lines = [
      'Note Text Align v' + v + ' —— 插件正在运行',
      '本次加载：' + (this._loadedAt || '未知'),
      '右键子菜单：' + (this.useSubmenu ? '支持' : '不支持，已回退为平铺菜单'),
      '当前笔记：' + (file ? file.path : '不在笔记视图'),
      '当前笔记的对齐：' + (file ? (cur ? ((MODE_BY_KEY[cur] || {}).label || cur) : '未设置（跟随默认左对齐）') : '—'),
      '最后一行也拉满：' + (this.settings.justifyLast ? '已开启' : '关闭'),
      '类名前缀：' + PREFIX + '（兼容旧前缀 ' + LEGACY_PREFIX + '）'
    ];
    new Notice(lines.join('\n'), 10000);
  }
};


/* ══════════════════════════════════════════════════════════ 设置面板 */

class NoteTextAlignSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const p = this.plugin;
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Note Text Align' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: '把「笔记正文的横向对齐」写进笔记自己的 frontmatter，绝不改正文内容。'
    });

    containerEl.createEl('h3', { text: '两端对齐' });
    new Setting(containerEl)
      .setName('最后一行也拉满')
      .setDesc('按排版规范，两端对齐**不拉伸最后一行**。开启后连最后一行也拉满' +
               '（text-align-last: justify），短句也会被撑开；英文长段落默认效果已经' +
               '很明显，一般不用开。')
      .addToggle(function (tg) {
        tg.setValue(!!p.settings.justifyLast);
        tg.onChange(async function (v) {
          p.settings.justifyLast = v;
          p.applyBodyClasses();
          await p.saveSettings();
        });
      });

    containerEl.createEl('h3', { text: '怎么用' });
    const tips = containerEl.createEl('div', { cls: 'setting-item-description' });
    tips.createEl('p', { text: '· 在笔记里右键 →「笔记对齐」→ 选一个位置（当前生效的那项打勾）' });
    tips.createEl('p', { text: '· 命令面板 →「笔记正文：左对齐 / 居中 / 右对齐 / 两端对齐 / 清除」' });
    tips.createEl('p', {
      text: '· 右键只在编辑视图（实时预览 / 源码模式）出现 —— 阅读视图里没有编辑器，' +
            '请在命令面板里用'
    });
    tips.createEl('p', {
      text: '· 结果写在笔记 frontmatter 的 cssclasses 里（如 nta-center），' +
            '删掉那行就还原，也支持自己在属性面板里手写'
    });

    containerEl.createEl('h3', { text: '说明' });
    const notes = containerEl.createEl('div', { cls: 'setting-item-description' });
    notes.createEl('p', {
      text: '· 只做笔记正文对齐这一件事。白板卡片 / 分组标签 / 连线标签的对齐请用' +
            '「Canvas Node Align」那个插件'
    });
    notes.createEl('p', { text: '· 全程不联网、不读笔记内容、不改正文' });
    notes.createEl('p', { text: '· 卸载插件后类名还在，但样式没了 ⇒ 会回到左对齐' });
  }
}


/* ══════════════════════════════════════════════════════════ 兼容性封装 */

/* 这台 Obsidian 支不支持「菜单项挂子菜单」。不支持的版本上平铺，不报错也不留死项。
   探针是**真的** new 一个 Menu 加一项试，不是看版本号（版本号猜不准）。
   探针菜单从不 show，所以没有副作用。 */
function canUseSubmenu() {
  try {
    const probe = new Menu();
    let ok = false;
    probe.addItem(function (item) {
      ok = typeof item.setSubmenu === 'function';
    });
    return ok;
  } catch (e) {
    return false;
  }
}


/* ══════════════════════════════════════════════════════════ 导出给单测

   （Obsidian 环境里 module.exports 是插件类，这里只在 Node 下补充挂载） */
module.exports.__pure = {
  toArray, mergeAlignClass, alignFromClasses, isOurs,
  MODES, MODE_BY_KEY, PREFIX, LEGACY_PREFIX, MENU_TITLE, JUSTIFY_LAST_CLS,
  DEFAULT_SETTINGS
};
