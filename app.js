// ===== 学生综合事务助手 · 交互逻辑 v3（哈希路由 + 二级子页面） =====

let curDept = 'wenli';       // 当前学部（影响问答与子页面）
let activeTab = 'qa';        // 当前主标签
let savedScroll = 0;
let navStack = [];           // 站内导航栈（子页面返回只在本站内回退）
let pickedComp = null;       // 从竞赛对照表回填的竞赛
let sheetComp = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const deptName = (id) => (DEPARTMENTS.find(d => d.id === id) || {}).name || id;
const deptIdBy = (name) => (DEPARTMENTS.find(d => d.name === name) || {}).id;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

// ============================================================
// 一、路由
// ============================================================
const TABS = ['qa', 'course', 'baoyan', 'scholar', 'transfer', 'calendar'];

function parseHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  return raw.split('/').filter(Boolean);
}

function showTab(tab) {
  if (!TABS.includes(tab)) tab = 'qa';
  activeTab = tab;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $('page-' + tab);
  if (el) el.classList.add('active');
  const nb = document.querySelector(`#nav button[data-tab="${tab}"]`);
  if (nb && nb.scrollIntoView) nb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function go(hash) {
  if (location.hash === hash) { route(); return; }
  location.hash = hash;
}

function goBack() {
  // 有站内上一页就回上一页，否则回到当前主标签
  if (navStack.length > 1) {
    navStack.pop();
    const h = navStack[navStack.length - 1];
    if (location.hash === h) route();
    else location.hash = h;
    return;
  }
  go('#/' + activeTab);
}

function route() {
  const h = location.hash || '#/qa';
  const last = navStack[navStack.length - 1];
  if (last !== h) {
    // 浏览器前进/后退命中栈中上一条 → 出栈；其余视为新页面入栈
    if (navStack.length > 1 && navStack[navStack.length - 2] === h) navStack.pop();
    else navStack.push(h);
  }

  const p = parseHash();
  if (!p.length) { closeSub(null, true); showTab('qa'); return; }
  if (p[0] === 'dept' && p[1]) {
    showTab(activeTab);
    if (p[2]) renderCollegePage(p[1], p.slice(2).join('/'));
    else renderDeptPage(p[1]);
    return;
  }
  if (p[0] === 'scholar' && p[1]) { showTab('scholar'); renderScholarPage(p.slice(1).join('/')); return; }
  if (p[0] === 'comp') { showTab('baoyan'); renderCompPage(); return; }
  if (TABS.includes(p[0])) { closeSub(null, true); showTab(p[0]); return; }
  showTab('qa');
}

window.addEventListener('hashchange', route);

// 顶部主标签：点击即切换主页面（关闭所有子页面）
document.querySelectorAll('#nav button').forEach(b => {
  const tab = b.dataset.tab;
  b.addEventListener('click', () => go('#/' + tab));
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('#/' + tab); }
  });
});

// ---------- 子页面容器 ----------
function openSub(title, crumb, html) {
  const sp = $('subpage');
  const wasOpen = sp.classList.contains('open');
  $('subTitle').innerHTML = esc(title) + (crumb ? `<span class="sub-crumb">${esc(crumb)}</span>` : '');
  $('subBody').innerHTML = html;
  if (!wasOpen) {
    savedScroll = window.scrollY || 0;
    document.body.classList.add('locked');
    sp.classList.add('open');
    sp.setAttribute('aria-hidden', 'false');
  }
  $('subBody').scrollTop = 0;
}

function closeSub(restore, immediate) {
  const sp = $('subpage');
  closeTabMenu();
  if (!sp.classList.contains('open')) return;
  sp.classList.remove('open');
  sp.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('locked');
  if (restore !== null && !immediate) window.scrollTo(0, savedScroll);
}

// ---------- 子页面内的主页面切换菜单 ----------
const TAB_META = [
  ['qa', '💬', '政策问答'], ['course', '🗺️', '课程地图'], ['baoyan', '🏅', '推免自测'],
  ['scholar', '💰', '奖学金'], ['transfer', '🔁', '转专业'], ['calendar', '📅', '事务日历']
];

function renderTabMenu() {
  const box = $('subTabMenu');
  box.innerHTML = '<div class="mt">切换主页面</div>' + TAB_META.map(([id, ic, n]) =>
    `<button data-tab="${id}" class="${id === activeTab ? 'on' : ''}"><span>${ic}</span><span>${n}</span></button>`
  ).join('');
  box.querySelectorAll('button').forEach(b => {
    b.onclick = () => { closeTabMenu(); go('#/' + b.dataset.tab); };
  });
}

function closeTabMenu() {
  const box = $('subTabMenu');
  if (!box) return;
  box.classList.remove('open');
  const t = $('subTabs');
  if (t) t.setAttribute('aria-expanded', 'false');
}

$('subTabs').onclick = (e) => {
  e.stopPropagation();
  const box = $('subTabMenu');
  const willOpen = !box.classList.contains('open');
  if (willOpen) { renderTabMenu(); box.classList.add('open'); }
  else closeTabMenu();
  $('subTabs').setAttribute('aria-expanded', String(willOpen));
};

document.addEventListener('click', (e) => {
  const box = $('subTabMenu');
  if (box && box.classList.contains('open') && !box.contains(e.target) && e.target !== $('subTabs')) closeTabMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('sheet').classList.contains('open')) { closeSheet(); return; }
  closeTabMenu();
});

$('subBack').onclick = goBack;
$('subHome').onclick = () => { closeTabMenu(); go('#/' + activeTab); };

// ============================================================
// 二、学部切换 + 学部 / 学院子页面
// ============================================================
function renderDeptBar() {
  const bar = $('deptBar');
  bar.innerHTML = DEPARTMENTS.map(d =>
    `<button class="dept-btn ${d.id === curDept ? 'active' : ''}" data-dept="${d.id}">
      <span class="ic">${d.icon}</span>${esc(d.name)}
      <span class="go">查看学部 ›</span>
    </button>`
  ).join('');
  bar.querySelectorAll('.dept-btn').forEach(b => {
    b.onclick = () => {
      curDept = b.dataset.dept;
      renderDeptBar();
      renderQASuggest();
      doQA();
      go('#/dept/' + curDept);
    };
  });
}

// 学部下属学院（合并四类数据源，保持稳定顺序）
function collegesOf(deptId) {
  const dn = deptName(deptId);
  const set = [];
  const add = (c) => { if (c && !set.includes(c)) set.push(c); };
  Object.keys(COLLEGE_META).forEach(c => { if (COLLEGE_META[c].dept === dn) add(c); });
  Object.keys(COURSE_MAP[dn] || {}).forEach(add);
  Object.keys(BAOYAN[dn] || {}).forEach(add);
  Object.entries(TRANSFER).forEach(([c, v]) => { if (v.dept === deptId) add(c); });
  return set;
}

function metaOf(college, deptId) {
  const dn = deptName(deptId);
  if (COLLEGE_META[college]) return COLLEGE_META[college];
  const majors = Object.keys(COURSE_MAP[dn]?.[college]?.majors || {});
  return { dept: dn, majors: majors.length ? majors : (BAOYAN[dn]?.[college]?.majors || []), desc: '', tags: [] };
}

