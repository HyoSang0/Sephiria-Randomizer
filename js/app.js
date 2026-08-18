let WEAPON_TYPES, COSTUMES, CHARACTER_ASSETS, ENCHANT_IMAGE_KEYS, COMBOS, ENCHANT_TREE, ENCHANT_DETAILS, WEAPON_ENCHANT_MAP;
async function loadGameData(){const response=await fetch('./data/sephiria.json');if(!response.ok)throw new Error('Failed to load game data');const data=await response.json();WEAPON_TYPES=data.weapons;COSTUMES=data.costumes;CHARACTER_ASSETS=data.characterAssets;ENCHANT_IMAGE_KEYS=data.enchantImageKeys;COMBOS=data.combos;ENCHANT_TREE=data.enchantTree;ENCHANT_DETAILS=data.enchantDetails;WEAPON_ENCHANT_MAP=data.weaponEnchantMap;}
document/* ================= STATE ================= */
let comboCount = 1;
const histories = {weapon:[], enchant:[], costume:[], combo:[]};

/* ================= HELPERS ================= */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pickMany(arr, n){
  const pool=[...arr]; const out=[];
  n = Math.min(n, pool.length);
  for(let i=0;i<n;i++){
    const idx = Math.floor(Math.random()*pool.length);
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s){ return escapeHtml(s); }

function imageFallback(img){
  let rest=[];
  try{ rest=JSON.parse(img.dataset.fallbacks || '[]'); }catch(_){ rest=[]; }
  if(rest.length){
    const next=rest.shift();
    img.dataset.fallbacks=JSON.stringify(rest);
    img.src=next;
    return;
  }
  const wrap=img.closest('.result-image-wrap');
  if(wrap) wrap.classList.add('image-missing');
  img.remove();
}
function assetImageHTML(urls, alt, detail=false, imageClass=''){
  const clean=[...new Set((urls||[]).filter(Boolean))];
  if(!clean.length) return '';
  const fallback=JSON.stringify(clean.slice(1));
  const classes=`result-image${imageClass ? ` ${imageClass}` : ''}`;
  return `<div class="${detail?'detail-visual':'result-visual'}"><div class="result-image-wrap"><img class="${classes}" src="${escapeAttr(clean[0])}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async" data-fallbacks="${escapeAttr(fallback)}" onerror="imageFallback(this)"></div></div>`;
}
function weaponImageURLs(slug){
  if(!slug) return [];
  const extensions = WEBP_FIRST_WEAPON_SLUGS.has(slug)
    ? WEBP_FIRST_IMAGE_EXTENSIONS
    : PNG_FIRST_IMAGE_EXTENSIONS;
  return extensions.map(ext=>`${WEAPON_IMAGE_BASE}/${slug}.${ext}`);
}
function weaponImageHTML(w, detail=false){
  return assetImageHTML(weaponImageURLs(w.imageKey), `${w.en || w.name} weapon`, detail);
}
function characterImageHTML(c, detail=false){
  const a=CHARACTER_ASSETS[c[0]];
  if(!a) return '';
  return assetImageHTML([`${CHARACTER_IMAGE_BASE}/character-${a.slug}.png`], `${a.en} character`, detail, 'costume-image');
}
function enchantImageHTML(name, detail=false){
  return assetImageHTML(weaponImageURLs(ENCHANT_IMAGE_KEYS[name]), `${name} weapon evolution`, detail);
}
function resultEnglishHTML(en){
  return en ? `<div class="result-en">${escapeHtml(en)}</div>` : '';
}


/* -- 무기 강화 상세보기 모달 -- */
function openEnchantDetail(base, t1, t2){
  const t1Data = ENCHANT_DETAILS[base] && ENCHANT_DETAILS[base][t1];
  if(!t1Data){ return; }
  let html = `
    <div class="detail-tier-label">${escapeHtml(base)} 鸚?1嶺??띠룆踰??/div>
    ${enchantImageHTML(t1, true)}
    <div class="detail-tier-name">${escapeHtml(t1)}</div>
    <div class="detail-effect">${escapeHtml(t1Data.effect || '(??節뗪땁 ?筌먲퐢沅???怨몃쾳)')}</div>
  `;
  if(t2 && t1Data.t2 && t1Data.t2[t2]){
    const t2Data = t1Data.t2[t2];
    html += `
      <hr class="detail-divider">
      <div class="detail-tier-label">2嶺??띠룆踰??/div>
      ${enchantImageHTML(t2, true)}
      <div class="detail-tier-name">${escapeHtml(t2)}</div>
      <div class="detail-effect">${escapeHtml(t2Data.effect || '(??節뗪땁 ?筌먲퐢沅???怨몃쾳)')}</div>
    `;
  }
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('detail-overlay').classList.add('open');
}
function closeEnchantDetail(){
  document.getElementById('detail-overlay').classList.remove('open');
}
document.addEventListener('click', function(ev){
  const btn = ev.target.closest('.detail-btn');
  if(!btn) return;
  openEnchantDetail(btn.dataset.base, btn.dataset.t1, btn.dataset.t2 || null);
});
document.addEventListener('keydown', function(ev){
  if(ev.key === 'Escape'){
    closeEnchantDetail();
    return;
  }
  if(ev.code !== 'Space' || ev.repeat) return;
  if(document.getElementById('detail-overlay').classList.contains('open')) return;
  if(ev.target.closest?.('button, a, input, select, textarea, [contenteditable="true"]')) return;

  const rollButton = document.querySelector('.panel.active .roll-btn');
  if(!rollButton || rollButton.disabled) return;
  ev.preventDefault();
  rollButton.click();
});

function pushHistory(key, label){
  histories[key].unshift(label);
  histories[key] = histories[key].slice(0,5);
  const el = document.getElementById('hist-'+key);
  if(el){
    el.innerHTML = histories[key].length
      ? '嶺뚣끉裕???リ옇?▽빳?鸚?' + histories[key].map(h=>`<b>${h}</b>`).join(' 鸚?')
      : '';
  }
}

/* ================= TABS ================= */
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('#combo-count button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#combo-count button').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    comboCount = parseInt(btn.dataset.n,10);
  });
});

