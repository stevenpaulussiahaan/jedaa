# Jeda — Keseimbangan Digital & Kesehatan Mental

Website statis (HTML, CSS, JavaScript tanpa build) bertema *Smart Lifestyle & Digital Wellbeing*, selaras dengan SDG 3.

## Struktur
- `index.html` — beranda (hero, masalah, alat, dampak, SDG 3, bantuan)
- `signin.html`, `signup.html` — halaman Masuk dan Daftar
- `common.js` — navbar, pengaturan tema (terang/gelap/otomatis), indikator kaca yang meluncur, toast, sesi
- `config.js` — pengaturan publik, tempat mengisi Google Client ID
- `auth.js` — validasi form, hash kata sandi (PBKDF2-SHA256), login Google, sesi
- `styles.css` — sistem desain (liquid glass, glassmorphism navbar, tema terang/gelap otomatis)
- `app.js` — empat alat interaktif; data disimpan di `localStorage` (terpisah per akun)
- `vercel.json` — header keamanan dan clean URLs
- `favicon.svg`

## Deploy ke Vercel
**Lewat GitHub (disarankan)**
1. Buat repositori baru, unggah semua file ini ke root repositori.
2. Di vercel.com pilih *Add New → Project*, impor repositori.
3. *Framework Preset*: **Other**. Kosongkan *Build Command* dan *Output Directory*. Klik *Deploy*.

**Lewat CLI**
```
npm i -g vercel
cd jeda
vercel --prod
```

## Sebelum dipublikasikan
- Periksa ulang angka dan sumber pada bagian statistik di hero (WHO, PBB) serta nomor layanan di bagian Bantuan.
- Ganti nama/identitas di footer bila perlu, dan tambahkan domain sendiri di pengaturan Vercel.

## Catatan tentang akun
Masuk/Daftar berjalan sepenuhnya di peramban (tanpa server): akun dan kata sandi (sudah di-hash dengan salt) disimpan di `localStorage` perangkat itu saja. Cocok untuk demo dan privasi-pertama, tetapi akun tidak berpindah antar perangkat dan kata sandi tidak dapat dipulihkan. Untuk akun sungguhan, sambungkan layanan autentikasi (mis. Supabase Auth atau Firebase Auth) dan ganti logika di `auth.js`.

## Aktifkan Masuk/Daftar dengan Google
Tombol Google sudah terpasang di `signin.html` dan `signup.html`, tetapi butuh **Client ID** milikmu sendiri (gratis).

1. Buka [Google Cloud Console](https://console.cloud.google.com/) lalu buat atau pilih proyek.
2. *APIs & Services → OAuth consent screen*: pilih **External**, isi nama aplikasi (mis. Jeda) dan email dukungan. Cakupan yang dipakai hanya `openid`, `email`, dan `profile`. Selama status *Testing*, tambahkan email penguji di *Test users*, lalu klik *Publish app* saat siap dipakai umum.
3. *APIs & Services → Credentials → Create credentials → OAuth client ID*, jenis **Web application**.
4. Pada **Authorized JavaScript origins**, tambahkan alamat situsmu, misalnya `https://nama-proyek.vercel.app`, domain sendiri bila ada, dan `http://localhost:3000` untuk uji lokal. Origin harus persis sama (tanpa garis miring di akhir).
5. Salin Client ID (berakhiran `.apps.googleusercontent.com`) ke `config.js`:
   ```js
   window.JEDA_CONFIG = { googleClientId: "ISI-CLIENT-ID-DI-SINI.apps.googleusercontent.com" };
   ```
6. Deploy ulang ke Vercel. Selama `googleClientId` kosong, tombol Google menampilkan pesan bahwa fitur belum aktif.

Catatan: login Google di sini hanya mengambil nama, email, dan foto profil, lalu menyimpannya di peramban. Belum ada server yang memverifikasi sesi. Cocok untuk prototipe; untuk produksi, gunakan backend autentikasi.

## Tema tampilan
Ikon matahari/bulan di navbar membuka pengaturan **Terang / Gelap / Otomatis** (mengikuti perangkat). Pilihan tersimpan di peramban dan diterapkan sebelum halaman tampil, sehingga tidak berkedip.
