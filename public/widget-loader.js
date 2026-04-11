;(function () {
  'use strict'

  var script = document.currentScript
  var botId = script && script.getAttribute('data-bot-id')
  if (!botId) {
    console.warn('[BotBase] Missing data-bot-id on widget script tag.')
    return
  }

  var BASE_URL = (script && script.getAttribute('data-base-url')) || 'https://app.botbase.ai'
  var SESSION_KEY = 'bb_session_' + botId
  var config = null
  var iframeEl = null
  var overlayEl = null
  var bubbleEl = null
  var isOpen = false

  // ─── Session ID ────────────────────────────────────────────────────────────
  function getSessionId() {
    try {
      var stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) return stored
      var newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2)
      sessionStorage.setItem(SESSION_KEY, newId)
      return newId
    } catch (e) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2)
    }
  }

  // ─── Fetch config ──────────────────────────────────────────────────────────
  function fetchConfig(cb) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', BASE_URL + '/api/widget/' + botId + '/config')
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          cb(JSON.parse(xhr.responseText))
        } catch (e) {
          console.error('[BotBase] Failed to parse config:', e)
        }
      } else {
        console.error('[BotBase] Config fetch failed:', xhr.status)
      }
    }
    xhr.onerror = function () {
      console.error('[BotBase] Config fetch error')
    }
    xhr.send()
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  function injectStyles(primaryColor, position, bubbleStyle) {
    var isLeft = position === 'bottom-left'
    var radius = bubbleStyle === 'square' ? '12px' : '50%'
    var style = document.createElement('style')
    style.textContent = [
      '.bb-bubble{position:fixed;bottom:24px;' + (isLeft ? 'left' : 'right') + ':24px;',
      'width:56px;height:56px;border-radius:' + radius + ';',
      'background:' + primaryColor + ';border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 4px 24px ' + primaryColor + '66;',
      'z-index:2147483646;transition:transform 0.2s,box-shadow 0.2s;}',
      '.bb-bubble:hover{transform:scale(1.08);box-shadow:0 6px 32px ' + primaryColor + '88;}',
      '.bb-overlay{position:fixed;bottom:96px;' + (isLeft ? 'left' : 'right') + ':24px;',
      'width:400px;height:600px;border-radius:16px;',
      'box-shadow:0 8px 48px rgba(0,0,0,0.6);z-index:2147483647;',
      'overflow:hidden;display:none;flex-direction:column;}',
      '.bb-overlay.bb-open{display:flex;}',
      '.bb-iframe{width:100%;flex:1;border:none;display:block;}',
      '.bb-close{position:absolute;top:12px;right:12px;',
      'width:28px;height:28px;border-radius:50%;',
      'background:rgba(0,0,0,0.5);border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'color:#fff;font-size:16px;line-height:1;z-index:1;}',
      '@media(max-width:480px){',
      '.bb-overlay{bottom:0;' + (isLeft ? 'left' : 'right') + ':0;',
      'width:100vw;height:100dvh;border-radius:0;}}',
    ].join('')
    document.head.appendChild(style)
  }

  // ─── Build bubble SVG ──────────────────────────────────────────────────────
  function chatSvg() {
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"' +
      ' stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }

  function closeSvg() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M1 1L13 13M13 1L1 13" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'
  }

  // ─── Toggle ────────────────────────────────────────────────────────────────
  function openChat() {
    if (!overlayEl) return
    isOpen = true
    overlayEl.classList.add('bb-open')
    bubbleEl.innerHTML = closeSvg()
  }

  function closeChat() {
    if (!overlayEl) return
    isOpen = false
    overlayEl.classList.remove('bb-open')
    bubbleEl.innerHTML = chatSvg()
  }

  function toggleChat() {
    if (isOpen) closeChat()
    else openChat()
  }

  // ─── Build DOM ─────────────────────────────────────────────────────────────
  function buildWidget(cfg) {
    config = cfg
    injectStyles(cfg.primaryColor, cfg.position, cfg.bubbleStyle)

    // Overlay + iframe
    overlayEl = document.createElement('div')
    overlayEl.className = 'bb-overlay'

    var closeBtn = document.createElement('button')
    closeBtn.className = 'bb-close'
    closeBtn.setAttribute('aria-label', 'Close chat')
    closeBtn.innerHTML = closeSvg()
    closeBtn.addEventListener('click', closeChat)

    iframeEl = document.createElement('iframe')
    iframeEl.className = 'bb-iframe'
    iframeEl.src = BASE_URL + '/chat/' + botId + '?widget=true'
    iframeEl.title = cfg.botName + ' Chat'
    iframeEl.setAttribute('allow', 'clipboard-write')

    overlayEl.appendChild(closeBtn)
    overlayEl.appendChild(iframeEl)

    // Bubble
    bubbleEl = document.createElement('button')
    bubbleEl.className = 'bb-bubble'
    bubbleEl.setAttribute('aria-label', 'Open ' + cfg.botName + ' chat')
    bubbleEl.innerHTML = chatSvg()
    bubbleEl.addEventListener('click', toggleChat)

    document.body.appendChild(overlayEl)
    document.body.appendChild(bubbleEl)
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    fetchConfig(buildWidget)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