/* -- custom multi-select -- */
let customComboCount = 1;
const customCombEl = document.getElementById('custom-combo-count');

function syncCustomComboVisibility(){
  const comboOn = document.querySelector('#custom-picks button[data-key="combo"]').classList.contains('on');
  customCombEl.style.display = comboOn ? 'flex' : 'none';
}

document.querySelectorAll('#custom-picks button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    btn.classList.toggle('on');
    // guard: at least one category must stay selected
    const anyOn = [...document.querySelectorAll('#custom-picks button')].some(b=>b.classList.contains('on'));
    if(!anyOn) btn.classList.add('on');
    syncCustomComboVisibility();
  });
});
syncCustomComboVisibility();

document.querySelectorAll('#custom-combo-count button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#custom-combo-count button').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    customComboCount = parseInt(btn.dataset.n,10);
  });
});

/* ================= RENDERERS ================= */
function renderWeapon(){
  const w = pick(WEAPON_TYPES);
  document.getElementById('card-weapon').innerHTML = `
    <div class="kicker">???노츓????쒕뼬??/div>
    ${weaponImageHTML(w)}
    <div class="result-name">${w.name}</div>
    ${resultEnglishHTML(w.en)}
    <div class="result-note">${w.note}</div>
    <div class="tag-row"><span class="pill">${w.tag}</span></div>
  `;
  pushHistory('weapon', w.name);
}

function renderEnchant(){
  const e = pick(ENCHANT_TREE);
  const hasT2 = e.t2 && e.t2.length>0;
  const chosenT2 = hasT2 ? pick(e.t2) : null;
  const shown = chosenT2 || e.t1;
  const chain = `${e.base} ??${e.t1}` + (chosenT2 ? ` ??${chosenT2}` : ' (2嶺??띠룆踰????怨몃쾳/亦껋꼶梨???');
  document.getElementById('card-enchant').innerHTML = `
    <div class="kicker">?????쒕뼬???띠룆踰??/div>
    ${enchantImageHTML(shown)}
    <div class="result-name">${shown}</div>
    <div class="result-chain">${chain}</div>
    <button class="detail-btn" data-base="${escapeAttr(e.base)}" data-t1="${escapeAttr(e.t1)}" data-t2="${escapeAttr(chosenT2||'')}">?獄???⑤㈇??솻洹ｋ뼬??/button>
  `;
  pushHistory('enchant', chosenT2 || e.t1);
}

