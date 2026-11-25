'use strict';
/* ================= DỮ LIỆU ================= */
const CATS = {
  FOOD:['Ăn uống','🍜','#FF7043',0], DRINK:['Trà sữa & nước','🧋','#AB47BC',0], STUDY:['Học tập','📚','#42A5F5',0],
  TRANSPORT:['Đi lại','🛵','#26A69A',0], SHOPPING:['Mua sắm','🛍️','#EC407A',0], GAME:['Giải trí','🎮','#7E57C2',0],
  GIFT:['Quà tặng','🎁','#FFCA28',0], PHONE:['Nạp thẻ / Internet','📱','#5C6BC0',0], HEALTH:['Sức khỏe','💊','#66BB6A',0],
  OTHER:['Khác','✨','#8D6E63',0], ALLOWANCE:['Tiền tiêu vặt','💰','#43A047',1], BONUS:['Thưởng / Lì xì','🧧','#E53935',1],
  PARTTIME:['Làm thêm','💼','#1E88E5',1], OTHER_IN:['Thu khác','🌟','#FFB300',1]
};
const cat = k => { const c = CATS[k] || CATS.OTHER; return {key:k in CATS?k:'OTHER', label:c[0], emoji:c[1], color:c[2], income:!!c[3]}; };
const catsFor = type => Object.keys(CATS).filter(k => !!CATS[k][3] === (type === 'INCOME'));
const RAINBOW = ['#FF5F9E','#FFA94D','#FFE066','#69DB7C','#4DABF7','#9775FA'];
const KEY = 'tieuvat.v1';

let db = { entries: [], settings: { weeklyAllowance:0, weeklyLimit:0, savingGoal:0, savingGoalName:'' } };
function load(){ try{ const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.entries)) db = { entries:s.entries, settings:Object.assign(db.settings, s.settings||{}) }; }catch(e){} }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){ toast('⚠️ Không lưu được dữ liệu'); } }

