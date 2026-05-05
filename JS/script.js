// Init application
window.onload = async () => {
    setupIP();
    await autoScanRTM(); 
};

// Manage saved IP
function setupIP() {
    const ipInput = document.getElementById('ps3_ip');
    if (!ipInput) return;

    if (localStorage.getItem('ps3_ip')) {
        ipInput.value = localStorage.getItem('ps3_ip');
    }

    ipInput.onchange = () => localStorage.setItem('ps3_ip', ipInput.value);
}

// Load menu
window.autoScanRTM = async () => {
    const fileList = document.getElementById('file_list');
    const container = document.getElementById('tool_container');
    const backBtn = document.getElementById('back_btn');

    if (fileList) fileList.style.display = "grid"; 
    if (container) container.style.display = "none";
    if (backBtn) backBtn.style.display = "none";
    
    try {
        const response = await fetch('./RTM/manifest.json');
        const files = await response.json();
        
        fileList.innerHTML = "";
        files.forEach(f => {
            const card = document.createElement('div');
            card.className = "tool-card";
            card.innerHTML = `<strong>${f.replace('.json', '').toUpperCase()}</strong>`;
            card.onclick = () => window.loadRTMTool(f);
            fileList.appendChild(card);
        });

    } catch {
        fileList.innerHTML = `<div class="error-msg">Missing manifest.json</div>`;
    }
};

// Load JSON tool
window.loadRTMTool = async (fileName) => {
    try {
        const res = await fetch(`./RTM/${fileName}`);
        const data = await res.json();
        renderToolUI(data, fileName);
    } catch {
        alert("Error loading " + fileName);
    }
};

// Build UI
function renderToolUI(data, fileName) {
    const container = document.getElementById('tool_container');
    const fileList = document.getElementById('file_list');
    const backBtn = document.getElementById('back_btn');

    fileList.style.display = "none";
    container.style.display = "block";
    container.innerHTML = `<h2>${fileName.toUpperCase()}</h2>`;
    backBtn.style.display = "inline-block";

    data.sections.forEach(section => {
        const secDiv = document.createElement('div');
        secDiv.className = "section";
        secDiv.innerHTML = `<h3>${section.title}</h3>`;

        section.controls.forEach(ctrl => {
            const row = document.createElement('div');
            row.className = "control-row";
            const readLen = ctrl.read_length || 4;

            // GRAPHICS
            if (ctrl.type === "graphics") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div class="rgb-group">
                        <input id="rot_${ctrl.address}" placeholder="Rotation">
                        <input id="scale_${ctrl.address}" placeholder="Scale">
                        <input id="x_${ctrl.address}" placeholder="X">
                        <input id="y_${ctrl.address}" placeholder="Y">
                        <button onclick="handleGraphics('${ctrl.address}')">Set</button>
                        <button onclick="handleReadGraphics('${ctrl.address}')">Read</button>
                    </div>`;
            }

            // RGB
            else if (ctrl.type === "rgb_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div class="rgb-group">
                        <input id="r_${ctrl.address}" placeholder="R">
                        <input id="g_${ctrl.address}" placeholder="G">
                        <input id="b_${ctrl.address}" placeholder="B">
                        <button onclick="handleRGBGroup('${ctrl.address}')">Set</button>
                        <button onclick="handleRead('${ctrl.address}', 12, 'rgb')">Read</button>
                    </div>`;
            }

            // FLOAT
            else if (ctrl.type === "float_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input id="in_${ctrl.address}">
                    <button onclick="handleFloat('${ctrl.address}')">Apply</button>
                    <button onclick="handleRead('${ctrl.address}', ${readLen}, 'float')">Read</button>`;
            }

            // STRING
            else if (ctrl.type === "string_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input id="str_${ctrl.address}">
                    <button onclick="handleString('${ctrl.address}', ${ctrl.max_len || 16})">Set</button>
                    <button onclick="handleRead('${ctrl.address}', ${ctrl.max_len || 16}, 'string')">Read</button>`;
            }

            // DROPDOWN
            else if (ctrl.type === "dropdown") {
                let opts = ctrl.options.map(o =>
                    `<option value="${o.value}">${o.name}</option>`
                ).join('');

                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <select id="sel_${ctrl.address}">${opts}</select>
                    <button onclick="handleDropdown('${ctrl.address}')">Set</button>
                    <button onclick="handleRead('${ctrl.address}', 1, 'hex', 'sel_${ctrl.address}')">Read</button>`;
            }

            secDiv.appendChild(row);
        });

        container.appendChild(secDiv);
    });
}

// =======================
// UNIVERSAL MEMORY READ
// =======================
async function readMemoryRaw(addr, length) {
    const ip = document.getElementById('ps3_ip').value;

    try {
        const res = await fetch(`http://${ip}/getmem.ps3mapi?proc=0&addr=${addr}&length=${length}`);
        let text = await res.text();

        let hex = text.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        return hex.slice(-length * 2);

    } catch {
        return null;
    }
}

// =======================
// TYPE CONVERSIONS
// =======================
function hexToFloat(hex) {
    const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));
    return new DataView(new Uint8Array(bytes).buffer).getFloat32(0, false);
}

function hexToInt(hex) {
    return parseInt(hex, 16);
}

function hexToString(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
        const char = parseInt(hex.substr(i, 2), 16);
        if (char === 0) break;
        str += String.fromCharCode(char);
    }
    return str;
}

