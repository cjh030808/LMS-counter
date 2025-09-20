// content.js - Chrome MV3 content script (no jQuery)
// Injects injected.js into page context, listens for JW Player time events
// and manipulates DOM for bookmark UI using vanilla JS.

(function() {
    'use strict';
  
    // small helper to inject a page-scoped script (so it can access window.jwplayer)
    function injectScript(file) {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL(file);
      s.onload = function() { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
    }
  
    // send control commands to injected script (page context)
    function sendCommand(action, payload) {
      window.postMessage({ type: 'EXTENSION_COMMAND', action: action, payload: payload }, '*');
    }
  
    // receive time updates from injected script
    const seek_position = { current: 0 };
    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data) return;
      if (data.type === 'JW_TIME') {
        seek_position.current = data.position;
      }
    });
  
    // inject page script that can call jwplayer()
    injectScript('injected.js');
  
    // small helper to wait for a DOM element
    function waitFor(selector, cb, timeout = 5000) {
      const start = Date.now();
      (function check() {
        const el = document.querySelector(selector);
        if (el) return cb(el);
        if (Date.now() - start > timeout) return; // give up silently
        requestAnimationFrame(check);
      })();
    }
  
    // get lecture id from url
    const url = new URL(window.location.href);
    const lecId = url.searchParams.get("id") || 'unknown';
  
    // helper: safe parse localStorage 'bookmark'
    function loadBookmarks() {
      try {
        const raw = localStorage.getItem('bookmark');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }
    function saveBookmarks(bm) {
      try {
        localStorage.setItem('bookmark', JSON.stringify(bm));
      } catch(e){ console.error(e); }
    }
  
    // helper to create bookmark DOM element
    function createMarkElement(time, memo, idx) {
      const wrap = document.createElement('div');
      wrap.className = 'mark';
  
      const removeBtn = document.createElement('button');
      removeBtn.className = 'bookmark_remove';
      removeBtn.type = 'button';
      removeBtn.onclick = function() { bookmarkRemoveClick(idx); };
      const img = document.createElement('img');
      img.src = '/mod/vod/pix/layer/viewer-close.png';
      removeBtn.appendChild(img);
      wrap.appendChild(removeBtn);
      wrap.appendChild(document.createElement('br'));
  
      const entry = document.createElement('div');
      entry.setAttribute('data-time', time);
      entry.style.cursor = 'pointer';
      entry.onclick = function() { onTimeLineClick(time); };
  
      const memoSpan = document.createElement('span');
      memoSpan.className = 'memo';
      memoSpan.textContent = memo;
      const br = document.createElement('br');
      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      const h = parseInt(time/3600);
      const m = String(parseInt(time/60%60)).padStart(2, '0');
      const s = String(parseInt(time%60)).padStart(2, '0');
      timeSpan.textContent = `${h} : ${m} : ${s}`;
  
      entry.appendChild(memoSpan);
      entry.appendChild(br);
      entry.appendChild(timeSpan);
      wrap.appendChild(entry);
  
      return wrap;
    }
  
    // UI functions (no jQuery)
    function tabCloseClick(){
      document.querySelectorAll('.bookmark').forEach(e => e.style.display = 'none');
    }
  
    function tabOpenClick(){
      document.querySelectorAll('.bookmark').forEach(e => e.style.display = 'block');
    }
  
    function bookmarkRemoveClick(idx){
      const marks = document.querySelectorAll('.bookmark .mark');
      if (marks[idx]) marks[idx].style.display = 'none';
  
      const currentBookmark = loadBookmarks();
      if (currentBookmark[lecId]) {
        currentBookmark[lecId].splice(idx, 1);
        saveBookmarks(currentBookmark);
        // re-render to fix indices
        renderBookmarks();
      }
    }
  
    function bookmarkClick(){
      const currentBookmark = loadBookmarks();
  
      const videoTag = document.querySelector('video');
      if (videoTag) videoTag.pause();
      const memo = prompt("Bookmark를 알아보기 위한 메모를 적어두세요!", "memo");
      if (videoTag) videoTag.play();
  
      if(memo === "") {
        alert("memo는 꼭 적으셔야 합니다!");
        return;
      } else if(memo !=  null){
        const currentTime = (document.querySelector('video') ? document.querySelector('video').currentTime : seek_position.current) || 0;
        if (!currentBookmark[lecId]) currentBookmark[lecId] = [];
        currentBookmark[lecId].push({"time" : currentTime, "memo" : memo});
        saveBookmarks(currentBookmark);
        renderBookmarks();
      }
    }
  
    function onTimeLineClick(time){
      const videoTag = document.querySelector('video');
      if (videoTag) {
        videoTag.currentTime = time;
      } else {
        sendCommand('seek', { time });
      }
    }
  
    function videoSpeedClick(){
      const input = document.getElementById('playbackRate');
      if (!input) return;
      const rate = parseFloat(input.value) || 1;
      const v = document.querySelector('video');
      if (v) v.playbackRate = rate;
      sendCommand('setPlaybackRate', { rate });
    }
  
    // render bookmark list in .bookmark container
    function renderBookmarks(){
      const container = document.querySelector('#vod_viewer .bookmark') || document.querySelector('.bookmark');
      if (!container) return;
  
      container.querySelectorAll('.mark').forEach(n => n.remove());
  
      const currentBookmark = loadBookmarks();
      if(!currentBookmark || !currentBookmark[lecId]) return;
      currentBookmark[lecId].forEach((obj, idx) => {
        const markEl = createMarkElement(obj.time, obj.memo, idx);
        container.appendChild(markEl);
      });
    }
  
    // initialize UI once vod_header / vod_viewer / vod_footer are present
    function initUI() {
      const vodHelp = document.querySelector('#vod_header .vod_help');
      if (vodHelp) vodHelp.style.display = 'none';
  
      const closeBtn = document.querySelector('#vod_header .vod_close');
      if (closeBtn) {
        const triangle = document.createElement('div');
        triangle.className = 'triangle';
        triangle.onclick = tabOpenClick;
        if (closeBtn.parentNode) {
          if (closeBtn.nextSibling) closeBtn.parentNode.insertBefore(triangle, closeBtn.nextSibling);
          else closeBtn.parentNode.appendChild(triangle);
        }
      }
  
      const vodViewer = document.querySelector('#vod_viewer');
      if (vodViewer && !vodViewer.querySelector('.bookmark')) {
        const bm = document.createElement('div');
        bm.className = 'bookmark';
        const close = document.createElement('button');
        close.className = 'bookmark_close';
        close.onclick = tabCloseClick;
        const img = document.createElement('img');
        img.src = '/mod/vod/pix/layer/viewer-close.png';
        close.appendChild(img);
        bm.appendChild(close);
        const inner = document.createElement('div');
        bm.appendChild(inner);
        vodViewer.appendChild(bm);
      }
  
      let currentBookmark = loadBookmarks();
      if(currentBookmark == null) currentBookmark = {};
      if(!currentBookmark[lecId]) currentBookmark[lecId] = [];
      saveBookmarks(currentBookmark);
  
      renderBookmarks();
  
      const vodFooter = document.querySelector('#vod_footer');
      if (vodFooter && !document.querySelector('.playBack-container')) {
        const container = document.createElement('div');
        container.className = 'playBack-container';
  
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Bookmark';
        b.onclick = bookmarkClick;
        container.appendChild(b);
  
        const span = document.createElement('span');
        span.textContent = '재생 속도 : ';
        container.appendChild(span);
  
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'playbackRate';
        input.value = '1';
        container.appendChild(input);
  
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.textContent = 'Apply';
        apply.onclick = videoSpeedClick;
        container.appendChild(apply);
  
        vodFooter.appendChild(container);
      }
    }
  
    // try to init UI (wait up to 7s for #vod_viewer)
    waitFor('#vod_viewer', initUI, 7000);
  
    // debug helpers
    window.__extensionSeekPosition = seek_position;
    window.__extensionSendCommand = sendCommand;
  
  })();
  