/* ================= NGÀY & TIỀN ================= */
const pad2 = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return iso(d); };
const weekStart = s => { const d = parse(s); const w = (d.getDay()+6)%7; d.setDate(d.getDate()-w); return iso(d); };
const today = () => iso(new Date());
const dm = s => { const d = parse(s); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`; };
const dmy = s => `${dm(s)}/${parse(s).getFullYear()}`;
const dayName = s => ['CN','T2','T3','T4','T5','T6','T7'][parse(s).getDay()];
const money = v => new Intl.NumberFormat('vi-VN').format(v) + ' ₫';
const signed = v => (v>0?'+':v<0?'−':'') + money(Math.abs(v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);

function week(start){
  const end = addDays(start, 6);
  const list = db.entries.filter(e => e.date >= start && e.date <= end)
    .sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const income = sum(list.filter(e => e.type==='INCOME'), e => e.amount) + (db.settings.weeklyAllowance||0);
  const expense = sum(list.filter(e => e.type==='EXPENSE'), e => e.amount);
  return { start, end, list, income, expense, balance: income - expense };
}
function totalSaved(){
  if (!db.entries.length) return 0;
  let w = weekStart(db.entries.map(e => e.date).sort()[0]); const last = weekStart(today()); let t = 0;
  while (w <= last) { t += week(w).balance; w = addDays(w, 7); }
  return t;
}

/* ================= TRẠNG THÁI GIAO DIỆN ================= */
const state = { tab:0, week: weekStart(today()), q:'', filter:null };
const TABS = [['🏡','Tổng quan','#FF8FAB','#FFB86B'],['📊','Thống kê','#4DABF7','#9775FA'],['📜','Lịch sử','#38D9A9','#69DB7C'],['🐷','Tiết kiệm','#FFD43B','#FF922B']];
const $ = s => document.querySelector(s);
const grad = (a, b, dir='135deg') => `background:linear-gradient(${dir},${a},${b})`;

function toast(msg){ const t = document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 2200); }

function render(){
  $('#nav').innerHTML = TABS.map((t,i) => `<button data-tab="${i}" class="${i===state.tab?'on':''}" style="${i===state.tab?grad(t[2],t[3]):''}"><span class="e">${t[0]}</span>${t[1]}</button>`).join('');
  const app = $('#app');
  app.innerHTML = [homeView, statsView, historyView, savingsView][state.tab]();
}

/* ----- các khối dùng chung ----- */
function weekSelector(){
  const isNow = state.week === weekStart(today());
  return `<div class="card"><div class="row">
    <button class="circle" data-act="prev" aria-label="Tuần trước">◀</button>
    <div class="grow center"><b>${isNow?'🌈 Tuần này':'🗓️ Tuần đã chọn'}</b><div class="small">${dm(state.week)} → ${dmy(addDays(state.week,6))}</div></div>
    <button class="circle" data-act="next" aria-label="Tuần sau">▶</button></div>
    ${isNow?'':'<div class="center"><button class="link" data-act="now">↩ Về tuần này</button></div>'}</div>`;
}
function entryRow(e){
  const c = cat(e.category), inc = e.type==='INCOME';
  return `<div class="entry" data-edit="${e.id}" style="background:linear-gradient(90deg,${c.color}40,rgba(255,255,255,.95) 60%),#fff">
    <div class="ico" style="${grad(c.color, c.color+'99')}">${c.emoji}</div>
    <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${dayName(e.date)} ${dm(e.date)} • ${c.label}${e.note?' • '+esc(e.note):''}</div></div>
    <div class="amt ${inc?'inc':'exp'}">${inc?'+':'−'}${money(e.amount)}</div></div>`;
}
function progress(f, colors){ return `<div class="progress"><div style="width:${Math.max(0,Math.min(1,f))*100}%;background:linear-gradient(90deg,${colors.join(',')})"></div></div>`; }
function advice(s){
  const st = db.settings, t = today();
  const daysLeft = weekStart(t)===s.start ? 6 - ((parse(t).getDay()+6)%7) : 0;
  if (!s.list.length && !s.income) return '🌱 Chưa có giao dịch nào. Bấm nút + tròn để ghi khoản đầu tiên nhé!';
  if (st.weeklyLimit>0 && s.expense>st.weeklyLimit) return '🍂 Đã vượt hạn mức tuần. Những ngày còn lại nên hạn chế mua sắm nhé.';
  if (s.balance<0) return `🍂 Tuần này chi nhiều hơn thu ${money(-s.balance)}. Xem tab Thống kê để biết mục tốn nhất.`;
  if (daysLeft>0 && s.balance>0) return `🌳 Còn ${daysLeft} ngày, bạn có thể tiêu khoảng ${money(Math.floor(s.balance/(daysLeft+1)))}/ngày mà không lỗ.`;
  if (st.weeklyLimit>0) return '🌸 Giữ chi tiêu trong hạn mức rất tốt!';
  return '🌻 Cây tiết kiệm của bạn đang lớn dần. Cố lên!';
}

/* ----- TỔNG QUAN ----- */
function homeView(){
  const s = week(state.week), st = db.settings, b = s.balance;
  const [label, c1, c2, emo] = b>0 ? ['Còn dư (lãi)','#12B886','#4DABF7','🤑'] : b<0 ? ['Bị lỗ (chi vượt thu)','#FA5252','#FD7E14','😱'] : ['Hòa vốn','#845EF7','#5C7CFA','😌'];
  let limit = '';
  if (st.weeklyLimit>0){
    const f = s.expense/st.weeklyLimit;
    limit = `<div style="margin-top:12px" class="small"><b style="color:var(--ink)">🎯 Hạn mức chi tuần: ${money(s.expense)} / ${money(st.weeklyLimit)}</b></div>
      ${progress(f, f<.7?['#69DB7C','#38D9A9']:f<1?['#FFD43B','#FF922B']:['#FF6B6B','#E03131'])}
      ${f>=1?`<div class="warn">⚠️ Đã vượt hạn mức ${money(s.expense-st.weeklyLimit)}!</div>`:''}`;
  }
  return `
  <div class="card"><div class="header"><span class="tree">🌳</span><div><h1 class="title">Kế hoạch thu chi</h1><h1 class="title sub">tiền tiêu vặt của tôi</h1></div></div></div>
  ${installHint()}
  ${weekSelector()}
  <div class="card">
    <div class="tiles">
      <div class="tile" style="${grad('#38D9A9','#69DB7C')}"><b>💵 Thu vào</b><span>${money(s.income)}</span></div>
      <div class="tile" style="${grad('#FF8787','#F783AC')}"><b>🛒 Chi ra</b><span>${money(s.expense)}</span></div>
    </div>
    <div class="big" style="${grad(c1,c2,'90deg')}"><b>${emo} ${label}</b><div class="v">${signed(b)}</div>
      ${st.weeklyAllowance>0?`<div class="tiny" style="color:#fff">Đã gồm tiền tiêu vặt cố định ${money(st.weeklyAllowance)}/tuần</div>`:''}</div>
    ${limit}
    <p style="margin:12px 0 0">${advice(s)}</p>
  </div>
  <div class="pill-title">🧾 Giao dịch trong tuần (${s.list.length})</div>
  ${s.list.length ? s.list.map(entryRow).join('') : '<div class="card">🌼 Trống trơn! Mỗi lần chuyển khoản mua gì, hãy bấm nút + tròn để ghi tên món và số tiền.</div>'}`;
}
function installHint(){
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (standalone) return '';
  return `<div class="card install"><b>📲 Cài lên màn hình chính:</b> trong Safari bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên ↑) → <b>Thêm vào MH chính</b>.</div>`;
}

/* ----- THỐNG KÊ ----- */
function donut(parts, total){
  const R = 54, C = 2*Math.PI*R; let off = 0;
  const arcs = parts.map(([color, v]) => { const len = v/total*C; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${color}" stroke-width="24" stroke-dasharray="${Math.max(len-2,0)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; return s; }).join('');
  return `<svg width="140" height="140" viewBox="0 0 140 140" style="flex:none"><circle r="${R}" cx="70" cy="70" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="24"/>${arcs}
    <text x="70" y="64" text-anchor="middle" font-size="11" fill="#2B2140">Tổng chi</text><text x="70" y="82" text-anchor="middle" font-size="13" font-weight="800" fill="#2B2140">${money(total)}</text></svg>`;
}
function statsView(){
  const s = week(state.week), prev = week(addDays(state.week,-7));
  const exp = s.list.filter(e => e.type==='EXPENSE');
  const byCat = {}; exp.forEach(e => byCat[e.category] = (byCat[e.category]||0) + e.amount);
  const cats = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const days = [...Array(7)].map((_,i) => addDays(state.week,i));
  const per = days.map(d => sum(exp.filter(e => e.date===d), e => e.amount));
  const max = Math.max(1, ...per), mi = per.indexOf(Math.max(...per));
  const diff = s.expense - prev.expense, pct = prev.expense>0 ? Math.round(diff*100/prev.expense) : null;
  const top = [...exp].sort((a,b) => b.amount-a.amount).slice(0,3);
  const weeks = [5,4,3,2,1,0].map(k => week(addDays(state.week,-7*k)));
  return `${weekSelector()}
  <div class="card"><div class="pill-title">🍩 Chi theo danh mục</div>
    <div class="donutwrap">${donut(cats.map(([k,v]) => [cat(k).color, v]), Math.max(s.expense,0))}
      <div class="legend grow">${cats.length ? cats.map(([k,v]) => `<div><span class="dot" style="background:${cat(k).color}"></span>${cat(k).emoji} ${cat(k).label} ${Math.round(v*100/s.expense)}%</div>`).join('') : 'Chưa có khoản chi.'}</div></div></div>
  <div class="card"><div class="pill-title">📊 Chi tiêu từng ngày</div>
    <div class="bars">${per.map((v,i) => `<div title="${money(v)}" style="height:${v/max*100}%;${grad(RAINBOW[i%6],RAINBOW[(i+2)%6],'180deg')}"></div>`).join('')}</div>
    <div class="barl">${days.map(d => `<span>${dayName(d)}</span>`).join('')}</div>
    ${per[mi]>0?`<p class="small">🔥 Tiêu nhiều nhất: ${dayName(days[mi])} (${money(per[mi])})</p>`:''}</div>
  <div class="card"><div class="pill-title">⚖️ So với tuần trước</div>
    <div>Tuần trước chi ${money(prev.expense)}, tuần này ${money(s.expense)}.</div>
    <b class="${diff>0?'exp':'inc'}">${diff>0?`📈 Tiêu nhiều hơn ${money(diff)}${pct!==null?` (+${pct}%)`:''}`:diff<0?`📉 Tiết kiệm hơn ${money(-diff)}${pct!==null?` (${pct}%)`:''}`:'➖ Bằng tuần trước'}</b></div>
  <div class="card"><div class="pill-title">🏆 Top món tốn tiền nhất</div>
    ${top.length ? top.map((e,i) => `<div style="margin:3px 0;font-weight:600">${['🥇','🥈','🥉'][i]} ${esc(e.name)} — ${money(e.amount)}</div>`).join('') : 'Chưa có dữ liệu.'}</div>
  <div class="card"><div class="pill-title">🌿 6 tuần gần nhất</div>
    ${weeks.map(w => `<div class="wk"><span>${dm(w.start)}–${dm(w.end)}</span><span class="exp">chi ${money(w.expense)}</span><b class="${w.balance>=0?'inc':'exp'}">${signed(w.balance)}</b></div>`).join('')}</div>`;
}

/* ----- LỊCH SỬ ----- */
function historyView(){
  return `<div class="card"><h2 class="title">📜 Lịch sử giao dịch</h2>
    <input id="q" type="search" placeholder="🔎 Tìm theo tên, ghi chú, danh mục" value="${esc(state.q)}">
    <div class="pills" style="margin-top:8px">
      ${[[null,'Tất cả','#845EF7','#339AF0'],['EXPENSE','Chi','#FF6B6B','#F06595'],['INCOME','Thu','#20C997','#51CF66']].map(([f,l,a,b]) =>
        `<button class="pill ${state.filter===f?'on':''}" data-filter="${f}" style="${state.filter===f?grad(a,b,'90deg'):''}">${l}</button>`).join('')}
    </div><div id="hsum" class="tiny" style="margin-top:6px"></div></div><div id="hlist"></div>`;
}
function renderHistoryList(){
  const q = state.q.trim().toLowerCase();
  const list = db.entries.filter(e => !state.filter || e.type===state.filter)
    .filter(e => !q || e.name.toLowerCase().includes(q) || (e.note||'').toLowerCase().includes(q) || cat(e.category).label.toLowerCase().includes(q))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('#hsum').textContent = `Tổng chi: ${money(sum(list.filter(e=>e.type==='EXPENSE'),e=>e.amount))} • Tổng thu: ${money(sum(list.filter(e=>e.type==='INCOME'),e=>e.amount))}`;
  let html = '', last = '';
  list.forEach(e => { if (e.date!==last){ last = e.date; html += `<div class="daychip">📅 ${dayName(e.date)}, ${dmy(e.date)}</div>`; } html += entryRow(e); });
  $('#hlist').innerHTML = html || '<div class="card">Không có giao dịch phù hợp.</div>';
}

/* ----- TIẾT KIỆM & THIẾT LẬP ----- */
function savingsView(){
  const st = db.settings, total = totalSaved();
  const goal = st.savingGoal>0 ? `<div style="margin-top:6px">Mục tiêu: ${esc(st.savingGoalName||'Tiết kiệm')} — ${money(st.savingGoal)}</div>
    ${progress(total/st.savingGoal, ['#FFD43B','#FF922B','#F06595'])}<div class="small">${st.savingGoal-total<=0?'🎉 Đã đạt mục tiêu!':'Còn thiếu '+money(st.savingGoal-total)}</div>` : '';
  const mf = (id, label, v, hint='') => `<label class="f" for="${id}">${label}</label><input id="${id}" inputmode="numeric" value="${v>0?v:''}" data-money><div class="hint" data-show="${id}">${v>0?money(v):''}</div>${hint?`<div class="hint">${hint}</div>`:''}`;
  return `<div class="card"><h2 class="title">🐷 Heo đất tiết kiệm</h2>
      <div style="font-size:18px;font-weight:800" class="${total>=0?'inc':'exp'}">Tổng dư tích lũy: ${signed(total)}</div>${goal}</div>
    <div class="card"><h2 class="title">⚙️ Thiết lập</h2>
      ${mf('s-allow','💰 Tiền tiêu vặt cố định mỗi tuần', st.weeklyAllowance, 'Tự động tính vào khoản thu của mỗi tuần. Để trống nếu không cố định.')}
      ${mf('s-limit','🎯 Hạn mức chi tối đa mỗi tuần', st.weeklyLimit)}
      <label class="f" for="s-gname">🎁 Tên mục tiêu (vd: Mua tai nghe)</label><input id="s-gname" maxlength="40" value="${esc(st.savingGoalName)}">
      ${mf('s-goal','🐷 Số tiền mục tiêu', st.savingGoal)}
      <button class="btn" data-act="save-settings" style="${grad('#7950F2','#4DABF7','90deg')}">💾 Lưu thiết lập</button></div>
    <div class="card"><h2 class="title">📤 Chia sẻ & sao lưu</h2>
      <button class="btn" data-act="share" style="${grad('#FF922B','#F06595','90deg')}">📤 Gửi bản tổng kết tuần đang xem</button>
      <button class="btn" data-act="backup" style="${grad('#20C997','#4DABF7','90deg')}">💾 Sao lưu dữ liệu ra file</button>
      <button class="btn" data-act="restore" style="${grad('#845EF7','#E64980','90deg')}">📥 Khôi phục từ file sao lưu</button>
      <input type="file" id="restore-file" accept=".json,application/json" hidden>
      <button class="btn" data-act="clear" style="${grad('#FA5252','#C92A2A','90deg')}">🗑️ Xóa toàn bộ giao dịch</button>
      <p class="tiny">Dữ liệu chỉ lưu trong trình duyệt của máy này. Nên sao lưu thường xuyên: xóa dữ liệu Safari hoặc gỡ app khỏi màn hình chính sẽ mất dữ liệu.</p></div>`;
}
function shareText(){
  const s = week(state.week);
  return `🌳 Tổng kết tiền tiêu vặt ${dm(s.start)}–${dmy(s.end)}\n💵 Thu: ${money(s.income)}\n🛒 Chi: ${money(s.expense)}\n${s.balance>=0?'🤑 Dư: '+money(s.balance):'😱 Lỗ: '+money(-s.balance)}\n\nChi tiết:\n` +
    s.list.map(e => `${dm(e.date)} ${cat(e.category).emoji} ${e.name}: ${e.type==='INCOME'?'+':'−'}${money(e.amount)}`).join('\n');
}

/* ================= HỘP THOẠI THÊM / SỬA ================= */
function openEntry(entry){
  const m = { type: entry?entry.type:'EXPENSE', name: entry?entry.name:'', amount: entry?String(entry.amount):'', category: entry?entry.category:'FOOD', date: entry?entry.date:today(), note: entry?entry.note||'':'' };
  const root = $('#modal-root');
  const draw = () => {
    const tc = m.type==='EXPENSE' ? ['#FF6B6B','#F06595'] : ['#20C997','#51CF66'];
    const amt = parseInt(m.amount||'0',10);
    root.innerHTML = `<div class="modal" data-close><div class="sheet" role="dialog" aria-modal="true">
      <h2 class="title">${entry?'✏️ Sửa giao dịch':m.type==='EXPENSE'?'🛒 Ghi khoản chi':'💵 Ghi khoản thu'}</h2>
      <div class="pills">
        <button class="pill ${m.type==='EXPENSE'?'on':''}" data-type="EXPENSE" style="${m.type==='EXPENSE'?grad('#FF6B6B','#F06595','90deg'):''}">➖ Chi ra</button>
        <button class="pill ${m.type==='INCOME'?'on':''}" data-type="INCOME" style="${m.type==='INCOME'?grad('#20C997','#51CF66','90deg'):''}">➕ Thu vào</button></div>
      <label class="f" for="e-name">${m.type==='EXPENSE'?'Tên món đã mua':'Nguồn tiền'}</label><input id="e-name" maxlength="60" value="${esc(m.name)}" autocomplete="off">
      <label class="f" for="e-amt">Số tiền (₫)</label><input id="e-amt" inputmode="numeric" value="${m.amount}" placeholder="Ví dụ 25000">
      <div class="hint" id="e-amt-show">${amt>0?money(amt):''}</div>
      <div class="quick">${[5000,10000,20000,50000].map((v,i) => `<button data-add="${v}" style="${grad(RAINBOW[i],RAINBOW[i+1])}">+${v/1000}k</button>`).join('')}</div>
      <label class="f">Danh mục</label>
      <div class="cats">${catsFor(m.type).map(k => { const c = cat(k), on = k===m.category; return `<div class="cat" data-cat="${k}" style="border-color:${c.color};${on?`background:${c.color};color:#fff`:`background:${c.color}1f`}"><span class="e">${c.emoji}</span>${c.label}</div>`; }).join('')}</div>
      <label class="f" for="e-date">📅 Ngày</label><input id="e-date" type="date" value="${m.date}">
      <label class="f" for="e-note">Ghi chú (không bắt buộc)</label><input id="e-note" maxlength="120" value="${esc(m.note)}">
      <div class="err" id="e-err"></div>
      <button class="btn" data-save style="${grad(tc[0],tc[1],'90deg')}">💾 Lưu</button>
      ${entry?'<button class="btn" data-del style="background:#fff;color:#FA5252;border:2px solid #FA5252">🗑️ Xóa giao dịch này</button>':''}
      <button class="btn" data-close style="background:#eee;color:#2B2140">Hủy</button></div></div>`;
  };
  const sync = () => { m.name = $('#e-name').value; m.note = $('#e-note').value; m.date = $('#e-date').value || today(); };
  draw();
  root.onclick = ev => {
    const t = ev.target.closest('[data-type],[data-add],[data-cat],[data-save],[data-del],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close') && t !== ev.target && !t.classList.contains('btn')) return; // chỉ đóng khi bấm vào vùng tối
    sync();
    if (t.dataset.type && t.dataset.type!==m.type){ m.type = t.dataset.type; m.category = catsFor(m.type)[0]; draw(); }
    else if (t.dataset.add){ m.amount = String(parseInt(m.amount||'0',10) + Number(t.dataset.add)); draw(); }
    else if (t.dataset.cat){ m.category = t.dataset.cat; draw(); }
    else if (t.hasAttribute('data-save')){
      const amt = parseInt(m.amount||'0',10);
      if (!m.name.trim()) return $('#e-err').textContent = `Hãy nhập tên khoản ${m.type==='EXPENSE'?'chi':'thu'}`;
      if (!(amt>0)) return $('#e-err').textContent = 'Số tiền phải lớn hơn 0';
      const e = { id: entry?entry.id:Date.now(), type:m.type, name:m.name.trim(), amount:amt, category:m.category, date:m.date, note:m.note.trim() };
      const i = db.entries.findIndex(x => x.id===e.id); if (i>=0) db.entries[i] = e; else db.entries.push(e);
      save(); close(); toast('✅ Đã lưu');
    }
    else if (t.hasAttribute('data-del')){ if (confirm('Xóa giao dịch này?')){ db.entries = db.entries.filter(x => x.id!==entry.id); save(); close(); } }
    else if (t.hasAttribute('data-close')) close();
  };
  root.oninput = ev => {
    if (ev.target.id==='e-amt'){ const v = ev.target.value.replace(/\D/g,'').replace(/^0+/,'').slice(0,12); ev.target.value = v; m.amount = v; $('#e-amt-show').textContent = v?money(+v):''; }
  };
  function close(){ root.innerHTML = ''; root.onclick = null; root.oninput = null; render(); }
}

/* ================= SỰ KIỆN ================= */
document.addEventListener('click', ev => {
  if (ev.target.closest('#modal-root')) return;
  const t = ev.target.closest('[data-tab],[data-act],[data-edit],[data-filter],#fab');
  if (!t) return;
  if (t.id==='fab') return openEntry(null);
  if (t.dataset.tab){ state.tab = +t.dataset.tab; render(); scrollTo(0,0); if (state.tab===2) renderHistoryList(); return; }
  if (t.dataset.edit) return openEntry(db.entries.find(e => String(e.id)===t.dataset.edit));
  if (t.dataset.filter!==undefined){ state.filter = t.dataset.filter==='null'?null:t.dataset.filter; render(); renderHistoryList(); return; }
  const a = t.dataset.act;
  if (a==='prev'){ state.week = addDays(state.week,-7); render(); }
  else if (a==='next'){ state.week = addDays(state.week,7); render(); }
  else if (a==='now'){ state.week = weekStart(today()); render(); }
  else if (a==='save-settings'){
    const n = id => parseInt($(id).value.replace(/\D/g,'')||'0',10);
    db.settings = { weeklyAllowance:n('#s-allow'), weeklyLimit:n('#s-limit'), savingGoal:n('#s-goal'), savingGoalName:$('#s-gname').value.trim() };
    save(); render(); toast('✅ Đã lưu thiết lập');
  }
  else if (a==='share'){
    const text = shareText();
    if (navigator.share) navigator.share({ text }).catch(()=>{});
    else navigator.clipboard?.writeText(text).then(()=>toast('📋 Đã sao chép tổng kết'));
  }
  else if (a==='backup'){
    const name = `tieuvat-saoluu-${today()}.json`;
    const file = new File([JSON.stringify(db)], name, { type:'application/json' });
    if (navigator.canShare && navigator.canShare({ files:[file] })) navigator.share({ files:[file], title:name }).catch(()=>{});
    else { const u = URL.createObjectURL(file); const l = document.createElement('a'); l.href = u; l.download = name; l.click(); setTimeout(()=>URL.revokeObjectURL(u), 1000); }
  }
  else if (a==='restore') $('#restore-file').click();
  else if (a==='clear'){ if (confirm('Xóa toàn bộ giao dịch? Thiết lập vẫn được giữ.')){ db.entries = []; save(); render(); } }
});
document.addEventListener('input', ev => {
  if (ev.target.id==='q'){ state.q = ev.target.value; renderHistoryList(); }
  if (ev.target.hasAttribute('data-money')){
    const v = ev.target.value.replace(/\D/g,'').replace(/^0+/,'').slice(0,12); ev.target.value = v;
    const h = document.querySelector(`[data-show="${ev.target.id}"]`); if (h) h.textContent = v?money(+v):'';
  }
});
document.addEventListener('change', ev => {
  if (ev.target.id!=='restore-file' || !ev.target.files[0]) return;
  ev.target.files[0].text().then(t => {
    const d = JSON.parse(t);
    if (!d || !Array.isArray(d.entries)) throw 0;
    if (!confirm(`Khôi phục ${d.entries.length} giao dịch? Dữ liệu hiện tại sẽ bị thay thế.`)) return;
    db = { entries:d.entries, settings:Object.assign({ weeklyAllowance:0, weeklyLimit:0, savingGoal:0, savingGoalName:'' }, d.settings||{}) };
    save(); render(); toast('✅ Đã khôi phục');
  }).catch(() => toast('⚠️ File sao lưu không hợp lệ'));
});

/* ================= NỀN KHU VƯỜN ĐỘNG ================= */
function garden(){
  const cv = $('#bg'), ctx = cv.getContext('2d');
  let W, H, dpr;
  const rnd = (s => () => (s = (s*16807) % 2147483647) / 2147483647)(2026);
  const leafs = [['#B9F6CA','#00C853'],['#CCFF90','#64DD17'],['#A7FFEB','#00BFA5'],['#FFF59D','#9CCC65'],['#F8BBD0','#EC407A'],['#FFE0B2','#FF9800']];
  const fcols = ['#FF4081','#FFEB3B','#E040FB','#40C4FF','#FF6E40','#FFFFFF','#69F0AE'];
  const far = [...Array(14)].map(() => ({x:rnd(), k:Math.floor(rnd()*3), s:.45+rnd()*.25, h:Math.floor(rnd()*6)}));
  const near = [...Array(7)].map((_,i) => ({x:(i+rnd()*.6)/7, k:Math.floor(rnd()*3), s:.8+rnd()*.4, h:Math.floor(rnd()*6)}));
  const flowers = [...Array(70)].map(() => ({x:rnd(), y:.88+rnd()*.12, c:fcols[Math.floor(rnd()*7)], r:3+rnd()*5}));
  const blades = [...Array(220)].map(() => ({x:rnd(), h:10+rnd()*26, l:-.5+rnd(), c:['#2E7D32','#43A047','#66BB6A','#9CCC65'][Math.floor(rnd()*4)]}));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize(){ dpr = Math.min(devicePixelRatio||1, 2); W = innerWidth; H = innerHeight; cv.width = W*dpr; cv.height = H*dpr; }
  addEventListener('resize', resize); resize();
  const lin = (x0,y0,x1,y1,stops) => { const g = ctx.createLinearGradient(x0,y0,x1,y1); stops.forEach((c,i) => g.addColorStop(i/(stops.length-1), c)); return g; };
  const circle = (x,y,r,f) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = f; ctx.fill(); };
  const oval = (x,y,rx,ry,f) => { ctx.beginPath(); ctx.ellipse(x,y,Math.max(rx,.1),Math.max(ry,.1),0,0,Math.PI*2); ctx.fillStyle = f; ctx.fill(); };
  function tree(t, x, gy, size, sway){
    const pal = leafs[t.h], th = size*.55, tw = size*.12, tx = x + sway*size*.04;
    ctx.beginPath(); ctx.moveTo(x-tw,gy); ctx.lineTo(tx-tw*.5,gy-th); ctx.lineTo(tx+tw*.5,gy-th); ctx.lineTo(x+tw,gy); ctx.closePath();
    ctx.fillStyle = lin(x-tw,0,x+tw,0,['#6D4C41','#A1887F','#5D4037']); ctx.fill();
    oval(x, gy, size*.35, size*.04, 'rgba(0,0,0,.2)');
    const leaf = lin(0, gy-th-size*.7, 0, gy-th*.6, pal);
    if (t.k===0){
      const cy = gy-th-size*.2;
      [[-.28,.05,.3],[.28,.05,.3],[0,-.18,.36],[-.15,-.02,.3],[.15,-.02,.3]].forEach(([dx,dy,r]) => circle(tx+dx*size, cy+dy*size, size*r, leaf));
      for (let k=0;k<5;k++){ const a = k*1.25; circle(tx+Math.cos(a)*size*.25, cy-size*.05+Math.sin(a)*size*.18, size*.035, t.h>=4?'#fff':'#FF5252'); }
    } else if (t.k===1){
      for (let k=0;k<3;k++){ const by = gy-th*.6-k*size*.28, hw = size*(.42-k*.1);
        ctx.beginPath(); ctx.moveTo(tx-hw,by); ctx.lineTo(tx,by-size*.45); ctx.lineTo(tx+hw,by); ctx.closePath(); ctx.fillStyle = leaf; ctx.fill(); }
      circle(tx, gy-th*.6-size, size*.04, '#FFEB3B');
    } else {
      const cy = gy-th-size*.25;
      oval(tx, cy-size*.05, size*.3, size*.4, leaf);
      oval(tx-size*.1, cy-size*.21, size*.08, size*.15, 'rgba(255,255,255,.25)');
    }
  }
  function hill(y, fill, phase){
    ctx.beginPath(); ctx.moveTo(0, H*y);
    for (let i=0;i<=40;i++) ctx.lineTo(W*i/40, H*y - H*.025*Math.sin(i/40*2*Math.PI*1.2+phase));
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function mountain(base, cols, phase){
    ctx.beginPath(); ctx.moveTo(0, H*base); let x = 0, i = 0;
    while (x <= W){ ctx.lineTo(x+W*.09, H*(base-.08-.06*Math.sin(i*1.3+phase))); ctx.lineTo(x+W*.18, H*base-H*.02); x += W*.18; i++; }
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fillStyle = lin(0,H*(base-.15),0,H*base,cols); ctx.fill();
  }
  function cloud(cx, cy, s, a){
    const c = `rgba(255,255,255,${a})`;
    circle(cx,cy,26*s,c); circle(cx+30*s,cy-12*s,34*s,c); circle(cx+62*s,cy,24*s,c);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx-10*s, cy-4*s, 84*s, 30*s, 15*s) : ctx.rect(cx-10*s, cy-4*s, 84*s, 30*s); ctx.fillStyle = c; ctx.fill();
  }
  function butterfly(x, y, s, flap, c1, c2){
    const w = s*flap;
    oval(x-w*.8, y-s*.4, w*.8, s*.6, c1); oval(x+w*.8, y-s*.4, w*.8, s*.6, c1);
    oval(x-w*.6, y+s*.45, w*.6, s*.45, c2); oval(x+w*.6, y+s*.45, w*.6, s*.45, c2);
    ctx.strokeStyle = '#3E2723'; ctx.lineWidth = s*.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y-s*.9); ctx.lineTo(x, y+s*.8); ctx.stroke();
  }
  let lastT = 0;
  function frame(ms){
    if (!reduce) requestAnimationFrame(frame);
    if (ms - lastT < 33) return; lastT = ms;   // ~30 khung hình/giây cho đỡ tốn pin
    const t = ms/1000;
    const sunA = (t/60)*Math.PI*2, cl = (t/90)%1, sway = Math.sin(t*Math.PI/2.6), fly = (t/24)%1, flap = .65+.35*Math.sin(t*Math.PI/.26);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = lin(0,0,0,H,['#8EC5FF','#C3B1FF','#FFC1E3','#FFE5B4','#E8FFD6']); ctx.fillRect(0,0,W,H);
    // cầu vồng
    ['rgba(255,23,68,.4)','rgba(255,145,0,.4)','rgba(255,234,0,.4)','rgba(0,230,118,.4)','rgba(41,121,255,.4)','rgba(101,31,255,.4)','rgba(213,0,249,.4)']
      .forEach((c,i) => { ctx.beginPath(); ctx.arc(W*.62, H*.62, W*.62-i*W*.028, Math.PI, 2*Math.PI); ctx.strokeStyle = c; ctx.lineWidth = W*.028; ctx.stroke(); });
    // mặt trời
    const sx = W*.18, sy = H*.12, sr = W*.09;
    const g = ctx.createRadialGradient(sx,sy,0,sx,sy,sr*3.2); g.addColorStop(0,'rgba(255,245,157,.55)'); g.addColorStop(1,'rgba(255,245,157,0)'); circle(sx,sy,sr*3.2,g);
    ctx.strokeStyle = 'rgba(255,213,79,.8)'; ctx.lineWidth = sr*.18; ctx.lineCap = 'round';
    for (let i=0;i<16;i++){ const a = sunA + i*Math.PI/8, len = i%2?sr*1.5:sr*1.9; ctx.beginPath(); ctx.moveTo(sx+Math.cos(a)*sr*1.15, sy+Math.sin(a)*sr*1.15); ctx.lineTo(sx+Math.cos(a)*len, sy+Math.sin(a)*len); ctx.stroke(); }
    const sg = ctx.createRadialGradient(sx,sy,0,sx,sy,sr); sg.addColorStop(0,'#FFFDE7'); sg.addColorStop(.6,'#FFD54F'); sg.addColorStop(1,'#FFA000'); circle(sx,sy,sr,sg);
    // mây
    const span = W+300;
    cloud((cl*span + W*.1)%span - 150, H*.08, 1.2, .9);
    cloud((cl*span*.7 + W*.6)%span - 150, H*.18, .9, .8);
    cloud((cl*span*1.3 + W*.35)%span - 150, H*.27, .7, .75);
    mountain(.55, ['#B39DDB','#D1C4E9'], .1); mountain(.6, ['#80CBC4','#B2DFDB'], .6);
    hill(.68, lin(0,H*.64,0,H,['#A5D6A7','#81C784']), 0);
    far.forEach(tr => tree(tr, W*tr.x, H*.7, W*.12*tr.s, sway*.5));
    hill(.8, lin(0,H*.76,0,H,['#8BE78B','#43A047']), 1.7);
    near.forEach(tr => tree(tr, W*tr.x, H*.83, W*.2*tr.s, sway));
    ctx.fillStyle = lin(0,H*.88,0,H,['#66BB6A','#2E7D32']); ctx.fillRect(0,H*.88,W,H*.12);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    blades.forEach(b => { const bx = b.x*W, by = H*.9+(b.h%7)*8; ctx.strokeStyle = b.c; ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+(b.l+sway*.4)*b.h*.6, by-b.h); ctx.stroke(); });
    flowers.forEach(f => { const x = f.x*W, y = f.y*H; for (let k=0;k<5;k++){ const a = k*Math.PI*2/5; circle(x+Math.cos(a)*f.r*1.1, y+Math.sin(a)*f.r*1.1, f.r, f.c); } circle(x,y,f.r*.7,'#FFC107'); });
    butterfly(W*fly, H*.5+Math.sin(fly*12)*H*.04, 14, flap, '#FF4081', '#7C4DFF');
    butterfly(W*((fly+.5)%1), H*.4+Math.cos(fly*10)*H*.05, 11, flap, '#FFAB00', '#00B8D4');
    butterfly(W*(1-fly), H*.62+Math.sin(fly*8)*H*.03, 10, flap, '#00E676', '#FFEA00');
  }
  requestAnimationFrame(frame);
  if (reduce) setTimeout(() => frame(1000), 50);
}

/* ================= KHỞI ĐỘNG ================= */
load(); render(); garden();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
