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
        name: 'Hizmet & Kiralama Sözleşmesi',
        title: 'HİZMET VE MAKİNE KİRALAMA SÖZLEŞMESİ',
        content: `MADDE 1 - TARAFLAR
İşbu sözleşme, bir tarafta {{companyName}} (Bundan böyle "HİZMET VEREN" olarak anılacaktır) ile diğer tarafta {{customerName}} (Bundan böyle "HİZMET ALAN" olarak anılacaktır) arasında akdedilmiştir.

MADDE 2 - SÖZLEŞMENİN KONUSU
HİZMET VEREN'in mülkiyetinde veya tasarrufunda bulunan makine/ekipman ve operatörün, HİZMET ALAN'ın {{workLocation}} adresindeki çalışma sahasında {{serviceSubject}} işinin gerçekleştirilmesi amacıyla kiralanması ve hizmet verilmesidir.

MADDE 3 - SÖZLEŞME SÜRESİ VE BEDELİ
İşbu sözleşme {{startDate}} tarihinde başlayacak olup, {{endDate}} tarihinde sona erecektir. Sözleşme bedeli {{contractAmount}} olarak kararlaştırılmış olup, ödemeler {{paymentTerms}} şeklinde yapılacaktır.

MADDE 4 - TARAFLARIN YÜKÜMLÜLÜKLERİ VE İSG
HİZMET ALAN çalışma alanının zemin etüdünü ve saha güvenliğini 6331 sayılı İSG Kanunu kapsamında sağlamakla yükümlüdür. HİZMET VEREN ise ekipmanların periyodik kontrollerini ve operatör belgelerini eksiksiz bulunduracaktır.

MADDE 5 - YETKİLİ MAHKEME
İşbu sözleşmeden doğabilecek her türlü ihtilafın hallinde {{legalCourts}} Mahkemeleri ve İcra Daireleri yetkilidir.`,
        placeholders: [
            { key: 'companyName', label: 'Hizmet Veren Şirket', source: 'company', keyInComp: 'name' },
            { key: 'customerName', label: 'Müşteri / Hizmet Alan', source: 'customer', keyInCust: 'name' },
            { key: 'contractNo', label: 'Sözleşme No', type: 'text', default: 'SOZ-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900) },
            { key: 'serviceSubject', label: 'Sözleşme Konusu', type: 'text', default: 'Vinç Operasyonu ve Montaj Hizmetleri' },
            { key: 'workLocation', label: 'Şantiye / Çalışma Yeri', type: 'text', default: 'Müşteri Şantiye Sahası' },
            { key: 'startDate', label: 'Başlangıç Tarihi', type: 'date', default: 'today' },
            { key: 'endDate', label: 'Bitiş Tarihi', type: 'date', default: 'today+3m' },
            { key: 'contractAmount', label: 'Sözleşme Bedeli', type: 'text', default: '50.000,00 ₺ + KDV' },
            { key: 'paymentTerms', label: 'Ödeme Koşulları', type: 'text', default: 'Fatura tebliğinden itibaren 30 gün içinde havale/EFT' },
            { key: 'legalCourts', label: 'Yetkili Mahkeme', type: 'text', default: 'İstanbul' }
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
