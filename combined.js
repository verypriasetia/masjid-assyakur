/* ==========================================================================
   FUNGSI HYBRID GOOGLE SHEET (DENGAN PENANGANAN OFFLINE KHUSUS)
   ========================================================================== */

function sinkronisasiDataMadingSheet() {
    // URL Apps Script Web App Google Sheet Anda
    const URL_APPS_SCRIPT = "CONTOH_URL_WEB_APP_APPS_SCRIPT_ANDA"; 

    console.log("[HYBRID] Mencoba menyinkronkan data informasi dari Google Sheet...");

    fetch(URL_APPS_SCRIPT)
        .then(response => response.json())
        .then(res => {
            console.log("[HYBRID] Koneksi sukses. Memperbarui informasi dari Google Sheet.");

            // 1. Perbarui data konfigurasi Jeda Iqamah
            if (res.jedaIqamah) {
                dataMasjidGlobal.jedaIqamah = {
                    "SUBUH": res.jedaIqamah.SUBUH || 10,
                    "DZUHUR": res.jedaIqamah.DZUHUR || 10,
                    "ASHAR": res.jedaIqamah.ASHAR || 10,
                    "MAGHRIB": res.jedaIqamah.MAGHRIB || 10,
                    "ISYA": res.jedaIqamah.ISYA || 10
                };
            }

            // 2. Tampilkan Data Petugas Sholat Jumat
            if (res.petugasJumat) {
                if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = res.petugasJumat.tanggal || "-";
                if(document.getElementById('khatib')) document.getElementById('khatib').innerText = res.petugasJumat.khatib || "-";
                if(document.getElementById('imamJumat')) document.getElementById('imamJumat').innerText = res.petugasJumat.imam || "-";
                if(document.getElementById('muadzinJumat')) document.getElementById('muadzinJumat').innerText = res.petugasJumat.muadzin || "-";
            }

            // 3. Tampilkan Data Kas dan Saldo Keuangan Masjid
            if (res.keuangan) {
                if(document.getElementById('saldoKas')) document.getElementById('saldoKas').innerText = res.keuangan.saldo || "-";
                if(document.getElementById('pemasukanKas')) document.getElementById('pemasukanKas').innerText = res.keuangan.pemasukan || "-";
                if(document.getElementById('pengeluaranKas')) document.getElementById('pengeluaranKas').innerText = res.keuangan.pengeluaran || "-";
            }

            // 4. Perbarui Teks Berjalan Bawah (Running Text Marquee) saat Online
            if (res.runningText) {
                const marqueeElement = document.getElementById('runningTextContent');
                if (marqueeElement) {
                    marqueeElement.innerText = res.runningText;
                }
            }

            // 5. Sistem Slide Transisi Papan Teks Informasi Tengah
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
            // ==================================================================
            // KETIKA KONEKSI INTERNET TERPUTUS (MODE OFFLINE)
            // ==================================================================
            console.error("[OFFLINE MODE] Koneksi internet terputus. Mengaktifkan sistem proteksi lokal:", error);

            // A. Pasang teks peringatan pada Running Text bawah
            const marqueeElement = document.getElementById('runningTextContent');
            if (marqueeElement) {
                marqueeElement.innerHTML = "<span style='color: #ff4d4d; font-weight: bold;'>⚠️ Mode Offline, Koneksi internet sedang terputus.</span>";
            }

            // B. Kosongkan Petugas Jumat agar tidak menampilkan data minggu lalu
            if(document.getElementById('tanggalJumat')) document.getElementById('tanggalJumat').innerText = "-";
            if(document.getElementById('khatib')) document.getElementById('khatib').innerText = "-";
            if(document.getElementById('imamJumat')) document.getElementById('imamJumat').innerText = "-";
            if(document.getElementById('muadzinJumat')) document.getElementById('muadzinJumat').innerText = "-";

            // C. Kosongkan Keuangan (Kas & Saldo) demi validasi data
            if(document.getElementById('saldoKas')) document.getElementById('saldoKas').innerText = "-";
            if(document.getElementById('pemasukanKas')) document.getElementById('pemasukanKas').innerText = "-";
            if(document.getElementById('pengeluaranKas')) document.getElementById('pengeluaranKas').innerText = "-";

            // D. Catatan untuk Papan Informasi Tengah:
            // Sesuai request OmVery, teks informasi update TIDAK diubah atau direset. 
            // Slider interval lama yang berisi info-info sebelumnya akan TETAP berputar di layar.
        });
}
