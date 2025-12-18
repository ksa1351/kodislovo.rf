/*  ---------- CONTROL CORE CLEAN BUILD (FINAL) ----------- 
    Настройки, подтверждённые пользователем:
    1. Панель управления сверху — оставить 
    2. Под заданием — только Prev/Next 
    3. Текстовые блоки — отображать над заданием
    4. Email отправка — M2 (mailto, без тела), тема: Контрольная работа ФИО, класс
    5. Все остальные функции — оставить как есть
-------------------------------------------------------------- */

(() => {
  "use strict";

  // =====================================================================
  //                          HELPERS
  // =====================================================================

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function showFatal(err) {
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    document.documentElement.style.background = "#0b1020";
    document.body.innerHTML = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#fff">
        <h2 style="margin:0 0 10px">Ошибка в контрольной</h2>
        <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);
             padding:12px;border-radius:12px">${escapeHtml(msg)}</pre>
        <div style="opacity:.85;margin-top:10px">
          Проверьте путь к файлу данных и консоль браузера (F12 → Console).
        </div>
      </div>`;
  }

  function normText(s) {
    if (s == null) return "";
    return String(s).trim().replace(/\s+/g, " ");
  }

  function capWord(w) {
    const s = String(w || "").trim();
    return s ? (s[0].toUpperCase() + s.slice(1).toLowerCase()) : "";
  }

  function normalizeFioInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .map(capWord)
      .join(" ");
  }

  function normalizeClassInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  function saveJSON(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function fmtMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function enableCopyBlock() {
    document.body.classList.add("nocopy");
    const stop = e => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"]
      .forEach(ev => document.addEventListener(ev, stop, true));

    document.addEventListener("keydown", e => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p"].includes(k)) stop(e);
      if (e.key === "PrintScreen") stop(e);
    }, true);
  }

  function enableWatermark(text) {
    const w = document.createElement("div");
    w.id = "wmark";
    w.innerHTML = `<div class="t">${escapeHtml(text)}</div>`;
    document.body.appendChild(w);

    let t = 0;
    setInterval(() => {
      t += 1;
      const el = w.querySelector(".t");
      if (!el) return;
      el.style.transform =
        `translate(-50%,-50%) rotate(-22deg)
         translate(${Math.sin(t / 7) * 12}px, ${Math.cos(t / 9) * 10}px)`;
    }, 240);
  }

  // =====================================================================
  //                         RENDER & UI
  // =====================================================================

  function injectStyles() {
    const st = document.createElement("style");
    st.textContent = `
      /* Дополнительные стили для control_core.js */
      body { 
        background: #0b1020;
        color: #e1e7f5;
        margin: 0;
        font-family: system-ui, Segoe UI, Arial, sans-serif;
        min-height: 100vh;
      }
      
      .wrap { 
        max-width: 1000px;
        margin: 0 auto;
        padding: 0 20px; 
      }
      
      header { 
        padding: 12px 0;
        background: #0a1228;
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      
      h1 { 
        font-size: 30px;
        margin: 0 0 12px;
        text-align: center; 
      }
      
      .btnbar { 
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 10px; 
      }
      
      button { 
        padding: 12px 24px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        background: #2d4bff;
        color: white;
        font-family: inherit;
        font-size: 16px;
        transition: opacity 0.2s;
      }
      
      button.secondary { 
        background: rgba(255,255,255,.08); 
      }
      
      button:hover {
        opacity: 0.9;
      }
      
      button:disabled { 
        opacity: .6;
        cursor: not-allowed;
      }

      #wmark { 
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%);
        opacity: .15;
        font-size: 38px;
        pointer-events: none; 
      }

      .card { 
        background: rgba(255,255,255,.06);
        border-radius: 12px;
        padding: 22px;
        margin: 20px 0;
        border: 1px solid rgba(255,255,255,.08); 
      }
      
      .qid { 
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 10px; 
      }

      .ansrow { 
        margin-top: 20px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }
      
      input[type="text"] { 
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.2);
        background: rgba(255,255,255,.1);
        color: white;
        font-family: inherit;
        font-size: 16px;
        flex: 1;
        min-width: 200px;
      }
      
      input[type="text"]:focus {
        outline: none;
        border-color: #2d4bff;
        background: rgba(255,255,255,.15);
      }
      
      input[type="text"]::placeholder {
        color: rgba(255,255,255,.5);
      }
      
      input[type="text"]:disabled { 
        opacity: 0.5; 
        cursor: not-allowed; 
        background: rgba(255,255,255,.05); 
      }

      .nav-buttons-below { 
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 25px; 
      }
      
      /* Адаптивность */
      @media (max-width: 768px) {
        .wrap {
          padding: 0 16px;
        }
        
        .ansrow {
          flex-direction: column;
        }
        
        input[type="text"] {
          width: 100%;
          min-width: auto;
        }
        
        .btnbar {
          flex-direction: column;
        }
        
        button {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function appTemplate() {
    return `
      <header>
        <div class="wrap">
          <h1 id="title">Контрольная работа</h1>
          <div class="sub" id="identityLine" style="margin-top:8px;display:none"></div>
          <div class="sub" id="timerLine" style="margin-top:6px;display:none"></div>

          <div class="btnbar" id="topBtns" style="display:none">
            <button id="export">Сохранить работу</button>
            <button id="exportEmail" class="secondary">Отправить на email</button>
          </div>
        </div>
      </header>

      <main class="wrap">
        <div class="card" id="identityCard" style="display:block">
          <div class="qid">Данные ученика</div>
          <div>Введите ФИО и класс</div>
          <div class="ansrow">
            <input id="fio" placeholder="Фамилия Имя">
            <input id="cls" placeholder="Класс">
            <button id="start">Начать</button>
          </div>
          <div id="loadingMessage" style="display:none; margin-top: 15px; color: #2d4bff; text-align: center;">
            Загрузка данных...
          </div>
        </div>

        <div id="questionContainer"></div>
      </main>
    `;
  }

  function renderTask(t, currentValue, isTimeUp = false) {
    return `
      <section class="card">
        <div class="qid">Задание ${t.id}</div>
        <div class="qtext">${t.text || ""}</div>

        <div class="ansrow">
          <input type="text" id="in-${t.id}" value="${escapeHtml(currentValue || "")}" 
                 ${isTimeUp ? 'disabled' : ''} placeholder="Введите ответ">
        </div>

        <div class="nav-buttons-below">
          <button id="prevBtn" class="secondary" ${isTimeUp ? 'disabled' : ''}>← Предыдущее</button>
          <button id="nextBtn" class="secondary" ${isTimeUp ? 'disabled' : ''}>Следующее →</button>
        </div>
      </section>
    `;
  }

  // =====================================================================
  //                         TEXT BLOCKS
  // =====================================================================

  function loadTextBlocksFromMeta(meta) {
    const blocks = [];
    const texts = meta?.texts;

    if (texts && typeof texts === "object") {
      for (const k of Object.keys(texts)) {
        const obj = texts[k];
        if (!obj?.html) continue;

        const from = Number(obj.range?.[0]);
        const to = Number(obj.range?.[1]);
        if (!Number.isFinite(from) || !Number.isFinite(to)) continue;

        blocks.push({
          from: Math.min(from, to),
          to: Math.max(from, to),
          title: obj.title || "Текст",
          html: obj.html
        });
      }
    } else if (meta?.textHtml) {
      blocks.push({
        from: -Infinity,
        to: Infinity,
        title: "Текст",
        html: meta.textHtml
      });
    }

    return blocks;
  }

  function currentTaskHasText(taskId, blocks) {
    return blocks.some(b => taskId >= b.from && taskId <= b.to);
  }

  function getTextForTask(taskId, blocks) {
    return blocks.find(b => taskId >= b.from && taskId <= b.to)?.html || null;
  }

  // =====================================================================
  //                       SAVE / RESTORE PROGRESS
  // =====================================================================

  function saveProgress(stateKey, allAnswers, tasks, idx) {
    const currentTask = tasks[idx];
    if (currentTask) {
      const inp = $(`#in-${currentTask.id}`);
      if (inp) allAnswers[currentTask.id] = { value: inp.value || "" };
    }
    saveJSON(stateKey, { idx, answers: allAnswers, ts: new Date().toISOString() });
  }

  // =====================================================================
  //                        RESULT PACK BUILDERS
  // =====================================================================

  function buildResultPack(tasks, allAnswers, identity, meta, DURATION_MIN, timer) {
    return {
      meta: meta || {},
      variant: meta?.variant || "unknown",
      identity,
      ts: new Date().toISOString(),
      durationMinutes: DURATION_MIN,
      timer: { startedAt: timer.startedAt, finished: timer.finished },
      answers: tasks.map(t => ({
        id: t.id,
        value: allAnswers[t.id]?.value || ""
      }))
    };
  }

  function buildResultPackWithZeros(tasks, allAnswers, identity, meta, DURATION_MIN, timer) {
    const answers = tasks.map(t => ({
      id: t.id,
      value: normText(allAnswers[t.id]?.value || "") !== "" ?
               allAnswers[t.id].value : "0"
    }));

    return {
      meta: meta || {},
      variant: meta?.variant || "unknown",
      identity,
      ts: new Date().toISOString(),
      durationMinutes: DURATION_MIN,
      timer: {
        startedAt: timer.startedAt,
        finished: false,
        earlySubmit: true
      },
      answers
    };
  }

  // =====================================================================
  //                       EMAIL EXPORT (M2)
  // =====================================================================

  function exportEmail(identity, pack) {
    const fileName = `kontrol_${(identity?.fio||"")}_${(identity?.cls||"")}.json`
      .replace(/\s+/g, "_");

    const json = JSON.stringify(pack, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const subject = `Контрольная работа ${identity?.fio || ""}, ${identity?.cls || ""}`
      .trim();

    const link = document.createElement("a");
    link.href = `mailto:kovaleva-sa@yandex.ru?subject=${encodeURIComponent(subject)}`;
    link.click();

    // Имитируем скачивание файла (как вложение пользователем)
    const dl = document.createElement("a");
    dl.href = url;
    dl.download = fileName;
    dl.click();

    URL.revokeObjectURL(url);
  }

  // =====================================================================
  //                       FILE SAVE FUNCTION
  // =====================================================================

  function saveToFile(pack, identity) {
    const fileName = `kontrol_${(identity?.fio||"")}_${(identity?.cls||"")}.json`
      .replace(/\s+/g, "_");

    const json = JSON.stringify(pack, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    
    // Добавляем в DOM, кликаем и удаляем
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Освобождаем память
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return fileName;
  }

  // =====================================================================
  //                        MAIN LOGIC
  // =====================================================================

  document.addEventListener("DOMContentLoaded", async () => {
    console.log("Контрольная запускается...");
    
    try {
      const cfg = window.CONTROL_CONFIG || {};
      const mode = cfg.mode || "student";
      const dataUrl = cfg.dataUrl || "./variant26_cut.json"; // Значение по умолчанию
      const DURATION_MIN = Number(cfg.durationMinutes ?? 60);

      console.log("Конфигурация:", cfg);
      console.log("Путь к данным:", dataUrl);

      // Вставляем стили
      injectStyles();
      
      // Вставляем шаблон
      document.body.innerHTML = appTemplate();

      if (mode === "student" && cfg.blockCopy) {
        enableCopyBlock();
      }

      // Устанавливаем обработчик для кнопки "Начать"
      $("#start").onclick = async () => {
        const fio = normalizeFioInput($("#fio").value);
        const cls = normalizeClassInput($("#cls").value);

        if (!fio || fio.split(" ").length < 2) {
          alert("Введите Фамилию и Имя.");
          return;
        }
        if (!cls) {
          alert("Введите класс.");
          return;
        }

        // Показываем сообщение о загрузке
        $("#loadingMessage").style.display = "block";
        $("#start").disabled = true;
        $("#start").textContent = "Загрузка...";

        try {
          // Загружаем данные
          console.log("Загрузка данных из:", dataUrl);
          const r = await fetch(dataUrl, { cache: "no-store" });
          
          if (!r.ok) {
            throw new Error(`Ошибка HTTP ${r.status}: Не удалось загрузить файл заданий. Проверьте путь: ${dataUrl}`);
          }
          
          const data = await r.json();
          console.log("Данные загружены:", data);

          const tasks = data.tasks || [];
          const meta = data.meta || {};

          if (tasks.length === 0) {
            throw new Error("Файл заданий не содержит задач");
          }

          // Сохраняем идентификацию пользователя
          const identity = { fio, cls };
          const STORAGE_KEY = "kontrol:" + dataUrl;
          const ID_KEY = STORAGE_KEY + ":identity";
          const TIMER_KEY = STORAGE_KEY + ":timer";
          const SENT_KEY = STORAGE_KEY + ":sent";
          
          saveJSON(ID_KEY, identity);

          // Инициализация состояния
          let allAnswers = {};
          let idx = 0;
          let timeUp = false;

          // Восстанавливаем прогресс
          const st = loadJSON(STORAGE_KEY);
          if (st) {
            idx = Math.min(Math.max(st.idx || 0, 0), tasks.length - 1);
            allAnswers = st.answers || {};
          }

          // Таймер
          let timer = loadJSON(TIMER_KEY) || {
            startedAt: null,
            durationMs: DURATION_MIN * 60 * 1000,
            warned: {},
            finished: false
          };

          // Проверяем, не истекло ли уже время
          if (timer.finished) {
            timeUp = true;
          }

          // Скрываем форму и показываем панель управления
          $("#identityCard").style.display = "none";
          $("#topBtns").style.display = "flex";
          $("#identityLine").style.display = "block";
          $("#identityLine").innerHTML =
            `Ученик: <b>${escapeHtml(fio)}</b>, класс <b>${escapeHtml(cls)}</b>`;

          // Устанавливаем заголовок
          $("#title").textContent = meta.title || "Контрольная работа";

          // Водяной знак
          if (cfg.watermark) {
            enableWatermark(`${cls} • ${fio} • ${new Date().toLocaleString()}`);
          }

          // Запускаем таймер если нужно
          if (!timer.startedAt) {
            timer.startedAt = Date.now();
            saveJSON(TIMER_KEY, timer);
          }

          // Загружаем текстовые блоки
          const blocks = loadTextBlocksFromMeta(meta);

          // Функция отрисовки текущего задания
          function renderCurrent() {
            const t = tasks[idx];
            const container = $("#questionContainer");

            let html = "";

            if (currentTaskHasText(t.id, blocks)) {
              const textHtml = getTextForTask(t.id, blocks);
              if (textHtml) {
                html += `
                  <div class="card">
                    <div class="qid">Текст</div>
                    <div>${textHtml}</div>
                  </div>
                `;
              }
            }

            html += renderTask(t, allAnswers[t.id]?.value, timeUp);
            container.innerHTML = html;

            // Навигация
            $("#prevBtn").onclick = () => {
              if (timeUp) return;
              saveProgress(STORAGE_KEY, allAnswers, tasks, idx);
              if (idx > 0) idx--;
              renderCurrent();
            };
            
            $("#nextBtn").onclick = () => {
              if (timeUp) return;
              saveProgress(STORAGE_KEY, allAnswers, tasks, idx);
              if (idx < tasks.length - 1) idx++;
              renderCurrent();
            };

            // Автосохранение
            if (!timeUp) {
              const inp = $(`#in-${t.id}`);
              inp.addEventListener("input", () => saveProgress(STORAGE_KEY, allAnswers, tasks, idx));
            }
          }

          // Функция блокировки ввода
          function disableAllInputs() {
            $$('input[type="text"]').forEach(input => {
              input.disabled = true;
            });
            
            $$('#prevBtn, #nextBtn').forEach(button => {
              button.disabled = true;
            });
          }

          // Таймер
          function startTimer() {
            $("#timerLine").style.display = "block";

            const timerInterval = setInterval(() => {
              const now = Date.now();
              const left = (timer.startedAt + timer.durationMs) - now;

              if (left > 0) {
                $("#timerLine").textContent = `Осталось: ${fmtMs(left)}`;
              } else {
                $("#timerLine").textContent = `Время вышло`;
                
                if (!timer.finished) {
                  timer.finished = true;
                  timeUp = true;
                  saveJSON(TIMER_KEY, timer);

                  disableAllInputs();
                  saveProgress(STORAGE_KEY, allAnswers, tasks, idx);
                  smartSubmit(true);

                  alert("Время вышло. Работа сохранена. Ввод ответов заблокирован.");
                  renderCurrent();
                  clearInterval(timerInterval);
                }
              }
            }, 1000);
          }

          // Сохранение работы
          let submitInFlight = false;
          
          async function smartSubmit(auto = false) {
            if (submitInFlight) return;

            const filled = tasks.filter(t => normText(allAnswers[t.id]?.value || "") !== "").length;
            const total = tasks.length;
            const allFilled = filled === total;

            let pack;

            if (auto) {
              if (!allFilled) return;
              pack = buildResultPack(tasks, allAnswers, identity, meta, DURATION_MIN, timer);
            } else {
              if (allFilled) {
                if (!confirm(`Все задания выполнены (${filled}/${total}). Сохранить работу?`))
                  return;
                pack = buildResultPack(tasks, allAnswers, identity, meta, DURATION_MIN, timer);
              } else {
                if (!confirm(`Выполнено ${filled} из ${total}. Пустые ответы станут "0". Сохранить досрочно?`))
                  return;
                pack = buildResultPackWithZeros(tasks, allAnswers, identity, meta, DURATION_MIN, timer);
              }
            }

            submitInFlight = true;
            $("#export").disabled = true;
            $("#export").textContent = "Сохранение…";

            try {
              const fileName = saveToFile(pack, identity);
              saveJSON(STORAGE_KEY + ":result", pack);
              saveJSON(SENT_KEY, { saved: true });

              $("#export").disabled = false;
              $("#export").textContent = "Сохранить работу";

              if (!auto) {
                alert(`Результат сохранён в файл: ${fileName}\n\nФайл скачается в папку загрузок вашего браузера.`);
              }
            } catch (e) {
              console.error("Ошибка сохранения:", e);
              $("#export").disabled = false;
              $("#export").textContent = "Сохранить работу";
              alert("Ошибка сохранения:\n" + e.message);
            } finally {
              submitInFlight = false;
            }
          }

          // Обработчики кнопок
          $("#export").onclick = () => smartSubmit(false);
          $("#exportEmail").onclick = () => {
            const pack = buildResultPack(tasks, allAnswers, identity, meta, DURATION_MIN, timer);
            exportEmail(identity, pack);
          };

          // Восстанавливаем состояние кнопки сохранения
          const saved = loadJSON(SENT_KEY);
          if (saved && saved.saved) {
            $("#export").textContent = "Сохранить работу";
          }
          $("#export").disabled = false;

          // Начальная отрисовка и запуск таймера
          renderCurrent();
          startTimer();

        } catch (error) {
          console.error("Ошибка загрузки данных:", error);
          $("#loadingMessage").style.display = "none";
          $("#start").disabled = false;
          $("#start").textContent = "Начать";
          alert(`Ошибка загрузки данных: ${error.message}\n\nПроверьте:\n1. Существует ли файл ${dataUrl}\n2. Корректность JSON формата\n3. Консоль браузера (F12 → Console)`);
        }
      };

      // Добавляем обработчики для автоформатирования ввода
      $("#fio").addEventListener("blur", () => {
        $("#fio").value = normalizeFioInput($("#fio").value);
      });
      $("#cls").addEventListener("blur", () => {
        $("#cls").value = normalizeClassInput($("#cls").value);
      });

      // Автозапуск если данные уже есть
      const STORAGE_KEY = "kontrol:" + dataUrl;
      const ID_KEY = STORAGE_KEY + ":identity";
      const existingIdentity = loadJSON(ID_KEY);
      
      if (existingIdentity && existingIdentity.fio && existingIdentity.cls) {
        // Заполняем поля и автоматически нажимаем кнопку
        $("#fio").value = existingIdentity.fio;
        $("#cls").value = existingIdentity.cls;
        setTimeout(() => $("#start").click(), 100);
      }

    } catch (e) {
      console.error("Критическая ошибка инициализации:", e);
      showFatal(e);
    }
  });

})();
