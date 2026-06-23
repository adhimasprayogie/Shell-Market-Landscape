function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

const spreadsheetId = '1F9UeVxShXE7yNyWiyrJuKAHhZCR-WnCXSXPItte32Io';
const targetSheet = 'Data Input'; 
const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(targetSheet)}`;

let globalRawData = [];
let globalWinLossData = [];
let isShowingAll = false;
let currentSort = { column: 'volume', asc: false };
let chartInstances = {};
let wlChartInstances = { pie: null, bar: null };

const parseNum = val => {
    if (!val || val === '-') return 0;
    let num = parseFloat(val.toString().replace(/[^0-9.-]+/g,""));
    return isNaN(num) ? 0 : num;
};

function formatRupiah(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function formatVolume(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(num);
}

const alertSheet = 'Alerts';
const alertUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(alertSheet)}`;

// Pastikan tulisan 'WinLoss' sama persis dengan nama tab di Excel/Spreadsheet kamu (perhatikan spasi dan huruf besar/kecil)
const winLossSheet = 'WinLoss'; 
const winLossUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(winLossSheet)}`;

function fetchAlerts() {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = `
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
    `;

    // KODE ANTI-CACHE 
    const noCacheAlertUrl = alertUrl + '&_=' + new Date().getTime();

    fetch(noCacheAlertUrl) // Gunakan URL baru yang ada time-stamp nya
        .then(res => res.text())

    fetch(alertUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            alertContainer.innerHTML = ''; 
            
            json.table.rows.forEach((row, index) => {
                if(index === 0) return; 
                const cells = row.c;
                if (!cells || !cells[0]) return;

                const tipe = cells[0]?.v || '🟡';
                const judul = cells[1]?.v || 'Isu Baru';
                const deskripsi = cells[2]?.v || 'Detail isu belum tersedia.';
                const isWarning = tipe.includes('🟡') ? 'warning' : '';

                alertContainer.innerHTML += `
                    <div class="alert-card ${isWarning}">
                        <h3>${tipe} ${judul}</h3>
                        <p>${deskripsi}</p>
                    </div>
                `;
            });
        })
        .catch(err => {
            console.error('Error fetching alerts:', err);
            alertContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--shell-red); font-weight: bold;">❌ Gagal memuat Executive Summary.</div>';
        });
}

// 2. FUNGSI FETCH KHUSUS WIN/LOSS
function fetchWinLossData() {
    // Kode Anti-Cache agar data selalu update
    const noCacheUrl = winLossUrl + '&_=' + new Date().getTime();
    
    fetch(noCacheUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            const winLossArray = [];
            
            // Cerdas membaca header: Cek apakah header ada di label atau di baris pertama
            let headers = json.table.cols.map(c => c && c.label ? c.label.trim() : "");
            let startIndex = 0;
            
            if (headers.join("") === "") {
                headers = json.table.rows[0].c.map(c => c ? c.v.trim() : "");
                startIndex = 1; // Mulai baca data dari baris kedua karena baris pertama adalah header
            }

            // Ekstrak data per baris
            for (let i = startIndex; i < json.table.rows.length; i++) {
                const row = json.table.rows[i];
                if (!row || !row.c || !row.c[0]) continue; // Lewati baris kosong

                let rowObj = {};
                row.c.forEach((cell, colIndex) => {
                    let headerName = headers[colIndex];
                    if (headerName) {
                        rowObj[headerName] = (cell && cell.f) ? cell.f : ((cell && cell.v !== null) ? cell.v : "");
                    }
                });
                winLossArray.push(rowObj);
            }

            // ==========================================
            // KODE YANG SEBELUMNYA HILANG ADA DI BAWAH INI
            // ==========================================
            globalWinLossData = winLossArray; // Simpan data ke variabel Global!
            renderWinLossData(globalWinLossData); // Render tabel Win/Loss
            
        })
        .catch(err => {
            console.error("Gagal menarik data Win/Loss:", err);
            const tbody = document.getElementById('winloss-body');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding: 20px;">Gagal memuat data. Pastikan nama Sheet sudah benar.</td></tr>';
        });
}

function fetchData() {
    document.getElementById('toggle-rows-btn').style.display = 'none';
    showSkeletonLoading();
    fetchAlerts();
    fetchWinLossData();
    
    const statusBadge = document.getElementById('live-status');
    const headerRefreshBtn = document.querySelector('.header-refresh-btn');

    statusBadge.innerHTML = '● SYNCING... <span id="last-sync-time">Menarik data...</span>';
    statusBadge.style.backgroundColor = '#F59E0B';
    
    if (headerRefreshBtn) {
        headerRefreshBtn.classList.add('spinning');
    }

    // KODE ANTI-CACHE
    const noCacheUrl = url + '&_=' + new Date().getTime();

    fetch(noCacheUrl) // Gunakan URL baru
        .then(res => res.text())

    fetch(url)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            globalRawData = [];
            const getVal = (cells, idx) => (cells[idx] && cells[idx].v !== null) ? cells[idx].v : '-';

            json.table.rows.forEach((row, index) => {
                if(index === 0) return; 
                const cells = row.c;
                if (!cells || !cells[0]) return;

                globalRawData.push({
                    salesman: getVal(cells, 0), provinsi: getVal(cells, 1), customer: getVal(cells, 2),
                    sektor: getVal(cells, 3), pricingStr: getVal(cells, 4), skuShell: getVal(cells, 5),
                    hargaCPA: parseNum(getVal(cells, 6)), kompetitor: getVal(cells, 7), skuKomp: getVal(cells, 8),
                    hargaKomp: parseNum(getVal(cells, 9)), top: getVal(cells, 10), volume: parseNum(getVal(cells, 11)),
                    issue: getVal(cells, 12), info: getVal(cells, 13)          
                });
            });

            const now = new Date();
            const timeString = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WITA';

            statusBadge.innerHTML = `● LIVE & SYNCED <span id="last-sync-time">Update: ${timeString}</span>`;
            statusBadge.style.backgroundColor = '#10B981';

            if (headerRefreshBtn) {
                headerRefreshBtn.classList.remove('spinning');
            }

            populateDropdowns();
            updateKPIs(); 
            doSort('volume', false); 
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('table-body').innerHTML = '<tr><td colspan="10" style="text-align:center; color:#EF4444; padding:20px;">❌ Gagal sinkronisasi data. Cek koneksi atau nama Sheet.</td></tr>';
            
            statusBadge.innerHTML = '● SYNC FAILED <span id="last-sync-time">Cek koneksi internet</span>';
            statusBadge.style.backgroundColor = '#EF4444';

            if (headerRefreshBtn) {
                headerRefreshBtn.classList.remove('spinning');
            }
        });
}

function updateKPIs() {
    let totalVol = 0;
    let kompCount = {};
    globalRawData.forEach(d => {
        totalVol += d.volume;
        let k = d.kompetitor.trim();
        if(k && k !== '-') { kompCount[k] = (kompCount[k] || 0) + 1; }
    });
    document.getElementById('kpi-volume').innerText = formatVolume(totalVol) + " L";
    document.getElementById('kpi-accounts').innerText = globalRawData.length;

    let topKomp = "-"; let maxCount = 0;
    for (let k in kompCount) { if(kompCount[k] > maxCount) { maxCount = kompCount[k]; topKomp = k; } }
    document.getElementById('kpi-competitor').innerText = topKomp;
}

function populateDropdowns() {
    const provs = [...new Set(globalRawData.map(item => item.provinsi))].filter(x => x !== '-');
    const komps = [...new Set(globalRawData.map(item => item.kompetitor))].filter(x => x !== '-');
    
    const provSelect = document.getElementById('filter-prov');
    const kompSelect = document.getElementById('filter-komp');
    
    provSelect.innerHTML = '<option value="">Semua Provinsi</option>';
    kompSelect.innerHTML = '<option value="">Semua Kompetitor</option>';
    
    provs.forEach(p => provSelect.innerHTML += `<option value="${p}">${p}</option>`);
    komps.forEach(k => kompSelect.innerHTML += `<option value="${k}">${k}</option>`);
}

function renderTable(filteredData = null) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    const dataToRender = filteredData || globalRawData;
    
    const btn = document.getElementById('toggle-rows-btn');
    if (!filteredData && dataToRender.length > 10) { btn.style.display = 'block'; } 
    else { btn.style.display = 'none'; }

    const limit = (isShowingAll || filteredData !== null) ? dataToRender.length : Math.min(10, dataToRender.length);

    for (let i = 0; i < limit; i++) {
        const item = dataToRender[i];
        let gap = item.hargaKomp - item.hargaCPA;
        let gapClass = ""; let gapText = "-";
        
        if(item.hargaKomp > 0 && item.hargaCPA > 0) {
            if(gap > 0) { gapClass = "gap-positive"; gapText = `Shell lebih murah<br>${formatRupiah(gap)}`; }
            else if(gap < 0) { gapClass = "gap-negative"; gapText = `Shell lebih mahal<br>${formatRupiah(Math.abs(gap))}`; }
            else { gapText = "Harga Sama"; }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="hide-mobile"><strong>${item.provinsi}</strong></td>
            <td class="hide-mobile">${item.salesman}</td>
            <td class="wrap-text"><strong style="color:var(--cpa-dark);">${item.customer}</strong><br><span style="font-size:11px; color:var(--text-muted);">Sektor: ${item.sektor}</span></td>
            <td style="font-weight: bold; color: var(--cpa-blue); text-align: center; font-size:14px;">${formatVolume(item.volume)}</td>
            <td class="hide-mobile sku-text">${item.skuShell}<br><span style="color:var(--text-muted);">${item.pricingStr}</span></td>
            <td><strong>${formatRupiah(item.hargaCPA)}</strong></td>
            <td style="color:var(--shell-red); font-weight:bold;">${item.kompetitor}</td>
            <td class="hide-mobile sku-text">${item.skuKomp}<br><strong style="font-size:13px; color:var(--text-main); font-family:'Segoe UI',sans-serif;">${formatRupiah(item.hargaKomp)}</strong></td>
            <td class="${gapClass}" style="font-size:11.5px;">${gapText}</td>
            <td><button class="info-btn" onclick="alert('🔴 Isu: ${item.issue}\\n\\n🟢 Info: ${item.info}\\n\\n⏱️ TOP: ${item.top}')">Detail</button></td>
        `;
        tableBody.appendChild(tr);
    }
    renderCharts(dataToRender);
}

