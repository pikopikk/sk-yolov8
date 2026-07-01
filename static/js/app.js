// static/js/app.js — CLDD Corn Leaf Disease Detector
'use strict';

// ── State ─────────────────────────────────────────────────────
let uploadedFile    = null;
let uploadedDataUrl = null;
let detectionResult = null;
let isDetecting     = false;
let activeTab       = 'upload';

// Camera
let camStream  = null;
let camActive  = false;
let photoTaken = false;


// ═══════════════════════════════════════════════════════════════
// TAB SWITCHER
// ═══════════════════════════════════════════════════════════════
function switchTab(tab) {
  activeTab = tab;
  const pu = document.getElementById('panelUpload');
  const pc = document.getElementById('panelCamera');
  const tu = document.getElementById('tabUpload');
  const tc = document.getElementById('tabCamera');

  if (tab === 'upload') {
    pu.classList.remove('hidden'); pu.classList.add('flex');
    pc.classList.add('hidden');    pc.classList.remove('flex');
    tu.classList.add('bg-white','text-green-700','shadow-sm');
    tu.classList.remove('text-slate-500');
    tc.classList.remove('bg-white','text-green-700','shadow-sm');
    tc.classList.add('text-slate-500');
    stopCamera();
  } else {
    pc.classList.remove('hidden'); pc.classList.add('flex');
    pu.classList.add('hidden');    pu.classList.remove('flex');
    tc.classList.add('bg-white','text-green-700','shadow-sm');
    tc.classList.remove('text-slate-500');
    tu.classList.remove('bg-white','text-green-700','shadow-sm');
    tu.classList.add('text-slate-500');
  }
  _clearState();
}

function _clearState() {
  uploadedFile = uploadedDataUrl = detectionResult = null;
  photoTaken = false;
  resetResult();
}


// ═══════════════════════════════════════════════════════════════
// UPLOAD TAB
// ═══════════════════════════════════════════════════════════════
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { CLDD.error('Ukuran file maksimal 5 MB!'); return; }

  uploadedFile = file;
  detectionResult = null;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedDataUrl = ev.target.result;
    renderUploadPreview();
    CLDD.success('Gambar siap dideteksi');
  };
  reader.readAsDataURL(file);
}

function renderUploadPreview() {
  const c = document.getElementById('previewContainer');
  if (!c) return;
  c.innerHTML = `
    <div class="relative w-full flex items-center justify-center py-2">
      <img src="${uploadedDataUrl}"
           class="max-h-48 w-full object-contain rounded-xl shadow-sm fade-in" alt="Preview">
      <button onclick="removeImage(event)"
              class="absolute top-1 right-1 leading-none cursor-pointer">
        <i class="ri-close-circle-fill text-2xl text-red-400 hover:text-red-600 drop-shadow"></i>
      </button>
    </div>
    <p class="text-xs text-green-600 font-medium mt-1 pb-3">Siap dideteksi</p>`;
}

async function removeImage(e) {
  e && (e.preventDefault(), e.stopPropagation());
  const ok = await CLDD.confirm({
    title:'Hapus Gambar',message:'Yakin ingin menghapus gambar ini?',
    type:'warning',okText:'Hapus',cancelText:'Batal'});
  if (!ok) return;
  uploadedFile = uploadedDataUrl = detectionResult = null;
  const fi = document.getElementById('fileInput'); if (fi) fi.value = '';
  document.getElementById('previewContainer').innerHTML = `
    <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
      <i class="ri-image-add-line text-2xl text-slate-400"></i>
    </div>
    <p class="text-sm font-medium text-slate-700">Tarik &amp; lepas gambar di sini</p>
    <p class="text-xs text-slate-400 mt-1">atau klik untuk memilih file</p>
    <p class="text-xs text-slate-300 mt-4">JPG, PNG, WEBP · maks 5 MB</p>`;
  resetResult();
  CLDD.info('Gambar dihapus');
}

// Drag-drop
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('border-green-400','bg-green-50/60');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('border-green-400','bg-green-50/60');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('border-green-400','bg-green-50/60');
      const f = e.dataTransfer.files[0];
      if (f) handleImageUpload({ target:{ files:[f] } });
    });
  }
  console.log('%c✅ CLDD app.js ready', 'color:#16a34a;font-weight:700');
});


