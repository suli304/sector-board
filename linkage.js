/* ============================================================
 * 板块信号看板 v2.0 — 跨 Tab 联动层（C9）
 * 方案 12.4：排行/表格点击 → 主图切标的；全局状态跨 Tab 共享
 *
 * 消息协议（window.postMessage）：
 *   board-nav:   {type:'board-nav', code, level, tab?}
 *                请求主图切换标的；tab 可选（骨架据此切 Tab，兼容 C8 旧格式）
 *   board-state: {type:'board-state', state:{code,level,period,caliber,from}}
 *                全局状态广播（周期/口径/当前标的）
 *
 * API（window.BoardLink）：
 *   emitNav(code, level, opts)  发导航消息（iframe 内发给父窗口，独立打开发自身）
 *   onNav(handler)              注册导航处理器（主图 switchTo / 骨架切 Tab）
 *   getState() / setState(part) 全局状态读写；setState 自动广播 board-state
 *   broadcastState()            手动广播当前状态
 *   onState(handler)            注册状态处理器
 *   init()                      挂载 message 监听（构造时自动调用）
 *
 * 接入：
 *   Tab2/4/5/6 点击行/选中标的 → BoardLink.emitNav(code, level, {tab:'tab-main'})
 *   Tab1 主图                → BoardLink.onNav(切标的)；周期/口径变化 BoardLink.setState(...)
 *   骨架                    → BoardLink.onNav(切 Tab，兼容 C8 board-nav)
 * ============================================================ */
(function (global) {
  'use strict';

  var state = { code: null, level: 'sector', period: 'daily', caliber: 'main', from: null };
  var navHandlers = [];
  var stateHandlers = [];

  /** 消息目标：iframe 内嵌时发给父窗口；独立打开时发自身（无副作用不报错） */
  function targetWin() {
    try {
      return (global.parent !== global && global.parent.postMessage) ? global.parent : global;
    } catch (e) { return global; }
  }

  function post(payload) {
    try { targetWin().postMessage(payload, '*'); } catch (e) { /* 独立打开时无父窗口，静默 */ }
  }

  /** 发送导航消息：code 必填，level 默认 sector，opts.tab 可指定骨架切换目标 Tab */
  function emitNav(code, level, opts) {
    if (code === null || code === undefined || code === '') return null;
    var payload = { type: 'board-nav', code: String(code), level: level || 'sector' };
    if (opts && opts.tab) payload.tab = opts.tab;
    post(payload);
    dispatch(payload);
    return payload;
  }

  function getState() { return state; }

  /** 合并更新全局状态并广播（period/caliber/code/level/from） */
  function setState(part) {
    var k;
    for (k in part) {
      if (Object.prototype.hasOwnProperty.call(part, k)) state[k] = part[k];
    }
    broadcastState();
    return state;
  }

  function broadcastState() {
    var payload = {
      type: 'board-state',
      state: { code: state.code, level: state.level, period: state.period, caliber: state.caliber, from: state.from }
    };
    post(payload);
    stateHandlers.forEach(function (h) { try { h(state); } catch (e) { } });
    return payload;
  }

  function onNav(handler) { if (typeof handler === 'function') navHandlers.push(handler); }
  function onState(handler) { if (typeof handler === 'function') stateHandlers.push(handler); }

  /** 派发本地处理器；兼容 C8 旧格式 {type:'board-nav', tab, code}（无 level 时默认 sector） */
  function dispatch(msg) {
    if (!msg || typeof msg !== 'object' || !msg.type) return false;
    if (msg.type === 'board-nav') {
      var nav = { code: msg.code, level: msg.level || 'sector', tab: msg.tab || null };
      navHandlers.forEach(function (h) { try { h(nav); } catch (e) { } });
      return true;
    }
    if (msg.type === 'board-state' && msg.state) {
      stateHandlers.forEach(function (h) { try { h(msg.state); } catch (e) { } });
      return true;
    }
    return false;
  }

  function onMessage(ev) {
    dispatch(ev && ev.data);
  }

  function init() {
    global.addEventListener('message', onMessage, false);
  }

  var api = {
    emitNav: emitNav,
    getState: getState,
    setState: setState,
    broadcastState: broadcastState,
    onNav: onNav,
    onState: onState,
    dispatch: dispatch,
    init: init
  };
  global.BoardLink = api;
  init();
  return api;
})(window);