function collegeBadges(college, deptId) {
  const dn = deptName(deptId);
  const out = [];
  if (COURSE_MAP[dn]?.[college]) out.push({ t: '培养方案', on: true });
  if (DETAIL_COURSES[college]) out.push({ t: '精细目录', on: true, gold: true });
  if (BAOYAN[dn]?.[college]) out.push({ t: '推免规则', on: true });
  if (TRANSFER[college]) out.push({ t: '转专业', on: true });
  return out;
}

function renderDeptPage(deptId) {
  const dep = DEPARTMENTS.find(d => d.id === deptId);
  if (!dep) { go('#/qa'); return; }
  const meta = DEPT_META[deptId] || { slogan: '', desc: dep.desc };
  const colleges = collegesOf(deptId);
  let majorCount = 0, detailCount = 0;
  colleges.forEach(c => {
    const m = metaOf(c, deptId);
    majorCount += m.majors.length;
    if (DETAIL_COURSES[c]) detailCount += Object.keys(DETAIL_COURSES[c]).length;
  });

  let html = `<div class="hero">
    <h2>${dep.icon} ${esc(dep.name)}</h2>
    <div class="slg">${esc(meta.slogan || '')}</div>
    <p>${esc(meta.desc || dep.desc)}</p>
    <div class="hero-stats">
      <div class="stat"><b>${colleges.length}</b><span>学院 / 培养单位</span></div>
      <div class="stat"><b>${majorCount}</b><span>收录专业方向</span></div>
      <div class="stat"><b>${detailCount}</b><span>精细课程目录</span></div>
      <div class="stat"><b>${colleges.filter(c => BAOYAN[dep.name]?.[c]).length}</b><span>含推免细则</span></div>
    </div>
  </div>`;

  html += `<div class="sec-title">🏫 学院与培养单位<span class="line"></span></div>`;
  html += '<div class="college-grid">';
  colleges.forEach(c => {
    const m = metaOf(c, deptId);
    const bs = collegeBadges(c, deptId);
    html += `<div class="college-card" role="button" tabindex="0" data-college="${esc(c)}">
      <div class="cc-top">
        <div class="cc-name">${esc(c)}</div>
        <div class="cc-arrow">›</div>
      </div>
      <div class="cc-major">${esc(m.majors.slice(0, 4).join(' · ') || '专业信息待补充')}${m.majors.length > 4 ? ' 等' : ''}</div>
      <div class="badges">${bs.map(b => `<span class="badge ${b.on ? 'on' : ''} ${b.gold ? 'gold' : ''}">${b.t}</span>`).join('')}</div>
    </div>`;
  });
  html += '</div>';

  html += `<div class="notice green" style="margin-top:18px">📌 点击任一学院进入学院子页面，可查看培养方案学分结构、推免规则原文摘要、转专业条件与时间线，并一键跳到对应工具。</div>`;

  openSub(dep.name, '学部总览 · ' + colleges.length + ' 个培养单位', html);

  $('subBody').querySelectorAll('.college-card').forEach(card => {
    const open = () => go('#/dept/' + deptId + '/' + encodeURIComponent(card.dataset.college));
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}

function renderCollegePage(deptId, college) {
  const dep = DEPARTMENTS.find(d => d.id === deptId);
  if (!dep) { go('#/qa'); return; }
  const dn = dep.name;
  const m = metaOf(college, deptId);
  const plan = COURSE_MAP[dn]?.[college];
  const by = BAOYAN[dn]?.[college];
  const tr = TRANSFER[college];
  const det = DETAIL_COURSES[college];

  let html = `<div class="hero">
    <h2>${esc(college)}</h2>
    <div class="slg">${esc(dn)} · ${esc((m.tags || []).join(' / ') || '培养单位')}</div>
    <p>${esc(m.desc || '该学院资料正在补充中，可先查看培养方案与推免规则。')}</p>
    <div class="maj-chips">${m.majors.map(x => `<span>${esc(x)}</span>`).join('')}</div>
  </div>`;

  // 培养方案
  html += '<div class="info-block"><h3>🗺️ 培养方案与学分结构</h3>';
  if (plan) {
    const majors = Object.keys(plan.majors || {});
    const palette = ['#2f5d3a', '#4a8257', '#7ba888', '#1f8a70', '#c8891a', '#8a5fb4'];
    html += `<div class="ib-body">已收录 ${majors.length} 个专业/方向的学分结构${m.majors.length > majors.length ? `（学院共 ${m.majors.length} 个）` : ''}${det ? `，其中 <b>${Object.keys(det).length}</b> 个已精细到逐门课程` : ''}。</div>`;
    majors.slice(0, 4).forEach((mj, mi) => {
      const p = plan.majors[mj];
      const mods = p.modules || [];
      const total = mods.reduce((s, x) => s + x.credits, 0);
      html += `<div class="plan-row"><div class="plan-head"><b>${esc(mj)}</b><span>约 ${total} 学分 · ${mods.length} 模块</span></div>`;
      html += '<div class="stack-bar">' + mods.map((m, i) =>
        `<i style="width:${(m.credits / total * 100).toFixed(1)}%;background:${palette[i % palette.length]}" title="${esc(m.name)} ${m.credits} 学分"></i>`).join('') + '</div>';
      if (mi === 0) {
        html += '<div class="stack-legend">' + mods.map((m, i) =>
          `<span><i class="dot" style="background:${palette[i % palette.length]}"></i>${esc(m.name)} ${m.credits}</span>`).join('') + '</div>';
      }
      html += '</div>';
    });
    if (majors.length > 4) html += `<div class="ib-body" style="margin-top:6px;color:var(--ink-3)">另有 ${majors.length - 4} 个专业，可在课程地图中查看。</div>`;
    html += `<button class="btn ghost" style="margin-top:12px" data-act="toCourse">在课程地图中打开 ›</button>`;
  } else {
    html += '<div class="ib-body">该学院暂未收录培养方案学分结构，可先参考学校大类培养要求。</div>';
  }
  html += '</div>';

  // 推免
  html += '<div class="info-block"><h3>🏅 推免规则摘要</h3>';
  if (by) {
    html += `<div class="ib-body">${esc(by.rule)}</div>`;
    if (by.note) html += `<div class="notice" style="margin:10px 0 0">📌 ${esc(by.note)}</div>`;
    html += `<div class="ib-body" style="margin-top:8px;color:var(--ink-3);font-size:12.5px">推免专业：${by.majors.map(esc).join(' / ')}</div>`;
    html += `<button class="btn ghost" style="margin-top:12px" data-act="toBaoyan">用该学院规则做自测 ›</button>`;
  } else {
    html += '<div class="ib-body">该学院推免细则尚未收录。可先用学校统一口径（课程成绩 90% + 学术活动 10%）做估算，或查看同学部其他学院的具体规则。</div>';
    html += `<button class="btn ghost" style="margin-top:12px" data-act="toBaoyan">用通用模型自测 ›</button>`;
  }
  html += '</div>';

  // 转专业
  html += '<div class="info-block"><h3>🔁 转专业 / 转学院</h3>';
  if (tr) {
    html += '<ul>' + tr.reqs.map(r => `<li>${esc(r.t)} <span class="tag gray" style="font-size:10.5px;padding:0 6px">${esc(r.type)}</span></li>`).join('') + '</ul>';
    html += `<div class="notice" style="margin-top:10px">🚫 不予受理：${esc(tr.forbid)}</div>`;
    if (tr.extra) html += `<div class="ib-body" style="margin-top:6px">${esc(tr.extra)}</div>`;
    html += `<div class="ib-body" style="margin-top:10px"><b>办理时间线</b></div><div class="timeline" style="margin-top:8px">`;
    tr.timeline.forEach(t => { html += `<div class="tl-item"><div class="d">${esc(t.d)}</div><div class="t">${esc(t.t)}</div></div>`; });
    html += '</div>';
    html += `<button class="btn ghost" style="margin-top:10px" data-act="toTransfer">打开转专业决策器 ›</button>`;
  } else {
    html += '<div class="ib-body">该学院转专业实施细则暂未收录。学校统一规定：二年级及以下、在校满一学期、无违纪、通过学院考核即可申请，具体名额与考核方式以学院当年通知为准。</div>';
    html += `<button class="btn ghost" style="margin-top:12px" data-act="toTransfer">查看已收录学院的完整流程 ›</button>`;
  }
  html += '</div>';

  openSub(college, dn + ' · 学院详情', html);

  const act = (name, fn) => {
    const btn = $('subBody').querySelector(`[data-act="${name}"]`);
    if (btn) btn.onclick = fn;
  };
  act('toCourse', () => { setCourse(deptId, college); go('#/course'); });
  act('toBaoyan', () => {
    if (BAOYAN[dn]?.[college]) setBaoyan(deptId, college);
    go('#/baoyan');
  });
  act('toTransfer', () => {
    if (TRANSFER[college]) setTransfer(deptId, college);
    go('#/transfer');
  });
}

// ============================================================
// 三、政策问答
// ============================================================
function renderQASuggest() {
  const box = $('qaSuggest');
  const list = QA_SUGGEST[curDept] || [];
  box.innerHTML = '';
  list.forEach(q => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = q;
    b.onclick = () => { $('qaInput').value = q; doQA(q); };
    box.appendChild(b);
  });
  const dep = DEPARTMENTS.find(d => d.id === curDept);
  $('qaSub').innerHTML = `当前【<b>${dep.name}</b>】· 输入问题或点击高频问题，答案基于已整理的学部通知与细则。想知道该学部有哪些学院？<a href="#/dept/${curDept}" style="color:var(--primary);font-weight:600">查看学部总览 ›</a>`;
}

function findQA(text) {
  const t = text || '';
  let best = null, bestScore = 0;
  const pool = QA.filter(item => item.dept === curDept);
  for (const item of pool) {
    let score = 0;
    for (const k of item.k) if (t.includes(k)) score += k.length * 10;
    if (t.includes(item.q)) score += 100;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best;
}

function doQA(text) {
  const box = $('qaResult');
  const t = (text || $('qaInput').value).trim();
  if (!t) { box.innerHTML = ''; return; }
  const item = findQA(t);
  if (item) {
    box.innerHTML = `<div class="ans-card"><h3>${item.q}</h3><div class="cat"><span class="tag">${item.cat}</span></div><div>${item.a}</div><div class="src">📎 来源：${item.src}</div></div>`;
  } else {
    const dep = DEPARTMENTS.find(d => d.id === curDept);
    box.innerHTML = `<div class="ans-card"><h3>未找到精确匹配</h3><div>当前【${dep.name}】未找到相关答案。你可以换关键词，或<a href="#/dept/${curDept}" style="color:var(--primary)">进入学部总览</a>查看已收录的学院与规则。</div></div>`;
  }
}
$('qaBtn').onclick = () => doQA();
$('qaInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doQA(); });

// ============================================================
// 四、课程地图
// ============================================================
const ccDept = $('courseDept');
const ccCollege = $('courseCollege');
const ccMajor = $('courseMajor');

function initCourse() {
  ccDept.innerHTML = Object.keys(COURSE_MAP).map(d => `<option>${esc(d)}</option>`).join('');
  renderCourseCollege();
}
function renderCourseCollege() {
  const colleges = Object.keys(COURSE_MAP[ccDept.value] || {});
  ccCollege.innerHTML = colleges.map(c => `<option>${esc(c)}</option>`).join('');
  renderCourseMajor();
}
function renderCourseMajor() {
  const majorsObj = COURSE_MAP[ccDept.value]?.[ccCollege.value]?.majors || {};
  ccMajor.innerHTML = Object.keys(majorsObj).map(m => `<option>${esc(m)}</option>`).join('');
  renderCourse();
}
function setCourse(deptId, college) {
  const dn = deptName(deptId);
  if (!COURSE_MAP[dn]) return;
  ccDept.value = dn;
  renderCourseCollege();
  if (COURSE_MAP[dn][college]) { ccCollege.value = college; renderCourseMajor(); }
}

function renderCourse() {
  const plan = COURSE_MAP[ccDept.value]?.[ccCollege.value]?.majors?.[ccMajor.value];
  const notice = $('courseNotice'), chart = $('courseChart'), check = $('courseCheck');
  if (!plan) {
    notice.textContent = '该学院/专业暂无课程地图数据。';
    chart.innerHTML = ''; check.innerHTML = '';
    return;
  }
  const det = (typeof DETAIL_COURSES !== 'undefined') && DETAIL_COURSES[ccCollege.value]?.[ccMajor.value];
  if (det) { renderDetailCourse(det, notice, chart, check); return; }

  notice.textContent = plan.notice;
  const total = plan.modules.reduce((s, m) => s + m.credits, 0);
  const colors = ['#2f5d3a', '#3f7149', '#4a8257', '#1f8a70', '#c8891a', '#8a5fb4'];
  let html = `<div style="font-size:13px;color:var(--ink-3);margin-bottom:12px">总学分要求：<b style="color:var(--ink);font-size:18px">${total}</b> 学分，共 ${plan.modules.length} 个模块</div>`;
  html += '<div style="display:flex;flex-direction:column;gap:12px">';
  plan.modules.forEach((m, i) => {
    const pct = Math.round(m.credits / total * 100);
    html += `<div><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px"><span><b>${m.name}</b></span><span style="color:var(--ink-3)">${m.credits} 学分 · ${pct}%</span></div>`;
    html += `<div class="bar" style="margin:0"><i style="width:${pct}%;background:${colors[i % colors.length]}"></i></div></div>`;
  });
  html += '</div>';
  chart.innerHTML = html;

  let ch = '<div style="margin-top:24px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">✅ 已修课程勾选（核对进度）</div><div class="grid g3">';
  plan.courses.forEach((c, i) => {
    ch += `<label style="display:flex;align-items:center;gap:8px;font-weight:400;font-size:14px;cursor:pointer;margin:4px 0"><input type="checkbox" class="cc-course" data-mod="${c.module}" data-cid="${i}" style="width:auto">${c.name}</label>`;
  });
  ch += '</div><div id="ccSummary" style="margin-top:16px"></div></div>';
  check.innerHTML = ch;

  document.querySelectorAll('.cc-course').forEach(cb => {
    cb.onchange = () => {
      const cnt = {};
      plan.modules.forEach(m => cnt[m.name] = { has: 0, n: 0 });
      plan.courses.forEach(c => { cnt[c.module].n++; });
      document.querySelectorAll('.cc-course:checked').forEach(c => { cnt[c.dataset.mod].has++; });
      const sum = $('ccSummary');
      let sh = '<div style="border-top:1px solid var(--line);padding-top:14px"><div style="font-weight:700;margin-bottom:8px">进度概览（按已勾课程占该模块课程数估算）</div>';
      plan.modules.forEach(m => {
        const d = cnt[m.name];
        const pct = d.n ? Math.round(d.has / d.n * 100) : 0;
        const color = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--gold)' : 'var(--red)';
        sh += `<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0"><span>${m.name}</span><span style="color:${color};font-weight:600">${d.has}/${d.n} 门 (${pct}%)</span></div>`;
      });
      sh += '</div>';
      sum.innerHTML = sh;
    };
  });
}
ccDept.onchange = renderCourseCollege;
ccCollege.onchange = renderCourseMajor;
ccMajor.onchange = renderCourse;

function renderDetailCourse(det, notice, chart, check) {
  notice.innerHTML = `📘 <b>精细课程目录</b>（逐门比对官方培养方案：学分 / 学时 / 修读学期 / 必修选修。<b>学时取自方案原表</b>，个别未标注学时的课程按 1 学分=16 学时折算）<br>${det.notice}`;
  const colors = ['#2f5d3a', '#3f7149', '#4a8257', '#1f8a70', '#c8891a', '#8a5fb4'];
  const total = det.total || det.modules.reduce((s, m) => s + m.credits, 0);
  const modSum = det.modules.reduce((s, x) => s + x.credits, 0);

  let html = `<div style="font-size:13px;color:var(--ink-3);margin-bottom:12px">总学分要求：<b style="color:var(--ink);font-size:18px">${total}</b> 学分 · ${det.modules.length} 个模块 · ${det.groups.reduce((s, g) => s + g.courses.length, 0)} 门课程</div>`;
  html += '<div style="display:flex;flex-direction:column;gap:10px">';
  det.modules.forEach((m, i) => {
    const pct = Math.round(m.credits / modSum * 100);
    html += `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span><b>${m.name}</b></span><span style="color:var(--ink-3)">${m.credits} 学分 · ${pct}%</span></div>`;
    html += `<div class="bar" style="margin:0"><i style="width:${pct}%;background:${colors[i % colors.length]}"></i></div></div>`;
  });
  html += '</div>';
  chart.innerHTML = html;

  const reqCnt = det.groups.filter(g => g.req).reduce((s, g) => s + g.courses.length, 0);
  const eleCnt = det.groups.filter(g => !g.req).reduce((s, g) => s + g.courses.length, 0);
  let ch = '<div style="margin-top:20px"><div style="font-size:14px;font-weight:700;margin-bottom:4px">📋 课程目录（可横向/纵向滑动查看）</div>';
  ch += '<div class="ct-stats">';
  ch += `<div class="pill">必修 <b>${reqCnt}</b> 门</div><div class="pill">选修 <b>${eleCnt}</b> 门</div><div class="pill">合计 <b>${reqCnt + eleCnt}</b> 门</div>`;
  ch += '</div>';
  ch += '<div class="course-tabs"><button class="on" data-f="all">全部</button><button data-f="req">仅必修</button><button data-f="elec">仅选修</button></div>';
  ch += '<div class="course-table-wrap"><table class="course-table"><thead><tr>';
  ch += '<th style="width:34px">已修</th><th>课程名称</th><th>类别</th><th style="text-align:center">学分</th><th style="text-align:center">总学时</th><th style="text-align:center">修读学期</th><th style="text-align:center">性质</th>';
  ch += '</tr></thead><tbody>';
  let gid = 0;
  det.groups.forEach((g) => {
    const gidx = gid++;
    ch += `<tr class="ct-group-row" data-grp="${gidx}"><td colspan="7">${g.req ? '🔴 必修 · ' : '⚪ 选修 · '}${g.name}</td></tr>`;
    g.courses.forEach((c) => {
      const name = Array.isArray(c) ? c[0] : c;
      const cr = Array.isArray(c) ? c[1] : 0;
      const hrs = Array.isArray(c) && c[2] ? c[2] : Math.round(cr * 16);
      const term = Array.isArray(c) && c[3] ? c[3] : '—';
      ch += `<tr data-grp="${gidx}" data-req="${g.req ? 1 : 0}">`;
      ch += `<td><input type="checkbox" class="det-ck" data-cr="${cr}" style="width:auto" aria-label="标记已修"></td>`;
      ch += `<td><b>${name}</b></td>`;
      ch += `<td style="color:var(--ink-3);font-size:12.5px">${g.name.split('（')[0]}</td>`;
      ch += `<td class="num" style="text-align:center">${cr}</td>`;
      ch += `<td class="num" style="text-align:center">${hrs}</td>`;
      ch += `<td style="text-align:center;color:var(--ink-3)">${term}</td>`;
      ch += `<td style="text-align:center"><span class="req-badge ${g.req ? 'req-yes' : 'req-no'}">${g.req ? '必修' : '选修'}</span></td>`;
      ch += '</tr>';
    });
  });
  ch += '</tbody></table></div>';
  ch += '<div id="detSummary" style="margin-top:14px"></div></div>';
  check.innerHTML = ch;

  document.querySelectorAll('.course-tabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.course-tabs button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const f = btn.dataset.f;
      document.querySelectorAll('.course-table tbody tr[data-grp]').forEach(tr => {
        const isGroup = tr.classList.contains('ct-group-row');
        if (isGroup) {
          const grp = tr.dataset.grp;
          const has = f === 'all' || [...document.querySelectorAll(`.course-table tbody tr[data-grp="${grp}"][data-req]`)].some(r => f === 'req' ? r.dataset.req === '1' : r.dataset.req === '0');
          tr.style.display = has ? '' : 'none';
        } else {
          const req = tr.dataset.req;
          tr.style.display = (f === 'all' || (f === 'req' ? req === '1' : req === '0')) ? '' : 'none';
        }
      });
    };
  });

  const upd = () => {
    let totalCk = 0, nCk = 0;
    document.querySelectorAll('.det-ck:checked').forEach(c => { totalCk += Number(c.dataset.cr); nCk++; });
    const sum = $('detSummary');
    let sh = '<div style="border-top:1px solid var(--line);padding-top:14px"><div style="font-weight:700;margin-bottom:8px">已修进度</div>';
    sh += `<div style="font-size:13.5px;margin-bottom:8px">已勾选 <b>${nCk}</b> 门课程，累计 <b style="color:var(--primary)">${totalCk}</b> 学分${det.total ? ` / 毕业要求 ${det.total} 学分` : ''}</div>`;
    if (det.total) {
      const pct = Math.min(100, Math.round(totalCk / det.total * 100));
      const color = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--gold)' : 'var(--red)';
      sh += `<div class="bar"><i style="width:${pct}%;background:${color}"></i></div><div style="font-size:12px;color:var(--ink-3);margin-top:4px">毕业学分进度 ${pct}%</div>`;
    }
    det.groups.forEach((g, gi) => {
      let ck = 0, n = 0;
      document.querySelectorAll('.det-ck').forEach(c => {
        const tr = c.closest('tr');
        if (tr && tr.dataset.grp === String(gi) && c.checked) { ck += Number(c.dataset.cr); n++; }
      });
      if (n) sh += `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0"><span>${g.name}</span><span style="color:var(--primary);font-weight:600">${n} 门 · ${ck} 学分</span></div>`;
    });
    sh += '</div>';
    sum.innerHTML = sh;
  };
  document.querySelectorAll('.det-ck').forEach(c => c.onchange = upd);
}

