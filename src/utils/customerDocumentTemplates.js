export const DEFAULT_CONTRACT_ANNEX_ITEMS = [
    { id: '1', name: '35 TON HİYAP VİNÇ', dailyPrice: '₺ 15.000,00', monthlyPrice: '₺ 235.000,00' },
    { id: '2', name: '40/45 TON HİYAP VİNÇ', dailyPrice: '₺ 20.000,00', monthlyPrice: '₺ 310.000,00' },
    { id: '3', name: '80 TON HİYAP VİNÇ', dailyPrice: '₺ 35.000,00', monthlyPrice: '₺ 450.000,00' },
    { id: '4', name: '100 TON', dailyPrice: '', monthlyPrice: '₺ 580.000,00' },
    { id: '5', name: '160 TON', dailyPrice: '₺ 75.000,00', monthlyPrice: '' },
    { id: '6', name: '26 METRE PLATFORM', dailyPrice: '₺ 10.000,00', monthlyPrice: '₺ 180.000,00' },
    { id: '7', name: '43 METRE PLATFORM', dailyPrice: '₺ 30.000,00', monthlyPrice: '' },
    { id: '8', name: 'TIR-SAL DORSE', dailyPrice: '', monthlyPrice: '₺ 170.000,00' },
    { id: '9', name: '18.40 MANİTOU', dailyPrice: '', monthlyPrice: '₺ 230.000,00' },
    { id: '10', name: '20 METRE MENLİFT', dailyPrice: '', monthlyPrice: '₺ 80.000,00' },
    { id: '11', name: 'FOKLİFT 3 TON', dailyPrice: '', monthlyPrice: '₺ 45.000,00' },
    { id: '12', name: 'FOKLİFT 5 TON', dailyPrice: '', monthlyPrice: '₺ 75.000,00' },
    { id: '13', name: 'FOKLİFT 7 TON', dailyPrice: '₺ 15.000,00', monthlyPrice: '' },
    { id: '14', name: '12 MT', dailyPrice: '', monthlyPrice: '₺ 15.000,00' },
    { id: '15', name: '14 MT', dailyPrice: '', monthlyPrice: '₺ 18.000,00' },
    { id: '16', name: '16 MT', dailyPrice: '', monthlyPrice: '₺ 20.000,00' },
]

export const DEFAULT_CONTRACT_NOTICE = `Her iki taraf içinde yukarıda belirtilen bilgiler ve tebligat adresleri doğru olarak kabul edilmiştir. Adres değişikliği gerçekleşmesi durumunda taraflar bir haftalık süreçte karşı tarafa, resmi tebligatta bulunmadıkça sözleşmedeki bilgiler doğru olarak kabul edilecektir. Taraflar yazılı tebligatı daha sonra süresi içinde elden teslim yapmak kaydıyla faks veya mail ortamında ve diğer yollarla da bildirimlerde bulunabilirler. Gönderilen bu bilgi, belge ve mail ortamında düzenlenen bu sözleşme ve üzerinde bulunan kaşe ve imzalar tarafları bağlayacak, sorumlu tutacak ve bu belgeler Resmi Evrak olarak kabul edilecektir. Bir haftalık süre içerisinde sözleşmenin aslı kargo veya elden teslim edilecek ve yapılan bu tebligatlarda geçerli sayılacaktır.`

