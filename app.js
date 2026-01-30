/**
 * 에듀집 소프트웨어 선정기준 분석기
 * Upstage Document Parse API를 사용한 문서 분석 웹앱
 */

// ========================================
// Configuration
// ========================================
const CONFIG = {
    API_KEY: import.meta.env.VITE_UPSTAGE_API_KEY || localStorage.getItem('upstage_api_key') || '',
    API_URL: 'https://api.upstage.ai/v1/document-digitization',
    SUPPORTED_FORMATS: ['.pdf', '.hwp'],
    REQUIRED_CRITERIA: ['1-1', '1-2', '1-3', '2', '3', '4', '5-1', '5-2', '5-3']
};



// ========================================
// State Management
// ========================================
const state = {
    sessionId: null,
    files: [],
    parsedData: [],
    results: [],
    rawResponses: []
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    sessionId: document.getElementById('sessionId'),
    newSessionBtn: document.getElementById('newSessionBtn'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    fileList: document.getElementById('fileList'),
    uploadedFiles: document.getElementById('uploadedFiles'),
    parseBtn: document.getElementById('parseBtn'),
    clearFilesBtn: document.getElementById('clearFilesBtn'),
    progressSection: document.getElementById('progressSection'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressLog: document.getElementById('progressLog'),
    resultsSection: document.getElementById('resultsSection'),
    resultsBody: document.getElementById('resultsBody'),
    downloadCsvBtn: document.getElementById('downloadCsvBtn'),
    copyTableBtn: document.getElementById('copyTableBtn'),
    addRowBtn: document.getElementById('addRowBtn'),
    rawDataSection: document.getElementById('rawDataSection'),
    rawDataContent: document.getElementById('rawDataContent'),
    editModal: document.getElementById('editModal'),
    editModalBody: document.getElementById('editModalBody'),
    saveEditBtn: document.getElementById('saveEditBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn')
};

// ========================================
// Session Management
// ========================================
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}

function initSession() {
    state.sessionId = generateSessionId();
    elements.sessionId.textContent = state.sessionId;
    resetState();

    // Load saved API key
    const savedKey = localStorage.getItem('upstage_api_key');
    if (savedKey) {
        CONFIG.API_KEY = savedKey;
        elements.apiKeyInput.value = savedKey;
    }
}

function resetState() {
    state.files = [];
    state.parsedData = [];
    state.results = [];
    state.rawResponses = [];
    updateUI();
}

// ========================================
// File Upload Handling
// ========================================
function setupDropZone() {
    const dropZone = elements.dropZone;

    // Click to upload
    dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // File input change
    elements.fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return CONFIG.SUPPORTED_FORMATS.includes(ext);
    });

    if (validFiles.length === 0) {
        alert('지원되는 파일 형식(PDF, HWP)이 아닙니다.');
        return;
    }

    state.files = [...state.files, ...validFiles];
    updateFileList();
}