// ============================================================
// 五、推免自测 + 竞赛对照表
// ============================================================
const byDept = $('byDept');
const byCollege = $('byCollege');
const byMajor = $('byMajor');

function initBaoyan() {
  byDept.innerHTML = Object.keys(BAOYAN).map(d => `<option>${esc(d)}</option>`).join('');
  renderByCollege();
}
function renderByCollege() {
  const colleges = Object.keys(BAOYAN[byDept.value] || {});
  byCollege.innerHTML = colleges.map(c => `<option>${esc(c)}</option>`).join('');
  renderByMajor();
}
function renderByMajor() {
  const info = BAOYAN[byDept.value]?.[byCollege.value];
  byMajor.innerHTML = (info?.majors || []).map(m => `<option>${esc(m)}</option>`).join('');
  renderByRule();
}
function renderByRule() {
  const info = BAOYAN[byDept.value]?.[byCollege.value];
  const ruleBox = $('byRuleBox');
  if (ruleBox && info) {
    ruleBox.innerHTML = `<div class="notice" style="margin:0 0 14px">📌 ${esc(info.rule)}<br><span style="opacity:.8">${esc(info.note || '')}</span></div>`;
  } else if (ruleBox) {
    ruleBox.innerHTML = '';
  }
}
function setBaoyan(deptId, college) {
  const dn = deptName(deptId);
  if (!BAOYAN[dn]) return;
  byDept.value = dn;
  renderByCollege();
  if (BAOYAN[dn][college]) { byCollege.value = college; renderByMajor(); }
}

