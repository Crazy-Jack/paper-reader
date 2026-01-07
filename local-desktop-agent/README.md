# Local Desktop Agent

An Electron-powered desktop application for paper reading and management.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the app:
```bash
npm start
```

3. Run in development mode (with DevTools):
```bash
npm run dev
```

## Project Structure

```
local-desktop-agent/
├── main.js           # Electron main process
├── preload.js        # Preload script (security bridge)
├── index.html        # Main renderer HTML
├── renderer.js       # Renderer process script
├── styles/
│   └── main.css      # Application styles
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## Development

The app uses:
- **Electron** for the desktop framework
- **Context Isolation** for security (no node integration in renderer)
- **Preload script** for secure API exposure

## Building

To build distributable packages:
```bash
npm run build
```

