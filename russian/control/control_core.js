(() => {
  "use strict";

  // Показ ошибки вместо “белого экрана”
  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap; background:rgba(255,255,255,.06); padding:12px; border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.8;margin-top:10px">Открой консоль (F12 → Console), там будет та же ошибка.</div>
      </div>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[m]));
  }

  try {
    const cfg = window.CONTROL_CONFIG || {};
    const mode = cfg.mode || "student";
    const dataUrl = cfg.dataUrl || "./variant26_cut.json";

    // Таймер
    const DURATION_MIN = Number(cfg.durationMinutes || 60);
    const WARN_10_MS = 10 * 60 * 1000;
    const WARN_5_MS  = 5 * 60 * 1000;

    // Storage
    const STORAGE_KEY = "kontrol:" + dataUrl;
    const ID_KEY      = STORAGE_KEY + ":identity";
    const TIMER_KEY   = STORAGE_KEY + ":timer";
    const SENT_KEY    = STORAGE_KEY + ":sent";

    const $ = (s, r = document) => r.querySelector(s);

    function normText(s) {
      if (s == null) return "";
      return String(s).trim().replace(/\s+/g, " ");
    }

    // ФИО с заглавных
    function capWord(w) {
      const s = String(w || "").trim();
      if (!s) return "";
      return s[0].toUpperCase() + s.slice(1).toLowerCase();
    }
    function normalizeFioInput(raw) {
      const parts = String(raw || "")
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(Boolean)
        .slice(0, 3);
      return parts.map(capWord).join(" ");
    }
    function normalizeClassInput(raw) {
      return String(raw || "")
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase()
        .slice(0, 6);
    }

    // best-effort: блокировка копирования
    function enableCopyBlock() {
      document.body.classList.add("nocopy");
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
      ["copy","cut","paste","contextmenu","selectstart","dragstart"].forEach(ev => {
        document.addEventListener(ev, stop, true);
      });
      document.addEventListener("keydown", (e) => {
        const k = (e.key || "").toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ["c","x","a","s","p"].includes(k)) stop(e);
        if (e.key === "PrintScreen") stop(e);
      }, true);
    }

    // водяной знак
    function enableWatermark(text) {
      const w = document.createElement("div");
      w.id = "wmark";
      w.innerHTML = `<div class="t">${text}</div>`;
      document.body.appendChild(w);

      let t = 0;
      setInterval(() => {
        t += 1;
        const el = w.querySelector(".t");
        if (!el) return;
        el.style.transform =
          `translate(-50%,-50%) rotate(-22deg) translate(${Math.sin(t/7)*12}px, ${Math.cos(t/9)*10}px)`;
      }, 250);
    }

    function saveJSON(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }
    function loadJSON(key) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch { return null; }
    }

    async function sha256Hex(str) {
      const enc = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    }

    // ===== ТЕКСТЫ ВАРИАНТА =====
    let textPart1 = "";
    let textPart2 = "";

    function updateTextCardForTaskId(taskId) {
      const card = $("#textCard");
      const box  = $("#textHtml");
      if (!card || !box) return;

      // нет текста — скрываем
      if (!textPart1 && !textPart2) {
        card.style.display = "none";
        box.innerHTML = "";
        return;
      }

      // если одна часть (без <hr>) — показываем всегда
      if (textPart1 && !textPart2) {
        card.style.display = "block";
        box.innerHTML = textPart1;
        return;
      }

      if (taskId >= 1 && taskId <= 3 && textPart1) {
        card.style.display = "block";
        box.innerHTML = textPart1;
      } else if (taskId >= 23 && taskId <= 26 && textPart2) {
        card.style.display = "block";
        box.innerHTML = textPart2;
      } else {
        card.style.display = "none";
        box.innerHTML = "";
      }
    }

    function appTemplate() {
      return `
        <header>
          <div class="wrap">
            <h1 id="title">Контрольная работа</h1>

            <div class="btnbar" id="topBtns">
              <button id="prev" class="secondary">← Предыдущее</button>
              <button id="next" class="secondary">Следующее →</button>
              <button id="export">Выгрузить результат</button>
              <button id="reset" class="secondary">Сброс</button>
            </div>

            <div class="sub" id="identityLine" style="margin-top:8px; display:none"></div>
            <div class="sub" id="timerLine" style="margin-top:6px; display:none"></div>
          </div>
        </header>

        <main class="wrap">
          <div class="card" id="identityCard" style="display:none">
            <div class="qid">Данные ученика</div>
            <div class="qtext">Введите <b>Фамилию и имя</b> и <b>класс</b>.</div>
            <div class="ansrow">
              <input id="fio" type="text" placeholder="Фамилия Имя" autocomplete="off">
              <input id="cls" type="text" placeholder="Класс (например: 10А)" autocomplete="off" style="max-width:220px">
              <button id="start">Начать</button>
            </div>
            <div class="qhint" style="margin-top:10px">
              ${DURATION_MIN} минут. За 10 и 5 минут до конца появятся напоминания.
              По истечении времени результаты будут автоматически отправлены.
            </div>
          </div>

          <div class="card" id="textCard" style="display:none">
            <div class="qid">Текст</div>
            <div class="qtext" id="textHtml"></div>
          </div>

          <div class="grid" id="grid"></div>
        </main>
      `;
    }

    // ===== state =====
    let data = null;
    let idx = 0;
    let identity = null;

    let submitInFlight = false;
    let submitDone = false;
    let sentHash = null;

    let timer = {
      startedAt: null,
      durationMs: DURATION_MIN * 60 * 1000,
      warned10: false,
      warned5: false,
      finished: false,
    };
    let timerTick = null;

    function saveProgress() {
      const state = {
        idx,
        answers: (data?.tasks || []).reduce((m, t) => {
          const inp = $(`#in-${t.id}`);
          m[t.id] = { value: inp?.value || "" };
          return m;
        }, {}),
        ts: new Date().toISOString(),
      };
      saveJSON(STORAGE_KEY, state);
    }
    function loadProgress() { return loadJSON(STORAGE_KEY); }

    function renderTask(t) {
      return `
        <section class="card" id="card-${t.id}">
          <div class="qtop">
            <div>
              <div class="qid">Задание ${t.id}</div>
              <div class="qhint">${t.hint || ""}</div>
            </div>
          </div>

          <div class="qtext">${t.text}</div>

          <div class="ansrow">
            <input type="text" id="in-${t.id}" placeholder="Введите ответ…" autocomplete="off" />
          </div>
        </section>
      `;
    }

    function showOnlyCurrent() {
      (data.tasks || []).forEach((t, i) => {
        const card = $(`#card-${t.id}`);
        if (card) card.style.display = (i === idx) ? "block" : "none";
      });

      const current = (data.tasks || [])[idx];
      if (current) updateTextCardForTaskId(Number(current.id));

      saveProgress();
    }

    function goNext() { saveProgress(); if (idx < (data.tasks||[]).length - 1) idx++; showOnlyCurrent(); }
    function goPrev() { saveProgress(); if (idx > 0) idx--; showOnlyCurrent(); }

    function allAnswered() {
      return (data.tasks || []).every((t) => normText($(`#in-${t.id}`)?.value || "") !== "");
    }

    function buildResultPack() {
      const tasks = data.tasks || [];
      const answers = tasks.map((t) => ({
        id: t.id,
        value: $(`#in-${t.id}`)?.value || "",
      }));

      return {
        meta: data.meta || {},
        variant: (data?.meta?.variant || cfg.variant || "unknown"),
        identity: identity || null,
        ts: new Date().toISOString(),
        durationMinutes: DURATION_MIN,
        timer: { startedAt: timer.startedAt, finished: timer.finished },
        answers,
      };
    }

    async function submitResultToCloud(pack) {
      const url = cfg.submitUrl;
      if (!url) throw new Error("submitUrl не задан в CONTROL_CONFIG");

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pack),
      });

      const txt = await r.text();
      let json = null;
      try { json = JSON.parse(txt); } catch {}
      if (!r.ok) throw new Error(`Upload failed: ${r.status} ${txt}`);
      return json || { ok: true };
    }

    async function exportResult({ auto = false } = {}) {
      if (submitInFlight) return;

      if (mode === "student" && cfg.exportOnlyAfterFinish) {
        if (!allAnswered()) {
          if (!auto) alert("Отправка доступна только после выполнения ВСЕХ заданий.");
          return;
        }
      }

      const pack = buildResultPack();
      const hash = await sha256Hex(JSON.stringify(pack));

      if (submitDone && sentHash === hash) {
        if (!auto) alert("Результат уже отправлен ✅");
        return;
      }

      const btn = $("#export");
      submitInFlight = true;
      if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

      try {
        const resp = await submitResultToCloud(pack);

        submitDone = true;
        sentHash = hash;
        saveJSON(SENT_KEY, { submitDone, sentHash, ts: new Date().toISOString() });

        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }

        if (!auto) alert("Результат отправлен ✅" + (resp?.key ? `\nФайл: ${resp.key}` : ""));
      } catch (e) {
        submitInFlight = false;
        if (btn) { btn.disabled = false; btn.textContent = "Выгрузить результат"; }
        if (!auto) alert("Не удалось отправить результат.\n\n" + (e?.message || e));
      }
    }

    function resetAll() {
      if (!confirm("Сбросить ответы на этом устройстве?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TIMER_KEY);
      localStorage.removeItem(SENT_KEY);
      location.reload();
    }

    function fmtMs(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
    }

    function startTimerIfNeeded() {
      const saved = loadJSON(TIMER_KEY);
      if (saved && saved.startedAt && !saved.finished) {
        timer = saved;
      } else if (!timer.startedAt) {
        timer.startedAt = Date.now();
        timer.finished = false;
        timer.warned10 = false;
        timer.warned5 = false;
        saveJSON(TIMER_KEY, timer);
      }

      const line = $("#timerLine");
      if (line) line.style.display = "block";

      if (timerTick) clearInterval(timerTick);
      timerTick = setInterval(async () => {
        const now = Date.now();
        const endAt = Number(timer.startedAt) + Number(timer.durationMs);
        const left = endAt - now;

        if (line) line.textContent = `Осталось времени: ${fmtMs(left)}`;

        if (!timer.warned10 && left <= WARN_10_MS && left > WARN_5_MS) {
          timer.warned10 = true;
          saveJSON(TIMER_KEY, timer);
          alert("Через 10 минут результаты контрольной работы будут автоматически выгружены.");
        }
        if (!timer.warned5 && left <= WARN_5_MS && left > 0) {
          timer.warned5 = true;
          saveJSON(TIMER_KEY, timer);
          alert("Осталось 5 минут до конца контрольной.");
        }
        if (!timer.finished && left <= 0) {
          timer.finished = true;
          saveJSON(TIMER_KEY, timer);

          saveProgress();
          await exportResult({ auto: true });

          alert("Время вышло. Результаты отправлены.");
          clearInterval(timerTick);
        }
      }, 1000);
    }

    async function loadData() {
      const r = await fetch(dataUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("Не удалось загрузить файл заданий: " + r.status);
      return await r.json();
    }

    function buildAndRestore() {
      const grid = $("#grid");
      grid.innerHTML = (data.tasks || []).map(renderTask).join("");

      $("#prev").onclick = goPrev;
      $("#next").onclick = goNext;
      $("#export").onclick = () => exportResult({ auto: false });
      $("#reset").onclick = resetAll;

      const st = loadProgress();
      if (st) {
        idx = Math.max(0, Math.min(st.idx || 0, (data.tasks || []).length - 1));
        Object.entries(st.answers || {}).forEach(([id, v]) => {
          const inp = $(`#in-${id}`);
          if (inp) inp.value = v.value || "";
        });
      }

      const sent = loadJSON(SENT_KEY);
      if (sent && sent.submitDone) {
        submitDone = true;
        sentHash = sent.sentHash || null;
        const btn = $("#export");
        if (btn) { btn.disabled = true; btn.textContent = "Отправлено ✅"; }
      }

      (data.tasks || []).forEach((t) => {
        const inp = $(`#in-${t.id}`);
        if (!inp) return;
        inp.addEventListener("input", () => saveProgress());
        inp.addEventListener("blur", () => saveProgress());
      });

      showOnlyCurrent();
      startTimerIfNeeded();
    }

    async function init() {
      const app = $("#app");
      if (!app) throw new Error("Не найден контейнер #app в HTML");
      app.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) enableCopyBlock();

      data = await loadData();

      // Разделяем meta.textHtml по <hr>
      textPart1 = "";
      textPart2 = "";
      if (data.meta?.textHtml) {
        const html = String(data.meta.textHtml);
        const parts = html.includes("<hr>") ? html.split("<hr>") :
                     html.includes("<hr/>") ? html.split("<hr/>") :
                     html.includes("<hr />") ? html.split("<hr />") : [html];
        textPart1 = parts[0] || "";
        textPart2 = parts.slice(1).join("<hr>") || "";
      }

      // ID
      identity = loadJSON(ID_KEY);
      const needId = (mode === "student" && cfg.requireIdentity);

      if (needId && (!identity || !identity.fio || !identity.cls)) {
        $("#identityCard").style.display = "block";
        $("#identityLine").style.display = "none";
        $("#topBtns").style.display = "none";
        $("#textCard").style.display = "none";
        $("#timerLine").style.display = "none";

        $("#fio").addEventListener("blur", () => { $("#fio").value = normalizeFioInput($("#fio").value); });
        $("#cls").addEventListener("blur", () => { $("#cls").value = normalizeClassInput($("#cls").value); });

        $("#start").onclick = () => {
          const fio = normalizeFioInput($("#fio").value);
          const cls = normalizeClassInput($("#cls").value);

          if (!fio || fio.split(" ").length < 2) { alert("Введите Фамилию и Имя (через пробел)."); return; }
          if (!cls) { alert("Введите класс (например: 10А)."); return; }

          identity = { fio, cls };
          saveJSON(ID_KEY, identity);

          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;

          if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);

          // старт таймера
          timer = {
            startedAt: Date.now(),
            durationMs: DURATION_MIN * 60 * 1000,
            warned10: false,
            warned5: false,
            finished: false,
          };
          saveJSON(TIMER_KEY, timer);

          buildAndRestore();
        };

        return;
      }

      if (needId) {
        $("#identityLine").style.display = "block";
        $("#identityLine").innerHTML = `Ученик: <b>${identity.fio}</b>, класс <b>${identity.cls}</b>`;
        if (cfg.watermark) enableWatermark(`${identity.cls} • ${identity.fio} • ${new Date().toLocaleString()}`);
      }

      buildAndRestore();
    }

    document.addEventListener("DOMContentLoaded", () => {
      init().catch(showFatal);
    });

  } catch (e) {
    showFatal(e);
  }
})();
