// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://nuobbttqtsiizilzerbq.supabase.co';
// Masukkan Publishable Key (anon key) milikmu di dalam tanda kutip di bawah ini
const SUPABASE_ANON_KEY = 'sb_publishable_TrmIvDbcQImz-kL7-2Kiqw_NAsFopHX'; 

// Inisialisasi client Supabase secara aman
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. TAMPILAN & UTILS
// ==========================================
let activeBorrowers = [];
let currentSelectedBorrower = null;
let currentActionType = '';

// Fungsi Buka / Tutup Modal Modal Melayang
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Format Angka ke Rupiah Bertitik
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka);
};

// Pembersihan Input Karakter Non-Angka
const cleanNumberInput = (value) => {
    return value.replace(/\D/g, '').replace(/^0+/, '') || '';
};

// Set Minimal Tanggal Hari Ini
const setMinDateToday = () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('input-date');
    if (dateInput) dateInput.setAttribute('min', today);
};

// Penentuan Badge Status Tanggal
const getStatusBadge = (dueDateStr) => {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `<span class="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-1 rounded-md font-bold">Overdue</span>`;
    } else if (diffDays <= 3) {
        return `<span class="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-1 rounded-md font-bold">H-${diffDays}</span>`;
    } else {
        return `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-md font-bold">Aktif</span>`;
    }
};

// Setup Input Otomatis Format Rupiah saat Di-Ketik
const setupRupiahInput = (inputId) => {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('input', function(e) {
            let rawValue = cleanNumberInput(e.target.value);
            e.target.value = rawValue ? formatRupiah(rawValue) : '';
        });
    }
};

// ==========================================
// 3. LOGIKA AKSI & AMBIL DATA
// ==========================================

