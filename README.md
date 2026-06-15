# FoxTrack: Full-Stack Email Telemetry & Tracking System

FoxTrack is a decoupled, full-stack browser extension and REST API that provides real-time email tracking capabilities natively within the Gmail web interface. 

It tracks email opens and link clicks using a microscopic 1x1 tracking pixel and redirect proxies, completely bypassing the need for third-party client software.

## 🏗️ System Architecture

This project is built as a **Monorepo** containing two distinct micro-environments:

1. **Frontend (`foxtrack-extension`):** A cross-browser, lightweight client that injects a custom UI into Gmail, captures send events, and intercepts network traffic to prevent false-positive telemetry.
2. **Backend (`foxtrack-backend`):** A cloud-hosted stateless proxy server that handles incoming pixel pings, processes URL redirects, and securely interfaces with the PostgreSQL database.

## 🚀 Tech Stack

* **Frontend:** JavaScript (ES6), HTML5, CSS3, WebExtensions API (Manifest V3 compatible)
* **Backend:** Node.js, Express.js, CORS
* **Database:** PostgreSQL (Hosted via Supabase) / `@supabase/supabase-js`
* **Cloud Infrastructure:** Render (Node API), GitHub (Version Control)

## ✨ Key Features

* **Native Gmail Integration:** Injects a seamless "Track & Send" button directly into the Gmail DOM using MutationObservers.
* **Invisible Open Tracking:** Injects a dynamic 1x1 tracking GIF into outbound payloads.
* **Link Click Proxying:** Automatically parses outbound emails and replaces standard links with custom API endpoints that log the click before securely redirecting the user to the original destination.
* **Real-time Dashboard:** A dynamic extension popup that fetches live relational data from the cloud database based on a local `chrome.storage` index.

## 🧠 Engineering Highlights (Challenges Solved)

* **The "Self-Ping" Firewall:** Implemented a network-level interceptor using `chrome.webRequest`. It actively monitors and blocks Google's aggressive image-proxy preloading and the user's own local browser requests, ensuring "Open" metrics strictly reflect recipient actions, not the sender's.
* **Stateless Frontend Design:** The browser extension strictly acts as a thin client. It utilizes `chrome.storage.local` merely as an index (storing only `emailId` references), offloading all heavy data storage, timestamping, and relational mapping to the cloud. This keeps browser memory consumption near zero.
* **Decoupled Security:** Utilized environment variables (`.env`) strictly isolated to the backend, ensuring master database `service_role` tokens are never exposed to the client-side browser extension.

## 📂 Directory Structure

```text
FoxTrack/
├── foxtrack-backend/         # Node.js Express API (Deployed to Render)
│   ├── package.json          # Dependency definitions
│   ├── server.js             # API Routing & Supabase integration
│   └── .gitignore            # Security rules (Blocks .env uploads)
│
├── foxtrack-extension/       # Cross-browser extension payload
│   ├── background.js         # Service worker & network firewall
│   ├── content.js            # DOM manipulation (Gmail UI injection)
│   ├── manifest.json         # Extension configuration & permissions
│   ├── popup.html            # Dashboard UI structure
│   └── popup.js              # Dashboard logic & API fetching
│
└── README.md
```

## 🛠️ Local Installation & Setup

### 1. Database Setup
1. Spin up a PostgreSQL database via Supabase.
2. Create three tables: `emails`, `reads`, and `clicks`.

### 2. Backend Environment
Navigate to the backend directory, install dependencies, and start the server:

```bash
# Navigate into the backend folder
cd foxtrack-backend

# Install required node modules
npm install

# Create the environment file (make sure to paste your actual keys)
echo "SUPABASE_URL=your_supabase_url_here" > .env
echo "SUPABASE_KEY=your_service_role_key_here" >> .env

# Start the local development server
npm start
