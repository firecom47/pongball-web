/* tg-bootstrap.js — сгенерирован ai-tools/telegram/pack.mjs. Не править руками. */
(function () {
  'use strict';
  var CFG = {
  "name": "pongball",
  "bot": null,
  "scoreEndpoint": null,
  "fullscreen": true,
  "packedAt": "2026-11-13T14:59:43.392Z"
};
  var tg = (window.Telegram && window.Telegram.WebApp) || null;
  // Вне Telegram настоящий SDK тоже отдаёт объект WebApp, но с пустым initData —
  // поэтому проверяем именно непустой initData, а не само наличие объекта.
  var inTelegram = !!(tg && typeof tg.initData === 'string' && tg.initData.length > 0);

  // Единый объект для отладки и для GDScript (JavaScriptBridge.eval).
  window.__tgGame = {
    inTelegram: inTelegram,
    config: CFG,
    calls: [],          // что уже вызвали — удобно смотреть в консоли
    haptic: haptic,
    notify: notify,
    submitScore: submitScore,
    close: function () { try { tg && tg.close(); } catch (e) {} },
    expand: function () { try { tg && tg.expand(); } catch (e) {} }
  };

  function record(name, arg) {
    window.__tgGame.calls.push(arg === undefined ? name : name + ':' + arg);
  }

  function haptic(style) {
    record('haptic', style);
    try {
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style || 'medium');
    } catch (e) { /* нет поддержки — молча */ }
  }

  function notify(type) {
    record('notify', type);
    try {
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(type || 'success');
    } catch (e) {}
  }

  function submitScore(score) {
    if (!CFG.scoreEndpoint) { record('score:no-endpoint'); return Promise.resolve(null); }
    if (!inTelegram) { record('score:outside-telegram'); return Promise.resolve(null); }
    record('score', score);
    return fetch(CFG.scoreEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, score: Number(score) })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // Мост для GDScript: JavaScriptBridge.eval("tgHaptic('medium')")
  window.tgHaptic = haptic;
  window.tgNotify = notify;
  window.tgSubmitScore = submitScore;

  if (!inTelegram) {
    // Обычный браузер / локальная проверка: ничего не ломаем, просто живём дальше.
    console.log('[tg] вне Telegram — Mini App API не активен');
    return;
  }

  record('ready');
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}
  try { if (tg.requestFullscreen) { tg.requestFullscreen(); record('requestFullscreen'); } } catch (e) {}
  try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
  try { if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color'); } catch (e) {}

  // Safe area: Telegram сообщает отступы под свои панели. Отдаём их в CSS-переменные,
  // чтобы при необходимости поджать интерфейс (по умолчанию canvas на весь экран).
  function applyInsets() {
    var s = (tg && tg.safeAreaInset) || {};
    var root = document.documentElement;
    root.style.setProperty('--tg-safe-top', (s.top || 0) + 'px');
    root.style.setProperty('--tg-safe-bottom', (s.bottom || 0) + 'px');
    root.style.setProperty('--tg-safe-left', (s.left || 0) + 'px');
    root.style.setProperty('--tg-safe-right', (s.right || 0) + 'px');
    root.classList.add('tg-active');
  }
  applyInsets();
  try { tg.onEvent && tg.onEvent('safeAreaChanged', applyInsets); } catch (e) {}

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

  // Telegram может менять размер вьюпорта (fullscreen/сворачивание) — сообщаем движку.
  try {
    tg.onEvent && tg.onEvent('viewportChanged', function () {
      window.dispatchEvent(new Event('resize'));
    });
  } catch (e) {}

  console.log('[tg] Mini App активен, платформа: ' + (tg.platform || 'unknown'));
})();
