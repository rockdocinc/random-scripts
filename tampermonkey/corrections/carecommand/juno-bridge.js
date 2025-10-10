// ==UserScript==
// @name         CareCommand ➜ JunoEMR Demographics Bridge
// @namespace    https://rockdoccorrections.com
// @version      1.0
// @updateURL    https://rockdocinc.github.io/random-scripts/tampermonkey/corrections/carecommand/juno-bridge.js
// @downloadURL  https://rockdocinc.github.io/random-scripts/tampermonkey/corrections/carecommand/juno-bridge.js
// @description  Copy demographics + quick-search buttons for JunoEMR
// @author       Deven Prasad for Rockdoc Corrections Inc.
// @match        https://carecommand.rockdoccorrections.com/*
// @match        https://rock-doc.secure.junoemr.com/juno/demographic/demographiccontrol.jsp?displaymode=add*
// @match        https://rock-doc.secure.junoemr.com/juno/demographic/demographicaddarecordhtm.jsp*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-body
// ==/UserScript==

(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  const isRequestViewerPage = () =>
    location.hostname === "carecommand.rockdoccorrections.com" &&
    location.pathname.startsWith("/request-viewer/");

  // UPDATED to recognize both "Add Demographic" pages
  const isOscarAddPage = () => {
    if (location.hostname !== "rock-doc.secure.junoemr.com") {
      return false;
    }
    const isOriginalPage = location.pathname.includes("demographiccontrol.jsp") &&
                           new URLSearchParams(location.search).get("displaymode") === "add";
    const isNewPage = location.pathname.includes("demographicaddarecordhtm.jsp");

    return isOriginalPage || isNewPage;
  };

  /* ---------- CareCommand – COPY + SEARCH BUTTONS ---------- */
  const addCareCommandButtons = () => {
    if (document.getElementById("cc-buttons")) return;

    let attempts = 0;
    const wait = setInterval(() => {
      attempts++;
      const demoBlock = document.querySelector("#__layout > div > div.page > div:nth-child(6)");
      if (!demoBlock || !demoBlock.textContent.includes("First Name")) {
        if (attempts > 30) clearInterval(wait);
        return;
      }

      clearInterval(wait);

      const container = document.createElement("div");
      container.id = "cc-buttons";
      Object.assign(container.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "999999",
        display: "flex",
        gap: "6px"
      });

      const makeBtn = (text, id, bg, clickFn) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.id = id;
        Object.assign(b.style, {
          padding: "8px 12px",
          background: bg,
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "bold"
        });
        b.onclick = clickFn;
        return b;
      };

      const extract = (label) => {
        const p = [...demoBlock.querySelectorAll("p.ab-text")].find(p =>
          p.textContent.trim().startsWith(`${label}:`)
        );
        return p ? p.textContent.split(":")[1]?.trim() || "" : "";
      };

      const first = extract("First Name");
      const middle = extract("Middle Name");
      const last = extract("Last Name");
      const phn = extract("Provincial Health Card Number");
      const fullName = middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;

      const data = {
        firstName: first,
        middleName: middle,
        lastName: last,
        fullFirstName: middle ? `${first} ${middle}` : first,
        gender: extract("Gender"),
        dob: extract("Date of Birth"),
        phn,
        phnProv: extract("Provincial Health Card Province"),
        street: extract("Street Address"),
        city: extract("City"),
        postal: extract("Postal Code"),
        province: extract("Province"),
        country: extract("Country"),
        phone: extract("Phone")
      };
      GM_setValue("demo", JSON.stringify(data));

      container.appendChild(
        makeBtn("📋 Copy Demographics for JunoEMR", "btn-copy", "#007bff", () => {
          alert("Demographics Copied!");
        })
      );

      container.appendChild(
        makeBtn("🔍 Search JunoEMR by PHN", "btn-phn", "#28a745", () => {
          const url = `https://rock-doc.secure.junoemr.com/juno/demographic/demographiccontrol.jsp?search_mode=search_hin&keyword=${encodeURIComponent(phn)}&orderby=last_name%2C+first_name&dboperation=search_titlename&limit1=0&limit2=10&displaymode=Search&ptstatus=active&fromMessenger=false&outofdomain=&limit=10`;
          window.open(url, "_blank");
        })
      );

      container.appendChild(
        makeBtn("👤 Search JunoEMR by Name", "btn-name", "#ff9800", () => {
          const keyword = encodeURIComponent(fullName);
          const url = `https://rock-doc.secure.junoemr.com/juno/demographic/demographiccontrol.jsp?search_mode=search_name&keyword=${keyword}&orderby=last_name%2C+first_name&dboperation=search_titlename&limit1=0&limit2=10&displaymode=Search&ptstatus=active&fromMessenger=false&outofdomain=&limit=10`;
          window.open(url, "_blank");
        })
      );

      document.body.appendChild(container);
    }, 1000);
  };

  /* ---------- JunoEMR – PASTE ---------- */
  const addPasteButton = () => {
    if (document.getElementById("btnPasteFromBaserow")) return;

    const waitOscar = setInterval(() => {
      const tbl = document.getElementById("addDemographicTbl");
      if (!tbl) return;
      clearInterval(waitOscar);

      const btn = document.createElement("input");
      btn.type = "button";
      btn.value = "📥 Paste from CareCommand";
      btn.id = "btnPasteFromBaserow";
      Object.assign(btn.style, { marginRight: "5px", marginTop: "5px", cursor: "pointer" });

      const addBtn = document.getElementById("btnAddRecord");
      if (addBtn) addBtn.parentElement.insertBefore(btn, addBtn);

      btn.onclick = () => {
        const raw = GM_getValue("demo", null);
        if (!raw) return alert("No Demographics Copied Yet.");

        const d = JSON.parse(raw);
        const set = (sel, val) => {
          const el = document.querySelector(sel);
          if (el) el.value = val;
        };

        set("#first_name", d.fullFirstName);
        set("#last_name", d.lastName);
        set("#address", d.street);
        set("#city", d.city);
        set("#postal", d.postal);
        set("#phone", d.phone);

        const provSel = document.querySelector("#province");
        if (provSel) [...provSel.options].forEach(opt => { if (opt.value === d.province) provSel.value = opt.value; });

        const sexSel = document.querySelector("#sex");
        if (sexSel && d.gender) {
          const map = { Male: "M", Female: "F", Transgender: "T", Other: "O", Unidentified: "U", Undefined: "U" };
          sexSel.value = map[d.gender] || (d.gender ? "O" : "");
        }

        if (d.dob) {
          const [y, m, day] = d.dob.split("-");
          set("#year_of_birth", y);
          set("#month_of_birth", m);
          set("#date_of_birth", day);
        }

        set("#hin", d.phn);
        const hcProvSel = document.querySelector("#hc_type");
        if (hcProvSel) [...hcProvSel.options].forEach(opt => { if (opt.value === d.phnProv) hcProvSel.value = opt.value; });

        const countrySel = document.querySelector("#countryOfOrigin");
        if (countrySel) [...countrySel.options].forEach(opt => { if (opt.textContent.trim().toUpperCase() === d.country.toUpperCase()) countrySel.value = opt.value; });

        btn.value = "✅ Pasted!";
        btn.disabled = true;
      };
    }, 500);
  };

  /* ---------- Main Logic to Handle Page Changes ---------- */
  const handlePageChanges = () => {
    if (isRequestViewerPage()) {
      addCareCommandButtons();
    } else {
      const buttons = document.getElementById("cc-buttons");
      if (buttons) buttons.remove();
    }

    if (isOscarAddPage()) {
      addPasteButton();
    }
  };

  const observer = new MutationObserver(() => {
    setTimeout(handlePageChanges, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  handlePageChanges();

})();
