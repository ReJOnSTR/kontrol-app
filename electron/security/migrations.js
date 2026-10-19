async function migrateSecurity(prisma, postgres) {
    const run = async () => {
        if (postgres) {
            await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_otp_attempts INTEGER NOT NULL DEFAULT 0');
        } else {
            const columns = await prisma.$queryRawUnsafe('PRAGMA table_info(users)');
            if (columns && columns.length && !columns.some(c => c.name === 'recovery_otp_attempts')) {
                await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN recovery_otp_attempts INTEGER NOT NULL DEFAULT 0');
            }
        }
    };

    try {
        await run();
    } catch (err) {
        // If system call was interrupted (EINTR) or connection dropped, retry once after short delay
        if (/EINTR|interrupted|ECONNRESET|ETIMEDOUT/i.test(err?.message || '')) {
            await new Promise(r => setTimeout(r, 400));
            try {
                await run();
            } catch (retryErr) {
                console.warn('[Security Migration] Secondary retry notice:', retryErr.message);
            }
        } else {
            console.warn('[Security Migration] Column check notice:', err.message);
        }
    }
}

module.exports = { migrateSecurity };
