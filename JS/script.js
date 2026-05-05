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

// Load menu items
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
        
        if (fileList) {
            fileList.innerHTML = "";
            files.forEach(f => {
                const card = document.createElement('div');
                card.className = "tool-card";
                card.innerHTML = `<strong>${f.replace('.json', '').toUpperCase()}</strong>`;
                card.onclick = () => window.loadRTMTool(f);
                fileList.appendChild(card);
            });
        }
    } catch (e) {
        if (fileList) fileList.innerHTML = `<div class="error-msg">Error: Missing manifest.json</div>`;
    }
};

// Fetch JSON data
window.loadRTMTool = async (fileName) => {
    const filePath = `./RTM/${fileName}`;
    try {
        const response = await fetch(filePath);
        const data = await response.json();
        renderToolUI(data, fileName);
    } catch (e) { alert("Error loading " + fileName); }
};

// Build interface elements
function renderToolUI(data, fileName) {
    const container = document.getElementById('tool_container');
    const fileList = document.getElementById('file_list');
    const backBtn = document.getElementById('back_btn');

    if (fileList) fileList.style.display = "none";
    if (container) {
        container.style.display = "block";
        container.innerHTML = `<h2>${fileName.toUpperCase()}</h2>`;
    }
    if (backBtn) backBtn.style.display = "inline-block";

    data.sections.forEach(section => {
        const secDiv = document.createElement('div');
        secDiv.className = "section";
        secDiv.innerHTML = `<h3>${section.title}</h3>`;

        section.controls.forEach(ctrl => {
            const row = document.createElement('div');
            row.className = "control-row";
            
            const filter = ctrl.filter || '';
            const force = ctrl.force_type || '';
            const mLen = ctrl.max_len || 4;
            const readLen = ctrl.read_length || 4;

            // STRING
            if (ctrl.type === "string_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input type="text" id="str_${ctrl.address}" maxlength="${ctrl.max_len || 16}">
                    <button onclick="handleString('${ctrl.address}', ${ctrl.max_len || 16})">Set</button>
                    <button onclick="handleRead('${ctrl.address}', ${readLen}, 'string')">Read</button>`;
            }

            // RGB
            else if (ctrl.type === "rgb_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div class="rgb-group">
                        <input type="text" id="r_${ctrl.address}" placeholder="R">
                        <input type="text" id="g_${ctrl.address}" placeholder="G">
                        <input type="text" id="b_${ctrl.address}" placeholder="B">
                        <button onclick="handleRGBGroup('${ctrl.address}')">Set</button>
                        <button onclick="handleRead('${ctrl.address}', ${readLen}, 'rgb')">Read</button>
                    </div>`;
            } 

            // FLOAT / INT
            else if (ctrl.type === "float_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input type="text" id="in_${ctrl.address}">
                    <button onclick="handleFloat('${ctrl.address}', ${ctrl.is_rgb || false}, '${force}', ${mLen})">Apply</button>
                    <button onclick="handleRead('${ctrl.address}', ${readLen}, 'float')">Read</button>`;
            }

            // DROPDOWN
            else if (ctrl.type === "dropdown") {
                let opts = ctrl.options.map(o => 
                    `<option value="${o.value}">${o.name || o.value}</option>`
                ).join('');

                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <select id="sel_${ctrl.address}">${opts}</select>
                    <button onclick="handleDropdown('${ctrl.address}')">Set</button>
                    <button onclick="handleRead('${ctrl.address}', ${readLen}, 'hex', 'sel_${ctrl.address}')">Read</button>`;
            }

            secDiv.appendChild(row);
        });

        container.appendChild(secDiv);
    });
}

// =======================
// ✅ NEW: READ MEMORY
// =======================

async function getMemory(addr, length) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return null;

    try {
        const res = await fetch(`http://${ip}/getmem.ps3mapi?proc=0&addr=${addr}&length=${length}`);
        const text = await res.text();
        return text.trim();
    } catch {
        alert("Read failed (CORS likely blocked)");
        return null;
    }
}

window.handleRead = async (addr, length, type, targetId = null) => {
    const hex = await getMemory(addr, length);
    if (!hex) return;

    // FLOAT
    if (type === "float") {
        const bytes = hex.match(/.{1,2}/g).map(b => parseInt(b, 16));
        const view = new DataView(new Uint8Array(bytes).buffer);
        const val = view.getFloat32(0, false);
        document.getElementById(`in_${addr}`).value = val;
    }

    // RGB
    else if (type === "rgb") {
        const parts = hex.match(/.{8}/g);
        if (!parts) return;

        const toFloat = (h) => {
            const bytes = h.match(/.{2}/g).map(b => parseInt(b, 16));
            return new DataView(new Uint8Array(bytes).buffer).getFloat32(0, false);
        };

        document.getElementById(`r_${addr}`).value = toFloat(parts[0]);
        document.getElementById(`g_${addr}`).value = toFloat(parts[1]);
        document.getElementById(`b_${addr}`).value = toFloat(parts[2]);
    }

    // DROPDOWN / HEX
    else if (type === "hex" && targetId) {
        document.getElementById(targetId).value = hex.slice(-2);
    }

    // STRING (basic)
    else if (type === "string") {
        let str = "";
        for (let i = 0; i < hex.length; i += 2) {
            const char = parseInt(hex.substr(i, 2), 16);
            if (char === 0) break;
            str += String.fromCharCode(char);
        }
        document.getElementById(`str_${addr}`).value = str;
    }
};

// =======================
// EXISTING FUNCTIONS (UNCHANGED)
// =======================

function stringToHex(str, maxLen) {
    let hex = "";
    let cleanStr = str.substring(0, maxLen);
    for (let i = 0; i < cleanStr.length; i++) {
        hex += cleanStr.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex + "00"; 
}

window.handleString = (addr, maxLen) => {
    const val = document.getElementById(`str_${addr}`).value;
    const hex = stringToHex(val, maxLen);
    sendRequest(addr, hex);
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

window.handleMultiSet = async (writes) => {
    for (const item of writes) {
        sendRequest(item.address, item.value);
        await sleep(250); 
    }
};

function floatToHex(value) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, parseFloat(value) || 0, false);
    return Array.from(new Uint8Array(view.buffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

window.handleFloat = (addr, isRGB, force, maxLen) => {
    const inputVal = document.getElementById(`in_${addr}`).value;
    let hex = floatToHex(inputVal);
    if (isRGB) hex = hex + hex + hex; 
    sendRequest(addr, hex);
};

window.handleRGBGroup = (addr) => {
    const r = floatToHex(document.getElementById(`r_${addr}`).value);
    const g = floatToHex(document.getElementById(`g_${addr}`).value);
    const b = floatToHex(document.getElementById(`b_${addr}`).value);
    sendRequest(addr, r + g + b); 
};

window.handleDropdown = (addr) => 
    sendRequest(addr, document.getElementById(`sel_${addr}`).value);

function sendRequest(addr, val) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return;
    fetch(`http://${ip}/setmem.ps3mapi?proc=0&addr=${addr}&val=${val}`, { mode: 'no-cors' }).catch(() => {});
}

window.goBack = () => window.autoScanRTM();