export const DEFAULT_CONTRACT_ARTICLES = [
    { num: 1, text: "Makinanın çalışma süresi sözleşme tarihinden itibaren ( {{rentalDurationMonths}} ) aydır. Aylık çalışma süresine hafta tatilleri dahil olmayıp, bu sözleşmedeki ‘’AY’’ ibaresinden {{monthlyWorkingDays}} Günlük çalışma anlaşılmaktadır." },
    { num: 2, text: "Mazot kiracı firmaya aittir, makina garajdan dolu depo çıkış yapar ve şantiyeden dolu depo ayrılır." },
    { num: 3, text: "Makinanın günlük çalışma saati öğle yemeği hariç ( {{dailyWorkingHours}} ) saattir. Yani {{workingHoursRange}} dır. Bu saatin üzerinde çalışma durumunda günlük ücret baz alınarak mesai ücreti tahakkuk ettirilecektir." },
    { num: 4, text: "Pazar ve fazla mesai saati ücretleri %{{overtimeRate}} fark ile hesaplanacaktır." },
    { num: 5, text: "Kiralayan firmadan kaynaklanan sorunlar dışında, kiracı firma tarafından kaynaklanan sorunlar durumunda (İş vermeme, hava şartları vb. nedenlerden dolayı aracın çalışmaması) ödemede kesinti yapılamaz." },
    { num: 6, text: "Makinanın arıza yapması durumunda ilk 2 (iki) gün makinenin ücretini etkilemez. 2 (iki) günü geçen her gün aylık ücretinden günlük ücreti hesaplanarak kesilir." },
    { num: 7, text: "Operatörün konaklama giderleri (yeme, içme) kiracı firmaya aittir." },
    { num: 8, text: "Makineyi kiralayan firmanın bilgisi olmadan yukarda belirtilen çalışma yeri dışında başka bir yerde çalıştırılamaz ve başka bir yere makine nakledilemez. Çalıştırılmak istenmesi halinde kiralayan firmadan onay almak zorundadır. Aksi halde doğacak tüm zararlardan kiracı firma sorumludur." },
    { num: 9, text: "Makinanın çalışmaya başladığı tarihten itibaren çalışma alanında ve çalışma alanı dışında, iş güvenliğini kiracı firma almak zorundadır. İş kazası sebebiyle doğabilecek her türlü zarardan kiracı firma sorumludur." },
    { num: 10, text: "Makine çalıştırılmadığı zamanlarda kiracı firma makinayı emniyetli ve güvenli bir yerde muhafaza etmekle sorumludur ve bunun için emniyet tedbirlerini almakla yükümlüdür. (Makinanın kiracının kusurundan kaynaklı olarak zarara uğraması halinde kiracı firma, bu zarar miktarını kiralayan firmaya ödemekle yükümlüdür.)" },
    { num: 11, text: "Kiralanan makine, kiracı firma tarafından hiçbir şekilde resmi, özel ve tüzel kişilere teminat gösterilemez, icra ve haciz yaptırılamaz." },
    { num: 12, text: "İş bu sözleşmede kaynaklanan uyuşmazlıklar hakkında {{legalCity}} Mahkemeleri ve icra daireleri yetkilidir. Taraflar HMK’nın 17. Maddesi uyarınca {{legalCity}} Mahkemeleri ve icra dairelerinin münhasıran yetkili olduğunu kabul ve taahhüt ederler." },
    { num: 13, text: "Taraflar işbu sözleşme şartları üzerinde müzakere ettiklerini ve işbu sözleşmeyi basiretli tüccarlar olarak imza altına aldıklarını, ahde vefa ilkesi doğrultusunda hareket ederek sözleşme hükümlerini iyiniyetli olarak ifa edeceklerini karşılıklı olarak kabul ve taahhüt ederler." },
    { num: 14, text: "İş bu sözleşme {{pageCountNote}} ibaret olup 2 suret halinde düzenlenmiştir." }
]