const COMP_LEVELS = ['国家级一等奖及以上', '国家级二等奖', '国家级三等奖', '省级一等奖', '省级二等奖', '省级三等奖'];
const LEVEL_TO_SELECT = { '国家级一等奖及以上': '12', '国家级二等奖': '10', '国家级三等奖': '8', '省级一等奖': '8', '省级二等奖': '6', '省级三等奖': '4' };

function renderPickedComp() {
  const box = $('byCompPicked');
  if (!box) return;
  if (!pickedComp) { box.className = 'picked'; box.innerHTML = ''; return; }
  box.className = 'picked show';
  box.innerHTML = `<span>🏅 已选竞赛：<b>${esc(pickedComp.name)}</b>（${pickedComp.c} 类 · 权重 ${pickedComp.w}）</span>
    <span class="tag gold">${esc(pickedComp.level)}</span>
    <span class="tag teal">参考加分 ${pickedComp.base}</span>
    <span class="x" id="clearComp">✕</span>`;
  $('clearComp').onclick = () => { pickedComp = null; renderPickedComp(); };
}

function applyComp(comp, level) {
  pickedComp = {
    name: comp.n, c: comp.c, w: comp.w, level,
    base: (COMP_BASE[comp.c][level] * comp.w).toFixed(2)
  };
  $('byComp').value = LEVEL_TO_SELECT[level];
  renderPickedComp();
  closeSheet();
  go('#/baoyan');
  setTimeout(() => {
    const b = $('byCompPicked');
    if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 340);
}

function openSheet(comp) {
  sheetComp = comp;
  $('shTitle').textContent = comp.n;
  $('shSub').textContent = `${comp.c} 类赛事 · 赛事权重 ${comp.w} · 选择你的最高获奖等级（参考加分 = ${comp.c} 类基准 × 权重）`;
  $('shLevels').innerHTML = COMP_LEVELS.map(lv => {
    const base = (COMP_BASE[comp.c][lv] * comp.w).toFixed(2);
    return `<button data-lv="${lv}">${lv}<br><span style="font-size:11px;color:var(--ink-3)">参考加分 ${base}</span></button>`;
  }).join('');
  $('shLevels').querySelectorAll('button').forEach(b => b.onclick = () => applyComp(comp, b.dataset.lv));
  $('sheet').classList.add('open');
}
function closeSheet() { $('sheet').classList.remove('open'); sheetComp = null; }
$('shCancel').onclick = closeSheet;
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });

