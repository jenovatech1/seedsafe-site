/* SeedSafe — Offline Recovery (SSV1 + JSON fallback) + Pretty Renderer
   SSV1 format (dari app):
   SSV1| base64url( utf8( base64( salt16 | iv12 | gcm(ct+tag) ) ) )
   KDF: PBKDF2-HMAC-SHA256, iter=100000, keyLen=32, AES-GCM (tag 16B)
*/
(() => {
  "use strict";

  // ---------- DOM ----------
  const els = {
    file: document.getElementById("backupFile"),
    pass: document.getElementById("masterPassword"),
    toggle: document.getElementById("togglePassword"),
    btn: document.getElementById("decryptButton"),
    spinner: document.getElementById("decryptSpinner"),
    btnText: document.getElementById("decryptButtonText"),
    resultsArea: document.getElementById("resultsArea"),
    resultsPlaceholder: document.getElementById("resultsPlaceholder"),
    resultsContent: document.getElementById("resultsContent"),
    errorArea: document.getElementById("errorArea"),
  };

  // ---------- UI helpers ----------
  const showError = (msg) => {
    if (!els.errorArea) return;
    els.errorArea.style.display = "";
    els.errorArea.classList.remove("d-none");
    els.errorArea.textContent = msg;
  };
  const clearError = () => {
    if (!els.errorArea) return;
    els.errorArea.classList.add("d-none");
    els.errorArea.textContent = "";
  };
  const busy = (on) => {
    if (!els.btn) return;
    els.btn.disabled = on;
    if (els.spinner) els.spinner.classList.toggle("d-none", !on);
    if (els.btnText) els.btnText.textContent = on ? "Decrypting…" : "Decrypt Vault";
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // ---------- File readers ----------
  const readAsText = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsText(file);
    });

  const readAsImageData = (file) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height);
          res({ data, width: c.width, height: c.height });
        };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });

  async function extractPayloadFromQR(file) {
    if (typeof jsQR === "undefined") throw new Error("QR decoder (jsQR) not loaded.");
    const { data, width, height } = await readAsImageData(file);
    const qr = jsQR(data.data, width, height);
    if (!qr) throw new Error("No QR code detected in the image.");
    return qr.data; // string
  }

  // ---------- Base64 helpers ----------
  const b64pad = (s) => {
    const m = s.length % 4;
    if (m === 2) return s + "==";
    if (m === 3) return s + "=";
    return s;
  };
  const b64ToBytes = (s) => Uint8Array.from(atob(b64pad(s)), (c) => c.charCodeAt(0));
  const b64urlToBytes = (s) => {
    const std = s.replace(/-/g, "+").replace(/_/g, "/");
    return b64ToBytes(std);
  };
  const bytesToUtf8 = (u8) => new TextDecoder().decode(u8);

  // ---------- Parsing ----------
  const isSSV1 = (text) => typeof text === "string" && text.trim().startsWith("SSV1|");

  function decodeSSV1ToCombined(text) {
    const raw = text.trim().slice("SSV1|".length);
    let innerB64;
    try {
      innerB64 = bytesToUtf8(b64urlToBytes(raw));
    } catch {
      innerB64 = bytesToUtf8(b64ToBytes(raw)); // fallback
    }
    const combined = b64ToBytes(innerB64.replace(/\s+/g, ""));
    if (combined.length < 28) throw new Error(`SSV1 payload too short (${combined.length} bytes).`);
    return combined;
  }

  function parseJSONContainer(text) {
    let t = String(text).trim();
    if (/^data:/i.test(t)) {
      const base64 = t.split(",")[1] || "";
      t = atob(base64);
    }
    try {
      return JSON.parse(t);
    } catch {}
    if (/^[A-Za-z0-9+/_=-]{24,}$/.test(t)) {
      try {
        return JSON.parse(bytesToUtf8(b64ToBytes(t)));
      } catch {}
    }
    return null;
  }

  // ---------- Crypto ----------
  async function deriveKeyPBKDF2(password, saltBytes, iterations = 100000) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  async function decryptGCM(key, ivBytes, cipherPlusTag) {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, cipherPlusTag);
    return new TextDecoder().decode(plain);
  }

  // ---------- Pretty Renderer ----------
  function renderResults(data) {
    if (!els.resultsArea || !els.resultsContent || !els.resultsPlaceholder) return;

    const safe = (v) => escapeHtml(v ?? "");

    const phrases = Array.isArray(data?.phrases) ? data.phrases : [];
    const notes = Array.isArray(data?.notes) ? data.notes : [];
    const pws = Array.isArray(data?.passwords) ? data.passwords : [];
    const exportedAt = data?.exportedAt ? new Date(data.exportedAt) : null;

    const statBadge = (num, label) => `<div class="stat-badge"><span class="stat-num">${num}</span><span class="stat-label">${safe(label)}</span></div>`;

    const renderPhrase = (m, idx) => {
      const words = String(m?.phrase ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const chips = words.map((w, i) => `<span class="chip" data-word-index="${i + 1}" title="#${i + 1}">${safe(w)}</span>`).join("");
      const full = safe(m?.phrase ?? "");
      return `
        <div class="item-card" data-type="seed" data-index="${idx}">
          <div class="item-head">
            <div class="item-title"><i class="bi bi-fingerprint me-2"></i>${safe(m?.label || "Untitled")}</div>
            <div class="item-actions">
              <button class="btn-icon" title="Copy full phrase" data-copy="${full}"><i class="bi bi-clipboard"></i></button>
            </div>
          </div>
          <div class="seed-grid">${chips}</div>
        </div>
      `;
    };

    const renderNote = (m, idx) => `
      <div class="item-card" data-type="note" data-index="${idx}">
        <div class="item-head">
          <div class="item-title"><i class="bi bi-journal-text me-2"></i>${safe(m?.label || "Untitled")}</div>
          <div class="item-actions">
            <button class="btn-icon" title="Copy note" data-copy="${safe(m?.note ?? "")}"><i class="bi bi-clipboard"></i></button>
          </div>
        </div>
        <div class="note-body">${safe(m?.note ?? "")}</div>
      </div>
    `;

    const renderPassword = (m, idx) => {
      const pwd = safe(m?.password ?? "");
      const usr = safe(m?.username ?? "");
      return `
        <div class="item-card" data-type="password" data-index="${idx}">
          <div class="item-head">
            <div class="item-title"><i class="bi bi-key me-2"></i>${safe(m?.label || "Untitled")}</div>
            <div class="item-actions">
              <button class="btn-icon" title="Copy password" data-copy="${pwd}"><i class="bi bi-clipboard"></i></button>
            </div>
          </div>
          <div class="kv"><span class="k">Username</span><span class="v">${usr || "<span class='text-dim'>—</span>"}</span></div>
          <div class="kv">
            <span class="k">Password</span>
            <span class="v">
              <span class="secret" data-secret="${pwd}">••••••••</span>
              <button class="btn-link ms-2" data-toggle-mask><i class="bi bi-eye"></i> Show</button>
            </span>
          </div>
        </div>
      `;
    };

    const headerHtml = `
      <div class="result-header">
        <div class="left">
          <h4 class="mb-1">Decrypted Data</h4>
          ${exportedAt ? `<div class="tiny text-dim">Exported at: ${exportedAt.toLocaleString()}</div>` : ""}
        </div>
        <div class="right">
          ${statBadge(phrases.length, "Seeds")}
          ${statBadge(notes.length, "Notes")}
          ${statBadge(pws.length, "Passwords")}
        </div>
      </div>

      <div class="result-toolbar">
        <div class="toolbar-left">
          <div class="input-group input-group-sm">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input id="resultSearch" type="search" class="form-control" placeholder="Search label/content…" />
          </div>
        </div>
        <div class="toolbar-right">
          <button id="btnCopyAll" class="btn btn-outline-light btn-sm"><i class="bi bi-clipboard"></i> Copy as JSON</button>
        </div>
      </div>
    `;

    const seedsHtml = phrases.map(renderPhrase).join("") || `<div class="empty">No seed phrases.</div>`;
    const notesHtml = notes.map(renderNote).join("") || `<div class="empty">No notes.</div>`;
    const pwHtml = pws.map(renderPassword).join("") || `<div class="empty">No passwords.</div>`;

    const bodyHtml = `
      <div class="result-sections">
        <section class="result-section">
          <h6 class="section-title"><i class="bi bi-fingerprint me-2"></i>Seed Phrases</h6>
          <div class="grid">${seedsHtml}</div>
        </section>

        <section class="result-section">
          <h6 class="section-title"><i class="bi bi-journal-text me-2"></i>Secure Notes</h6>
          <div class="grid">${notesHtml}</div>
        </section>

        <section class="result-section">
          <h6 class="section-title"><i class="bi bi-key me-2"></i>Passwords</h6>
          <div class="grid">${pwHtml}</div>
        </section>
      </div>
    `;

    els.resultsArea.style.display = "";
    els.resultsArea.classList.remove("d-none");
    els.resultsPlaceholder.style.display = "none";
    els.resultsContent.innerHTML = headerHtml + bodyHtml;

    // --- events (copy, reveal, search) ---
    els.resultsContent.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-copy],[data-toggle-mask]");
      if (!t) return;

      // Copy to clipboard
      if (t.hasAttribute("data-copy")) {
        const val = t.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(val);
          t.innerHTML = '<i class="bi bi-check2"></i>';
          setTimeout(() => (t.innerHTML = '<i class="bi bi-clipboard"></i>'), 1200);
        } catch {
          alert("Copy failed.");
        }
        return;
      }

      // Toggle mask
      if (t.hasAttribute("data-toggle-mask")) {
        const wrap = t.closest(".kv");
        const secretEl = wrap?.querySelector(".secret");
        if (!secretEl) return;
        const isHidden = secretEl.textContent?.includes("•");
        if (isHidden) {
          secretEl.textContent = secretEl.getAttribute("data-secret") || "";
          t.innerHTML = '<i class="bi bi-eye-slash"></i> Hide';
        } else {
          secretEl.textContent = "••••••••";
          t.innerHTML = '<i class="bi bi-eye"></i> Show';
        }
        return;
      }
    });

    // Copy-all (JSON pretty)
    const btnCopyAll = document.getElementById("btnCopyAll");
    if (btnCopyAll) {
      btnCopyAll.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          btnCopyAll.innerHTML = '<i class="bi bi-check2"></i> Copied';
          setTimeout(() => (btnCopyAll.innerHTML = '<i class="bi bi-clipboard"></i> Copy as JSON'), 1300);
        } catch {
          alert("Copy failed.");
        }
      });
    }

    // Search / filter
    const inputSearch = document.getElementById("resultSearch");
    if (inputSearch) {
      inputSearch.addEventListener("input", () => {
        const q = inputSearch.value.trim().toLowerCase();
        els.resultsContent.querySelectorAll(".item-card").forEach((card) => {
          const type = card.getAttribute("data-type") || "";
          let text = "";
          if (type === "seed") {
            text =
              card.querySelector(".item-title")?.textContent +
              " " +
              Array.from(card.querySelectorAll(".chip"))
                .map((c) => c.textContent)
                .join(" ");
          } else if (type === "note") {
            text = card.querySelector(".item-title")?.textContent + " " + (card.querySelector(".note-body")?.textContent || "");
          } else if (type === "password") {
            const kvs = Array.from(card.querySelectorAll(".kv .v"))
              .map((v) => v.textContent)
              .join(" ");
            text = card.querySelector(".item-title")?.textContent + " " + kvs;
          }
          text = (text || "").toLowerCase();
          card.style.display = !q || text.includes(q) ? "" : "none";
        });
      });
    }
  }

  // Fallback: show raw JSON string
  const showRawJson = (objOrText) => {
    els.resultsArea.style.display = "";
    els.resultsArea.classList.remove("d-none");
    els.resultsPlaceholder.style.display = "none";
    const pretty = typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText, null, 2);
    els.resultsContent.innerHTML = `<pre>${escapeHtml(pretty)}</pre>`;
  };

  // ---------- Flow ----------
  async function handleDecrypt() {
    clearError();
    if (els.resultsArea) els.resultsArea.classList.add("d-none");
    if (els.resultsContent) els.resultsContent.innerHTML = "";
    if (els.resultsPlaceholder) els.resultsPlaceholder.style.display = "";

    const file = els.file?.files?.[0];
    const password = els.pass?.value || "";
    if (!file) return showError("Please select a backup file (.ssv or QR image).");
    if (!password) return showError("Please enter your master password.");

    busy(true);
    try {
      const isImage = (file.type && file.type.startsWith("image/")) || /\.(png|jpe?g|webp)$/i.test(file.name);
      const textRaw = isImage ? await extractPayloadFromQR(file) : await readAsText(file);

      if (isSSV1(textRaw)) {
        const combined = decodeSSV1ToCombined(textRaw);
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const data = combined.slice(28);

        const key = await deriveKeyPBKDF2(password, salt, 100000);
        const plain = await decryptGCM(key, iv, data);

        try {
          const parsed = JSON.parse(plain);
          renderResults(parsed); // <<< gunakan UI cantik
        } catch {
          showRawJson(plain);
        }
        busy(false);
        return;
      }

      // Fallback container JSON
      const container = parseJSONContainer(textRaw);
      if (!container) throw new Error("Backup format not recognized. Expected SSV1|… or encrypted JSON container.");

      const pick = (o, ...names) => names.find((n) => n in o);
      const flexBytes = (s) => {
        const hex = /^[0-9a-f]+$/i.test(s) && s.length % 2 === 0;
        return hex ? Uint8Array.from(s.match(/.{2}/g).map((h) => parseInt(h, 16))) : b64ToBytes(s.replace(/-/g, "+").replace(/_/g, "/"));
      };

      const saltKey = pick(container, "salt", "saltB64", "s");
      const ivKey = pick(container, "iv", "nonce", "ivB64", "n");
      const dataKey = pick(container, "data", "ciphertext", "ct", "cipher");
      const tagKey = pick(container, "tag", "authTag", "mac");
      if (!saltKey || !ivKey || !dataKey) throw new Error("Missing fields: salt, iv/nonce, and data/ciphertext.");

      const salt = flexBytes(container[saltKey]);
      const iv = flexBytes(container[ivKey]);
      let data = flexBytes(container[dataKey]);
      if (tagKey && container[tagKey]) {
        const tag = flexBytes(container[tagKey]);
        const merged = new Uint8Array(data.length + tag.length);
        merged.set(data, 0);
        merged.set(tag, data.length);
        data = merged;
      }
      const iters = Number(container.iterations ?? container.rounds ?? container.it ?? 100000);

      const key = await deriveKeyPBKDF2(password, salt, iters);
      const plain = await decryptGCM(key, iv, data);

      try {
        const parsed = JSON.parse(plain);
        renderResults(parsed);
      } catch {
        showRawJson(plain);
      }
    } catch (err) {
      console.error(err);
      showError(err?.message || "Failed to decrypt. Check your password and file.");
    } finally {
      busy(false);
    }
  }

  // ---------- Events ----------
  if (els.toggle && els.pass) {
    els.toggle.addEventListener("click", () => {
      const isPw = els.pass.getAttribute("type") === "password";
      els.pass.setAttribute("type", isPw ? "text" : "password");
      els.toggle.innerHTML = isPw ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }
  if (els.btn) els.btn.addEventListener("click", handleDecrypt);
  if (els.pass) {
    els.pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleDecrypt();
    });
  }
})();