// ═══════════════════════════════════════════════════════════════
// CAMERA TAB
// ═══════════════════════════════════════════════════════════════
async function toggleCamera() {
  camActive ? stopCamera() : await startCamera();
}

async function startCamera() {
  photoTaken = false; uploadedFile = null;
  setCamDetect(false); setCamUI('requesting');
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } },
      audio:false });
    camActive = true;
    const v = document.getElementById('camFeed');
    v.srcObject = camStream; await v.play();
    setCamUI('live');
    CLDD.success('Kamera aktif');
  } catch(err) {
    camStream = null; camActive = false; setCamUI('idle');
    const m = {
      NotAllowedError:'Akses kamera ditolak. Izinkan di pengaturan browser.',
      NotFoundError:'Tidak ada kamera yang ditemukan.',
      NotReadableError:'Kamera digunakan aplikasi lain.',
    };
    CLDD.alert({ title:'Kamera Tidak Tersedia',
                 message: m[err.name] || `Error: ${err.message}`,
                 type:'error', okText:'Mengerti' });
  }
}

function stopCamera() {
  if (camStream) camStream.getTracks().forEach(t=>t.stop());
  camStream = null; camActive = false; photoTaken = false; uploadedFile = null;
  const v = document.getElementById('camFeed'); if(v) v.srcObject = null;
  setCamUI('idle'); setCamDetect(false);
}

function snapPhoto() {
  const v = document.getElementById('camFeed');
  const c = document.getElementById('snapCanvas');
  if (!v || !c) return;
  c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

  // flash
  const fl = document.getElementById('camFlash');
  if (fl) {
    fl.classList.remove('hidden'); fl.style.opacity = '0.7';
    setTimeout(()=>{ fl.style.opacity='0'; setTimeout(()=>fl.classList.add('hidden'),160); }, 80);
  }

  c.toBlob(blob => {
    if (!blob) { CLDD.error('Gagal mengambil foto.'); return; }
    uploadedFile = new File([blob], `snap_${Date.now()}.jpg`, { type:'image/jpeg' });
    const prev = document.getElementById('camPreview');
    if (prev) prev.src = c.toDataURL('image/jpeg', 0.92);
    photoTaken = true;
    setCamUI('captured');
    setCamDetect(true);
    CLDD.success('Foto diambil!');
  }, 'image/jpeg', 0.92);
}

function retakePhoto() {
  photoTaken = false; uploadedFile = detectionResult = null;
  resetResult(); setCamDetect(false); setCamUI('live');
}

// ── Camera UI state machine ───────────────────────────────────
function setCamUI(state) {
  const idle    = document.getElementById('camIdle');
  const feed    = document.getElementById('camFeed');
  const prev    = document.getElementById('camPreview');
  const guide   = document.getElementById('camGuide');
  const btnTog  = document.getElementById('btnToggleCam');
  const lbl     = document.getElementById('camToggleLabel');
  const btnSnap = document.getElementById('btnSnap');
  const btnRet  = document.getElementById('btnRetake');

  [idle,feed,prev,guide].forEach(el=>el&&el.classList.add('hidden'));
  btnSnap&&btnSnap.classList.add('hidden');
  btnRet&&btnRet.classList.add('hidden');
  btnTog.disabled = false;

  if (state === 'idle') {
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
          <i class="ri-camera-off-line text-2xl text-slate-500"></i></div>
        <p class="text-slate-400 text-sm font-medium">Kamera belum aktif</p>
        <p class="text-slate-600 text-xs mt-1">Tekan tombol di bawah untuk mulai</p></div>`;
    idle.classList.remove('hidden');
    lbl.textContent = 'Aktifkan Kamera';
    btnTog.classList.replace('bg-red-500','bg-green-600');
    btnTog.classList.replace('hover:bg-red-600','hover:bg-green-700');

  } else if (state === 'requesting') {
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-slate-400 text-sm">Meminta akses kamera…</p></div>`;
    idle.classList.remove('hidden');
    btnTog.disabled = true;

  } else if (state === 'live') {
    feed.classList.remove('hidden');
    guide.classList.remove('hidden');
    btnSnap.classList.remove('hidden');
    lbl.textContent = 'Matikan Kamera';
    btnTog.classList.replace('bg-green-600','bg-red-500');
    btnTog.classList.replace('hover:bg-green-700','hover:bg-red-600');

  } else if (state === 'captured') {
    prev.classList.remove('hidden');
    btnRet.classList.remove('hidden');
    lbl.textContent = 'Matikan Kamera';
    btnTog.classList.replace('bg-green-600','bg-red-500');
    btnTog.classList.replace('hover:bg-green-700','hover:bg-red-600');
  }
}

