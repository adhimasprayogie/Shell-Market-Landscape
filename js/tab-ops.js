import { state } from './state.js';
import { formatVolume } from './utils.js';

const parseIndoNum = (val) => {
    let str = String(val || '0').split(',')[0];
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
        tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color:#DC2626; font-weight:bold;">❌ Google Sheets belum selesai memproses data.<br><span style="font-size:12px; font-weight:normal;">Tunggu 5 menit lagi, lalu lakukan Hard Refresh (Ctrl + F5).</span></td></tr>`;
        return;
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const today = new Date();
    const currentSystemMonth = monthNames[today.getMonth()] + " " + today.getFullYear(); // Output: "Jun 2026"

    const isMatchMonth = (dataMonth, targetMonth) => {
        if(!dataMonth || !targetMonth) return false;
        let d = String(dataMonth).toLowerCase().replace(/[^a-z0-9]/g, '');
        let t = String(targetMonth).toLowerCase().replace(/[^a-z0-9]/g, '');
        return d.includes(t.substring(0,3)) && d.includes(today.getFullYear().toString().substring(2)); 
    };

    if (filterSegmen && filterSegmen.toLowerCase() !== "semua segmen") {
        opsData = opsData.filter(d => String(d['Segmen'] || '').toLowerCase() === filterSegmen.toLowerCase());
        targetData = targetData.filter(d => String(d['Segmen'] || '').toLowerCase() === filterSegmen.toLowerCase());
    }

    let totalPoOnHand = 0; let totalOsInvoice = 0; let totalDeliveredMonth = 0;
    let actualMap = {}; 
    let opsRenderCount = 0;

    // 1. PROSES TABEL OPERASIONAL
    opsData.forEach(row => {
        const getVal = (key1, key2) => row[key1] !== undefined ? row[key1] : (row[key2] !== undefined ? row[key2] : '');

        let noDo = String(getVal('No DO', 'No DO ')).trim();
        let noInv = String(getVal('No Invoice', 'No Invoice ')).trim();
        let remarks = String(getVal('Remarks', 'Remarks ')).trim();
        let rowMonth = String(getVal('Bulan', 'Bulan '));
        let dsrName = getVal('DSR Name', 'DSR Name ');
        let customer = getVal('Nama Customer', 'Nama Customer ');
        let noPo = getVal('No PO', 'No PO ');
        
        let volPO = parseIndoNum(getVal('Volume PO( (L)', 'Volume PO (L)'));
        let volDel = parseIndoNum(getVal('Volume Delivered (L)', 'Volume Delivered (L) '));
        
        let dsrKey = (dsrName || 'Unknown') + "_" + (row['Segmen'] || 'Unknown');
        if (!actualMap[dsrKey]) actualMap[dsrKey] = { all: 0, premium: 0, gadus: 0 };
        
        let tier = String(getVal('Tier Produk', 'Tier Produk ')).toLowerCase();
        let brand = String(getVal('Brand Produk', 'Brand Produk ')).toLowerCase();

        let statusOrder = "COMPLETED"; let isPending = false; let badgeColor = "#10B981"; 

        if (noDo === "" || noDo === "-" || noDo.toLowerCase() === "null") {
            statusOrder = "PO ON HAND"; badgeColor = "#3B82F6"; 
            totalPoOnHand += volPO; isPending = true;
        } else if (noInv === "" || noInv === "-" || noInv.toLowerCase() === "null") {
            statusOrder = "OS INVOICE"; badgeColor = "#F59E0B"; 
            totalOsInvoice += volDel; isPending = true;
            if(isMatchMonth(rowMonth, currentSystemMonth)) {
                actualMap[dsrKey].all += volDel;
                if (tier.includes('premium')) actualMap[dsrKey].premium += volDel;
                if (brand.includes('gadus')) actualMap[dsrKey].gadus += volDel;
            }
        } else {
            if(isMatchMonth(rowMonth, currentSystemMonth)) {
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
                <td style="font-size: 11px; color:#64748B;">${rowMonth || '-'}</td>
                <td><strong style="color:var(--cpa-dark);">${customer || '-'}</strong></td>
                <td>${dsrName || '-'}</td>
                <td style="font-family: monospace;">${noPo || '-'}</td>
                <td style="font-family: monospace;">${noDo === '' ? '-' : noDo}</td>
                <td style="font-weight: bold; color:var(--cpa-blue);">${formatVolume(volPO)}</td>
                <td><span style="background:${badgeColor}; color:#fff; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold; letter-spacing:0.5px;">${statusOrder}</span></td>
                <td style="color:#DC2626; font-size:12px; font-weight:600;">${remarks}</td>
            `;
            tbodyOps.appendChild(tr);
        }
    });

    if (opsRenderCount === 0) {
        if (opsData.length === 0) {
            tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color:#F59E0B; font-weight:bold;">⚠️ Data OperationalTracker masih kosong atau Google API sedang proses loading cache.<br>Tunggu 5 menit lagi ya!</td></tr>`;
        } else {
            tbodyOps.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color:#10B981; font-weight:600;">🎉 Semua order lancar. Tidak ada pending DO atau OS Invoice.</td></tr>`;
        }
    }

    if (document.getElementById('ops-po-onhand')) document.getElementById('ops-po-onhand').textContent = formatVolume(totalPoOnHand) + " L";
    if (document.getElementById('ops-os-invoice')) document.getElementById('ops-os-invoice').textContent = formatVolume(totalOsInvoice) + " L";
    if (document.getElementById('ops-delivered')) document.getElementById('ops-delivered').textContent = formatVolume(totalDeliveredMonth) + " L";

    // 2. PROSES ACHIEVEMENT DSR
    let grandTgtAll = 0, grandActAll = 0, grandBaseAll = 0;
    let tgtRenderCount = 0;

    targetData.forEach(tgt => {
        const getVal = (key1, key2, key3) => tgt[key1] !== undefined ? tgt[key1] : (tgt[key2] !== undefined ? tgt[key2] : (tgt[key3] !== undefined ? tgt[key3] : '0'));
        let dsrName = getVal('DSR Name', 'DSR Name ');
        let segmen = getVal('Segmen', 'Segmen ');
        let rowMonth = String(getVal('Bulan', 'Bulan '));

        if (!isMatchMonth(rowMonth, currentSystemMonth)) return; 
        tgtRenderCount++;
        
        let dsrKey = dsrName + "_" + segmen;
        let actual = actualMap[dsrKey] || { all: 0, premium: 0, gadus: 0 };

        let tgtAll = parseIndoNum(getVal('Target All Volume (L)', 'Target All Volume'));
        let tgtPrem = parseIndoNum(getVal('Target Premium (L)', 'Target Premium'));
        let tgtGadus = parseIndoNum(getVal('Target Gadus (L)', 'Target Gadus'));
        let baseAll = parseIndoNum(getVal('Baseline All Volume (L)', 'Base All Volume 25', 'Baseline All Volume'));

        grandTgtAll += tgtAll; grandActAll += actual.all; grandBaseAll += baseAll;

        let pctAll = tgtAll > 0 ? (actual.all / tgtAll) * 100 : 0;
        let pctPrem = tgtPrem > 0 ? (actual.premium / tgtPrem) * 100 : 0;
        let pctGadus = tgtGadus > 0 ? (actual.gadus / tgtGadus) * 100 : 0;

        const progressBar = (pct, act, tgtAmount) => `
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span style="font-weight:bold; color:${pct >= 100 ? '#10B981' : '#334155'}">${pct.toFixed(1)}%</span>
                <span style="color:#64748B;">${formatVolume(act)} / ${formatVolume(tgtAmount)} L</span>
            </div>
            <div style="width:100%; background:#E2E8F0; border-radius:4px; height:8px; overflow:hidden;">
                <div style="height:100%; width:${Math.min(pct, 100)}%; background:${pct >= 100 ? '#10B981' : '#3B82F6'}; border-radius:4px;"></div>
            </div>
        `;

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 12px 16px;"><strong>${dsrName}</strong></td>
            <td style="padding: 12px 16px;"><span style="font-size:11px; font-weight:600; padding:4px 8px; background:#F1F5F9; border-radius:6px; color:var(--cpa-dark);">${segmen}</span></td>
            <td style="padding: 12px 16px;">${progressBar(pctAll, actual.all, tgtAll)}</td>
            <td style="padding: 12px 16px;">${progressBar(pctPrem, actual.premium, tgtPrem)}</td>
            <td style="padding: 12px 16px;">${progressBar(pctGadus, actual.gadus, tgtGadus)}</td>
        `;
        tbodyAch.appendChild(tr);
    });

    const titleEl = document.querySelector('#tab-operations .chart-box h3');
    if (titleEl) titleEl.innerHTML = `DSR Target Achievement (${currentSystemMonth})`;

    if (tgtRenderCount === 0) {
        // DETEKTIF: Mencetak bulan apa saja yang berhasil dibaca oleh JavaScript dari Excel
        let availableMonths = [...new Set(targetData.map(t => String(t['Bulan'] || t['Bulan '] || 'Kosong')))].join(", ");
        
        if (targetData.length === 0) {
            tbodyAch.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#F59E0B; font-weight:bold;">⚠️ Data TargetDSR kosong. Menunggu Google API Cache...</td></tr>`;
        } else {
            tbodyAch.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#DC2626;">Belum ada target untuk <b>${currentSystemMonth}</b>.<br><span style="font-size:12px; color:#64748B;">Sistem membaca data bulan ini di Excel: <b>${availableMonths}</b></span></td></tr>`;
        }
    }

    let companyPct = grandTgtAll > 0 ? (grandActAll / grandTgtAll) * 100 : 0;
    let growthYoY = grandBaseAll > 0 ? ((grandActAll - grandBaseAll) / grandBaseAll) * 100 : 0;

    const achEl = document.getElementById('ops-achievement');
    const growthEl = document.getElementById('ops-growth');
    if (achEl) { achEl.textContent = companyPct.toFixed(1) + "%"; achEl.style.color = companyPct >= 100 ? '#10B981' : '#DD0000'; }
    if (growthEl) { growthEl.textContent = `YoY Growth: ${growthYoY > 0 ? '▲ +' : '▼ '}${growthYoY.toFixed(1)}%`; growthEl.style.color = growthYoY > 0 ? '#10B981' : '#DD0000'; }
}