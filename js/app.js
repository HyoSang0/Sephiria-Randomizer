let WEAPON_TYPES,
    COSTUMES,
    CHARACTER_ASSETS,
    ENCHANT_IMAGE_KEYS,
    COMBOS,
    ENCHANT_TREE,
    ENCHANT_DETAILS,
    WEAPON_ENCHANT_MAP;
async function loadGameData() {
    const files = await Promise.all([
        fetch("./data/weapons.json"),
        fetch("./data/costumes.json"),
        fetch("./data/characters.json"),
        fetch("./data/combos.json"),
        fetch("./data/enchantments.json")
    ]);

    if (files.some(response => !response.ok)) {
        throw new Error("게임 데이터를 불러오지 못했습니다.");
    }

    const [weapons, costumes, characters, combos, enchantments] =
        await Promise.all(files.map(response => response.json()));

    WEAPON_TYPES = weapons;
    COSTUMES = costumes;
    CHARACTER_ASSETS = characters;
    COMBOS = combos;
    ENCHANT_IMAGE_KEYS = enchantments.imageKeys;
    ENCHANT_TREE = enchantments.tree;
    ENCHANT_DETAILS = enchantments.details;
    WEAPON_ENCHANT_MAP = enchantments.weaponMap;
}
/* ================= STATE ================= */
let comboCount = 1;
const histories = { weapon: [], enchant: [], costume: [], combo: [] };

/* ================= HELPERS ================= */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function pickMany(arr, n) {
    const pool = [...arr];
    const out = [];
    n = Math.min(n, pool.length);
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
    }
    return out;
}
function escapeHtml(s) {
    return String(s).replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
}
function escapeAttr(s) {
    return escapeHtml(s);
}

function imageFallback(img) {
    let rest = [];
    try {
        rest = JSON.parse(img.dataset.fallbacks || "[]");
    } catch (_) {
        rest = [];
    }
    if (rest.length) {
        const next = rest.shift();
        img.dataset.fallbacks = JSON.stringify(rest);
        img.src = next;
        return;
    }
    const wrap = img.closest(".result-image-wrap");
    if (wrap) wrap.classList.add("image-missing");
    img.remove();
}
function assetImageHTML(urls, alt, detail = false, imageClass = "") {
    const clean = [...new Set((urls || []).filter(Boolean))];
    if (!clean.length) return "";
    const fallback = JSON.stringify(clean.slice(1));
    const classes = `result-image${imageClass ? ` ${imageClass}` : ""}`;
    return `<div class="${detail ? "detail-visual" : "result-visual"}"><div class="result-image-wrap"><img class="${classes}" src="${escapeAttr(clean[0])}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async" data-fallbacks="${escapeAttr(fallback)}" onerror="imageFallback(this)"></div></div>`;
}
function weaponImageURLs(slug) {
    if (!slug) return [];
    const extensions = WEBP_FIRST_WEAPON_SLUGS.has(slug)
        ? WEBP_FIRST_IMAGE_EXTENSIONS
        : PNG_FIRST_IMAGE_EXTENSIONS;
    return extensions.map((ext) => `${WEAPON_IMAGE_BASE}/${slug}.${ext}`);
}
function weaponImageHTML(w, detail = false) {
    return assetImageHTML(
        weaponImageURLs(w.imageKey),
        `${w.en || w.name} weapon`,
        detail,
    );
}
function characterImageHTML(c, detail = false) {
    const a = CHARACTER_ASSETS[c[0]];
    if (!a) return "";
    return assetImageHTML(
        [`${CHARACTER_IMAGE_BASE}/character-${a.slug}.png`],
        `${a.en} character`,
        detail,
        "costume-image",
    );
}
function enchantImageHTML(name, detail = false) {
    return assetImageHTML(
        weaponImageURLs(ENCHANT_IMAGE_KEYS[name]),
        `${name} weapon evolution`,
        detail,
    );
}
function resultEnglishHTML(en) {
    return en ? `<div class="result-en">${escapeHtml(en)}</div>` : "";
}