function renderCostume(){
  const c = pick(COSTUMES);
  const a = CHARACTER_ASSETS[c[0]];
  document.getElementById('card-costume').innerHTML = `
    <div class="kicker">???노츓???袁⑤뾼???/div>
    ${characterImageHTML(c)}
    <div class="result-name">${c[0]}</div>
    ${resultEnglishHTML(a && a.en)}
    <div class="result-note">${c[2]}</div>
    <div class="tag-row"><span class="pill">${c[1]}</span></div>
  `;
  pushHistory('costume', c[0]);
}

function renderCombo(){
  const picked = pickMany(COMBOS, comboCount);
  const title = picked.map(p=>p[0]).join(' + ');
  const notes = picked.map(p=>`<div class="result-note">鸚?<b style="color:var(--parchment)">${p[0]}</b> ??${p[1]}</div>`).join('');
  document.getElementById('card-combo').innerHTML = `
    <div class="kicker">???노츓???袁좊걞????蹂μ쟽</div>
    <div class="result-name">${title}</div>
    <div style="text-align:left; max-width:400px; margin:0 auto; display:flex; flex-direction:column; gap:6px;">${notes}</div>
  `;
  pushHistory('combo', title);
}

function renderBuild(){
  const e = pick(ENCHANT_TREE);
  const hasT2 = e.t2 && e.t2.length>0;
  const chosenT2 = hasT2 ? pick(e.t2) : null;
  const weaponResult = chosenT2 || e.t1;
  const c = pick(COSTUMES);
  const combos = pickMany(COMBOS, 2);

  document.getElementById('card-build').innerHTML = `
    <div class="kicker" style="text-align:center;">???노츓????嶺????됱??</div>
    ${enchantCardData(e, chosenT2).html}
    <div class="tag-row" style="margin-top:16px;">
      <span class="pill">????袁⑤뾼??? ${c[0]}</span>
      <span class="pill">????袁좊걞?? ${combos.map(x=>x[0]).join(' / ')}</span>
    </div>
    <div class="result-note" style="margin-top:14px;">
      ${c[0]} (${c[2]})????猿렺? <b style="color:var(--parchment)">${combos.map(x=>x[0]).join(' 鸚?')}</b> ??蹂μ쟽 ?熬곣뫜?믣슖??熬곥굥堉??釉띾콦??嶺뚮ㅄ維??얠춺?
      <b style="color:var(--parchment)">${weaponResult}</b> ??쒕뼬?깃꼍???????嶺????됱??????????袁⑦돵?곌랜?삭땻??
    </div>
  `;
}

const RENDERERS = {weapon:renderWeapon, enchant:renderEnchant, costume:renderCostume, combo:renderCombo, build:renderBuild};

