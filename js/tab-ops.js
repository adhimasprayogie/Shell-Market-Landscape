import { state } from './state.js';
import { formatVolume } from './utils.js';

const parseCleanNum = (val) => {
    if(!val) return 0;
    if(typeof val === 'number') return val;
    let str = String(val).replace(/\./g, '').split(',')[0];
    return Number(str.replace(/[^0-9]/g, '')) || 0;
};

export function filterOps() {
    const segmen = document.getElementById('filter-segmen') ? document.getElementById('filter-segmen').value : '';
    renderOpsDashboard(segmen);
}

export function renderOpsDashboard(filterSegmen = "") {
    const tbodyAch = document.getElementById('achievement-body');
    const tbodyOps = document.getElementById('ops-body');
    if (!tbodyAch || !tbodyOps) return;

    tbodyAch.innerHTML = '';
    tbodyOps.innerHTML = '';

    let opsData = state.globalOpsData || [];
    let targetData = state.globalDsrData || [];

    const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'mei': '05',
        'jun': '06', 'jul': '07', 'aug': '08', 'agu': '08', 'sep': '09', 'oct': '10', 'okt': '10',
        'nov': '11', 'dec': '12', 'des': '12'
    };

    const standardizeDate = (dateStr) => {
        if (!dateStr) return "00-0000";
        let lowerStr = String(dateStr).toLowerCase();
        let monthKey = Object.keys(monthMap).find(m => lowerStr.includes(m));
        let monthNum = monthKey ? monthMap[monthKey] : "00";
        let yearMatch = lowerStr.match(/(20\d{2}|\d{2})/);
        let yearNum = yearMatch ? yearMatch[1] : "2026";
        if (yearNum.length === 2) yearNum = "20" + yearNum;
        return `${monthNum}-${yearNum}`;
    };

    const monthSelect = document.getElementById('filter-ops-month');
    const yearSelect = document.getElementById('filter-ops-year');
    let selectedMonth = monthSelect ? monthSelect.value : "06";
    let selectedYear = yearSelect ? yearSelect.value : "2026";
    const currentSystemDate = `${selectedMonth}-${selectedYear}`; 
    const monthNamesID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const displayMonthName = `${monthNamesID[parseInt(selectedMonth)-1]} ${selectedYear}`;

    // --- VARIABEL KALKULASI ---
    let totalPoMonth = 0; let totalOsDelivery = 0; let totalOsInvoice = 0; let totalDeliveredMonth = 0;
    let segStats = {
        smelter: { act: 0, tgt: 0, base: 0 },
        nonSmelter: { act: 0, tgt: 0, base: 0 }
    };
    let actualMap = {}; let opsRenderCount = 0;

    // 1. PROSES TABEL OPERASIONAL
    opsData.forEach(row => {
        let cols = Object.values(row);
        if(cols.length < 10) return;

        let standardRowDate = standardizeDate(cols[0]);
        if (standardRowDate !== currentSystemDate) return;

        let segType = String(cols[2] || '').toLowerCase();
        let dsrName = String(cols[3] || '');
        let noDo = String(cols[9] || '').trim();
        let noInv = String(cols[10] || '').trim();
        let volPO = parseCleanNum(cols[11]);
        let volDel = parseCleanNum(cols[12]);
        let tier = String(cols[7] || '').toLowerCase().trim();
        let brand = String(cols[6] || '').toLowerCase().trim();

        let dsrKey = dsrName + "_" + cols[2];
        if (!actualMap[dsrKey]) actualMap[dsrKey] = { all: 0, premium: 0, gadus: 0 };

        totalPoMonth += volPO;

        if (noDo === "" || noDo === "-" || noDo === "0") {
            totalOsDelivery += volPO;
        } else if (noInv === "" || noInv === "-" || noInv === "0") {
            totalOsInvoice += volDel;
            actualMap[dsrKey].all += volDel;
            if (tier === 'premium') actualMap[dsrKey].premium += volDel;
            if (brand.includes('gadus')) actualMap[dsrKey].gadus += volDel;
            
            if (segType.includes('non')) segStats.nonSmelter.act += volDel;
            else segStats.smelter.act += volDel;
        } else {
            totalDeliveredMonth += volDel;
            actualMap[dsrKey].all += volDel;
            if (tier === 'premium') actualMap[dsrKey].premium += volDel;
            if (brand.includes('gadus')) actualMap[dsrKey].gadus += volDel;

            if (segType.includes('non')) segStats.nonSmelter.act += volDel;
            else segStats.smelter.act += volDel;
        }

        if (noDo === "" || noDo === "-" || noInv === "" || noInv === "-") {
            // Cek apakah terpengaruh filter segmen Master Data
            if (filterSegmen && filterSegmen.toLowerCase() !== "semua segmen" && segType !== filterSegmen.toLowerCase()) return;
            
            opsRenderCount++;
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 11px; color:#64748B;">${cols[0]}</td>
                <td><strong style="color:var(--cpa-dark);">${cols[4]}</strong></td>
                <td>${dsrName}</td>
                <td style="font-family: monospace;">${cols[8]}</td>
                <td style="font-family: monospace;">${noDo || '-'}</td>
                <td style="font-weight: bold; color:var(--cpa-blue);">${formatVolume(volPO)}</td>
                <td><span style="background:${noDo===''?'#3B82F6':'#F59E0B'}; color:#fff; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold;">${noDo===''?'OS DELIVERY':'OS INVOICE'}</span></td>
                <td style="color:#DC2626; font-size:12px;">${cols[13] || '-'}</td>
            `;
            tbodyOps.appendChild(tr);
        }
    });

    // 2. PROSES TARGET PER SEGMEN & DSR
    targetData.forEach(tgt => {
        let cols = Object.values(tgt);
        if (cols.length < 5) return;
        
        // PENTING: Kadang header nyangkut, jadi lewati baris yang namanya 'Bulan'
        if (String(cols[0]).toLowerCase().includes('bulan')) return;

        if (standardizeDate(cols[0]) !== currentSystemDate) return;

        let segType = String(cols[1] || '').toLowerCase();
        let dsrName = String(cols[2] || '');
        
        let tAll = parseCleanNum(cols[3]);
        let bAll = parseCleanNum(cols[4]);
        
        if (segType.includes('non')) {
            segStats.nonSmelter.tgt += tAll;
            segStats.nonSmelter.base += bAll;
        } else {
            segStats.smelter.tgt += tAll;
            segStats.smelter.base += bAll;
        }

        // Cek filter segmen Master Data sebelum merender baris DSR
        if (filterSegmen && filterSegmen.toLowerCase() !== "semua segmen" && segType !== filterSegmen.toLowerCase()) return;

        let dsrKey = dsrName + "_" + cols[1];
        let act = actualMap[dsrKey] || { all: 0, premium: 0, gadus: 0 };

        let pct = tAll > 0 ? (act.all / tAll) * 100 : 0;
        let tPrem = parseCleanNum(cols[5]);
        let tGadus = parseCleanNum(cols[7]); // Indeks 7 karena 6 adalah Base Premium

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 12px 16px;"><strong>${dsrName}</strong></td>
            <td style="padding: 12px 16px;"><span style="font-size:11px; padding:4px 8px; background:#F1F5F9; border-radius:6px;">${cols[1]}</span></td>
            <td style="padding: 12px 16px;">${renderBar(pct, act.all, tAll)}</td>
            <td style="padding: 12px 16px;">${renderBar(tPrem>0?(act.premium/tPrem)*100:0, act.premium, tPrem)}</td>
            <td style="padding: 12px 16px;">${renderBar(tGadus>0?(act.gadus/tGadus)*100:0, act.gadus, tGadus)}</td>
        `;
        tbodyAch.appendChild(tr);
    });

    // --- RENDER KPI & SUMMARY BOX ---
    document.getElementById('ops-total-po').textContent = formatVolume(totalPoMonth) + " L";
    document.getElementById('ops-po-onhand').textContent = formatVolume(totalOsDelivery) + " L";
    document.getElementById('ops-os-invoice').textContent = formatVolume(totalOsInvoice) + " L";
    document.getElementById('ops-delivered').textContent = formatVolume(totalDeliveredMonth) + " L";

    // Render Smelter Summary
    renderSegmentBox('smelter', segStats.smelter);
    renderSegmentBox('non-smelter', segStats.nonSmelter);

    if (opsRenderCount === 0) tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">🎉 Semua order lancar di ${displayMonthName}</td></tr>`;
    if (tbodyAch.innerHTML === '') tbodyAch.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#DC2626;">Belum ada Data Target untuk bulan <b>${displayMonthName}</b>.</td></tr>`;
}

