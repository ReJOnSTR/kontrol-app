export const customerDocumentTemplates = [
    {
        id: 'customer_proposal',
        name: 'Fiyat Teklifi / Proforma',
        title: 'FİYAT TEKLİF FORMU',
        category: 'Teklif',
        type: 'proposal',
        description: 'Müşteriye özel hizmet ve ürün kalemlerini içeren detaylı fiyat teklifi.',
        defaultItems: [
            { description: 'Mobil Vinç Kiralama Hizmeti (Operatörlü)', quantity: 1, unit: 'Gün', unitPrice: 15000, total: 15000 },
            { description: 'Nakliye & Mobilizasyon Bedeli', quantity: 1, unit: 'Sefer', unitPrice: 3000, total: 3000 }
        ],
        vatRate: 20,
        terms: `1. Teklifimiz hazırlandığı tarihten itibaren 15 (on beş) takvim günü süreyle geçerlidir.
2. Fiyatlarımıza belirtilen KDV oranı ayrıca ilave edilecektir.
3. Ödeme Şartı: Hizmet bitiminde fatura kesimini takiben 15 gün içinde nakden/havale ile ödenecektir.
4. Çalışma sahasında iş sağlığı ve güvenliği önlemleri ile çalışma izinleri müşteri tarafından sağlanacaktır.
5. Yakıt firmamıza ait olup operatör konaklama/yemek masrafları müşteri tarafından karşılanacaktır.`,
        placeholders: [
            { key: 'proposalNo', label: 'Teklif No', type: 'text', default: () => `TEK-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}` },
            { key: 'proposalDate', label: 'Teklif Tarihi', type: 'date', default: 'today' },
            { key: 'validityDays', label: 'Geçerlilik Süresi', type: 'text', default: '15 Gün' },
            { key: 'preparedBy', label: 'Hazırlayan Yetkili', type: 'text', default: '' },
            { key: 'attentionPerson', label: 'Müşteri İlgilisi / Yetkili', type: 'text', default: '' },
            { key: 'projectSubject', label: 'Proje / İş Konusu', type: 'text', default: 'Vinç ve Ağır Nakliyat Hizmetleri Fiyat Teklifi' },
            { key: 'workLocation', label: 'Hizmet Verilecek Saha / Adres', type: 'text', default: '' }
        ]
    },
    {
        id: 'customer_contract',
        name: 'Hizmet & Kiralama Sözleşmesi',
        title: 'HİZMET VE MAKİNE KİRALAMA SÖZLEŞMESİ',
        category: 'Sözleşme',
        type: 'contract',
        description: 'Müşteri ile firma arasında hizmet ve makine kiralama şartlarını belirleyen resmi sözleşme.',
        articles: [
            {
                title: 'MADDE 1 - TARAFLAR',
                content: `İşbu sözleşme bir tarafta {{companyName}} (Bundan böyle "HİZMET VEREN" olarak anılacaktır) ile diğer tarafta {{customerName}} (Bundan böyle "HİZMET ALAN / MÜŞTERİ" olarak anılacaktır) arasında aşağıda belirtilen şartlar dahilinde tanzim ve imza edilmiştir.`
            },
            {
                title: 'MADDE 2 - SÖZLEŞMENİN KONUSU',
                content: `HİZMET VEREN'in mülkiyetinde veya tasarrufunda bulunan makine/ekipman ve operatörün, HİZMET ALAN'ın belirttiği iş sahasında {{serviceSubject}} işinin gerçekleştirilmesi amacıyla kiralanması ve hizmet verilmesidir.`
            },
            {
                title: 'MADDE 3 - HİZMET YERİ VE SÜRESİ',
                content: `Hizmet yeri: {{workLocation}} adresidir. Sözleşme başlangıç tarihi {{startDate}} olup, bitiş tarihi {{endDate}} olarak kararlaştırılmıştır. Süre uzatımı tarafların yazılı mutabakatı ile mümkündür.`
            },
            {
                title: 'MADDE 4 - SÖZLEŞME BEDELİ VE ÖDEME KOŞULLARI',
                content: `İşbu sözleşme konusu hizmet bedeli toplam {{contractAmount}} ₺ + KDV'dir. Ödemeler {{paymentTerms}} şeklinde yapılacaktır. Geciken ödemelerde yasal gecikme faizi uygulanacaktır.`
            },
            {
                title: 'MADDE 5 - TARAFLARIN YÜKÜMLÜLÜKLERİ VE İSG',
                content: `HİZMET VEREN, makinelerin periyodik kontrollerini ve operatörün SGK/mesleki yeterlilik belgelerini eksiksiz bulunduracaktır. HİZMET ALAN ise çalışma alanının zemin etüdünü ve iş sahası güvenliğini 6331 sayılı İSG Kanunu kapsamında sağlamakla yükümlüdür.`
            },
            {
                title: 'MADDE 6 - YETKİLİ MAHKEME',
                content: `İşbu sözleşmenin uygulanmasından doğabilecek her türlü ihtilafın hallinde {{legalCourts}} Mahkemeleri ve İcra Daireleri yetkilidir.`
            }
        ],
        placeholders: [
            { key: 'contractNo', label: 'Sözleşme No', type: 'text', default: () => `SOZ-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}` },
            { key: 'startDate', label: 'Başlangıç Tarihi', type: 'date', default: 'today' },
            { key: 'endDate', label: 'Bitiş Tarihi', type: 'date', default: 'today+3m' },
            { key: 'serviceSubject', label: 'Hizmetin / Kiralamanın Konusu', type: 'text', default: 'Vinç Operasyon ve Ağır Nakliye Hizmeti' },
            { key: 'workLocation', label: 'İş / Şantiye Adresi', type: 'text', default: '' },
            { key: 'contractAmount', label: 'Sözleşme Bedeli (₺)', type: 'number', default: '0' },
            { key: 'paymentTerms', label: 'Ödeme Koşulları', type: 'text', default: 'Fatura tebliğinden itibaren 30 gün içinde havale/EFT ile' },
            { key: 'legalCourts', label: 'Yetkili Mahkeme / İl', type: 'text', default: 'İstanbul' }
        ]
    },
    {
        id: 'customer_reconciliation',
        name: 'Cari Hesap Mutabakat Mektubu',
        title: 'CARİ HESAP MUTABAKAT MEKTUBU',
        category: 'Mutabakat',
        type: 'reconciliation',
        description: 'Müşteri ile dönem sonu cari hesap bakiye doğrulama ve teyit mektubu.',
        content: `Sayın Yetkili,

Şirketimiz nezdindeki cari hesap kayıtlarımıza göre, {{reconciliationDate}} tarihi itibarıyla şirketiniz cari hesabında:

BAKİYE TUTARI: {{balanceAmount}} ₺ ({{balanceType}})

olarak kayıtlı bulunmaktadır. 

Kayıtlarınızın bu bakiye ile mutabık olup olmadığını aşağıdaki bölümü onaylayıp kaşe ve imzalayarak tarafımıza faks, e-posta veya elden ulaştırmanızı rica ederiz. Belirtilen süre içerisinde itiraz edilmemesi halinde TTK hükümleri gereğince bakiyenin tarafınızca kabul edilmiş sayılacağını bilgilerinize sunarız.`,
        placeholders: [
            { key: 'reconciliationDate', label: 'Mutabakat Tarihi', type: 'date', default: 'today' },
            { key: 'balanceAmount', label: 'Bakiye Tutarı (₺)', type: 'text', default: '0,00' },
            { key: 'balanceType', label: 'Bakiye Durumu', type: 'text', default: 'BORÇ (Alacağımız)' },
            { key: 'replyDeadline', label: 'Cevaplama Süresi', type: 'text', default: '7 iş günü' }
        ]
    },
    {
        id: 'customer_delivery',
        name: 'Teslim - Tesellüm Tutanağı',
        title: 'HİZMET VE EKİPMAN TESLİM - TESELLÜM TUTANAĞI',
        category: 'Tutanak',
        type: 'delivery',
        description: 'İşin, ekipmanın veya aracın müşteriye eksiksiz teslim edildiğini teyit eden tutanak.',
        content: `Aşağıda dökümü ve nitelikleri belirtilen araç/ekipman ve hizmet, belirtilen iş sahasında kontrol edilmiş; çalışır, eksiksiz ve hasarsız vaziyette HİZMET ALAN firma yetkilisine teslim edilmiş ve teslim alınmıştır.`,
        placeholders: [
            { key: 'deliveryDate', label: 'Teslim Tarihi', type: 'date', default: 'today' },
            { key: 'deliveryTime', label: 'Teslim Saati', type: 'text', default: () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) },
            { key: 'equipmentInfo', label: 'Teslim Edilen Ekipman / Makine', type: 'text', default: 'Mobil Vinç & Çalışma Aparatları' },
            { key: 'serialPlateNo', label: 'Plaka / Seri No', type: 'text', default: '' },
            { key: 'workingHoursKm', label: 'Çalışma Saati / KM Sayacı', type: 'text', default: '' },
            { key: 'deliveryLocation', label: 'Teslim Yeri / Şantiye', type: 'text', default: '' },
            { key: 'deliveredByName', label: 'Teslim Eden Yetkili (Firma)', type: 'text', default: '' },
            { key: 'receivedByName', label: 'Teslim Alan Yetkili (Müşteri)', type: 'text', default: '' },
            { key: 'notes', label: 'Özel Notlar / Ekipman Durumu', type: 'textarea', default: 'Ekipman ve aksesuarları eksiksiz ve çalışır vaziyette teslim edilmiştir.' }
        ]
    },
    {
        id: 'customer_custom',
        name: 'Serbest Müşteri Yazısı / Bildirim',
        title: 'RESMİ BİLDİRİM VE BİLGİLENDİRME YAZISI',
        category: 'Duyuru & Yazışma',
        type: 'custom',
        description: 'Müşteriye hitaben hazırlanacak özel duyuru, fiyat güncelleme veya resmi bildirim yazısı.',
        content: `Sayın {{customerName}} Yetkilisi,

{{customBody}}

Bilgilerinize sunar, çalışmalarınızda başarılar dileriz.`,
        placeholders: [
            { key: 'letterDate', label: 'Yazı Tarihi', type: 'date', default: 'today' },
            { key: 'letterSubject', label: 'Konu', type: 'text', default: 'Hizmet ve Fiyatlandırma Bilgilendirmesi Hk.' },
            { key: 'customBody', label: 'Yazı Metni', type: 'textarea', default: 'Şirketimiz ile yürütmekte olduğunuz iş ortaklığı kapsamında gerekli operasyonel güncellemeler ve planlamalar aşağıda bilgilerinize arz olunur.' }
        ]
    }
]