/* -- pure card-data builders: return {html, entries:[[key,label],...]} without side effects -- */
function weaponCardData(w){
  return {
    entries:[['weapon', w.name]],
    html:`<div class="mini-card">
      <div class="kicker">????쒕뼬??/div>
      ${weaponImageHTML(w)}
      <div class="result-name">${w.name}</div>
      ${resultEnglishHTML(w.en)}
      <div class="result-note">${w.note}</div>
      <div class="tag-row" style="justify-content:flex-start;"><span class="pill">${w.tag}</span></div>
    </div>`
  };
}
function enchantCardData(e, chosenT2){
  const chain = `${e.base} ??${e.t1}` + (chosenT2 ? ` ??${chosenT2}` : ' (2嶺??띠룆踰????怨몃쾳/亦껋꼶梨???');
  const shown = chosenT2 || e.t1;
  return {
    entries:[['enchant', shown]],
    html:`<div class="mini-card">
      <div class="kicker">?????쒕뼬???띠룆踰??/div>
      ${enchantImageHTML(shown)}
      <div class="result-name">${shown}</div>
      <div class="result-chain">${chain}</div>
      ${e.special ? `<div class="result-note">${e.special}</div>` : ''}
      <button class="detail-btn" data-base="${escapeAttr(e.base)}" data-t1="${escapeAttr(e.t1)}" data-t2="${escapeAttr(chosenT2||'')}">?獄???⑤㈇??솻洹ｋ뼬??/button>
    </div>`
  };
}
function costumeCardData(c){
  const a = CHARACTER_ASSETS[c[0]];
  return {
    entries:[['costume', c[0]]],
    html:`<div class="mini-card">
      <div class="kicker">????袁⑤뾼???/div>
      ${characterImageHTML(c)}
      <div class="result-name">${c[0]}</div>
      ${resultEnglishHTML(a && a.en)}
      <div class="result-note">${c[2]}</div>
      <div class="tag-row" style="justify-content:flex-start;"><span class="pill">${c[1]}</span></div>
    </div>`
  };
}
function comboCardData(picked){
  const title = picked.map(p=>p[0]).join(' + ');
  const notes = picked.map(p=>`<div class="result-note">鸚?<b style="color:var(--parchment)">${p[0]}</b> ??${p[1]}</div>`).join('');
  return {
    entries:[['combo', title]],
    html:`<div class="mini-card">
      <div class="kicker">????袁좊걞??/div>
      <div class="result-name">${title}</div>
      <div style="display:flex; flex-direction:column; gap:4px;">${notes}</div>
    </div>`
  };
}
// ??쒕뼬??+ ??쒕뼬???띠룆踰?類잙ご??띠룇???嶺뚮?理???? ?띠룆踰???筌뤾봇遊뷸뤆?쎛 ???덈츎 ??쒕뼬????ｌ뫒??繞벿살탳???類ㅼ떳 ??쒕뼬?깃퀋紐???μ쪚??뗏?
// ????쒕뼬????ｌ뫒???嶺뚮씮????띠룆踰?類㏃춹?嶺뚮?理먬뇡????類ㅼŦ ???깅땸??? ??袁⑹벟 嶺뚯쉸鍮??嶺뚮씮????
function pairedWeaponEnchantData(){
  const validWeapons = WEAPON_TYPES.filter(w => WEAPON_ENCHANT_MAP[w.name] && WEAPON_ENCHANT_MAP[w.name].length>0);
  const w = pick(validWeapons);
  const cands = ENCHANT_TREE.filter(e => WEAPON_ENCHANT_MAP[w.name].includes(e.base));
  const e = pick(cands);
  const chosenT2 = (e.t2 && e.t2.length>0) ? pick(e.t2) : null;
  const note = `<p style="text-align:center; font-size:12px; color:var(--muted-dim); margin:-4px 0 2px;">
    ????類ㅼŦ 嶺뚮씮?????ｌ뫒???寃몃뉴 嶺뚯쉸鍮???怨몄뗀
  </p>`;
  const wd = weaponCardData(w), ed = enchantCardData(e, chosenT2);
  return { entries:[...wd.entries, ...ed.entries], html: note + wd.html + ed.html };
}

/* -- build one full candidate set for the selected categories (no history writes) -- */
function buildCustomCandidate(selected, comboN){
  const order = ['weapon','enchant','costume','combo'];
  const pairMode = selected.includes('weapon') && selected.includes('enchant');
  let html = '';
  let entries = [];
  order.filter(k=>selected.includes(k)).forEach(k=>{
    let d;
    if(pairMode && k==='weapon'){ d = pairedWeaponEnchantData(); }
    else if(pairMode && k==='enchant'){ return; }
    else if(k==='weapon'){ d = weaponCardData(pick(WEAPON_TYPES)); }
    else if(k==='enchant'){
      const e = pick(ENCHANT_TREE);
      const chosenT2 = (e.t2 && e.t2.length>0) ? pick(e.t2) : null;
      d = enchantCardData(e, chosenT2);
    }
    else if(k==='costume'){ d = costumeCardData(pick(COSTUMES)); }
    else if(k==='combo'){ d = comboCardData(pickMany(COMBOS, comboN)); }
    html += d.html;
    entries.push(...d.entries);
  });
  return { html, entries };
}

let customCandidates = [];

