# 🎵 Apple Music for Linux

A lightweight Electron wrapper around [music.apple.com](https://music.apple.com) with full Widevine DRM support — no API keys, no $99 Apple Developer account, just your Apple Music subscription.

Built on [castlabs' Electron for Content Security (ECS)](https://github.com/castlabs/electron-releases), which ships a Widevine CDM that stock Electron doesn't have. Without it, Apple Music silently falls back to 30–60 second previews even when you're signed in with an active subscription.

## Features

- Full-length playback (not previews) via Widevine DRM
- Custom frameless window with a native-feeling title bar
- Persistent login session across restarts
- Background playback (keeps the audio pipeline alive when minimized or unfocused)
- Prevents system sleep while the app is open

## Requirements

- Node.js 22.12+
- An active Apple Music subscription
- Linux (tested on Arch)

## Setup & Run

```bash
npm install
npm start
```

> **First launch note:** the Widevine component sometimes fails to install on the very first run (a known upstream quirk in castlabs' Component Update Service). If you see a `Failed to install required components` warning, just restart the app — it resolves on retry, and the app now retries automatically a few times before giving up.

## Build a distributable (.AppImage)

```bash
npm run dist
```

The output will be in the `dist/` folder.

### Installing the AppImage as a desktop app

```bash
mkdir -p ~/Applications
mv dist/*.AppImage ~/Applications/AppleMusic.AppImage
chmod +x ~/Applications/AppleMusic.AppImage
```

Create `~/.local/share/applications/apple-music.desktop`:

```ini
[Desktop Entry]
Name=Apple Music
Comment=Apple Music desktop client for Linux
Exec=/home/YOUR_USER/Applications/AppleMusic.AppImage --no-sandbox --disable-gpu-sandbox --disable-namespace-sandbox --disable-setuid-sandbox --no-zygote %U
Icon=/home/YOUR_USER/Applications/apple-music-icon.png
Terminal=false
Type=Application
Categories=Audio;Music;
StartupWMClass=Apple Music
```

Then:

```bash
chmod +x ~/.local/share/applications/apple-music.desktop
update-desktop-database ~/.local/share/applications
```

The app will now appear in your application launcher (rofi, wofi, GNOME/KDE menus, etc.) and can be pinned to a dock or taskbar.

## Why the command-line flags?

Some Linux kernels/distros (Arch included, in certain configurations) crash Electron's sandboxed renderer process with:

```
FATAL:content/browser/zygote_host/zygote_host_impl_linux.cc Check failed: . : Invalid argument (22)
```

The flags above (`--no-sandbox --disable-gpu-sandbox --disable-namespace-sandbox --disable-setuid-sandbox --no-zygote`) work around this by bypassing Chromium's zygote-based sandboxing. This does **not** affect Widevine DRM, which runs in its own separate, unrelated sandbox layer.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Only ~1 minute of playback per song | Widevine CDM missing or User-Agent mismatched with the actual Chromium engine | Confirm you're on the castlabs fork (`+wvcus`) and that the UA isn't hardcoded to a newer Chrome version than the bundled engine |
| `Check failed: . : Invalid argument (22)` on launch | Zygote/sandbox incompatibility with your kernel | Use the sandbox flags documented above |
| Window opens but stays black | Renderer process failing to launch (often the same zygote issue) | Add `--no-zygote` to the launch flags |
| `Failed to install required components` | Widevine CDM download race condition on first launch, or an outdated fork version | Restart the app once or twice; if persistent, upgrade to a newer `+wvcus` release |
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on Apple's auth endpoints | Bundled Chromium too old to support Apple's TLS key exchange (e.g. post-quantum `X25519MLKEM768`) | Upgrade to the latest `castlabs/electron-releases` `+wvcus` tag |

## How it works

`main.js` waits for the Widevine CDM component to finish installing (with automatic retries) before creating the browser window, then loads `music.apple.com` directly with a corrected User-Agent string so Apple's client-side capability detection doesn't misidentify the browser engine.

## Disclaimer

This project is not affiliated with or endorsed by Apple Inc. Apple Music and the Apple Music logo are trademarks of Apple Inc. This app is simply a wrapper around Apple's own official web player.

## License

MIT