function updateFileList() {
    if (state.files.length === 0) {
        elements.fileList.classList.add('hidden');
        return;
    }

    elements.fileList.classList.remove('hidden');
    elements.uploadedFiles.innerHTML = state.files.map((file, index) => `
        <li>
            <div class="file-name">
                <span>📄</span>
                <span>${file.name}</span>
            </div>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </li>
    `).join('');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearFiles() {
    state.files = [];
    elements.fileInput.value = '';
    updateFileList();
}

// ========================================
// Demo Mode
// ========================================
function loadDemoData() {
    CONFIG.DEMO_MODE = true;
    state.parsedData = [...DEMO_DATA];
    state.results = [...DEMO_DATA];
    state.rawResponses = [{
        filename: 'demo_data.json',
        response: { demo: true, data: DEMO_DATA }
    }];

    elements.resultsSection.classList.remove('hidden');
    renderResults();
    showRawData();

    alert('📋 데모 데이터가 로드되었습니다.\n\n수동으로 항목을 추가하거나 편집한 후 CSV로 다운로드할 수 있습니다.');
}

// ========================================
// Document Parsing
// ========================================
async function parseDocuments() {
    if (state.files.length === 0) {
        alert('파일을 먼저 업로드해주세요.');
        return;
    }

    // Check API key
    if (!CONFIG.API_KEY) {
        const useDemo = confirm('API 키가 설정되지 않았습니다.\n\n[확인] - 수동 입력 모드로 시작 (파일 업로드 건너뛰기)\n[취소] - 설정에서 API 키 입력\n\n수동 입력 모드에서는 데이터를 직접 추가할 수 있습니다.');
        if (useDemo) {
            // Enable manual mode - show empty results for manual entry
            state.results = [];
            elements.resultsSection.classList.remove('hidden');
            renderResults();
            return;
        } else {
            openSettings();
            return;
        }
    }

    // Show progress
    elements.progressSection.classList.remove('hidden');
    elements.parseBtn.disabled = true;
    elements.progressLog.innerHTML = '';
    state.rawResponses = [];

    const totalFiles = state.files.length;
    let processedFiles = 0;
    let hasApiError = false;

    for (const file of state.files) {
        try {
            logProgress(`📤 "${file.name}" 분석 중...`, 'info');

            const result = await parseDocument(file);
            state.rawResponses.push({ filename: file.name, response: result });

            // Extract data from parsed result
            const extractedData = extractDataFromResponse(result, file.name);
            state.parsedData.push(...extractedData);

            processedFiles++;
            updateProgress(processedFiles, totalFiles);
            logProgress(`✅ "${file.name}" 분석 완료`, 'success');

        } catch (error) {
            console.error('Parse error:', error);

            // Check for specific API errors
            if (error.message.includes('401') || error.message.includes('api_key')) {
                logProgress(`❌ API 키 오류: 크레딧 부족 또는 유효하지 않은 API 키`, 'error');
                logProgress(`💡 https://console.upstage.ai/billing 에서 결제 정보를 등록하세요.`, 'info');
                hasApiError = true;
            } else {
                logProgress(`❌ "${file.name}" 분석 실패: ${error.message}`, 'error');
            }

            processedFiles++;
            updateProgress(processedFiles, totalFiles);
        }
    }

    // Process results
    processResults();
    elements.parseBtn.disabled = false;

    if (hasApiError) {
        logProgress('⚠️ API 오류가 발생했습니다. 수동으로 데이터를 추가해주세요.', 'error');
        const useDemoData = confirm('API 오류가 발생했습니다.\n\n데모 데이터를 로드하여 기능을 테스트하시겠습니까?\n(확인: 데모 데이터 로드 / 취소: 수동 입력)');
        if (useDemoData) {
            loadDemoData();
        } else {
            elements.resultsSection.classList.remove('hidden');
        }
    } else {
        logProgress('🎉 모든 문서 분석 완료!', 'success');
    }
}

async function parseDocument(file) {
    const formData = new FormData();
    formData.append('model', 'document-parse');
    formData.append('document', file);
    formData.append('ocr', 'force');
    formData.append('output_formats', "['html', 'markdown', 'text']");
    formData.append('mode', 'enhanced');
    formData.append('chart_recognition', 'true');

    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API 오류: ${response.status}`;

        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.message) {
                errorMessage = errorJson.error.message;
            }
        } catch (e) {
            errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
    }

    return await response.json();
}

function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `${current} / ${total} 파일 처리 완료`;
}

function logProgress(message, type = 'info') {
    const p = document.createElement('p');
    p.className = type;
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    elements.progressLog.appendChild(p);
    elements.progressLog.scrollTop = elements.progressLog.scrollHeight;
}

// ========================================
// Data Extraction
// ========================================
function extractDataFromResponse(response, filename) {
    const results = [];

    // Get HTML and text content
    const htmlContent = response.content?.html || '';
    const textContent = response.content?.text || '';
    const markdownContent = response.content?.markdown || '';

    // Try to find table data in elements
    const tableElements = response.elements?.filter(el =>
        el.category === 'table' ||
        el.category === 'list'
    ) || [];

    // Parse table HTML to extract rows
    for (const element of tableElements) {
        const tableHtml = element.content?.html || '';
        const tableRows = parseTableHtml(tableHtml);
        results.push(...tableRows);
    }

    // If no table found, try to parse from full HTML content
    if (results.length === 0) {
        const allRows = parseTableHtml(htmlContent);
        results.push(...allRows);
    }

    // If still no data, create a raw entry
    if (results.length === 0 && (htmlContent || textContent)) {
        results.push({
            filename: filename,
            rawHtml: htmlContent,
            rawText: textContent,
            rawMarkdown: markdownContent,
            needsManualReview: true
        });
    }

    return results;
}

function parseTableHtml(html) {
    const results = [];

    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Find all table rows
    const rows = temp.querySelectorAll('tr');

    for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 5) {
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());

            // Try to map to our schema
            const entry = mapRowToSchema(rowData);
            if (entry) {
                results.push(entry);
            }
        }
    }

    return results;
}

function mapRowToSchema(rowData) {
    // Skip header rows
    if (rowData[0] === '연번' || rowData[0] === '순번' || rowData[0] === 'No') {
        return null;
    }

    // Skip empty rows
    if (rowData.every(cell => !cell || cell.trim() === '')) {
        return null;
    }

    // Try to detect the structure
    // Expected: 연번, 소프트웨어명, 공급자, 유형, 주요용도, 1-1, 1-2, 1-3, 2, 3, 4, 5-1, 5-2, 5-3

    const entry = {
        연번: rowData[0] || '',
        소프트웨어명: rowData[1] || '',
        공급자: rowData[2] || '',
        유형: rowData[3] || '',
        주요용도: rowData[4] || '',
        '1-1': parseCheckValue(rowData[5]),
        '1-2': parseCheckValue(rowData[6]),
        '1-3': parseCheckValue(rowData[7]),
        '2': parseCheckValue(rowData[8]),
        '3': parseCheckValue(rowData[9]),
        '4': parseCheckValue(rowData[10]),
        '5-1': parseCheckValue(rowData[11]),
        '5-2': parseCheckValue(rowData[12]),
        '5-3': parseCheckValue(rowData[13])
    };

    return entry;
}

function parseCheckValue(value) {
    if (!value) return '';
    value = value.trim().toLowerCase();

    // Check for various representations of checked/unchecked
    if (value === 'o' || value === '○' || value === '●' || value === 'v' ||
        value === '✓' || value === '✔' || value === 'yes' || value === 'y' ||
        value === '적합' || value === '충족' || value === '해당') {
        return 'O';
    }
    if (value === 'x' || value === '×' || value === '✗' || value === 'no' ||
        value === 'n' || value === '부적합' || value === '미충족' || value === '해당없음') {
        return 'X';
    }
    if (value === '-' || value === 'n/a' || value === 'na') {
        return '-';
    }

    return value;
}

// ========================================
// Results Processing
// ========================================
function processResults() {
    // Filter out entries that need manual review
    const validEntries = state.parsedData.filter(entry => !entry.needsManualReview);
    const reviewEntries = state.parsedData.filter(entry => entry.needsManualReview);

    // Number the entries
    state.results = validEntries.map((entry, index) => ({
        ...entry,
        연번: entry.연번 || (index + 1).toString()
    }));

    // Show results
    renderResults();
    showRawData();

    if (reviewEntries.length > 0) {
        alert(`${reviewEntries.length}개 파일은 테이블 형식을 자동 인식하지 못했습니다. 원본 데이터를 확인하고 수동으로 추가해주세요.`);
    }
}

function renderResults() {
    elements.resultsSection.classList.remove('hidden');

    if (state.results.length === 0) {
        elements.resultsBody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📝</div>
                    <p>데이터가 없습니다.</p>
                    <p style="font-size: 0.875rem; margin-top: 8px;">아래 "수동으로 항목 추가" 버튼을 클릭하여 데이터를 추가하세요.</p>
                </td>
            </tr>
        `;
        return;
    }

    elements.resultsBody.innerHTML = state.results.map((row, index) => `
        <tr data-index="${index}">
            <td>${row.연번}</td>
            <td>${row.소프트웨어명}</td>
            <td>${row.공급자}</td>
            <td>${row.유형}</td>
            <td>${row.주요용도}</td>
            <td><input type="checkbox" ${row['1-1'] === 'O' ? 'checked' : ''} data-field="1-1"></td>
            <td><input type="checkbox" ${row['1-2'] === 'O' ? 'checked' : ''} data-field="1-2"></td>
            <td><input type="checkbox" ${row['1-3'] === 'O' ? 'checked' : ''} data-field="1-3"></td>
            <td><input type="checkbox" ${row['2'] === 'O' ? 'checked' : ''} data-field="2"></td>
            <td><input type="checkbox" ${row['3'] === 'O' ? 'checked' : ''} data-field="3"></td>
            <td><input type="checkbox" ${row['4'] === 'O' ? 'checked' : ''} data-field="4"></td>
            <td><input type="checkbox" ${row['5-1'] === 'O' ? 'checked' : ''} data-field="5-1"></td>
            <td><input type="checkbox" ${row['5-2'] === 'O' ? 'checked' : ''} data-field="5-2"></td>
            <td><input type="checkbox" ${row['5-3'] === 'O' ? 'checked' : ''} data-field="5-3"></td>
            <td class="action-btns">
                <button class="btn btn-icon" onclick="editRow(${index})" title="편집">✏️</button>
                <button class="btn btn-icon" onclick="deleteRow(${index})" title="삭제">🗑️</button>
            </td>
        </tr>
    `).join('');

    // Add checkbox change listeners
    elements.resultsBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            const index = parseInt(row.dataset.index);
            const field = e.target.dataset.field;
            state.results[index][field] = e.target.checked ? 'O' : 'X';
        });
    });
}

