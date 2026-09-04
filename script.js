/**
 * SpiSnap — Storage Engine with IndexedDB & LocalStorage Fallback
 */
class SpiSnapStorage {
    constructor() {
        this.dbName = 'SpiSnap_DB';
        this.storeName = 'students';
        this.db = null;
    }

    async init() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB unavailable. Falling back to LocalStorage.');
                resolve(false);
                return;
            }

            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'enrollment' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(true);
            };
            request.onerror = () => resolve(false);
        });
    }

    async getAll() {
        if (this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve(this.getFallback());
            });
        }
        return this.getFallback();
    }

    async save(student) {
        student.updatedAt = Date.now();
        if (this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.put(student);
                request.onsuccess = () => {
                    this.syncFallback();
                    resolve(true);
                };
                request.onerror = () => {
                    this.saveFallback(student);
                    resolve(false);
                };
            });
        } else {
            this.saveFallback(student);
        }
    }

    async delete(enrollment) {
        if (this.db) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.delete(enrollment);
                request.onsuccess = () => {
                    this.syncFallback();
                    resolve(true);
                };
                request.onerror = () => {
                    this.deleteFallback(enrollment);
                    resolve(false);
                };
            });
        } else {
            this.deleteFallback(enrollment);
        }
    }

    getFallback() {
        try {
            return JSON.parse(localStorage.getItem('spisnap_students') || '[]');
        } catch {
            return [];
        }
    }

    saveFallback(student) {
        const list = this.getFallback();
        const idx = list.findIndex(s => s.enrollment === student.enrollment);
        if (idx >= 0) list[idx] = student;
        else list.push(student);
        localStorage.setItem('spisnap_students', JSON.stringify(list));
    }

    deleteFallback(enrollment) {
        const list = this.getFallback().filter(s => s.enrollment !== enrollment);
        localStorage.setItem('spisnap_students', JSON.stringify(list));
    }

    async syncFallback() {
        const all = await this.getAll();
        localStorage.setItem('spisnap_students', JSON.stringify(all));
    }
}

/**
 * SpiSnap Main Application Controller
 */
