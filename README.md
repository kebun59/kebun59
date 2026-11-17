# Kebun59 — Nursery Management

Aplikasi pengelolaan bisnis pembibitan tanaman. Target operasional tahap ini adalah satu laptop dengan backend Node.js/Express dan database SQLite lokal (tanpa Supabase atau layanan cloud).

## Menjalankan di laptop

1. Pasang **Node.js 20 atau lebih baru**.
2. Unduh/clone repository ini ke laptop.
3. Buka terminal pada folder proyek.
4. Jalankan:

```bash
npm install
npm start
```

5. Buka http://localhost:3000 di browser.

Database dibuat otomatis pada `data/kebun59.sqlite`. Folder `data/` tidak masuk Git agar data operasional tetap berada di laptop.

## Backend API (fondasi tahap 1)

- `GET /api/health` — status server/database.
- `GET /api/setup/status` dan `POST /api/setup/admin` — pembuatan administrator pertama.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — sesi login.
- `GET /api/dashboard` — ringkasan dashboard.
- `/api/plants` — data tanaman (GET/POST/PUT/DELETE).
- `/api/transactions` — transaksi penjualan/pembelian.
- `/api/users` — manajemen pengguna.
- `/api/settings` — profil usaha.
- `GET /api/audit` — jejak aktivitas administrator.

Password disimpan dalam bentuk hash bcrypt. Sesi menggunakan cookie HTTP-only. Akses endpoint diperiksa di server berdasarkan peran pengguna.

## Data dan pencadangan

- Database SQLite tersimpan di `data/kebun59.sqlite`.
- Tutup aplikasi sebelum menyalin file database untuk backup.
- Simpan salinan backup di media lain secara berkala.
- Jangan menghapus folder `data/` jika ingin mempertahankan data.

## Status pengerjaan

Backend dan skema database lokal merupakan fondasi awal. Integrasi antarmuka dashboard yang saat ini masih prototipe browser ke endpoint API/login akan menjadi langkah berikutnya. Jangan gunakan data demo pada browser sebagai catatan usaha utama sebelum integrasi UI dan pengujian alur selesai.

## Catatan keamanan

Aplikasi ini dirancang untuk pemakaian lokal pada satu laptop. Jangan membuka port server ke internet atau jaringan umum. Sebelum penggunaan pada jaringan lokal, atur `SESSION_SECRET` menjadi nilai acak yang kuat dan tinjau konfigurasi cookie serta backup.