function setCamDetect(on) {
  const b = document.getElementById('detectBtnCam'); if(!b) return;
  b.disabled = !on;
  b.classList.toggle('opacity-40', !on);
  b.classList.toggle('cursor-not-allowed', !on);
  b.classList.toggle('hover:bg-green-700', on);
  b.classList.toggle('active:scale-[.98]', on);
}


// ═══════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════
function runDetection() {
  if (!uploadedFile) {
    CLDD.alert({
      title: 'Belum Ada Gambar',
      message: activeTab==='camera'
        ? 'Ambil foto terlebih dahulu dengan tombol "Ambil Foto".'
        : 'Unggah foto daun jagung terlebih dahulu.',
      type:'warning', okText:'Mengerti'});
    return;
  }
  if (isDetecting) return;
  isDetecting = true;

  // Loading on button
  const btn = document.getElementById(activeTab==='upload' ? 'detectBtn' : 'detectBtnCam');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="w-4 h-4 border-2 border-white border-t-transparent
                    rounded-full animate-spin mr-2"></span>Mendeteksi…`;
  }

  // Loading in result panel
  const area = document.getElementById('resultArea');
  area.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center py-16 text-center gap-5">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 border-4 border-green-100 border-t-green-600
                    rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <i class="ri-leaf-fill text-green-500 text-xl"></i></div>
      </div>
      <div>
        <p class="font-semibold text-slate-700">YOLOv8 menganalisis gambar…</p>
        <p class="text-slate-400 text-sm mt-1">Mohon tunggu sebentar</p>
      </div>
      <div class="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div id="pbar" class="h-full bg-green-500 rounded-full"
             style="width:0%;transition:width 2.4s ease-out;"></div>
      </div>
    </div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const pb=document.getElementById('pbar'); if(pb) pb.style.width='88%'; }));

  const fd = new FormData(); fd.append('image', uploadedFile);
  fetch('/detect',{method:'POST',body:fd})
    .then(r=>r.ok?r.json():r.json().then(d=>Promise.reject(d)))
    .then(data=>{ detectionResult=data; renderResult(data); CLDD.success('Deteksi selesai!'); })
    .catch(err=>{ CLDD.error(err?.message||'Terjadi kesalahan.'); resetResult(); })
    .finally(()=>{
      isDetecting=false;
      if(btn){
        btn.disabled=false;
        btn.innerHTML = activeTab==='upload'
          ? '<i class="ri-search-eye-line text-base"></i> Mulai Deteksi'
          : '<i class="ri-search-eye-line text-base"></i> Deteksi Foto';
        if(activeTab==='camera' && !photoTaken) setCamDetect(false);
      }
    });
}


