# OmniStock Desktop

Electron shell around the OmniStock APIs. Provides quick inventory search and order entry from the desktop.

## Setup

```bash
cd apps/desktop
npm install
npm start
```

> [!NOTE]
> `npm start` now downloads and launches Electron with `npx` so it works even when Windows falls back to a UNC path.
> You can set a custom version by exporting `DESKTOP_ELECTRON_VERSION` before running the command.

The app stores API connection details locally (using `electron-store`). Defaults assume the Docker Compose stack is running on `localhost`.