function calcBaoyan() {
  const rank = Number($('byRank').value);
  const zr = Number($('byZr').value);
  const comp = Number($('byComp').value);
  const paper = Number($('byPaper').value);
  const cadre = Number($('byCadre').value);
  const honor = Number($('byHonor').value);
  const info = BAOYAN[byDept.value]?.[byCollege.value];
  const result = $('byResult');

  if (!rank || !zr) {
    result.className = 'result show';
    result.innerHTML = `<div style="color:var(--red)">请填写课程成绩排名与综合测评排名（1-100）。</div>`;
    return;
  }

  const rankScore = Math.max(0, Math.round((1 - rank / 100) * 50));
  const zrScore = Math.max(0, Math.round((1 - zr / 100) * 20));
  const bonus = Math.min(30, comp + paper + cadre + honor);
  const total = Math.round(rankScore + zrScore + bonus);

  let level, levelColor, suggest;
  if (total >= 75) { level = '竞争力较强，推免希望大'; levelColor = 'var(--green)'; suggest = '保持成绩，重点巩固竞赛/论文优势，关注学院推免名额与加分细则。'; }
  else if (total >= 60) { level = '竞争力一般，接近基准线'; levelColor = 'var(--gold)'; suggest = '建议优先补齐短板：若竞赛/论文加分为 0，可争取一项 II 类赛事国家级奖或一作论文；排名偏后需提升绩点。'; }
  else { level = '竞争力偏弱，需重点提升'; levelColor = 'var(--red)'; suggest = '差距主要在课程成绩与综测，建议先抓绩点，同时从“权重高、可规划”的竞赛入手（数模、节能减排、GIS 开发组等）。'; }

  const detail = [
    ['课程成绩基础分', rankScore, 50],
    ['综合测评基础分', zrScore, 20],
    ['竞赛/论文/干部/荣誉加分', bonus, 30]
  ];

  result.className = 'result show';
  let html = `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px"><span class="score-big">${total}</span><span class="score-unit">/ 100 分</span></div>`;
  html += `<div style="font-size:15px;font-weight:700;color:${levelColor};margin-bottom:12px">${level}</div>`;
  html += `<div class="bar"><i style="width:${total}%"></i></div>`;
  html += '<div style="margin-top:16px">';
  detail.forEach(([n, v, max]) => {
    html += `<div style="display:flex;justify-content:space-between;font-size:13.5px;margin:6px 0"><span>${n}</span><span style="color:var(--ink-2)">${v} / ${max}</span></div>`;
  });
  html += '</div>';
  if (pickedComp) {
    html += `<div class="notice green" style="margin-top:14px">🏅 竞赛依据：<b>${esc(pickedComp.name)}</b>（${pickedComp.c} 类 · 权重 ${pickedComp.w} · ${esc(pickedComp.level)}），按学院口径参考加分约 <b>${pickedComp.base}</b> 分，已计入上方加分项。</div>`;
  }
  html += `<div class="notice" style="margin-top:14px">💡 ${suggest}</div>`;
  if (info) {
    html += `<div style="font-size:12px;color:var(--ink-3);margin-top:8px">本专业推免规则：${esc(info.rule)}</div>`;
  }
  html += `<div class="btn-row" style="margin-top:14px"><button class="btn ghost" id="resOpenComp">看看还有哪些竞赛能加分 ›</button></div>`;
  result.innerHTML = html;
  $('resOpenComp').onclick = () => go('#/comp');
}
byDept.onchange = renderByCollege;
byCollege.onchange = renderByMajor;
byMajor.onchange = renderByRule;
$('byBtn').onclick = calcBaoyan;
$('openComp').onclick = () => go('#/comp');

