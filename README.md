# Kebun59 — Nursery Management

Aplikasi pengelolaan bisnis pembibitan tanaman untuk operasional lokal di satu laptop. Frontend berjalan di browser, backend memakai Node.js/Express, dan database SQLite tersimpan di laptop. Tidak membutuhkan Supabase atau koneksi internet saat operasional.

## Menjalankan di laptop Windows

1. Pasang **Node.js 20 atau lebih baru**.
2. Unduh repository ini sebagai ZIP dari GitHub, lalu ekstrak ke folder di laptop (atau gunakan Git clone).
3. Buka folder proyek, klik kanan lalu pilih **Open in Terminal**.
4. Salin file `.env.example` menjadi `.env`.
5. Ganti `SESSION_SECRET` di `.env` dengan kalimat acak yang panjang.
6. Jalankan perintah:

```bash
npm install
npm start
```

7. Buka **http://localhost:3000** di browser.
8. Pada penggunaan pertama, buat akun Administrator. Password minimal 10 karakter. Setelah itu login menggunakan akun tersebut.

Untuk menjalankan lagi di hari berikutnya: buka terminal pada folder proyek, jalankan `npm start`, lalu buka alamat yang sama.

## Fitur yang sudah terhubung ke backend

- Login dan logout menggunakan sesi server.
- Pembuatan akun administrator pertama kali.
- Dashboard ringkasan stok, jenis tanaman, penjualan, dan pengguna aktif.
- Data tanaman: tambah, edit, hapus, pencarian, dan filter kategori.
- Transaksi penjualan dan pembelian.
- User management: tambah akun, ubah nama/email/peran/status.
- Peran: Administrator, Manajer Kebun, Staf Inventaris, dan Kasir.
- Laporan persediaan, penjualan, pembelian, dan komposisi kategori.
- Pengaturan profil usaha.
- Audit log aktivitas untuk administrator.
- Password disimpan sebagai hash bcrypt; akses API diperiksa berdasarkan peran di server.

## Database dan pencadangan

Database dibuat otomatis pada `data/kebun59.sqlite`. Folder `data/` dikecualikan dari Git agar data usaha tidak terunggah ke repository.

Untuk backup, hentikan server (Ctrl+C), salin file `data/kebun59.sqlite` ke flashdisk atau penyimpanan cadangan, lalu jalankan server kembali. Jangan menghapus folder `data/` jika ingin mempertahankan data.

## Batasan tahap ini

Aplikasi ditujukan untuk pemakaian lokal pada satu laptop. Jangan membuka port server ke internet atau jaringan umum. Gunakan backup berkala. Data contoh tanaman awal dapat diedit atau dihapus sesuai kondisi Kebun59.
