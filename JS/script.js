// ========================
// INIT
// ========================
window.onload = async () => {
    setupIP();
    await autoScanRTM();
};

// ========================
// IP STORAGE
// ========================
function setupIP() {
    const ipInput = document.getElementById('ps3_ip');
    if (!ipInput) return;

    if (localStorage.getItem('ps3_ip')) {
        ipInput.value = localStorage.getItem('ps3_ip');
    }

    ipInput.onchange = () => {
        localStorage.setItem('ps3_ip', ipInput.value);
    };
}

// ========================
// MENU LOADER
// ========================
window.autoScanRTM = async () => {
    const fileList = document.getElementById('file_list');
    const container = document.getElementById('tool_container');
    const backBtn = document.getElementById('back_btn');

    if (fileList) fileList.style.display = "grid";
    if (container) container.style.display = "none";
    if (backBtn) backBtn.style.display = "none";

    try {
        const res = await fetch('./RTM/manifest.json');
        const files = await res.json();

        fileList.innerHTML = "";
        files.forEach(f => {
            const card = document.createElement('div');
            card.className = "tool-card";
            card.innerHTML = `<strong>${f.replace('.json', '').toUpperCase()}</strong>`;
            card.onclick = () => window.loadRTMTool(f);
            fileList.appendChild(card);
        });

    } catch (e) {
        fileList.innerHTML = `<div class="error-msg">Missing manifest.json</div>`;
    }
};

// ========================
// LOAD TOOL
// ========================
window.loadRTMTool = async (fileName) => {
    try {
        const res = await fetch(`./RTM/${fileName}`);
        const data = await res.json();
        renderToolUI(data, fileName);
    } catch (e) {
        alert("Error loading " + fileName);
    }
};

// ========================
// UI RENDER
// ========================
function renderToolUI(data, fileName) {
    const container = document.getElementById('tool_container');
    const fileList = document.getElementById('file_list');
    const backBtn = document.getElementById('back_btn');

    fileList.style.display = "none";
    container.style.display = "block";
    backBtn.style.display = "inline-block";

    container.innerHTML = `<h2>${fileName.toUpperCase()}</h2>`;

    data.sections.forEach(section => {
        const sec = document.createElement('div');
        sec.className = "section";
        sec.innerHTML = `<h3>${section.title}</h3>`;

        section.controls.forEach(ctrl => {
            const row = document.createElement('div');
            row.className = "control-row";

            // ========================
            // RGB
            // ========================
            if (ctrl.type === "rgb_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div>
                        <input id="r_${ctrl.address}" placeholder="R">
                        <input id="g_${ctrl.address}" placeholder="G">
                        <input id="b_${ctrl.address}" placeholder="B">
                        <button onclick="handleRGB('${ctrl.address}')">Set</button>
                    </div>
                `;
            }

            // ========================
            // GRAPHICS (FIXED)
            // ========================
            else if (ctrl.type === "graphics") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div>
                        <input id="rot_${ctrl.rotation}" placeholder="Rotation">
                        <input id="scl_${ctrl.scale}" placeholder="Scale">
                        <input id="x_${ctrl.x}" placeholder="X">
                        <input id="y_${ctrl.y}" placeholder="Y">
                        <button onclick="handleGraphics('${ctrl.rotation}','${ctrl.scale}','${ctrl.x}','${ctrl.y}')">Set</button>
                    </div>
                `;
            }

            // ========================
            // FLOAT
            // ========================
            else if (ctrl.type === "float_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input id="in_${ctrl.address}" placeholder="Value">
                    <button onclick="handleFloat('${ctrl.address}')">Set</button>
                `;
            }

            // ========================
            // DROPDOWN FIXED
            // ========================
            else if (ctrl.type === "dropdown") {
                let opts = ctrl.options
                    .map(o => `<option value="${o.value}">${o.name}</option>`)
                    .join('');

                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <select id="sel_${ctrl.address}">${opts}</select>
                    <button onclick="handleDropdown('${ctrl.address}')">Set</button>
                `;
            }

            sec.appendChild(row);
        });

        container.appendChild(sec);
    });
}

// ========================
// FLOAT FIXED
// ========================
function floatToHex(v) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, parseFloat(v) || 0, false);
    return [...new Uint8Array(buf)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// ========================
// RGB (3 FLOATS)
// ========================
window.handleRGB = (addr) => {
    const r = floatToHex(document.getElementById(`r_${addr}`).value);
    const g = floatToHex(document.getElementById(`g_${addr}`).value);
    const b = floatToHex(document.getElementById(`b_${addr}`).value);

    sendRequest(addr, r + g + b);
};

// ========================
// GRAPHICS FIX (4 FLOATS = 16 BYTES)
// ========================
window.handleGraphics = (rAddr, sAddr, xAddr, yAddr) => {
    const rot = floatToHex(document.getElementById(`rot_${rAddr}`).value);
    const scl = floatToHex(document.getElementById(`scl_${sAddr}`).value);
    const x   = floatToHex(document.getElementById(`x_${xAddr}`).value);
    const y   = floatToHex(document.getElementById(`y_${yAddr}`).value);

    // IMPORTANT: each address gets ONE float
    sendRequest(rAddr, rot);
    sendRequest(sAddr, scl);
    sendRequest(xAddr, x);
    sendRequest(yAddr, y);
};

// ========================
// FLOAT WRITE
// ========================
window.handleFloat = (addr) => {
    const val = document.getElementById(`in_${addr}`).value;
    sendRequest(addr, floatToHex(val));
};

// ========================
// DROPDOWN FIX
// ========================
window.handleDropdown = (addr) => {
    const val = document.getElementById(`sel_${addr}`).value;
    sendRequest(addr, val);
};

// ========================
// SEND REQUEST
// ========================
function sendRequest(addr, val) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return;

    fetch(`http://${ip}/setmem.ps3mapi?proc=0&addr=${addr}&val=${val}`, {
        mode: 'no-cors'
    }).catch(() => {});
}
