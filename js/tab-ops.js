import { state } from './state.js';
import { formatVolume } from './utils.js';

const parseCleanNum = (val) => {
    if(!val) return 0;
    if(typeof val === 'number') return val;
    let str = String(val).replace(/\./g, '').split(',')[0];
    return Number(str.replace(/[^0-9]/g, '')) || 0;
};

export function renderOpsDashboard(filterSegmen = "") {
    const tbodyAch = document.getElementById('achievement-body');
    const tbodyOps = document.getElementById('ops-body');
    
    if (!tbodyAch || !tbodyOps) return;

    tbodyAch.innerHTML = '';
    tbodyOps.innerHTML = '';

    let opsData = state.globalOpsData || [];
    let targetData = state.globalDsrData || [];

    if (opsData.length === 0 && targetData.length === 0) {
        tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color:#DC2626; font-weight:bold;">❌ Gagal menarik data. Cek kembali "Publish to Web".</td></tr>`;
        return;
    }

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
        let yearNum = yearMatch ? yearMatch[1] : "0000";
        if (yearNum === "0000") yearNum = "2026"; 
        else if (yearNum.length === 2) yearNum = "20" + yearNum;
        return `${monthNum}-${yearNum}`;
    };

    // HARDCODE SESUAI DATA EXCEL (JUNI 2026)
    const currentSystemDate = "06-2026"; 
    const displayMonthName = "Juni 2026"; 

    if (filterSegmen && filterSegmen.toLowerCase() !== "semua segmen") {
        // Kolom 2 di Ops = Segmen. Kolom 1 di Target = Segmen.
        opsData = opsData.filter(d => String(d[2] || '').toLowerCase() === filterSegmen.toLowerCase());
        targetData = targetData.filter(d => String(d[1] || '').toLowerCase() === filterSegmen.toLowerCase());
    }

    let totalPoOnHand = 0; let totalOsInvoice = 0; let totalDeliveredMonth = 0;
    let actualMap = {}; 
    let opsRenderCount = 0;

    // --- 1. PROSES TABEL OPERASIONAL ---
    opsData.forEach(row => {
        // MENGAMBIL DATA BERDASARKAN INDEX KOLOM A, B, C, D di EXCEL
        let rowMonthRaw = String(row[0] || '');   // A: Bulan
        let segmen = String(row[2] || '');        // C: Segmen
        let dsrName = String(row[3] || '');       // D: DSR
        let customer = String(row[4] || '');      // E: Customer
        let brand = String(row[6] || '').toLowerCase(); // G: Brand
        let tier = String(row[7] || '').toLowerCase();  // H: Tier
        let noPo = String(row[8] || '');          // I: PO
        let noDo = String(row[9] || '').trim();   // J: DO
        let noInv = String(row[10] || '').trim(); // K: Invoice
        let volPO = parseCleanNum(row[11]);       // L: Vol PO
        let volDel = parseCleanNum(row[12]);      // M: Vol Delivered
        let remarks = String(row[13] || '').trim(); // N: Remarks
        
        let dsrKey = dsrName + "_" + segmen;
        if (!actualMap[dsrKey]) actualMap[dsrKey] = { all: 0, premium: 0, gadus: 0 };
        
        let statusOrder = "COMPLETED"; let isPending = false; let badgeColor = "#10B981"; 
        let standardRowDate = standardizeDate(rowMonthRaw);

        if (noDo === "" || noDo === "-" || noDo.toLowerCase() === "null" || noDo === "0") {
            statusOrder = "PO ON HAND"; badgeColor = "#3B82F6"; 
            totalPoOnHand += volPO; isPending = true;
        } else if (noInv === "" || noInv === "-" || noInv.toLowerCase() === "null" || noInv === "0") {
            statusOrder = "OS INVOICE"; badgeColor = "#F59E0B"; 
            totalOsInvoice += volDel; isPending = true;
            if(standardRowDate === currentSystemDate) {
                actualMap[dsrKey].all += volDel;
                if (tier.includes('premium')) actualMap[dsrKey].premium += volDel;
                if (brand.includes('gadus')) actualMap[dsrKey].gadus += volDel;
            }
        } else {
            if(standardRowDate === currentSystemDate) {
                totalDeliveredMonth += volDel;
                actualMap[dsrKey].all += volDel;
                if (tier.includes('premium')) actualMap[dsrKey].premium += volDel;
                if (brand.includes('gadus')) actualMap[dsrKey].gadus += volDel;
            }
        }

        if (isPending) {
            opsRenderCount++;
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 11px; color:#64748B; white-space:nowrap;">${rowMonthRaw || '-'}</td>
                <td style="min-width: 150px;"><strong style="color:var(--cpa-dark);">${customer || '-'}</strong></td>
                <td style="white-space:nowrap;">${dsrName || '-'}</td>
                <td style="font-family: monospace;">${noPo || '-'}</td>
                <td style="font-family: monospace;">${noDo === '' ? '-' : noDo}</td>
                <td style="font-weight: bold; color:var(--cpa-blue);">${formatVolume(volPO)}</td>
                <td><span style="background:${badgeColor}; color:#fff; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold; letter-spacing:0.5px; white-space:nowrap;">${statusOrder}</span></td>
                <td style="color:#DC2626; font-size:12px; font-weight:600; min-width:150px;">${remarks}</td>
            `;
            tbodyOps.appendChild(tr);
        }
    });

    if (opsRenderCount === 0 && opsData.length > 0) {
        tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color:#10B981; font-weight:600;">🎉 Semua order lancar. Tidak ada pending DO atau OS Invoice.</td></tr>`;
    }

    if (document.getElementById('ops-po-onhand')) document.getElementById('ops-po-onhand').textContent = formatVolume(totalPoOnHand) + " L";
    if (document.getElementById('ops-os-invoice')) document.getElementById('ops-os-invoice').textContent = formatVolume(totalOsInvoice) + " L";
    if (document.getElementById('ops-delivered')) document.getElementById('ops-delivered').textContent = formatVolume(totalDeliveredMonth) + " L";

    // --- 2. PROSES ACHIEVEMENT DSR ---
    let grandTgtAll = 0, grandActAll = 0, grandBaseAll = 0;
    let tgtRenderCount = 0;
    let foundMonths = [];

    targetData.forEach(tgt => {
        // MENGAMBIL DATA BERDASARKAN INDEX KOLOM A, B, C di EXCEL (TargetDSR)
        let rowMonthRaw = String(tgt[0] || '');   // A: Bulan
        let segmen = String(tgt[1] || '');        // B: Segmen
        let dsrName = String(tgt[2] || '');       // C: DSR Name

        let standardRowDate = standardizeDate(rowMonthRaw);
        foundMonths.push(rowMonthRaw);

        if (standardRowDate !== currentSystemDate) return; 
        
        tgtRenderCount++;
        let dsrKey = dsrName + "_" + segmen;
        let actual = actualMap[dsrKey] || { all: 0, premium: 0, gadus: 0 };

        // D: Target All(3), E: Base All(4), F: Target Prem(5), G: Base Prem(6), H: Target Gadus(7)
        let tgtAll = parseCleanNum(tgt[3]); 
        let baseAll = parseCleanNum(tgt[4]); 
        let tgtPrem = parseCleanNum(tgt[5]); 
        let tgtGadus = parseCleanNum(tgt[7]); 

        grandTgtAll += tgtAll; grandActAll += actual.all; grandBaseAll += baseAll;

        let pctAll = tgtAll > 0 ? (actual.all / tgtAll) * 100 : 0;
        let pctPrem = tgtPrem > 0 ? (actual.premium / tgtPrem) * 100 : 0;
        let pctGadus = tgtGadus > 0 ? (actual.gadus / tgtGadus) * 100 : 0;

        const progressBar = (pct, act, tgtAmount) => `
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span style="font-weight:bold; color:${pct >= 100 ? '#10B981' : '#334155'}">${pct.toFixed(1)}%</span>
                <span style="color:#64748B; white-space:nowrap;">${formatVolume(act)} / ${formatVolume(tgtAmount)}</span>
            </div>
            <div style="width:100%; background:#E2E8F0; border-radius:4px; height:8px; overflow:hidden;">
                <div style="height:100%; width:${Math.min(pct, 100)}%; background:${pct >= 100 ? '#10B981' : '#3B82F6'}; border-radius:4px;"></div>
            </div>
        `;

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 12px 16px; white-space:nowrap;"><strong>${dsrName}</strong></td>
            <td style="padding: 12px 16px;"><span style="font-size:11px; font-weight:600; padding:4px 8px; background:#F1F5F9; border-radius:6px; color:var(--cpa-dark); white-space:nowrap;">${segmen}</span></td>
            <td style="padding: 12px 16px; min-width: 130px;">${progressBar(pctAll, actual.all, tgtAll)}</td>
            <td style="padding: 12px 16px; min-width: 130px;">${progressBar(pctPrem, actual.premium, tgtPrem)}</td>
            <td style="padding: 12px 16px; min-width: 130px;">${progressBar(pctGadus, actual.gadus, tgtGadus)}</td>
        `;
        tbodyAch.appendChild(tr);
    });

    const titleEl = document.querySelector('#tab-operations .chart-box h3');
    if (titleEl) titleEl.innerHTML = `DSR Target Achievement (${displayMonthName})`;

    if (tgtRenderCount === 0) {
        let uniqueMonths = [...new Set(foundMonths)].filter(x=>x).slice(0,5).join(", ");
        if (targetData.length === 0) {
            tbodyAch.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#F59E0B; font-weight:bold;">⚠️ Data sedang diunduh atau kosong...</td></tr>`;
        } else {
            tbodyAch.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#DC2626;">Bulan <b>Juni 2026</b> tidak ada. Yang terbaca: <b>${uniqueMonths}</b></td></tr>`;
        }
    }

    let companyPct = grandTgtAll > 0 ? (grandActAll / grandTgtAll) * 100 : 0;
    let growthYoY = grandBaseAll > 0 ? ((grandActAll - grandBaseAll) / grandBaseAll) * 100 : 0;

    const achEl = document.getElementById('ops-achievement');
    const growthEl = document.getElementById('ops-growth');
    if (achEl) { achEl.textContent = companyPct.toFixed(1) + "%"; achEl.style.color = companyPct >= 100 ? '#10B981' : '#DD0000'; }
    if (growthEl) { growthEl.textContent = `YoY Growth: ${growthYoY > 0 ? '▲ +' : '▼ '}${growthYoY.toFixed(1)}%`; growthEl.style.color = growthYoY > 0 ? '#10B981' : '#DD0000'; }
}
