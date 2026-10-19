# Kontrol — proje inceleme raporu

İnceleme tarihi: 16 Ekim 2026. İncelenen paket sürümü: `1.13.148`.

**Genel değerlendirme:** Uygulamanın modül kapsamı geniş; ancak mevcut kaynakta hesap ele geçirme, yetki yükseltme ve şirketler arası veri erişimi sağlayabilecek kritik hatalar var. Mevcut haliyle çok şirketli, gerçek personel ve finans verisi işleyen bir dağıtımı güvenli kabul etmem. Öncelik yeni özellik veya görsel yenileme değil, kimlik doğrulama ve veri izolasyonunun düzeltilmesi olmalı.

**Kapsam ve doğrulama sınırı**

- Web sunucusu, Electron API/IPC yapısı, kimlik doğrulama, MFA, roller, şirket izolasyonu, dosya işlemleri, yedekleme, finans işlemleri, Prisma/RLS, React bağlamları, ortak form/tablo bileşenleri, CSS, başlangıç ve dağıtım yapılandırmaları incelendi.
- `npm test`: **7 dosya, 29 test geçti**. Bu sonuç uçtan uca güvenlik doğrulaması değildir.
- Vite üretim derlemesi `/private/tmp/kontrol-audit-build` içine başarıyla alındı. Döngüsel chunk bağımlılığı, CSS sözdizimi ve büyük paket uyarıları var. Electron kurulum paketi ve Docker imajı üretilmedi.
- MFA, rol atama ve geri yükleme servisleri sahte veritabanı nesneleriyle çalıştırıldı. Canlı kullanıcı, parola, dosya veya veritabanı değiştirilmedi. Uygulama kaynak koduna düzeltme uygulanmadı; bu rapor eklendi.
- Açık Electron penceresi canlı kontrolde boş/siyah görünüyordu. Bunun nedeni kesinleştirilmedi. Tüm ekranların mobil/masaüstü, açık/koyu tema ve farklı kullanıcı rolleriyle görsel kabul testi tamamlanmış değildir. Aşağıdaki tasarım bulguları çoğunlukla bileşen/CSS kanıtına dayanır.
- Tam `npm audit` sonuçlandırılamadı: kısıtlı ortamda DNS erişimi başarısız oldu, genişletilmiş ağ erişimi onaylanmadı. Bağımlılıklar için eksiksiz CVE sayısı verilmemektedir.
- Üretimde hangi RLS politikalarının kurulu olduğu, PostgreSQL hesabının gerçek yetkileri, ağ güvenlik duvarı ve Supabase Storage bucket izinleri doğrulanmadı. Bu koşullara bağlı sonuçlar ayrıca belirtilmiştir.

## 1. Güvenlik

### G01 — Kritik: kaynak kodda parolalı PostgreSQL bağlantısı

**Kanıt:** `electron/prismaClient.js:154`, `getPrismaClient()` içindeki `DATABASE_URL || customDbUrl || DEFAULT_POSTGRES_URL` seçimi. `electron/services/supabase.service.js:106` içinde de parolalı fallback bağlantısı bulunuyor; migration script'lerinde ek sabit bağlantı adayları var. `package.json` Electron paketine `electron/**/*` ve `scripts/**/*` dosyalarını dahil ediyor.

Parolalı uzak veritabanı bağlantısı kaynakta sabit. Ortam ayarı bulunmadığında bu bağlantı otomatik kullanılıyor. Paket alıcısı da bu bilgiyi çıkarabilir; ASAR arşivi sır saklama yöntemi değildir. Bağlantının hâlen geçerli olduğu veya sunucunun dışarıdan erişilebilir olduğu test edilmedi; **kimlik bilgisinin dağıtılması başlı başına kritik bir sorundur**.

**Öneri:** Parolayı değiştir, eski erişimi iptal et, bağlantıyı kaynak ve dağıtım paketinden kaldır. Masaüstünü ortak veritabanına ayrıcalıklı hesapla doğrudan bağlamak yerine kimlik doğrulayan API üzerinden çalıştır. Git geçmişi ve eski dağıtımları da sızıntı kapsamına dahil et. Parola bu raporda tekrar edilmemiştir.

### G02 — Kritik: MFA uç noktası parolasız oturum oluşturabiliyor

**Kanıt:** `electron/services/mfa.service.js:200` ve devamı; `server.js:801`, `server.js:875`.

`verifyMfaLogin(userId, code)` önceden başarılı parola girişini kanıtlayan bir challenge istemiyor. 2FA kapalı veya secret eksikse doğrudan `success: true` ve kullanıcı dönüyor. Metot herkese açık; web sunucusu başarılı cevaba 7 günlük JWT ekliyor. Servis bu yolda hesabın aktifliğini de kontrol etmiyor.

**Doğrulama:** Sahte, pasif ve 2FA kapalı kullanıcıya boş kodla çağrı yapıldığında başarılı kullanıcı sonucu döndü. Canlı hesapta oturum açılmadı.

