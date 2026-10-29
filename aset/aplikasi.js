        const SUPABASE_BASE_URL = "https://zaueuvplevtgkthqifsk.supabase.co";
        const SUPABASE_KEY = "sb_publishable_27mT7S6Eo9cBKN6xmujYqg_y2T20wSf";
        const authHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
        // --- PEMBANTU KEAMANAN TEKS (ANTI-XSS) ---
        function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
        function escapeJsString(s) { return escapeHtml(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r\n|\r|\n/g, '\\n')); }


        
        let nyiSariStyle = 'sederhana'; // Default mode waleran singket

        // PERSONA NYI SARI ADAPTIF & LUWES
        function dapatkanNyiSariPersona() {
            let basePersona = `Kamu adalah Nyi Sari, asisten kebun komunitas yang baik hati, hangat, dan pintar soal bertani. 
            Selalu gunakan Bahasa Indonesia yang sopan, hangat, dan mudah dimengerti, penuh perhatian seperti kepada keluarga sendiri.
            Kamu harus mengenali orang yang sedang mengobrol berdasarkan nama di riwayat obrolan (contohnya: "Ibu Tati", "Teh Yani"). Jika ditanya siapa namamu, jawablah bahwa kamu "Nyi Sari".`;
            
            if (nyiSariStyle === 'sederhana') {
                basePersona += `\nMode jawabanmu saat ini adalah: SINGKAT & SEDERHANA. Jawablah dengan hangat, ramah, dan singkat (cukup 2-3 kalimat saja, jangan panjang-panjang).`;
            } else {
                basePersona += `\nMode jawabanmu saat ini adalah: JELAS, RINCI, DAN DETAIL. Jawablah dengan lengkap dan detail, pakai struktur poin-poin atau paragraf yang rapi supaya mudah dimengerti oleh ibu-ibu kebun soal cara menanam, pupuk, hama, atau pertanyaan lainnya.`;
            }
            return basePersona;
        }

        let allPlants = []; let filteredPlants = []; let nutritionData = [];
        let cuacaRingkasan = null;

        // --- LOKASI KEBUN: bawaan Cibeuti, bisa dipindah per perangkat ---
        const LOKASI_BAWAAN = { nama: "Cibeuti, Kawalu, Tasikmalaya", lat: -7.3793, lon: 108.1991 };
        let lokasiKebun = (() => { try { const t = JSON.parse(localStorage.getItem('ibu_kebun_lokasi')); if (t && typeof t.lat === 'number' && typeof t.lon === 'number' && t.nama) return t; } catch (e) {} return { nama: LOKASI_BAWAAN.nama, lat: LOKASI_BAWAAN.lat, lon: LOKASI_BAWAAN.lon }; })();
        function simpanLokasiKebun(lok) { lokasiKebun = lok; try { localStorage.setItem('ibu_kebun_lokasi', JSON.stringify(lok)); } catch (e) {} const el = document.getElementById('cuacaLokasiNama'); if (el) el.innerText = lok.nama; }
        function bukaModalLokasi() { const m = document.getElementById('modalLokasi'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10); }
        function tutupModalLokasi() { const m = document.getElementById('modalLokasi'); m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); }
        async function cariLokasiKebun() {
            const kata = document.getElementById('cariLokasiInput').value.trim();
            const wadah = document.getElementById('hasilLokasi'); if (!wadah) return;
            if (kata.length < 3) { wadah.innerHTML = '<p class="text-xs text-rose-500 font-bold">Ketik minimal 3 huruf.</p>'; return; }
            wadah.innerHTML = '<p class="text-xs text-stone-400">Mencari...</p>';
            try {
                const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(kata) + '&count=6&language=id&format=json');
                const data = await res.json();
                const hasil = (data && data.results) || [];
                if (!hasil.length) { wadah.innerHTML = '<p class="text-xs text-rose-500 font-bold">Tidak ditemukan. Coba nama kota terdekat.</p>'; return; }
                wadah.innerHTML = hasil.map(r => {
                    const bagian = [r.name, r.admin3, r.admin2, r.admin1, r.country];
                    const unik = bagian.filter((v, i) => v && bagian.indexOf(v) === i);
                    const nama = unik.join(', ');
                    return '<button onclick="pilihLokasiKebun(\'' + escapeJsString(nama) + '\', ' + r.latitude + ', ' + r.longitude + ')" class="w-full text-left bg-stone-50 hover:bg-sky-50 border border-stone-200 rounded-xl px-3 py-2.5 btn-press"><span class="block font-bold text-sm text-stone-800">' + escapeHtml(nama) + '</span><span class="block text-[11px] text-stone-400">' + r.latitude.toFixed(4) + ', ' + r.longitude.toFixed(4) + '</span></button>';
                }).join('');
            } catch (e) { wadah.innerHTML = '<p class="text-xs text-rose-500 font-bold">Pencarian gagal. Periksa sambungan internet.</p>'; }
        }
        function pilihLokasiKebun(nama, lat, lon) { simpanLokasiKebun({ nama: nama, lat: lat, lon: lon }); tutupModalLokasi(); ambilDataCuacaMeteo(); tunjukkanToast('Lokasi kebun dipindah ke ' + nama, 'success'); }
        function aturLokasiBawaan() { pilihLokasiKebun(LOKASI_BAWAAN.nama, LOKASI_BAWAAN.lat, LOKASI_BAWAAN.lon); }
        function pakaiGPSLokasi() {
            if (!navigator.geolocation) { tunjukkanToast('GPS tidak tersedia di perangkat ini.', 'error'); return; }
            navigator.geolocation.getCurrentPosition((pos) => { pilihLokasiKebun('Lokasi GPS Saya', Math.round(pos.coords.latitude * 10000) / 10000, Math.round(pos.coords.longitude * 10000) / 10000); }, () => { tunjukkanToast('Izin lokasi ditolak.', 'error'); });
        }

        // --- INDIKATOR WAKTU: fase bulan + hari pasaran (dihitung dari tanggal) ---
        function perbaruiIndikatorWaktu() {
            const kini = new Date();
            const namaHari = kini.toLocaleDateString('id-ID', { weekday: 'long' });
            const hariSejakEpoch = Math.floor(Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate()) / 86400000);
            const pasaran = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'][((hariSejakEpoch % 5) + 5) % 5];
            const elP = document.getElementById('indPasaran'); if (elP) elP.innerText = namaHari + ' ' + pasaran;
            const umurBulan = ((kini - new Date(Date.UTC(2000, 0, 6, 18, 14))) / 86400000) % 29.530588853;
            let fase, ikon;
            if (umurBulan < 1.8) { fase = 'Bulan Baru'; ikon = '🌑'; } else if (umurBulan < 7.4) { fase = 'Sabit Awal'; ikon = '🌒'; } else if (umurBulan < 9.2) { fase = 'Kuartal I'; ikon = '🌓'; } else if (umurBulan < 14.8) { fase = 'Cembung'; ikon = '🌔'; } else if (umurBulan < 16.6) { fase = 'Purnama'; ikon = '🌕'; } else if (umurBulan < 22.1) { fase = 'Cembung Akhir'; ikon = '🌖'; } else if (umurBulan < 23.9) { fase = 'Kuartal Akhir'; ikon = '🌗'; } else { fase = 'Sabit Akhir'; ikon = '🌘'; }
            const elB = document.getElementById('indBulan'); if (elB) elB.innerText = ikon + ' ' + fase;
        }

        // --- INDIKATOR PANEN: tanaman yang panen dalam 7 hari ---
        function perbaruiIndikatorPanen() {
            const el = document.getElementById('indPanen'); if (!el) return;
            const kini = new Date(); kini.setHours(0, 0, 0, 0);
            const batas = new Date(kini); batas.setDate(batas.getDate() + 7);
            let n = 0;
            allPlants.forEach(p => { if (p.est_panen_date && p.status !== 'Panen' && p.status !== 'Gagal') { const t = new Date(p.est_panen_date); if (t >= kini && t <= batas) n++; } });
            el.innerText = n + ' tanaman';
        }
        let currentTab = 'kebun'; let currentFilterStatus = 'Semua';
        let formSelectedFile = null; let doctorSelectedFile = null; let activeHapusId = null;
        let nutrisiDraftSaved = false; let currentUser = null;

        const DEFAULT_NUTRITION_RECIPES = [{ name: "Air Cucian Beras", benefit: "Menyuburkan bakteri baik di dalam tanah.", schedule: "Setiap Hari Senin", dosage: "Siramkan langsung air bilasan pertama." }];

        window.onload = function() { buatPartikelDaun(); inisialisasiKunciDefaultLokal(); aturSkalaHuruf(localStorage.getItem('ibu_kebun_skala_huruf') || 'sedang', false); perbaruiIndikatorWaktu(); pariksaStatusLogin(); };

        function buatPartikelDaun() {
            const container = document.getElementById('floatingLeaves'); const daunEmoji = ['🍃', '🌿', '☘️', '🍀', '🌱'];
            for (let i = 0; i < 12; i++) {
                const leaf = document.createElement('span'); leaf.className = 'leaf'; leaf.textContent = daunEmoji[Math.floor(Math.random() * daunEmoji.length)];
                leaf.style.left = Math.random() * 100 + '%'; leaf.style.animationDuration = (12 + Math.random() * 18) + 's'; leaf.style.animationDelay = (Math.random() * 15) + 's'; leaf.style.fontSize = (10 + Math.random() * 10) + 'px';
                if(container) container.appendChild(leaf);
            }
        }

        function segarSemuaData() { loadPlants(); loadChatHistory(); loadNutritionFromDb(); ambilDataCuacaMeteo(); loadPengumuman(); loadBankBenih(); tunjukkanToast("Data kebun sudah disegarkan!", "success"); }

        // --- UKURAN TULISAN 3 TINGKAT (tidak semua pengguna ibu-ibu) ---
        const SKALA_HURUF = { kecil: 0.9, sedang: 1, besar: 1.16 };
        function aturSkalaHuruf(nama, simpan = true) {
            const nilai = SKALA_HURUF[nama] || 1;
            const body = document.getElementById('bodyApp');
            if (body) body.style.zoom = nilai;
            if (simpan) localStorage.setItem('ibu_kebun_skala_huruf', nama);
            ['kecil', 'sedang', 'besar'].forEach(k => {
                const b = document.getElementById('skala-' + k);
                if (b) b.className = 'px-2.5 py-1 font-bold btn-press ' + (k === nama ? 'bg-white text-emerald-900' : 'text-white/70');
            });
        }

        // --- JAM DIGITAL + SAPAAN (fungsi ini dulu hilang sehingga jam membeku) ---
        let jamIntervalId = null;
        function startJamSapaan() {
            const jamEl = document.getElementById('headerJamDigital');
            const sapaEl = document.getElementById('headerSapaanIbu');
            function perbaruiJam() {
                const kini = new Date();
                if (jamEl) jamEl.innerText = kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
                if (sapaEl) {
                    const j = kini.getHours();
                    const sapa = j < 11 ? 'Selamat pagi' : (j < 15 ? 'Selamat siang' : (j < 19 ? 'Selamat sore' : 'Selamat malam'));
                    sapaEl.innerText = currentUser ? sapa + ', Bu ' + currentUser + '!' : sapa + '!';
                }
            }
            perbaruiJam();
            if (jamIntervalId) clearInterval(jamIntervalId);
            jamIntervalId = setInterval(perbaruiJam, 1000);
        }

        // --- GEMINI LEWAT SERVER ---
        // Kunci Gemini kini tersimpan sebagai rahasia di server Supabase dan tidak
        // pernah ada di kode maupun peramban. Fungsi ini membersihkan sisa kunci
        // lama dari penyimpanan lokal perangkat pengguna.
        function inisialisasiKunciDefaultLokal() {
            localStorage.removeItem('ibu_kebun_gemini_key1');
            localStorage.removeItem('ibu_kebun_gemini_key2');
            localStorage.removeItem('current_gemini_index');
        }

        // PANGGIL GEMINI LEWAT FUNGSI SERVER (kunci tersimpan aman di server)
        async function panggilGeminiAPI(prompt, systemPrompt = "", fileData = null, jsonSchemaConfig = null) {
            let payload;
            if (fileData) {
                payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } }]}]};
            } else if (Array.isArray(prompt)) {
                payload = { contents: prompt };
            } else {
                payload = { contents: [{ parts: [{ text: prompt }] }] };
            }
            if (systemPrompt) payload.systemInstruction = { parts: [{ text: systemPrompt }] };
            if (jsonSchemaConfig) payload.generationConfig = { responseMimeType: "application/json", responseSchema: jsonSchemaConfig };
            const res = await fetch(`${SUPABASE_BASE_URL}/functions/v1/nyi-sari`, { method: 'POST', headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Sambungan terganggu.");
            const json = await res.json(); return json.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, Nyi Sari gagal menjawab.";
        }

        // --- AUTH ADMIN ---
        function openAdminPrompt() {
            const el = document.getElementById('adminPasswordInput'); if(el) el.value = '';
            const m = document.getElementById('adminAuthModal');
            if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10); }
        }
        function closeAdminPrompt() { const m = document.getElementById('adminAuthModal'); if(m) { m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); } }
        async function verifyAdmin() {
            const pwd = document.getElementById('adminPasswordInput').value;
            if (!pwd) return tunjukkanToast("Silakan isi kata sandi admin!", "error");
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/rpc/cek_admin`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ p_sandi: pwd }) });
                const leres = res.ok ? await res.json() : false;
                if (leres === true) { sessionStorage.setItem('admin_auth_kebun', 'true'); sessionStorage.setItem('admin_sandi_kebun', pwd); window.location.href = "admin.html"; }
                else { tunjukkanToast("Maaf, kata sandi admin salah!", "error"); }
            } catch (e) { tunjukkanToast("Tidak bisa tersambung ke server.", "error"); }
        }

        // --- AUTHENTICATION USER ---
        function pariksaStatusLogin() {
            const userName = localStorage.getItem('ibu_kebun_user');
            if (userName) {
                currentUser = userName;
                const as = document.getElementById('authScreen'); if(as) as.classList.add('hidden'); 
                const aps = document.getElementById('appScreen'); if(aps) aps.classList.remove('hidden');
                const sd = document.getElementById('formSowingDate'); if(sd) sd.value = new Date().toISOString().split('T')[0];
                segarSemuaData(); startJamSapaan();
            } else {
                const aps = document.getElementById('appScreen'); if(aps) aps.classList.add('hidden'); 
                const as = document.getElementById('authScreen'); if(as) as.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            }
        }

        function toggleAuthMode(mode) {
            const loginForm = document.getElementById('loginForm'); const registerForm = document.getElementById('registerForm'); const subtitle = document.getElementById('authSubtitle');
            if (mode === 'register') { 
                if(loginForm) loginForm.classList.add('hidden'); if(registerForm) registerForm.classList.remove('hidden'); if(subtitle) subtitle.innerText = "Silakan buat akun baru di bawah ini."; 
            } else { 
                if(registerForm) registerForm.classList.add('hidden'); if(loginForm) loginForm.classList.remove('hidden'); if(subtitle) subtitle.innerText = "Silakan masukkan nama dan kata sandi Ibu."; 
            }
        }

        async function doRegister() {
            const name = document.getElementById('regName').value.trim(); const password = document.getElementById('regPassword').value.trim();
            if (!name || !password) return tunjukkanToast("Silakan isi nama dan kata sandi dengan benar!", "error");
            const btn = document.getElementById('btnRegister'); const btnText = document.getElementById('btnRegText');
            if(btn) btn.disabled = true; if(btnText) btnText.innerText = "Sedang Memeriksa...";
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/rpc/daftar_pengguna`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ p_nama: name, p_sandi: password }) });
                if (!res.ok) throw new Error("Gagal tersambung ke Supabase.");
                const hasilDaftar = await res.json();
                if (!hasilDaftar.sukses) throw new Error(hasilDaftar.pesan || "Gagal membuat akun ke server.");
                
                localStorage.setItem('ibu_kebun_user', name); 
                localStorage.setItem('ibu_kebun_role', hasilDaftar.peran || 'Anggota');

                tunjukkanToast("Terima kasih, akun berhasil dibuat!", "success"); pariksaStatusLogin();
            } catch (err) { tununjukkanToast("Pendaftaran Gagal: " + err.message, "error"); } 
            finally { if(btn) btn.disabled = false; if(btnText) btnText.innerText = "Daftar Sekarang"; }
        }

        async function doLogin() {
            const name = document.getElementById('loginName').value.trim(); const password = document.getElementById('loginPassword').value.trim();
            if (!name || !password) return tunjukkanToast("Silakan isi nama dan kata sandinya!", "error");
            const btn = document.getElementById('btnLogin'); const btnText = document.getElementById('btnLoginText');
            if(btn) btn.disabled = true; if(btnText) btnText.innerText = "Sedang Masuk...";
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/rpc/masuk_pengguna`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ p_nama: name, p_sandi: password }) });
                if (!res.ok) throw new Error("Tidak bisa tersambung ke database.");
                const hasilMasuk = await res.json();
                if (!hasilMasuk.sukses) throw new Error("Nama atau kata sandi yang dimasukkan salah.");
                
                localStorage.setItem('ibu_kebun_user', name); 
                localStorage.setItem('ibu_kebun_role', hasilMasuk.peran || 'Anggota');

                tunjukkanToast("Berhasil masuk! Selamat datang.", "success"); pariksaStatusLogin();
            } catch (err) { tununjukkanToast("Login Gagal: " + err.message, "error"); } 
            finally { if(btn) btn.disabled = false; if(btnText) btnText.innerText = "Masuk ke Aplikasi"; }
        }

        function doLogout() { 
            localStorage.removeItem('ibu_kebun_user'); 
            localStorage.removeItem('ibu_kebun_role');
            currentUser = null; 
            location.reload(); 
        }

        // --- PENGUMUMAN ADMIN ---
        async function loadPengumuman() {
            try {
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/pengumuman_kebun?select=pesan&aktif=eq.true&order=id.desc&limit=1`, { headers: authHeaders });
                if(res.ok) {
                    const data = await res.json();
                    const el = document.getElementById('pengumumanMarquee');
                    if(data.length > 0 && el) el.innerText = data[0].pesan;
                }
            } catch(e) { console.log("Tidak ada pengumuman."); }
        }

        // --- SISTEM LENCANA APRESIASI ---
        function updateLencanaIbu() {
            const badgeContainer = document.getElementById('headerBadges');
            if (!badgeContainer || !currentUser) return;

            let hasWateredToday = false;
            let hasHarvested = false;
            let myPlantsCount = 0;
            const userRole = localStorage.getItem('ibu_kebun_role') || 'Anggota';

            allPlants.forEach(p => {
                if (p.pemilik === currentUser) {
                    myPlantsCount++;
                    if (p.status === 'Panen') hasHarvested = true;
                    if (p.last_watered && new Date(p.last_watered).toDateString() === new Date().toDateString()) {
                        hasWateredToday = true;
                    }
                }
            });

            let badgesHTML = "";

            if (userRole === 'Admin') {
                badgesHTML += `<span class="bg-purple-600 border border-purple-400 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center space-x-1" title="Peran: Admin Utama"><i class="fa-solid fa-user-shield text-[8px]"></i> <span>Admin Utama</span></span>`;
            } else if (userRole === 'Ketua') {
                badgesHTML += `<span class="bg-rose-600 border border-rose-400 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center space-x-1" title="Peran: Ketua Komunitas"><i class="fa-solid fa-crown text-[8px]"></i> <span>Ketua Kebun</span></span>`;
            }

            if (hasWateredToday) {
                badgesHTML += `<span class="bg-blue-500/25 border border-blue-400 text-blue-100 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1" title="Ibu rajin menyiram tanaman hari ini"><i class="fa-solid fa-shower text-[8px]"></i> <span>Penyiram Setia</span></span>`;
            }
            if (hasHarvested) {
                badgesHTML += `<span class="bg-amber-500/25 border border-amber-400 text-amber-100 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1" title="Ibu sudah berhasil panen kebun"><i class="fa-solid fa-crown text-[8px]"></i> <span>Ibu Panen Raya</span></span>`;
            }
            if (myPlantsCount > 2) {
                badgesHTML += `<span class="bg-lime-500/25 border border-lime-400 text-lime-100 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1" title="Ibu rajin merawat bermacam-macam tanaman"><i class="fa-solid fa-seedling text-[8px]"></i> <span>Pakar Tani Dapur</span></span>`;
            }

            badgeContainer.innerHTML = badgesHTML;
        }

        // --- DYNAMIC DRAFT TUNAS GRAPHIC SVG ---
        function dapatkanTunasGraphicSVG(category) {
            const leafSprout = `<svg class="w-full h-full object-contain p-4 bg-emerald-50 text-emerald-600" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 60V32M32 32C32 20 20 18 16 22C12 26 16 38 32 32ZM32 32C32 20 44 18 48 22C52 26 48 38 32 32Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="#a7f3d0"/>
                <circle cx="32" cy="18" r="3" fill="#34d399"/>
            </svg>`;
            const fruitSprout = `<svg class="w-full h-full object-contain p-4 bg-amber-50 text-amber-600" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 60V34M32 34C32 22 22 20 18 24C14 28 18 40 32 34ZM32 34C32 22 42 20 46 24C50 28 46 40 32 34Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="#fde68a"/>
                <circle cx="48" cy="40" r="6" fill="#f87171" stroke="currentColor" stroke-width="2"/>
            </svg>`;
            const treeSprout = `<svg class="w-full h-full object-contain p-4 bg-lime-50 text-lime-700" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 60V24M32 28L20 20M32 36L44 28" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>
                <path d="M32 10C24 10 20 16 20 22C20 28 28 32 32 32C36 32 44 28 44 22C44 16 40 10 32 10Z" fill="#84cc16" stroke="currentColor" stroke-width="3"/>
            </svg>`;
            const flowerSprout = `<svg class="w-full h-full object-contain p-4 bg-rose-50 text-rose-600" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 60V32" stroke="currentColor" stroke-width="4"/>
                <circle cx="32" cy="22" r="8" fill="#fda4af" stroke="currentColor" stroke-width="3"/>
                <circle cx="32" cy="22" r="3" fill="#facc15"/>
            </svg>`;

            if (category === "Sayuran Buah") return fruitSprout;
            if (category === "Buah Pohon") return treeSprout;
            if (category === "Hias / Bunga") return flowerSprout;
            return leafSprout;
        }

        // --- ALARM CUACA EKSTREM & METEO ---
        async function ambilDataCuacaMeteo() {
            const ikonDiv = document.getElementById('cuacaIkon'); const deskripsiText = document.getElementById('cuacaDeskripsi'); const suhuText = document.getElementById('cuacaSuhu'); const kelembapanText = document.getElementById('cuacaKelembapan'); const saranText = document.getElementById('cuacaSaranTani'); const hamaBadge = document.getElementById('hamaBadgeWaspada'); const hamaStatus = document.getElementById('hamaStatusText');
            async function panggilMeteoAPI(latitude, longitude) {
                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index&daily=precipitation_sum,precipitation_probability_max,sunrise,sunset&forecast_days=2&timezone=auto`);
                    if (!res.ok) throw new Error(); const data = await res.json();
                    const temp = Math.round(data.current.temperature_2m);
                    const hum = data.current.relative_humidity_2m;
                    const code = data.current.weather_code;
                    const peluangHujan = (data.daily && data.daily.precipitation_probability_max) ? data.daily.precipitation_probability_max[0] : null;
                    const jumlahHujan = (data.daily && data.daily.precipitation_sum) ? data.daily.precipitation_sum[0] : null;
                    const hujanMungkin = (peluangHujan !== null && peluangHujan >= 50) || (jumlahHujan !== null && jumlahHujan >= 5) || code >= 51;
                    cuacaRingkasan = { suhu: temp, kode: code, peluangHujan: peluangHujan, jumlahHujan: jumlahHujan, hujanMungkin: hujanMungkin };
                    const elLokasi = document.getElementById('cuacaLokasiNama'); if (elLokasi) elLokasi.innerText = lokasiKebun.nama;
                    const angin = data.current.wind_speed_10m; const uv = data.current.uv_index;
                    const elAngin = document.getElementById('indAngin'); if (elAngin) elAngin.innerText = (angin != null ? Math.round(angin) : '--') + ' km/jam';
                    const elUV = document.getElementById('indUV'); if (elUV) elUV.innerText = (uv != null ? Math.round(uv) : '--') + (uv == null ? '' : (uv <= 2 ? ' (Rendah)' : (uv <= 5 ? ' (Sedang)' : (uv <= 7 ? ' (Tinggi)' : ' (Sgt Tinggi)'))));
                    const elHujan = document.getElementById('indHujan'); if (elHujan) elHujan.innerText = (peluangHujan !== null ? peluangHujan + '%' : '--') + ' • ' + (jumlahHujan !== null ? jumlahHujan + ' mm' : '--');
                    let risikoJamur = 'Rendah'; if (hum >= 85 && ((jumlahHujan || 0) > 0 || (peluangHujan || 0) >= 50)) risikoJamur = 'Tinggi'; else if (hum >= 78 || (hum >= 70 && (peluangHujan || 0) >= 50)) risikoJamur = 'Sedang';
                    const elJamur = document.getElementById('indJamur'); if (elJamur) elJamur.innerText = risikoJamur;
                    const elMt = document.getElementById('indMatahari'); if (elMt && data.daily && data.daily.sunrise && data.daily.sunset) elMt.innerText = data.daily.sunrise[0].slice(11, 16) + ' – ' + data.daily.sunset[0].slice(11, 16);
                    
                    if(suhuText) suhuText.innerText = `${temp}°C`; 
                    if(kelembapanText) kelembapanText.innerText = `${hum}%`;
                    if(hamaBadge) hamaBadge.className = hum > 80 ? "bg-rose-100/80 border border-rose-300/60 text-rose-800 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center space-x-1" : "bg-green-100/80 border border-green-300/60 text-green-800 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center space-x-1";
                    if(hamaStatus) hamaStatus.innerText = hum > 80 ? "Hama: WASPADA" : "Hama: Aman";
                    
                    let ikHTML = '<i class="fa-solid fa-cloud-sun text-amber-300 animate-pulse"></i>';
                    let desc = "Cerah Berawan";
                    if (code >= 51) {
                        ikHTML = '<i class="fa-solid fa-cloud-showers-heavy text-slate-300 animate-bounce"></i>';
                        desc = "Hujan / Mendung";
                    } else if (temp > 32) {
                        ikHTML = '<i class="fa-solid fa-sun text-amber-400 animate-spin"></i>';
                        desc = "Panas Sekali";
                    }
                    if(ikonDiv) ikonDiv.innerHTML = ikHTML; 
                    if(deskripsiText) deskripsiText.innerText = `Cuaca Hari Ini: ${desc}`; 
                    
                    let saranHTML = "";
                    if (temp > 32) {
                        saranHTML += `<div class="bg-amber-500/20 text-yellow-100 p-2.5 rounded-xl mb-2 font-bold flex items-start space-x-1.5 border border-amber-500/30 text-xs shadow-inner animate-pulse">⚠️ <span>Ibu, hari ini sepertinya akan panas sekali (${temp}°C). Jangan lupa menyiram tanaman dua kali hari ini supaya tidak layu ya! ☀️</span></div>`;
                    } else if (code >= 51) {
                        saranHTML += `<div class="bg-rose-500/20 text-rose-100 p-2.5 rounded-xl mb-2 font-bold flex items-start space-x-1.5 border border-rose-500/30 text-xs shadow-inner animate-pulse">⛈️ <span>Ibu, hari ini sepertinya akan ada hujan besar atau badai. Silakan amankan pot-pot kecil supaya tidak hanyut!</span></div>`;
                    }
                    
                    if (hujanMungkin && code < 51) {
                        saranHTML += `<div class="bg-sky-500/20 text-sky-100 p-2.5 rounded-xl mb-2 font-bold flex items-start space-x-1.5 border border-sky-500/30 text-xs shadow-inner">🌧️ <span>Ibu, peluang hujan hari ini ${peluangHujan !== null ? peluangHujan + '%' : 'cukup besar'}. Tanaman di lahan terbuka boleh tidak disiram hari ini; yang di pot dan di bawah naungan tetap diperiksa ya.</span></div>`;
                    }
                    if (saranHTML === "") saranHTML = `Udara sedang cerah dan sejuk. Waktu yang baik untuk merawat kebun.`;
                    if(saranText) saranText.innerHTML = saranHTML;
                    renderSiramBanner();
                } catch (e) {}
            }
            panggilMeteoAPI(lokasiKebun.lat, lokasiKebun.lon);
        }

        async function loadNutritionFromDb() {
            try {
                const response = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_nutrition?select=*&order=id.desc`, { method: 'GET', headers: authHeaders });
                if (response.ok) {
                    const dbRecipes = await response.json(); let merged = [...dbRecipes];
                    DEFAULT_NUTRITION_RECIPES.forEach(def => { if (!dbRecipes.some(db => (db.name || "").toLowerCase().includes(def.name.toLowerCase().replace(/[^a-zA-Z]/g, "")))) merged.push(def); });
                    nutritionData = merged;
                } else throw new Error();
            } catch (e) { nutritionData = [...DEFAULT_NUTRITION_RECIPES]; }
            renderNutritionCards();
        }

        function renderNutritionCards() {
            const listDiv = document.getElementById('nutritionList'); if(!listDiv) return;
            if (nutritionData.length === 0) return listDiv.innerHTML = '<p class="text-stone-400 text-center py-4">Lemari resep nutrisi sedang kosong.</p>';
            let html = '';
            nutritionData.forEach(n => { html += `<div class="bg-stone-50 border border-stone-200/80 p-4 rounded-3xl space-y-2 shadow-sm"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"><h4 class="font-extrabold text-xs text-emerald-800 flex items-center space-x-1.5"><i class="fa-solid fa-flask-vial text-emerald-600"></i><span>${escapeHtml(n.name)}</span></h4><div class="flex items-center space-x-2"><button onclick="bagikanKeWA('nutrisi', '${escapeJsString(n.name)}', '${escapeJsString(n.benefit)}')" class="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center space-x-1" title="Bagikan ke WA"><i class="fa-brands fa-whatsapp text-xs"></i> <span>Bagikan</span></button><span class="bg-lime-100 text-emerald-950 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full flex items-center space-x-1 border border-lime-200"><i class="fa-solid fa-calendar-day text-[8px]"></i><span>Aplikasi: ${escapeHtml(n.schedule)}</span></span></div></div><p class="text-stone-600 font-medium text-xs leading-relaxed"><b class="text-stone-700 block mb-0.5"><i class="fa-solid fa-star text-amber-500 mr-1 text-[10px]"></i>Manfaat:</b>${escapeHtml(n.benefit)}</p><p class="text-stone-500 text-xs leading-relaxed bg-white p-3 rounded-2xl border border-stone-200 shadow-inner"><b class="text-emerald-800 block mb-1"><i class="fa-solid fa-gears mr-1 text-[10px]"></i>Takaran:</b>${escapeHtml(n.dosage)}</p></div>`; });
            listDiv.innerHTML = html;
        }

        async function loadPlants() {
            const loadingDiv = document.getElementById('plantLoading'); if(loadingDiv) loadingDiv.classList.remove('hidden');
            try {
                const response = await fetch(`${SUPABASE_BASE_URL}/rest/v1/plant_farm?select=*&order=id.desc`, { method: 'GET', headers: authHeaders });
                if (!response.ok) throw new Error();
                allPlants = await response.json();
                if(loadingDiv) loadingDiv.classList.add('hidden');
                
                let total = 0, semai = 0, siap = 0, gagal = 0;
                allPlants.forEach(p => { 
                    if(p.status !== 'Panen') {
                        total++;
                        if (p.status === 'Semai') semai++; else if (p.status === 'Siap Pindah') siap++; else if (p.status === 'Gagal') gagal++; 
                    }
                });
                const dTotal = document.getElementById('dashTotal'); if(dTotal) dTotal.innerText = total;
                const dSemai = document.getElementById('dashSemai'); if(dSemai) dSemai.innerText = semai;
                const dSiap = document.getElementById('dashSiap'); if(dSiap) dSiap.innerText = siap;
                const dGagal = document.getElementById('dashGagal'); if(dGagal) dGagal.innerText = gagal;
                perbaruiIndikatorPanen();
                
                filterPlants(currentFilterStatus);
                renderKalender();
                updateLencanaIbu(); 
            } catch (e) { if(loadingDiv) loadingDiv.classList.add('hidden'); }
        }

        function filterPlants(status) {
            currentFilterStatus = status;
            const filterMap = { 'Semua':'filter-Semua', 'Milik Saya': 'filter-Saya', 'Semai':'filter-Semai', 'Tumbuh Daun':'filter-Tumbuh', 'Siap Pindah':'filter-Siap', 'Gagal':'filter-Gagal' };
            Object.entries(filterMap).forEach(([st, id]) => { 
                const el = document.getElementById(id); 
                if(el) el.className = st === status ? `px-3.5 py-1.5 rounded-xl font-bold text-white shadow-sm shrink-0 transition-all ${st==='Milik Saya'?'bg-emerald-600':'bg-emerald-800'}` : `px-3.5 py-1.5 rounded-xl font-bold bg-white border shrink-0 transition-all ${st==='Milik Saya'?'text-emerald-600 border-emerald-200':'text-stone-600 border-stone-200'}`; 
            });
            
            if(currentTab === 'panen') {
                filteredPlants = allPlants.filter(p => p.status === 'Panen'); renderPanenCards();
            } else {
                if(status === 'Semua') filteredPlants = allPlants.filter(p => p.status !== 'Panen');
                else if (status === 'Milik Saya') filteredPlants = allPlants.filter(p => p.status !== 'Panen' && p.pemilik === currentUser);
                else filteredPlants = allPlants.filter(p => p.status === status);
                renderPlantCards();
            }
        }

        function renderPlantCards() {
            const grid = document.getElementById('plantGrid'); if(!grid) return;
            if (filteredPlants.length === 0) { const empty = document.getElementById('plantEmpty'); if(empty) empty.classList.remove('hidden'); grid.innerHTML = ''; return; }
            const empty = document.getElementById('plantEmpty'); if(empty) empty.classList.add("hidden");
            let html = '';
            filteredPlants.forEach(plant => {
                const userRole = localStorage.getItem('ibu_kebun_role') || 'Anggota';
                const isOwner = plant.pemilik === currentUser;
                const isKetuaAtauAdmin = userRole === 'Ketua' || userRole === 'Admin';
                const canManage = isOwner || isKetuaAtauAdmin;

                const sowing = new Date(plant.sowing_date); const hss = Math.floor((new Date() - sowing) / (1000 * 3600 * 24));
                let cat = plant.category || "Sayuran Daun"; let notesClean = plant.notes || "";
                
                let targetPanenHari = cat === 'Sayuran Buah' ? 80 : (cat === 'Buah Pohon' ? 180 : (cat === 'Hias / Bunga' ? 60 : 30));
                let sisaHari = targetPanenHari - hss;
                let persenProgress = Math.min(100, Math.max(5, Math.round((hss / targetPanenHari) * 100)));

                if(plant.est_panen_date) {
                    const targetPanenDate = new Date(plant.est_panen_date);
                    sisaHari = Math.floor((targetPanenDate - new Date()) / (1000 * 3600 * 24));
                    const totalHariTumbuh = Math.floor((targetPanenDate - sowing) / (1000 * 3600 * 24));
                    if(totalHariTumbuh > 0) persenProgress = Math.min(100, Math.max(5, Math.round((hss / totalHariTumbuh) * 100)));
                }

                let teksEstimasi = sisaHari > 0 ? `Akan Panen: <b>${sisaHari} Hari</b>` : "Waktunya dipetik, Ibu!";
                let colorBadge = plant.status === 'Semai' ? 'bg-amber-100 text-amber-800' : (plant.status === 'Tumbuh Daun' ? 'bg-blue-100 text-blue-800' : (plant.status === 'Siap Pindah' ? 'bg-lime-100 text-lime-800' : 'bg-rose-100 text-rose-800'));
                let statusIndo = plant.status === 'Semai' ? 'Baru Tumbuh' : (plant.status === 'Tumbuh Daun' ? 'Banyak Daun' : (plant.status === 'Siap Pindah' ? 'Siap Pindah' : 'Layu'));
                
                let siramText = '<span class="text-stone-400 font-bold text-xs">Belum disiram</span>';
                if (plant.last_watered && new Date(plant.last_watered).toDateString() === new Date().toDateString()) siramText = `<span class="text-emerald-600 font-bold text-xs"><i class="fa-solid fa-droplet"></i> Disiram ${new Date(plant.last_watered).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>`;
                
                let imageContainerHTML = "";
                if (plant.image_url) {
                    imageContainerHTML = `<img src="${escapeHtml(plant.image_url)}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" loading="lazy">`;
                } else {
                    imageContainerHTML = dapatkanTunasGraphicSVG(cat);
                }
                
                let warnaAksen = plant.status === 'Semai' ? 'border-l-amber-400' : (plant.status === 'Tumbuh Daun' ? 'border-l-blue-400' : (plant.status === 'Siap Pindah' ? 'border-l-lime-500' : (plant.status === 'Panen' ? 'border-l-amber-500' : 'border-l-rose-400')));
                let actionButtons = `<button onclick="openModalDetail(${plant.id})" class="bg-stone-200 text-stone-700 font-bold px-3 py-2.5 rounded-xl text-xs hover:bg-stone-300 btn-press min-h-[44px]">Detail</button>`;
                
                if (isOwner) {
                    actionButtons = `<button onclick="bagikanKeWA('tanam', '${escapeJsString(plant.plant_name)}')" class="bg-emerald-50 text-emerald-600 font-extrabold px-3 py-2.5 rounded-xl text-xs hover:bg-emerald-100 btn-press min-h-[44px]"><i class="fa-brands fa-whatsapp"></i> Bagikan</button>${actionButtons}`;
                }

                actionButtons = `<button onclick="quickWater(${plant.id})" class="bg-blue-50 text-blue-700 font-extrabold px-3 py-2.5 rounded-xl text-xs hover:bg-blue-100 btn-press min-h-[44px]"><i class="fa-solid fa-shower"></i> Siram</button>${actionButtons}`;

                if (canManage) {
                    actionButtons = `<button onclick="openModalEdit(${plant.id})" class="bg-amber-50 text-amber-700 font-extrabold px-3 py-2.5 rounded-xl text-xs hover:bg-amber-100 btn-press min-h-[44px]"><i class="fa-solid fa-pen-to-square"></i> Ubah</button>${actionButtons}`;
                }

                html += `<div class="plant-card bg-white rounded-[2rem] shadow-sm border border-stone-200/60 border-l-8 ${warnaAksen} overflow-hidden flex flex-col justify-between"><div><div class="relative h-36 bg-stone-100 w-full overflow-hidden">${imageContainerHTML}<span class="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorBadge} backdrop-blur-sm">${statusIndo}</span><span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/80 text-stone-700 backdrop-blur-sm shadow-sm"><i class="fa-solid fa-user mr-1 text-emerald-600"></i>${escapeHtml(plant.pemilik || 'Anonim')}</span></div><div class="p-4 space-y-2.5"><div><h4 class="font-extrabold text-stone-800 text-sm leading-tight">${escapeHtml(plant.plant_name)}</h4><p class="text-xs text-emerald-700 font-extrabold mt-0.5"><i class="fa-solid fa-hourglass-half text-[10px]"></i> Umur: ${hss >= 0 ? hss : 0} Hari</p></div><div class="space-y-1 bg-stone-50 p-2 rounded-xl border border-stone-100 text-xs"><div class="flex justify-between items-center text-stone-500"><span>Pertumbuhan</span><span>${teksEstimasi}</span></div><div class="w-full bg-stone-200 rounded-full h-2 overflow-hidden"><div class="bg-gradient-to-r from-emerald-500 to-lime-400 h-full rounded-full progress-fill" style="width: ${persenProgress}%"></div></div></div><p class="text-xs text-stone-500 line-clamp-1 italic">Tips: ${escapeHtml(notesClean || '-')}</p></div></div><div class="bg-stone-50/70 px-4 py-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">${siramText}<div class="flex flex-wrap gap-1 justify-end">${actionButtons}</div></div></div>`;
            });
            grid.innerHTML = html;
        }

        // RENDER KALENDER JADWAL
        function renderKalender() {
            const list = document.getElementById('kalenderList');
            if(!list) return;
            
            let events = [];
            const today = new Date();
            today.setHours(0,0,0,0);

            allPlants.forEach(p => {
                if(p.sowing_date) {
                    let d = new Date(p.sowing_date);
                    events.push({ plant: p, date: d, title: 'Awal Tanam / Menanam', icon: 'fa-seedling', color: 'text-emerald-600', bg: 'bg-emerald-100', isPast: d < today });
                }
                if(p.status === 'Panen' || p.status === 'Gagal') return;
                
                if(p.est_tumbuh_date && p.status === 'Semai') {
                    let d = new Date(p.est_tumbuh_date);
                    events.push({ plant: p, date: d, title: 'Siap Tumbuh Daun', icon: 'fa-leaf', color: 'text-blue-500', bg: 'bg-blue-100', isPast: d < today });
                }
                if(p.est_pindah_date && (p.status === 'Semai' || p.status === 'Tumbuh Daun')) {
                    let d = new Date(p.est_pindah_date);
                    events.push({ plant: p, date: d, title: 'Pindah ke Pot Besar', icon: 'fa-arrows-up-down-left-right', color: 'text-lime-600', bg: 'bg-lime-100', isPast: d < today });
                }
                if(p.est_panen_date) {
                    let d = new Date(p.est_panen_date);
                    events.push({ plant: p, date: d, title: 'Waktunya Panen!', icon: 'fa-basket-shopping', color: 'text-amber-500', bg: 'bg-amber-100', isPast: d < today });
                }
            });

            if(events.length === 0) {
                document.getElementById('kalenderEmpty').classList.remove('hidden');
                list.innerHTML = ''; return;
            }
            document.getElementById('kalenderEmpty').classList.add('hidden');

            events.sort((a, b) => a.date - b.date);

            let html = '';
            events.forEach(e => {
                let diff = Math.ceil((e.date - today) / (1000*3600*24));
                let badgeHTML = "";
                let cardOpacity = "";

                if(e.isPast) {
                    badgeHTML = `<span class="bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-check mr-1"></i>Selesai</span>`;
                    cardOpacity = "opacity-75";
                } else if(diff === 0) {
                    badgeHTML = `<span class="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">Hari Ini!</span>`;
                } else if (diff === 1) {
                    badgeHTML = `<span class="bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[10px] font-black">Besok</span>`;
                } else {
                    badgeHTML = `<span class="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full text-[10px] font-black">${diff} Hari lagi</span>`;
                }
                
                const tglFormat = e.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

                html += `
                <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${cardOpacity}">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${e.bg} ${e.color} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <i class="fa-solid ${e.icon} text-sm"></i>
                    </div>
                    <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-3 rounded-2xl border ${diff === 0 ? 'border-rose-300 shadow-md' : 'border-stone-200 shadow-sm'} relative">
                        <div class="absolute -top-2 -right-2 bg-slate-800 text-white text-[8px] font-bold px-2 py-0.5 rounded-lg shadow">${tglFormat}</div>
                        <div class="flex items-center justify-between space-x-2 mb-1 mt-1">
                            <h4 class="font-bold text-stone-800 text-xs">${escapeHtml(e.plant.plant_name)}</h4>
                            ${badgeHTML}
                        </div>
                        <div class="text-xs text-stone-500 font-medium">Jadwal: ${e.title}</div>
                        <div class="text-[10px] text-stone-400 mt-1.5"><i class="fa-solid fa-user text-stone-300 mr-1"></i>Milik: ${escapeHtml(e.plant.pemilik || 'Anonim')}</div>
                    </div>
                </div>`;
            });
            list.innerHTML = html;
        }

        function renderPanenCards() {
            const grid = document.getElementById('panenGrid'); if(!grid) return;
            loadRekapPanen();
            if (filteredPlants.length === 0) { const empty = document.getElementById('panenEmpty'); if(empty) empty.classList.remove('hidden'); grid.innerHTML = ''; return; }
            const empty = document.getElementById('panenEmpty'); if(empty) empty.classList.add('hidden');
            let html = '';
            filteredPlants.forEach(plant => {
                const imgCadangan = "https://images.unsplash.com/photo-1595856417726-2d164506c9e0?auto=format&fit=crop&w=350&q=80";
                html += `<div class="plant-card bg-white rounded-[2rem] shadow-md border border-amber-200 overflow-hidden flex flex-col justify-between"><div class="relative h-48 bg-stone-100 w-full overflow-hidden"><img src="${escapeHtml(plant.image_url || imgCadangan)}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" onerror="this.src='${imgCadangan}'" loading="lazy"><span class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent p-4 pt-12"><h4 class="font-black text-white text-sm leading-tight shadow-sm">${escapeHtml(plant.plant_name)}</h4><p class="text-xs text-amber-300 font-bold mt-1"><i class="fa-solid fa-crown mr-1"></i> Dipanen oleh: ${escapeHtml(plant.pemilik || 'Anonim')}</p></span><div class="absolute top-3 right-3 bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-xs font-black shadow-md flex items-center space-x-1"><i class="fa-solid fa-star"></i> <span>Panen!</span></div><button onclick="bagikanKeWA('panen', '${escapeJsString(plant.plant_name)}')" class="absolute top-3 left-3 bg-emerald-600 text-white px-2.5 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center space-x-1 hover:bg-emerald-700 btn-press"><i class="fa-brands fa-whatsapp text-xs"></i> <span>Bagikan</span></button></div></div>`;
            });
            grid.innerHTML = html;
        }

        function renderWateringList() {
            const listDiv = document.getElementById('wateringList'); if(!listDiv) return;
            renderSiramBanner();
            let targets = allPlants.filter(p => p.status !== 'Panen' && (!p.last_watered || new Date(p.last_watered).toDateString() !== new Date().toDateString()));
            if (targets.length === 0) return listDiv.innerHTML = '<div class="text-center py-4 text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> Alhamdulillah! Semua tanaman komunitas sudah selesai disiram hari ini.</div>';
            let html = '';
            targets.forEach(p => { html += `<div class="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-100"><div class="pr-2"><h5 class="font-bold text-stone-800 leading-tight">${escapeHtml(p.plant_name)}</h5><p class="text-xs text-stone-500">Milik: <b class="text-emerald-700">${escapeHtml(p.pemilik || 'Anonim')}</b> • Media: ${escapeHtml(p.planting_medium || '-')}</p></div><button onclick="quickWater(${p.id}, true)" class="bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-[11px] flex items-center space-x-1.5 hover:bg-emerald-700 btn-press shadow-sm"><i class="fa-solid fa-shower"></i> <span>Siram</span></button></div>`; });
            listDiv.innerHTML = html;
        }

        function renderSiramBanner() {
            const b = document.getElementById('siramBanner'); if (!b) return;
            const targets = allPlants.filter(p => p.status !== 'Panen' && (!p.last_watered || new Date(p.last_watered).toDateString() !== new Date().toDateString()));
            if (targets.length === 0) { b.innerHTML = ''; return; }
            const c = cuacaRingkasan;
            if (c && c.hujanMungkin) {
                b.innerHTML = `<div class="bg-sky-50 border border-sky-200 text-sky-900 p-3 rounded-2xl text-[11px] leading-relaxed">🌧️ <b>Hari ini kemungkinan hujan${c.peluangHujan !== null ? ` (peluang ${c.peluangHujan}%)` : ''}.</b> Tanaman di lahan terbuka boleh dilewati dulu — cukup periksa yang di pot dan di bawah naungan. Ada ${targets.length} tanaman yang belum disiram.</div>`;
            } else if (c && c.suhu > 32) {
                b.innerHTML = `<div class="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl text-[11px] leading-relaxed">☀️ <b>Hari ini panas sekali (${c.suhu}°C).</b> ${targets.length} tanaman di bawah ini perlu disiram — pagi dan sore supaya tidak layu.</div>`;
            } else {
                b.innerHTML = `<div class="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-[11px] leading-relaxed">💧 Ada <b>${targets.length} tanaman</b> yang belum disiram hari ini. Silakan bantu siram, Bu.</div>`;
            }
        }

        function bukaDokterDaun() {
            switchTab('ai');
            switchSubAi('doctor');
            setTimeout(() => { const el = document.getElementById('ai-sub-doctor'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
        }

        async function quickWater(id, reloadSiram = false) {
            try {
                const response = await fetch(`${SUPABASE_BASE_URL}/rest/v1/plant_farm?id=eq.${id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ last_watered: new Date().toISOString() }) });
                if (!response.ok) throw new Error();
                tunjukkanToast("Penyiraman sudah tersimpan di catatan!", "success");
                await loadPlants(); if (reloadSiram) renderWateringList();
            } catch (e) { tununjukkanToast("Maaf, sistem gagal mencatat siraman.", "error"); }
        }

        async function loadChatHistory() {
            const logs = document.getElementById('chatAiLogs'); if(!logs) return;
            try {
                const response = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat?select=*&order=id.asc`, { method: 'GET', headers: authHeaders });
                if (!response.ok) throw new Error();
                const chats = await response.json();
                if (chats.length === 0) return logs.innerHTML = '<p class="text-stone-400 p-2 text-center text-[11px]">Silakan Ibu, kalau ada yang ingin ditanyakan soal kebun, bisa ketik di sini...</p>';
                let html = '';
                chats.forEach(c => {
                    if (c.is_ai) html += `<div class="max-w-[90%] flex flex-col mt-2 chat-bubble-enter"><span class="text-[10px] font-bold nyi-sari-badge ml-1">Nyi Sari</span><div class="bg-emerald-50 text-stone-700 p-3 rounded-2xl border border-emerald-100/60 leading-relaxed">${formatAiResponse(c.message)}</div></div>`;
                    else html += `<div class="max-w-[90%] ml-auto text-right mt-2 chat-bubble-enter"><span class="text-[10px] font-bold text-emerald-700 mr-1">${escapeHtml(c.sender)}</span><div class="bg-white border border-emerald-200 text-stone-800 p-2.5 rounded-2xl text-left font-semibold shadow-sm">${escapeHtml(c.message)}</div></div>`;
                });
                logs.innerHTML = html; logs.scrollTop = logs.scrollHeight;
            } catch (e) { logs.innerHTML = '<p class="text-stone-400 text-center py-4 text-[11px]">Riwayat obrolan sudah siap ditampilkan.</p>'; }
        }

        // CHAT NYI SARI NYETAL MEMORI SAJARAH & PERSONA ADAPTIF
        async function sendAiChat() {
            const input = document.getElementById('chatAiInput'); const prompt = input.value.trim(); if (!prompt) return;
            const btn = document.getElementById('btnSendAiChat'); const icon = document.getElementById('aiChatIcon'); const loading = document.getElementById('aiChatLoading');
            btn.disabled = true; icon.classList.add('hidden'); loading.classList.remove('hidden');
            const userName = currentUser || "Ibu Kebun";
            try {
                await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ sender: userName, message: prompt, is_ai: false }) });
                await loadChatHistory(); input.value = "";

                let chatContext = [];
                try {
                    const historyRes = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat?select=sender,message,is_ai&order=id.desc&limit=15`, { headers: authHeaders });
                    if (historyRes.ok) {
                        const rawHistory = await historyRes.json();
                        rawHistory.reverse(); 
                        chatContext = rawHistory.map(c => {
                            return {
                                role: c.is_ai ? "model" : "user",
                                parts: [{ text: `${c.sender}: ${c.message}` }]
                            };
                        });
                    }
                } catch (historyErr) {
                    console.log("Gagal mengambil riwayat obrolan:", historyErr);
                }

                if (chatContext.length === 0) {
                    chatContext = [{ role: "user", parts: [{ text: `${userName}: ${prompt}` }] }];
                }

                const aiAns = await panggilGeminiAPI(chatContext, dapatkanNyiSariPersona());

                await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_chat`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ sender: "Nyi Sari", message: aiAns, is_ai: true }) });
                await loadChatHistory();
            } catch (error) {
                tunjukkanToast("Gagal tersambung ke Nyi Sari", "error");
                const logs = document.getElementById('chatAiLogs');
                if(logs) {
                    logs.innerHTML += `<div class="max-w-[90%] flex flex-col mt-1 chat-bubble-enter"><span class="text-[10px] font-bold text-rose-700 ml-1">Sistem (Error)</span><div class="bg-rose-50 text-rose-800 p-2.5 rounded-2xl border border-rose-100 leading-relaxed font-semibold">Mohon maaf Ibu, Nyi Sari sedang tidak bisa dihubungi sebentar. Silakan dicoba lagi ya.</div></div>`;
                    logs.scrollTop = logs.scrollHeight;
                }
            } finally { btn.disabled = false; icon.classList.remove('hidden'); loading.classList.add('hidden'); }
        }

        // NGAROBIH JABATAN WALERAN NYI SARI (SINGKET VS RINCI)
        function setNyiSariStyle(style) {
            nyiSariStyle = style;
            const btnSederhana = document.getElementById('style-sederhana');
            const btnRinci = document.getElementById('style-rinci');
            if (style === 'sederhana') {
                btnSederhana.className = "px-3 py-1 rounded-xl transition-all bg-emerald-600 text-white shadow-sm font-bold";
                btnRinci.className = "px-3 py-1 rounded-xl transition-all text-stone-500 hover:text-stone-800 font-semibold";
            } else {
                btnSederhana.className = "px-3 py-1 rounded-xl transition-all text-stone-500 hover:text-stone-800 font-semibold";
                btnRinci.className = "px-3 py-1 rounded-xl transition-all bg-emerald-600 text-white shadow-sm font-bold";
            }
            tunjukkanToast("Mode jawaban diubah menjadi: " + (style === 'sederhana' ? 'Singkat' : 'Rinci & Detail'), "success");
        }

        function setValid(el) { el.classList.remove('input-error'); const alert = document.getElementById('formAlert'); if(alert) alert.classList.add('hidden'); }

        // --- SISTEM CHOOSE PHOTO (CAMERA VS GALLERY) ---
        function triggerPhotoCapture(source) {
            if (source === 'camera') {
                document.getElementById('formImageFileCamera').click();
            } else {
                document.getElementById('formImageFileGallery').click();
            }
        }

        // --- KOMPRESI GAMBAR CLIENT SIDE ---
        function kompresiFileGambar(file, maksByte = 1000000) {
            return new Promise((resolve) => {
                if (!file || !file.type || !file.type.startsWith('image/')) return resolve(file);
                if (file.size <= maksByte) return resolve(file);
                const urlObjek = URL.createObjectURL(file);
                const img = new Image();
                img.onload = function() {
                    let sisi = 1600; let kualitas = 0.85;
                    function cobaLagi() {
                        const skala = Math.min(1, sisi / Math.max(img.width, img.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(img.width * skala));
                        canvas.height = Math.max(1, Math.round(img.height * skala));
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                            if (blob && blob.size <= maksByte) { URL.revokeObjectURL(urlObjek); resolve(blob); }
                            else if (kualitas > 0.5) { kualitas = Math.round((kualitas - 0.15) * 100) / 100; cobaLagi(); }
                            else if (sisi > 640) { sisi = Math.round(sisi * 0.75); kualitas = 0.8; cobaLagi(); }
                            else { URL.revokeObjectURL(urlObjek); resolve(blob || file); }
                        }, 'image/jpeg', kualitas);
                    }
                    cobaLagi();
                };
                img.onerror = function() { URL.revokeObjectURL(urlObjek); resolve(file); };
                img.src = urlObjek;
            });
        }

        async function simpanBibit() {
            const editId = document.getElementById('editPlantId').value;
            const nameInput = document.getElementById('formPlantName'); const dateInput = document.getElementById('formSowingDate');
            const name = nameInput.value.trim(); const sowingDate = dateInput.value;
            const medium = document.getElementById('formMedium').value.trim(); const status = document.getElementById('formStatus').value;
            const category = document.getElementById('formCategory').value; const notes = document.getElementById('formNotes').value.trim();
            
            const eTumbuh = document.getElementById('formEstTumbuh').value;
            const ePindah = document.getElementById('formEstPindah').value;
            const ePanen = document.getElementById('formEstPanen').value;
            
            let isKososng = false;
            if (!name) { nameInput.classList.add('input-error'); isKososng = true; }
            if (!sowingDate) { dateInput.classList.add('input-error'); isKososng = true; }
            if (isKososng) { 
                const alert = document.getElementById('formAlert'); if(alert) alert.classList.remove('hidden'); 
                return tunjukkanToast("Silakan isi dulu kotak yang berwarna merah ya!", "warning"); 
            }

            const btn = document.getElementById('modalSaveBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Sedang Menyimpan...';
            let imgUrl = editId ? (allPlants.find(p => p.id == editId)?.image_url || "") : "";
            
            try {
                if (formSelectedFile) {
                    const fileDikompresi = await kompresiFileGambar(formSelectedFile);
                    const fileNamaUnik = `bibit_${Date.now()}.jpg`;
                    
                    const uploadRes = await fetch(`${SUPABASE_BASE_URL}/storage/v1/object/images-bucket/${fileNamaUnik}`, { 
                        method: 'POST', 
                        headers: { 
                            'apikey': SUPABASE_KEY, 
                            'Authorization': authHeaders.Authorization, 
                            'Content-Type': 'image/jpeg' 
                        }, 
                        body: fileDikompresi 
                    });
                    if (uploadRes.ok) imgUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/images-bucket/${fileNamaUnik}`;
                }
                
                const payload = { 
                    plant_name: name, sowing_date: sowingDate, planting_medium: medium || null, status: status, 
                    category: category, notes: notes, image_url: imgUrl || null, pemilik: editId ? (allPlants.find(p => p.id == editId)?.pemilik || currentUser) : currentUser,
                    est_tumbuh_date: eTumbuh || null, est_pindah_date: ePindah || null, est_panen_date: ePanen || null
                };
                let url = `${SUPABASE_BASE_URL}/rest/v1/plant_farm`; let method = 'POST';
                if (editId) { url += `?id=eq.${editId}`; method = 'PATCH'; }
                
                const res = await fetch(url, { method: method, headers: authHeaders, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error();
                
                tunjukkanToast("Buku catatan kebun sudah diperbarui!", "success");
                closeModalTambah(); await loadPlants();
            } catch (e) { tununjukkanToast("Gagal Menyimpan Data.", "error"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan'; }
        }

        async function eksekusiHapusMurni() {
            if (!activeHapusId) return;
            const btn = document.getElementById('btnHapusKonfirmasiMurni'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Sedang Menghapus...';
            try {
                let headers = { ...authHeaders, 'Prefer': 'return=representation' };
                const response = await fetch(`${SUPABASE_BASE_URL}/rest/v1/plant_farm?id=eq.${activeHapusId}`, { method: 'DELETE', headers: headers });
                if (!response.ok) { const err = await response.json().catch(()=>({})); throw new Error(err.message || "Gagal menghapus dari server."); }
                tunjukkanToast("Catatan berhasil dihapus!", "success");
                closeModalHapus(); activeHapusId = null; await loadPlants();
            } catch (e) { tununjukkanToast("Gagal: " + e.message, "error"); } finally { btn.disabled = false; btn.innerHTML = 'Ya, Hapus!'; }
        }

        function openModalTambah() {
            const alert = document.getElementById('formAlert'); if(alert) alert.classList.add('hidden'); 
            document.getElementById('formPlantName').classList.remove('input-error'); document.getElementById('formSowingDate').classList.remove('input-error');
            
            document.getElementById('editPlantId').value = ""; document.getElementById('modalTitle').innerText = "Catat Tanaman Baru Ibu"; document.getElementById('formPlantName').value = ""; document.getElementById('formMedium').value = ""; document.getElementById('formStatus').value = "Semai"; document.getElementById('formCategory').value = "Sayuran Daun"; document.getElementById('formNotes').value = ""; formSelectedFile = null; document.getElementById('formImgLabel').innerText = "Belum ada foto"; document.getElementById('formImgPreviewContainer').classList.add('hidden');
            document.getElementById('formEstTumbuh').value = ""; document.getElementById('formEstPindah').value = ""; document.getElementById('formEstPanen').value = "";
            
            document.getElementById('formImageFileCamera').value = "";
            document.getElementById('formImageFileGallery').value = "";

            const m = document.getElementById('modalTambah'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10);
        }

        function openModalEdit(id) {
            const plant = allPlants.find(p => p.id == id); if (!plant) return;
            const alert = document.getElementById('formAlert'); if(alert) alert.classList.add('hidden'); 
            document.getElementById('formPlantName').classList.remove('input-error'); document.getElementById('formSowingDate').classList.remove('input-error');

            document.getElementById('editPlantId').value = plant.id; document.getElementById('modalTitle').innerText = "Perbarui Catatan (Edit)"; document.getElementById('formPlantName').value = plant.plant_name || ""; document.getElementById('formSowingDate').value = plant.sowing_date || ""; document.getElementById('formMedium').value = plant.planting_medium || ""; document.getElementById('formStatus').value = plant.status || "Semai";
            let cat = plant.category || "Sayuran Daun"; let notesClean = plant.notes || "";
            document.getElementById('formCategory').value = cat; document.getElementById('formNotes').value = notesClean; formSelectedFile = null; document.getElementById('formImgLabel').innerText = plant.image_url ? "Pertahankan foto lama" : "Belum ada foto";
            if (plant.image_url) { document.getElementById('formImgPreview').src = plant.image_url; document.getElementById('formImgPreviewContainer').classList.remove('hidden'); } else document.getElementById('formImgPreviewContainer').classList.add('hidden');
            
            document.getElementById('formEstTumbuh').value = plant.est_tumbuh_date || "";
            document.getElementById('formEstPindah').value = plant.est_pindah_date || "";
            document.getElementById('formEstPanen').value = plant.est_panen_date || "";

            document.getElementById('formImageFileCamera').value = "";
            document.getElementById('formImageFileGallery').value = "";

            const m = document.getElementById('modalTambah'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10);
        }

        function closeModalTambah() { const m = document.getElementById('modalTambah'); m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); }
        
        function formatTanggalID(tgl) { if (!tgl) return '-'; const d = new Date(tgl); if (isNaN(d)) return '-'; return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }

        async function muatCatatanPanen(plantId) {
            try { const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/catatan_panen?plant_id=eq.${plantId}&order=tanggal.desc&select=*`, { headers: authHeaders }); if (!r.ok) return []; return await r.json(); } catch (e) { return []; }
        }

        async function bukaIsiPanenDetail(plant) {
            const wadah = document.getElementById('detailPanenList'); if (!wadah) return;
            const rows = await muatCatatanPanen(plant.id);
            if (!rows.length) { wadah.innerHTML = '<p class="text-[11px] text-stone-400">Belum ada catatan panen untuk tanaman ini.</p>'; return; }
            wadah.innerHTML = rows.map(r => `<div class="flex justify-between items-center bg-white border border-amber-100 rounded-xl px-2.5 py-1.5"><span class="font-bold text-stone-700">\u{1F9FA} ${escapeHtml(String(r.jumlah))} ${escapeHtml(r.satuan)}</span><span class="text-xs text-stone-400">${formatTanggalID(r.tanggal)}</span></div>`).join('');
        }

        async function simpanHasilPanen(plantId) {
            const jumlahEl = document.getElementById('panenJumlah'); const satuanEl = document.getElementById('panenSatuan'); const tanggalEl = document.getElementById('panenTanggal');
            const jumlah = parseFloat((jumlahEl.value || '').replace(',', '.'));
            if (!jumlah || jumlah <= 0) return tunjukkanToast("Isi dulu jumlah hasil panennya ya, Bu.", "error");
            const plant = allPlants.find(p => p.id == plantId); if (!plant) return;
            try {
                const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/catatan_panen`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ plant_id: plant.id, plant_name: plant.plant_name, pemilik: plant.pemilik, jumlah: jumlah, satuan: satuanEl.value, tanggal: tanggalEl.value || new Date().toISOString().slice(0, 10) }) });
                if (!r.ok) throw new Error();
                tunjukkanToast("Hasil panen tercatat. Alhamdulillah!", "success");
                jumlahEl.value = '';
                bukaIsiPanenDetail(plant);
                loadRekapPanen();
            } catch (e) { tunjukkanToast("Maaf, hasil panen gagal dicatat.", "error"); }
        }

        function bagikanKeWA(jenis, nama, manfaat) {
            let teks;
            if (jenis === 'panen') teks = `Alhamdulillah, *${nama}* sudah panen di Kebon Ibu! \u{1F9FA}\u{1F331}\nDicatat dari aplikasi Catetan Kebon Ibu.`;
            else if (jenis === 'nutrisi') teks = `*Resep Nutrisi: ${nama}* \u{1F9EA}\nManfaat: ${manfaat || '-'}\n\nDari Buku Saku Nutrisi Catetan Kebon Ibu.`;
            else teks = `Halo, saya menanam *${nama}* di Kebon Ibu! \u{1F331}\nDicatat dari aplikasi Catetan Kebon Ibu.`;
            window.open('https://wa.me/?text=' + encodeURIComponent(teks), '_blank');
        }

        async function bagikanRekapWA() {
            const namaBulan = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const aktif = allPlants.filter(p => p.status !== 'Panen' && p.status !== 'Gagal');
            const hitung = (st) => allPlants.filter(p => p.status === st).length;
            let barisPanen = 'belum ada catatan panen bulan ini';
            let jumlahBenih = 0;
            try {
                const awal = new Date(); awal.setDate(1);
                const iso = awal.toISOString().slice(0, 10);
                const [rp, rb] = await Promise.all([
                    fetch(`${SUPABASE_BASE_URL}/rest/v1/catatan_panen?tanggal=gte.${iso}&select=jumlah,satuan`, { headers: authHeaders }),
                    fetch(`${SUPABASE_BASE_URL}/rest/v1/bank_benih?masih_ada=eq.true&select=id`, { headers: authHeaders }),
                ]);
                if (rp.ok) {
                    const rows = await rp.json();
                    if (rows.length) {
                        const total = {};
                        rows.forEach(x => { total[x.satuan] = (total[x.satuan] || 0) + parseFloat(x.jumlah || 0); });
                        barisPanen = Object.keys(total).map(k => `${total[k]} ${k}`).join(', ') + ` (${rows.length} kali panen)`;
                    }
                }
                if (rb.ok) jumlahBenih = (await rb.json()).length;
            } catch (e) {}
            const teks = `\u{1F331} *Rekap Kebon Ibu — ${namaBulan}*\n\n\u{1F33F} Tanaman aktif: ${aktif.length} (Semai ${hitung('Semai')} \u{2022} Tumbuh Daun ${hitung('Tumbuh Daun')} \u{2022} Siap Pindah ${hitung('Siap Pindah')})\n\u{1F9FA} Panen bulan ini: ${barisPanen}\n\u{1F330} Stok benih tersedia: ${jumlahBenih} jenis\n\nSemangat berkebun, Ibu-ibu! \u{1F49A}\n— dari aplikasi Catetan Kebon Ibu`;
            window.open('https://wa.me/?text=' + encodeURIComponent(teks), '_blank');
        }

        async function loadRekapPanen() {
            const el = document.getElementById('rekapPanenBulan'); if (!el) return;
            try {
                const awal = new Date(); awal.setDate(1);
                const iso = awal.toISOString().slice(0, 10);
                const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/catatan_panen?tanggal=gte.${iso}&select=jumlah,satuan`, { headers: authHeaders });
                if (!r.ok) throw new Error();
                const rows = await r.json();
                if (!rows.length) { el.innerHTML = '\u{1F331} Belum ada panen tercatat bulan ini. Semangat merawat tanamannya, Bu!'; return; }
                const total = {};
                rows.forEach(x => { total[x.satuan] = (total[x.satuan] || 0) + parseFloat(x.jumlah || 0); });
                const ringkasan = Object.keys(total).map(k => `<b>${total[k]} ${escapeHtml(k)}</b>`).join(' \u{2022} ');
                el.innerHTML = `\u{1F9FA} <b>Panen bulan ini:</b> ${ringkasan} <span class="text-stone-400">(dari ${rows.length} kali panen)</span>`;
            } catch (e) { el.innerHTML = 'Rekap panen belum bisa dimuat.'; }
        }

        async function loadBankBenih() {
            const list = document.getElementById('benihList'); if (!list) return;
            try {
                const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/bank_benih?order=created_at.desc&select=*`, { headers: authHeaders });
                if (!r.ok) throw new Error();
                const rows = await r.json();
                if (!rows.length) { list.innerHTML = '<div class="text-center py-6 text-stone-400 font-medium">Belum ada stok benih. Ibu yang punya benih lebih, silakan bagikan di sini.</div>'; return; }
                list.innerHTML = rows.map(b => {
                    const habis = !b.masih_ada;
                    const milikSaya = b.pemilik === currentUser;
                    const peran = localStorage.getItem('ibu_kebun_role') || 'Anggota';
                    const bolehAtur = milikSaya || peran === 'Ketua' || peran === 'Admin';
                    const tombol = bolehAtur ? (habis
                        ? `<button onclick="aturStokBenih(${b.id}, true)" class="bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-[11px] btn-press shrink-0">Ada Lagi</button>`
                        : `<button onclick="aturStokBenih(${b.id}, false)" class="bg-stone-100 text-stone-600 border border-stone-300 font-bold px-3 py-2 rounded-xl text-[11px] btn-press shrink-0">Tandai Habis</button>`) : '';
                    return `<div class="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-100 ${habis ? 'opacity-60' : ''}"><div class="pr-2"><h5 class="font-bold text-stone-800 leading-tight">${escapeHtml(b.nama_benih)} ${habis ? '<span class="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-black align-middle">HABIS</span>' : ''}</h5><p class="text-xs text-stone-500 mt-0.5">Stok: <b class="text-emerald-700">${escapeHtml(b.jumlah || '-')}</b> \u{2022} Milik: <b class="text-emerald-700">${escapeHtml(b.pemilik || 'Anonim')}</b></p>${b.catatan ? `<p class="text-xs text-stone-400 italic mt-0.5">${escapeHtml(b.catatan)}</p>` : ''}</div>${tombol}</div>`;
                }).join('');
            } catch (e) { list.innerHTML = '<div class="text-center py-6 text-rose-500 font-medium">Bank benih belum bisa dimuat.</div>'; }
        }

        function bukaModalBenih() { const m = document.getElementById('modalBenih'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10); }
        function tutupModalBenih() { const m = document.getElementById('modalBenih'); m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); }

        async function simpanBenih() {
            const nama = document.getElementById('benihNama').value.trim();
            const jumlah = document.getElementById('benihJumlah').value.trim();
            const catatan = document.getElementById('benihCatatan').value.trim();
            if (!nama) return tunjukkanToast("Isi dulu nama benihnya ya, Bu.", "error");
            try {
                const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/bank_benih`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ nama_benih: nama, jumlah: jumlah, pemilik: currentUser || 'Anonim', catatan: catatan }) });
                if (!r.ok) throw new Error();
                tunjukkanToast("Stok benih tersimpan. Terima kasih sudah berbagi!", "success");
                document.getElementById('benihNama').value = ''; document.getElementById('benihJumlah').value = ''; document.getElementById('benihCatatan').value = '';
                tutupModalBenih();
                loadBankBenih();
            } catch (e) { tunjukkanToast("Maaf, stok benih gagal disimpan.", "error"); }
        }

        async function aturStokBenih(id, masihAda) {
            try {
                const r = await fetch(`${SUPABASE_BASE_URL}/rest/v1/bank_benih?id=eq.${id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ masih_ada: masihAda }) });
                if (!r.ok) throw new Error();
                tunjukkanToast(masihAda ? "Stok ditandai ada lagi." : "Stok ditandai habis.", "success");
                loadBankBenih();
            } catch (e) { tunjukkanToast("Maaf, perubahan stok gagal disimpan.", "error"); }
        }

        function openModalDetail(id) {
            const plant = allPlants.find(p => p.id == id); if (!plant) return; activeHapusId = plant.id;
            const isOwner = plant.pemilik === currentUser; 
            const userRole = localStorage.getItem('ibu_kebun_role') || 'Anggota';
            const isKetuaAtauAdmin = userRole === 'Ketua' || userRole === 'Admin';
            const canManage = isOwner || isKetuaAtauAdmin;

            let cat = plant.category || "Sayuran Daun"; let notesClean = plant.notes || "";
            const m = document.getElementById('modalDetail');

            let detailImageHTML = plant.image_url 
                ? `<img src="${escapeHtml(plant.image_url)}" class="w-full h-full object-cover">` 
                : dapatkanTunasGraphicSVG(cat);

            const langkah = [];
            if (plant.sowing_date) langkah.push({ ikon: '\u{1F331}', label: 'Disemai / ditanam', tgl: plant.sowing_date });
            if (plant.est_tumbuh_date) langkah.push({ ikon: '\u{1F33F}', label: 'Perkiraan tumbuh daun', tgl: plant.est_tumbuh_date });
            if (plant.est_pindah_date) langkah.push({ ikon: '\u{1FAB4}', label: 'Perkiraan pindah tanam', tgl: plant.est_pindah_date });
            if (plant.last_watered) langkah.push({ ikon: '\u{1F4A7}', label: 'Terakhir disiram', tgl: plant.last_watered });
            if (plant.est_panen_date) langkah.push({ ikon: '\u{1F9FA}', label: 'Perkiraan panen', tgl: plant.est_panen_date });
            const timelineHTML = langkah.length ? `<div class="bg-white border border-stone-200 rounded-xl p-2.5"><p class="font-extrabold text-stone-700 mb-1.5">\u{1F550} Garis Waktu Tumbuh</p><div class="space-y-1.5">${langkah.map(l => `<div class="flex justify-between text-[11px]"><span>${l.ikon} ${l.label}</span><b class="text-stone-500">${formatTanggalID(l.tgl)}</b></div>`).join('')}</div></div>` : '';
            const panenHTML = `<div class="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5 space-y-2"><p class="font-extrabold text-stone-700">\u{1F9FA} Catat Hasil Panen</p><div class="flex space-x-1.5"><input type="number" id="panenJumlah" step="0.1" min="0" placeholder="Jumlah" class="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-[11px]"><select id="panenSatuan" class="bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-[11px]"><option value="kg">kg</option><option value="ikat">ikat</option><option value="buah">buah</option><option value="pot">pot</option><option value="baskom">baskom</option></select><input type="date" id="panenTanggal" class="flex-1 bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-[11px]" value="${new Date().toISOString().slice(0, 10)}"></div><button onclick="simpanHasilPanen(${plant.id})" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl btn-press">Simpan Hasil Panen</button><div id="detailPanenList" class="space-y-1.5"></div></div>`;
            document.getElementById('detailBodyContent').innerHTML = `<div class="h-32 bg-stone-100 rounded-xl overflow-hidden border flex items-center justify-center">${detailImageHTML}</div><div class="space-y-1"><h4 class="font-extrabold text-stone-800 text-sm leading-tight">${escapeHtml(plant.plant_name)}</h4><p class="text-xs text-stone-400">Pemilik: <b class="text-emerald-600">${escapeHtml(plant.pemilik || 'Anonim')}</b> • Kategori: ${escapeHtml(cat)}</p></div><div class="bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-[11px] leading-relaxed text-stone-600"><b>Panduan Perawatan:</b><br>${escapeHtml(notesClean || 'Belum ada catatan khusus.')}</div>` + timelineHTML + panenHTML;
            bukaIsiPanenDetail(plant);
            const btnHapus = document.getElementById('detailHapusBtn');
            if(canManage) { btnHapus.classList.remove('hidden'); btnHapus.onclick = () => openModalHapus(); } else { btnHapus.classList.add('hidden'); }
            m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10);
        }
        function closeModalDetail() { const m = document.getElementById('modalDetail'); m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); }
        function openModalHapus() { closeModalDetail(); const m = document.getElementById('modalHapusKonfirmasi'); m.classList.remove('hidden'); setTimeout(() => m.classList.add('opacity-100'), 10); }
        function closeModalHapus() { const m = document.getElementById('modalHapusKonfirmasi'); m.classList.remove('opacity-100'); setTimeout(() => m.classList.add('hidden'), 200); }

        function switchTab(tId) {
            currentTab = tId; ['kebun', 'kalender', 'panen', 'tugas', 'nutrisi', 'ai', 'benih'].forEach(s => { const sec = document.getElementById(`section-${s}`); if(sec) sec.classList.add('hidden'); });
            const sec = document.getElementById(`section-${tId}`); if(sec) { sec.classList.remove('hidden'); sec.classList.remove('tab-section'); void sec.offsetWidth; sec.classList.add('tab-section'); }
            document.querySelectorAll('.menu-tile').forEach(b => { b.classList.toggle('tile-aktif', b.getAttribute('data-tab') === tId); });
            if (tId === 'kalender') renderKalender();
            if (tId === 'tugas') renderWateringList();
            if (tId === 'benih') loadBankBenih();
            if (tId === 'panen') filterPlants('Semua');
            if (tId === 'kebun') filterPlants(currentFilterStatus);
        }

        // --- MINTA SARAN AI UNTUK TANGGAL PANEN ---
        async function generateAiGuide() {
            const pName = document.getElementById('formPlantName').value.trim(); 
            const baseDateVal = document.getElementById('formSowingDate').value;
            const statusVal = document.getElementById('formStatus').value;
            
            if (!pName || !baseDateVal) return tunjukkanToast("Silakan tulis dulu nama tanamannya dan tanggal semainya!", "error");
            
            const btn = document.getElementById('btnAiGuide'); const icon = document.getElementById('btnAiGuideIcon'); const loading = document.getElementById('btnAiGuideLoading');
            btn.disabled = true; icon.classList.add('hidden'); loading.classList.remove('hidden');
            tunjukkanToast("Nyi Sari sedang menghitung jadwal tanam...", "warning");
            
            let statusContext = "";
            if (statusVal === "Semai") statusContext = "Tanaman ini baru saja disemai dari biji.";
            else if (statusVal === "Tumbuh Daun") statusContext = "Tanaman ini sudah berbentuk bibit yang mulai berdaun (bukan dari biji lagi).";
            else if (statusVal === "Siap Pindah") statusContext = "Tanaman ini sudah dewasa and siap dipindah ke pot besar/tanah.";
            else if (statusVal === "Panen") statusContext = "Tanaman ini sudah masuk masa panen.";

            try {
                const prompt = `Berikan panduan menanam singkat 1 paragraf untuk tanaman: "${pName}".
                PENTING: ${statusContext}
                Berdasarkan status/kondisi saat ini, berikan estimasi JUMALAH HARI (dihitung dari HARI INI) untuk mencapai tahap selanjutnya.
                Jika suatu tahap sudah terlewati (misal karena mulainya dari bibit besar), isi angkanya dengan 0.
                Kembalikan format JSON saja.`;
                
                const schema = { 
                    type: "OBJECT", 
                    properties: { 
                        tips: { type: "STRING" }, 
                        hari_tumbuh: { type: "INTEGER", description: "Hari menuju mulai tumbuh daun (isi 0 jika sudah lewat)" }, 
                        hari_pindah: { type: "INTEGER", description: "Hari menuju siap pindah pot (isi 0 jika sudah lewat)" }, 
                        hari_panen: { type: "INTEGER", description: "Hari menuju siap panen" } 
                    }, 
                    required: ["tips", "hari_tumbuh", "hari_pindah", "hari_panen"] 
                };
                
                const answerJSON = await panggilGeminiAPI(prompt, dapatkanNyiSariPersona(), null, schema);
                const parsed = JSON.parse(answerJSON);
                
                document.getElementById('formNotes').value = parsed.tips;
                
                const baseDate = new Date(baseDateVal);
                document.getElementById('formEstTumbuh').value = parsed.hari_tumbuh > 0 ? nambihDinten(baseDate, parsed.hari_tumbuh) : "";
                document.getElementById('formEstPindah').value = parsed.hari_pindah > 0 ? nambihDinten(baseDate, parsed.hari_pindah) : "";
                document.getElementById('formEstPanen').value = parsed.hari_panen > 0 ? nambihDinten(baseDate, parsed.hari_panen) : "";
                
                ['formEstTumbuh', 'formEstPindah', 'formEstPanen', 'formNotes'].forEach(id => {
                    const el = document.getElementById(id);
                    el.classList.add('field-ai-filled'); setTimeout(() => el.classList.remove('field-ai-filled'), 2000);
                });

                tunjukkanToast("Estimasi dari Nyi Sari sudah dicatat!", "success");
            } catch (e) { tununjukkanToast("Gagal membuat estimasi.", "error"); } 
            finally { btn.disabled = false; icon.classList.remove('hidden'); loading.classList.add('hidden'); }
        }

        // --- SISTEM NUTRISI ---
        async function simpanNutrisiKeDb() {
            if (nutrisiDraftSaved) return; 
            nutrisiDraftSaved = true;
            
            const name = document.getElementById('nutrisiPreviewName').value.trim(); 
            const benefit = document.getElementById('nutrisiPreviewBenefit').value.trim(); 
            const schedule = document.getElementById('nutrisiPreviewSchedule').value.trim(); 
            const dosage = document.getElementById('nutrisiPreviewDosage').value.trim();
            
            if (!name || !benefit || !schedule || !dosage) { 
                nutrisiDraftSaved = false; 
                return tunjukkanToast("Mohon maaf Ibu, masih ada kotak yang belum diisi.", "error"); 
            }
            
            const btn = document.getElementById('btnSimpanNutrisi'); 
            btn.disabled = true; 
            btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Sedang Menyimpan...';
            
            try {
                let headers = { ...authHeaders, 'Prefer': 'return=representation' };
                const res = await fetch(`${SUPABASE_BASE_URL}/rest/v1/farm_nutrition`, { 
                    method: 'POST', 
                    headers: headers, 
                    body: JSON.stringify({ name, benefit, schedule, dosage }) 
                });
                
                if (!res.ok) {
                    const errInfo = await res.json().catch(() => ({}));
                    throw new Error(errInfo.message || errInfo.details || "Penolakan akses dari database server.");
                }
                
                tunjukkanToast("Terima kasih Ibu! Resep baru sudah tersimpan.", "success");
                closeModalNutrisi(); 
                await loadNutritionFromDb();
            } catch (error) { 
                console.error("Gagal menyimpan resep nutrisi:", error);
                tunjukkanToast("Gagal menyimpan resep: " + error.message, "error"); 
                nutrisiDraftSaved = false; 
            } finally { 
                btn.disabled = false; 
                btn.innerHTML = '<i class="fa-solid fa-plus"></i> <span>Tambahkan</span>'; 
            }
        }

        function openModalNutrisi() {
            const inputTanaman = document.getElementById('nutrisiInputTanaman');
            const inputKategori = document.getElementById('nutrisiInputKategori');
            const previewName = document.getElementById('nutrisiPreviewName');
            const previewBenefit = document.getElementById('nutrisiPreviewBenefit');
            const previewSchedule = document.getElementById('nutrisiPreviewSchedule');
            const previewDosage = document.getElementById('nutrisiPreviewDosage');
            
            if (inputTanaman) inputTanaman.value = "";
            if (inputKategori) inputKategori.value = "Sayuran Daun";
            if (previewName) previewName.value = "";
            if (previewBenefit) previewBenefit.value = "";
            if (previewSchedule) previewSchedule.value = "";
            if (previewDosage) previewDosage.value = "";

            const previewSec = document.getElementById('nutrisiPreviewSection');
            if (previewSec) previewSec.classList.add('hidden');
            
            const btnSimpan = document.getElementById('btnSimpanNutrisi');
            if (btnSimpan) btnSimpan.disabled = true;
            
            nutrisiDraftSaved = false;
            
            const m = document.getElementById('modalNutrisi');
            if (m) {
                m.classList.remove('hidden');
                setTimeout(() => m.classList.add('opacity-100'), 10);
            }
            setTimeout(() => {
                if (inputTanaman) inputTanaman.focus();
            }, 300);
        }

        function closeModalNutrisi() { 
            const m = document.getElementById('modalNutrisi'); 
            if(m) {
                m.classList.remove('opacity-100'); 
                setTimeout(() => m.classList.add('hidden'), 200); 
            }
        }

        async function generasiPreviewNutrisi() {
            const namaTanaman = document.getElementById('nutrisiInputTanaman').value.trim(); 
            if (!namaTanaman) return tunjukkanToast("Mohon maaf Ibu, nama tanaman harus diisi dulu ya!", "error");
            const btn = document.getElementById('btnGeneratePreview'); const icon = document.getElementById('previewAiIcon'); const loading = document.getElementById('previewAiLoading');
            btn.disabled = true; btn.classList.add('opacity-75'); icon.classList.add('hidden'); loading.classList.remove('hidden'); tunjukkanToast("Nyi Sari sedang mencarikan resepnya...", "warning");
            try {
                const prompt = `Buatkan resep nutrisi organik pakai bahan dapur untuk tanaman "${namaTanaman}". Berikan penjelasan rincinya.`;
                const jsonSchema = { type: "OBJECT", properties: { name: { type: "STRING" }, benefit: { type: "STRING" }, schedule: { type: "STRING" }, dosage: { type: "STRING" } }, required: ["name", "benefit", "schedule", "dosage"] };
                const rawResponse = await panggilGeminiAPI(prompt, dapatkanNyiSariPersona(), null, jsonSchema); const parsed = JSON.parse(rawResponse);
                document.getElementById('nutrisiPreviewName').value = parsed.name || ""; document.getElementById('nutrisiPreviewBenefit').value = parsed.benefit || ""; document.getElementById('nutrisiPreviewSchedule').value = parsed.schedule || ""; document.getElementById('nutrisiPreviewDosage').value = parsed.dosage || "";
                document.getElementById('nutrisiPreviewSection').classList.remove('hidden'); document.getElementById('btnSimpanNutrisi').disabled = false; nutrisiDraftSaved = false;
                tunjukkanToast("Resep dari Nyi Sari sudah siap Ibu!", "success");
            } catch (error) { tununjukkanToast("Maaf, Nyi Sari gagal: " + error.message, "error"); } finally { btn.disabled = false; btn.classList.remove('opacity-75'); icon.classList.remove('hidden'); loading.classList.add('hidden'); }
        }

        function switchSubAi(sId) {
            currentSubAi = sId; ['chat', 'doctor'].forEach(s => { const el = document.getElementById(`ai-sub-${s}`); if(el) el.classList.add('hidden'); const btn = document.getElementById(`btn-sub-${s}`); if(btn) btn.className = "flex-1 py-2.5 rounded-lg font-bold text-center text-stone-600 transition-all"; });
            const sel = document.getElementById(`ai-sub-${sId}`); if(sel) sel.classList.remove('hidden'); const bId = document.getElementById(`btn-sub-${sId}`); if(bId) bId.className = "flex-1 py-2.5 rounded-lg font-bold text-center bg-white text-stone-800 shadow-sm transition-all";
        }

        function previewDoctorImage(event) {
            const file = event.target.files[0]; if (!file) return; doctorSelectedFile = file; document.getElementById('doctorImgLabel').innerText = file.name;
            const reader = new FileReader(); reader.onload = function(e) { document.getElementById('doctorImgPreview').src = e.target.result; document.getElementById('doctorImgContainer').classList.remove('hidden'); }; reader.readAsDataURL(file);
        }

        function previewFormImage(event) {
            const file = event.target.files[0]; 
            if (!file) return; 
            formSelectedFile = file; 
            document.getElementById('formImgLabel').innerText = file.name;
            const reader = new FileReader(); 
            reader.onload = function(e) { 
                document.getElementById('formImgPreview').src = e.target.result; 
                document.getElementById('formImgPreviewContainer').classList.remove('hidden'); 
            }; 
            reader.readAsDataURL(file);
        }

        async function diagnosePlantImage() {
            if (!doctorSelectedFile) return tunjukkanToast("Maaf Ibu, harus memilih foto daunnya dulu!", "error");
            const btn = document.getElementById('btnDiagnose'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i> Sedang Memeriksa...';
            try {
                const base64Data = await fileToBase64(doctorSelectedFile); 
                const prompt = "Ibu, tolong periksa foto daun ini secara jelas dan sangat rinci. Sebutkan nama penyakitnya dalam Bahasa Indonesia, gejala-gejalanya, serta 2 sampai 3 cara mengatasinya memakai bahan herbal organik dari dapur secara jelas dan detail.";
                const dataText = await panggilGeminiAPI(prompt, dapatkanNyiSariPersona(), { base64: base64Data, mimeType: doctorSelectedFile.type });
                document.getElementById('diagnosisText').innerHTML = formatAiResponse(dataText); document.getElementById('diagnosisResult').classList.remove('hidden');
            } catch (error) { tununjukkanToast("Gagal: " + error.message, "error"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Mulai Periksa Penyakit</span>'; }
        }

        function tununjukkanToast(msg, tipe) { tunjukkanToast(msg, tipe); } // Alias
        function tunjukkanToast(msg, tipe) {
            const t = document.getElementById('toast'); const i = document.getElementById('toastIcon'); const m = document.getElementById('toastMessage');
            if(m) m.innerText = msg;
            if(i) {
                if (tipe === 'success') i.innerHTML = '<i class="fa-solid fa-circle-check text-lime-400"></i>'; 
                else if (tipe === 'warning') i.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>'; 
                else i.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-400"></i>';
            }
            if(t) { t.style.opacity = '1'; t.style.pointerEvents = 'auto'; setTimeout(() => { t.style.opacity = '0'; t.style.pointerEvents = 'none'; }, 2500); }
        }

        function formatAiResponse(text) {
            if (!text) return ""; let lines = text.split("\n"); let resultHTML = [];
            for (let line of lines) {
                line = line.trim(); if (!line) continue;
                if (line.startsWith("#") || line.startsWith("Kondisi:") || line.startsWith("Diagnosis:")) { resultHTML.push(`<h4 class="font-extrabold text-sm text-emerald-900 border-b border-emerald-100 pb-1.5 mb-2 mt-2 flex items-center space-x-1.5"><i class="fa-solid fa-seedling text-emerald-600"></i> <span>${line.replace(/[#*]/g, "").trim()}</span></h4>`); continue; }
                if (line.match(/^\d+\.\s+\*\*([^*]+)\*\*:/) || line.match(/^\d+\.\s+([^*]+):/)) { let parts = line.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim().split(":"); resultHTML.push(`<div class="bg-white/80 border border-emerald-100 p-3 rounded-2xl my-2.5 shadow-sm space-y-1"><span class="font-black text-xs text-emerald-800 block flex items-center space-x-1.5"><i class="fa-solid fa-flask-vial text-lime-600"></i><span>${parts[0].trim()}</span></span><p class="text-xs text-stone-600 leading-relaxed">${parts.slice(1).join(":").trim()}</p></div>`); continue; }
                if (line.startsWith("*") || line.startsWith("-")) {
                    let cleanBullet = line.replace(/^[*-\s]+/, "").trim();
                    if (cleanBullet.startsWith("**Caranya:**") || cleanBullet.startsWith("Caranya:")) resultHTML.push(`<div class="bg-amber-50/70 border border-amber-200/50 p-2 rounded-xl my-1 text-xs"><b class="text-amber-800"><i class="fa-solid fa-circle-play mr-1"></i>Caranya:</b> ${cleanBullet.replace(/\*\*|:/g, "").replace(/^Caranya/i, "").trim()}</div>`);
                    else if (cleanBullet.startsWith("**Kegunaan:**") || cleanBullet.startsWith("Kegunaan:")) resultHTML.push(`<div class="bg-blue-50/70 border border-blue-200/50 p-2 rounded-xl my-1 text-xs"><b class="text-blue-800"><i class="fa-solid fa-circle-check mr-1"></i>Manfaat:</b> ${cleanBullet.replace(/\*\*|:/g, "").replace(/^Kegunaan/i, "").trim()}</div>`);
                    else resultHTML.push(`<p class="pl-3.5 relative text-[11px] text-stone-600 leading-relaxed my-1"><span class="absolute left-1.5 text-emerald-500 font-bold">•</span>${cleanBullet.replace(/\*\*([^*]+)\*\*/g, '<b class="text-emerald-800 font-bold">$1</b>')}</p>`);
                    continue;
                }
                resultHTML.push(`<p class="text-[11px] leading-relaxed text-stone-600 my-1">${line.replace(/\*\*([^*]+)\*\*/g, '<b class="text-emerald-800 font-extrabold bg-emerald-50 px-1 rounded">$1</b>')}</p>`);
            } return `<div class="space-y-2.5 font-medium">${resultHTML.join("")}</div>`;
        }
        function fileToBase64(file) { return new Promise((res, rej) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => res(reader.result.split(',')[1]); reader.onerror = error => rej(error); }); }
