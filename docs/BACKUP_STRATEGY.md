# Supabase 3+1 Katmanlı Kurumsal Yedekleme & Felaket Kurtarma Stratejisi

PC (Electron), Web ve Mobil platformlarının tek bir **Supabase** mimarisinde birleştiği Kontrol App için hazırlanmış 3-2-1 kuralına uygun kurumsal yedekleme sistemidir.

---

## 4 Katmanlı Mimari Özeti

| Katman | Tür | Konum / Hedef | Sıklık | Açıklama |
| :--- | :--- | :--- | :--- | :--- |
| **Katman 1** | **Supabase PITR (Point-in-Time Recovery)** | Supabase Altyapısı (WAL Arşivi) | Sürekli (Saniye hassasiyetinde) | Veritabanında yanlış silme/bozulma anında istenen dakikaya anında geri dönüş. |
| **Katman 2** | **Mantıksal DB İhracı (SQL + JSON)** | Bağımsız S3 / R2 / GitHub Artifacts | Günlük (02:00 UTC) | Standart PostgreSQL formatında bağımsız yedek (`dump.sql` ve `data.json`). |
| **Katman 3** | **Supabase Storage Senkronizasyonu** | Bağımsız S3 / R2 / GitHub Artifacts | Günlük (02:00 UTC) | PDF evrakları, araç ruhsatları, personel belgeleri, imza ve kaşe dosyaları. |
| **Katman 4** | **Çevrimdışı (Air-Gapped) Yerel Yedek** | Platform Admin Paneli / Yerel Disk | Haftalık / Anlık | İnternet kesintisi veya hesap risklerine karşı tek tıkla şifreli yerel indirme. |

---

## 1. Katman: Supabase PITR (Point-in-Time Recovery) Kurulumu
1. **Supabase Dashboard**'a girin: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Projenizi seçin -> **Project Settings** -> **Database** sekmesine gidin.
3. **Point in Time Recovery (PITR)** bölümünde:
   - Pro planında PITR'ı aktif edin (7 ila 30 günlük geçmiş tutulabilir).
   - Bu özellik arka planda PostgreSQL Write-Ahead Logging (WAL) mekanizmasını kullanarak herhangi bir zamanda saniye hassasiyetinde veritabanı klonlama / kurtarma sağlar.

---

## 2. Katman & 3. Katman: Otomatik Bulut Yedekleme (GitHub Actions & S3 / R2)

Projedeki `.github/workflows/supabase-backup.yml` iş akışı her gece **02:00 UTC**'de otomatik çalışır.

### Gerekli Ortam Değişkenleri (GitHub Secrets & .env):
```env
# Veritabanı ve Supabase
DATABASE_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres"
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Şifreleme (Opsiyonel - AES-256-GCM)
BACKUP_ENCRYPTION_KEY="32-karakterlik-guvenli-anahtar"

# Harici Depolama (Cloudflare R2 veya AWS S3 - Opsiyonel)
S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
S3_BUCKET="kontrol-backups"
S3_ACCESS_KEY_ID="xxx"
S3_SECRET_ACCESS_KEY="yyy"
S3_REGION="auto"
```

---

## 3. Katman 4: Çevrimdışı (Air-Gapped) Yerel İndirme ve Yönetim

### A. Platform Yönetim Panelinden Tek Tıkla İndirme
1. Sol menüden **Platform Yönetimi** -> **Sistem & Veritabanı Yedekleri** sayfasına gidin.
2. Tablodaki herhangi bir yedeğin sağındaki **"İndir"** butonuna tıklayın.
3. İndirilen `.zip` arşivi hem SQL dökümünü, hem JSON verilerini hem de Supabase Storage evraklarını içerir.

### B. Terminal / CLI Komutları
Proje ana dizininde:

```bash
# 1. Tam Sistem Yedeği Al (DB + Storage + S3 Senkronizasyonu)
npm run backup

# 2. Sadece Veritabanı Yedeği Al (SQL + JSON)
npm run backup:db

# 3. Sadece Storage Dosyalarını Yedekle (PDF/Görseller)
npm run backup:storage

# 4. Yedeği Geri Yükle
npm run backup:restore ./backups/kontrol_unified_backup_2026-09-24.zip
```

---

## 4. Geri Yükleme (Disaster Recovery) Senaryoları

### Senaryo A: Yanlışlıkla Tablo / Veri Silindi
* **Çözüm 1:** Supabase Dashboard -> Backups -> PITR üzerinden 10 dakika öncesine geri dönün (sıfır veri kaybı).
* **Çözüm 2:** `npm run backup:restore <yedek_dosyasi>` çalıştırın.

### Senaryo B: Supabase Dışı Başka Bir Sunucuya Geçiş
* Arşiv içindeki `database/dump.sql` dosyasını herhangi bir yerel veya uzak PostgreSQL sunucusuna aktarın:
  ```bash
  psql -h yeni-host -U postgres -d veritabani < database/dump.sql
  ```
* Arşiv içindeki `storage/` klasöründeki dosyaları yeni depolama sunucusuna kopyalayın.
