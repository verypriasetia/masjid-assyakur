/* ==========================================================================
   BAGIAN 1: PUSTAKA PRAYTIMES.JS (Kalkulator Waktu Salat)
   ========================================================================== */
function PrayTimes(method) {
	var
	timeNames = {
		imsak    : 'Imsak',
		fajr     : 'Fajr',
		sunrise  : 'Sunrise',
		dhuhr    : 'Dhuhr',
		asr      : 'Asr',
		sunset   : 'Sunset',
		maghrib  : 'Maghrib',
		isha     : 'Isha',
		midnight : 'Midnight'
	},
	methods = {
		MWL: {
			name: 'Muslim World League',
			params: { fajr: 18, isha: 17 } },
		ISNA: {
			name: 'Islamic Society of North America (ISNA)',
			params: { fajr: 15, isha: 15 } },
		Egypt: {
			name: 'Egyptian General Authority of Survey',
			params: { fajr: 19.5, isha: 17.5 } },
		Makkah: {
			name: 'Umm Al-Qura University, Makkah',
			params: { fajr: 18.5, isha: '90 min' } },
		Karachi: {
			name: 'University of Islamic Sciences, Karachi',
			params: { fajr: 18, isha: 18 } },
		Tehran: {
			name: 'Institute of Geophysics, University of Tehran',
			params: { fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' } },
		Jafari: {
			name: 'Shia Ithna-Ashari, Leva Institute, Qum',
			params: { fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' } }
	},
	defaultParams = {
		maghrib: '0 min', midnight: 'Standard'
	},
	calcMethod = 'MWL',
	setting = {
		imsak    : '10 min',
		dhuhr    : '0 min',
		asr      : 'Standard',
		highLats : 'NightMiddle'
	},
	timeFormat = '24h',
	timeSuffixes = ['am', 'pm'],
	invalidTime =  '-----',
	numIterations = 1,
	offset = {},
	lat, lng, elv,timeZone,timestamp, jDate;

	var defParams = defaultParams;
	for (var i in methods) {
		var params = methods[i].params;
		for (var j in defParams)
			if ((typeof(params[j]) == 'undefined'))
				params[j] = defParams[j];
	};
	calcMethod = methods[method] ? method : calcMethod;
	var params = methods[calcMethod].params;
	for (var id in params)
		setting[id] = params[id];
	for (var i in timeNames)
		offset[i] = 0;

	return {
	setMethod: function(method) {
		if (methods[method]) {
			this.adjust(methods[method].params);
			calcMethod = method;
		}
	},
	adjust: function(params) {
		for (var id in params)
			setting[id] = params[id];
	},
	tune: function(timeOffsets) {
		for (var i in timeOffsets)
			offset[i] = timeOffsets[i];
	},
	getMethod: function() { return calcMethod; },
	getSetting: function() { return setting; },
	getOffsets: function() { return offset; },
	getDefaults: function() { return methods; },
	getTimes: function(date, coords, timezone, dst, format) {
		lat = +coords[0];
		lng = +coords[1];
		elv = coords[2] ? +coords[2] : 0;
		timeFormat = format || timeFormat;
		if (date.constructor === Date)
			date = [date.getFullYear(), date.getMonth()+ 1, date.getDate()];
		if (typeof(timezone) == 'undefined' || timezone == 'auto')
			timezone = this.getTimeZone(date);
		if (typeof(dst) == 'undefined' || dst == 'auto')
			dst = this.getDst(date);
		timeZone = +timezone + (+dst ? 1 : 0);
		timestamp = (new Date(Date.UTC(date[0], date[1] - 1, date[2]))).getTime();
		jDate = this.julian(date[0], date[1], date[2]) - lng / 360;
		return this.computeTimes();
	},
	getFormattedTime: function(time, format, suffixes) {
		if (isNaN(time)) return invalidTime;
		if (format == 'Float') return time;
		if (format == 'Timestamp') return timestamp + Math.floor((time - timeZone) * 60 * 60 * 1000);
		suffixes = suffixes || timeSuffixes;
		time = DMath.fixHour(time + 0.5 / 60);
		var hours = Math.floor(time);
		var minutes = Math.floor((time - hours) * 60);
		var suffix = (format == '12h') ? suffixes[hours < 12 ? 0 : 1] : '';
		var hour = (format == '24h') ? this.twoDigitsFormat(hours) : ((hours + 12 - 1) % 12 + 1);
		return hour+ ':' + this.twoDigitsFormat(minutes) + (suffix ? ' ' + suffix : '');
	},
	midDay: function(time) {
		var eqt = this.sunPosition(jDate + time).equation;
		var noon = DMath.fixHour(12 - eqt);
		return noon;
	},
	sunAngleTime: function(angle, time, direction) {
		var decl = this.sunPosition(jDate + time).declination;
		var noon = this.midDay(time);
		var t = 1 / 15 * DMath.arccos((-DMath.sin(angle) - DMath.sin(decl) * DMath.sin(lat)) / (DMath.cos(decl) * DMath.cos(lat)));
		return noon+ (direction == 'ccw' ? -t : t);
	},
	asrTime: function(factor, time) {
		var decl = this.sunPosition(jDate + time).declination;
		var angle = -DMath.arccot(factor + DMath.tan(Math.abs(lat - decl)));
		return this.sunAngleTime(angle, time);
	},
	sunPosition: function(jd) {
		var D = jd - 2451545.0;
		var g = DMath.fixAngle(357.529 + 0.98560028 * D);
		var q = DMath.fixAngle(280.459 + 0.98564736 * D);
		var L = DMath.fixAngle(q + 1.915 * DMath.sin(g) + 0.020 * DMath.sin(2 * g));
		var R = 1.00014 - 0.01671 * DMath.cos(g) - 0.00014 * DMath.cos(2 * g);
		var e = 23.439 - 0.00000036 * D;
		var RA = DMath.arctan2(DMath.cos(e) * DMath.sin(L), DMath.cos(L)) / 15;
		var eqt = q / 15 - DMath.fixHour(RA);
		var decl = DMath.arcsin(DMath.sin(e) * DMath.sin(L));
		return {declination: decl, equation: eqt};
	},
	julian: function(year, month, day) {
		if (month <= 2) { year -= 1; month += 12; };
		var A = Math.floor(year / 100);
		var B = 2 - A + Math.floor(A / 4);
		var JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
		return JD;
	},
	computePrayerTimes: function(times) {
		times = this.dayPortion(times);
		var params  = setting;
		var imsak   = this.sunAngleTime(this.value(params.imsak), times.imsak, 'ccw');
		var fajr    = this.sunAngleTime(this.value(params.fajr), times.fajr, 'ccw');
		var sunrise = this.sunAngleTime(this.riseSetAngle(), times.sunrise, 'ccw');
		var dhuhr   = this.midDay(times.dhuhr);
		var asr     = this.asrTime(this.asrFactor(params.asr), times.asr);
		var sunset  = this.sunAngleTime(this.riseSetAngle(), times.sunset);;
		var maghrib = this.sunAngleTime(this.value(params.maghrib), times.maghrib);
		var isha    = this.sunAngleTime(this.value(params.isha), times.isha);
		return {
			imsak: imsak, fajr: fajr, sunrise: sunrise, dhuhr: dhuhr,
			asr: asr, sunset: sunset, maghrib: maghrib, isha: isha
		};
	},
	computeTimes: function() {
		var times = {
			imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12,
			asr: 13, sunset: 18, maghrib: 18, isha: 18
		};
		for (var i=1 ; i<=numIterations ; i++) times = this.computePrayerTimes(times);
		times = this.adjustTimes(times);
		times.midnight = (setting.midnight == 'Jafari') ?
				times.sunset + this.timeDiff(times.sunset, times.fajr + 24) / 2 :
				times.sunset + this.timeDiff(times.sunset, times.sunrise + 24) / 2;
		times = this.tuneTimes(times);
		return this.modifyFormats(times);
	},
	adjustTimes: function(times) {
		var params = setting;
		for (var i in times) times[i] += timeZone - lng / 15;
		if (params.highLats != 'None') times = this.adjustHighLats(times);
		if (this.isMin(params.imsak)) times.imsak = times.fajr- this.value(params.imsak)/ 60;
		if (this.isMin(params.maghrib)) times.maghrib = times.sunset+ this.value(params.maghrib)/ 60;
		if (this.isMin(params.isha)) times.isha = times.maghrib+ this.value(params.isha)/ 60;
		times.dhuhr += this.value(params.dhuhr)/ 60;
		return times;
	},
	asrFactor: function(asrParam) {
		var factor = {Standard: 1, Hanafi: 2}[asrParam];
		return factor || this.value(asrParam);
	},
	riseSetAngle: function() {
		var angle = 0.0347* Math.sqrt(elv);
		return 0.833+ angle;
	},
	tuneTimes: function(times) {
		for (var i in times) times[i] += offset[i]/ 60;
		return times;
	},
	modifyFormats: function(times) {
		for (var i in times) times[i] = this.getFormattedTime(times[i], timeFormat);
		return times;
	},
	adjustHighLats: function(times) {
		var params = setting;
		var nightTime = this.timeDiff(times.sunset, times.sunrise);
		times.imsak = this.adjustHLTime(times.imsak, times.sunrise, this.value(params.imsak), nightTime, 'ccw');
		times.fajr  = this.adjustHLTime(times.fajr, times.sunrise, this.value(params.fajr), nightTime, 'ccw');
		times.isha  = this.adjustHLTime(times.isha, times.sunset, this.value(params.isha), nightTime);
		times.maghrib = this.adjustHLTime(times.maghrib, times.sunset, this.value(params.maghrib), nightTime);
		return times;
	},
	adjustHLTime: function(time, base, angle, night, direction) {
		var portion = this.nightPortion(angle, night);
		var timeDiff = (direction == 'ccw') ? this.timeDiff(time, base): this.timeDiff(base, time);
		if (isNaN(time) || timeDiff > portion) time = base+ (direction == 'ccw' ? -portion : portion);
		return time;
	},
	nightPortion: function(angle, night) {
		var method = setting.highLats;
		var portion = 1 / 2;
		if (method == 'AngleBased') portion = 1 / 60 * angle;
		if (method == 'OneSeventh') portion = 1 / 7;
		return portion* night;
	},
	dayPortion: function(times) {
		for (var i in times) times[i] /= 24;
		return times;
	},
	getTimeZone: function(date) {
		var year = date[0];
		var t1 = this.gmtOffset([year, 0, 1]);
		var t2 = this.gmtOffset([year, 6, 1]);
		return Math.min(t1, t2);
	},
	getDst: function(date) { return 1* (this.gmtOffset(date) != this.getTimeZone(date)); },
	gmtOffset: function(date) {
		var localDate = new Date(date[0], date[1]- 1, date[2], 12, 0, 0, 0);
		var GMTString = localDate.toGMTString();
		var GMTDate = new Date(GMTString.substring(0, GMTString.lastIndexOf(' ')- 1));
		var hoursDiff = (localDate- GMTDate) / (1000* 60* 60);
		return hoursDiff;
	},
	value: function(str) { return 1* (str+ '').split(/[^0-9.+-]/)[0]; },
	isMin: function(arg) { return (arg+ '').indexOf('min') != -1; },
	timeDiff: function(time1, time2) { return DMath.fixHour(time2 - time1); },
	twoDigitsFormat: function(num) { return (num < 10) ? '0'+ num : num; }
	}
}

var DMath = {
	dtr: function(d) { return (d * Math.PI) / 180.0; },
	rtd: function(r) { return (r * 180.0) / Math.PI; },
	sin: function(d) { return Math.sin(this.dtr(d)); },
	cos: function(d) { return Math.cos(this.dtr(d)); },
	tan: function(d) { return Math.tan(this.dtr(d)); },
	arcsin: function(d) { return this.rtd(Math.asin(d)); },
	arccos: function(d) { return this.rtd(Math.acos(d)); },
	arctan: function(d) { return this.rtd(Math.atan(d)); },
	arccot: function(x) { return this.rtd(Math.atan(1 / x)); },
	arctan2: function(y, x) { return this.rtd(Math.atan2(y, x)); },
	fixAngle: function(a) { return this.fix(a, 360); },
	fixHour:  function(a) { return this.fix(a, 24); },
	fix: function(a, b) { a = a - b * Math.floor(a / b); return (a < 0) ? a + b : a; }
}

var prayTimes = new PrayTimes();

/* ==========================================================================
   BAGIAN 2: LOGIKA JAM & HITUNG MUNDUR MASJID ASSYAKUR
   ========================================================================== */

// 1. Memasukkan data offline dari data.js ke HTML
document.getElementById('saldoAwal').innerText = `Rp ${dataMasjid.saldoAwal}`;
document.getElementById('pemasukan').innerText = `Rp ${dataMasjid.pemasukan}`;
document.getElementById('pengeluaran').innerText = `Rp ${dataMasjid.pengeluaran}`;
document.getElementById('totalSaldo').innerText = `Rp ${dataMasjid.totalSaldo}`;
document.getElementById('tanggalJumat').innerText = dataMasjid.tanggalJumat;

document.getElementById('khatib').innerText = `: ${dataMasjid.khatib}`;
document.getElementById('imam').innerText = `: ${dataMasjid.imam}`;
document.getElementById('muadzin').innerText = `: ${dataMasjid.muadzin}`;

let teksPengumuman = dataMasjid.runningText + "   *** "; 
document.getElementById('runText1').innerText = teksPengumuman;
document.getElementById('runText2').innerText = teksPengumuman;

// 2. Pengaturan Koordinat Akurat Tanah Grogot & Zona Waktu (Sesuai File Lama)
const LATITUDE = -1.9015;
const LONGITUDE = 116.1828;
const ZONA_WAKTU = 8; 
const KOREKSI_JAM = 0; 

// SINKRONISASI METODE LAMA: Menggunakan MWL dengan sudut Fajr 20 dan Isha 18 (Kemenag RI)
let pt = new PrayTimes('MWL');
pt.adjust({fajr: 20, isha: 18}); 

// Variabel Pengendali Sistem Iqamah
let isIqamahActive = false;
let iqamahEndTime = null;
let iqamahInterval = null;

function perbaruiWaktu() {
    const sekarang = new Date();
    
    // --- JAM DIGITAL & TANGGAL MASEHI ---
    const jam = String(sekarang.getHours()).padStart(2, '0');
    const menit = String(sekarang.getMinutes()).padStart(2, '0');
    const detik = String(sekarang.getSeconds()).padStart(2, '0');
    document.getElementById('clock').innerText = `${jam}:${menit}:${detik} WITA`;

    // --- TANGGAL HIJRIYAH ---
    try {
        const opsiHijri = { day: 'numeric', month: 'long', year: 'numeric' };
        const tglHijri = new Intl.DateTimeFormat('id-TN-u-ca-islamic', opsiHijri).format(sekarang);
        document.getElementById('dateHijri').innerText = tglHijri;
    } catch (e) {
        document.getElementById('dateHijri').innerText = "";
    }

    // JIKA MODUL IQAMAH SEDANG BERJALAN, KUNCI UPDATE HITUNG MUNDUR ADZAN UTAMA
    if (isIqamahActive) return;

    // --- KALKULASI JADWAL SHOLAT SINKRON ---
    let times = pt.getTimes(sekarang, [LATITUDE, LONGITUDE], ZONA_WAKTU);
    
    function ubahKeWaktu(teksJam) {
        let [j, m] = teksJam.split(':');
        let d = new Date(sekarang);
        let jamDikoreksi = parseInt(j) + KOREKSI_JAM;
        d.setHours(jamDikoreksi, parseInt(m), 0, 0);
        return d;
    }

    let jadwalHariIni = {
        'ADZAN SUBUH': ubahKeWaktu(times.fajr),
        'ADZAN DZUHUR': ubahKeWaktu(times.dhuhr),
        'ADZAN ASHAR': ubahKeWaktu(times.asr),
        'ADZAN MAGHRIB': ubahKeWaktu(times.maghrib),
        'ADZAN ISYA': ubahKeWaktu(times.isha)
    };

    let waktuAdzanBerikutnya = null;
    let namaAdzan = "";

    for (let [nama, waktu] of Object.entries(jadwalHariIni)) {
        if (waktu > sekarang) {
            waktuAdzanBerikutnya = waktu;
            namaAdzan = nama;
            break;
        }
    }

    if (!waktuAdzanBerikutnya) {
        let besok = new Date(sekarang);
        besok.setDate(besok.getDate() + 1);
        let timesBesok = pt.getTimes(besok, [LATITUDE, LONGITUDE], ZONA_WAKTU);
        waktuAdzanBerikutnya = new Date(besok);
        let [j, m] = timesBesok.fajr.split(':');
        let jamDikoreksi = parseInt(j) + KOREKSI_JAM;
        waktuAdzanBerikutnya.setHours(jamDikoreksi, parseInt(m), 0, 0);
        namaAdzan = 'ADZAN SUBUH';
    }

    const jamTarget = String(waktuAdzanBerikutnya.getHours()).padStart(2, '0');
    const menitTarget = String(waktuAdzanBerikutnya.getMinutes()).padStart(2, '0');
    document.getElementById('adzanTime').innerText = `Jam ${jamTarget}:${menitTarget} WITA`;

    // --- HITUNG SELISIH REAL COUNTDOWN ---
    const selisihMilidetik = waktuAdzanBerikutnya - sekarang;

    // Jika selisih berada di bawah atau sama dengan 1 detik (Adzan Tiba!)
    if (selisihMilidetik <= 1000) {
        document.getElementById('countdown').innerText = "00:00:00";
        aktifkanSistemIqamah(); 
    } else {
        const sisaJam = Math.floor(selisihMilidetik / (1000 * 60 * 60));
        const sisaMenit = Math.floor((selisihMilidetik % (1000 * 60 * 60)) / (1000 * 60));
        const sisaDetik = Math.floor((selisihMilidetik % (1000 * 60)) / 1000);

        const formatCountdown = 
            String(sisaJam).padStart(2, '0') + ':' + 
            String(sisaMenit).padStart(2, '0') + ':' + 
            String(sisaDetik).padStart(2, '0');

        document.querySelector('.adzan-title').innerText = namaAdzan;
        document.getElementById('countdown').innerText = formatCountdown;

        // Efek kedip warning menit-menit akhir menjelang adzan
        if (sisaJam === 0 && sisaMenit < 10) {
            document.getElementById('countdown').style.color = (sisaDetik % 2 === 0) ? '#ef4444' : '#fcd34d'; 
        } else {
            document.getElementById('countdown').style.color = '#fcd34d';
        }
    }
}

// --- FUNGSI UTAMA IQAMAH 10 MENIT (FIXED & LOCK ENGINE) ---
function aktifkanSistemIqamah() {
    if (isIqamahActive) return; 
    isIqamahActive = true;

    const judulAdzan = document.querySelector('.adzan-title');
    const jamTargetAdzan = document.getElementById('adzanTime');
    const teksCountdown = document.getElementById('countdown');

    // Ubah text display utama menjadi Informasi Run-down Iqamah
    judulAdzan.innerText = "IQAMAH";
    judulAdzan.style.color = "#ef4444"; 
    jamTargetAdzan.innerText = "WAKTU SHOLAT";

    // Set durasi iqamah: waktu detik ini + 10 menit ke depan
    iqamahEndTime = new Date().getTime() + (10 * 60 * 1000);

    if (iqamahInterval) clearInterval(iqamahInterval);

    iqamahInterval = setInterval(() => {
        let waktuSkrg = new Date().getTime();
        let sisaIqamahMili = iqamahEndTime - waktuSkrg;

        if (sisaIqamahMili <= 0) {
            clearInterval(iqamahInterval);
            teksCountdown.innerText = "00:00";
            teksCountdown.style.color = "#ef4444";
            
            // Tampilkan 00:00 selama 5 detik penanda waktu habis, lalu reset engine
            setTimeout(() => {
                judulAdzan.style.color = "#ffffff"; 
                isIqamahActive = false; // Buka kunci pencarian adzan berikutnya
            }, 5000);
        } else {
            let menitIqamah = Math.floor(sisaIqamahMili / (1000 * 60));
            let detikIqamah = Math.floor((sisaIqamahMili % (1000 * 60)) / 1000);
            
            teksCountdown.innerText = `${String(menitIqamah).padStart(2, '0')}:${String(detikIqamah).padStart(2, '0')}`;
            teksCountdown.style.color = (detikIqamah % 2 === 0) ? '#ef4444' : '#ffffff';
        }
    }, 1000);
}

// Eksekusi berkala setiap 1 detik
setInterval(perbaruiWaktu, 1000);
perbaruiWaktu();