// ═══════════════════════════════════════════════════════════════
// RESULT RENDERING
// ═══════════════════════════════════════════════════════════════
function resetResult() {
  const area = document.getElementById('resultArea'); if(!area) return;
  area.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center text-center py-16 gap-4">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <i class="ri-bar-chart-grouped-line text-3xl text-slate-300"></i></div>
      <p class="text-slate-400 font-medium">Hasil deteksi akan muncul di sini</p>
      <p class="text-slate-300 text-sm max-w-xs">Unggah gambar atau gunakan kamera, lalu tekan Deteksi.</p>
    </div>`;}

function renderResult(data) {
  const area = document.getElementById('resultArea'); if(!area) return;

  // Tidak ada deteksi sama sekali — bukan berarti "daun sehat", melainkan
  // gambar tidak dikenali sebagai daun jagung / kualitasnya kurang jelas.
  if (!data.diseases || data.diseases.length===0) {
    area.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center py-12 gap-4 fade-in">
        <div class="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          <i class="ri-image-2-line text-2xl text-amber-500"></i></div>
        <div>
          <p class="font-semibold text-slate-700">Gambar Tidak Dapat Dikenali</p>
          <p class="text-slate-400 text-sm mt-1 max-w-xs leading-relaxed">
            Sistem tidak menemukan ciri khas daun jagung pada gambar ini — ini
            bukan berarti daunnya sehat. Kemungkinan gambar bukan daun jagung,
            atau foto kurang jelas (buram, gelap, atau terlalu jauh). Coba
            ambil ulang dengan pencahayaan cukup dan fokus dekat pada
            permukaan daun.</p>
        </div>
        ${data.result_image?`
        <div class="w-full mt-2">
          <img src="${data.result_image}" class="rounded-xl shadow w-full object-contain max-h-52">
        </div>`:''}
      </div>`;
    return;
  }

  const diseases = data.diseases;
  const multi    = diseases.length > 1;

  const cards = diseases.map((d,i)=>{
    const pct = Math.round(d.best_confidence*100);
    const healthy = d.class_name==='healthy';

    // Badge warna berdasarkan confidence
    let badgeBg = '';

    if (pct >= 85) {
      badgeBg = 'bg-green-100 text-green-700';
    } else if (pct >= 70) {
      badgeBg = 'bg-yellow-100 text-yellow-700';
    } else {
      badgeBg = 'bg-red-100 text-red-700';
    }

    const barCl =
      pct >= 85 ? 'bg-green-500' :
      pct >= 70 ? 'bg-yellow-500' :
                  'bg-red-500';

    const solHtml = (!healthy && d.solutions?.length) ? `
      <div class="mt-3">
        <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Rekomendasi Penanganan</p>
        <ul class="space-y-1.5">
          ${d.solutions.map(s=>`
            <li class="flex gap-2 text-xs text-slate-600">
              <i class="ri-checkbox-circle-fill text-green-500 mt-0.5 shrink-0"></i>
              <span>${s}</span>
            </li>`).join('')}
        </ul>
      </div>` : '';

    const divider = (multi && i<diseases.length-1)
      ? '<div class="border-t border-slate-100 my-4"></div>' : '';

    return `
      <div class="${i>0?'':''}">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeBg} mb-1.5">
              ${pct}% keyakinan</span>
            <h3 class="font-bold text-slate-800 text-sm leading-tight">${d.label}</h3>
          </div>
          ${multi?`<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500
                                flex items-center justify-center text-[11px] font-bold shrink-0">
                     ${i+1}</span>`:''}
        </div>
        <div class="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div class="${barCl} h-full rounded-full" style="width:${pct}%;transition:width .6s ease"></div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">${d.desc}</p>
        ${solHtml}
        ${divider}
      </div>`;
  }).join('');

  const multiBadge = multi ? `
    <div class="flex items-center gap-2 text-xs font-medium text-amber-800
                bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
      <i class="ri-alert-line text-amber-500"></i>
      ${diseases.length} penyakit terdeteksi
    </div>` : '';

  area.innerHTML = `
    <div class="fade-in flex flex-col gap-0">
      ${data.result_image?`
      <div class="rounded-xl overflow-hidden shadow-sm mb-5 border border-slate-100">
        <img src="${data.result_image}" class="w-full object-contain max-h-56 bg-slate-900"
             alt="Hasil deteksi">
      </div>`:''}
      ${multiBadge}
      <div>${cards}</div>
      <button onclick="downloadPDF()"
              class="mt-5 w-full py-3 border-2 border-green-600 hover:bg-green-50
                     text-green-700 font-semibold rounded-xl flex items-center
                     justify-center gap-2 text-sm transition-colors">
        <i class="ri-file-pdf-line"></i> Unduh Laporan PDF
      </button>
    </div>`;
}


// ═══════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════

// Warna & label tingkat keyakinan dipakai bersama di seluruh laporan PDF
function _confLevel(pct) {
  if (pct >= 85) return { text: 'Tinggi', rgb: [22,163,74],  bg: [220,252,231] };
  if (pct >= 70) return { text: 'Sedang', rgb: [217,119,6],  bg: [254,243,199] };
  return             { text: 'Rendah', rgb: [220,38,38],  bg: [254,226,226] };
}

