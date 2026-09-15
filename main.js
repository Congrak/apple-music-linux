const { app, BrowserWindow, shell, powerSaveBlocker, components, screen, nativeTheme } = require('electron');
const path = require('path');

nativeTheme.themeSource = 'dark';

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-namespace-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

let mainWindow;

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: screenW,
    height: screenH,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      partition: 'persist:applemusic',
      webSecurity: true,
      preferredColorScheme: 'dark',
    },
    icon: path.join(__dirname, 'apple-music-for-linux.png'),
  });

  mainWindow.maximize();

  powerSaveBlocker.start('prevent-app-suspension');

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'keyDown') {
      if (input.key === '=' || input.key === '+') {
        mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1);
      } else if (input.key === '-') {
        mainWindow.webContents.setZoomFactor(Math.max(0.5, mainWindow.webContents.getZoomFactor() - 0.1));
      } else if (input.key === '0') {
        mainWindow.webContents.setZoomFactor(1.0);
      }
    }
  });

  const realUA = mainWindow.webContents.getUserAgent();
  const cleanUA = realUA.replace(/\s*Electron\/\S+/i, '').replace(/\s{2,}/g, ' ').trim();
  mainWindow.webContents.setUserAgent(cleanUA);

  mainWindow.loadURL('https://music.apple.com');

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
        <div style="width:60px;"></div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);font-family:sans-serif;letter-spacing:0.3px;">Apple Music</div>
        <div style="width:60px;"></div>
      \`;
      document.body.prepend(bar);
      document.body.style.paddingTop = '36px';
    `);
  });
}

async function ensureWidevine(maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await components.whenReady();
      const status = components.status();
      if (status && status.widevine && status.widevine.version) {
        console.log(`✅ Widevine CDM listo (intento ${attempt}):`, status.widevine.version);
        return true;
      }
      console.warn(`⚠️  Intento ${attempt}/${maxAttempts}: Widevine no reporta versión instalada todavía.`);
    } catch (err) {
      console.warn(`⚠️  Intento ${attempt}/${maxAttempts} falló:`, err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  console.error('❌ No se pudo instalar Widevine tras varios intentos.');
  return false;
}

app.whenReady().then(async () => {
  await ensureWidevine();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

