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

            // Handle text strings
            if (ctrl.type === "string_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input type="text" id="str_${ctrl.address}" maxlength="${ctrl.max_len || 16}" placeholder="Text">
                    <button onclick="handleString('${ctrl.address}', ${ctrl.max_len || 16})">Set</button>`;
            }

            // Handle color inputs
            else if (ctrl.type === "rgb_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <div class="rgb-group">
                        <input type="text" id="r_${ctrl.address}" placeholder="R" oninput="validateInput(this, 'numbers', 'float')">
                        <input type="text" id="g_${ctrl.address}" placeholder="G" oninput="validateInput(this, 'numbers', 'float')">
                        <input type="text" id="b_${ctrl.address}" placeholder="B" oninput="validateInput(this, 'numbers', 'float')">
                        <button onclick="handleRGBGroup('${ctrl.address}')">Set</button>
                    </div>`;
            } 

            // Handle values (Floats or Ints)
            else if (ctrl.type === "float_input") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <input type="text" id="in_${ctrl.address}" placeholder="${force || 'Value'}" oninput="validateInput(this, '${filter}', '${force}')">
                    <button onclick="handleFloat('${ctrl.address}', ${ctrl.is_rgb || false}, '${force}', ${mLen})">Apply</button>`;
            }

            // Handle multiple writes
            else if (ctrl.type === "multi_button") {
                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <button onclick='window.handleMultiSet(${JSON.stringify(ctrl.writes)})'>${ctrl.button_text}</button>`;
            }

            // ✅ FIXED DROPDOWN (shows name instead of hex)
            else if (ctrl.type === "dropdown") {
                let opts = ctrl.options.map(o => 
                    `<option value="${o.value}">${o.name || o.value}</option>`
                ).join('');

                row.innerHTML = `
                    <label>${ctrl.label}</label>
                    <select id="sel_${ctrl.address}">${opts}</select>
                    <button onclick="handleDropdown('${ctrl.address}')">Set</button>`;
            }

            secDiv.appendChild(row);
        });

        container.appendChild(secDiv);
    });
}

// Convert text to hex
function stringToHex(str, maxLen) {
    let hex = "";
    let cleanStr = str.substring(0, maxLen);
    for (let i = 0; i < cleanStr.length; i++) {
        hex += cleanStr.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex + "00"; 
}

// Write string data
window.handleString = (addr, maxLen) => {
    const val = document.getElementById(`str_${addr}`).value;
    const hex = stringToHex(val, maxLen);
    sendRequest(addr, hex);
};

// Pause execution helper
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// Sanitize user input
window.validateInput = (input, filter, force) => {
    let patternStr = "";

    if (filter === 'hex') {
        patternStr = "[0-9a-fA-F]*";
    } else if (filter === 'letters') {
        patternStr = "[a-zA-Z]*";
    } else if (filter === 'numbers') {
        patternStr = (force === 'int') ? "-?[0-9]*" : "-?[0-9.]*";
    } else {
        patternStr = ".*";
    }

    const pattern = new RegExp(`^${patternStr}$`);
    if (!pattern.test(input.value)) input.value = input.value.slice(0, -1);
};

// Process write sequence
window.handleMultiSet = async (writes) => {
    for (const item of writes) {
        sendRequest(item.address, item.value);
        await sleep(250); 
    }
};

// Convert float to Big Endian Hex
function floatToHex(value) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, parseFloat(value) || 0, false);
    return Array.from(new Uint8Array(view.buffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Write float or Int data
window.handleFloat = (addr, isRGB, force, maxLen) => {
    const inputVal = document.getElementById(`in_${addr}`).value;
    let hex = "";

    if (force === "int") {
        let intVal = parseInt(inputVal) || 0;
        hex = (intVal >>> 0).toString(16).toUpperCase();
        
        const targetChars = maxLen * 2;

        if (hex.length > targetChars) {
            hex = hex.slice(-targetChars);
        } else {
            hex = hex.padStart(targetChars, '0');
        }
    } else {
        hex = floatToHex(inputVal);
    }

    if (isRGB) hex = hex + hex + hex; 
    sendRequest(addr, hex);
};

// Write RGB data
window.handleRGBGroup = (addr) => {
    const r = floatToHex(document.getElementById(`r_${addr}`).value);
    const g = floatToHex(document.getElementById(`g_${addr}`).value);
    const b = floatToHex(document.getElementById(`b_${addr}`).value);
    sendRequest(addr, r + g + b); 
};

// Write dropdown selection
window.handleDropdown = (addr) => 
    sendRequest(addr, document.getElementById(`sel_${addr}`).value);

// Send MAPI request
function sendRequest(addr, val) {
    const ip = document.getElementById('ps3_ip').value;
    if (!ip) return;
    fetch(`http://${ip}/setmem.ps3mapi?proc=0&addr=${addr}&val=${val}`, { mode: 'no-cors' }).catch(() => {});
}

// Reset menu state
window.goBack = () => window.autoScanRTM();
