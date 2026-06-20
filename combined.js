/* ==========================================================================
   BAGIAN 1: ENGINE ENGINE UTAMA & DATABASE JADWAL SHOLAT GLOBAL
   ========================================================================== */

// Wadah default jadwal sholat sebelum data dari Sheet 2 berhasil dimuat
let jadwalSholatHariIni = {
    imsak: "04:44",
    fajr: "04:54",
    dhuhr: "12:18",
    asr: "15:43",
    sunset: "18:21",
    isha: "19:35"
};

// Objek penampung konfigurasi jeda iqamah dari Apps Script (Sheet 1)
let dataMasjidGlobal = {
    jedaIqamah: {
        "SUBUH": 10,
        "DZUHUR": 10,
        "ASHAR": 10,
        "MAGHRIB": 10,
        "ISYA": 10
    }
};

// Sistem Alarm Beep (Berbunyi otomatis saat countdown menyentuh angka 0)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep() {
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    osc.start(); osc.stop(audioCtx.currentTime + 1);
}
function triggerAlarm() {
    playBeep();
    setTimeout(playBeep, 1500);
    setTimeout(playBeep, 3000);
}

// Helper untuk mengubah tanggal komputer menjadi format Sheet 2 (Contoh: "20 Juni")
function dapatkanKeyTanggalFormat(dateObj) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    let tgl = String(dateObj.getDate()).padStart(2, '0');
    let bln = namaBulan[dateObj.getMonth()];
    return `${tgl} ${bln}`;
}

/* ==========================================================================
   BAGIAN 2: ENGINE COUNTDOWN DETIK & TRANSISI ADZAN KE IQAMAH (Tiap 1 Detik)
   ========================================================================== */
setInterval(() => {
    const sekarang = new Date();
    
    /* 1. Perbarui Jam Digital Utama */
    let jam = String(sekarang.getHours()).padStart(2, '0');
    let menit = String(sekarang.getMinutes()).padStart(2, '0');
    let detik = String(sekarang.getSeconds()).padStart(2, '0');
    if (document.getElementById('clock')) {
        document.getElementById('clock').innerText = `${jam}:${menit}:${detik}`;
    }

    /* 2. Pemetaan Target Waktu Adzan Berdasarkan Data Sinkronisasi */
    const daftarSholat = [
        { nama: 'SUBUH', waktu: jadwalSholatHariIni.fajr },
        { nama: 'DZUHUR', waktu: jadwalSholatHariIni.dhuhr },
        { nama: 'ASHAR', waktu: jadwalSholatHariIni.asr },
        { nama: 'MAGHRIB', waktu: jadwalSholatHariIni.sunset },
        { nama: 'ISYA', waktu: jadwalSholatHariIni.isha }
    ];

    let sholatActive = null;
    let waktuSekarangDetik = (sekarang.getHours() * 3600) + (sekarang.getMinutes() * 60) + sekarang.getSeconds();

    for (let i = 0; i < daftarSholat.length; i++) {
        let tParts = daftarSholat[i].waktu.split(':');
        let targetDetik = (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60);
        
        // Ambil konfigurasi jeda iqamah per sholat
        let mIqamahConfig = dataMasjidGlobal.jedaIqamah[daftarSholat[i].nama] || 10;
        let batasIqamahDetik = mIqamahConfig * 60;

        if (targetDetik + batasIqamahDetik > waktuSekarangDetik) {
            sholatActive = { 
                nama: daftarSholat[i].nama, 
                waktuStr: daftarSholat[i].waktu, 
                targetDetik: targetDetik, 
                batasIqamahDetik: batasIqamahDetik,
                isBesok: false 
            };
            break;
        }
    }

    // Jika waktu Isya telah terlewati, target mundur ke Subuh esok hari
    if (!sholatActive) {
        let tParts = daftarSholat[0].waktu.split(':');
        sholatActive = { 
            nama: 'SUBUH', 
            waktuStr: daftarSholat[0].waktu, 
            targetDetik: (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60) + 86400, 
            batasIqamahDetik: (dataMasjidGlobal.jedaIqamah["SUBUH"] || 10) * 60,
            isBesok: true 
        };
    }

    let sisaDetik = sholatActive.targetDetik - waktuSekarangDetik;

    const elLabel = document.getElementById('nextPrayerLabel');
    const elWaktu = document.getElementById('nextPrayerTime');
    const elCountdown = document.getElementById('nextPrayerCountdown');
    const elJadwalContainer = document.getElementById('jadwal-shalat') || document.querySelector('.prayer-times-container');

    if (elWaktu) elWaktu.innerText = sholatActive.waktuStr;

    /* 3. Pengkondisian Layar: Mode Menunggu Adzan vs Mode Menunggu Iqamah */
    if (sisaDetik <= 0 && !sholatActive.isBesok) {
        // Tepat saat adzan berkumandang
        if (sisaDetik === 0) triggerAlarm(); 

        // Sembunyikan daftar tabel waktu agar layar fokus ke hitung mundur Iqamah
        if (elJadwalContainer) elJadwalContainer.style.setProperty('display', 'none', 'important');
        if (elWaktu) elWaktu.style.setProperty('display', 'none', 'important');

        if (elLabel) {
            elLabel.innerHTML = 'MENUNGGU IQAMAH';
            elLabel.classList.add('iqamah-mode');
        }
        
        let sisaIqamah = sholatActive.batasIqamahDetik + sisaDetik;
        let mIqamah = String(Math.floor(sisaIqamah / 60)).padStart(2, '0');
        let sIqamah = String(sisaIqamah % 60).padStart(2, '0');
        
        if (elCountdown) {
            elCountdown.innerText = `${mIqamah}:${sIqamah}`;
            elCountdown.style.color = '#ef4444';
        }

        // Tepat saat waktu iqamah dimulai
        if (sisaIqamah === 0) triggerAlarm(); 
    } else {
        // Kembalikan tampilan tabel waktu sholat harian
        if (elJadwalContainer) elJadwalContainer.style.setProperty('display', 'block');
        if (elWaktu) elWaktu.style.setProperty('display', 'inline-block'); 

        if (elLabel) {
            elLabel.innerHTML = `WAKTU SHOLAT <span id="nextPrayerName">${sholatActive.isBesok ? 'SUBUH (BESOK)' : sholatActive.nama}</span>`;
            elLabel.classList.remove('iqamah-mode');
        }

        let jamSisa = String(Math.floor(sisaDetik / 3600)).padStart(2, '0');
        let menitSisa = String(Math.floor((sisaDetik % 3600) / 60)).padStart(2, '0');
        let detikSisa = String(sisaDetik % 60).padStart(2, '0');

        if (elCountdown) {
            elCountdown.innerText = `${jamSisa}:${menitSisa}:${detikSisa}`;
            elCountdown.style.color = '#ef4444';
        }
    }
}, 1000);

