        const SUPABASE_BASE_URL = "https://zaueuvplevtgkthqifsk.supabase.co";
        const SUPABASE_KEY = "sb_publishable_27mT7S6Eo9cBKN6xmujYqg_y2T20wSf";
        const authHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
        // --- PEMBANTU KEAMANAN TEKS (ANTI-XSS) ---
        function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
        function escapeJsString(s) { return escapeHtml(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r\n|\r|\n/g, '\\n')); }


        let globalUsersCache = [];

        window.onload = function() {
            if(sessionStorage.getItem('admin_auth_kebun') === 'true' && sessionStorage.getItem('admin_sandi_kebun')) {
                masukAdmin();
            }
        };

        function sandiAdmin() { return sessionStorage.getItem('admin_sandi_kebun') || ''; }

        async function panggilRpc(namaFungsi, isi) {
            const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/rpc/${namaFungsi}`, { method: 'POST', headers: authHeaders, body: JSON.stringify(isi || {}) });
            if(!res.ok) throw new Error("Server menolak permintaan.");
            return res.json();
        }

        async function checkFallbackAuth() {
            const pwd = document.getElementById('fallbackPassword').value;
            if(!pwd) return tunjukkanToast("Isi kata sandi admin dulu!", "warning");
            try {
                const leres = await panggilRpc('cek_admin', { p_sandi: pwd });
                if(leres === true) { sessionStorage.setItem('admin_auth_kebun', 'true'); sessionStorage.setItem('admin_sandi_kebun', pwd); masukAdmin(); }
                else { tunjukkanToast("Kata Sandi Salah!", "error"); }
            } catch(e) { tunjukkanToast("Tidak bisa tersambung ke server.", "error"); }
        }

        function masukAdmin() {
            document.getElementById('authOverlay').classList.add('hidden');
            document.getElementById('mainAdmin').classList.remove('hidden');
            muatDataAkun();
        }

        function keluarAdmin() {
            sessionStorage.removeItem('admin_auth_kebun');
            sessionStorage.removeItem('admin_sandi_kebun');
            window.location.href = 'index.html';
        }

        function gantiTab(tId) {
            ['akun', 'tanaman', 'pengumuman', 'log'].forEach(s => document.getElementById(`section-${s}`).classList.add('hidden'));
            document.getElementById(`section-${tId}`).classList.remove('hidden');
            ['akun', 'tanaman', 'pengumuman', 'log'].forEach(t => { 
                document.getElementById(`tab-${t}`).className = t === tId ? "px-4 py-2 rounded-lg font-bold bg-white text-slate-900 transition-all shrink-0 shadow-sm" : "px-4 py-2 rounded-lg font-bold text-slate-300 hover:text-white transition-all shrink-0"; 
            });
            if(tId === 'akun') muatDataAkun();
            if(tId === 'tanaman') muatDataTanaman();
            if(tId === 'pengumuman') muatDataPengumuman();
            if(tId === 'log') {
                muatDataChat();
                muatLogMasuk();
            }
        }

        // --- TAB 1: DATA AKUN & MANAJEMEN PERAN ---
        async function muatDataAkun() {
            const load = document.getElementById('akunLoading'); const empty = document.getElementById('akunEmpty'); const grid = document.getElementById('akunGrid');
            load.classList.remove('hidden'); empty.classList.add('hidden'); grid.innerHTML = '';
            try {
                const data = await panggilRpc('admin_daftar_pengguna', { p_sandi_admin: sandiAdmin() });
                globalUsersCache = data; 
                load.classList.add('hidden');
                if(data.length === 0) { empty.classList.remove('hidden'); return; }
                
                let html = '';
                data.forEach(user => {
                    const tgl = user.dibuat_pada ? new Date(user.dibuat_pada).toLocaleDateString('id-ID') : '-';
                    const role = user.peran || 'Anggota';
                    html += `
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 relative space-y-3 shadow-sm">
                        <div class="absolute top-2 right-2 text-[9px] text-slate-400 font-bold"><i class="fa-regular fa-calendar mr-1"></i>${tgl}</div>
                        <h4 class="font-black text-sm text-slate-800 mt-1 flex items-center"><i class="fa-solid fa-user mr-1.5 text-emerald-600"></i>${escapeHtml(user.nama_panggero)}</h4>
                        
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div class="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                                <span class="text-[9px] text-slate-400 font-bold uppercase">Sandi</span>
                                <span class="font-semibold text-slate-400 tracking-wide"><i class="fa-solid fa-lock mr-1"></i>Aman (terenkripsi)</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                                <span class="text-[9px] text-slate-400 font-bold uppercase">Jabatan</span>
                                <select onchange="updatePeranAkun('${user.id}', this.value)" class="font-bold text-emerald-700 bg-transparent border-none focus:outline-none p-0 cursor-pointer text-xs">
                                    <option value="Anggota" ${role === 'Anggota' ? 'selected' : ''}>Anggota</option>
                                    <option value="Ketua" ${role === 'Ketua' ? 'selected' : ''}>Ketua</option>
                                    <option value="Admin" ${role === 'Admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="flex justify-between items-center text-[10px] pt-1 border-t border-slate-150">
                            <button onclick="openEditSandiModal('${user.id}', '${escapeJsString(user.nama_panggero)}')" class="text-emerald-600 hover:text-emerald-800 font-bold transition-all"><i class="fa-solid fa-key mr-1"></i>Ganti Sandi</button>
                            <button onclick="hapusAkun('${user.id}', '${escapeJsString(user.nama_panggero)}')" class="font-bold text-rose-500 hover:text-rose-700 transition-all"><i class="fa-solid fa-trash-can mr-1"></i>Hapus Akun</button>
                        </div>
                    </div>`;
                });
                grid.innerHTML = html;
            } catch(e) { load.classList.add('hidden'); tunjukkanToast("Gagal mengambil data akun.", "error"); }
        }

        // PENYELASAN DETAIL ERROR JIKA JABATAN GAGAL DIUBAH
        async function updatePeranAkun(id, peranBaru) {
            try {
                const hasilPeran = await panggilRpc('admin_atur_peran', { p_sandi_admin: sandiAdmin(), p_id: id, p_peran_baru: peranBaru });
                if(hasilPeran !== true) throw new Error("Server menolak perubahan jabatan.");
                
                tunjukkanToast(`Jabatan diubah menjadi ${peranBaru}!`, "success");
                muatDataAkun();
            } catch(e) { 
                console.error("Kesalahan Perubahan Peran:", e);
                // Menampilkan alasan kegagalan asli secara transparan
                tunjukkanToast("Gagal mengubah jabatan: " + e.message, "error"); 
            }
        }

        function openEditSandiModal(id, name) {
            document.getElementById('modalUserId').value = id;
            document.getElementById('modalUsername').innerText = name;
            document.getElementById('modalNewPassword').value = '';
            const m = document.getElementById('editSandiModal');
            m.classList.remove('hidden');
            setTimeout(() => m.classList.add('opacity-100'), 10);
        }

        function closeEditSandiModal() {
            const m = document.getElementById('editSandiModal');
            m.classList.remove('opacity-100');
            setTimeout(() => m.classList.add('hidden'), 200);
        }

        async function eksekusiGantiSandi() {
            const id = document.getElementById('modalUserId').value;
            const newPwd = document.getElementById('modalNewPassword').value.trim();
            if(!newPwd) return tunjukkanToast("Kata sandi tidak boleh kosong!", "warning");
            try {
                const hasilSandi = await panggilRpc('admin_atur_sandi', { p_sandi_admin: sandiAdmin(), p_id: id, p_sandi_baru: newPwd });
                if(hasilSandi !== true) throw new Error();
                tunjukkanToast("Kata sandi berhasil diperbarui!", "success");
                closeEditSandiModal();
                muatDataAkun();
            } catch(e) { tunjukkanToast("Gagal mengubah kata sandi.", "error"); }
        }

        async function hapusAkun(id, nama) {
            if(!confirm(`Apakah benar Ibu ingin menghapus akun "${nama}"? Data tanamannya tidak akan hilang, hanya saja ia tidak bisa masuk lagi.`)) return;
            try {
                const hasilHapus = await panggilRpc('admin_hapus_pengguna', { p_sandi_admin: sandiAdmin(), p_id: id });
                if(hasilHapus !== true) throw new Error();
                tunjukkanToast(`Akun ${nama} sudah dihapus.`, "success");
                muatDataAkun();
            } catch(e) { tunjukkanToast("Gagal menghapus akun.", "error"); }
        }

        // --- TAB 2: DATA TANAMAN & ALIH KEPEMILIKAN ---
        async function muatDataTanaman() {
            const load = document.getElementById('tanamanLoading'); const empty = document.getElementById('tanamanEmpty'); const list = document.getElementById('tanamanList');
            load.classList.remove('hidden'); empty.classList.add('hidden'); list.innerHTML = '';
            try {
                if(globalUsersCache.length === 0) {
                    try { globalUsersCache = await panggilRpc('admin_daftar_pengguna', { p_sandi_admin: sandiAdmin() }); } catch(e) {}
                }

                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/plant_farm?select=*&order=plant_name.asc`, { headers: authHeaders });
                if(!res.ok) throw new Error();
                const plants = await res.json();
                load.classList.add('hidden');
                if(plants.length === 0) { empty.classList.remove('hidden'); return; }
                
                let html = '';
                plants.forEach(plant => {
                    let optionsHTML = globalUsersCache.map(u => {
                        return `<option value="${escapeHtml(u.nama_panggero)}" ${plant.pemilik === u.nama_panggero ? 'selected' : ''}>${escapeHtml(u.nama_panggero)}</option>`;
                    }).join('');

                    html += `
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-all">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm"><i class="fa-solid fa-seedling"></i></div>
                            <div>
                                <h4 class="font-black text-slate-800 text-xs">${escapeHtml(plant.plant_name)}</h4>
                                <p class="text-[9px] text-slate-400 font-bold">Kategori: ${escapeHtml(plant.category || 'Sayuran Daun')} • Status: ${escapeHtml(plant.status)}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2 text-xs">
                            <span class="text-[10px] text-slate-500 font-bold">Milik:</span>
                            <select onchange="transferKepemilikan('${plant.id}', this.value)" class="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg px-2 py-1.5 focus:outline-emerald-600 focus:bg-white cursor-pointer shadow-sm">
                                ${optionsHTML}
                            </select>
                        </div>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) { load.classList.add('hidden'); tunjukkanToast("Gagal mengambil data tanaman.", "error"); }
        }

        async function transferKepemilikan(plantId, newOwner) {
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/plant_farm?id=eq.${plantId}`, {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ pemilik: newOwner })
                });
                if(!res.ok) throw new Error();
                tunjukkanToast("Kepemilikan tanaman berhasil dipindahkan!", "success");
                muatDataTanaman();
            } catch(e) { tunjukkanToast("Gagal memindahkan kepemilikan.", "error"); }
        }

        // --- TAB 3: PENGUMUMAN ---
        async function muatDataPengumuman() {
            const load = document.getElementById('pengumumanLoading'); const empty = document.getElementById('pengumumanEmpty'); const list = document.getElementById('pengumumanList');
            load.classList.remove('hidden'); empty.classList.add('hidden'); list.innerHTML = '';
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/pengumuman_kebun?select=*&order=id.desc`, { headers: authHeaders });
                if(!res.ok) throw new Error();
                const data = await res.json();
                load.classList.add('hidden');
                if(data.length === 0) { empty.classList.remove('hidden'); return; }
                
                let html = '';
                data.forEach(p => {
                    const statusBadge = p.aktif ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Aktif</span>` : `<span class="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">Arsip</span>`;
                    html += `
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-start gap-3 shadow-sm">
                        <div class="flex-1"><p class="text-slate-700 font-medium leading-relaxed">${escapeHtml(p.pesan)}</p><div class="mt-2">${statusBadge}</div></div>
                        <button onclick="hapusPengumuman('${p.id}')" class="text-rose-500 hover:text-rose-700 p-1 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) { load.classList.add('hidden'); tunjukkanToast("Gagal mengambil riwayat pengumuman.", "error"); }
        }

        async function simpanPengumuman() {
            const pesan = document.getElementById('inputPengumuman').value.trim();
            if(!pesan) return tunjukkanToast("Pesan pengumuman harus diisi dulu!", "warning");
            const btn = document.getElementById('btnSimpanPengumuman'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Sedang Mengirim...';
            try {
                await fetch(`${SUPABASE_BASE_URL}/rest/v1/pengumuman_kebun?aktif=eq.true`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ aktif: false }) });
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/pengumuman_kebun`, { method: 'POST', headers: { ...authHeaders, 'Prefer': 'return=representation' }, body: JSON.stringify({ pesan: pesan, aktif: true }) });
                if(!res.ok) throw new Error();
                tunjukkanToast("Pengumuman berhasil disebarkan!", "success");
                document.getElementById('inputPengumuman').value = ""; muatDataPengumuman();
            } catch(e) { tunjukkanToast("Gagal mengirim pengumuman.", "error"); }
            finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Sebarkan sekarang</span>'; }
        }

        async function hapusPengumuman(id) {
            if(!confirm("Apakah benar ingin menghapus pengumuman ini?")) return;
            try {
                await fetch(`${SUPABASE_BASE_URL}/rest/v1/pengumuman_kebun?id=eq.${id}`, { method: 'DELETE', headers: authHeaders });
                tunjukkanToast("Pengumuman dihapus.", "success"); muatDataPengumuman();
            } catch(e) { tunjukkanToast("Gagal menghapus pengumuman.", "error"); }
        }

        // --- TAB 4: MODERASI CHAT NYI SARI & LOG MASUK ---
        async function muatDataChat() {
            const load = document.getElementById('chatLoading'); const empty = document.getElementById('chatEmpty'); const list = document.getElementById('chatList');
            load.classList.remove('hidden'); empty.classList.add('hidden'); list.innerHTML = '';
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat?select=*&order=id.desc`, { headers: authHeaders });
                if(!res.ok) throw new Error();
                const chats = await res.json();
                load.classList.add('hidden');
                if(chats.length === 0) { empty.classList.remove('hidden'); return; }
                
                let html = '';
                chats.forEach(c => {
                    const isAi = c.is_ai;
                    html += `
                    <div class="p-2.5 rounded-xl border text-[11px] relative flex justify-between items-start gap-3 shadow-sm ${isAi ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}">
                        <div class="flex-1 pr-4">
                            <span class="font-black block text-[10px] ${isAi ? 'text-emerald-700' : 'text-slate-700'}">${escapeHtml(c.sender)} ${isAi ? '✨ (AI)' : ''}</span>
                            <p class="text-slate-600 font-medium mt-0.5 leading-relaxed">${escapeHtml(c.message)}</p>
                        </div>
                        <button onclick="hapusChat('${c.id}')" class="text-rose-500 hover:text-rose-750 p-1 transition-colors" title="Hapus Obrolan"><i class="fa-solid fa-xmark text-xs font-bold"></i></button>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) { load.classList.add('hidden'); tunjukkanToast("Gagal mengambil obrolan.", "error"); }
        }

        async function hapusChat(id) {
            if(!confirm("Apakah Ibu benar ingin menghapus pesan obrolan ini?")) return;
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat?id=eq.${id}`, { method: 'DELETE', headers: authHeaders });
                if(!res.ok) throw new Error();
                tunjukkanToast("Pesan obrolan sudah dihapus.", "success");
                muatDataChat();
            } catch(e) { tunjukkanToast("Gagal menghapus obrolan.", "error"); }
        }

        async function muatLogMasuk() {
            const load = document.getElementById('logLoading'); const empty = document.getElementById('logEmpty'); const list = document.getElementById('logList');
            load.classList.remove('hidden'); empty.classList.add('hidden'); list.innerHTML = '';
            try {
                const logs = (await panggilRpc('admin_riwayat_masuk', { p_sandi_admin: sandiAdmin() })).slice(0, 25);
                load.classList.add('hidden');
                if(logs.length === 0) { empty.classList.remove('hidden'); return; }
                
                let html = '';
                logs.forEach(l => {
                    const waktu = new Date(l.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " WIB";
                    const tgl = new Date(l.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    html += `
                    <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-150 flex justify-between items-center text-[10px] font-bold text-slate-700 shadow-sm hover:border-slate-200 transition-all">
                        <div class="flex items-center space-x-2">
                            <i class="fa-solid fa-right-to-bracket text-purple-500"></i>
                            <span>${escapeHtml(l.nama_panggero)}</span>
                        </div>
                        <div class="text-slate-400 font-medium">
                            <span class="bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded text-[9px] mr-1.5">${tgl}</span>
                            <span>${waktu}</span>
                        </div>
                    </div>`;
                });
                list.innerHTML = html;
            } catch(e) { load.classList.add('hidden'); empty.classList.remove('hidden'); }
        }

        async function hapusSemuaLog() {
            if(!confirm("Apakah benar Ibu ingin menghapus semua riwayat log masuk hari ini?")) return;
            try {
                const hasilLog = await panggilRpc('admin_bersihkan_log', { p_sandi_admin: sandiAdmin() });
                if(hasilLog !== true) throw new Error();
                tunjukkanToast("Semua log sudah dihapus.", "success");
                muatLogMasuk();
            } catch(e) { tunjukkanToast("Gagal menghapus log masuk.", "error"); }
        }

        // --- TOAST NOTIFICATION UTILITY ---
        function tunjukkanToast(msg, tipe) {
            const t = document.getElementById('toast'); const i = document.getElementById('toastIcon'); document.getElementById('toastMessage').innerText = msg;
            if (tipe === 'success') i.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i>'; else if (tipe === 'warning') i.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>'; else i.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-400"></i>';
            t.style.opacity = '1'; t.style.pointerEvents = 'auto'; setTimeout(() => { t.style.opacity = '0'; t.style.pointerEvents = 'none'; }, 5000); // Durasi dipanjangkeun ka 5 detik supados kabaca leres
        }