**Öneri:** Parola doğrulamasından sonra kısa ömürlü, tek kullanımlık ve kullanıcıya bağlı MFA challenge üret; MFA doğrulamasında bunu zorunlu tut. 2FA kapalı hesap bu uçtan oturum alamamalı. Aktiflik, kilitleme ve tekrar deneme kontrolleri iki aşamada da uygulanmalı.

### G03 — Kritik: masaüstü API bütün ağa açık, RPC kimlik doğrulamıyor

**Kanıt:** `electron/adminServer.js:99` civarındaki RPC router, dosyanın sonundaki `app.listen(PORT, '0.0.0.0')`; `electron/main.js:377`.

Electron açılırken 9999 portunda API başlıyor. RPC handler, oturum middleware'inden önce kayıtlı; middleware ayrıca `/rpc/` yollarını açıkça atlıyor. `db` ve `authService` fonksiyonlarına anonim erişim oluşuyor. CORS da sınırsız. Ağdan ulaşılabilirlik işletim sistemi/firewall koşullarına bağlıdır; uygulama düzeyindeki koruma eksikliği kesindir.

**Öneri:** Gerekli değilse dağıtımda bu sunucuyu başlatma. Gerekliyse loopback'e bağla; tüm RPC ve dosya uçlarında doğrulama ve yetkilendirme uygula. Web ve Electron için ortak güvenlik politikası kullan.

### G04 — Kritik: normal kullanıcı kendi rolünü yükseltebilir

**Kanıt:** `server.js:687`, `server.js:810`, `server.js:827`; `electron/services/role.service.js`, `assignUserRoleAndEmployee()`.

`assignUserRole` yalnızca geçerli JWT istiyor, yönetici kontrolü yapmıyor. Servis istemcinin gönderdiği `userId` ve `role` değerlerini doğrudan güncelliyor; `superadmin` değerini engellemiyor. Ayrıca güncellenen ham kullanıcı nesnesini döndürüyor. `deleteUserAccount` gibi başka yönetim işlemleri de eksik rol korumasından etkileniyor.

**Doğrulama:** Sahte veritabanıyla servis `superadmin` atamasını kabul etti; cevapta fixture parola hash'i de kaldı.

**Öneri:** Aktör kimliğini sunucudan taşı; kim kimi hangi role atayabilir kuralını uygula; izin verilen alan/rol listesini sınırla. Kullanıcı cevabı için ortak güvenli DTO kullan.

### G05 — Kritik: şirket izolasyonu isteğe bağlı ve istemci tarafından aşılabilir

**Kanıt:** `server.js:860`; `electron/services/vehicle.service.js:8`, `:57`, `:117`, `:152`; `electron/services/work.service.js:67`, `:207`, `:227`; `electron/services/backup.service.js:3`.

Listeleme çağrıları istemciden gelen şirket ID'sini, detay/güncelleme çağrıları çoğunlukla yalnızca kayıt ID'sini kullanıyor. Router sadece seçili tek kayıt silmelerinde, `args.length === 1` olduğunda şirket ID'si ekliyor. İkinci argümanı göndermek bu eklemeyi önlüyor; servislerde `if (companyId)` kontrolü `null` ile atlanabiliyor. Toplu silme/arşivleme de aynı merkezi izolasyona sahip değil.

**Etki:** Oturum açabilen düşük yetkili kullanıcı, başka şirkete ait kayıtları okuma/değiştirme/silme yollarına ulaşabilir. Arayüzde şirket seçimi veya buton gizlemek bunu engellemez.

**Öneri:** Her sorguda aktörün erişebildiği şirketler sunucuda hesaplanmalı. Kayıt ID'si + yetkili şirket filtresi tek sorguda uygulanmalı. İstemcinin şirket ID'si yetki kanıtı olarak kabul edilmemeli.

### G06 — Kritik: yedek ve cron uçlarında sahte Authorization başlığı yeterli

**Kanıt:** `server.js:132`, `:143`, `:943`.

Kontrol `if (!authHeader && key !== SECRET_KEY)` şeklinde. Başlık varsa token doğrulanmadan devam ediliyor. Bu, yedek tetikleme, adı bilinen yedek dosyasını indirme ve bildirim taramasını çalıştırma imkânı veriyor. Cron taraması e-posta gibi dış etkiler üretebilir.

**Doğrulama:** Kontrol koşulu geçersiz bir Authorization değeriyle reddetme üretmedi. Gerçek yedek/cron işlemi tetiklenmedi.

**Öneri:** Ortak token doğrulama middleware'i ve açık yönetici/cron yetkisi. URL query içinde ana sır taşınmamalı.

### G07 — Kritik: dosya indirme anonim ve dizin sınırını korumuyor

**Kanıt:** `server.js:170` ve devamındaki `/uploads` handler.

URL yolu decode edildikten sonra `path.join(filesDir, relativePath)` ile birleştiriliyor; sonucun `filesDir` içinde kaldığı doğrulanmıyor. Kodlanmış üst dizin bileşenleri dışarı çıkabiliyor. Uygulama hesabının okuyabildiği normal dosyalar risk altında. Dosya yolu bilinirse şirket/personel belgeleri de oturumsuz sunuluyor. Dosyalar `public, max-age=86400` ile cache'leniyor; fallback yalnızca dosya adına göre bütün dizini arıyor.

