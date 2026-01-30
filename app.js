/**
 * 에듀집 소프트웨어 선정기준 분석기
 * Upstage Document Parse API + Chat API를 사용한 문서 분석 웹앱
 */

// ========================================
// Configuration
// ========================================
const CONFIG = {
    API_KEY: import.meta.env.VITE_UPSTAGE_API_KEY || localStorage.getItem('upstage_api_key') || '',
    PARSE_API_URL: 'https://api.upstage.ai/v1/document-digitization',
    CHAT_API_URL: 'https://api.upstage.ai/v1/solar/chat/completions',
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

    dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

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
// Document Parsing & AI Analysis
// ========================================
async function parseDocuments() {
    if (state.files.length === 0) {
        alert('파일을 먼저 업로드해주세요.');
        return;
    }

    if (!CONFIG.API_KEY) {
        alert('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        openSettings();
        return;
    }

    elements.progressSection.classList.remove('hidden');
    elements.parseBtn.disabled = true;
    elements.progressLog.innerHTML = '';
    state.rawResponses = [];
    state.results = [];

    const totalFiles = state.files.length;
    let processedFiles = 0;

    for (const file of state.files) {
        try {
            // Step 1: Parse document
            logProgress(`📤 "${file.name}" 문서 파싱 중...`, 'info');
            const parseResult = await parseDocument(file);

            // Step 2: Analyze with AI
            logProgress(`🤖 "${file.name}" AI 분석 중...`, 'info');
            const analysisResult = await analyzeDocumentWithAI(parseResult, file.name);

            state.rawResponses.push({
                filename: file.name,
                parseResponse: parseResult,
                analysisResponse: analysisResult
            });

            // Add to results
            if (analysisResult) {
                state.results.push({
                    연번: (state.results.length + 1).toString(),
                    ...analysisResult
                });
            }

            processedFiles++;
            updateProgress(processedFiles, totalFiles);
            logProgress(`✅ "${file.name}" 분석 완료`, 'success');

        } catch (error) {
            console.error('Parse error:', error);

            if (error.message.includes('401') || error.message.includes('api_key')) {
                logProgress(`❌ API 키 오류: 크레딧 부족 또는 유효하지 않은 API 키`, 'error');
            } else {
                logProgress(`❌ "${file.name}" 분석 실패: ${error.message}`, 'error');
            }

            processedFiles++;
            updateProgress(processedFiles, totalFiles);
        }
    }

    elements.parseBtn.disabled = false;
    renderResults();
    showRawData();

    if (state.results.length > 0) {
        logProgress(`🎉 ${state.results.length}개 소프트웨어 분석 완료!`, 'success');
    }
}

async function parseDocument(file) {
    const formData = new FormData();
    formData.append('model', 'document-parse');
    formData.append('document', file);
    formData.append('ocr', 'force');
    formData.append('output_formats', "['text', 'markdown']");
    formData.append('mode', 'enhanced');

    const response = await fetch(CONFIG.PARSE_API_URL, {
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

async function analyzeDocumentWithAI(parseResult, filename) {
    const documentText = parseResult.content?.text || parseResult.content?.markdown || '';

    if (!documentText.trim()) {
        throw new Error('문서에서 텍스트를 추출하지 못했습니다.');
    }

    const prompt = `다음은 학습지원 소프트웨어 선정기준 체크리스트 문서입니다. 이 문서를 분석하여 아래 정보를 JSON 형식으로 추출해주세요.

문서 내용:
${documentText.substring(0, 8000)}

추출해야 할 정보:
1. 소프트웨어명: 문서에서 언급된 학습지원 소프트웨어 이름
2. 공급자: 소프트웨어를 제공하는 회사/기관명
3. 유형: 소프트웨어 유형 (예: 학습관리, 콘텐츠, 코딩교육 등)
4. 주요용도: 소프트웨어의 주요 사용 목적

필수기준 충족 여부 (각 항목별로 "충족", "미충족", "해당없음" 중 하나로 답변):
- 1-1: 개인정보가 최소한으로 수집되는가?
- 1-2: 개인정보 수집·이용 목적이 기재되어 있는가?
- 1-3: 개인정보 수집항목, 보유기간 등이 기재되어 있는가?
- 2: 개인정보 안전성 확보에 필요한 조치사항이 기재되어 있는가?
- 3: 이용자에게 열람·정정·삭제·처리정지를 요구할 수 있는 절차가 안내되어 있는가?
- 4: 만 14세 미만 아동의 개인정보 보호를 위한 절차가 마련되어 있는가?
- 5-1: 개인정보 보호책임자 관련 정보가 안내되어 있는가?
- 5-2: 개인정보 제3자 제공에 관한 정보가 기재되어 있는가?
- 5-3: 개인정보 위·수탁관계에 관한 정보가 기재되어 있는가?

반드시 아래 JSON 형식으로만 응답해주세요:
{
  "소프트웨어명": "...",
  "공급자": "...",
  "유형": "...",
  "주요용도": "...",
  "1-1": "충족",
  "1-2": "충족",
  "1-3": "충족",
  "2": "충족",
  "3": "충족",
  "4": "충족",
  "5-1": "충족",
  "5-2": "충족",
  "5-3": "충족"
}`;

    const response = await fetch(CONFIG.CHAT_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'solar-pro',
            messages: [
                {
                    role: 'system',
                    content: '당신은 학습지원 소프트웨어 선정기준 분석 전문가입니다. 문서를 분석하여 정확한 정보를 JSON 형식으로 추출합니다.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI 분석 오류: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Convert 충족/미충족 to O/X
            const criteria = ['1-1', '1-2', '1-3', '2', '3', '4', '5-1', '5-2', '5-3'];
            criteria.forEach(key => {
                if (parsed[key]) {
                    const val = parsed[key].toLowerCase();
                    if (val.includes('충족') && !val.includes('미')) {
                        parsed[key] = 'O';
                    } else if (val.includes('미충족') || val.includes('부적합')) {
                        parsed[key] = 'X';
                    } else if (val.includes('해당없음') || val.includes('해당 없음')) {
                        parsed[key] = '-';
                    } else {
                        parsed[key] = parsed[key];
                    }
                }
            });
            return parsed;
        }
    } catch (e) {
        console.error('JSON parse error:', e);
    }

    // Fallback: create entry with filename
    return {
        소프트웨어명: filename.replace(/\.[^/.]+$/, ''),
        공급자: '',
        유형: '',
        주요용도: '',
        '1-1': '', '1-2': '', '1-3': '', '2': '', '3': '', '4': '', '5-1': '', '5-2': '', '5-3': ''
    };
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
// Results Processing
// ========================================
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
            <td>${row.소프트웨어명 || ''}</td>
            <td>${row.공급자 || ''}</td>
            <td>${row.유형 || ''}</td>
            <td>${row.주요용도 || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['1-1'])}">${row['1-1'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['1-2'])}">${row['1-2'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['1-3'])}">${row['1-3'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['2'])}">${row['2'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['3'])}">${row['3'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['4'])}">${row['4'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['5-1'])}">${row['5-1'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['5-2'])}">${row['5-2'] || ''}</td>
            <td class="criteria-cell ${getCriteriaClass(row['5-3'])}">${row['5-3'] || ''}</td>
            <td class="action-btns">
                <button class="btn btn-icon" onclick="editRow(${index})" title="편집">✏️</button>
                <button class="btn btn-icon" onclick="deleteRow(${index})" title="삭제">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function getCriteriaClass(value) {
    if (value === 'O' || value === '충족') return 'criteria-pass';
    if (value === 'X' || value === '미충족') return 'criteria-fail';
    if (value === '-') return 'criteria-na';
    return '';
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
            <details>
                <summary>파싱 결과</summary>
                <pre>${JSON.stringify(item.parseResponse, null, 2)}</pre>
            </details>
            <details>
                <summary>AI 분석 결과</summary>
                <pre>${JSON.stringify(item.analysisResponse, null, 2)}</pre>
            </details>
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
                        <option value="O" ${row[c] === 'O' ? 'selected' : ''}>O (충족)</option>
                        <option value="X" ${row[c] === 'X' ? 'selected' : ''}>X (미충족)</option>
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
        '1-1': '', '1-2': '', '1-3': '', '2': '', '3': '', '4': '', '5-1': '', '5-2': '', '5-3': ''
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
    elements.newSessionBtn.addEventListener('click', () => {
        if (confirm('새 세션을 시작하시겠습니까? 현재 데이터가 초기화됩니다.')) {
            initSession();
        }
    });

    elements.clearFilesBtn.addEventListener('click', clearFiles);
    elements.parseBtn.addEventListener('click', parseDocuments);

    elements.downloadCsvBtn.addEventListener('click', downloadCSV);
    elements.copyTableBtn.addEventListener('click', copyTable);
    elements.addRowBtn.addEventListener('click', addNewRow);

    elements.saveEditBtn.addEventListener('click', saveEdit);
    elements.cancelEditBtn.addEventListener('click', closeModal);
    elements.editModal.querySelector('.modal-close').addEventListener('click', closeModal);
    elements.editModal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    elements.settingsBtn.addEventListener('click', openSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.cancelSettingsBtn.addEventListener('click', closeSettings);
    elements.settingsModal.querySelector('.modal-close').addEventListener('click', closeSettings);
    elements.settingsModal.querySelector('.modal-overlay').addEventListener('click', closeSettings);

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

document.addEventListener('DOMContentLoaded', init);

window.editRow = editRow;
window.deleteRow = deleteRow;
