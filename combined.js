/* ==========================================================================
   BAGIAN 1: PUSTAKA PRAYTIMES.JS (DINONAKTIFKAN KARENA PAKAI GOOGLE SHEET)
   ========================================================================== */
// Fitur Alarm Beep 3x
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

// Variabel Penampung Data Global dari Google Sheet
let GLOBAL_DATA_MASJID = null;

/* ==========================================================================
   BAGIAN 2: ENGINE REFRESH CLOCK & COUNTDOWN (100% LIVE GOOGLE SHEET)
   ========================================================================== */
setInterval(() => {
    const sekarang = new Date();
    
    // 1. Update Jam Utama di Layar
    let jam = String(sekarang.getHours()).padStart(2, '0');
    let menit = String(sekarang.getMinutes()).padStart(2, '0');
    let detik = String(sekarang.getSeconds()).padStart(2, '0');
    if (document.getElementById('clock')) {
        document.getElementById('clock').innerText = `${jam}:${menit}:${detik}`;
    }

    // Jika data Google Sheet belum termuat, hentikan hitung mundur sementara agar tidak error
    if (!GLOBAL_DATA_MASJID || !GLOBAL_DATA_MASJID.jadwalSholat) return;

    // 2. Ambil Jadwal Sholat dari data Google Sheet
    const times = GLOBAL_DATA_MASJID.jadwalSholat;
    const daftarSholat = [
        { nama: 'SUBUH', waktu: times.fajr },
        { nama: 'DZUHUR', waktu: times.dhuhr },
        { nama: 'ASHAR', waktu: times.asr },
        { nama: 'MAGHRIB', waktu: times.sunset },
        { nama: 'ISYA', waktu: times.isha }
    ];

    let sholatActive = null;
    let waktuSekarangDetik = (sekarang.getHours() * 3600) + (sekarang.getMinutes() * 60) + sekarang.getSeconds();

    for (let i = 0; i < daftarSholat.length; i++) {
        let tParts = daftarSholat[i].waktu.split(':');
        let targetDetik = (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60);
        
        // Ambil jeda iqamah dari Sheet, jika tidak ada default ke 10 menit
        let mIqamahConfig = 10; 
        if (GLOBAL_DATA_MASJID.jedaIqamah && GLOBAL_DATA_MASJID.jedaIqamah[daftarSholat[i].nama]) {
            mIqamahConfig = parseInt(GLOBAL_DATA_MASJID.jedaIqamah[daftarSholat[i].nama]);
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

    // Jika sudah lewat Isya, targetkan ke Subuh
    if (!sholatActive) {
        let tParts = daftarSholat[0].waktu.split(':');
        let mIqamahConfig = (GLOBAL_DATA_MASJID.jedaIqamah && GLOBAL_DATA_MASJID.jedaIqamah['SUBUH']) ? parseInt(GLOBAL_DATA_MASJID.jedaIqamah['SUBUH']) : 15;
        sholatActive = { 
            nama: 'SUBUH', 
            waktuStr: daftarSholat[0].waktu + ":00", 
            targetDetik: (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60) + 86400, 
            batasIqamahDetik: mIqamahConfig * 60,
            isBesok: true 
        };
    }

    let sisaDetik = sholatActive.targetDetik - waktuSekarangDetik;

    const elLabel = document.getElementById('nextPrayerLabel');
    const elWaktu = document.getElementById('nextPrayerTime');
    const elCountdown = document.getElementById('nextPrayerCountdown');

    if (elWaktu) elWaktu.innerText = sholatActive.waktuStr;

    // 3. Logika Transisi Menunggu Iqamah
    if (sisaDetik <= 0 && !sholatActive.isBesok) {
        if (sisaDetik === 0) triggerAlarm(); 

        document.body.classList.add('iqamah-mode');

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

        if (sisaIqamah === 0) triggerAlarm(); 
    } else {
        document.body.classList.remove('iqamah-mode');

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
   BAGIAN 3: SYNC FETCH API KE GOOGLE SHEET
   ========================================================================== */
const URL_GOOGLE_SHEET = "https://script.google.com/macros/s/AKfycbzbz9r75Jkg9Kd2geoNRWzXp2IAzJC47Mh7gZsPMDXF7MvGL_JM6StX7PocTC2yLE3WLg/exec";

function muatDataDariGoogleSheet() {
    fetch(URL_GOOGLE_SHEET)
        .then(response => response.json())
        .then(dataMasjid => {
            console.log("Data sukses disinkronkan dari Cloud Google Sheet:", dataMasjid);
            
            // Simpan ke variabel global agar dibaca oleh engine jam di atas
            GLOBAL_DATA_MASJID = dataMasjid;

            // Injeksi Jadwal Sholat di Tabel Layar Utama (Jika ada data jadwal harian dari sheet)
            if (dataMasjid.jadwalSholat) {
                if(document.getElementById('waktu-subuh')) document.getElementById('waktu-subuh').innerText = dataMasjid.jadwalSholat.fajr || '-';
                if(document.getElementById('waktu-dzuhur')) document.getElementById('waktu-dzuhur').innerText = dataMasjid.jadwalSholat.dhuhr || '-';
                if(document.getElementById('waktu-ashar')) document.getElementById('waktu-ashar').innerText = dataMasjid.jadwalSholat.asr || '-';
                if(document.getElementById('waktu-maghrib')) document.getElementById('waktu-maghrib').innerText = dataMasjid.jadwalSholat.sunset || '-';
                if(document.getElementById('waktu-isya')) document.getElementById('waktu-isya').innerText = dataMasjid.jadwalSholat.isha || '-';
            }

            // Injeksi Petugas Jumat
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = dataMasjid.tanggalJumat || '-';
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = dataMasjid.khatib || '-';
            if(document.getElementById('imam')) document.getElementById('imam').innerText = dataMasjid.imam || '-';
            if(document.getElementById('muadzin')) document.getElementById('muadzin').innerText = dataMasjid.muadzin || '-';
            
            // Injeksi Saldo Kas
            if(document.getElementById('saldoAwal')) document.getElementById('saldoAwal').innerText = "Rp " + (dataMasjid.saldoAwal || '0');
            if(document.getElementById('pemasukan')) document.getElementById('pemasukan').innerText = "Rp " + (dataMasjid.pemasukan || '0');
            if(document.getElementById('pengeluaran')) document.getElementById('pengeluaran').innerText = "Rp " + (dataMasjid.pengeluaran || '0');
            if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = "Rp " + (dataMasjid.totalSaldo || '0');

            // Injeksi Running Text
            if(document.getElementById('runText1')) document.getElementById('runText1').innerText = dataMasjid.runningText || '';
            if(document.getElementById('runText2')) document.getElementById('runText2').innerText = dataMasjid.runningText || '';

            // Slide Informasi Tengah
            const container = document.getElementById('infoUpdateContent');
            if (container && dataMasjid.infoUpdate && dataMasjid.infoUpdate.length > 0) {
                const infoList = dataMasjid.infoUpdate;
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
            console.error("Gagal sinkronisasi dengan Google Sheet Cloud:", error);
        });
}

window.addEventListener('load', () => {
    muatDataDariGoogleSheet();
    // Tarik data otomatis dari Google Sheets setiap 5 menit agar jadwal selalu update
    setInterval(muatDataDariGoogleSheet, 300000);
});