/* -- 무기 강화 상세보기 모달 -- */
function openEnchantDetail(base, t1, t2) {
    const t1Data = ENCHANT_DETAILS[base] && ENCHANT_DETAILS[base][t1];
    if (!t1Data) {
        return;
    }
    let html = `
    <div class="detail-tier-label">${escapeHtml(base)} · 1차 강화</div>
    ${enchantImageHTML(t1, true)}
    <div class="detail-tier-name">${escapeHtml(t1)}</div>
    <div class="detail-effect">${escapeHtml(t1Data.effect || "(효과 정보 없음)")}</div>
  `;
    if (t2 && t1Data.t2 && t1Data.t2[t2]) {
        const t2Data = t1Data.t2[t2];
        html += `
      <hr class="detail-divider">
      <div class="detail-tier-label">2차 강화</div>
      ${enchantImageHTML(t2, true)}
      <div class="detail-tier-name">${escapeHtml(t2)}</div>
      <div class="detail-effect">${escapeHtml(t2Data.effect || "(효과 정보 없음)")}</div>
    `;
    }
    document.getElementById("detail-content").innerHTML = html;
    document.getElementById("detail-overlay").classList.add("open");
}
function closeEnchantDetail() {
    document.getElementById("detail-overlay").classList.remove("open");
}
document.addEventListener("click", function (ev) {
    const btn = ev.target.closest(".detail-btn");
    if (!btn) return;
    openEnchantDetail(btn.dataset.base, btn.dataset.t1, btn.dataset.t2 || null);
});
document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
        closeEnchantDetail();
        return;
    }
    if (ev.code !== "Space" || ev.repeat) return;
    if (document.getElementById("detail-overlay").classList.contains("open"))
        return;
    if (
        ev.target.closest?.(
            'button, a, input, select, textarea, [contenteditable="true"]',
        )
    )
        return;

    const rollButton = document.querySelector(".panel.active .roll-btn");
    if (!rollButton || rollButton.disabled) return;
    ev.preventDefault();
    rollButton.click();
});

function pushHistory(key, label) {
    histories[key].unshift(label);
    histories[key] = histories[key].slice(0, 5);
    const el = document.getElementById("hist-" + key);
    if (el) {
        el.innerHTML = histories[key].length
            ? "최근 기록 · " +
              histories[key].map((h) => `<b>${h}</b>`).join(" · ")
            : "";
    }
}

/* ================= TABS ================= */
document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll(".tab")
            .forEach((b) => b.classList.remove("active"));
        document
            .querySelectorAll(".panel")
            .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document
            .getElementById("panel-" + btn.dataset.tab)
            .classList.add("active");
    });
});

document.querySelectorAll("#combo-count button").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll("#combo-count button")
            .forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        comboCount = parseInt(btn.dataset.n, 10);
    });
});

/* -- custom multi-select -- */
let customComboCount = 1;
const customCombEl = document.getElementById("custom-combo-count");

function syncCustomComboVisibility() {
    const comboOn = document
        .querySelector('#custom-picks button[data-key="combo"]')
        .classList.contains("on");
    customCombEl.style.display = comboOn ? "flex" : "none";
}

document.querySelectorAll("#custom-picks button").forEach((btn) => {
    btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        // guard: at least one category must stay selected
        const anyOn = [
            ...document.querySelectorAll("#custom-picks button"),
        ].some((b) => b.classList.contains("on"));
        if (!anyOn) btn.classList.add("on");
        syncCustomComboVisibility();
    });
});
syncCustomComboVisibility();

document.querySelectorAll("#custom-combo-count button").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll("#custom-combo-count button")
            .forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        customComboCount = parseInt(btn.dataset.n, 10);
    });
});

/* ================= RENDERERS ================= */
function renderWeapon() {
    const w = pick(WEAPON_TYPES);
    document.getElementById("card-weapon").innerHTML = `
    <div class="kicker">오늘의 무기</div>
    ${weaponImageHTML(w)}
    <div class="result-name">${w.name}</div>
    ${resultEnglishHTML(w.en)}
    <div class="result-note">${w.note}</div>
    <div class="tag-row"><span class="pill">${w.tag}</span></div>
  `;
    pushHistory("weapon", w.name);
}