/* ==========================================================================
   BAGIAN 3: AMBIL DATA DUA SHEET (INFORMASI UMUM & LOOKUP JADWAL SHOLAT)
   ========================================================================== */
// PASTI KAN URL INI SESUAI DENGAN HASIL WEB APP DEPLOYMENT APPS SCRIPT ANDA
const URL_GOOGLE_SHEET = "https://script.google.com/macros/s/AKfycbzbz9r75Jkg9Kd2geoNRWzXp2IAzJC47Mh7gZsPMDXF7MvGL_JM6StX7PocTC2yLE3WLg/exec";

function muatDataDariGoogleSheet() {
    fetch(URL_GOOGLE_SHEET)
        .then(response => response.json())
        .then(res => {
            
            // 1. Injeksi Data Petugas & Informasi Kas Keuangan (Sheet 1)
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = res.tanggalJumat || '-';
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = res.khatib || '-';
            if(document.getElementById('imam')) document.getElementById('imam').innerText = res.imam || '-';
            if(document.getElementById('muadzin')) document.getElementById('muadzin').innerText = res.muadzin || '-';
            
            if(document.getElementById('saldoAwal')) document.getElementById('saldoAwal').innerText = "Rp " + (res.saldoAwal || '0');
            if(document.getElementById('pemasukan')) document.getElementById('pemasukan').innerText = "Rp " + (res.pemasukan || '0');
            if(document.getElementById('pengeluaran')) document.getElementById('pengeluaran').innerText = "Rp " + (res.pengeluaran || '0');
            if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = "Rp " + (res.totalSaldo || '0');

            if(document.getElementById('runText1')) document.getElementById('runText1').innerText = res.runningText || '';
            if(document.getElementById('runText2')) document.getElementById('runText2').innerText = res.runningText || '';

            // Simpan data konfigurasi jeda iqamah jika dikirim oleh skrip sheet
            if(res.jedaIqamah) {
                dataMasjidGlobal.jedaIqamah = res.jedaIqamah;
            }

            // 2. Lookup Waktu Sholat dari Array Sheet 2 Berdasarkan Tanggal Hari Ini
            if (res.tabelSholat && res.tabelSholat.length > 0) {
                const tanggalKey = dapatkanKeyTanggalFormat(new Date()); // Menghasilkan string, misal: "20 Juni"
                const pencarianJadwal = res.tabelSholat.find(item => item.tanggal === tanggalKey);

                if (pencarianJadwal) {
                    // Update variable data pusat
                    jadwalSholatHariIni = {
                        imsak:  pencarianJadwal.imsak,
                        fajr:   pencarianJadwal.subuh,
                        dhuhr:  pencarianJadwal.zuhur,
                        asr:    pencarianJadwal.asar,
                        sunset: pencarianJadwal.magrib,
                        isha:   pencarianJadwal.isya
                    };

                    // Tempel data jam langsung ke papan display utama bawah
                    if(document.getElementById('time-imsak')) document.getElementById('time-imsak').innerText = pencarianJadwal.imsak;
                    if(document.getElementById('time-subuh')) document.getElementById('time-subuh').innerText = pencarianJadwal.subuh;
                    if(document.getElementById('time-dzuhur')) document.getElementById('time-dzuhur').innerText = pencarianJadwal.zuhur;
                    if(document.getElementById('time-ashar')) document.getElementById('time-ashar').innerText = pencarianJadwal.asar;
                    if(document.getElementById('time-maghrib')) document.getElementById('time-maghrib').innerText = pencarianJadwal.magrib;
                    if(document.getElementById('time-isya')) document.getElementById('time-isya').innerText = pencarianJadwal.isya;
                }
            }

            // 3. Sistem Slide Transisi Teks Informasi Tengah
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
            console.error("Gagal melakukan sinkronisasi data Google Sheet:", error);
        });
}

// Inisialisasi Pertama Kali Saat Aplikasi Dibuka di TV Monitor
window.addEventListener('load', () => {
    muatDataDariGoogleSheet();
    // Sinkronisasi ulang secara berkala ke cloud setiap 5 menit sekali
    setInterval(muatDataDariGoogleSheet, 300000);
});