const SpiSnapApp = (() => {
    const storage = new SpiSnapStorage();
    let studentStore = [];
    let filteredStore = [];
    let debounceTimer = null;
    let scrollPosition = 0; // Tracks scroll position for seamless body lock

    // Required CSV Headers
    const CSV_HEADERS = [
        "Enrollment_No", "Student_Name",
        "SPI_Sem1", "Backlog_Sem1", "Status_Sem1",
        "SPI_Sem2", "Backlog_Sem2", "Status_Sem2",
        "SPI_Sem3", "Backlog_Sem3", "Status_Sem3",
        "SPI_Sem4", "Backlog_Sem4", "Status_Sem4",
        "Current_CGPA"
    ];

    // DOM References
    let historyGrid, searchInput, filterStatus, sortBy, studentForm;

    async function init() {
        historyGrid = document.getElementById('history-grid');
        searchInput = document.getElementById('search-input');
        filterStatus = document.getElementById('filter-status');
        sortBy = document.getElementById('sort-by');
        studentForm = document.getElementById('student-form');

        registerServiceWorker();
        await storage.init();
        await loadData();
        setupEventListeners();
        checkAutoDraft();
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }
    }

    async function loadData() {
        studentStore = await storage.getAll();
        applyFiltersAndRender();
    }

    /* Core Calculation Logic */
    function enforceStatusLogic(semIndex) {
        const backlogInput = document.getElementById(`backlog${semIndex}`);
        const statusSelect = document.getElementById(`status${semIndex}`);
        const backlogValue = parseInt(backlogInput.value) || 0;

        Array.from(statusSelect.options).forEach(opt => {
            if (backlogValue === 0) {
                opt.disabled = (opt.value !== 'No Backlog');
            } else {
                opt.disabled = (opt.value === 'No Backlog');
            }
        });

        if (backlogValue === 0) {
            statusSelect.value = 'No Backlog';
        } else if (statusSelect.value === 'No Backlog') {
            statusSelect.value = 'Pending';
        }
    }

    function computeOverallStatus(s) {
        const hasPendingStatus = [s.status1, s.status2, s.status3, s.status4].some(st => st === 'Pending');
        return hasPendingStatus ? 'Pending' : 'Cleared';
    }

    function calculateAutoCGPA(s) {
        const spis = [s.spi1, s.spi2, s.spi3, s.spi4]
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v) && v > 0);
        if (spis.length === 0) return "0.00";
        const avg = spis.reduce((a, b) => a + b, 0) / spis.length;
        return avg.toFixed(2);
    }

    function getInitials(name) {
        if (!name) return 'ST';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    /* Filter, Sort & Debounced Search */
    function applyFiltersAndRender() {
        const query = searchInput.value.toLowerCase().trim();
        const statusVal = filterStatus.value;
        const sortVal = sortBy.value;

        filteredStore = studentStore.filter(s => {
            const overall = computeOverallStatus(s);
            const matchesSearch = s.name.toLowerCase().includes(query) ||
                                  s.enrollment.toLowerCase().includes(query) ||
                                  String(s.cgpa).includes(query) ||
                                  overall.toLowerCase().includes(query);
            const matchesStatus = (statusVal === 'ALL') || (overall === statusVal);
            return matchesSearch && matchesStatus;
        });

        filteredStore.sort((a, b) => {
            if (sortVal === 'updated-desc') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
            if (sortVal === 'cgpa-desc') return parseFloat(b.cgpa || 0) - parseFloat(a.cgpa || 0);
            if (sortVal === 'cgpa-asc') return parseFloat(a.cgpa || 0) - parseFloat(b.cgpa || 0);
            if (sortVal === 'enrollment-asc') return a.enrollment.localeCompare(b.enrollment);
            return 0;
        });

        renderDashboardKPIs();
        renderHistoryCards();
    }

    function debouncedSearch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            applyFiltersAndRender();
        }, 150);
    }

    /* Render KPI Cards */
    function renderDashboardKPIs() {
        const total = studentStore.length;
        document.getElementById('kpi-total').innerText = total;

        if (total === 0) {
            document.getElementById('kpi-cgpa').innerText = '0.00';
            document.getElementById('kpi-pass-rate').innerText = '0%';
            document.getElementById('kpi-backlogs').innerText = '0';
            return;
        }

        const totalCGPA = studentStore.reduce((acc, s) => acc + (parseFloat(s.cgpa) || 0), 0);
        const avgCGPA = (totalCGPA / total).toFixed(2);

        const clearedCount = studentStore.filter(s => computeOverallStatus(s) === 'Cleared').length;
        const passRate = Math.round((clearedCount / total) * 100);

        const totalBacklogs = studentStore.reduce((acc, s) => {
            return acc + (Number(s.backlog1 || 0) + Number(s.backlog2 || 0) + Number(s.backlog3 || 0) + Number(s.backlog4 || 0));
        }, 0);

        document.getElementById('kpi-cgpa').innerText = avgCGPA;
        document.getElementById('kpi-pass-rate').innerText = `${passRate}%`;
        document.getElementById('kpi-backlogs').innerText = totalBacklogs;
    }

    /* Render History Profile Cards */
    function renderHistoryCards() {
        historyGrid.innerHTML = '';

        if (filteredStore.length === 0) {
            historyGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--color-primary-dark);">No Student Records Found</h3>
                    <p style="color: var(--text-tertiary); font-size: 0.9rem;">Try clearing search filters or add a new student profile.</p>
                </div>
            `;
            return;
        }

        filteredStore.forEach(s => {
            const overallStatus = computeOverallStatus(s);
            const chipClass = overallStatus === 'Cleared' ? 'chip-cleared' : 'chip-pending';
            const dateStr = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <div>
                    <div class="card-top">
                        <div class="avatar">${getInitials(s.name)}</div>
                        <div class="student-meta">
                            <div class="student-name" title="${s.name}">${s.name}</div>
                            <div class="student-enrollment">${s.enrollment}</div>
                        </div>
                        <span class="chip ${chipClass}">${overallStatus}</span>
                    </div>

                    <div class="cgpa-container">
                        <span class="cgpa-label">Current CGPA</span>
                        <span class="cgpa-val">${parseFloat(s.cgpa || 0).toFixed(2)}</span>
                    </div>

                    <div class="sem-matrix">
                        <div class="sem-pill"><span class="sem-pill-num">Sem 1:</span> <span class="sem-pill-spi">${s.spi1 || '—'}</span></div>
                        <div class="sem-pill"><span class="sem-pill-num">Sem 2:</span> <span class="sem-pill-spi">${s.spi2 || '—'}</span></div>
                        <div class="sem-pill"><span class="sem-pill-num">Sem 3:</span> <span class="sem-pill-spi">${s.spi3 || '—'}</span></div>
                        <div class="sem-pill"><span class="sem-pill-num">Sem 4:</span> <span class="sem-pill-spi">${s.spi4 || '—'}</span></div>
                    </div>
                </div>

                <div class="card-footer">
                    <span class="last-updated">Updated ${dateStr}</span>
                    <div class="card-actions">
                        <button class="btn btn-secondary btn-icon" onclick="SpiSnapApp.viewTimeline('${s.enrollment}')" aria-label="View Student Analytics">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button class="btn btn-secondary btn-icon" onclick="SpiSnapApp.editStudent('${s.enrollment}')" aria-label="Edit Student Record">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="SpiSnapApp.deleteStudent('${s.enrollment}')" aria-label="Delete Student Record">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </div>
            `;
            historyGrid.appendChild(card);
        });
    }

    /* CRUD Operations */
    async function handleFormSubmit(e) {
        e.preventDefault();

        const origEnrollment = document.getElementById('edit-original-enrollment').value;
        const newEnrollment = document.getElementById('enrollment').value.trim();

        if (!origEnrollment || origEnrollment !== newEnrollment) {
            const exists = studentStore.some(s => s.enrollment === newEnrollment);
            if (exists) {
                showToast(`Enrollment Number ${newEnrollment} already exists!`, 'error');
                return;
            }
        }

        let cgpaInput = document.getElementById('cgpa').value;

        const studentObj = {
            enrollment: newEnrollment,
            name: document.getElementById('name').value.trim(),
            spi1: document.getElementById('spi1').value,
            backlog1: document.getElementById('backlog1').value || '0',
            status1: document.getElementById('status1').value,

            spi2: document.getElementById('spi2').value,
            backlog2: document.getElementById('backlog2').value || '0',
            status2: document.getElementById('status2').value,

            spi3: document.getElementById('spi3').value,
            backlog3: document.getElementById('backlog3').value || '0',
            status3: document.getElementById('status3').value,

            spi4: document.getElementById('spi4').value,
            backlog4: document.getElementById('backlog4').value || '0',
            status4: document.getElementById('status4').value,

            cgpa: cgpaInput !== "" ? parseFloat(cgpaInput).toFixed(2) : "0.00"
        };

        if (!cgpaInput) {
            studentObj.cgpa = calculateAutoCGPA(studentObj);
        }

        if (origEnrollment && origEnrollment !== newEnrollment) {
            await storage.delete(origEnrollment);
        }

        await storage.save(studentObj);
        clearDraft();
        closeModal('modal-student-form');
        showToast(origEnrollment ? 'Student updated successfully!' : 'Student added successfully!', 'success');
        await loadData();
    }

    function editStudent(enrollment) {
        const s = studentStore.find(st => st.enrollment === enrollment);
        if (!s) return;

        document.getElementById('form-modal-title').innerText = 'Edit Student Profile';
        document.getElementById('edit-original-enrollment').value = s.enrollment;
        document.getElementById('enrollment').value = s.enrollment;
        document.getElementById('name').value = s.name;

        document.getElementById('spi1').value = s.spi1 || '';
        document.getElementById('backlog1').value = s.backlog1 || 0;
        document.getElementById('status1').value = s.status1 || 'No Backlog';

        document.getElementById('spi2').value = s.spi2 || '';
        document.getElementById('backlog2').value = s.backlog2 || 0;
        document.getElementById('status2').value = s.status2 || 'No Backlog';

        document.getElementById('spi3').value = s.spi3 || '';
        document.getElementById('backlog3').value = s.backlog3 || 0;
        document.getElementById('status3').value = s.status3 || 'No Backlog';

        document.getElementById('spi4').value = s.spi4 || '';
        document.getElementById('backlog4').value = s.backlog4 || 0;
        document.getElementById('status4').value = s.status4 || 'No Backlog';

        document.getElementById('cgpa').value = s.cgpa || '';

        [1, 2, 3, 4].forEach(i => enforceStatusLogic(i));

        openModal('modal-student-form');
    }

    async function deleteStudent(enrollment) {
        if (confirm(`Are you sure you want to delete student ${enrollment}?`)) {
            await storage.delete(enrollment);
            showToast('Student profile deleted', 'success');
            await loadData();
        }
    }

    function viewTimeline(enrollment) {
        const s = studentStore.find(st => st.enrollment === enrollment);
        if (!s) return;

        const spis = [
            parseFloat(s.spi1) || 0,
            parseFloat(s.spi2) || 0,
            parseFloat(s.spi3) || 0,
            parseFloat(s.spi4) || 0
        ];

        const overall = computeOverallStatus(s);
        const totalBacklogs = Number(s.backlog1 || 0) + Number(s.backlog2 || 0) + Number(s.backlog3 || 0) + Number(s.backlog4 || 0);

        const bodyHtml = `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <div class="avatar" style="width: 60px; height: 60px; font-size: 1.4rem;">${getInitials(s.name)}</div>
                <div>
                    <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--color-primary-dark);">${s.name}</h2>
                    <div style="color: var(--text-tertiary); font-family: var(--font-mono); font-size: 0.875rem;">Enrollment: ${s.enrollment}</div>
                </div>
            </div>

            <div class="cgpa-container" style="padding: 14px 18px; margin-bottom: 24px;">
                <div>
                    <div style="font-size: 0.775rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 800;">Overall Status</div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: ${overall === 'Cleared' ? 'var(--color-primary)' : 'var(--badge-pending-text)'}">${overall} (${totalBacklogs} Active Backlogs)</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.775rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 800;">CGPA</div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-primary);">${s.cgpa}</div>
                </div>
            </div>

            <div class="form-section-title">SPI Trend Analysis Across Semesters</div>
            <div class="timeline-chart">
                ${spis.map((spi, idx) => {
                    const heightPct = (spi / 10) * 100;
                    return `
                        <div class="timeline-col">
                            <span style="font-size: 0.85rem; font-weight: 800; color: var(--color-primary);">${spi.toFixed(2)}</span>
                            <div class="timeline-bar-wrapper">
                                <div class="timeline-bar" style="height: ${heightPct}%;"></div>
                            </div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-tertiary);">Sem ${idx + 1}</span>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="form-section-title">Semester Breakdowns</div>
            <div class="sem-matrix" style="grid-template-columns: repeat(2, 1fr);">
                <div class="sem-pill" style="padding: 10px;"><span class="sem-pill-num">Sem 1:</span> <strong>SPI: ${s.spi1 || '0'} | Backlogs: ${s.backlog1} | ${s.status1}</strong></div>
                <div class="sem-pill" style="padding: 10px;"><span class="sem-pill-num">Sem 2:</span> <strong>SPI: ${s.spi2 || '0'} | Backlogs: ${s.backlog2} | ${s.status2}</strong></div>
                <div class="sem-pill" style="padding: 10px;"><span class="sem-pill-num">Sem 3:</span> <strong>SPI: ${s.spi3 || '0'} | Backlogs: ${s.backlog3} | ${s.status3}</strong></div>
                <div class="sem-pill" style="padding: 10px;"><span class="sem-pill-num">Sem 4:</span> <strong>SPI: ${s.spi4 || '0'} | Backlogs: ${s.backlog4} | ${s.status4}</strong></div>
            </div>
        `;

        document.getElementById('view-modal-body').innerHTML = bodyHtml;
        openModal('modal-view-student');
    }

    /* Auto-Draft Utilities */
    function saveDraft() {
        const formInputs = {
            enrollment: document.getElementById('enrollment').value,
            name: document.getElementById('name').value,
            spi1: document.getElementById('spi1').value,
            backlog1: document.getElementById('backlog1').value,
            status1: document.getElementById('status1').value,
            spi2: document.getElementById('spi2').value,
            backlog2: document.getElementById('backlog2').value,
            status2: document.getElementById('status2').value,
            spi3: document.getElementById('spi3').value,
            backlog3: document.getElementById('backlog3').value,
            status3: document.getElementById('status3').value,
            spi4: document.getElementById('spi4').value,
            backlog4: document.getElementById('backlog4').value,
            status4: document.getElementById('status4').value,
            cgpa: document.getElementById('cgpa').value
        };
        localStorage.setItem('spisnap_form_draft', JSON.stringify(formInputs));
    }

    function checkAutoDraft() {
        const draftRaw = localStorage.getItem('spisnap_form_draft');
        if (!draftRaw) return;
        try {
            const d = JSON.parse(draftRaw);
            if (d.name || d.enrollment) {
                document.getElementById('draft-notice').style.display = 'flex';
                document.getElementById('enrollment').value = d.enrollment || '';
                document.getElementById('name').value = d.name || '';
                
                document.getElementById('spi1').value = d.spi1 || '';
                document.getElementById('backlog1').value = d.backlog1 || '0';
                document.getElementById('status1').value = d.status1 || 'No Backlog';
                
                document.getElementById('spi2').value = d.spi2 || '';
                document.getElementById('backlog2').value = d.backlog2 || '0';
                document.getElementById('status2').value = d.status2 || 'No Backlog';
                
                document.getElementById('spi3').value = d.spi3 || '';
                document.getElementById('backlog3').value = d.backlog3 || '0';
                document.getElementById('status3').value = d.status3 || 'No Backlog';
                
                document.getElementById('spi4').value = d.spi4 || '';
                document.getElementById('backlog4').value = d.backlog4 || '0';
                document.getElementById('status4').value = d.status4 || 'No Backlog';
                
                document.getElementById('cgpa').value = d.cgpa || '';

                [1, 2, 3, 4].forEach(i => enforceStatusLogic(i));
            }
        } catch (e) {}
    }

    function clearDraft() {
        localStorage.removeItem('spisnap_form_draft');
        document.getElementById('draft-notice').style.display = 'none';
    }

    /* CSV Import / Export Handler */
    function exportCSV() {
        if (studentStore.length === 0) {
            showToast("No records available to export", "error");
            return;
        }

        let csvContent = "\uFEFF" + CSV_HEADERS.join(",") + "\n";

        studentStore.forEach(s => {
            const nameEscaped = s.name.includes(',') ? `"${s.name}"` : s.name;
            const row = [
                s.enrollment,
                nameEscaped,
                s.spi1 || "0.00", s.backlog1 || "0", s.status1 || "No Backlog",
                s.spi2 || "0.00", s.backlog2 || "0", s.status2 || "No Backlog",
                s.spi3 || "0.00", s.backlog3 || "0", s.status3 || "No Backlog",
                s.spi4 || "0.00", s.backlog4 || "0", s.status4 || "No Backlog",
                s.cgpa || "0.00"
            ].join(",");
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SpiSnap_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("CSV Export generated successfully!", "success");
    }

    function importCSV(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

            if (lines.length < 2) {
                showToast("CSV file is empty or invalid", "error");
                return;
            }

            let importedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const parts = parseCSVLine(lines[i]);
                if (parts.length >= 15) {
                    const studentObj = {
                        enrollment: parts[0].trim(),
                        name: parts[1].trim(),
                        spi1: parts[2].trim(), backlog1: parts[3].trim(), status1: parts[4].trim(),
                        spi2: parts[5].trim(), backlog2: parts[6].trim(), status2: parts[7].trim(),
                        spi3: parts[8].trim(), backlog3: parts[9].trim(), status3: parts[10].trim(),
                        spi4: parts[11].trim(), backlog4: parts[12].trim(), status4: parts[13].trim(),
                        cgpa: parts[14].trim()
                    };
                    await storage.save(studentObj);
                    importedCount++;
                }
            }

            showToast(`Successfully imported ${importedCount} student records!`, "success");
            await loadData();
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    function parseCSVLine(text) {
        const result = [];
        let cell = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                result.push(cell);
                cell = '';
            } else {
                cell += c;
            }
        }
        result.push(cell);
        return result;
    }

    /* Modal Controls with Background Lock Integration */
    function openModal(id) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        scrollPosition = window.pageYOffset;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add('modal-open');
        document.getElementById(id).classList.add('active');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('active');
        // Delay removal to allow out-animation to complete without layout shifting early
        setTimeout(() => {
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '0px';
            window.scrollTo(0, scrollPosition);
        }, 300);
    }

    /* Toast Notification Engine */
    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeft = type === 'success' ? '4px solid var(--color-primary)' : '4px solid var(--badge-pending-text)';

        const icon = type === 'success' ? 
            `<svg width="18" height="18" fill="none" stroke="var(--color-primary)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>` : 
            `<svg width="18" height="18" fill="none" stroke="var(--badge-pending-text)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>`;

        toast.innerHTML = `${icon} <span>${msg}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* Global Event Setup */
    function setupEventListeners() {
        searchInput.addEventListener('input', debouncedSearch);
        filterStatus.addEventListener('change', applyFiltersAndRender);
        sortBy.addEventListener('change', applyFiltersAndRender);

        document.getElementById('btn-add-student').addEventListener('click', () => {
            studentForm.reset();
            document.getElementById('edit-original-enrollment').value = '';
            document.getElementById('form-modal-title').innerText = 'Add Student Record';
            [1, 2, 3, 4].forEach(i => enforceStatusLogic(i));
            openModal('modal-student-form');
        });

        document.getElementById('fab-add').addEventListener('click', () => {
            document.getElementById('btn-add-student').click();
        });

        studentForm.addEventListener('submit', handleFormSubmit);
        studentForm.addEventListener('input', saveDraft);

        [1, 2, 3, 4].forEach(i => {
            document.getElementById(`backlog${i}`).addEventListener('input', () => enforceStatusLogic(i));
            document.getElementById(`status${i}`).addEventListener('change', () => enforceStatusLogic(i));
        });

        document.getElementById('btn-export').addEventListener('click', exportCSV);
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('csv-file-input').click();
        });
        document.getElementById('csv-file-input').addEventListener('change', importCSV);

        // Click outside to close modals
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    closeModal(backdrop.id);
                }
            });
        });

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (document.getElementById('modal-student-form').classList.contains('active')) {
                    document.getElementById('btn-save-submit').click();
                } else {
                    document.getElementById('btn-add-student').click();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInput.focus();
            }
            if (e.key === 'Escape') {
                if (document.getElementById('modal-student-form').classList.contains('active')) {
                    closeModal('modal-student-form');
                }
                if (document.getElementById('modal-view-student').classList.contains('active')) {
                    closeModal('modal-view-student');
                }
            }
        });
    }

    return {
        init,
        editStudent,
        deleteStudent,
        viewTimeline,
        closeModal,
        clearDraft
    };
})();

// Bootstrap App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    SpiSnapApp.init();
});