// ---------- 竞赛对照表子页面 ----------
const CS = { q: '', cat: '全部', sort: 'weight' };

function compFiltered() {
  const q = CS.q.trim().toLowerCase();
  let list = COMPETITIONS.filter(c => {
    if (CS.cat !== '全部' && c.c !== CS.cat) return false;
    if (!q) return true;
    return (c.n + c.org + c.note + c.f.join('')).toLowerCase().includes(q);
  });
  if (CS.sort === 'weight') list = list.slice().sort((a, b) => b.w - a.w || a.c.localeCompare(b.c));
  else if (CS.sort === 'diff') list = list.slice().sort((a, b) => b.d - a.d);
  return list;
}

function renderCompPage() {
  let html = `<details class="fold"><summary>口径说明（点开／收起）</summary><div class="fd">
    武汉大学推免认定的学科竞赛分 <b>Ⅰ类</b>（中国国际大学生创新大赛、挑战杯课赛/创赛、全国大学生数学建模竞赛、全国大学生电子设计竞赛，共 5 项）与 <b>Ⅱ类</b>（2022 年及以前学校立项、2023 年及以后学校认定的赛事，可参考全国普通高校大学生竞赛榜单）。<br>
    “参考加分”按资源与环境科学学院 2025 版加分表计算：Ⅰ类国家级一等 4 / 二等 3 / 三等 2，省部级 1.5 / 1.2 / 1；Ⅱ类国家级一等 1.5 / 1 / 0.8，省部级 0.4 / 0.3 / 0.2，再乘以赛事权重。各学院口径与上限不同（信管Ⅱ类累计 ≤8 分、资环活动加分合计 ≤4 分），最终以本学院当年细则为准。
  </div></details>`;
  html += `<div class="search-row"><input id="compSearch" type="text" placeholder="搜索竞赛名称 / 主办单位，如：数学建模、GIS、蓝桥"></div>`;
  html += `<div class="course-tabs" id="compCatTabs">
    <button class="${CS.cat === '全部' ? 'on' : ''}" data-cat="全部">全部 ${COMPETITIONS.length}</button>
    <button class="${CS.cat === 'I' ? 'on' : ''}" data-cat="I">Ⅰ类 ${COMPETITIONS.filter(c => c.c === 'I').length}</button>
    <button class="${CS.cat === 'II' ? 'on' : ''}" data-cat="II">Ⅱ类 ${COMPETITIONS.filter(c => c.c === 'II').length}</button>
  </div>`;
  html += `<div class="search-row" style="margin-top:10px;align-items:center">
    <select id="compSort" style="max-width:220px">
      <option value="weight" ${CS.sort === 'weight' ? 'selected' : ''}>按赛事权重排序</option>
      <option value="diff" ${CS.sort === 'diff' ? 'selected' : ''}>按获奖难度排序</option>
      <option value="name" ${CS.sort === 'name' ? 'selected' : ''}>按名称排序</option>
    </select>
    <span style="font-size:12px;color:var(--ink-3)" id="compCount"></span>
  </div>`;
  html += '<div class="comp-wrap"><table class="comp-table"><thead><tr><th>竞赛名称 / 说明</th><th>类别</th><th>权重</th><th>国一参考</th><th>难度</th><th>适配方向</th><th></th></tr></thead><tbody id="compBody"></tbody></table></div>';
  html += '<div class="comp-cards" id="compCards"></div>';
  html += `<div class="notice green" style="margin-top:14px">💡 选好竞赛后点「用于自测」，系统会把获奖等级回填到推免自测卡，并把参考加分计入结果。</div>`;

  openSub('学科竞赛对照表', COMPETITIONS.length + ' 项赛事 · Ⅰ/Ⅱ 类认定与参考加分', html);

  const renderRows = () => {
    const list = compFiltered();
    $('compBody').innerHTML = list.map(c => `
      <tr>
        <td><div class="cn">${esc(c.n)}</div><div class="cnote">${esc(c.note)}</div></td>
        <td><span class="${c.c === 'I' ? 'cat1' : 'cat2'}">${c.c === 'I' ? 'Ⅰ类' : 'Ⅱ类'}</span></td>
        <td class="num">${c.w}</td>
        <td class="num">${(COMP_BASE[c.c]['国家级一等奖及以上'] * c.w).toFixed(2)}</td>
        <td class="num">${'●'.repeat(c.d)}</td>
        <td style="font-size:12px;color:var(--ink-2)">${c.f.join(' / ')}</td>
        <td><button class="mini-btn" data-i="${COMPETITIONS.indexOf(c)}">用于自测</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty">没有匹配的竞赛</td></tr>';

    $('compCards').innerHTML = list.map(c => `
      <div class="comp-card">
        <div class="cc-head">
          <span class="${c.c === 'I' ? 'cat1' : 'cat2'}">${c.c === 'I' ? 'Ⅰ类' : 'Ⅱ类'}</span>
          <span class="cc-w">权重 ${c.w} · ${esc(c.org)}</span>
        </div>
        <div class="cc-name">${esc(c.n)}</div>
        <div class="cc-note">${esc(c.note)}</div>
        <div class="cc-meta">
          <span>国一参考 <b>${(COMP_BASE[c.c]['国家级一等奖及以上'] * c.w).toFixed(2)}</b> 分</span>
          <span>难度 <b style="color:var(--gold)">${'●'.repeat(c.d)}</b></span>
        </div>
        <div class="cc-foot">
          <span class="cc-fit">适配：${c.f.join(' / ')}</span>
          <button class="mini-btn" data-i="${COMPETITIONS.indexOf(c)}">用于自测</button>
        </div>
      </div>`).join('') || '<div class="empty">没有匹配的竞赛，换个关键词试试</div>';

    $('compCount').textContent = `共 ${list.length} 项`;
    document.querySelectorAll('#compBody .mini-btn, #compCards .mini-btn').forEach(b => {
      b.onclick = () => openSheet(COMPETITIONS[Number(b.dataset.i)]);
    });
  };

  const si = $('compSearch');
  si.value = CS.q;
  si.oninput = () => { CS.q = si.value; renderRows(); };
  $('compSort').onchange = (e) => { CS.sort = e.target.value; renderRows(); };
  $('compCatTabs').querySelectorAll('button').forEach(b => b.onclick = () => {
    CS.cat = b.dataset.cat;
    $('compCatTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderRows();
  });
  renderRows();
}

// ============================================================
// 六、奖学金（模拟器 + 图鉴 + 详情子页）
// ============================================================
const SS = { q: '', cat: '全部', lvl: 'all' };

function checkScholar(s, rank, zr, fail, poor) {
  const c = s.check || {};
  if (c.newOnly) return { pass: true, reason: '面向新生/研究生，按入学或入学后评审，详见介绍页' };
  if (c.noFail && fail) return { pass: false, reason: '存在不及格科目，不符合' };
  if (c.poor && !poor) return { pass: false, reason: '需已建档家庭经济困难学生' };
  if (c.rank != null && (rank === null || rank === '' || isNaN(rank))) return { pass: false, reason: '请填写成绩排名' };
  if (c.rank != null && rank > c.rank) return { pass: false, reason: `需成绩前 ${c.rank}%（当前 ${rank}%）` };
  if (c.zr != null && (zr === null || zr === '' || isNaN(zr))) return { pass: false, reason: '请填写综测排名' };
  if (c.zr != null && zr > c.zr) return { pass: false, reason: `需综测前 ${c.zr}%（当前 ${zr}%）` };
  const bits = [];
  if (c.rank != null) bits.push(`成绩前 ${c.rank}%`);
  if (c.zr != null) bits.push(`综测前 ${c.zr}%`);
  if (c.poor) bits.push('已建档困难');
  if (c.noFail) bits.push('无不及格');
  return { pass: true, reason: `符合基本门槛（${bits.join('、') || '见详情'}），仍需学院评审排序` };
}

function calcScholar() {
  const rankRaw = $('scRank').value, zrRaw = $('scZr').value;
  const rank = rankRaw === '' ? null : Number(rankRaw);
  const zr = zrRaw === '' ? null : Number(zrRaw);
  const fail = $('scFail').value === '1';
  const poor = $('scPoor').value === '1';
  const result = $('scResult');

  result.className = 'result show';
  let html = '<div style="font-size:15px;font-weight:700;margin-bottom:14px">📋 各奖种资格评定结果</div>';
  let matched = 0;
  const rows = SCHOLAR2.map(s => ({ s, r: checkScholar(s, rank, zr, fail, poor) }));
  rows.sort((a, b) => (b.r.pass - a.r.pass) || (b.s.lvl - a.s.lvl));
  rows.forEach(({ s, r }) => {
    if (r.pass) matched++;
    const ok = r.pass;
    html += `<div class="check-item"><div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;${ok ? 'background:#e3f5ec;color:var(--green)' : 'background:#fdeaea;color:var(--red)'}">${ok ? '✓' : '✗'}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:14.5px">${esc(s.n)} <span class="tag gold" style="margin-left:6px">${esc(s.amtTxt)}</span></div>
      <div style="font-size:13px;color:var(--ink-2)">${esc(r.reason)}</div>
      <a href="#/scholar/${encodeURIComponent(s.n)}" style="font-size:12px;color:var(--primary)">查看详情 ›</a></div></div>`;
  });
  html += `<div style="margin-top:14px;font-size:13.5px;color:var(--ink-2)">共 <b style="color:var(--primary)">${matched}</b> / ${SCHOLAR2.length} 个奖种符合（或接近）基本条件。</div>`;
  html += '<div style="font-size:12px;color:var(--ink-3);margin-top:8px">提示：通过门槛 ≠ 获奖。专项奖学金通常还要求“已获优秀学生奖学金”，并按学院志愿与排序竞争，请以学院正式通知为准。</div>';
  result.innerHTML = html;
}
$('scBtn').onclick = calcScholar;

function scholarFiltered() {
  const q = SS.q.trim().toLowerCase();
  return SCHOLAR2.filter(s => {
    if (SS.cat !== '全部' && s.cat !== SS.cat) return false;
    if (SS.lvl === 'high' && s.lvl < 4) return false;
    if (SS.lvl === 'mid' && s.lvl !== 3) return false;
    if (SS.lvl === 'low' && s.lvl > 2) return false;
    if (!q) return true;
    return (s.n + s.cat + s.scope + s.intro + (s.tags || []).join('') + s.conds.join('')).toLowerCase().includes(q);
  });
}

function renderScholarCatalog() {
  const tabs = $('schCatTabs');
  const list = $('schList');
  if (!tabs || !list) return;
  const cats = ['全部', ...Object.keys(SCHOLAR_CATS2)];
  tabs.innerHTML = cats.map(c => `<button class="${SS.cat === c ? 'on' : ''}" data-cat="${c}">${c}${c === '全部' ? ' ' + SCHOLAR2.length : ' ' + SCHOLAR2.filter(s => s.cat === c).length}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => {
    SS.cat = b.dataset.cat;
    tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });

  const lvBox = $('schLvlTabs');
  const lvOpts = [['all', '难度不限'], ['high', '冲一冲（4★以上）'], ['mid', '稳一稳（3★）'], ['low', '低门槛（2★以下）']];
  lvBox.innerHTML = lvOpts.map(([v, t]) => `<button class="chip ${SS.lvl === v ? 'on' : ''}" data-lvl="${v}">${t}</button>`).join('');
  lvBox.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    SS.lvl = b.dataset.lvl;
    lvBox.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });

  $('schSearch').oninput = (e) => { SS.q = e.target.value; paint(); };

  function paint() {
    const items = scholarFiltered();
    $('schCount').textContent = `共 ${items.length} 项` + (SS.cat !== '全部' ? ` · ${SCHOLAR_CATS2[SS.cat] || ''}` : '');
    list.innerHTML = items.map(s => `
      <div class="sch-card" role="button" tabindex="0" data-name="${esc(s.n)}">
        <div class="sc-name">${esc(s.n)}</div>
        <div class="sc-meta">${esc(s.cat)} · ${esc(s.scope)}</div>
        <div class="sc-intro">${esc(s.intro)}</div>
        <div class="sc-row">
          <span class="sc-amt">${esc(s.amtTxt)}</span>
          <span class="stars">${stars(s.lvl)}</span>
        </div>
        <div class="sc-foot">
          <span style="font-size:11.5px;color:var(--ink-3)">点开看条件 / 流程 / 材料</span>
          <span class="tag">查看详解 ›</span>
        </div>
      </div>`).join('') || '<div class="empty">没有匹配的奖项，换个关键词试试</div>';
    list.querySelectorAll('.sch-card').forEach(card => {
      const open = () => go('#/scholar/' + encodeURIComponent(card.dataset.name));
      card.onclick = open;
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    });
  }
  paint();
}

