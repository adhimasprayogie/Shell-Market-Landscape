export const parseNum = val => {
    if (!val || val === '-') return 0;
    let num = parseFloat(val.toString().replace(/[^0-9.-]+/g,""));
    return isNaN(num) ? 0 : num;
};

export function formatRupiah(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

export function formatVolume(num) {
    if (num === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(num);
}

export function showSkeletonLoading() {
    document.getElementById('kpi-volume').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-accounts').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    document.getElementById('kpi-competitor').innerHTML = '<div class="skeleton skeleton-kpi"></div>';
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    for(let i = 0; i < 5; i++) {
        tableBody.innerHTML += `<tr><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div></td><td><div class="skeleton skeleton-text" style="width: 100%;"></div><div class="skeleton skeleton-text" style="width: 60%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 70%; margin: 0 auto;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div><div class="skeleton skeleton-text" style="width: 50%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td><div class="skeleton skeleton-text" style="width: 80%;"></div></td><td class="hide-mobile"><div class="skeleton skeleton-text" style="width: 90%;"></div><div class="skeleton skeleton-text" style="width: 70%; height: 10px;"></div></td><td><div class="skeleton skeleton-text" style="width: 100%;"></div></td><td><div class="skeleton skeleton-btn"></div></td></tr>`;
    }
}

export function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

export function showCustomModal(issue, info, top) {
    document.getElementById('modal-issue').textContent = issue || '-';
    document.getElementById('modal-info').textContent = info || '-';
    document.getElementById('modal-top').textContent = top || '-';
    document.getElementById('custom-modal').classList.add('show');
}

export function closeCustomModal() { document.getElementById('custom-modal').classList.remove('show'); }
export function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
