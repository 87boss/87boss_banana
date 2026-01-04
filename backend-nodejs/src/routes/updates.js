
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// 檢查更新
router.post('/check', async (req, res) => {
    try {
        console.log('[Updater] Checking for updates...');

        // 獲取當前分支
        const { stdout: branchName } = await execPromise('git rev-parse --abbrev-ref HEAD');
        const currentBranch = branchName.trim();

        // Fetch 最新狀態
        await execPromise('git fetch origin');

        // 獲取本地和遠端 hash
        const { stdout: localHash } = await execPromise('git rev-parse HEAD');
        const { stdout: remoteHash } = await execPromise(`git rev-parse origin/${currentBranch}`);

        const hasUpdate = localHash.trim() !== remoteHash.trim();

        res.json({
            success: true,
            data: {
                hasUpdate,
                currentVersion: localHash.trim().substring(0, 7),
                remoteVersion: remoteHash.trim().substring(0, 7)
            }
        });
    } catch (error) {
        console.error('[Updater] Check failed:', error);
        res.status(500).json({ success: false, error: 'Failed to check for updates' });
    }
});

// 執行更新
router.post('/perform', async (req, res) => {
    try {
        console.log('[Updater] Pulling updates...');
        const { stdout, stderr } = await execPromise('git pull');
        console.log('[Updater] Git pull output:', stdout);

        res.json({
            success: true,
            data: {
                message: 'Update successful',
                output: stdout
            }
        });

        // 可選：嘗試重啟後端 (如果是由 process manager 管理)
        // process.exit(0); 
    } catch (error) {
        console.error('[Updater] Update failed:', error);
        res.status(500).json({ success: false, error: 'Update failed', details: error.message });
    }
});

module.exports = router;