function renderScholarPage(name) {
  const s = SCHOLAR2.find(x => x.n === name);
  if (!s) { openSub('未找到该奖项', '', '<div class="empty">该奖项不在当前数据中，请返回图鉴重新选择。</div>'); return; }
  let html = `<div class="hero">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <h2 style="flex:1">${esc(s.n)}</h2>
      <div style="text-align:right"><div style="font-size:19px;font-weight:800;color:var(--gold)">${esc(s.amtTxt)}</div><div class="stars" style="margin-top:2px">${stars(s.lvl)}</div></div>
    </div>
    <div class="slg">${esc(s.cat)} · ${esc(s.scope)}</div>
    <div class="maj-chips">${(s.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
  </div>`;

  html += `<div class="info-block"><h3>💡 这是什么奖</h3><div class="ib-body">${esc(s.intro)}</div></div>`;

  html += '<div class="info-block"><h3>✅ 申请条件</h3><ol style="margin:6px 0 0 18px;font-size:13.5px;color:var(--ink-2);line-height:1.8">';
  s.conds.forEach(c => { html += `<li>${esc(c)}</li>`; });
  html += '</ol></div>';

  html += '<div class="info-block"><h3>🗓️ 评审流程</h3><div class="timeline" style="margin-top:10px">';
  s.process.forEach((p, i) => { html += `<div class="tl-item"><div class="d">STEP ${i + 1}</div><div class="t">${esc(p)}</div></div>`; });
  html += '</div></div>';

  html += '<div class="info-block"><h3>📎 材料清单</h3><ul>';
  s.mat.forEach(m => { html += `<li>${esc(m)}</li>`; });
  html += '</ul></div>';

  html += `<div class="info-block"><h3>🎯 名额与来源</h3>
    <div class="ib-body"><b>名额：</b>${esc(s.quota)}<br><b>来源：</b>${esc(s.src)}</div></div>`;

  html += `<div class="notice" style="margin-top:4px">💬 <b>经验建议：</b>${esc(s.tip)}</div>`;
  html += `<div class="btn-row"><button class="btn" data-act="try">用我的排名测算一下</button></div>`;

  openSub(s.n, '奖学金图鉴 · ' + s.cat, html);
  const btn = $('subBody').querySelector('[data-act="try"]');
  if (btn) btn.onclick = () => {
    const r = $('scRank');
    if (r && !r.value) r.value = (s.check && s.check.rank) ? s.check.rank : '';
    go('#/scholar');
    setTimeout(() => { $('scRank') && $('scRank').focus(); }, 260);
  };
}

