/* ==========================================================================
   BAGIAN 1: SISTEM DATABASE JADWAL SHOLAT INTERNAL & ALARM
   ========================================================================== */

// Fungsi untuk mengambil data jadwal sholat hari ini dari jadwal_db.js
function ambilJadwalHariIni(dateObj) {
    const tahun = dateObj.getFullYear();
    const bulan = String(dateObj.getMonth() + 1).padStart(2, '0');
    const tanggal = String(dateObj.getDate()).padStart(2, '0');
    const keyTanggal = `${tahun}-${bulan}-${tanggal}`; // Format: YYYY-MM-DD

    // Cek apakah DATABASE_JADWAL_TAHUNAN telah dimuat dari jadwal_db.js
    if (typeof DATABASE_JADWAL_TAHUNAN !== 'undefined' && DATABASE_JADWAL_TAHUNAN[keyTanggal]) {
        return DATABASE_JADWAL_TAHUNAN[keyTanggal];
    }
    
    // Fallback jika data tanggal tersebut tidak ditemukan (Menggunakan nilai default pengaman)
    return { imsak: "04:44", fajr: "04:54", dhuhr: "12:18", asr: "15:43", magrib: "18:21", isya: "19:35" };
}

// Sistem Fitur Alarm Beep (3 Kali bunyian tiap durasi menyentuh 00:00)
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

/* ==========================================================================
   BAGIAN 2: ENGINE REFRESH CLOCK & COUNTDOWN (SETIAP 1 DETIK) - DATABASE DRIVEN
   ========================================================================== */
