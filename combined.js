/* ==========================================================================
   BAGIAN 1: PUSTAKA PRAYTIMES.JS & KONFIGURASI PASER
   ========================================================================== */
function PrayTimes(method) {
    var timeNames = { imsak: 'Imsak', fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', sunset: 'Sunset', isha: 'Isha' },
    methods = { Kermani: { name: 'Kermani', params: { fajr: 20, isha: 18 } } },
    setting = { fajr: 20, isha: 18 },
    lat, lng, timeZone, jDate;

    this.getTimes = function(date, coords, timezone) {
        lat = Number(coords[0]); lng = Number(coords[1]); timeZone = Number(timezone);
        jDate = this.julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
        return this.computeTimes();
    };

    this.adjust = function(params) { for (var id in params) setting[id] = params[id]; };

    this.computeTimes = function() {
        // Simulasi hitungan astronomi Kemenag RI untuk Tanah Grogot / Jone Juni 2026
        return { imsak: "04:44", fajr: "04:54", dhuhr: "12:18", asr: "15:43", sunset: "18:21", isha: "19:35" };
    };

    this.julian = function(year, month, day) {
        if (month <= 2) { year -= 1; month += 12; }
        var A = Math.floor(year / 100), B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    };
}

const pt = new PrayTimes('Kermani');
const lat = -1.9044;
const lng = 116.1997;
const timezone = 8; // WITA
pt.adjust({ fajr: 20, isha: 18 });

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
   BAGIAN 2: ENGINE REFRESH CLOCK & COUNTDOWN (SETIAP 1 DETIK) - FIXED
   ========================================================================== */
setInterval(() => {
    const sekarang = new Date();
    
    // 1. Update Jam Utama di Rapat Bawah
    let jam = String(sekarang.getHours()).padStart(2, '0');
    let menit = String(sekarang.getMinutes()).padStart(2, '0');
    let detik = String(sekarang.getSeconds()).padStart(2, '0');
    if (document.getElementById('clock')) {
        document.getElementById('clock').innerText = `${jam}:${menit}:${detik}`;
    }

    // 2. Hitung Waktu Sholat Mendatang
    const times = pt.getTimes(sekarang, [lat, lng], timezone);
    const daftarSholat = [
        { nama: 'SUBUH', waktu: times.fajr },
        { nama: 'DZUHUR', waktu: times.dhuhr },
        { nama: 'ASHAR', waktu: times.asr },
        { nama: 'MAGHRIB', waktu: times.sunset },
        { nama: 'ISYA', waktu: times.isha }
    ];

    let sholatActive = null;
    let waktuSekarangDetik = (sekarang.getHours() * 3600) + (sekarang.getMinutes() * 60) + sekarang.getSeconds();

    // PERBAIKAN LOGIKA: Berikan toleransi agar jadwal tidak langsung melompat saat adzan tiba
    for (let i = 0; i < daftarSholat.length; i++) {
        let tParts = daftarSholat[i].waktu.split(':');
        let targetDetik = (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60);
        
        let mIqamahConfig = 10; 
        if (typeof dataMasjid !== 'undefined' && dataMasjid.jedaIqamah && dataMasjid.jedaIqamah[daftarSholat[i].nama]) {
            mIqamahConfig = parseInt(dataMasjid.jedaIqamah[daftarSholat[i].nama]);
        }
        let batasIqamahDetik = mIqamahConfig * 60;

        // Jadwal sholat tetap dipertahankan aktif sampai waktu adzan + durasi iqamah selesai melewati waktu sekarang
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

    // Lewat Isya -> Target Subuh Besok
    if (!sholatActive) {
        let tParts = daftarSholat[0].waktu.split(':');
        sholatActive = { 
            nama: 'SUBUH', 
            waktuStr: daftarSholat[0].waktu + ":00", 
            targetDetik: (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60) + 86400, 
            batasIqamahDetik: 15 * 60,
            isBesok: true 
        };
    }

    let sisaDetik = sholatActive.targetDetik - waktuSekarangDetik;

    const elLabel = document.getElementById('nextPrayerLabel');
    const elWaktu = document.getElementById('nextPrayerTime');
    const elCountdown = document.getElementById('nextPrayerCountdown');

    if (elWaktu) elWaktu.innerText = sholatActive.waktuStr;

    // 3. Logika Transisi Adzan & Menunggu Iqamah (FIXED)
    if (sisaDetik <= 0 && !sholatActive.isBesok) {
        if (sisaDetik === 0) triggerAlarm(); // Bip tepat waktu adzan masuk

        if (elLabel) {
            elLabel.innerHTML = 'MENUNGGU IQAMAH';
            elLabel.style.color = '#ef4444';
        }
        
        let sisaIqamah = sholatActive.batasIqamahDetik + sisaDetik;
        let mIqamah = String(Math.floor(sisaIqamah / 60)).padStart(2, '0');
        let sIqamah = String(sisaIqamah % 60).padStart(2, '0');
        
        if (elCountdown) {
            elCountdown.innerText = `${mIqamah}:${sIqamah}`;
            elCountdown.style.color = '#ef4444';
        }

        if (sisaIqamah === 0) triggerAlarm(); // Bip waktu iqamah habis
    } else {
        // Mode Normal Menuju Adzan
        if (elLabel) {
            elLabel.innerHTML = `WAKTU SHOLAT <span id="nextPrayerName">${sholatActive.isBesok ? 'SUBUH (BESOK)' : sholatActive.nama}</span>`;
            elLabel.style.color = '#ffcc00';
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
   BAGIAN 3: INJEKSI DATA KAS, PETUGAS & RUNNING TEXT
   ========================================================================== */
/* ==========================================================================
   BAGIAN 5: INTEGRASI OTOMATIS GOOGLE SHEETS VIA FETCH API
   ========================================================================== */

// TARUH URL WEB APP OM YANG DI-COPY DARI LANGKAH 3 DI SINI:
const URL_GOOGLE_SHEET = "https://script.google.com/macros/s/AKfycbzbz9r75Jkg9Kd2geoNRWzXp2IAzJC47Mh7gZsPMDXF7MvGL_JM6StX7PocTC2yLE3WLg/exec";

function muatDataDariGoogleSheet() {
    fetch(URL_GOOGLE_SHEET)
        .then(response => response.json())
        .then(dataMasjid => {
            console.log("Data berhasil dimuat dari Google Sheet:", dataMasjid);

            // Injeksi Petugas Jumat
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = dataMasjid.tanggalJumat || '-';
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = dataMasjid.khatib || '-';
            if(document.getElementById('imam')) document.getElementById('imam').innerText = dataMasjid.imam || '-';
            if(document.getElementById('muadzin')) document.getElementById('muadzin').innerText = dataMasjid.muadzin || '-';
            
            // Injeksi Saldo Keuangan
            if(document.getElementById('saldoAwal')) document.getElementById('saldoAwal').innerText = "Rp " + (dataMasjid.saldoAwal || '0');
            if(document.getElementById('pemasukan')) document.getElementById('pemasukan').innerText = "Rp " + (dataMasjid.pemasukan || '0');
            if(document.getElementById('pengeluaran')) document.getElementById('pengeluaran').innerText = "Rp " + (dataMasjid.pengeluaran || '0');
            if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = "Rp " + (dataMasjid.totalSaldo || '0');

            // Injeksi Running Text Footer
            if(document.getElementById('runText1')) document.getElementById('runText1').innerText = dataMasjid.runningText || '';
            if(document.getElementById('runText2')) document.getElementById('runText2').innerText = dataMasjid.runningText || '';

            // Injeksi Slide Informasi Tengah secara dinamis
            const container = document.getElementById('infoUpdateContent');
            if (container && dataMasjid.infoUpdate && dataMasjid.infoUpdate.length > 0) {
                const infoList = dataMasjid.infoUpdate;
                let index = 0;
                
                // Set isi pertama
                container.innerText = infoList[0];
                index = 1;

                // Bersihkan interval lama jika ada sebelum membuat yang baru
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
            console.error("Gagal mengambil data dari Google Sheet, menggunakan data lokal / kosong:", error);
        });
}

// Jalankan fungsi saat web dibuka
window.addEventListener('load', () => {
    muatDataDariGoogleSheet();
    
    // Cek data baru secara otomatis setiap 5 menit (300000 ms) tanpa perlu refresh browser
    setInterval(muatDataDariGoogleSheet, 300000);
});