function renderEnchant() {
    const e = pick(ENCHANT_TREE);
    const hasT2 = e.t2 && e.t2.length > 0;
    const chosenT2 = hasT2 ? pick(e.t2) : null;
    const shown = chosenT2 || e.t1;
    const chain =
        `${e.base} → ${e.t1}` +
        (chosenT2 ? ` → ${chosenT2}` : " (2차 강화 없음/미확인)");
    document.getElementById("card-enchant").innerHTML = `
    <div class="kicker">🔨 무기 강화</div>
    ${enchantImageHTML(shown)}
    <div class="result-name">${shown}</div>
    <div class="result-chain">${chain}</div>
    <button class="detail-btn" data-base="${escapeAttr(e.base)}" data-t1="${escapeAttr(e.t1)}" data-t2="${escapeAttr(chosenT2 || "")}">📜 상세보기</button>
  `;
    pushHistory("enchant", chosenT2 || e.t1);
}

function renderCostume() {
    const c = pick(COSTUMES);
    const a = CHARACTER_ASSETS[c[0]];
    document.getElementById("card-costume").innerHTML = `
    <div class="kicker">오늘의 코스튬</div>
    ${characterImageHTML(c)}
    <div class="result-name">${c[0]}</div>
    ${resultEnglishHTML(a && a.en)}
    <div class="result-note">${c[2]}</div>
    <div class="tag-row"><span class="pill">${c[1]}</span></div>
  `;
    pushHistory("costume", c[0]);
}

function renderCombo() {
    const picked = pickMany(COMBOS, comboCount);
    const title = picked.map((p) => p[0]).join(" + ");
    const notes = picked
        .map(
            (p) =>
                `<div class="result-note">· <b style="color:var(--parchment)">${p[0]}</b> — ${p[1]}</div>`,
        )
        .join("");
    document.getElementById("card-combo").innerHTML = `
    <div class="kicker">오늘의 콤보 태그</div>
    <div class="result-name">${title}</div>
    <div style="text-align:left; max-width:400px; margin:0 auto; display:flex; flex-direction:column; gap:6px;">${notes}</div>
  `;
    pushHistory("combo", title);
}

function renderBuild() {
    const e = pick(ENCHANT_TREE);
    const hasT2 = e.t2 && e.t2.length > 0;
    const chosenT2 = hasT2 ? pick(e.t2) : null;
    const weaponResult = chosenT2 || e.t1;
    const c = pick(COSTUMES);
    const combos = pickMany(COMBOS, 2);

    document.getElementById("card-build").innerHTML = `
    <div class="kicker" style="text-align:center;">오늘의 런 챌린지</div>
    ${enchantCardData(e, chosenT2).html}
    <div class="tag-row" style="margin-top:16px;">
      <span class="pill">🐇 코스튬: ${c[0]}</span>
      <span class="pill">🔮 콤보: ${combos.map((x) => x[0]).join(" / ")}</span>
    </div>
    <div class="result-note" style="margin-top:14px;">
      ${c[0]} (${c[2]})을 입고, <b style="color:var(--parchment)">${combos.map((x) => x[0]).join(" · ")}</b> 태그 위주로 아티팩트를 모으며
      <b style="color:var(--parchment)">${weaponResult}</b> 무기로 이번 챌린지를 클리어해보세요.
    </div>
  `;
}

const RENDERERS = {
    weapon: renderWeapon,
    enchant: renderEnchant,
    costume: renderCostume,
    combo: renderCombo,
    build: renderBuild,
};

