const button = document.getElementById('install-app');
const state = document.getElementById('install-state'); let invitation;
if (!isSecureContext) state.textContent = '安装需要浏览器信任的 HTTPS。普通局域网 HTTP 不支持安装，请勿绕过证书警告。';
else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
    .catch(() => { state.textContent = '此浏览器暂不能启用离线提示；在线传输不受影响。'; });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); invitation = event; button.hidden = false;
});
button.onclick = async () => {
  if (!invitation) return; const event = invitation; invitation = null; button.hidden = true;
  try { await event.prompt(); const choice = await event.userChoice; state.textContent = choice.outcome === 'accepted' ? '已接受安装请求。传输时仍需连接原局域网并保持应用在前台。' : '已取消安装，可继续使用浏览器传输。'; }
  catch { state.textContent = '未能打开安装提示，可使用浏览器菜单中的安装或添加到主屏幕。'; }
};
window.addEventListener('appinstalled', () => { invitation = null; button.hidden = true; state.textContent = '已安装。关闭或切到后台可能中断上传，重新选择原文件可续传。'; });
