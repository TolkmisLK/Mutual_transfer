const $ = id => document.getElementById(id);
let paused = false; let uploading = false;
const say = text => { $('status').textContent = text; };
const size = n => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`;
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { $('join').hidden = false; $('workspace').hidden = true; }
    throw new Error(result.error || `请求失败 (${response.status})`);
  }
  return result;
}
const post = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
function button(text, action) {
  const b = document.createElement('button'); b.className = 'secondary'; b.textContent = text;
  b.onclick = async () => { b.disabled = true; try { await action(); } catch (e) { say(e.message); } finally { b.disabled = false; } }; return b;
}
async function preview(file, text = false) {
  $('preview-title').textContent = file.name; $('preview-body').replaceChildren(); $('preview').showModal();
  if (text) {
    const value = await api(`/api/transfers/${file.id}/text`); const pre = document.createElement('pre');
    pre.textContent = value.text + (value.truncated ? '\n\n[仅展示前 64 KB]' : ''); $('preview-body').append(pre); return;
  }
  const video = /\.(mp4|webm|mov)$/i.test(file.name); const el = document.createElement(video ? 'video' : 'img');
  if (video) { el.controls = true; el.preload = 'metadata'; } else { el.alt = file.name; }
  el.src = `/api/transfers/${file.id}/preview`;
  el.onerror = () => { $('preview-body').textContent = '此文件无法在浏览器内预览，请下载后打开。'; };
  $('preview-body').append(el);
}
async function refresh() {
  const { files } = await api('/api/transfers'); $('join').hidden = true; $('workspace').hidden = false;
  $('list').replaceChildren();
  if (!files.length) { const empty = document.createElement('p'); empty.textContent = '还没有文件。上传后，另一台设备刷新即可看到。'; $('list').append(empty); }
  for (const file of files.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const row = document.createElement('article'); row.className = 'file'; const info = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = file.name;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${size(file.size)} · ${file.complete ? '已完成' : `待续传 ${size(file.offset)}`}`;
    info.append(title, meta);
    if (file.sha256) { const hash = document.createElement('div'); hash.className = 'hash'; hash.textContent = `SHA-256 ${file.sha256}`; info.append(hash); }
    const actions = document.createElement('div'); actions.className = 'actions';
    if (file.complete) {
      const a = document.createElement('a'); a.className = 'download'; a.href = `/api/transfers/${file.id}/download`; a.textContent = '下载'; actions.append(a);
      if (/\.(png|jpe?g|gif|webp|mp4|webm|mov)$/i.test(file.name)) actions.append(button('预览', () => preview(file)));
      else if (/\.(txt|md|csv|json|log|xml|ya?ml)$/i.test(file.name)) actions.append(button('预览文本', () => preview(file, true)));
    }
    actions.append(button('删除', async () => { if (confirm(`删除「${file.name}」？其他设备也将无法下载。`)) { await api(`/api/transfers/${file.id}`, { method: 'DELETE' }); await refresh(); } }));
    row.append(info, actions); $('list').append(row);
  }
}
$('login').onsubmit = async e => {
  e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true;
  try { await api('/api/session', post({ key: $('key').value })); $('key').value = ''; await refresh(); say('已加入文件空间。'); }
  catch (error) { say(error.message); } finally { b.disabled = false; }
};
$('refresh').onclick = () => refresh().catch(e => say(e.message));
$('logout').onclick = async () => {
  if (uploading) { say('请先暂停传输，再退出。'); return; }
  try { await api('/api/session', { method: 'DELETE' }); $('workspace').hidden = true; $('join').hidden = false; $('list').replaceChildren(); say('已退出。'); } catch (e) { say(e.message); }
};
$('close').onclick = () => $('preview').close();
$('preview').addEventListener('close', () => $('preview-body').replaceChildren());
$('pause').onclick = () => { paused = true; say('当前文件块完成后暂停。'); };
$('files').onchange = async e => {
  if (uploading) return; uploading = true; paused = false; $('files').disabled = true; $('pause').hidden = false; $('progress').hidden = false;
  try {
    for (const file of e.target.files) {
      const localKey = `mutual-transfer:${file.name}:${file.size}:${file.lastModified}`;
      let item; const cached = localStorage.getItem(localKey);
      if (cached) {
        try { item = await api(`/api/transfers/${cached}`); } catch (error) { if ($('workspace').hidden) throw error; }
        if (item && !item.complete && !confirm(`续传「${file.name}」？请确认选择的是原始文件，且内容没有修改。`)) item = null;
        if (item?.complete) item = null;
      }
      if (!item) { item = await api('/api/transfers', post({ name: file.name, size: file.size })); localStorage.setItem(localKey, item.id); }
      while (item.offset < file.size && !paused) {
        item = await api(`/api/transfers/${item.id}/chunk`, { method: 'PUT', headers: { 'Upload-Offset': String(item.offset), 'Content-Type': 'application/octet-stream' }, body: file.slice(item.offset, item.offset + 4 * 1024 * 1024) });
        $('progress').value = file.size ? item.offset / file.size * 100 : 100;
        $('progress-label').textContent = `${file.name} · ${size(item.offset)} / ${size(file.size)}`;
      }
      if (paused) break;
      say('正在计算文件校验值，请稍候。'); await api(`/api/transfers/${item.id}/finish`, { method: 'POST' }); localStorage.removeItem(localKey); say(`${file.name} 已上传。`);
    }
    await refresh(); if (paused) say('已暂停。重新选择原文件可继续。');
  } catch (error) { say(`传输已停止：${error.message}。重新选择原文件可续传。`); }
  finally { uploading = false; $('files').disabled = false; $('files').value = ''; $('pause').hidden = true; }
};
window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
refresh().catch(() => { $('join').hidden = false; });
