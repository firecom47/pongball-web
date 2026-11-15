/* tg-bootstrap.js — сгенерирован ai-tools/telegram/pack.mjs. Не править руками. */
(function () {
  'use strict';
  var CFG = {
  "name": "pongball",
  "bot": "Firecom47_Bot",
  "scoreEndpoint": "https://functions.yandexcloud.net/d4erv95ru091rdm6d6mb?route=score",
  "resultEndpoint": "https://functions.yandexcloud.net/d4erv95ru091rdm6d6mb?route=result",
  "fullscreen": true,
  "packedAt": "2026-11-15T16:36:18.500Z"
};
  // initData берём в момент вызова, а не один раз при загрузке страницы.
  // SDK с telegram.org может приехать позже (скрипт async) или не приехать
  // вовсе: service worker Godot ставил COEP require-corp и браузер блокировал
  // этот скрипт. Сам Telegram при открытии Mini App кладёт те же данные в
  // location.hash (параметр tgWebAppData) — их хватает, чтобы отправить матч.
  function readInitData() {
    try {
      var live = window.Telegram && window.Telegram.WebApp;
      if (live && typeof live.initData === 'string' && live.initData.length > 0) {
        return live.initData;
      }
    } catch (e) {}
    try {
      var hash = String(window.location.hash || '');
      if (hash.charAt(0) === '#') hash = hash.slice(1);
      var parts = hash.split('&');
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf('=');
        if (eq <= 0) continue;
        var key = '';
        try { key = decodeURIComponent(parts[i].slice(0, eq)); } catch (e2) { continue; }
        if (key !== 'tgWebAppData') continue;
        try { return decodeURIComponent(parts[i].slice(eq + 1)); } catch (e3) { return ''; }
      }
    } catch (e4) {}
    return '';
  }

  function currentTelegram() {
    return (window.Telegram && window.Telegram.WebApp) || null;
  }

  // Единый объект для отладки и для GDScript (JavaScriptBridge.eval).
  // inTelegram — живое значение: к моменту конца матча SDK уже мог загрузиться.
  window.__tgGame = {
    get inTelegram() { return readInitData().length > 0; },
    config: CFG,
    calls: [],          // что уже вызвали — удобно смотреть в консоли
    haptic: haptic,
    notify: notify,
    submitScore: submitScore,
    reportResult: reportResult,
    close: function () { try { var t = currentTelegram(); t && t.close(); } catch (e) {} },
    expand: function () { try { var t = currentTelegram(); t && t.expand(); } catch (e) {} }
  };

  function record(name, arg) {
    window.__tgGame.calls.push(arg === undefined ? name : name + ':' + arg);
  }

  function haptic(style) {
    record('haptic', style);
    try {
      var tg = currentTelegram();
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style || 'medium');
    } catch (e) { /* нет поддержки — молча */ }
  }

  function notify(type) {
    record('notify', type);
    try {
      var tg = currentTelegram();
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(type || 'success');
    } catch (e) {}
  }

  function submitScore(score) {
    var initData = readInitData();
    if (!CFG.scoreEndpoint) { record('score:no-endpoint'); return Promise.resolve(null); }
    if (!initData) { record('score:outside-telegram'); return Promise.resolve(null); }
    record('score', score);
    return fetch(CFG.scoreEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData, score: Number(score) })
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      // Ответ функции ({user_id, best, rank, total}) нужен игре: по нему она
      // подсвечивает свою строку в таблице рекордов и пишет «Ваше место».
      if (data) window.__tgGame.lastResult = data;
      return data;
    }).catch(function () { return null; });
  }

  /**
   * Один завершённый матч → аналитика (?route=result). Мост для GDScript:
   * JavaScriptBridge.eval("tgReportResult({...})").
   * Вне Telegram и без настроенного эндпоинта молча ничего не делает.
   */
  function reportResult(payload) {
    // Состояние отправки читает игра (match.gd → _tick_report_status): без него
    // из Telegram не видно, дошла ли статистика — ошибки fetch молча глотаются.
    var initData = readInitData();
    const state = {
      status: 0,
      ok: false,
      error: '',
      init_data_len: initData.length,
      at: new Date().toISOString(),
    };
    window.__tgGame.lastReport = state;

    if (!CFG.resultEndpoint) { state.error = 'no-endpoint'; record('result:no-endpoint'); return Promise.resolve(null); }
    if (!initData) { state.error = 'outside-telegram'; record('result:outside-telegram'); return Promise.resolve(null); }
    record('result', payload && payload.result ? payload.result : 'unknown');
    state.error = 'sending';
    var body = Object.assign({}, payload || {}, { initData: initData });
    return fetch(CFG.resultEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      state.status = r.status;
      state.ok = r.ok;
      state.error = r.ok ? '' : 'http-' + r.status;
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (data) { state.error = ''; state.server = data; }
      return data;
    }).catch(function () {
      state.error = 'network';
      return null;
    });
  }

  // Мост для GDScript: JavaScriptBridge.eval("tgHaptic('medium')")
  window.tgHaptic = haptic;
  window.tgNotify = notify;
  window.tgSubmitScore = submitScore;
  window.tgReportResult = reportResult;

  // SDK подключён с async: к этому моменту его может ещё не быть, а на части
  // телефонов telegram.org вообще не открывается. Повторяем привязку, пока
  // объект WebApp не появится. Отправка матча от SDK не зависит — ей хватает hash.
  function bindTelegram() {
    var tg = currentTelegram();
    if (!tg || tg.__pongballBound) return !!tg;
    tg.__pongballBound = true;
    record('ready');
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
    try { if (tg.requestFullscreen) { tg.requestFullscreen(); record('requestFullscreen'); } } catch (e) {}
    try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
    try { if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
    return true;
  }

  if (!readInitData()) {
    console.log('[tg] вне Telegram — Mini App API не активен');
  }

  // Safe area: Telegram сообщает отступы под свои панели. Отдаём их в CSS-переменные,
  // чтобы при необходимости поджать интерфейс (по умолчанию canvas на весь экран).
  function applyInsets() {
    var tg = currentTelegram();
    var s = (tg && tg.safeAreaInset) || {};
    var root = document.documentElement;
    root.style.setProperty('--tg-safe-top', (s.top || 0) + 'px');
    root.style.setProperty('--tg-safe-bottom', (s.bottom || 0) + 'px');
    root.style.setProperty('--tg-safe-left', (s.left || 0) + 'px');
    root.style.setProperty('--tg-safe-right', (s.right || 0) + 'px');
    if (tg) root.classList.add('tg-active');
  }

  // Пауза при сворачивании. Telegram присылает deactivated/activated, когда
  // приложение уходит на фон или возвращается. Движок Godot слушает window "blur"
  // и посылает игре NOTIFICATION_WM_WINDOW_FOCUS_OUT — Pongball на нём ставит паузу
  // (scripts/game/match.gd). Поэтому достаточно «подтолкнуть» события окна.
  function pokeWindow(type) {
    try { window.dispatchEvent(new Event(type)); } catch (e) {}
    try {
      var c = document.querySelector('canvas');
      if (c) c.dispatchEvent(new Event(type));
    } catch (e) {}
  }

  function bindTelegramEvents() {
    var tg = currentTelegram();
    if (!tg || tg.__pongballEvents) return;
    tg.__pongballEvents = true;
    applyInsets();
    try { tg.onEvent && tg.onEvent('safeAreaChanged', applyInsets); } catch (e) {}
    try {
      tg.onEvent && tg.onEvent('deactivated', function () {
        record('deactivated');
        pokeWindow('blur');
      });
      tg.onEvent && tg.onEvent('activated', function () {
        record('activated');
        pokeWindow('focus');
      });
    } catch (e) {}
    try {
      tg.onEvent && tg.onEvent('viewportChanged', function () {
        window.dispatchEvent(new Event('resize'));
      });
    } catch (e) {}
    console.log('[tg] Mini App активен, платформа: ' + (tg.platform || 'unknown'));
  }

  function tryBind() {
    if (!bindTelegram()) return false;
    bindTelegramEvents();
    return true;
  }

  if (!tryBind()) {
    var bindTries = 0;
    var bindTimer = setInterval(function () {
      bindTries += 1;
      if (tryBind() || bindTries > 50) clearInterval(bindTimer);
    }, 100);
  }
})();