function selectCustomCandidate(i){
  const c = customCandidates[i];
  if(!c) return;
  c.entries.forEach(([k,label])=>pushHistory(k,label));
  const container = document.getElementById('card-custom');
  container.innerHTML = `
    <div id="custom-chosen-summary">????ルㅎ臾??熬곣뫁??鸚?${c.entries.map(e=>e[1]).join(' 鸚?')}</div>
    <div class="candidate-box chosen">
      <div class="candidate-label">??ルㅎ臾???브퀗?ч뜮?</div>
      ${c.html}
    </div>
  `;
}

/* ================= ROLL ANIMATION ================= */
// ?猷고????濡?뱿 嶺뚳퐣瑗?????伊??듭물??? ???댁Ŧ ?띠룆??遺뱀뿉??????????사춯?뼿??嶺뚮∥?????띠룆흮?????궰???
// n?띠룇裕??嶺뚯솘???⑥ル뻣??ms) ?꾩룄?ｈ굢??ease-in-quad ??λ룱???怨쀬Ŧ ??諛댁뎽??類ｋ펲 (??1?????亦??熬곣뫁??.
function rollDelays(n){
  const delays = [];
  for(let i=0;i<n;i++){
    const t = i/(n-1);
    const eased = t*t;
    delays.push(Math.round((55 + eased*285) * 0.45));
  }
  return delays;
}
// el: ??ル봾鍮띸춯濡ル뾼???瑜곷굵 濾???븐슜爰? onTick(i,total): 嶺??繹먮굞異????븐뻼???띠룄??? onDone: 嶺뚣끉裕뉏펺??롪퍒????꾩룇瑗??
function animatedRoll(el, onTick, onDone, n){
  n = n || 15;
  const delays = rollDelays(n);
  el.classList.add('rolling');
  let i = 0;
  function step(){
    if(i < delays.length){
      // 嶺뚮씭??嶺?4?繹? ??븐뼔援?源녿닔???????????"嶺뚳퐣裕뉓뜎??嶺뚮∥???? ??????繞벿뮻??
      if(i === delays.length - 4){ el.classList.add('rolling-slow'); }
      onTick(i, delays.length);
      i++;
      setTimeout(step, delays[i-1]);
    } else {
      el.classList.remove('rolling','rolling-slow');
      onDone();
    }
  }
  step();
}

function rollCustom(){
  const selected = [...document.querySelectorAll('#custom-picks button.on')].map(b=>b.dataset.key);
  const container = document.getElementById('card-custom');
  const btn = event.currentTarget;
  btn.disabled = true;
  container.style.opacity = '.5';
  animatedRoll(container, ()=>{
    container.innerHTML = `<p class="placeholder" style="text-align:center;">嶺뚮?理??繞?..</p>`;
  }, ()=>{
    container.style.opacity = '1';
    customCandidates = [
      buildCustomCandidate(selected, customComboCount),
      buildCustomCandidate(selected, customComboCount),
      buildCustomCandidate(selected, customComboCount),
    ];
    const boxes = customCandidates.map((c,i)=>`
      <div class="candidate-box" id="candidate-box-${i}">
        <div class="candidate-label">?????${i+1}</div>
        ${c.html}
        <button class="ghost-btn" style="width:100%;" onclick="selectCustomCandidate(${i})">???브퀗?ч뜮? ??ルㅎ臾?/button>
      </div>
    `).join('');
    container.innerHTML = `
      <div id="custom-chosen-summary">3??繞?嶺뚮씭??????類ｋ츎 ?브퀗?ч뜮?????濡る룎 ??λ???덊돦?怨댁돪??/div>
      <div class="candidate-grid">${boxes}</div>
    `;
    btn.disabled = false;
  });
}

function roll(key){
  const card = document.getElementById('card-'+key);
  const btn = event.currentTarget;
  btn.disabled = true;
  card.style.opacity = '.5';
  const flickerPool = key==='weapon' ? WEAPON_TYPES.map(w=>w.name)
    : key==='costume' ? COSTUMES.map(c=>c[0])
    : key==='combo' ? COMBOS.map(c=>c[0])
    : ENCHANT_TREE.map(e=>e.t1);
  animatedRoll(card, ()=>{
    card.innerHTML = `<div class="kicker">嶺뚮?理??繞?..</div><div class="result-name">${pick(flickerPool)}</div>`;
  }, ()=>{
    card.style.opacity = '1';
    RENDERERS[key]();
    btn.disabled = false;
  });
}

