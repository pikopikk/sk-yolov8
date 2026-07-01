import os, uuid, base64
from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
import cv2, numpy as np

app = Flask(__name__)
app.config['UPLOAD_FOLDER']      = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED = {'jpg', 'jpeg', 'png', 'webp'}
os.makedirs('uploads', exist_ok=True)

# Ambang batas ini HANYA dipakai sebagai lantai deteksi awal YOLO (menyaring
# noise/omongkosong di bawah 10% confidence). Ini BUKAN lagi filter untuk
# menyembunyikan hasil dari tampilan — apapun yang lolos di sini akan
# ditampilkan ke pengguna apa adanya, termasuk hasil dengan confidence rendah
# maupun class 'healthy'. Kalau YOLO sama sekali tidak menemukan apa-apa pada
# level ini, itu pertanda gambar bukan daun jagung / kurang jelas — bukan
# pertanda daun sehat.
DETECT_FLOOR = 0.10
model = YOLO('best.pt')
print(f'[CLDD] model loaded  |  detect floor {DETECT_FLOOR:.0%}')

# ── Class metadata ────────────────────────────────────────────
CLASS_INFO = {
    'Gray Spot': {
        'label': 'Bercak Daun (Gray Leaf Spot)',
        'desc': (
            'Penyakit bercak daun ditandai dengan munculnya bercak kecil '
            'berwarna hijau kekuningan yang kemudian berkembang menjadi '
            'cokelat keabu-abuan pada permukaan daun. Penyakit ini disebabkan '
            'oleh jamur Curvularia sp. yang dapat menyebar melalui angin, '
            'air hujan, maupun udara. Kondisi lingkungan yang lembap menjadi '
            'faktor utama yang mendukung perkembangan penyakit bercak daun '
            'pada tanaman jagung.'
        ),
        'solutions': [
            'Menjaga kondisi lingkungan lahan agar tidak terlalu lembap',
            'Melakukan pemantauan rutin terhadap munculnya bercak pada daun tanaman',
            'Menggunakan agen hayati seperti Trichoderma sp. untuk membantu menekan perkembangan jamur patogen',
            'Membersihkan daun atau bagian tanaman yang telah terinfeksi',
            'Menjaga kebersihan lahan dan sirkulasi udara agar perkembangan jamur dapat diminimalkan',
        ],
    },
    'Healthy': {
        'label': 'Daun Sehat',
        'desc': (
            'Daun jagung terdeteksi dalam kondisi sehat dan tidak menunjukkan '
            'gejala penyakit seperti bercak daun, hawar daun, maupun karat daun. '
            'Warna, tekstur, dan pola permukaan daun masih berada dalam kondisi '
            'normal sehingga proses pertumbuhan tanaman dapat berlangsung dengan baik.'
        ),
        'solutions': [
            'Melakukan pemantauan rutin untuk memastikan tanaman tetap sehat',
            'Menjaga kebersihan lahan dari gulma dan sisa tanaman yang dapat menjadi sumber penyakit',
            'Menjaga pola penyiraman dan kelembapan lahan agar tetap stabil',
            'Melakukan pemupukan sesuai kebutuhan tanaman jagung',
        ],
    },
    'Corn Blight': {
        'label': 'Hawar Daun (Blight)',
        'desc': (
            'Penyakit hawar daun jagung disebabkan oleh jamur '
            'Helminthosporium maydis. Gejala awal ditandai dengan munculnya '
            'bercak kecil berwarna hijau kecokelatan dengan tepi kekuningan '
            'pada daun. Seiring perkembangan penyakit, bercak akan membesar '
            'dan menyebabkan jaringan daun mengalami nekrosis atau kematian jaringan. '
            'Penyakit ini berkembang dengan baik pada kondisi lingkungan yang '
            'lembap dengan suhu sekitar 18–27°C.'
        ),
        'solutions': [
            'Menjaga kondisi lahan agar tidak terlalu lembap',
            'Melakukan pengamatan rutin terhadap gejala bercak pada daun',
            'Menggunakan agen hayati seperti Trichoderma sp. untuk membantu menghambat pertumbuhan jamur penyebab penyakit',
            'Memisahkan atau membersihkan daun yang terinfeksi agar penyebaran penyakit tidak meluas',
            'Menjaga jarak tanam agar sirkulasi udara pada lahan tetap baik',
        ],
    },
    'Common Rust': {
        'label': 'Karat Daun (Common Rust)',
        'desc': (
            'Penyakit karat daun ditandai dengan munculnya pustula berwarna '
            'jingga hingga cokelat pada permukaan daun akibat infeksi jamur '
            'Puccinia sorghi. Penyakit ini berkembang optimal pada kondisi '
            'lingkungan dengan kelembapan tinggi dan suhu sekitar 15–25°C. '
            'Spora jamur dapat menyebar melalui angin sehingga infeksi dapat '
            'terjadi dengan cepat pada tanaman jagung.'
        ),
        'solutions': [
            'Mengurangi kelembapan lahan dengan menjaga sirkulasi udara antar tanaman',
            'Menghindari kondisi lahan yang terlalu lembap dan ternaungi',
            'Menggunakan agen hayati seperti Trichoderma sp. untuk membantu menekan perkembangan jamur patogen',
            'Melakukan pemantauan rutin pada daun tanaman agar gejala awal penyakit dapat segera diketahui',
            'Membersihkan bagian tanaman yang terinfeksi untuk mengurangi penyebaran spora jamur',
        ],
    },
}
FALLBACK = {
    'label': 'Tidak Diketahui',
    'desc':  'Kelas tidak dikenali. Konsultasikan dengan ahli pertanian.',
    'solutions': ['Hubungi penyuluh pertanian setempat.'],
}

