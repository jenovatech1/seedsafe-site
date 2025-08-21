# SeedSafe — Website & Offline Recovery Tool

**SeedSafe** is a 100% offline, open-source project to secure and recover your crypto seed phrases.  
This repository hosts the marketing site and the in-browser **Offline Recovery Tool** that decrypts SeedSafe backups (`.ssv` files or SSV1 QR payloads) locally.

### ✨ Highlights
- 100% offline — everything runs client-side
- Open source — transparent crypto (AES-256-GCM, PBKDF2-HMAC-SHA256)
- Offline Recovery Tool — decrypt `.ssv` / SSV1 QR in the browser
- No tracking, no analytics

### 🔗 Live Site
GitHub Pages: **(will appear after we enable Pages in Settings → Pages)**

### 📂 Structure
assets/images/ # logos, mockup, illustrations
css/style.css # main landing styles
css/recovery.css # recovery page styles
js/main.js # landing interactions (particles, navbar, smooth scroll)
js/recovery.js # decrypt .ssv / SSV1 QR (local-only)
index.html # landing page
recovery.html # offline recovery tool UI
privacy.html # privacy policy
robots.txt, sitemap.xml

### 🔒 Security
- Decryption is performed **locally** in your browser.
- We don’t collect analytics or send data to servers.
- Never share your seed phrases or private keys with anyone.  
  For vulnerability reports, see **SECURITY.md**.

### 🤝 Contributing
- Issues and PRs are welcome! See **CONTRIBUTING.md**.
- Code of Conduct: **CODE_OF_CONDUCT.md**.

### 📜 License
MIT — see **LICENSE**.