function showRawData() {
    if (state.rawResponses.length === 0) {
        elements.rawDataSection.classList.add('hidden');
        return;
    }

    elements.rawDataSection.classList.remove('hidden');

    elements.rawDataContent.innerHTML = state.rawResponses.map(item => `
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">📄 ${item.filename}</h4>
            <pre>${JSON.stringify(item.response, null, 2)}</pre>
        </div>
    `).join('');
}

// ========================================
// Row Actions
// ========================================
let editingIndex = null;

function editRow(index) {
    editingIndex = index;
    const row = state.results[index];

    elements.editModalBody.innerHTML = `
        <div class="form-group">
            <label>연번</label>
            <input type="text" id="edit-연번" value="${row.연번 || ''}">
        </div>
        <div class="form-group">
            <label>학습지원 소프트웨어명</label>
            <input type="text" id="edit-소프트웨어명" value="${row.소프트웨어명 || ''}">
        </div>
        <div class="form-group">
            <label>공급자</label>
            <input type="text" id="edit-공급자" value="${row.공급자 || ''}">
        </div>
        <div class="form-group">
            <label>유형</label>
            <input type="text" id="edit-유형" value="${row.유형 || ''}">
        </div>
        <div class="form-group">
            <label>주요용도</label>
            <input type="text" id="edit-주요용도" value="${row.주요용도 || ''}">
        </div>
        <h4 style="margin: 16px 0 8px 0;">필수기준</h4>
        <div class="form-row">
            ${CONFIG.REQUIRED_CRITERIA.map(c => `
                <div class="form-group">
                    <label>${c}</label>
                    <select id="edit-${c}">
                        <option value="O" ${row[c] === 'O' ? 'selected' : ''}>O (적합)</option>
                        <option value="X" ${row[c] === 'X' ? 'selected' : ''}>X (부적합)</option>
                        <option value="-" ${row[c] === '-' ? 'selected' : ''}>- (해당없음)</option>
                        <option value="" ${!row[c] ? 'selected' : ''}>(미정)</option>
                    </select>
                </div>
            `).join('')}
        </div>
    `;

    elements.editModal.classList.remove('hidden');
}