// ============================================================
// 七、转专业
// ============================================================
const trDept = $('trDept');
const trCollege = $('trCollege');

const transferDepts = [...new Set(Object.values(TRANSFER).map(t => t.dept))];
trDept.innerHTML = transferDepts.map(d => `<option value="${d}">${deptName(d)}</option>`).join('');

function renderTrCollege() {
  const list = Object.entries(TRANSFER).filter(([, v]) => v.dept === trDept.value);
  trCollege.innerHTML = list.map(([k]) => `<option>${esc(k)}</option>`).join('');
}

function setTransfer(deptId, college) {
  if (![...trDept.options].some(o => o.value === deptId)) return;
  trDept.value = deptId;
  renderTrCollege();
  if (TRANSFER[college] && TRANSFER[college].dept === deptId) trCollege.value = college;
  doTransfer();
}

function doTransfer() {
  const plan = TRANSFER[trCollege.value];
  const result = $('trResult');
  if (!plan) return;
  result.className = 'result show';
  let html = '<div style="font-size:15px;font-weight:700;margin-bottom:12px">✅ 转入资格自检</div>';
  plan.reqs.forEach(r => {
    html += `<div class="check-item"><div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff3e0;color:var(--gold)">?</div><div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(r.t)}</div><div><span class="tag">${esc(r.type)}</span></div></div></div>`;
  });
  html += `<div class="notice" style="margin-top:12px">🚫 不予受理情形：${esc(plan.forbid)}</div>`;
  if (plan.extra) html += `<div class="notice green">📋 补充说明：${esc(plan.extra)}</div>`;
  html += '<div style="font-size:15px;font-weight:700;margin:18px 0 12px">🗓️ 办理时间线</div><div class="timeline">';
  plan.timeline.forEach(t => {
    html += `<div class="tl-item"><div class="d">${esc(t.d)}</div><div class="t">${esc(t.t)}</div></div>`;
  });
  html += '</div>';
  const depId = plan.dept;
  html += `<div class="btn-row" style="margin-top:10px"><button class="btn ghost" id="trToCollege">查看该学院详情 ›</button></div>`;
  result.innerHTML = html;
  const b = $('trToCollege');
  if (b) b.onclick = () => go('#/dept/' + depId + '/' + encodeURIComponent(trCollege.value));
}
trDept.onchange = () => { renderTrCollege(); doTransfer(); };
trCollege.onchange = doTransfer;
$('trBtn').onclick = doTransfer;

// ============================================================
// 八、日历
// ============================================================
function daysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function renderCalendar(filter) {
  const cats = ['全部', ...new Set(CAL_EVENTS.map(e => e.cat))];
  const fbox = $('calFilter');
  fbox.innerHTML = cats.map(c => `<button class="chip ${c === filter ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  fbox.querySelectorAll('.chip').forEach(b => b.onclick = () => renderCalendar(b.dataset.cat));

  const events = CAL_EVENTS
    .filter(e => filter === '全部' || filter === undefined || e.cat === filter)
    .sort((a, b) => a.date.localeCompare(b.date));

  const tl = $('calTimeline');
  tl.innerHTML = '<div class="timeline">' + (events.map(e => {
    const d = daysUntil(e.date);
    let badge = '', cls = '';
    if (d < 0) badge = `<span class="ddl-badge" style="background:var(--ink-3)">已过期</span>`;
    else if (d <= 7) { badge = `<span class="ddl-badge">${d === 0 ? '今天' : '剩 ' + d + ' 天'}</span>`; cls = 'urgent'; }
    else badge = `<span class="ddl-badge" style="background:var(--primary)">剩 ${d} 天</span>`;
    return `<div class="tl-item ${cls}"><div class="d">${e.date}${badge}</div><div class="t">${esc(e.title)}</div><span class="tag teal" style="margin-top:6px">${esc(e.cat)}</span></div>`;
  }).join('') || '<div class="empty">该分类暂无事项</div>') + '</div>';
}

// ============================================================
// 九、初始化
// ============================================================
renderDeptBar();
renderQASuggest();
initCourse();
initBaoyan();
renderTrCollege();
renderCalendar('全部');
renderScholarCatalog();
renderPickedComp();
route();