function sortTable(column) {
    if (currentSort.column === column) { currentSort.asc = !currentSort.asc; } 
    else { currentSort.column = column; currentSort.asc = true; }
    doSort(column, currentSort.asc);
}

function doSort(col, isAsc) {
    globalRawData.sort((a, b) => {
        let valA = a[col]; let valB = b[col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });
    filterTable();
}

function toggleRowsDisplay() {
    isShowingAll = !isShowingAll;
    const btn = document.getElementById('toggle-rows-btn');
    btn.innerHTML = isShowingAll ? 'Show Less' : 'Show All Data';
    renderTable();
}

function filterTable() {
    const query = document.getElementById('search-box').value.toLowerCase().trim();
    const provF = document.getElementById('filter-prov').value.toLowerCase().trim();
    const kompF = document.getElementById('filter-komp').value.toLowerCase().trim();

    // JIKA TIDAK ADA FILTER (Tampilkan Semua)
    if (query === '' && provF === '' && kompF === '') {
        renderTable(); 
        if (globalWinLossData.length > 0) renderWinLossData(globalWinLossData);
        return;
    }

    // 1. FILTER DATA TABEL UTAMA (Data Input)
    const filteredMain = globalRawData.filter(item => {
        const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
        
        const matchQ = query === "" || 
                       safeStr(item.salesman).includes(query) || 
                       safeStr(item.provinsi).includes(query) ||
                       safeStr(item.customer).includes(query) || 
                       safeStr(item.sektor).includes(query) ||
                       safeStr(item.kompetitor).includes(query) || 
                       safeStr(item.skuShell).includes(query);
                       
        const matchP = provF === "" || safeStr(item.provinsi) === provF;
        const matchK = kompF === "" || safeStr(item.kompetitor) === kompF;
        
        return matchQ && matchP && matchK;
    });
    
    // Render Ulang Tabel Utama & Pricing Matrix Chart
    renderTable(filteredMain); 

    // 2. FILTER DATA WIN/LOSS
    if (globalWinLossData.length > 0) {
        const filteredWL = globalWinLossData.filter(item => {
            const safeStr = (str) => str ? str.toString().toLowerCase().trim() : '';
            
            // Cek pencarian teks di Nama Customer atau Keterangan
            const matchQ = query === "" || 
                           safeStr(item['Nama Customer']).includes(query) || 
                           safeStr(item['Keterangan']).includes(query);
            
            // Cek kesamaan Provinsi dan Kompetitor (Menggunakan exact match yang sudah di-trim)
            const matchP = provF === "" || safeStr(item['Provinsi']) === provF;
            const matchK = kompF === "" || safeStr(item['Kompetitor']) === kompF;
            
            return matchQ && matchP && matchK;
        });
        
        // Render Ulang KPI, Chart, dan Tabel Win/Loss sesuai filter
        renderWinLossData(filteredWL);
    }
}

function renderCharts(data) {
    if(chartInstances.pie) chartInstances.pie.destroy();
    if(chartInstances.bar) chartInstances.bar.destroy();
    if(typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

    let kompCount = {};
    data.forEach(d => { if(d.kompetitor && d.kompetitor !== '-') kompCount[d.kompetitor] = (kompCount[d.kompetitor] || 0) + 1; });
    
    let provVol = {};
    data.forEach(d => { if(d.provinsi && d.provinsi !== '-') provVol[d.provinsi] = (provVol[d.provinsi] || 0) + d.volume; });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    chartInstances.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(kompCount),
            datasets: [{ data: Object.values(kompCount), backgroundColor: ['#DD0000', '#1E40AF', '#FFD500', '#10B981', '#8B5CF6'], borderWidth: 0 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12, family: 'Segoe UI' } } },
                datalabels: { color: '#ffffff', font: { weight: 'bold', size: 13 }, formatter: (value) => { return value > 0 ? value : ''; }, textShadowColor: '#000', textShadowBlur: 3 }
            } 
        }
    });

    const barCtx = document.getElementById('barChart').getContext('2d');
    chartInstances.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(provVol),
            datasets: [{ label: 'Volume', data: Object.values(provVol), backgroundColor: '#1E40AF', borderRadius: 6 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } }, 
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [4, 4] } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }, 
                datalabels: { anchor: 'end', align: 'top', color: '#1E3A8A', font: { weight: 'bold', size: 12 }, formatter: (value) => { return value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value); } }
            }
        }
    });
    renderPricingMatrix(data);
}