function saveEdit() {
    if (editingIndex === null) return;

    state.results[editingIndex] = {
        연번: document.getElementById('edit-연번').value,
        소프트웨어명: document.getElementById('edit-소프트웨어명').value,
        공급자: document.getElementById('edit-공급자').value,
        유형: document.getElementById('edit-유형').value,
        주요용도: document.getElementById('edit-주요용도').value,
        '1-1': document.getElementById('edit-1-1').value,
        '1-2': document.getElementById('edit-1-2').value,
        '1-3': document.getElementById('edit-1-3').value,
        '2': document.getElementById('edit-2').value,
        '3': document.getElementById('edit-3').value,
        '4': document.getElementById('edit-4').value,
        '5-1': document.getElementById('edit-5-1').value,
        '5-2': document.getElementById('edit-5-2').value,
        '5-3': document.getElementById('edit-5-3').value
    };

    closeModal();
    renderResults();
}

function deleteRow(index) {
    if (confirm('이 항목을 삭제하시겠습니까?')) {
        state.results.splice(index, 1);
        // Renumber
        state.results.forEach((row, i) => {
            row.연번 = (i + 1).toString();
        });
        renderResults();
    }
}

function addNewRow() {
    const newRow = {
        연번: (state.results.length + 1).toString(),
        소프트웨어명: '',
        공급자: '',
        유형: '',
        주요용도: '',
        '1-1': '',
        '1-2': '',
        '1-3': '',
        '2': '',
        '3': '',
        '4': '',
        '5-1': '',
        '5-2': '',
        '5-3': ''
    };

    state.results.push(newRow);
    renderResults();
    editRow(state.results.length - 1);
}

