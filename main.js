const { app, BrowserWindow, ipcMain, shell, Menu, powerSaveBlocker, components } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      partition: 'persist:applemusic',
      webSecurity: true,
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  powerSaveBlocker.start('prevent-app-suspension');

  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );
  mainWindow.loadURL('https://beta.music.apple.com');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      !url.startsWith('https://music.apple.com') &&
      !url.startsWith('https://beta.music.apple.com') &&
      !url.startsWith('https://idmsa.apple.com') &&
      !url.startsWith('https://appleid.apple.com')
    ) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function keepAlive() {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
        } catch(e) {}
      })();

      const bar = document.createElement('div');
      bar.id = '__titlebar__';
      bar.style.cssText = \`
        position: fixed;
        top: 0; left: 0; right: 0;
        height: 36px;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(20px);
        -webkit-app-region: drag;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        z-index: 999999;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      \`;
      bar.innerHTML = \`
        <div style="display:flex;align-items:center;gap:8px;-webkit-app-region:no-drag;">
          <button onclick="window.__wc('close')"  style="width:13px;height:13px;border-radius:50%;background:#ff5f57;border:none;cursor:pointer;"></button>
          <button onclick="window.__wc('min')"    style="width:13px;height:13px;border-radius:50%;background:#febc2e;border:none;cursor:pointer;"></button>
          <button onclick="window.__wc('max')"    style="width:13px;height:13px;border-radius:50%;background:#28c840;border:none;cursor:pointer;"></button>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);font-family:sans-serif;letter-spacing:0.3px;">Apple Music</div>
        <div style="width:60px;"></div>
      \`;
      document.body.prepend(bar);
      document.body.style.paddingTop = '36px';
    `);
  });
}

// ─── Wait for Widevine CDM to be ready before creating the window ───
app.whenReady().then(async () => {
  try {
    await components.whenReady();
    console.log('✅ Widevine CDM ready:', components.status());
  } catch (err) {
    console.error('⚠️  Widevine CDM init warning:', err.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

ipcMain.on('wc', (_, action) => {
  if (!mainWindow) return;
  if (action === 'close') mainWindow.close();
  if (action === 'min') mainWindow.minimize();
  if (action === 'max') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