export const customerDocumentTemplates = [
    {
        id: 'customer_proposal',
        name: 'Fiyat Teklifi / Proforma',
        title: 'FİYAT TEKLİF FORMU',
        isProposal: true,
        placeholders: [
            { key: 'customerName', label: 'Müşteri / Firma Adı', source: 'customer', keyInCust: 'name' },
            { key: 'proposalNo', label: 'Teklif No', type: 'text', default: 'TEK-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900) },
            { key: 'proposalDate', label: 'Teklif Tarihi', type: 'date', default: 'today' },
            { key: 'validityDays', label: 'Geçerlilik Süresi', type: 'text', default: '15 Gün' },
            { key: 'attentionPerson', label: 'İlgili Kişi / Yetkili', type: 'text', default: '' },
            { key: 'workLocation', label: 'Çalışma / Şantiye Sahası', type: 'text', default: 'Müşteri Proje Sahası' },
            { key: 'preparedBy', label: 'Hazırlayan Yetkili', type: 'text', source: 'company', keyInComp: 'name' }
        ],
        priceColumns: [
            { id: 'daily', label: 'Günlük Fiyat' },
            { id: 'monthly', label: 'Aylık Fiyat' },
            { id: 'hourly', label: 'Saatlik / Mesai' }
        ],
        defaultShowConditionColumn: false,
        defaultItems: [
            { 
                id: '1', 
                description: '50 Tonluk Teleskopik Mobil Vinç', 
                condition: 'Operatör dahil, yakıt hariç',
                prices: { daily: '25.000 ₺', monthly: '350.000 ₺', hourly: '4.500 ₺ (Min. 4 Saat)' }
            },
            { 
                id: '2', 
                description: 'Sepetli Platform (30 Metre)', 
                condition: 'Operatörlü, tek vardiya',
                prices: { daily: '15.000 ₺', monthly: '220.000 ₺', hourly: '2.500 ₺' }
            },
            { 
                id: '3', 
                description: 'Lowbed Ağır Nakliye Taşıma Hizmeti', 
                condition: 'Gidiş-Dönüş / Sefer başı',
                prices: { daily: '-', monthly: '-', hourly: '12.500 ₺ / Sefer' }
            }
        ],
        defaultVatNote: 'Fiyatlarımıza %20 yasal KDV ayrıca ilave edilecektir.',
        defaultTerms: `1. Belirtilen fiyatlarımıza yasal KDV oranı ayrıca ilave edilecektir.
2. Teklifimiz hazırlandığı tarihten itibaren belirtilen geçerlilik süresince geçerlidir.
3. Çalışma sahasında zemin emniyeti, yük altı güvenliği ve İSG tedbirleri müşteri/işveren sorumluluğundadır.
4. Vinç ve makineler periyodik kontrol belgeli ve operatörler sertifikalıdır.
5. Çalışma saatleri aksi kararlaştırılmadıkça günlük 8 saat üzerinden hesaplanır.`
    },

    {
        id: 'customer_contract',
        name: 'İş Makinası Kira Sözleşmesi',
        title: 'SAK PETROL OTOMATİV LTD. ŞTİ. İŞ MAKİNASI KİRA SÖZLEŞMESİ',
        isContract: true,
        placeholders: [
            { key: 'contractNo', label: 'Sözleşme No', type: 'text', default: 'SOZ-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900) },
            { key: 'startDate', label: 'Sözleşme Başlama Tarihi', type: 'date', default: 'today' },
            { key: 'workStartDate', label: 'İşe Başlama Tarihi', type: 'date', default: 'today' },
            { key: 'workEndDate', label: 'İşi Bitirme Tarihi', type: 'date', default: 'today+3m' },
            { key: 'paymentDays', label: 'Ödeme Vadesi (İş Günü)', type: 'text', default: '20' },
            { key: 'bankIban', label: 'Banka IBAN', type: 'text', default: 'TR68 0001 2001 3860 0010 1005 09' },
            { key: 'bankName', label: 'Banka Adı', type: 'text', default: 'HALK BANKASI' },
            { key: 'rentalDurationMonths', label: 'Çalışma Süresi (Ay)', type: 'text', default: '3' },
            { key: 'monthlyWorkingDays', label: 'Aylık Çalışma Günü', type: 'text', default: '26' },
            { key: 'dailyWorkingHours', label: 'Günlük Çalışma Saati', type: 'text', default: '8' },
            { key: 'workingHoursRange', label: 'Mesai Saatleri', type: 'text', default: '08:00/17:00' },
            { key: 'overtimeRate', label: 'Pazar ve Mesai Farkı (%)', type: 'text', default: '50' },
            { key: 'legalCity', label: 'Yetkili Mahkeme / İl', type: 'text', default: 'SAMSUN' },
            { key: 'companyEmail', label: 'Kiralayan E-Postası', type: 'text', default: 'hasan@sakvinc.com.tr' },
            { key: 'companyPhone', label: 'Kiralayan Telefonu', type: 'text', default: '0 (532) 766 75 85' },
            { key: 'customerPhone', label: 'Kiracı Telefonu', type: 'text', source: 'customer', keyInCust: 'phone' },
            { key: 'customerEmail', label: 'Kiracı E-Postası', type: 'text', source: 'customer', keyInCust: 'email' },
            { key: 'customerTaxOffice', label: 'Kiracı Vergi Dairesi', type: 'text', source: 'customer', keyInCust: 'tax_office' },
            { key: 'customerTaxNumber', label: 'Kiracı Vergi No', type: 'text', source: 'customer', keyInCust: 'tax_number' }
        ]
    },
    {
        id: 'customer_reconciliation',
        name: 'Cari Hesap Mutabakat Mektubu',
        title: 'CARİ HESAP MUTABAKAT MEKTUBU',
        content: `Sayın {{customerName}} Yetkilisi,

Şirketimiz nezdindeki muhasebe kayıtlarına göre, {{reconciliationDate}} tarihi itibarıyla şirketiniz cari hesabında:

BAKİYE TUTARI : {{balanceAmount}}
BAKİYE DURUMU : {{balanceType}}

olarak kayıtlı bulunmaktadır.

Kayıtlarınızın bu bakiye ile mutabık olup olmadığını aşağıdaki bölümü doldurup imza ve kaşeleyerek tarafımıza iletmenizi rica ederiz. Belirtilen yasal süre içerisinde yazılı itiraz yapılmaması halinde bakiyede mutabık kalındığı kabul edilecektir.

[   ] BAKİYEDE MUTABIKIZ
[   ] BAKİYEDE MUTABIK DEĞİLİZ (Fark Açıklaması: .......................................)

Yetkili Kaşe / İmza:`,
        placeholders: [
            { key: 'customerName', label: 'Müşteri Adı', source: 'customer', keyInCust: 'name' },
            { key: 'reconciliationDate', label: 'Mutabakat Tarihi', type: 'date', default: 'today' },
            { key: 'balanceAmount', label: 'Bakiye Tutarı', type: 'text', default: '0,00 ₺' },
            { key: 'balanceType', label: 'Bakiye Durumu', type: 'text', default: 'BORÇ (Alacağımız)' }
        ]
    },
    {
        id: 'customer_delivery',
        name: 'Teslim - Tesellüm Tutanağı',
        title: 'HİZMET VE EKİPMAN TESLİM - TESELLÜM TUTANAĞI',
        content: `{{deliveryDate}} tarihinde, {{customerName}} firmasına ait {{deliveryLocation}} adresindeki çalışma sahasında, aşağıda dökümü ve nitelikleri belirtilen araç/ekipman ve hizmet kontrol edilmiş; çalışır, eksiksiz ve hasarsız vaziyette teslim edilmiş ve teslim alınmıştır.

EKİPMAN VE HİZMET DETAYLARI:
• Ekipman / Makine: {{equipmentInfo}}
• Plaka / Seri No: {{serialPlateNo}}
• Çalışma Saati / KM Sayacı: {{workingHoursKm}}
• Teslim Eden (Firma Yetkilisi): {{deliveredByName}}
• Teslim Alan (Müşteri Yetkilisi): {{receivedByName}}

AÇIKLAMA VE NOTLAR:
{{notes}}`,
        placeholders: [
            { key: 'customerName', label: 'Müşteri Adı', source: 'customer', keyInCust: 'name' },
            { key: 'deliveryDate', label: 'Teslim Tarihi', type: 'date', default: 'today' },
            { key: 'deliveryLocation', label: 'Teslim Yeri / Şantiye', type: 'text', default: 'Müşteri Çalışma Sahası' },
            { key: 'equipmentInfo', label: 'Ekipman / Makine', type: 'text', default: 'Mobil Vinç & Çalışma Aparatları' },
            { key: 'serialPlateNo', label: 'Plaka / Seri No', type: 'text', default: '' },
            { key: 'workingHoursKm', label: 'Çalışma Saati / KM', type: 'text', default: '' },
            { key: 'deliveredByName', label: 'Teslim Eden (Firma)', type: 'text', source: 'company', keyInComp: 'name' },
            { key: 'receivedByName', label: 'Teslim Alan (Müşteri)', type: 'text', default: '' },
            { key: 'notes', label: 'Özel Notlar', type: 'text', default: 'Ekipman ve tüm aksesuarları eksiksiz ve tam çalışır durumda teslim edilmiştir.' }
        ]
    },
    {
        id: 'customer_custom',
        name: 'Serbest Müşteri Yazısı',
        title: 'RESMİ BİLDİRİM VE YAZIŞMA',
        content: `Sayın {{customerName}} Yetkilisi,

KONU: {{letterSubject}}

{{customBody}}

Bilgilerinize sunar, iyi çalışmalar dileriz.`,
        placeholders: [
            { key: 'customerName', label: 'Müşteri Adı', source: 'customer', keyInCust: 'name' },
            { key: 'letterSubject', label: 'Yazı Konusu', type: 'text', default: 'Operasyon ve Hizmet Planlaması Hk.' },
            { key: 'customBody', label: 'Yazı Metni', type: 'text', default: 'Şirketimiz ile yürütmekte olduğunuz iş ortaklığı kapsamında operasyonel planlamalar ve bilgilendirmeler tarafınıza sunulmuştur.' }
        ]
    }
]