// --- COMMUNITY BOARD LOGIC ---
let communityLoaded = false;

function toggleBuildForm() {
  const form = document.getElementById('build-submit-form');
  const btnWrap = document.getElementById('build-form-toggle-wrap');
  if (form.style.display === 'none') {
    form.style.display = 'block';
    btnWrap.style.display = 'none';
  } else {
    form.style.display = 'none';
    btnWrap.style.display = 'block';
  }
}

function loadCurrentRollToForm() {
  const buildCard = document.getElementById('card-build');
  if (buildCard && !buildCard.querySelector('.placeholder')) {
    const titles = buildCard.querySelectorAll('.history b');
    const bTexts = Array.from(titles).map(b => b.innerText);
    if(bTexts.length >= 3) {
      let baseVal = '', t1Val = '', t2Val = '';
      const enchantTxt = bTexts[1];
      const matchTree = ENCHANT_TREE.find(e => e.t1 === enchantTxt || (e.t2 && e.t2.includes(enchantTxt)));
      if (matchTree) {
        baseVal = matchTree.base;
        t1Val = matchTree.t1;
        t2Val = matchTree.t2 && matchTree.t2.includes(enchantTxt) ? enchantTxt : '';
      }
      
      const wOpt = WEAPON_TYPES.find(w => w.name === baseVal);
      const baseImg = wOpt ? weaponImageHTML(wOpt) : '';
      const baseDisplay = baseVal ? `${baseImg} <span>${baseVal}</span>` : '';
      setCustomSelectValue('cb-enchant-base', baseVal, baseDisplay);
      
      const cbT1 = document.getElementById('cb-enchant-t1');
      cbT1.value = t1Val;
      updateT2Dropdown();
      const cbT2 = document.getElementById('cb-enchant-t2');
      cbT2.value = t2Val;

      const costumeVal = bTexts[2] || '';
      const cOpt = COSTUMES.find(c => c[0] === costumeVal);
      const costumeImg = cOpt ? characterImageHTML(cOpt) : '';
      const costumeDisplay = costumeVal ? `${costumeImg} <span>${costumeVal}</span>` : '';
      setCustomSelectValue('cb-costume', costumeVal, costumeDisplay);
      
      if(bTexts.length > 3) {
        document.getElementById('cb-combo').value = bTexts.slice(3).join(', ');
      }
    }
    toggleBuildForm();
    document.getElementById('build-submit-form').style.display = 'block';
    document.getElementById('build-form-toggle-wrap').style.display = 'none';
  } else {
    alert('?誘る닔? [?? ????キ? ?????????キ?꾨ご?嶺뚮?理먬뇡?놃떊?源껋돪??');
  }
}

function updateT1Dropdown() {
  const baseVal = document.getElementById('cb-enchant-base').value;
  const t1Select = document.getElementById('cb-enchant-t1');
  t1Select.innerHTML = '<option value="">- ??ルㅎ臾?-</option>';
  const t2Select = document.getElementById('cb-enchant-t2');
  t2Select.innerHTML = '<option value="">- ??ルㅎ臾?-</option>';
  
  if(!baseVal) return;
  const t1List = [...new Set(ENCHANT_TREE.filter(e => e.base === baseVal).map(e => e.t1))];
  t1List.forEach(t1 => {
    t1Select.innerHTML += `<option value="${t1}">${t1}</option>`;
  });
}

function updateT2Dropdown() {
  const t1Val = document.getElementById('cb-enchant-t1').value;
  const t2Select = document.getElementById('cb-enchant-t2');
  t2Select.innerHTML = '<option value="">- ??ルㅎ臾?-</option>';
  
  if(!t1Val) return;
  const matchTrees = ENCHANT_TREE.filter(e => e.t1 === t1Val);
  let t2List = [];
  matchTrees.forEach(m => {
    if(m.t2) t2List = t2List.concat(m.t2);
  });
  t2List = [...new Set(t2List)];
  
  t2List.forEach(t2 => {
    t2Select.innerHTML += `<option value="${t2}">${t2}</option>`;
  });
}