setInterval(() => {
    const sekarang = new Date();
    
    /* 1. Update Jam Utama di Rapat Bawah */
    let jam = String(sekarang.getHours()).padStart(2, '0');
    let menit = String(sekarang.getMinutes()).padStart(2, '0');
    let detik = String(sekarang.getSeconds()).padStart(2, '0');
    if (document.getElementById('clock')) {
        document.getElementById('clock').innerText = `${jam}:${menit}:${detik}`;
    }

    /* 2. Ambil Jadwal Sholat dari Database Lokal */
    const jadwalHariIni = ambilJadwalHariIni(sekarang);

    // Perbarui Tampilan Tabel Jadwal Sholat Utama di Layar secara Real-time
    if(document.getElementById('imsakTime')) document.getElementById('imsakTime').innerText = jadwalHariIni.imsak;
    if(document.getElementById('subuhTime')) document.getElementById('subuhTime').innerText = jadwalHariIni.fajr;
    if(document.getElementById('dzuhurTime')) document.getElementById('dzuhurTime').innerText = jadwalHariIni.dhuhr;
    if(document.getElementById('asharTime')) document.getElementById('asharTime').innerText = jadwalHariIni.asr;
    if(document.getElementById('magribTime')) document.getElementById('magribTime').innerText = jadwalHariIni.magrib;
    if(document.getElementById('isyaTime')) document.getElementById('isyaTime').innerText = jadwalHariIni.isya;

    // Untuk perhitungan besok jika waktu Isya hari ini terlewati
    const besok = new Date();
    besok.setDate(sekarang.getDate() + 1);
    const jadwalBesok = ambilJadwalHariIni(besok);

    const daftarSholat = [
        { nama: 'SUBUH', waktu: jadwalHariIni.fajr },
        { nama: 'DZUHUR', waktu: jadwalHariIni.dhuhr },
        { nama: 'ASHAR', waktu: jadwalHariIni.asr },
        { nama: 'MAGHRIB', waktu: jadwalHariIni.magrib },
        { nama: 'ISYA', waktu: jadwalHariIni.isya }
    ];

    let sholatActive = null;
    let waktuSekarangDetik = (sekarang.getHours() * 3600) + (sekarang.getMinutes() * 60) + sekarang.getSeconds();

    for (let i = 0; i < daftarSholat.length; i++) {
        let tParts = daftarSholat[i].waktu.split(':');
        let targetDetik = (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60);
        
        let mIqamahConfig = 10; 
        if (typeof dataMasjid !== 'undefined' && dataMasjid.jedaIqamah && dataMasjid.jedaIqamah[daftarSholat[i].nama]) {
            mIqamahConfig = parseInt(dataMasjid.jedaIqamah[daftarSholat[i].nama]);
        }
        let batasIqamahDetik = mIqamahConfig * 60;

        if (targetDetik + batasIqamahDetik > waktuSekarangDetik) {
            sholatActive = { 
                nama: daftarSholat[i].nama, 
                waktuStr: daftarSholat[i].waktu + ":00", 
                targetDetik: targetDetik, 
                batasIqamahDetik: batasIqamahDetik,
                isBesok: false 
            };
            break;
        }
    }

    if (!sholatActive) {
        let tParts = jadwalBesok.fajr.split(':');
        sholatActive = { 
            nama: 'SUBUH', 
            waktuStr: jadwalBesok.fajr + ":00", 
            targetDetik: (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60) + 86400, 
            batasIqamahDetik: 15 * 60,
            isBesok: true 
        };
    }

    let sisaDetik = sholatActive.targetDetik - waktuSekarangDetik;

    const elLabel = document.getElementById('nextPrayerLabel');
    const elWaktu = document.getElementById('nextPrayerTime') || document.querySelector('.next-prayer-time');
    const elCountdown = document.getElementById('nextPrayerCountdown');
    const elJadwalContainer = document.querySelector('.prayer-times-container') || document.getElementById('jadwal-shalat');

    if (elWaktu) elWaktu.innerText = sholatActive.waktuStr;

    /* 3. Logika Transisi Adzan & Menunggu Iqamah */
    if (sisaDetik <= 0 && !sholatActive.isBesok) {
        if (sisaDetik === 0) triggerAlarm(); 

        // 1. Sembunyikan Tabel Waktu Sholat Utama
        if (elJadwalContainer) elJadwalContainer.style.setProperty('display', 'none', 'important');

        // 2. Sembunyikan teks target jam sholat
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

        if (sisaIqamah === 0) triggerAlarm(); 
    } else {
        // Mode Normal Menuju Adzan - Kembalikan Semua Tampilan
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
   BAGIAN 3: INJEKSI DATA KAS, PETUGAS & RUNNING TEXT FROM GOOGLE SHEETS
   ========================================================================== */
const URL_GOOGLE_SHEET = "https://script.google.com/macros/s/AKfycbzbz9r75Jkg9Kd2geoNRWzXp2IAzJC47Mh7gZsPMDXF7MvGL_JM6StX7PocTC2yLE3WLg/exec";
let dataMasjid = {}; // Global variable holder untuk jeda iqamah dsb

function jalankanSliderInfo(infoList) {
    const container = document.getElementById('infoUpdateContent');
    if (container && infoList && infoList.length > 0) {
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
}

function muatDataDariGoogleSheet() {
    const errorMsgEl = document.getElementById('connErrorMsg');
    
    fetch(URL_GOOGLE_SHEET)
        .then(response => {
            if (!response.ok) throw new Error("Gagal memuat data");
            return response.json();
        })
        .then(resData => {
            dataMasjid = resData;
            
            // Simpan data terbaru ke cache localStorage jika berhasil
            localStorage.setItem('cachedDataMasjid', JSON.stringify(resData));
            
            // Sembunyikan indikator gangguan jika koneksi normal
            if (errorMsgEl) errorMsgEl.style.display = 'none';

            // Injeksi Data Sholat Jumat
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = dataMasjid.tanggalJumat || '-';
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = dataMasjid.khatib || '-';
            if(document.getElementById('imam')) document.getElementById('imam').innerText = dataMasjid.imam || '-';
            if(document.getElementById('muadzin')) document.getElementById('muadzin').innerText = dataMasjid.muadzin || '-';
            
            // Injeksi Data Kas Keuangan
            if(document.getElementById('saldoAwal')) document.getElementById('saldoAwal').innerText = "Rp " + (dataMasjid.saldoAwal || '0');
            if(document.getElementById('pemasukan')) document.getElementById('pemasukan').innerText = "Rp " + (dataMasjid.pemasukan || '0');
            if(document.getElementById('pengeluaran')) document.getElementById('pengeluaran').innerText = "Rp " + (dataMasjid.pengeluaran || '0');
            if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = "Rp " + (dataMasjid.totalSaldo || '0');

            // Running Text Utama
            if(document.getElementById('runText1')) document.getElementById('runText1').innerText = dataMasjid.runningText || '';
            if(document.getElementById('runText2')) document.getElementById('runText2').innerText = dataMasjid.runningText || '';

            // Jalankan Slider Papan Informasi
            jalankanSliderInfo(dataMasjid.infoUpdate);
        })
        .catch(error => {
            console.error("Gagal mengambil data dari Google Sheet, beralih ke Mode Aman Fallback:", error);
            
            // 3. Tampilkan pesan gangguan berkedip merah (.blink-red-msg) sejajar infoUpdate di bagian bawah
            if (errorMsgEl) errorMsgEl.style.display = 'block';

            // 1. Data Sholat Jumat dan Kas Keuangan diisi tanda strip "-"
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = '-';
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = '-';
            if(document.getElementById('imam')) document.getElementById('imam').innerText = '-';
            if(document.getElementById('muadzin')) document.getElementById('muadzin').innerText = '-';
            
            if(document.getElementById('saldoAwal')) document.getElementById('saldoAwal').innerText = '-';
            if(document.getElementById('pemasukan')) document.getElementById('pemasukan').innerText = '-';
            if(document.getElementById('pengeluaran')) document.getElementById('pengeluaran').innerText = '-';
            if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = '-';

            // 2. Ambil data dari cache localStorage agar running text tetap jalan dan infoUpdate tetap tampil
            const cachedRaw = localStorage.getItem('cachedDataMasjid');
            if (cachedRaw) {
                try {
                    const cachedData = JSON.parse(cachedRaw);
                    dataMasjid = cachedData; // Pertahankan konfigurasi jeda iqamah lokal dsb
                    
                    if(document.getElementById('runText1')) document.getElementById('runText1').innerText = cachedData.runningText || '';
                    if(document.getElementById('runText2')) document.getElementById('runText2').innerText = cachedData.runningText || '';
                    
                    jalankanSliderInfo(cachedData.infoUpdate);
                } catch (e) {
                    console.error("Gagal parsing data cache lokal:", e);
                }
            } else {
                // Fallback teks dasar jika cache kosong total
                const fallbackTxt = "FUNGSI WAKTU SHOLAT BERJALAN NORMAL.";
                if(document.getElementById('runText1')) document.getElementById('runText1').innerText = fallbackTxt;
                if(document.getElementById('runText2')) document.getElementById('runText2').innerText = fallbackTxt;
            }
        });
}

window.addEventListener('load', () => {
    muatDataDariGoogleSheet();
    setInterval(muatDataDariGoogleSheet, 300000);
});