/* -- pure card-data builders: return {html, entries:[[key,label],...]} without side effects -- */
function weaponCardData(w) {
    return {
        entries: [["weapon", w.name]],
        html: `<div class="mini-card">
      <div class="kicker">⚔ 무기</div>
      ${weaponImageHTML(w)}
      <div class="result-name">${w.name}</div>
      ${resultEnglishHTML(w.en)}
      <div class="result-note">${w.note}</div>
      <div class="tag-row" style="justify-content:flex-start;"><span class="pill">${w.tag}</span></div>
    </div>`,
    };
}
function enchantCardData(e, chosenT2) {
    const chain =
        `${e.base} → ${e.t1}` +
        (chosenT2 ? ` → ${chosenT2}` : " (2차 강화 없음/미확인)");
    const shown = chosenT2 || e.t1;
    return {
        entries: [["enchant", shown]],
        html: `<div class="mini-card">
      <div class="kicker">🔨 무기 강화</div>
      ${enchantImageHTML(shown)}
      <div class="result-name">${shown}</div>
      <div class="result-chain">${chain}</div>
      ${e.special ? `<div class="result-note">${e.special}</div>` : ""}
      <button class="detail-btn" data-base="${escapeAttr(e.base)}" data-t1="${escapeAttr(e.t1)}" data-t2="${escapeAttr(chosenT2 || "")}">📜 상세보기</button>
    </div>`,
    };
}
function costumeCardData(c) {
    const a = CHARACTER_ASSETS[c[0]];
    return {
        entries: [["costume", c[0]]],
        html: `<div class="mini-card">
      <div class="kicker">🐇 코스튬</div>
      ${characterImageHTML(c)}
      <div class="result-name">${c[0]}</div>
      ${resultEnglishHTML(a && a.en)}
      <div class="result-note">${c[2]}</div>
      <div class="tag-row" style="justify-content:flex-start;"><span class="pill">${c[1]}</span></div>
    </div>`,
    };
}
function comboCardData(picked) {
    const title = picked.map((p) => p[0]).join(" + ");
    const notes = picked
        .map(
            (p) =>
                `<div class="result-note">· <b style="color:var(--parchment)">${p[0]}</b> — ${p[1]}</div>`,
        )
        .join("");
    return {
        entries: [["combo", title]],
        html: `<div class="mini-card">
      <div class="kicker">🔮 콤보</div>
      <div class="result-name">${title}</div>
      <div style="display:flex; flex-direction:column; gap:4px;">${notes}</div>
    </div>`,
    };
}
// 무기 + 무기 강화를 같이 뽑을 때: 강화 트리가 있는 무기 계열 중에서만 무기를 고르고,
// 그 무기 계열에 맞는 강화만 뽑아서 서로 어긋나지 않게 짝을 맞춘다.
function pairedWeaponEnchantData() {
    const validWeapons = WEAPON_TYPES.filter(
        (w) =>
            WEAPON_ENCHANT_MAP[w.name] && WEAPON_ENCHANT_MAP[w.name].length > 0,
    );
    const w = pick(validWeapons);
    const cands = ENCHANT_TREE.filter((e) =>
        WEAPON_ENCHANT_MAP[w.name].includes(e.base),
    );
    const e = pick(cands);
    const chosenT2 = e.t2 && e.t2.length > 0 ? pick(e.t2) : null;
    const note = `<p style="text-align:center; font-size:12px; color:var(--muted-dim); margin:-4px 0 2px;">
    ⚙ 서로 맞는 계열끼리 짝지어짐
  </p>`;
    const wd = weaponCardData(w),
        ed = enchantCardData(e, chosenT2);
    return {
        entries: [...wd.entries, ...ed.entries],
        html: note + wd.html + ed.html,
    };
}

/* -- build one full candidate set for the selected categories (no history writes) -- */
function buildCustomCandidate(selected, comboN) {
    const order = ["weapon", "enchant", "costume", "combo"];
    const pairMode =
        selected.includes("weapon") && selected.includes("enchant");
    let html = "";
    let entries = [];
    order
        .filter((k) => selected.includes(k))
        .forEach((k) => {
            let d;
            if (pairMode && k === "weapon") {
                d = pairedWeaponEnchantData();
            } else if (pairMode && k === "enchant") {
                return;
            } else if (k === "weapon") {
                d = weaponCardData(pick(WEAPON_TYPES));
            } else if (k === "enchant") {
                const e = pick(ENCHANT_TREE);
                const chosenT2 = e.t2 && e.t2.length > 0 ? pick(e.t2) : null;
                d = enchantCardData(e, chosenT2);
            } else if (k === "costume") {
                d = costumeCardData(pick(COSTUMES));
            } else if (k === "combo") {
                d = comboCardData(pickMany(COMBOS, comboN));
            }
            html += d.html;
            entries.push(...d.entries);
        });
    return { html, entries };
}