function renderBar(pct, act, tgt) {
    return `
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
            <span style="font-weight:bold; color:${pct>=100?'#10B981':'#334155'}">${pct.toFixed(1)}%</span>
            <span>${formatVolume(act)} / ${formatVolume(tgt)}</span>
        </div>
        <div style="width:100%; background:#E2E8F0; border-radius:4px; height:6px; overflow:hidden;">
            <div style="height:100%; width:${Math.min(pct,100)}%; background:${pct>=100?'#10B981':'#3B82F6'};"></div>
        </div>
    `;
}

function renderSegmentBox(prefix, data) {
    let pct = data.tgt > 0 ? (data.act / data.tgt) * 100 : 0;
    let growth = data.base > 0 ? ((data.act - data.base) / data.base) * 100 : 0;
    
    const pctEl = document.getElementById(`${prefix}-ach-pct`);
    const growthEl = document.getElementById(`${prefix}-growth`);
    const volEl = document.getElementById(`${prefix}-vol-status`);

    if(pctEl) {
        pctEl.textContent = pct.toFixed(1) + "%";
        pctEl.style.color = pct >= 100 ? "#10B981" : (prefix === 'smelter' ? "#005088" : "#DD0000");
    }
    if(growthEl) {
        growthEl.textContent = `Growth: ${growth >= 0 ? '▲ +' : '▼ '}${growth.toFixed(1)}%`;
        growthEl.style.color = growth >= 0 ? "#10B981" : "#DD0000";
    }
    if(volEl) {
        volEl.textContent = `${formatVolume(data.act)} / ${formatVolume(data.tgt)} L`;
    }
}