function escapeHtml(unsafe) {
  return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fetchCommunityBuilds() {
  if(!db) return;
  const listEl = document.getElementById('community-list');
  listEl.innerHTML = '<p class="placeholder" style="text-align:center;">?釉띾쐞????노츎 繞?..</p>';
  
  db.collection('builds').orderBy('created_at', 'desc').limit(50).get().then(snapshot => {
    listEl.innerHTML = '';
    if(snapshot.empty) {
      listEl.innerHTML = '<p class="placeholder" style="text-align:center;">?熬곣뫗異??繹먮굞夷??????キ?뱀쾸? ??怨룸????덈펲. 嶺?????キ?꾨ご??繹먮굞夷?????筌뤾쑴??</p>';
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const dateStr = data.created_at ? new Date(data.created_at.toDate()).toLocaleString('ko-KR') : '';
      
      let tagsHtml = '';
      
      let weaponDisplay = '';
      if(data.enchant_base) {
        weaponDisplay += escapeHtml(data.enchant_base);
        if(data.enchant_t1) weaponDisplay += ` > ${escapeHtml(data.enchant_t1)}`;
        if(data.enchant_t2) weaponDisplay += ` > ${escapeHtml(data.enchant_t2)}`;
      } else if(data.weapon || data.enchant) {
        if(data.weapon) weaponDisplay += escapeHtml(data.weapon);
        if(data.enchant) weaponDisplay += (weaponDisplay ? ` > ` : '') + escapeHtml(data.enchant);
      }
      
      if(weaponDisplay) tagsHtml += `<span class="build-tag weapon">??${weaponDisplay}</span>`;
      
      if(data.costume) tagsHtml += `<span class="build-tag costume">???${escapeHtml(data.costume)}</span>`;
      if(data.combo) tagsHtml += `<span class="build-tag combo">???${escapeHtml(data.combo)}</span>`;
      
      let extraHtml = '';
      if(data.fruit) extraHtml += `<div style="margin-bottom:4px;"><b style="color:var(--text);">??λ닔????묐뵁??</b> ${escapeHtml(data.fruit)}</div>`;
      if(data.artifact) extraHtml += `<div><b style="color:var(--text);">???堉??熬곥굥堉??釉띾콦:</b> ${escapeHtml(data.artifact)}</div>`;
      
      const cardHtml = `
        <div class="build-card">
          <div class="build-card-header">
            <h4 class="build-card-title">${escapeHtml(data.author || 'Anonymous')} Community Build</h4>
            <span class="build-card-date">${dateStr}</span>
          </div>
          <div class="build-card-tags">
            ${tagsHtml}
          </div>
          ${extraHtml ? `<div class="build-card-body">${extraHtml}</div>` : ''}
          ${data.desc ? `<div class="build-card-body" style="background:var(--bg); padding:10px; border-radius:2px; border-left:3px solid var(--accent); margin-top:8px;">${escapeHtml(data.desc)}</div>` : ''}
        </div>
      `;
      listEl.innerHTML += cardHtml;
    });
  }).catch(err => {
    console.error('Error fetching builds:', err);
    listEl.innerHTML = '<p class="placeholder" style="text-align:center;color:#ef5350;">?롪퍓?????諭??釉띾쐞????노츎?????덉넮???곕????덈펲.</p>';
  });
}

function submitBuild() {
  const btn = document.getElementById('cb-submit-btn');
  const author = document.getElementById('cb-author').value.trim();
  const enchant_base = document.getElementById('cb-enchant-base').value.trim();
  const enchant_t1 = document.getElementById('cb-enchant-t1').value.trim();
  const enchant_t2 = document.getElementById('cb-enchant-t2').value.trim();
  const costume = document.getElementById('cb-costume').value.trim();
  const fruit = document.getElementById('cb-fruit').value.trim();
  const combo = document.getElementById('cb-combo').value.trim();
  const artifact = document.getElementById('cb-artifact').value.trim();
  const desc = document.getElementById('cb-desc').value.trim();
  
  if(!enchant_base && !costume && !combo) {
    alert('嶺뚣끉裕????뺢퀣伊?????쒕뼬?? ?袁⑤뾼??? ?袁좊걞??繞???濡る룎?????놁졑??怨삵룖?筌뤾쑴??');
    return;
  }
  
  btn.disabled = true;
  btn.innerText = '?繹먮굞夷?繞?..';
  
  db.collection('builds').add({
    author: author || 'Anonymous',
    enchant_base, enchant_t1, enchant_t2, costume, fruit, combo, artifact, desc,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert('????キ?뱀쾸? ?繹먭퍓沅??⑤챷紐드슖??繹먮굞夷??琉????鍮??');
    toggleBuildForm();
    document.getElementById('cb-author').value = '';
    document.getElementById('cb-enchant-base').value = '';
    updateT1Dropdown();
    document.getElementById('cb-costume').value = '';
    document.getElementById('cb-fruit').value = '';
    document.getElementById('cb-combo').value = '';
    document.getElementById('cb-artifact').value = '';
    document.getElementById('cb-desc').value = '';
    fetchCommunityBuilds();
  }).catch(err => {
    console.error('Error adding document: ', err);
    alert('?繹먮굞夷?????덉넮???곕????덈펲.');
  }).finally(() => {
    btn.disabled = false;
    btn.innerText = '?繹먮굞夷???얄뵛';
  });
}