function downloadPDF() {
  if (!detectionResult) {
    CLDD.alert({title:'Belum Ada Hasil',message:'Lakukan deteksi dahulu.',type:'info',okText:'OK'});
    return;
  }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const pw=doc.internal.pageSize.getWidth();
  const mg=18, cw=pw-mg*2;
  const diseases=detectionResult.diseases||[];

  // ── Header ────────────────────────────────────────────────
  doc.setFillColor(21,128,61);  doc.rect(0,0,pw,32,'F');
  doc.setFillColor(22,163,74);  doc.rect(0,0,pw,28,'F');
  doc.setFillColor(255,255,255);doc.setDrawColor(255,255,255);
  doc.circle(mg+3.2,14,3.2,'F');
  doc.setTextColor(22,163,74);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text('C',mg+3.2,15.6,{align:'center'});
  doc.setTextColor(255,255,255);doc.setFontSize(15);doc.setFont('helvetica','bold');
  doc.text('CLDD — Corn Leaf Disease Detector',mg+9,12.5);
  doc.setFontSize(8.5);doc.setFont('helvetica','normal');
  doc.setTextColor(220,252,231);
  doc.text('Laporan Hasil Deteksi Penyakit Daun Jagung · YOLOv8',mg+9,18);
  doc.setFontSize(7.5);
  doc.text(`Dibuat pada ${new Date().toLocaleDateString('id-ID',{dateStyle:'long'})}, `
    +`${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`,mg+9,23);

  let y=40;

  // ── Gambar hasil deteksi ────────────────────────────────────
  if(detectionResult.result_image){
    doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.setTextColor(30,41,59);
    doc.text('Hasil Analisis Gambar',mg,y); y+=4.5;
    try{
      doc.setFillColor(15,23,42);doc.roundedRect(mg,y,cw,72,2,2,'F');
      doc.addImage(detectionResult.result_image,'JPEG',mg+1,y+1,cw-2,70);
      doc.setDrawColor(226,232,240);doc.setLineWidth(0.4);doc.roundedRect(mg,y,cw,72,2,2);
      y+=76;
      doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(148,163,184);
      doc.text('Kotak penanda pada gambar menunjukkan area deteksi beserta tingkat keyakinan model.',mg,y);
      y+=7;
    }catch{y+=4;}
  }

  // ── Tidak ada deteksi sama sekali ───────────────────────────
  if(diseases.length===0){
    doc.setFillColor(255,251,235);doc.setDrawColor(245,158,11);doc.setLineWidth(0.4);
    doc.roundedRect(mg,y,cw,52,3,3,'FD');
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(146,64,14);
    doc.text('Gambar Tidak Dapat Dikenali',mg+6,y+10);
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(120,90,30);
    const msg = 'Sistem tidak menemukan ciri khas daun jagung pada gambar ini — ini bukan '
      +'berarti daunnya sehat. Kemungkinan gambar bukan daun jagung, atau kualitas foto '
      +'kurang jelas (buram, gelap, atau terlalu jauh).';
    const ml = doc.splitTextToSize(msg, cw-12);
    doc.text(ml, mg+6, y+18);
    doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.setTextColor(146,64,14);
    doc.text('Saran:', mg+6, y+18+ml.length*4.6+4);
    doc.setFont('helvetica','normal');doc.setTextColor(120,90,30);
    doc.text('Foto ulang dengan pencahayaan cukup dan fokus dekat pada permukaan daun.',
      mg+6, y+18+ml.length*4.6+9);
    _footer(doc,pw,mg); doc.save(`CLDD_TidakDikenali_${Date.now()}.pdf`);
    CLDD.success('PDF diunduh'); return;
  }

  // ── Badge multi-penyakit ─────────────────────────────────────
  doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.setTextColor(30,41,59);
  doc.text('Ringkasan Deteksi',mg,y); y+=1.5;
  doc.setDrawColor(22,163,74);doc.setLineWidth(0.6);doc.line(mg,y,mg+26,y); y+=6;

  if(diseases.length>1){
    doc.setFillColor(254,243,199);doc.setDrawColor(245,158,11);doc.setLineWidth(0.3);
    doc.roundedRect(mg,y,cw,10,2,2,'FD');
    doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.setTextColor(120,80,0);
    doc.text(`${diseases.length} penyakit terdeteksi pada gambar ini`,mg+4,y+6.8);
    y+=15;
  }

  diseases.forEach((d,idx)=>{
    if(y>225){doc.addPage();y=18;}
    const pct=Math.round(d.best_confidence*100);
    const healthy=d.class_name==='healthy';
    const lvl = healthy ? {text:'Sehat', rgb:[22,163,74], bg:[220,252,231]} : _confLevel(pct);

    // Ukuran kartu header disesuaikan tinggi teks label
    const headH = 25;
    doc.setFillColor(...lvl.bg);
    doc.roundedRect(mg,y,cw,headH,2,2,'F');
    // Aksen warna di sisi kiri kartu
    doc.setFillColor(...lvl.rgb);
    doc.roundedRect(mg,y,3,headH,2,2,'F');
    doc.setFillColor(...lvl.rgb);
    doc.rect(mg+1.5,y,1.5,headH,'F');

    doc.setTextColor(30,30,30);doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.text(`${diseases.length>1?idx+1+'. ':''}${d.label}`,mg+7,y+9);

    // Pill confidence di kanan atas kartu
    const pillW = 30, pillX = mg+cw-pillW-3, pillY = y+3;
    doc.setFillColor(255,255,255);doc.roundedRect(pillX,pillY,pillW,8,2,2,'F');
    doc.setDrawColor(...lvl.rgb);doc.setLineWidth(0.3);doc.roundedRect(pillX,pillY,pillW,8,2,2);
    doc.setTextColor(...lvl.rgb);doc.setFontSize(8);doc.setFont('helvetica','bold');
    doc.text(`${pct}% · ${lvl.text}`, pillX+pillW/2, pillY+5.3, {align:'center'});

    doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(80,80,80);
    doc.text('Tingkat keyakinan model',mg+7,y+16);
    // Progress bar
    const bx=mg+7,by=y+19,bw=cw-14,bh=2.3;
    doc.setFillColor(255,255,255);doc.roundedRect(bx,by,bw,bh,1,1,'F');
    doc.setFillColor(...lvl.rgb);doc.roundedRect(bx,by,bw*(pct/100),bh,1,1,'F');

    y+=headH+6;

    // Deskripsi
    if(y>245){doc.addPage();y=18;}
    doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.setTextColor(30,30,30);
    doc.text('Deskripsi',mg,y);y+=4.5;
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(71,85,105);
    const dl=doc.splitTextToSize(d.desc,cw);doc.text(dl,mg,y);y+=dl.length*4.8+5;

    // Rekomendasi
    if(!healthy&&d.solutions?.length){
      if(y>242){doc.addPage();y=18;}
      doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.setTextColor(30,30,30);
      doc.text('Rekomendasi Penanganan',mg,y);y+=5;
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(71,85,105);
      d.solutions.forEach((s,si)=>{
        if(y>266){doc.addPage();y=18;}
        doc.setFillColor(...lvl.rgb);doc.circle(mg+1.3,y-1.3,1.1,'F');
        const ll=doc.splitTextToSize(s,cw-8);
        doc.text(ll,mg+5,y);y+=ll.length*4.8+2.5;});
      y+=2;
    }

    // Divider antar penyakit
    if(idx<diseases.length-1){
      y+=2;if(y<276){doc.setDrawColor(226,232,240);doc.setLineWidth(0.3);
        doc.line(mg,y,pw-mg,y);}y+=7;}
  });

  _footer(doc,pw,mg);
  doc.save(`CLDD_${diseases[0].class_name.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
  CLDD.success('PDF berhasil diunduh!');
}

function _footer(doc,pw,mg){
  const n=doc.internal.getNumberOfPages();
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    doc.setFillColor(22,163,74);doc.rect(0,282.5,pw,1,'F');
    doc.setFillColor(15,23,42);doc.rect(0,283.5,pw,13.5,'F');
    doc.setTextColor(148,163,184);doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    doc.text('© 2026 CLDD — Corn Leaf Disease Detector | Skripsi YOLOv8',mg,290);
    doc.setFont('helvetica','bold');doc.setTextColor(226,232,240);
    doc.text(`${i} / ${n}`,pw-mg,290,{align:'right'});}}