let customCandidates = [];

function selectCustomCandidate(i) {
    const c = customCandidates[i];
    if (!c) return;
    c.entries.forEach(([k, label]) => pushHistory(k, label));
    const container = document.getElementById("card-custom");
    container.innerHTML = `
    <div id="custom-chosen-summary">✅ 선택 완료 · ${c.entries.map((e) => e[1]).join(" · ")}</div>
    <div class="candidate-box chosen">
      <div class="candidate-label">선택한 조합</div>
      ${c.html}
    </div>
  `;
}

/* ================= ROLL ANIMATION ================= */
// 룰렛처럼 처음엔 빠르게 틱, 뒤로 갈수록 점점 느려지다 멈추는 감속 시퀀스.
// n개의 지연시간(ms) 배열을 ease-in-quad 곡선으로 생성한다 (약 1초 이내 완료).
function rollDelays(n) {
    const delays = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const eased = t * t;
        delays.push(Math.round((55 + eased * 285) * 0.45));
    }
    return delays;
}
// el: 애니메이션을 걸 요소, onTick(i,total): 매 틱마다 화면 갱신, onDone: 최종 결과 반영
function animatedRoll(el, onTick, onDone, n) {
    n = n || 15;
    const delays = rollDelays(n);
    el.classList.add("rolling");
    let i = 0;
    function step() {
        if (i < delays.length) {
            // 마지막 4틱은 흔들림을 크게 늦춰서 "천천히 멈추는" 느낌을 준다
            if (i === delays.length - 4) {
                el.classList.add("rolling-slow");
            }
            onTick(i, delays.length);
            i++;
            setTimeout(step, delays[i - 1]);
        } else {
            el.classList.remove("rolling", "rolling-slow");
            onDone();
        }
    }
    step();
}

function rollCustom() {
    const selected = [
        ...document.querySelectorAll("#custom-picks button.on"),
    ].map((b) => b.dataset.key);
    const container = document.getElementById("card-custom");
    const btn = event.currentTarget;
    btn.disabled = true;
    container.style.opacity = ".5";
    animatedRoll(
        container,
        () => {
            container.innerHTML = `<p class="placeholder" style="text-align:center;">뽑는 중...</p>`;
        },
        () => {
            container.style.opacity = "1";
            customCandidates = [
                buildCustomCandidate(selected, customComboCount),
                buildCustomCandidate(selected, customComboCount),
                buildCustomCandidate(selected, customComboCount),
            ];
            const boxes = customCandidates
                .map(
                    (c, i) => `
      <div class="candidate-box" id="candidate-box-${i}">
        <div class="candidate-label">옵션 ${i + 1}</div>
        ${c.html}
        <button class="ghost-btn" style="width:100%;" onclick="selectCustomCandidate(${i})">이 조합 선택</button>
      </div>
    `,
                )
                .join("");
            container.innerHTML = `
      <div id="custom-chosen-summary">3개 중 마음에 드는 조합을 하나 골라보세요</div>
      <div class="candidate-grid">${boxes}</div>
    `;
            btn.disabled = false;
        },
    );
}

function roll(key) {
    const card = document.getElementById("card-" + key);
    const btn = event.currentTarget;
    btn.disabled = true;
    card.style.opacity = ".5";
    const flickerPool =
        key === "weapon"
            ? WEAPON_TYPES.map((w) => w.name)
            : key === "costume"
              ? COSTUMES.map((c) => c[0])
              : key === "combo"
                ? COMBOS.map((c) => c[0])
                : ENCHANT_TREE.map((e) => e.t1);
    animatedRoll(
        card,
        () => {
            card.innerHTML = `<div class="kicker">뽑는 중...</div><div class="result-name">${pick(flickerPool)}</div>`;
        },
        () => {
            card.style.opacity = "1";
            RENDERERS[key]();
            btn.disabled = false;
        },
    );
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadGameData();
});