function setCustomSelectValue(id, value, displayHtml) {
  const input = document.getElementById(id);
  if(!input) return;
  input.value = value;
  const display = document.getElementById(id + '-display').querySelector('.custom-select-selected');
  if (display) {
    display.innerHTML = displayHtml || (value ? `<span>${value}</span>` : '- ??ルㅎ臾?-');
  }
  if (input.onchange) {
    input.onchange();
  }
}

function toggleCustomSelect(optionsId) {
  const options = document.getElementById(optionsId);
  if (options && options.classList.contains('open')) {
    options.classList.remove('open');
  } else if (options) {
    document.querySelectorAll('.custom-select-options.open').forEach(el => el.classList.remove('open'));
    options.classList.add('open');
  }
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select-wrapper')) {
    document.querySelectorAll('.custom-select-options.open').forEach(el => el.classList.remove('open'));
  }
});

async function init(){ await loadGameData();
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if(e.target.dataset.tab === 'community' && !communityLoaded) {
        communityLoaded = true;
        fetchCommunityBuilds();
      }
    });
  });

  const cbBaseOpts = document.getElementById('cb-enchant-base-options');
  if(cbBaseOpts) {
    const bases = [...new Set(ENCHANT_TREE.map(e => e.base))];
    
    const defaultOpt = document.createElement('div');
    defaultOpt.className = 'custom-select-option';
    defaultOpt.innerHTML = '- ??ルㅎ臾?-';
    defaultOpt.onclick = () => { setCustomSelectValue('cb-enchant-base', '', ''); toggleCustomSelect('cb-enchant-base-options'); };
    cbBaseOpts.appendChild(defaultOpt);

    bases.forEach(b => {
      const wOpt = WEAPON_TYPES.find(w => w.name === b);
      const imgHtml = wOpt ? weaponImageHTML(wOpt) : '';
      const displayHtml = `${imgHtml} <span>${b}</span>`;
      
      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.innerHTML = displayHtml;
      opt.onclick = () => { setCustomSelectValue('cb-enchant-base', b, displayHtml); toggleCustomSelect('cb-enchant-base-options'); };
      cbBaseOpts.appendChild(opt);
    });
  }

  const cbCostumeOpts = document.getElementById('cb-costume-options');
  if(cbCostumeOpts) {
    const defaultOpt = document.createElement('div');
    defaultOpt.className = 'custom-select-option';
    defaultOpt.innerHTML = '- ??ルㅎ臾?-';
    defaultOpt.onclick = () => { setCustomSelectValue('cb-costume', '', ''); toggleCustomSelect('cb-costume-options'); };
    cbCostumeOpts.appendChild(defaultOpt);

    COSTUMES.forEach(c => {
      const cOpt = c[0];
      const imgHtml = characterImageHTML(c);
      const displayHtml = `${imgHtml} <span>${cOpt}</span>`;
      
      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.innerHTML = displayHtml;
      opt.onclick = () => { setCustomSelectValue('cb-costume', cOpt, displayHtml); toggleCustomSelect('cb-costume-options'); };
      cbCostumeOpts.appendChild(opt);
    });
  }
}
document.addEventListener('DOMContentLoaded', init);

