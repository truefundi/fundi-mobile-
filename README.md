# Fundi Platform — Mobile Application

The mobile frontend application for the Fundi platform, built with **Expo SDK 54**, **React Native 0.81**, and **TypeScript** using **Expo Router v6**.

---

## 1. Quick Start Guide

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Start Mobile App (Automated Script for Linux)
```bash
# LAN Mode (Auto-detects local Wi-Fi IP and configures .env)
./start-mobile.sh

# Tunnel Mode (Bypasses Wi-Fi router isolation)
./start-mobile.sh --tunnel
```

### Step 3: Start Mobile App (Direct pnpm Commands)
```bash
# Start in LAN mode
pnpm dev:app

# Start in Tunnel mode
pnpm dev:app:tunnel

# Start in Web browser preview
pnpm dev:app:web
```

---

## 2. Code Quality & Typechecking

```bash
pnpm typecheck
```

---

## 3. Project Structure

```
mobile/
├── artifacts/
│   └── site-visit-logger/    # Core Expo React Native application
├── lib/
│   ├── api-client-react/     # Type-safe React Query API client
│   ├── api-spec/             # OpenAPI specification
│   ├── api-zod/              # Zod validation schemas
│   └── db/                   # Database schemas
├── start-mobile.sh           # Automated Linux launch script
├── .gitignore                # Protects secrets & logs
└── package.json              # Monorepo workspace configuration
```