**Doğrulama:** Aynı yol hesabı sahte kök dizinle çalıştırıldığında sonuç kök dışına çıktı. Gerçek dosya okunmadı.

**Öneri:** Kimlik ve belge sahipliği kontrolü; normalize edilmiş yolun kök içinde kaldığını doğrulama; özel cache politikası; şirket sınırlarını aşan basename fallback'ini kaldırma.

### G08 — Kritik: dosya yükleme oturumsuz, klasör parçaları doğrulanmıyor

**Kanıt:** `server.js:239` civarındaki `/api/upload`, `storageFolder` oluşturma ve `fs.writeFileSync`.

Dosya uzantısı ve boyut kontrolü var, fakat oturum/şirket sahipliği kontrolü yok. `module`, `category`, `entityId` gibi değerler klasör yoluna katılıyor; üst dizin bileşenleri engellenmiyor. Şirket gönderilmezse kota kontrolü yapılmıyor; kota kontrolü hata verdiğinde de işleme devam ediliyor.

**Etki:** İstenmeyen dosya depolama, disk/kota tüketimi ve amaçlanan dizin dışında yeni dosya oluşturma. İzinli uzantı ve rastgele dosya adı nedeniyle bunu sınırsız mevcut dosya üzerine yazma veya kesin kod çalıştırma olarak değerlendirmiyorum.

**Öneri:** Kullanıcıdan şirket ID'sine güvenme; klasörleri sunucuda enum/ID değerlerinden kur; kök dizin kontrolü yap; dosya içeriğini doğrula; kota hatasında işlemi durdur.

### G09 — Kritik: parola sıfırlama alternatif yolu sahiplik doğrulamıyor

**Kanıt:** `electron/services/auth.service.js:1049`; `server.js` içindeki `syncPasswordReset` eşlemesi.

`syncPasswordReset` yalnızca e-posta ve yeni parolayı alarak hash'i değiştiriyor. Mevcut parola, recovery token, OTP veya çağıran kullanıcıyla eşleşme aranmıyor. Web'de herhangi bir oturum yeterli; masaüstü RPC'de G03 nedeniyle oturum da gerekmiyor.

**Öneri:** Bu arka kapı niteliğindeki akışı kapat veya doğrulanmış tek kullanımlık recovery yetkisine bağla. Aynı işlemi yapan paralel parola reset yollarını azalt.

### G10 — Yüksek: OTP doğrulaması oturuma bağlı değil; deneme sınırı kalıcı değil

**Kanıt:** `electron/services/auth.service.js:1242`, `:1251`, `:1266`, `:1355`.

Başarılı OTP doğrulaması e-posta anahtarlı global bir kayıtta `verified: true` yapıyor. Ardından `completePasswordReset`, aynı e-posta için OTP verilmeden de ilerleyebiliyor. Doğrulama ile parola değiştirme arasındaki pencerede başka istek bu durumu kullanabilir. Beş denemeden sonra yalnızca bellek kaydı siliniyor; veritabanındaki OTP ve expiry kaldığı için sonraki çağrılar kalıcı deneme sınırı olmadan DB yoluna geçebiliyor. OTP üretiminde `Math.random()` da kullanılıyor.

**Öneri:** Doğrulama sonucunda rastgele, kullanıcıya/işleme bağlı ve tek kullanımlık recovery token dön; parola değişimini token tüketimiyle atomik yap. Deneme sayısını ortak depoda tut ve DB OTP'sini de iptal et. Güvenli rastgele üretim kullan.

### G11 — Kritik, kurulum koşullu: RLS kullanıcı tarafından değiştirilebilir metadata'ya güveniyor

**Kanıt:** `supabase/migrations/20260924_enable_rls_hardening.sql:10` ve `:20`.

`auth_company_id()` ve `auth_user_role()` değerleri JWT içindeki `user_metadata` üzerinden okunuyor. Supabase'de bu metadata kullanıcı tarafından güncellenebilir; yetki kararında güvenilir değildir. Politikalar kuruluysa ve ilgili tablo/işlem grant'leri açıksa kullanıcı şirket/rol bilgisini değiştirerek izolasyonu aşabilir. Üretime uygulanmış hali doğrulanmadı.

Ek olarak script, `company_id` olmayan tablolarda RLS'i açıp uygun ilişkisel politikayı oluşturmuyor; doğrudan istemci erişimi bloke olabilir. Tablo listesi de şemayla bire bir değil (`meal_ticket_settings` / `meal_settings` gibi). Scriptin varlığı tüm erişim yollarının güvenli olduğunu kanıtlamaz; ayrıcalıklı Prisma bağlantısı RLS'i aşabilir.