// =======================
// GENERIC READ HANDLER
// =======================
window.handleRead = async (addr, length, type, targetId = null) => {
    const hex = await readMemoryRaw(addr, length);
    if (!hex) return;

    if (type === "float") {
        document.getElementById(`in_${addr}`).value = hexToFloat(hex);
    }

    else if (type === "rgb") {
        const parts = hex.match(/.{8}/g);
        document.getElementById(`r_${addr}`).value = hexToFloat(parts[0]);
        document.getElementById(`g_${addr}`).value = hexToFloat(parts[1]);
        document.getElementById(`b_${addr}`).value = hexToFloat(parts[2]);
    }

    else if (type === "hex") {
        const val = hex.slice(-2);
        document.getElementById(targetId).value = val;
    }

    else if (type === "int") {
        document.getElementById(`in_${addr}`).value = hexToInt(hex);
    }

    else if (type === "string") {
        document.getElementById(`str_${addr}`).value = hexToString(hex);
    }
};

// =======================
// GRAPHICS
// =======================
window.handleGraphics = async (baseAddr) => {
    await sendRequest(baseAddr, floatToHex(val(`rot_${baseAddr}`)));
    await sleep(100);
    await sendRequest(addOffset(baseAddr, 4), floatToHex(val(`scale_${baseAddr}`)));
    await sleep(100);
    await sendRequest(addOffset(baseAddr, 8), floatToHex(val(`x_${baseAddr}`)));
    await sleep(100);
    await sendRequest(addOffset(baseAddr, 12), floatToHex(val(`y_${baseAddr}`)));
};

window.handleReadGraphics = async (baseAddr) => {
    document.getElementById(`rot_${baseAddr}`).value = await readFloat(baseAddr);
    document.getElementById(`scale_${baseAddr}`).value = await readFloat(addOffset(baseAddr, 4));
    document.getElementById(`x_${baseAddr}`).value = await readFloat(addOffset(baseAddr, 8));
    document.getElementById(`y_${baseAddr}`).value = await readFloat(addOffset(baseAddr, 12));
};

async function readFloat(addr) {
    const hex = await readMemoryRaw(addr, 4);
    return hex ? hexToFloat(hex).toFixed(4) : 0;
}

// =======================
// WRITE HELPERS
// =======================
function floatToHex(value) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, parseFloat(value) || 0, false);
    return [...new Uint8Array(view.buffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('').toUpperCase();
}

window.handleFloat = (addr) => {
    sendRequest(addr, floatToHex(val(`in_${addr}`)));
};

window.handleRGBGroup = (addr) => {
    sendRequest(addr,
        floatToHex(val(`r_${addr}`)) +
        floatToHex(val(`g_${addr}`)) +
        floatToHex(val(`b_${addr}`))
    );
};

window.handleString = (addr, maxLen) => {
    let str = val(`str_${addr}`).substring(0, maxLen);
    let hex = "";
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    sendRequest(addr, hex + "00");
};

window.handleDropdown = (addr) =>
    sendRequest(addr, document.getElementById(`sel_${addr}`).value);

// =======================
// CORE
// =======================
function sendRequest(addr, val) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return;
    fetch(`http://${ip}/setmem.ps3mapi?proc=0&addr=${addr}&val=${val}`, { mode: 'no-cors' });
}

function addOffset(addr, offset) {
    return (parseInt(addr, 16) + offset).toString(16).toUpperCase().padStart(addr.length, '0');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val = (id) => document.getElementById(id).value;

// Back
window.goBack = () => window.autoScanRTM();
