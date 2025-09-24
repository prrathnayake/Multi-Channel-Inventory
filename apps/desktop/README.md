# OmniStock Desktop

Electron shell around the OmniStock APIs. Provides quick inventory search and order entry from the desktop.

## Setup

```bash
cd apps/desktop
npm install
npm start
```

The app stores API connection details locally (using `electron-store`). Defaults assume the Docker Compose stack is running on `localhost`.
