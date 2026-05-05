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

            const readLen = ctrl.read_length || 4;

            // GRAPHICS TYPE ✅
            if (ctrl.type === "graphics") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div class="rgb-group">
                        <input type="text" id="rot_${ctrl.address}" placeholder="Rotation">
                        <input type="text" id="scale_${ctrl.address}" placeholder="Scale">
                        <input type="text" id="x_${ctrl.address}" placeholder="X">
                        <input type="text" id="y_${ctrl.address}" placeholder="Y">
                        <button onclick="handleGraphics('${ctrl.address}')">Set</button>
                        <button onclick="handleReadGraphics('${ctrl.address}')">Read</button>
                    </div>`;
            }

            // KEEP YOUR EXISTING TYPES BELOW (unchanged)

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

            else if (ctrl.type === "float_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input type="text" id="in_${ctrl.address}">
                    <button onclick="handleFloat('${ctrl.address}')">Apply</button>
                    <button onclick="handleRead('${ctrl.address}', ${readLen}, 'float')">Read</button>`;
            }

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
// GRAPHICS WRITE
// =======================
window.handleGraphics = (baseAddr) => {
    const rot = floatToHex(document.getElementById(`rot_${baseAddr}`).value);
    const scale = floatToHex(document.getElementById(`scale_${baseAddr}`).value);
    const x = floatToHex(document.getElementById(`x_${baseAddr}`).value);
    const y = floatToHex(document.getElementById(`y_${baseAddr}`).value);

    sendRequest(baseAddr, rot);
    sendRequest(addOffset(baseAddr, 4), scale);
    sendRequest(addOffset(baseAddr, 8), x);
    sendRequest(addOffset(baseAddr, 12), y);
};

// =======================
// GRAPHICS READ
// =======================
window.handleReadGraphics = async (baseAddr) => {
    const rot = await readFloat(baseAddr);
    const scale = await readFloat(addOffset(baseAddr, 4));
    const x = await readFloat(addOffset(baseAddr, 8));
    const y = await readFloat(addOffset(baseAddr, 12));

    document.getElementById(`rot_${baseAddr}`).value = rot;
    document.getElementById(`scale_${baseAddr}`).value = scale;
    document.getElementById(`x_${baseAddr}`).value = x;
    document.getElementById(`y_${baseAddr}`).value = y;
};

// =======================
// HELPERS
// =======================
function addOffset(addr, offset) {
    return (parseInt(addr, 16) + offset).toString(16).toUpperCase();
}

async function readFloat(addr) {
    const ip = document.getElementById('ps3_ip').value;
    try {
        const res = await fetch(`http://${ip}/getmem.ps3mapi?proc=0&addr=${addr}&length=4`);
        const hex = await res.text();

        const bytes = hex.match(/.{1,2}/g).map(b => parseInt(b, 16));
        return new DataView(new Uint8Array(bytes).buffer).getFloat32(0, false);
    } catch {
        return 0;
    }
}

function floatToHex(value) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, parseFloat(value) || 0, false);
    return Array.from(new Uint8Array(view.buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('').toUpperCase();
}

function sendRequest(addr, val) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return;
    fetch(`http://${ip}/setmem.ps3mapi?proc=0&addr=${addr}&val=${val}`, { mode: 'no-cors' }).catch(() => {});
}

window.handleDropdown = (addr) => 
    sendRequest(addr, document.getElementById(`sel_${addr}`).value);

window.goBack = () => window.autoScanRTM();