PALETTE = [(52,211,153),(56,189,248),(251,146,60),(167,139,250)]

# ── Helpers ───────────────────────────────────────────────────
def allowed(f):
    return '.' in f and f.rsplit('.',1)[1].lower() in ALLOWED

def get_boxes(boxes):
    """Ambil semua box yang lolos deteksi awal YOLO (conf >= DETECT_FLOOR).
    Tidak ada filter tambahan di sini — apapun yang YOLO temukan akan
    diteruskan ke tampilan, termasuk yang confidence-nya rendah."""
    return [] if boxes is None else list(boxes)

def draw_boxes(bgr, valid, names):
    img = bgr.copy()
    h, w = img.shape[:2]
    fs = max(0.45, min(w,h)/900)
    th = max(2, int(min(w,h)/320))
    for box in valid:
        cid = int(box.cls[0]); conf = float(box.conf[0])
        x1,y1,x2,y2 = [int(v) for v in box.xyxy[0].tolist()]
        col = PALETTE[cid % len(PALETTE)]
        nm  = names.get(cid, str(cid))
        lbl = f'{nm}  {conf:.0%}'
        cv2.rectangle(img,(x1,y1),(x2,y2),col,th)
        (tw,tht),bl = cv2.getTextSize(lbl,cv2.FONT_HERSHEY_SIMPLEX,fs,th)
        ly = max(y1, tht+bl+6)
        cv2.rectangle(img,(x1,ly-tht-bl-6),(x1+tw+8,ly),col,-1)
        cv2.putText(img,lbl,(x1+4,ly-bl-2),cv2.FONT_HERSHEY_SIMPLEX,fs,(255,255,255),th,cv2.LINE_AA)
    return img

def to_b64(bgr):
    ok,buf = cv2.imencode('.jpg',bgr,[cv2.IMWRITE_JPEG_QUALITY,92])
    if not ok: raise RuntimeError('encode failed')
    return 'data:image/jpeg;base64,'+base64.b64encode(buf.tobytes()).decode()

def build_diseases(valid, names):
    g = {}
    for box in valid:
        cid  = int(box.cls[0]); conf = round(float(box.conf[0]),4)
        x1,y1,x2,y2 = [round(v,1) for v in box.xyxy[0].tolist()]
        nm = names.get(cid, f'class_{cid}')
        if nm not in g: g[nm] = {'best':0.0,'boxes':[]}
        g[nm]['boxes'].append({'x1':x1,'y1':y1,'x2':x2,'y2':y2,'conf':conf})
        if conf > g[nm]['best']: g[nm]['best'] = conf
    out = []
    for nm,e in g.items():
        info = CLASS_INFO.get(nm, FALLBACK)
        out.append({'class_name':nm,'label':info['label'],'best_confidence':e['best'],
                    'desc':info['desc'],'solutions':info['solutions'],'boxes':e['boxes']})
    out.sort(key=lambda d:d['best_confidence'],reverse=True)
    return out

# ── Routes ────────────────────────────────────────────────────
@app.route('/')
def index(): return render_template('index.html')

@app.route('/cara-deteksi')
def cara_deteksi(): return render_template('cara_deteksi.html')

@app.route('/tentang')
def tentang(): return render_template('tentang.html')

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'status':'error','message':'Tidak ada file.'}),400
    f = request.files['image']
    if not f.filename or not allowed(f.filename):
        return jsonify({'status':'error','message':'Format tidak didukung.'}),400

    ext  = f.filename.rsplit('.',1)[1].lower()
    path = os.path.join('uploads', f'{uuid.uuid4().hex}.{ext}')
    f.save(path)
    try:
        res   = model.predict(source=path, conf=DETECT_FLOOR, verbose=False)[0]
        names = res.names
        # Semua box yang lolos DETECT_FLOOR langsung dipakai — tidak ada lagi
        # filter tambahan yang menyembunyikan hasil di bawah suatu ambang.
        valid = get_boxes(res.boxes)
        bgr   = cv2.imread(path)
        ann   = draw_boxes(bgr, valid, names)
        diseases = build_diseases(valid, names)
        disease_count = sum(1 for d in diseases if d['class_name'].lower() != 'Healthy')
        return jsonify({
            'status':'success',
            'result_image': to_b64(ann),
            'detect_floor': DETECT_FLOOR,
            'diseases': diseases,
            'total_diseases':   disease_count,
            'total_detections': len(valid),
        })
    except Exception as e:
        print(f'[CLDD] error: {e}')
        return jsonify({'status':'error','message':str(e)}),500
    finally:
        if os.path.exists(path): os.remove(path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)