function renderWinLossData(dataArray) {
    const tbody = document.getElementById('winloss-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    // Wadah Kalkulasi Funnel
    let statusCounts = { win: 0, loss: 0, pending: 0 };
    let volumeStats = { win: 0, loss: 0, pending: 0 };
    
    // Wadah Kalkulasi Remarketing
    let remarketingCount = 0;
    let remarketingVolume = 0;
    let remStatusBreakdown = {};

    dataArray.forEach(row => {
        // Mapping kolom otomatis dari Spreadsheet
        let customerName = row['Nama Customer'] || '-';
        let rawStatus = String(row['Status'] || 'Pending').toLowerCase().trim();
        let kompetitorName = row['Kompetitor'] || '-';
        let remText = String(row['Remarketing'] || 'No').trim();
        let keterangan = row['Keterangan'] || '-';

        // PEMBERSIH ANGKA INDONESIA (Contoh: "16.720,00" -> 16720)
        let rawVolStr = String(row['Volume (L)'] || '0');
        // Buang desimal (,00) lalu hapus titik (.)
        let cleanVolStr = rawVolStr.split(',')[0].replace(/\./g, '');
        let vol = Number(cleanVolStr.replace(/[^0-9]/g, '')) || 0;

        // 1. Kategorisasi Status Funnel Cerdas
        let badgeClass = "pipeline"; 
        let keyStatus = "pending"; 
        let displayStatus = "PENDING OPPORTUNITY";

        if (rawStatus.includes('win')) {
            badgeClass = "gap-positive"; keyStatus = "win"; displayStatus = "WON (SECURED)";
        } else if (rawStatus.includes('loss')) {
            badgeClass = "gap-negative"; keyStatus = "loss"; displayStatus = "LOST (CHURNED)";
        }

        // Akumulasi Volume & Akun ke Funnel Utama
        statusCounts[keyStatus]++;
        volumeStats[keyStatus] += vol;

        // 2. Deteksi Korelasi Remarketing (Recovery Pipeline)
        let remStyle = "color: #64748B; font-weight: 500;";
        let uppercaseRem = remText.toUpperCase();

        if (uppercaseRem !== 'NO' && uppercaseRem !== '-' && uppercaseRem !== '') {
            // Jika statusnya bukan NO, berarti masuk program Remarketing
            remarketingCount++;
            remarketingVolume += vol;
            remStatusBreakdown[remText] = (remStatusBreakdown[remText] || 0) + 1;
            
            // Tambahkan logo panah melingkar di status tabel
            if (keyStatus !== 'win') displayStatus += " 🔄"; 

            // Warna text dinamis berdasarkan progres Remarketing
            if (uppercaseRem.includes('IN PROGRESS')) remStyle = "color: #3B82F6; font-weight: 700;"; // Biru
            if (uppercaseRem.includes('SCHEDULED')) remStyle = "color: #F59E0B; font-weight: 700;"; // Kuning Emas
            if (uppercaseRem.includes('WON-BACK')) remStyle = "color: #10B981; font-weight: 700; background-color: #E6F4EA; padding: 2px 6px; border-radius: 4px;"; // Hijau dengan background
        }

        // Render Baris Tabel
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="wrap-text"><strong style="color:var(--cpa-dark);">${customerName}</strong></td>
            <td><span class="badge ${badgeClass}" style="font-size:11px;">${displayStatus}</span></td>
            <td style="color:#DC2626; font-weight:600;">${kompetitorName}</td>
            <td style="font-weight:700; color:var(--cpa-blue);">${new Intl.NumberFormat('id-ID').format(vol)}</td>
            <td><span style="${remStyle}">${remText}</span></td>
            <td class="wrap-text" style="color:var(--text-muted); font-size:12.5px;">${keterangan}</td>
        `;
        tbody.appendChild(tr);
    });

    // --- 3. TEMBAK DATA KE KPI CARDS ---
    let totalVolPipeline = volumeStats.win + volumeStats.loss + volumeStats.pending;
    let totalAccCount = statusCounts.win + statusCounts.loss + statusCounts.pending;

    let winRatePct = totalVolPipeline > 0 ? Math.round((volumeStats.win / totalVolPipeline) * 100) : 0;
    let lossRatePct = totalVolPipeline > 0 ? Math.round((volumeStats.loss / totalVolPipeline) * 100) : 0;

    if(document.getElementById('wl-total-pipeline')) document.getElementById('wl-total-pipeline').textContent = new Intl.NumberFormat('id-ID').format(totalVolPipeline) + ' L';
    if(document.getElementById('wl-total-accounts')) document.getElementById('wl-total-accounts').textContent = `${totalAccCount} Akun Terdata`;
    
    if(document.getElementById('wl-winrate')) document.getElementById('wl-winrate').textContent = winRatePct + '%';
    if(document.getElementById('wl-secured-vol')) document.getElementById('wl-secured-vol').textContent = new Intl.NumberFormat('id-ID').format(volumeStats.win) + ' L Secured';
    
    if(document.getElementById('wl-lossrate')) document.getElementById('wl-lossrate').textContent = lossRatePct + '%';
    if(document.getElementById('wl-lost-vol')) document.getElementById('wl-lost-vol').textContent = new Intl.NumberFormat('id-ID').format(volumeStats.loss) + ' L Churned';
    
    if(document.getElementById('wl-remarketing-vol')) document.getElementById('wl-remarketing-vol').textContent = new Intl.NumberFormat('id-ID').format(remarketingVolume) + ' L';
    if(document.getElementById('wl-remarketing-count')) document.getElementById('wl-remarketing-count').textContent = `${remarketingCount} Target Recovery`;

    // --- 4. RENDER GRAFIK CHART.JS ---
    if(wlChartInstances.pie) wlChartInstances.pie.destroy();
    if(wlChartInstances.bar) wlChartInstances.bar.destroy();

    if(typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

    const pieCtx = document.getElementById('winLossPieChart');
    if (pieCtx) {
        wlChartInstances.pie = new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Won (Secured)', 'Lost (Churned)', 'Pending Opportunity'],
                datasets: [{
                    data: [volumeStats.win, volumeStats.loss, volumeStats.pending],
                    backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
                    borderWidth: 2, borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                    datalabels: {
                        color: '#FFFFFF', font: { weight: 'bold', size: 12 }, textShadowColor: '#000', textShadowBlur: 4,
                        formatter: (value) => {
                            if (value === 0) return '';
                            return ((value / totalVolPipeline) * 100).toFixed(0) + '%';
                        }
                    }
                }
            }
        });
    }

    const barCtx = document.getElementById('remarketingBarChart');
    if (barCtx) {
        let barLabels = Object.keys(remStatusBreakdown);
        let barData = Object.values(remStatusBreakdown);

        if(barLabels.length === 0) { barLabels = ["Belum ada data"]; barData = [0]; }

        wlChartInstances.bar = new Chart(barCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{
                    label: 'Jumlah Akun',
                    data: barData,
                    backgroundColor: '#3B82F6', borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { anchor: 'end', align: 'right', color: '#1E3A8A', font: { weight: 'bold', size: 12 } }
                },
                scales: { x: { display: false }, y: { grid: { display: false } } }
            }
        });
    }
}

// Fungsi khusus merender Pricing Matrix Bubble Chart
function renderPricingMatrix(data) {
    const canvas = document.getElementById('pricingBubbleChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Hancurkan chart lama jika ada agar tidak tumpang tindih
    if(chartInstances.bubble) chartInstances.bubble.destroy();

    // 1. Agregasi Data (Gabungkan berdasarkan Area dan Kompetitor)
    const summary = data.reduce((acc, d) => {
        // Ambil data yang punya harga & kompetitor saja
        if (d.hargaCPA > 0 && d.hargaKomp > 0 && d.kompetitor && d.kompetitor !== '-') {
            let key = `${d.provinsi}_${d.kompetitor}`;
            if (!acc[key]) {
                acc[key] = { area: d.provinsi, komp: d.kompetitor, vol: 0, sumCPA: 0, sumKomp: 0, count: 0 };
            }
            acc[key].vol += d.volume;
            acc[key].sumCPA += d.hargaCPA;
            acc[key].sumKomp += d.hargaKomp;
            acc[key].count++;
        }
        return acc;
    }, {});

    // 2. Palet Warna Khusus Kompetitor
    const colorPalette = {
        'Pertamina': 'rgba(239, 68, 68, 0.7)', // Merah
        'Castrol': 'rgba(16, 185, 129, 0.7)',  // Hijau
        'Sefas': 'rgba(245, 158, 11, 0.7)',    // Kuning
        'Idemitsu': 'rgba(59, 130, 246, 0.7)'  // Biru
    };
    const defaultColor = 'rgba(100, 116, 139, 0.7)'; // Abu-abu

    // 3. Susun data untuk Chart.js
    let datasetsObj = {};
    Object.values(summary).forEach(item => {
        let avgCPA = item.sumCPA / item.count;
        let avgKomp = item.sumKomp / item.count;
        let selisih = avgKomp - avgCPA; // Jika Positif, kita lebih murah

        if (!datasetsObj[item.komp]) {
            datasetsObj[item.komp] = {
                label: item.komp,
                backgroundColor: colorPalette[item.komp] || defaultColor,
                data: []
            };
        }

        datasetsObj[item.komp].data.push({
            x: selisih,
            y: item.vol,
            r: Math.max(8, Math.sqrt(item.vol) / 15), // Rumus mengatur besar lingkaran
            _area: item.area,
            _avgCPA: avgCPA,
            _avgKomp: avgKomp
        });
    });

    const datasets = Object.values(datasetsObj);

    // 4. Gambar Bubble Chart
    chartInstances.bubble = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { 
                    title: { display: true, text: '← Shell Lebih Mahal (Rp) | Selisih Harga | (Rp) Shell Lebih Murah →', font: {weight: 'bold'} },
                    grid: { color: (ctx) => ctx.tick.value === 0 ? '#1E293B' : '#E2E8F0', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1 } // Garis tebal di angka 0
                },
                y: { 
                    title: { display: true, text: 'Total Volume (Liter)', font: {weight: 'bold'} },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { position: 'top' },
                datalabels: { display: false }, // Matikan teks di dalam lingkaran agar rapi
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const d = context.raw;
                            return [
                                `Area: ${d._area} (Komp: ${context.dataset.label})`,
                                `Volume: ${new Intl.NumberFormat('id-ID').format(d.y)} L`,
                                `Avg Harga Shell: Rp ${new Intl.NumberFormat('id-ID').format(d._avgCPA)}`,
                                `Avg Harga Komp: Rp ${new Intl.NumberFormat('id-ID').format(d._avgKomp)}`,
                                `Selisih: Rp ${new Intl.NumberFormat('id-ID').format(d.x)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

window.onscroll = function() {
    const backToTopBtn = document.getElementById("backToTopBtn");
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
        backToTopBtn.style.display = "flex";
    } else {
        backToTopBtn.style.display = "none";
    }
};

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showSkeletonLoading() {
    document.getElementById('kpi-volume').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-accounts').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-competitor').innerHTML = '<div class="skeleton skeleton-kpi"></div>';

    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    for(let i = 0; i < 5; i++) {
        tableBody.innerHTML += `
            <tr>
                <td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 80%;"></div></td>
                <td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div></td>
                <td>
                    <div class="skeleton skeleton-text" style="width: 100%;"></div>
                    <div class="skeleton skeleton-text" style="width: 60%; height: 10px;"></div>
                </td>
                <td><div class="skeleton skeleton-text" style="width: 70%; margin: 0 auto;"></div></td>
                <td class="hide-mobile">
                    <div class="skeleton skeleton-text" style="width: 90%;"></div>
                    <div class="skeleton skeleton-text" style="width: 50%; height: 10px;"></div>
                </td>
                <td><div class="skeleton skeleton-text" style="width: 80%;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 80%;"></div></td>
                <td class="hide-mobile">
                    <div class="skeleton skeleton-text" style="width: 90%;"></div>
                    <div class="skeleton skeleton-text" style="width: 70%; height: 10px;"></div>
                </td>
                <td><div class="skeleton skeleton-text" style="width: 100%;"></div></td>
                <td><div class="skeleton skeleton-btn"></div></td>
            </tr>
        `;
    }
}

// ==========================================
// TRIGGER OTOMATIS SAAT HALAMAN DIBUKA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Jalankan penarikan data secara otomatis tanpa harus diklik
    fetchData(); 
});