**Öneri:** Sunucu kontrollü `app_metadata` veya güvenilir üyelik tabloları; kullanıcı-ID eşlemesi; bütün tablolarda SELECT/INSERT/UPDATE/DELETE için negatif testler. Kaynak: [Supabase RLS belgeleri](https://supabase.com/docs/guides/database/postgres/row-level-security).

### G12 — Yüksek: oturum sonlandırma JWT'yi geçersiz kılmıyor

**Kanıt:** `server.js:839`, `:883`; `electron/services/session.service.js:recordHeartbeat`, `terminateUserSession`; `src/context/AuthContext.jsx` heartbeat akışı.

Token 7 gün geçerli. API token doğrularken güncel aktiflik, parola değişimi veya iptal edilmiş oturum kontrolü yapmıyor. Force logout, yalnızca istemcinin heartbeat cevabını dinleyip çıkmasına dayanıyor; session ID JWT'ye bağlı değil. API'yi doğrudan kullanan kişi heartbeat'i atlayabilir. Heartbeat ayrıca herkese açık ve kullanıcı/rol bilgisini istemciden kabul ediyor.

**Öneri:** JWT/session ID bağlama; sunucuda session iptali veya token sürümü; parola değişimi ve hesap kapatmada iptal; heartbeat kimliğini token'dan türetme.

### G13 — Yüksek: yönetim tablo uçları diğer şirketleri ve MFA sırlarını açıyor

**Kanıt:** `server.js:902`, `:923`; `prisma/schema.pg.prisma:429`.

`company_admin` rolü `/api/data/:table` için yeterli, sorgu ise şirketsiz `findMany({ take: 500 })`. `users` tablosunda yalnızca `password/password_hash` çıkarılıyor; `two_factor_secret`, yedek kodlar ve recovery OTP gibi alanlar kalıyor. Başka şirketlerin ilk 500 kaydı ve hassas kimlik doğrulama alanları okunabilir.

Router'ın `authService[method]` fallback'i nedeniyle export edilen `getUserPasswordHash` gibi iç yardımcılar da normal oturumla RPC üzerinden çağrılabilir; yalnızca tablo cevabını temizlemek yeterli değildir.

**Öneri:** Genel tablo gezginini üretimden çıkar veya yalnızca sıkı platform yöneticisi erişimiyle sun. Her tabloya ayrı alan listesi ve şirket kapsamı tanımla. İç yardımcıları RPC'den çıkar. MFA yedek kodlarını hash'le; TOTP secret'ını ayrı koru.

### G14 — Yüksek: sabit geliştirme sırrı, varsayılan admin ve değişken üretim sırrı

**Kanıt:** `server.js:44`, `:1003`; `electron/adminServer.js:11`.

Üretim dışı modda sabit JWT anahtarı kullanılıyor; yanlış ortam ayarıyla dışarı açılan sunucuda token sahteciliği riski doğar. Boş PostgreSQL kurulumunda bilinen varsayılan admin parolası oluşturuluyor. Üretimde JWT_SECRET yoksa başlangıç reddedilmek yerine geçici rastgele anahtar üretiliyor; restart ve birden fazla instance oturumları tutarsızlaştırır.

**Öneri:** Gerekli sır eksikse başlangıç başarısız olmalı. İlk yönetici kurulumu tek kullanımlık güvenli süreçle yapılmalı; varsayılan ortak parola olmamalı.

### G15 — Yüksek: yazdırma HTML'i kaçışsız veri içeriyor

**Kanıt:** `src/pages/MealTicketReport.jsx:handlePrintPDF`, `:199`; `index.html` CSP.

Şirket adı ve rapor metinleri HTML string'ine eklenip `document.write` ile yeni pencereye yazılıyor. HTML kaçışlama katmanı yok. Veri yazabilen biri rapor açıldığında HTML/olay işleyicisi enjeksiyonu yapabilir. CSP `unsafe-inline` ve `unsafe-eval` içeriyor; token'lar localStorage'da. Tarayıcı/desktop etkisi ayrı test edilmelidir; canlı XSS uygulanmadı.

**Öneri:** React/DOM text düğümleriyle çıktı üret veya bütün dinamik metinleri bağlamına göre escape et. Yazdırma penceresini izole et; CSP'yi daralt. `EmailTemplatesManager` iframe'inde script izni olmayan sandbox bulunduğu için o önizleme aynı açık olarak sayılmamıştır.

## 2. İşlev, veri bütünlüğü ve ürün tutarsızlıkları

### İ01 — Yüksek: yedekten geri dönüş eksik ama başarılı raporlanıyor

**Kanıt:** `electron/services/backup.service.js:102`, `:161`.

Export; işler, iş kalemleri, ödemeler, yemek fişleri, maaşlar, izinler ve araç/personel bağlı kayıtlarını içeriyor. Import yalnızca şirket, araç, müşteri ve personel temel kayıtlarını oluşturuyor. Belgelerin dosyaları ve ilişkiler için ID eşleme de yok.

**Doğrulama:** Bağlı kayıtları olan sahte yedekte yalnızca `companies`, `vehicles`, `customers`, `employees` oluşturuldu; sonuç `success: true` döndü.

**Öneri:** Yedek şemasını sürümle; ilişkileri ve dosyaları geri yükle; desteklenmeyen veriyi sessizce atma. Export → import → ilişkisel veri karşılaştırması testi ekle.

### İ02 — Orta: şirket ID'sinin localStorage biçimi uyuşmuyor

**Kanıt:** `src/context/CompanyContext.jsx:selectCompany`; `src/services/apiBridge.js:selectFile`.

Context `aractakip_company` anahtarına sayısal ID yazıyor. Dosya seçici aynı değeri JSON nesnesi sanıp `.id` okuyor. Çağıran bileşen ayrıca companyId göndermediyse yükleme şirketi kayboluyor; hiyerarşi ve kota atlanabiliyor.

**Öneri:** Tek storage sözleşmesi; yüklemelerde geçerli şirket zorunluluğu; context üzerinden doğrudan şirket aktarımı.

### İ03 — Orta: MFA giriş cevabı normal girişle aynı değil

**Kanıt:** `electron/services/mfa.service.js:sanitizeUser`; `server.js:877`.

MFA cevabında `company_id`, şirket listesi ve izinler yok. Router bu cevaptan token ürettiği için company_id null olabiliyor; zaten eksik olan silme kapsamı ekleme yolu da çalışmıyor. UI ile normal giriş akışında yetki/şirket farklılıkları doğabiliyor.

**Öneri:** Bütün giriş yöntemlerinde aynı kullanıcı DTO'su ve sunucuda aynı izin yükleme akışı.

### İ04 — Orta: şirket değişiminde geç gelen cevap eski ayarları yazabilir

**Kanıt:** `src/context/CompanyContext.jsx:loadCompanySettings`, `loadUpcomingEvents`.

Şirket A isteği sürerken B'ye geçildiğinde, A cevabı geç gelirse ortak state/localStorage üzerine yazılabiliyor. İstek iptali veya cevabın hâlâ aktif şirkete ait olduğunu kontrol eden mekanizma yok. Ayar isteği başarısız olduğunda eski companySettings de kalabilir.

**Öneri:** Şirket ID'siyle anahtarlanmış query; eski istekleri iptal etme/sonuçlarını eleme; geçişte ilgili state'i sıfırlama.

### İ05 — Orta: süresi geçmiş oturum arayüzde açık kalıyor

**Kanıt:** `src/context/AuthContext.jsx` başlangıç useEffect'i; `src/services/apiBridge.js` standart RPC çağrısı.

localStorage'daki kullanıcı hemen oturum kabul ediliyor. Profil isteği başarısız olursa temizlenmiyor; 401 cevabı genel hata nesnesine çevriliyor. Kullanıcı ekranlara girebiliyor ama işlemler art arda hata verebiliyor.

**Öneri:** Açılışta oturum doğrulama durumu; 401 için tek merkezli çıkış/yenileme; sunucu erişilemiyorsa açık çevrimdışı durumu.

### İ06 — Orta: PDF indirme tamamlanmadan başarı bildiriliyor

**Kanıt:** `src/services/apiBridge.js:saveReportPdf` iframe fallback'i.

Iframe oluşturulduktan 5 saniye sonra kaldırılıyor ve dosya gerçekten üretilmiş mi bakılmadan `success: true, filePath: 'İndirildi'` dönüyor. Büyük rapor, yavaş cihaz veya render hatasında yanlış başarı mesajı oluşur.

**Öneri:** Gerçek tamamlanma/hata mesajı ve timeout; iframe'i yalnızca işlem sonuçlandığında kaldırma.

### İ07 — Yüksek: finans silme ve bağlı kayıt güncelleme atomik değil

**Kanıt:** `electron/services/finance.service.js:80`.

İşlem kaydı önce siliniyor, sonra iş durumu veya maaş kaydı değiştiriliyor. Bunlar tek transaction içinde değil. İkinci adım hata verirse muhasebe kaydı silinmiş ama ilişkili durum eski kalmış olur. Maaş silme hatası da yutulabiliyor. İlişki bir foreign key yerine kategori metnine gömülen ID üzerinden kuruluyor.

**Öneri:** İlişkisel referanslar ve tek transaction; başarısız adımda geri alma; yeniden denemede çift etki üretmeyen işlem tasarımı.

### İ08 — Orta: para alanları Float ve parseFloat ile işleniyor

**Kanıt:** `prisma/schema.pg.prisma` maaş/işlem/iş kalemi tutarları; `electron/services/finance.service.js:38`.

İkili kayan nokta, toplama/çarpma ve farklı rapor yuvarlamalarında kuruş farkı riski taşır. Somut bir muhasebe tutarı farkı ölçülmedi; veri modeli kaynaklı risk olarak kaydedilmiştir.

**Öneri:** PostgreSQL Decimal/numeric veya kuruş tabanlı integer; bütün rapor ve hesaplarda ortak, belgelenmiş yuvarlama kuralı.

### İ09 — Orta: plaka tekilliği yalnızca yarışa açık uygulama kontrolü

**Kanıt:** `electron/services/vehicle.service.js:73`; `prisma/schema.pg.prisma:457`.

Önce findFirst sonra create yapılıyor; şirket + normalize plaka için veritabanı tekillik kuralı yok. Eşzamanlı iki istek aynı plakayı oluşturabilir. Kontrol yalnızca `is_archived: 0` kayıtları ararken listeleme null değerleri de aktif sayıyor. Normalizasyon da sunucuda zorunlu değil.

**Öneri:** Tek normalize plaka biçimi; aktif/arşiv iş kuralına uygun DB constraint veya partial unique index; conflict'i kullanıcıya anlamlı döndürme.

### İ10 — Orta: masaüstü geliştirme API'si ile web API'si aynı sözleşmede değil

**Kanıt:** `vite.config.mjs` proxy 9999; `electron/adminServer.js`; `src/services/apiBridge.js:selectFile`.

Web dosya seçici `/api/upload` çağırıyor. Vite bunu 9999'a yönlendiriyor; adminServer bu upload endpoint'ini sunmuyor. Sunucu sürümünde çalışan yükleme, Electron yanında tarayıcı geliştirme modunda çalışmayabilir. Üstelik üç ayrı dispatch alanı var: `server.js`, `electron/rpcMap.js`, `electron/main.js`.

**Öneri:** Tek API sözleşmesi ve ortak handler; platforma özgü yetenekleri açıkça belirtme; web/desktop sözleşme testleri.

## 3. Tasarım ve kullanılabilirlik

Bu bölümdeki sorunlar kodla desteklenir; tam görsel kontrast ölçümü veya bütün ekranlarda taşma testi yapılmış değildir.

### T01 — Orta: modal klavye ve ekran okuyucu desteği eksik

**Kanıt:** `src/components/Modal.jsx`.

`role="dialog"`, `aria-modal`, başlık bağlantısı, ilk odak ataması, odak hapsi ve kapatınca odağı geri verme yok. Kullanıcı Tab ile arka sayfaya geçebilir; ekran okuyucu pencere bağlamını doğru alamayabilir.

**Öneri:** Ortak erişilebilir dialog altyapısı; Escape/Tab/Shift+Tab ve ekran okuyucu testi.

### T02 — Orta: form etiketleri ve hata mesajları input'a bağlı değil

**Kanıt:** `src/components/CustomInput.jsx`.

Etikette `htmlFor`, bileşenin ürettiği ilişkili input ID'si, `aria-invalid` ve hata açıklaması bağlantısı yok. Required prop görsel kontrol için alınıyor ama native input'a otomatik aktarılmıyor. `required && !value`, geçerli `0` değerini de hatalı sayabilir. Floating label zorunlu ve placeholder her durumda gizli; biçim örnekleri kayboluyor.

**Öneri:** Otomatik ID/label/error ilişkisi; sıfır ve boş değeri ayırma; yardım metni; required/disabled durumlarını tek standarda bağlama.

### T03 — Orta: mobil yakınlaştırma engelleniyor

**Kanıt:** `index.html:7` viewport içindeki `maximum-scale=1.0, user-scalable=no`.

Destekleyen tarayıcılarda kullanıcı metni büyütemiyor. Çok sayıdaki 10–11 px açıklamayla birlikte okunabilirliği düşürüyor.

**Öneri:** Zoom kısıtını kaldır; yüzde 200 büyütmede form, tablo ve modal testleri yap.

### T04 — Orta: küçük yazı ve küçük işlem alanları yaygın

**Kanıt:** `src/pages/Employees.jsx:230`, `src/pages/Vehicles.jsx:280`, `src/pages/Settings.jsx:1386`, `src/components/BatchOperationModal.jsx:239`.

Operasyonel bilgi için 10–11 px yazılar; bazı işlemlerde 28 px yükseklik kullanılıyor. Yoğun tabloda kısa süreli tarama ve dokunmatik kullanım zorlaşıyor. Kesin kontrast oranı ölçülmedi.

**Öneri:** Metin boyutu/hiyerarşi ve kontrol yüksekliği için ortak token'lar; kompakt/rahat yoğunluk seçimi; gerçek cihazla okuma testi.

### T05 — Orta: form kapatmada kaydedilmemiş değişiklik koruması ortak değil

**Kanıt:** `src/components/Modal.jsx` overlay click ve Escape handler'ı.

Modal, dışarı tıklama veya Escape ile doğrudan kapanıyor. Ortak bileşende dirty kontrolü yok; form kendi önlemini almadıysa uzun giriş kaybolabilir. Her formun veri kaybettiği iddia edilmemektedir; ortak güvence eksiktir.

**Öneri:** Dirty durumuyla ortak kapanış koruması; uzun formlarda taslak saklama ve kaydetme durumu.

### T06 — Düşük/Orta: dil ve onay pencereleri tutarsız

**Kanıt:** `src/config/navigation.js`; `src/components/EmailTemplatesManager.jsx:488`; `src/pages/Settings.jsx:574`, `:626`; `src/components/ConfirmModal.jsx`.

Türkçe arayüzde Dashboard/Desktop/Mobile/From/Subject gibi terimler karışıyor. Ortak ConfirmModal bulunmasına rağmen bazı akışlarda native confirm/alert kullanılıyor. Aynı önem düzeyindeki işlemler farklı görsel dil ve klavye davranışı gösteriyor.

**Öneri:** Tek terminoloji sözlüğü; bütün onayları aynı bileşene taşıma; buton metninde yapılacak işlemi açık söyleme.

### T07 — Orta: yazdırma görünümünde somut CSS hatası var

**Kanıt:** `src/pages/WorkPdfReport.css:807`.

İki selector virgülle bırakılmış, arkasından blok açılmadan `@media print` geliyor. Üretim derlemesi de `Unexpected "@media"` uyarısı verdi. PDF oluşturulurken gizlenmesi gereken yardımcı işaretlerin kuralları güvenilir değil.

**Öneri:** Selector ve media bloklarını düzelt; çıktı PDF'sinde çok sayfalı rapor, sayfa sonu işaretleri ve yazdırma önizlemesini görsel doğrula.

### T08 — Orta: yemek raporunda sayfa numarası sabit

**Kanıt:** `src/pages/MealTicketReport.jsx` yazdırma şablonundaki `Sayfa 1/1` ve mutlak konumlu footer.

Kayıt sayısı arttığında rapor birden fazla sayfaya taşabilir; sayfa bilgisi yine 1/1 kalıyor. Uzun tabloda footer çakışması ayrıca görsel test gerektirir.

**Öneri:** Çok sayfalı çıktı motoru; tekrar eden tablo başlığı; gerçek sayfa numarası; 1, 50 ve 200 satırlı örneklerle QA.

## 4. Mimari, performans ve geliştirme süreci

### M01 — Orta: paket bölme kuralları yanlış eşleşiyor ve döngü oluşturuyor

**Kanıt:** `vite.config.mjs:manualChunks`; üretim derlemesi çıktısı.

İlk `id.includes('react')` koşulu `react-pdf`, `lucide-react`, `@tanstack/react-query` gibi paketleri de yakalıyor; aşağıdaki özel chunk kuralları bu paketler için etkisiz kalıyor. Derleme `vendor-pdf → vendor-react → vendor-pdf` döngüsü uyarısı verdi. PDF paketi yaklaşık 1.43 MB, React paketi 530 KB, giriş paketi 483 KB (minify sonrası, gzip öncesi). Bu, başlangıç yükünü ve hata ayıklamayı zorlaştırıyor; tek başına siyah pencerenin nedeni olarak doğrulanmadı.

**Öneri:** Tam paket adına göre eşleştirme; lazy feature sınırları; bundle analizi; temiz tarayıcıda ilk açılış ve ağ kesintisi testi.

### M02 — Orta: büyük bileşenler ve CSS override birikimi değişiklik riskini artırıyor

**Kanıt:** `src/index.css`: 8.802 satır ve 668 `!important`; `EmployeeDetail.jsx`: 4.645, `Settings.jsx`: 3.119, `PlatformAdmin.jsx`: 2.953 satır.

Görünüm, veri çağrısı, iş kuralı, modal ve rapor akışları aynı dosyalarda büyümüş. CSS'de breakpoint/öncelik çakışmasını izlemek güç. Bunun sonucu her ekranın bozuk olduğu değil, küçük düzeltmenin başka ekranı etkileme olasılığının yüksek olmasıdır.

**Öneri:** Özellik bazlı bileşen ve hook ayrımı; ortak tasarım token'ları; stilleri kapsülleme; kritik ekranlar için görsel regresyon kontrolleri.

### M03 — Yüksek: geçen testler gerçek güvenlik davranışını ölçmüyor

**Kanıt:** `tests/security.test.js`, `tests/db.test.js`, `tests/backup.test.js`.

Güvenlik testinde gerçek endpoint yerine `path.basename` örneği, yerel oluşturulmuş kullanıcı sanitizasyonu ve sabit rol nesnesi test ediliyor. Backup testi gerçek import/export'u çağırmıyor. Gerçek handler'lar güvensizken 29 testin hepsi geçebiliyor.

**Öneri:** Anonim/normal kullanıcı/şirket yöneticisi/platform yöneticisi matrisi; başka şirket ID'si; ikinci argümanla silme; pasif kullanıcı MFA; sahte Authorization; dosya traversal; yedek round-trip testleri. Testler gerçek handler ve servisleri çalıştırmalı.

### M04 — Yüksek: release öncesi test kapısı yok; kurulum tekrarlanabilirliği zayıf

**Kanıt:** `.github/workflows/build.yml`, `Dockerfile`, `package.json` scripts.

Workflow build ve publish yapıyor, `npm test` çalıştırmıyor. Lint/typecheck script'i yok. CI ve Docker `npm install` kullanıyor. Docker üretim katmanına geliştirme bağımlılıkları da taşınıyor ve non-root kullanıcı tanımlanmamış.

**Öneri:** PR ve release üzerinde test/lint/build kapısı; `npm ci`; üretim bağımlılıklarını ayırma; non-root kullanıcı; kritik uyarılarda release engelleme.

### M05 — Orta/Yüksek: şema ve hesaplama mantığının birden fazla kopyası var

**Kanıt:** dört Prisma schema dosyası; `electron/prismaClient.js:runAutoMigrations`; `electron/utils/postgresDdl.js`; `src/utils/workCalculations.js` ve `electron/utils/workCalculations.js`.

Runtime ALTER TABLE akışları, SQL DDL ve farklı schema dosyaları birlikte tutuluyor. İş hesaplama kodu hem frontend hem backend'de kopyalanmış ve ikisi de tek kaynak olduğunu söylüyor. Drift, kurulum farkı ve ekrandaki tutarla backend tutarının ileride ayrışması riski var; mevcut bütün hesapların yanlış olduğu iddia edilmemektedir.

**Öneri:** Sürüm kontrollü tek migration zinciri; SQLite/PostgreSQL için açık destek/test matrisi; ortak saf hesaplama paketi ve paylaşılan fixture'lar.

### M06 — Orta: başlangıç script'leri yanlış hazır olma sinyali ve süreç sonlandırma riski taşıyor

**Kanıt:** `scripts/wait-vite.js`; `scripts/clear-port.js`.

wait-vite, 2xx–4xx arasındaki her cevabı Vite hazır kabul ediyor; 404 veren başka servis de yeterli. Timeout handler `destroy()` ardından retry çağırırken error handler da retry çağırabilir; çift kontrol zinciri oluşabilir. Response drain/close kontrolü yok. clear-port ise portu kullanan süreci zorla öldürüyor; Windows'ta tüm `electron.exe` süreçlerini kapatıyor.

**Öneri:** Vite'a özgü readiness doğrulaması; tek retry timer ve request yaşam döngüsü; yalnızca bu projenin başlattığı PID'leri yönetme; önce nazik kapanış.

### M07 — Orta: sürüm/dokümantasyon ve dağıtım güveni tutarsız

**Kanıt:** `package.json` 1.13.148; `src/services/apiBridge.js` 1.13.122-web; `server.js` getAppVersion 1.13.11-web; `README.md` eski AracTakip/1.0.5 bağlantıları. macOS build ayarlarında `identity: null`, `hardenedRuntime: false`.

Kullanıcı farklı ekranda farklı sürüm görebilir; destek ve güncelleme teşhisi zorlaşır. README güncel kurulum/ortam/ilk yönetici/yedek geri dönüş yönergelerini içermiyor. macOS imzalama ve hardened runtime bu yapılandırmada etkin değil.

**Öneri:** Sürümü tek build kaynağından üret; README ve indirmeleri güncelle; yayın sürecinde imzalama/notarization tasarla. Electron'un güvenlik rehberi güncel framework, navigasyon/IPC gönderen doğrulaması ve harici URL sınırlandırmasını da önerir: [Electron güvenlik rehberi](https://www.electronjs.org/docs/latest/tutorial/security/).

## 5. Bağımlılıklar için ek not

`package.json` içinde `xlsx: ^0.18.5` bulunuyor. Bu seri için SheetJS'nin prototype pollution bildirimi var; risk özellikle güvenilmeyen çalışma kitabı okumalarında değerlendirilmelidir. Sadece export yapılan bir yol için aynı exploit etkisi otomatik varsayılmamalı. İlgili paket/dağıtım ve bütün kullanım yerleri incelenerek desteklenen güvenli dağıtıma geçilmeli. Kaynak: [SheetJS CVE-2023-30533 bildirimi](https://cdn.sheetjs.com/advisories/CVE-2023-30533).

Tam npm audit yapılamadığı için burada yalnızca doğrulanmış bu sürüm aralığı uyarısı veriliyor; tüm bağımlılıklar güvenli veya güvensiz ilan edilmiyor.

## 6. Önerilen düzeltme sırası ve kabul ölçütleri

1. **Yayını engellemesi gereken güvenlik işleri:** sabit DB sırrını değiştir/kaldır; MFA bypass, açık yerel RPC, rol yükseltme, parola reset, dosya ve backup/cron açıklarını kapat. Kabul: anonim veya düşük yetkili çağrıların hiçbir yan etkisi olmadan 401/403 dönmesi.
2. **Tek yetkilendirme modeli:** aktör, rol ve şirket kapsamını web/Electron servislerinde ortaklaştır; genel RPC fallback'ini açık allowlist'e çevir; hassas alan DTO'larını uygula; RLS'i güvenilir kimlikle yeniden kur. Kabul: şirket A kullanıcısı B'nin hiçbir kaydını okuyamaz/değiştiremez; özellik izinleri server'da uygulanır.
3. **Veri güvenilirliği:** tam yedek geri dönüşü, finans transaction'ları, normalize tekillikler, para hassasiyeti. Kabul: örnek şirketin export/import sonrası bütün desteklenen kayıt ve ilişkileri bire bir korunur; başarısız çok adımlı işlem kısmi sonuç bırakmaz.
4. **Akış ve tasarım:** oturum hataları, şirket geçiş yarışları, gerçek PDF tamamlanması, erişilebilir dialog/input, zoom ve çıktı CSS'i. Kabul: masaüstü/mobil, açık/koyu tema, klavye ve uzun rapor senaryoları geçer.
5. **Sürdürülebilirlik:** ortak API/hesaplama kaynakları, bileşen ayrımı, bundle düzenleme, testli CI, imzalı dağıtım ve güncel belgeler.

**Olumlu temel:** Electron'da `contextIsolation: true` / `nodeIntegration: false`, parola hash'leme, bazı transaction'lar, Zod şemaları, ortak bileşenler, lazy sayfalar ve test altyapısı mevcut. Bunlar iyi başlangıçlar; ancak doğrulama/izinlerin bütün giriş noktalarında aynı biçimde uygulanması gerekiyor.
