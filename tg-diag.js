/*
 * tg-diag.js — диагностика запуска Mini App на телефоне.
 *
 * Зачем: если игра не стартует (чёрный экран, зависшая загрузка), изнутри
 * Telegram нет консоли. Панель показывает среду: WebGL2/WebGL1, WebAssembly,
 * память, DPR, наличие initData, текст ошибки движка — и умеет копировать всё
 * это в буфер, чтобы отправить разработчику.
 *
 * Открыть: 5 быстрых тапов в правый верхний угол. Панель также появляется сама,
 * если нет WebGL2 или поймана ошибка JS в первые 20 секунд.
 * Файл кладёт pack.mjs рядом с tg-bootstrap.js (проект игры не меняется).
 */
(function () {
  'use strict';

  var errors = [];
  var bootAt = Date.now();
  var panel = null;
  var shown = false;

  function pushError(text) {
    if (errors.length < 8) errors.push(String(text).slice(0, 300));
  }

  // Ошибки ловим сразу, ещё до создания панели.
  window.addEventListener('error', function (event) {
    var message = event && event.message ? event.message : event;
    var where = event && event.filename ? ' @ ' + String(event.filename).split('/').pop() : '';
    pushError('error: ' + message + where);
  });
  window.addEventListener('unhandledrejection', function (event) {
    pushError('promise: ' + (event && event.reason ? event.reason : 'unknown'));
  });

  function glSupport(name) {
    try {
      var canvas = document.createElement('canvas');
      return canvas.getContext(name) ? 'да' : 'НЕТ';
    } catch (e) {
      return 'ошибка';
    }
  }

  function collect() {
    var lines = [];
    var nav = navigator || {};
    var tg = window.Telegram && window.Telegram.WebApp;

    lines.push('Pongball — диагностика');
    lines.push('Сборка: ' + (window.__pongballBuild || 'неизвестно'));
    lines.push('UA: ' + (nav.userAgent || '?'));
    lines.push('Ядер: ' + (nav.hardwareConcurrency || '?')
      + ', память: ' + (nav.deviceMemory ? nav.deviceMemory + ' ГБ' : '?'));
    lines.push('Экран: ' + screen.width + 'x' + screen.height
      + ', DPR ' + (window.devicePixelRatio || 1));
    lines.push('WebGL2: ' + glSupport('webgl2') + ', WebGL1: ' + glSupport('webgl'));
    lines.push('WebAssembly: ' + (typeof WebAssembly === 'object' ? 'да' : 'НЕТ'));
    lines.push('Telegram: ' + (tg ? 'да' : 'нет') + ', initData: '
      + (tg && tg.initData ? String(tg.initData).length + ' симв.' : 'пусто'));
    lines.push('Сеть: ' + netState());

    var notice = document.getElementById('status-notice');
    var progress = document.getElementById('status-progress');
    lines.push('Статус движка: '
      + (notice && notice.textContent ? notice.textContent.replace(/\s+/g, ' ').slice(0, 220) : '—'));
    lines.push('Загрузка: ' + (progress ? Math.round((progress.value || 0) * 100) + '%' : '—'));

    if (errors.length) {
      lines.push('--- ошибки ---');
      for (var i = 0; i < errors.length; i += 1) lines.push(errors[i]);
    }
    return lines.join('\n');
  }

  // Замер сети: сколько грузится маленький служебный файл с того же хостинга.
  // На мобильных сетях GitHub Pages бывает медленным, и 49 МБ сборки «висят».
  var netText = 'проверяется…';
  function netState() { return netText; }

  function probeNetwork() {
    var started = Date.now();
    var url = 'index.manifest.json?probe=' + started;
    var timer = setTimeout(function () { netText = 'таймаут 10 с (хостинг не отвечает)'; }, 10000);
    fetch(url, { cache: 'no-store' }).then(function (response) {
      clearTimeout(timer);
      netText = response.ok
        ? 'ok, ' + (Date.now() - started) + ' мс'
        : 'HTTP ' + response.status + ' за ' + (Date.now() - started) + ' мс';
    }).catch(function () {
      clearTimeout(timer);
      netText = 'ошибка сети за ' + (Date.now() - started) + ' мс';
    });
  }

  function copyText(text, button) {
    function done(ok) {
      if (!button) return;
      button.textContent = ok ? 'Скопировано' : 'Не вышло';
      setTimeout(function () { button.textContent = 'Копировать'; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    // Старые WebView: копируем через скрытую textarea.
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      done(ok);
    } catch (e) {
      done(false);
    }
  }

  function show() {
    if (shown) return;
    shown = true;

    panel = document.createElement('div');
    panel.setAttribute('data-tg-diag', '1');
    panel.style.cssText = [
      'position:fixed', 'left:8px', 'right:8px', 'bottom:8px', 'z-index:2147483647',
      'max-height:70vh', 'overflow:auto', 'padding:10px 12px', 'border-radius:10px',
      'background:rgba(20,16,12,0.94)', 'color:#fff', 'font:11px/1.45 monospace',
      'white-space:pre-wrap', 'word-break:break-all', 'box-shadow:0 6px 24px rgba(0,0,0,.5)',
      'border:1px solid rgba(255,255,255,.2)', 'text-align:left',
    ].join(';');

    var body = document.createElement('div');
    body.textContent = collect();

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:10px;font:13px system-ui,sans-serif';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Копировать';
    copyBtn.style.cssText = 'flex:1;padding:8px;border-radius:8px;border:0;'
      + 'background:#e8873a;color:#241a10;font-weight:700';
    copyBtn.onclick = function () { copyText(body.textContent, copyBtn); };

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.35);'
      + 'background:transparent;color:#fff';
    closeBtn.onclick = function () {
      panel.style.display = 'none';
      shown = false;
    };

    row.appendChild(copyBtn);
    row.appendChild(closeBtn);
    panel.appendChild(body);
    panel.appendChild(row);
    document.body.appendChild(panel);
  }

  // 5 быстрых тапов в правый верхний угол открывают панель.
  var taps = 0;
  var lastTap = 0;
  window.addEventListener('pointerdown', function (event) {
    var inCorner = event.clientX > window.innerWidth - 80 && event.clientY < 80;
    if (!inCorner) { taps = 0; return; }
    var now = Date.now();
    taps = now - lastTap < 600 ? taps + 1 : 1;
    lastTap = now;
    if (taps >= 5) { taps = 0; show(); }
  }, true);

  // Само-показ: нет WebGL2 (Godot 4 не запустится) или поймана ошибка.
  function maybeAutoShow() {
    var noWebgl2 = glSupport('webgl2') !== 'да';
    if (noWebgl2) { show(); return; }
    if (errors.length && Date.now() - bootAt < 20000) { show(); return; }
    if (Date.now() - bootAt < 20000) setTimeout(maybeAutoShow, 3000);
  }

  function start() {
    probeNetwork();
    setTimeout(maybeAutoShow, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
