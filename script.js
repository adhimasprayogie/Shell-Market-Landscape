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
let isShowingAll = false;
let currentSort = { column: 'volume', asc: false };
let chartInstances = {};

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

// URL Khusus untuk sheet "Alerts"
const alertSheet = 'Alerts';
const alertUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(alertSheet)}`;

function fetchAlerts() {
    const alertContainer = document.getElementById('alert-container');
    
    // Inject Skeleton Loading untuk Alerts
    alertContainer.innerHTML = `
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
        <div class="skeleton skeleton-kpi" style="width: 100%; height: 120px;"></div>
    `;

    fetch(alertUrl)
        .then(res => res.text())
        .then(data => {
            const json = JSON.parse(data.substring(47, data.length - 2));
            alertContainer.innerHTML = ''; // Kosongkan skeleton
            
            json.table.rows.forEach((row, index) => {
                if(index === 0) return; // Lewati baris pertama (header)
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
            alertContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--shell-red); font-weight: bold;">❌ Gagal memuat Executive Summary. Pastikan ada Sheet bernama "Alerts".</div>';
        });
}

function fetchData() {
    // Sembunyikan tombol "Show All" selama proses loading
    document.getElementById('toggle-rows-btn').style.display = 'none';
    
    // Panggil efek Skeleton
    showSkeletonLoading();

    // Panggil fungsi Alert dari Sheet kedua
    fetchAlerts();
    
    const statusBadge = document.getElementById('live-status');
    const headerRefreshBtn = document.querySelector('.header-refresh-btn');

    statusBadge.innerHTML = '● SYNCING... <span id="last-sync-time">Menarik data...</span>';
    statusBadge.style.backgroundColor = '#F59E0B';
    
    if (headerRefreshBtn) {
        headerRefreshBtn.classList.add('spinning');
        headerRefreshBtn.style.color = '#F59E0B';
        headerRefreshBtn.style.borderColor = '#F59E0B';
    }

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
                headerRefreshBtn.style.color = '#10B981';
                headerRefreshBtn.style.borderColor = '#10B981';
            }

            populateDropdowns();
            updateKPIs(); // Ini otomatis menimpa skeleton KPI dengan angka asli
            doSort('volume', false); // Ini otomatis menimpa skeleton tabel dengan data asli
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('table-body').innerHTML = '<tr><td colspan="10" style="text-align:center; color:#EF4444; padding:20px;">❌ Gagal sinkronisasi data. Cek koneksi atau nama Sheet.</td></tr>';
            
            statusBadge.innerHTML = '● SYNC FAILED <span id="last-sync-time">Cek koneksi internet</span>';
            statusBadge.style.backgroundColor = '#EF4444';

            if (headerRefreshBtn) {
                headerRefreshBtn.classList.remove('spinning');
                headerRefreshBtn.style.color = '#EF4444';
                headerRefreshBtn.style.borderColor = '#EF4444';
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
            <td class="wrap-text"><strong>${item.customer}</strong><br><span style="font-size:11px; color:#64748B;">Sektor: ${item.sektor}</span></td>
            <td style="font-weight: bold; color: var(--dark-blue); text-align: center;">${formatVolume(item.volume)}</td>
            <td class="hide-mobile sku-text">${item.skuShell}<br><span style="color:#64748B;">${item.pricingStr}</span></td>
            <td><strong>${formatRupiah(item.hargaCPA)}</strong></td>
            <td style="color:#DD0000; font-weight:bold;">${item.kompetitor}</td>
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
    const provF = document.getElementById('filter-prov').value;
    const kompF = document.getElementById('filter-komp').value;

    if (query === '' && provF === '' && kompF === '') {
        renderTable(); 
        return;
    }

    const filtered = globalRawData.filter(item => {
        const safeStr = (str) => str ? str.toString().toLowerCase() : '';
        const matchQ = safeStr(item.salesman).includes(query) || safeStr(item.provinsi).includes(query) ||
                       safeStr(item.customer).includes(query) || safeStr(item.sektor).includes(query) ||
                       safeStr(item.kompetitor).includes(query) || safeStr(item.skuShell).includes(query);
        const matchP = provF === "" || item.provinsi === provF;
        const matchK = kompF === "" || item.kompetitor === kompF;
        return matchQ && matchP && matchK;
    });
    renderTable(filtered); 
}

function renderCharts(data) {
    if(chartInstances.pie) chartInstances.pie.destroy();
    if(chartInstances.bar) chartInstances.bar.destroy();
    Chart.register(ChartDataLabels);

    let kompCount = {};
    data.forEach(d => { if(d.kompetitor && d.kompetitor !== '-') kompCount[d.kompetitor] = (kompCount[d.kompetitor] || 0) + 1; });
    
    let provVol = {};
    data.forEach(d => { if(d.provinsi && d.provinsi !== '-') provVol[d.provinsi] = (provVol[d.provinsi] || 0) + d.volume; });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    chartInstances.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(kompCount),
            datasets: [{ data: Object.values(kompCount), backgroundColor: ['#DD0000', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'], borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                datalabels: { color: '#ffffff', font: { weight: 'bold', size: 14 }, formatter: (value) => { return value > 0 ? value : ''; } }
            } 
        }
    });

    const barCtx = document.getElementById('barChart').getContext('2d');
    chartInstances.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(provVol),
            datasets: [{ label: 'Volume', data: Object.values(provVol), backgroundColor: '#FFD500', borderRadius: 4 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } }, scales: { y: { beginAtZero: true } },
            plugins: {
                legend: { display: false }, 
                datalabels: { anchor: 'end', align: 'top', color: '#1E293B', font: { weight: 'bold', size: 11 }, formatter: (value) => { return value === 0 ? '' : new Intl.NumberFormat('id-ID').format(value); } }
            }
        }
    });
}

// LOGIKA UNTUK TOMBOL BACK TO TOP
window.onscroll = function() {
    const backToTopBtn = document.getElementById("backToTopBtn");
    // Tampilkan tombol ketika user scroll 300px ke bawah
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
    // Inject Skeleton ke KPI
    document.getElementById('kpi-volume').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-accounts').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-competitor').innerHTML = '<div class="skeleton skeleton-kpi"></div>';

    // Inject Skeleton ke Tabel (Membuat 5 baris bayangan)
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

// Fungsi untuk merender tabel Win/Loss
function renderWinLossData(dataArray) {
    const tbody = document.getElementById('winloss-body');
    tbody.innerHTML = ''; // Kosongkan wadah dulu

    dataArray.forEach(row => {
        // Asumsi row memiliki properti sesuai nama kolom GSheets
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row['Nama Customer'] || '-'}</td>
            <td><span class="status-badge ${row['Status'] ? row['Status'].toLowerCase() : ''}">${row['Status'] || '-'}</span></td>
            <td>${row['Kompetitor'] || '-'}</td>
            <td>${row['Volume (L)'] || '0'}</td>
            <td>${row['Keterangan'] || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Fungsi untuk merender tabel Pricing
function renderPricingData(dataArray) {
    const tbody = document.getElementById('pricing-body');
    tbody.innerHTML = ''; 

    dataArray.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row['SKU / Produk'] || '-'}</strong></td>
            <td>${row['Harga Kita'] || '-'}</td>
            <td style="color: red;">${row['Harga Kompetitor'] || '-'}</td>
            <td>${row['Nama Kompetitor'] || '-'}</td>
            <td>${row['Selisih / Status'] || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Inisiasi saat halaman pertama dimuat
fetchData();
