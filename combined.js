/* ==========================================================================
   PENGATURAN MODE OFFLINE MANDIRI & HYBRID GOOGLE SHEET
   ========================================================================== */

// 1. Fungsi Utama Mengambil Jadwal Sholat dari Database Lokal (100% Offline)
function muatJadwalSholatLokal() {
    // Ambil tanggal hari ini dengan format YYYY-MM-DD sesuai zona waktu lokal
    const sekarang = new Date();
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
    const tanggal = String(sekarang.getDate()).padStart(2, '0');
    const stringTanggal = `${tahun}-${bulan}-${tanggal}`;

    // Cari di dalam DATABASE_JADWAL_TAHUNAN (dari file jadwal_db.js)
    if (typeof DATABASE_JADWAL_TAHUNAN !== 'undefined' && DATABASE_JADWAL_TAHUNAN[stringTanggal]) {
        const jadwalHariIni = DATABASE_JADWAL_TAHUNAN[stringTanggal];
        
        // Perbarui objek global penampung jadwal sholat aplikasi
        jadwalSholatHariIni = {
            imsak: jadwalHariIni.imsak,
            fajr: jadwalHariIni.fajr,
            dhuhr: jadwalHariIni.dhuhr,
            asr: jadwalHariIni.asr,
            sunset: jadwalHariIni.magrib, // mapping magrib ke sunset jika diperlukan engine
            isha: jadwalHariIni.isya
        };

        // Inject langsung ke elemen UI halaman index.html jika elemennya ada
        if(document.getElementById('time-imsak')) document.getElementById('time-imsak').innerText = dataJadwal.imsak;
        if(document.getElementById('time-subuh')) document.getElementById('time-subuh').innerText = jadwalHariIni.fajr;
        if(document.getElementById('time-dzuhur')) document.getElementById('time-dzuhur').innerText = jadwalHariIni.dhuhr;
        if(document.getElementById('time-ashar')) document.getElementById('time-ashar').innerText = jadwalHariIni.asr;
        if(document.getElementById('time-maghrib')) document.getElementById('time-maghrib').innerText = jadwalHariIni.magrib;
        if(document.getElementById('time-isya')) document.getElementById('time-isya').innerText = jadwalHariIni.isya;
        
        console.log(`[OFFLINE] Jadwal sholat hari ini (${stringTanggal}) berhasil dimuat dari database lokal.`);
    } else {
        console.warn(`[WARN] Jadwal untuk tanggal ${stringTanggal} tidak ditemukan di database lokal. Menggunakan nilai default bawaan.`);
    }
}

// 2. Fungsi Hybrid Ambil Data Informasi & Petugas dari Google Sheet (Online dengan Fallback Aman)
function sinkronisasiDataMadingSheet() {
    // Ganti URL ini dengan URL Apps Script Web App Google Sheet Anda
    const URL_APPS_SCRIPT = "CONTOH_URL_WEB_APP_APPS_SCRIPT_ANDA"; 

    console.log("[HYBRID] Mencoba menyinkronkan data informasi dari Google Sheet...");

    fetch(URL_APPS_SCRIPT)
        .then(response => response.json())
        .then(res => {
            console.log("[HYBRID] Koneksi sukses. Memperbarui informasi mading dari Google Sheet.");

            // A. Perbarui data konfigurasi Jeda Iqamah secara dinamis jika ada di Sheet
            if (res.jedaIqamah) {
                dataMasjidGlobal.jedaIqamah = {
                    "SUBUH": res.jedaIqamah.SUBUH || 10,
                    "DZUHUR": res.jedaIqamah.DZUHUR || 10,
                    "ASHAR": res.jedaIqamah.ASHAR || 10,
                    "MAGHRIB": res.jedaIqamah.MAGHRIB || 10,
                    "ISYA": res.jedaIqamah.ISYA || 10
                };
            }

            // B. Perbarui Petugas Sholat Jumat & Petugas Harian jika ada di UI
            if (res.petugasJumat) {
                if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = res.petugasJumat.tanggal || "-";
                if(document.getElementById('khatib')) document.getElementById('khatib').innerText = res.petugasJumat.khatib || "-";
                if(document.getElementById('imamJumat')) document.getElementById('imamJumat').innerText = res.petugasJumat.imam || "-";
                if(document.getElementById('muadzinJumat')) document.getElementById('muadzinJumat').innerText = res.petugasJumat.muadzin || "-";
            }

            // C. Sistem Slide Transisi Teks Informasi Tengah / Running Text Marquee
            const container = document.getElementById('infoUpdateContent');
            if (container && res.infoUpdate && res.infoUpdate.length > 0) {
                const infoList = res.infoUpdate;
                let index = 0;
                
                container.innerText = infoList[0];
                index = 1;

                if (window.intervalInfoMasjid) clearInterval(window.intervalInfoMasjid);

                window.intervalInfoMasjid = setInterval(() => {
                    container.classList.remove('show');
                    setTimeout(() => {
                        container.innerText = infoList[index];
                        container.classList.add('show');
                        index = (index + 1) % infoList.length;
                    }, 3000);
                }, 36000);
            }
        })
        .catch(error => {
            // JIKA INTERNET PUTUS ATAU GOOGLE SHEET ERROR:
            // Sistem diam, tidak crash, dan tetap menggunakan nilai default/teks yang sudah ada di HTML.
            console.error("[OFFLINE MODE] Gagal sinkronisasi Google Sheet (Offline/RTO). Menggunakan data default aman:", error);
        });
}

// 3. Inisialisasi Pertama Kali Saat Aplikasi Dibuka di TV Monitor
window.addEventListener('load', () => {
    // Jalankan pemuatan jadwal sholat offline seketika
    muatJadwalSholatLokal();
    
    // Jalankan sinkronisasi data pendukung dari internet
    sinkronisasiDataMadingSheet();

    // Perbarui jadwal offline setiap jam sekali untuk mengantisipasi pergantian hari (tengah malam)
    setInterval(muatJadwalSholatLokal, 3600000);

    // Coba hubungkan ulang ke cloud Google Sheet setiap 10 menit sekali untuk update mading
    setInterval(sinkronisasiDataMadingSheet, 600000);
});
