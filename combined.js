/* ==========================================================================
   BAGIAN 1: SISTEM DATABASE JADWAL SHOLAT INTERNAL & ALARM
   ========================================================================== */

// Fungsi untuk mengambil data jadwal sholat hari ini dari jadwal_db.js
function ambilJadwalHariIni(dateObj) {
    const tahun = dateObj.getFullYear();
    const bulan = String(dateObj.getMonth() + 1).padStart(2, '0');
    const tanggal = String(dateObj.getDate()).padStart(2, '0');
    const keyTanggal = `${tahun}-${bulan}-${tanggal}`; 

    if (typeof DATABASE_JADWAL_TAHUNAN !== 'undefined' && DATABASE_JADWAL_TAHUNAN[keyTanggal]) {
        return DATABASE_JADWAL_TAHUNAN[keyTanggal];
    }
    
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
   BAGIAN 2: ENGINE REFRESH CLOCK & COUNTDOWN (REAL-TIME JADWAL)
   ========================================================================== */
const SPREADSHEET_ID = '1Jene5qNwgCTYkPAZhlbeRIEVnZvJl6Ktze0pp1upbsk'; 
const API_KEY = 'AIzaSyA8jJH40UHIUsfSmnR6vWPP0mqnN3S5QuY'; 

let dataSlides = [];
let currentSlideIndex = 0;
let slideTimeout;
let scrollInterval;
let dataMasjidJeda = { SUBUH: 10, DZUHUR: 10, ASHAR: 10, MAGHRIB: 10, ISYA: 10 }; 

setInterval(() => {
    const sekarang = new Date();
    
    /* 1. Update Jam Utama */
    let jam = String(sekarang.getHours()).padStart(2, '0');
    let menit = String(sekarang.getMinutes()).padStart(2, '0');
    let detik = String(sekarang.getSeconds()).padStart(2, '0');
    if (document.getElementById('clock-time')) {
        document.getElementById('clock-time').innerText = `${jam}:${menit}:${detik}`;
    }

    /* 2. Format Hari & Tanggal Masehi */
    const opsiHari = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (document.getElementById('clock-date')) {
        document.getElementById('clock-date').innerText = sekarang.toLocaleDateString('id-ID', opsiHari);
    }

    /* 3. Ambil Jadwal Sholat */
    const jadwalHariIni = ambilJadwalHariIni(sekarang);
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
        
        let mIqamahConfig = dataMasjidJeda[daftarSholat[i].nama] || 10; 
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

    if (!sholatActive) {
        let tParts = jadwalBesok.fajr.split(':');
        sholatActive = { 
            nama: 'SUBUH', 
            waktuStr: jadwalBesok.fajr, 
            targetDetik: (parseInt(tParts[0]) * 3600) + (parseInt(tParts[1]) * 60) + 86400, 
            batasIqamahDetik: 15 * 60,
            isBesok: true 
        };
    }

    let sisaDetik = sholatActive.targetDetik - waktuSekarangDetik;

    const elLabel = document.getElementById('countdown-title');
    const elWaktu = document.getElementById('countdown-time');
    const elCountdown = document.getElementById('countdown-timer');

    if (elWaktu) elWaktu.innerText = sholatActive.waktuStr;

    /* 4. Logika Transisi Adzan & Menunggu Iqamah */
    if (sisaDetik <= 0 && !sholatActive.isBesok) {
        if (sisaDetik === 0) triggerAlarm(); 

        if (elWaktu) elWaktu.style.setProperty('display', 'none', 'important');

        if (elLabel) {
            elLabel.innerHTML = 'MENUNGGU IQAMAH';
            elLabel.style.color = '#ff5252';
        }
        
        let sisaIqamah = sholatActive.batasIqamahDetik + sisaDetik;
        let mIqamah = String(Math.floor(sisaIqamah / 60)).padStart(2, '0');
        let sIqamah = String(sisaIqamah % 60).padStart(2, '0');
        
        if (elCountdown) {
            elCountdown.innerText = `${mIqamah}:${sIqamah}`;
            elCountdown.style.borderColor = '#ff5252';
            elCountdown.style.background = 'rgba(255, 0, 0, 0.2)';
        }

        if (sisaIqamah === 0) triggerAlarm(); 
    } else {
        if (elWaktu) elWaktu.style.setProperty('display', 'inline-block'); 

        if (elLabel) {
            elLabel.innerHTML = `WAKTU SHOLAT <span style="color:#e5c158;">${sholatActive.isBesok ? 'SUBUH (BESOK)' : sholatActive.nama}</span>`;
            elLabel.style.color = '#e5c158';
        }

        let jamSisa = String(Math.floor(sisaDetik / 3600)).padStart(2, '0');
        let menitSisa = String(Math.floor((sisaDetik % 3600) / 60)).padStart(2, '0');
        let detikSisa = String(sisaDetik % 60).padStart(2, '0');

        if (elCountdown) {
            elCountdown.innerText = `-${jamSisa}:${menitSisa}:${detikSisa}`;
            elCountdown.style.borderColor = '#ff5252';
            elCountdown.style.background = 'rgba(255, 0, 0, 0.15)';
        }
    }
}, 1000);

/* ==========================================================================
   BAGIAN 3: INJEKSI DATA KAS, PETUGAS & PAPAN SLIDER INFORMASI
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
    muatDataGoogleSheets();
    setInterval(muatDataGoogleSheets, 5 * 60 * 1000); 
});

async function muatDataGoogleSheets() {
    try {
        const ranges = ["SHOLAT JUMAT!A1:B4", "KEUANGAN!A1:E50", "RUNNING TEXT!A1:A30", "INFOUPDATE LAINNYA!A1:A10"];
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=${ranges.map(encodeURIComponent).join('&ranges=')}&key=${API_KEY}`;
        
        const respon = await fetch(url);
        if (!respon.ok) throw new Error('Respon Jaringan Lemah');
        
        const hasil = await respon.json();
        if (hasil.valueRanges) {
            prosesDanTampilkanData(hasil.valueRanges);
        }
    } catch (error) {
        console.error("Gagal sinkronisasi data Google Sheets, menggunakan fallback:", error);
        
        document.getElementById('jumat-tanggal').innerText = '-';
        document.getElementById('jumat-khatib').innerText = '-';
        document.getElementById('jumat-imam').innerText = '-';
        document.getElementById('jumat-bilal').innerText = '-';
        
        document.getElementById('kas-awal').innerText = '-';
        document.getElementById('kas-masuk').innerText = '-';
        document.getElementById('kas-keluar').innerText = '-';
        document.getElementById('kas-saldo').innerText = '-';
    }
}

function prosesDanTampilkanData(valueRanges) {
    const dataJumat = valueRanges[0].values || [];
    const dataKeuangan = valueRanges[1].values || [];
    const dataRunningText = valueRanges[2].values || [];
    const dataInfoLain = valueRanges[3].values || [];

    // --- SINKRONISASI 1: CARD SHOLAT JUMAT ---
    if (dataJumat.length > 0) {
        document.getElementById('jumat-tanggal').innerText = (dataJumat[0] && dataJumat[0][1]) ? dataJumat[0][1] : '-';
        document.getElementById('jumat-khatib').innerText = (dataJumat[1] && dataJumat[1][1]) ? dataJumat[1][1] : '-';
        document.getElementById('jumat-imam').innerText = (dataJumat[2] && dataJumat[2][1]) ? dataJumat[2][1] : '-';
        document.getElementById('jumat-bilal').innerText = (dataJumat[3] && dataJumat[3][1]) ? dataJumat[3][1] : '-';
    }

    // --- SINKRONISASI 2: CARD KAS KEUANGAN PER JUMAT ---
    let saldoAwal = "Rp 0";
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    let saldoAkhir = "Rp 0";
    
    for (let i = 1; i < dataKeuangan.length; i++) {
        const baris = dataKeuangan[i];
        if (!baris || baris.length === 0) continue;

        const keterangan = baris[1] ? baris[1].toUpperCase().trim() : "";
        const masukVal = baris[2] ? bersihkanAngka(baris[2]) : 0;
        const keluarVal = baris[3] ? bersihkanAngka(baris[3]) : 0;
        const saldoStr = baris[4] ? baris[4].trim() : "";

        if (keterangan.includes("SALDO AWAL")) {
            saldoAwal = formatMataUangAman(baris[4]);
        }

        totalPemasukan += masukVal;
        totalPengeluaran += keluarVal;

        if (saldoStr !== "" && saldoStr !== "0") {
            saldoAkhir = formatMataUangAman(saldoStr);
        }
    }

    document.getElementById('kas-awal').innerText = saldoAwal;
    document.getElementById('kas-masuk').innerText = "Rp " + totalPemasukan.toLocaleString('id-ID');
    document.getElementById('kas-keluar').innerText = "Rp " + totalPengeluaran.toLocaleString('id-ID');
    document.getElementById('kas-saldo').innerText = saldoAkhir;

    // --- SINKRONISASI 3: RUNNING TEXT ---
    if (dataRunningText.length > 0) {
        const kumpulanTeks = dataRunningText
            .map(row => row[0])
            .filter(teks => teks && teks.trim() !== "")
            .join("   •   ");
        if (kumpulanTeks) {
            document.getElementById('running-text').innerText = kumpulanTeks + "   •   ";
        }
    }

    // --- SINKRONISASI 4: PAPAN INFORMASI SLIDER ---
    dataSlides = []; 

    let tableRowsHtml = "";
    for (let i = 1; i < dataKeuangan.length; i++) {
        const baris = dataKeuangan[i];
        if (!baris || baris.length === 0) continue;
        tableRowsHtml += `
            <tr>
                <td class="text-center">${baris[0] || '-'}</td>
                <td>${baris[1] || '-'}</td>
                <td class="text-right">${formatMataUangAman(baris[2])}</td>
                <td class="text-right">${formatMataUangAman(baris[3])}</td>
                <td class="text-right" style="font-weight:600; color:#e5c158;">${formatMataUangAman(baris[4])}</td>
            </tr>
        `;
    }

    if (tableRowsHtml !== "") {
        let tabelPenuhHtml = `
            <div class="slide-title">LAPORAN KAS MASJID PER JUMAT</div>
            <div class="scrollable-content table-responsive">
                <table class="table-kas">
                    <thead>
                        <tr>
                            <th>TANGGAL</th>
                            <th>KETERANGAN</th>
                            <th>MASUK</th>
                            <th>KELUAR</th>
                            <th>SALDO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        `;
        dataSlides.push(tabelPenuhHtml);
    }

    for (let i = 0; i < dataInfoLain.length; i++) {
        const isiTeks = dataInfoLain[i][0];
        if (isiTeks && isiTeks.trim() !== "") {
            let infoHtml = `
                <div class="slide-title">INFORMASI MASJID</div>
                <div class="scrollable-content info-text-content">${isiTeks}</div>
            `;
            dataSlides.push(infoHtml);
        }
    }

    inisialisasiPerputaranPapan();
}

// UTALITAS HELPER DATA (Sudah Diperbaiki Dari Masalah Desimal/Koma Sen)
function bersihkanAngka(teks) {
    if (!teks) return 0;
    let stringTeks = teks.toString().trim();
    
    // Potong angka desimal di belakang koma seandainya ada penulisan format Rupiah lama (,00)
    if (stringTeks.includes(',')) {
        stringTeks = stringTeks.split(',')[0];
    }
    
    let clean = stringTeks.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
}

function formatMataUangAman(teks) {
    if (!teks || teks === "0" || teks === "-" || teks.toString().trim() === "") return "Rp 0";
    if (teks.toString().includes("Rp")) {
        // Hapus buntut desimal jika ada di string asli agar seragam
        let parts = teks.toString().split(',');
        return parts[0].trim();
    }
    let angka = bersihkanAngka(teks);
    return "Rp " + angka.toLocaleString('id-ID');
}

// MANAGEMENT PERPUTARAN SLIDER (1S FADE IN, 30S TAMPIL, 3S FADE OUT)
function inisialisasiPerputaranPapan() {
    clearTimeout(slideTimeout);
    clearInterval(scrollInterval);
    if (dataSlides.length === 0) return;
    
    currentSlideIndex = 0;
    jalankanSiklusSlider();
}

function jalankanSiklusSlider() {
    const wadahPapan = document.getElementById('papan-slide-container');
    if (!wadahPapan) return;

    // 1. FADE IN (1 Detik)
    wadahPapan.style.transition = "opacity 1000ms ease-in-out";
    wadahPapan.innerHTML = `<div class="slide active">${dataSlides[currentSlideIndex]}</div>`;
    wadahPapan.style.opacity = '1';

    // Jalankan auto-scroll universal setelah fade-in 1 detik selesai
    setTimeout(() => {
        aktifkanAutoScrollKonten();
    }, 1000);

    // 2. TAMPIL (30 Detik Bersih) LALU FADE OUT
    slideTimeout = setTimeout(() => {
        clearInterval(scrollInterval);

        // FADE OUT (3 Detik)
        wadahPapan.style.transition = "opacity 3000ms ease-in-out";
        wadahPapan.style.opacity = '0';

        // Tunggu fade out selesai (3 detik), lanjut slide berikutnya
        slideTimeout = setTimeout(() => {
            currentSlideIndex = (currentSlideIndex + 1) % dataSlides.length;
            jalankanSiklusSlider();
        }, 3000);

    }, 30000); 
}

// FITUR AUTO SCROLL UNIVERSAL UNTUK SEMUA KONTEN YANG MELEBIHI LAYAR BOX
function aktifkanAutoScrollKonten() {
    const elemenScroll = document.querySelector('.scrollable-content');
    if (!elemenScroll) return;

    if (elemenScroll.scrollHeight > elemenScroll.clientHeight) {
        elemenScroll.scrollTop = 0; 
        
        setTimeout(() => {
            scrollInterval = setInterval(() => {
                elemenScroll.scrollTop += 1;
                
                if (elemenScroll.scrollTop + elemenScroll.clientHeight >= elemenScroll.scrollHeight - 1) {
                    clearInterval(scrollInterval);
                }
            }, 35); 
        }, 2500);
    }
}

/* ==========================================================================
   BAGIAN 4: FITUR FULL SCREEN (DOBEL KLIK)
   ========================================================================== */
document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Gagal mengaktifkan Full Screen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
});