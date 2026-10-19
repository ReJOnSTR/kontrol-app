const Database = require('better-sqlite3');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Resolve SQLite path
function getDefaultSqlitePath() {
    let baseDir;
    if (process.platform === 'darwin') {
        baseDir = path.join(os.homedir(), 'Library', 'Application Support', 'muayen');
    } else if (process.platform === 'win32') {
        baseDir = path.join(process.env.APPDATA, 'muayen');
    } else {
        baseDir = path.join(os.homedir(), '.config', 'muayen');
    }
    return path.join(baseDir, 'data', 'aractakip.db');
}

async function migrate() {
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
        console.error('Hata: Lütfen POSTGRES_URL ortam değişkenini ayarlayın.');
        console.error('Örnek: export POSTGRES_URL=''');
        process.exit(1);
    }

    const sqlitePath = process.argv[2] || getDefaultSqlitePath();
    if (!fs.existsSync(sqlitePath)) {
        console.error(`Hata: SQLite veritabanı dosyası bulunamadı: ${sqlitePath}`);
        console.error('Lütfen geçerli bir SQLite dosya yolunu parametre olarak geçin.');
        process.exit(1);
    }

    console.log(`SQLite Veritabanı: ${sqlitePath}`);
    console.log('PostgreSQL Veritabanına bağlanılıyor...');

    const sqliteDb = new Database(sqlitePath);
    const pgClient = new Client({
        connectionString: postgresUrl,
    });

    try {
        await pgClient.connect();
        console.log('PostgreSQL bağlantısı başarılı.');

        // SQLite'taki tüm kullanıcı tablolarını çekelim
        const tablesQuery = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const tables = tablesQuery.all().map(row => row.name);

        console.log(`Toplam ${tables.length} tablo bulundu. Geçiş başlıyor...`);

        // Yabancı anahtar kısıtlamalarını devre dışı bırakalım
        console.log('Kısıtlamalar geçici olarak devre dışı bırakılıyor...');
        await pgClient.query("SET session_replication_role = 'replica'");

        for (const tableName of tables) {
            console.log(`\n[Tablo] ${tableName} aktarılıyor...`);

            // SQLite'taki kolon bilgilerini al
            const pragma = sqliteDb.pragma(`table_info("${tableName}")`);
            const columns = pragma.map(col => col.name);

            // Tablodaki veriyi çek
            const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all();
            console.log(`  - Okunan satır sayısı: ${rows.length}`);

            if (rows.length > 0) {
                // PostgreSQL'deki eski verileri temizle
                await pgClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

                // Toplu ekleme işlemi
                const colEscaped = columns.map(c => `"${c}"`).join(', ');
                const chunkSize = Math.floor(60000 / columns.length);

                for (let i = 0; i < rows.length; i += chunkSize) {
                    const chunk = rows.slice(i, i + chunkSize);
                    const valuePlaceholders = [];
                    const valueParams = [];

                    chunk.forEach((row, rowIndex) => {
                        const rowPlaceholders = [];
                        columns.forEach((col) => {
                            rowPlaceholders.push(`$${valueParams.length + 1}`);
                            let val = row[col];

                            // Tarih alanlarını javascript Date objesine çevirelim
                            if (
                                col.endsWith('_date') || col === 'date' || 
                                col.endsWith('_at') || col === 'created_at' || 
                                col === 'applied_at' || col === 'gps_date' || 
                                col === 'expiry_date' || col === 'issue_date' || 
                                col.endsWith('_due_date') || col === 'start_date' || 
                                col === 'end_date' || col === 'devir_tarihi' || 
                                col === 'birth_date' || col === 'change_date'
                            ) {
                                if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
                                    val = null;
                                } else {
                                    const parsedDate = new Date(val);
                                    if (!isNaN(parsedDate.getTime())) {
                                        val = parsedDate;
                                    } else {
                                        val = null;
                                    }
                                }
                            }
                            valueParams.push(val === undefined ? null : val);
                        });
                        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
                    });

                    const insertQuery = `INSERT INTO "${tableName}" (${colEscaped}) VALUES ${valuePlaceholders.join(', ')}`;
                    await pgClient.query(insertQuery, valueParams);
                }
                console.log(`  - Başarıyla ${rows.length} satır eklendi.`);
            } else {
                console.log('  - Tablo boş, veri eklenmedi.');
            }

            // Sequence sıfırlama işlemi (otomatik artan kolonlar için)
            const seqQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_default LIKE 'nextval%';
            `;
            const seqRes = await pgClient.query(seqQuery, [tableName]);
            for (const seqRow of seqRes.rows) {
                const colName = seqRow.column_name;
                const resetQuery = `
                    SELECT setval(pg_get_serial_sequence('"${tableName}"', '${colName}'), coalesce(max("${colName}"), 1)) 
                    FROM "${tableName}";
                `;
                await pgClient.query(resetQuery);
                console.log(`  - Sequence sıfırlandı: ${colName}`);
            }
        }

        // Kısıtlamaları geri aktif edelim
        console.log('\nKısıtlamalar geri etkinleştiriliyor...');
        await pgClient.query("SET session_replication_role = 'origin'");

        console.log('\nGeçiş işlemi başarıyla tamamlandı!');
    } catch (err) {
        console.error('\nHata: Geçiş işlemi sırasında bir hata oluştu:', err);
        try {
            await pgClient.query("SET session_replication_role = 'origin'");
        } catch (e) {}
    } finally {
        sqliteDb.close();
        await pgClient.end();
    }
}

migrate();