function closeModal() {
    elements.editModal.classList.add('hidden');
    editingIndex = null;
}

// ========================================
// Settings
// ========================================
function openSettings() {
    elements.settingsModal.classList.remove('hidden');
    elements.apiKeyInput.value = CONFIG.API_KEY || '';
}

function closeSettings() {
    elements.settingsModal.classList.add('hidden');
}

function saveSettings() {
    const apiKey = elements.apiKeyInput.value.trim();
    CONFIG.API_KEY = apiKey;
    localStorage.setItem('upstage_api_key', apiKey);
    closeSettings();
    alert('설정이 저장되었습니다.');
}

// ========================================
// CSV Export
// ========================================
function downloadCSV() {
    if (state.results.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
    }

    // Create CSV content with BOM for UTF-8
    const BOM = '\uFEFF';
    const headers = ['연번', '학습지원 소프트웨어명', '공급자', '유형', '주요용도', '1-1', '1-2', '1-3', '2', '3', '4', '5-1', '5-2', '5-3'];

    const rows = state.results.map(row => [
        row.연번,
        row.소프트웨어명,
        row.공급자,
        row.유형,
        row.주요용도,
        row['1-1'],
        row['1-2'],
        row['1-3'],
        row['2'],
        row['3'],
        row['4'],
        row['5-1'],
        row['5-2'],
        row['5-3']
    ]);

    const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `에듀집_선정기준_${state.sessionId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function copyTable() {
    if (state.results.length === 0) {
        alert('복사할 데이터가 없습니다.');
        return;
    }

    const headers = ['연번', '학습지원 소프트웨어명', '공급자', '유형', '주요용도', '1-1', '1-2', '1-3', '2', '3', '4', '5-1', '5-2', '5-3'];

    const rows = state.results.map(row => [
        row.연번,
        row.소프트웨어명,
        row.공급자,
        row.유형,
        row.주요용도,
        row['1-1'],
        row['1-2'],
        row['1-3'],
        row['2'],
        row['3'],
        row['4'],
        row['5-1'],
        row['5-2'],
        row['5-3']
    ]);

    const text = [
        headers.join('\t'),
        ...rows.map(row => row.join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
        alert('테이블이 클립보드에 복사되었습니다. 엑셀에 붙여넣기(Ctrl+V)하세요.');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('복사에 실패했습니다.');
    });
}

// ========================================
// UI Updates
// ========================================
function updateUI() {
    updateFileList();
    if (state.results.length === 0) {
        elements.resultsSection.classList.add('hidden');
        elements.rawDataSection.classList.add('hidden');
        elements.progressSection.classList.add('hidden');
    }
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Session
    elements.newSessionBtn.addEventListener('click', () => {
        if (confirm('새 세션을 시작하시겠습니까? 현재 데이터가 초기화됩니다.')) {
            initSession();
        }
    });

    // Files
    elements.clearFilesBtn.addEventListener('click', clearFiles);
    elements.parseBtn.addEventListener('click', parseDocuments);

    // Results
    elements.downloadCsvBtn.addEventListener('click', downloadCSV);
    elements.copyTableBtn.addEventListener('click', copyTable);
    elements.addRowBtn.addEventListener('click', addNewRow);

    // Edit Modal
    elements.saveEditBtn.addEventListener('click', saveEdit);
    elements.cancelEditBtn.addEventListener('click', closeModal);
    elements.editModal.querySelector('.modal-close').addEventListener('click', closeModal);
    elements.editModal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Settings Modal
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.cancelSettingsBtn.addEventListener('click', closeSettings);
    elements.settingsModal.querySelector('.modal-close').addEventListener('click', closeSettings);
    elements.settingsModal.querySelector('.modal-overlay').addEventListener('click', closeSettings);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!elements.editModal.classList.contains('hidden')) {
                closeModal();
            }
            if (!elements.settingsModal.classList.contains('hidden')) {
                closeSettings();
            }
        }
    });
}

// ========================================
// Initialization
// ========================================
function init() {
    setupDropZone();
    setupEventListeners();
    initSession();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// Expose functions to global scope for inline handlers
window.editRow = editRow;
window.deleteRow = deleteRow;