async function fetchLoans() {
    try {
        const { data, error } = await supabaseClient
            .from('borrowers')
            .select(`
                *,
                loan_histories (*)
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        activeBorrowers = data || [];
        renderDashboard();
    } catch (err) {
        console.error("Gagal mengambil data:", err.message);
    }
}

function renderDashboard() {
    const container = document.getElementById('card-container');
    const dashboardTotal = document.getElementById('dashboard-total');
    let totalAll = 0;
    container.innerHTML = '';

    if (activeBorrowers.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 text-sm mt-10">Belum ada data pinjaman aktif.</p>`;
        dashboardTotal.innerText = 'Rp 0';
        return;
    }

    activeBorrowers.forEach(b => {
        totalAll += Number(b.total_debt);
        
        let historyHTML = (b.loan_histories || []).map(h => {
            const isPay = h.type === 'pay';
            const color = isPay ? 'text-emerald-600' : 'text-slate-700';
            const prefix = isPay ? '-' : '+';
            const dateStr = new Date(h.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
            return `
                <div class="flex justify-between items-start py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                        <p class="text-xs text-slate-400">${dateStr}</p>
                        <p class="text-sm font-medium text-slate-600">${h.reason}</p>
                    </div>
                    <p class="text-sm font-bold ${color}">${prefix} Rp ${formatRupiah(h.amount)}</p>
                </div>
            `;
        }).join('');

        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100";
        card.onclick = () => showDetail(b.id);
        
        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-slate-900">${b.name}</h3>
                ${getStatusBadge(b.due_date)}
            </div>
            <div class="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
                ${historyHTML}
            </div>
            <div class="flex justify-between items-end">
                <div>
                    <p class="text-xs text-slate-500 font-medium">Batas Pelunasan</p>
                    <p class="text-sm font-semibold text-slate-700">${new Date(b.due_date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-500 font-medium">Sisa Hutang</p>
                    <p class="text-lg font-extrabold text-blue-600">Rp ${formatRupiah(b.total_debt)}</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    dashboardTotal.innerText = `Rp ${formatRupiah(totalAll)}`;
}

// Handler Submit Transaksi Awal
document.getElementById('form-add-initial').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('input-name').value.trim();
    const amountStr = document.getElementById('input-amount').value;
    const amount = Number(amountStr.replace(/\./g, ''));
    const reason = document.getElementById('input-reason').value.trim();
    const dueDate = document.getElementById('input-date').value;

    if (amount <= 0) return alert("Nominal tidak valid.");

    try {
        const existing = activeBorrowers.find(b => b.name.toLowerCase() === name.toLowerCase());

        if (existing) {
            const newTotal = Number(existing.total_debt) + amount;
            await supabaseClient.from('borrowers').update({ total_debt: newTotal }).eq('id', existing.id);
            await supabaseClient.from('loan_histories').insert({
                borrower_id: existing.id,
                amount: amount,
                reason: reason,
                type: 'borrow'
            });
        } else {
            const { data: newBorrower, error } = await supabaseClient.from('borrowers').insert({
                name: name,
                due_date: dueDate,
                total_debt: amount
            }).select().single();

            if (error) throw error;

            await supabaseClient.from('loan_histories').insert({
                borrower_id: newBorrower.id,
                amount: amount,
                reason: reason,
                type: 'borrow'
            });
        }

        e.target.reset();
        closeModal('modal-add-initial');
        fetchLoans();

    } catch (err) {
        alert("Terjadi kesalahan: " + err.message);
    }
});

function showDetail(id) {
    currentSelectedBorrower = activeBorrowers.find(b => b.id === id);
    document.getElementById('detail-name').innerText = currentSelectedBorrower.name;
    document.getElementById('detail-sisa').innerText = `Rp ${formatRupiah(currentSelectedBorrower.total_debt)}`;
    openModal('modal-detail');
}

function openActionModal(type) {
    currentActionType = type;
    closeModal('modal-detail');
    
    const title = document.getElementById('action-title');
    const btn = document.getElementById('action-submit-btn');
    const reasonContainer = document.getElementById('action-reason-container');
    const reasonInput = document.getElementById('action-reason');
    
    document.getElementById('form-action').reset();

    if (type === 'pay') {
        title.innerText = 'Bayar Pinjaman';
        btn.className = 'flex-1 py-2 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all';
        reasonContainer.classList.add('hidden');
        reasonInput.removeAttribute('required');
    } else {
        title.innerText = 'Tambah Pinjaman Baru';
        btn.className = 'flex-1 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all';
        reasonContainer.classList.remove('hidden');
        reasonInput.setAttribute('required', 'true');
    }

    openModal('modal-action-form');
}

document.getElementById('form-action').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const amountStr = document.getElementById('action-amount').value;
    const amount = Number(amountStr.replace(/\./g, ''));
    const reason = document.getElementById('action-reason').value || 'Pembayaran Pinjaman';
    let currentDebt = Number(currentSelectedBorrower.total_debt);

    if (amount <= 0) return alert("Nominal tidak valid.");

    if (currentActionType === 'pay' && amount > currentDebt) {
        alert("Jumlah yang diisi melebihi sisa pinjaman!");
        return;
    }

    try {
        let newTotal = currentActionType === 'pay' ? currentDebt - amount : currentDebt + amount;
        let status = newTotal === 0 ? 'paid' : 'active';

        await supabaseClient.from('borrowers').update({ 
            total_debt: newTotal,
            status: status 
        }).eq('id', currentSelectedBorrower.id);

        await supabaseClient.from('loan_histories').insert({
            borrower_id: currentSelectedBorrower.id,
            amount: amount,
            reason: reason,
            type: currentActionType === 'pay' ? 'pay' : 'borrow'
        });

        if (status === 'paid') {
            alert("Pinjaman Telah Lunas!");
        }

        closeModal('modal-action-form');
        fetchLoans();

    } catch (err) {
        alert("Terjadi kesalahan: " + err.message);
    }
});

// Inisialisasi awal saat script selesai dibaca
setupRupiahInput('input-amount');
setupRupiahInput('action-amount');
setMinDateToday();
fetchLoans();