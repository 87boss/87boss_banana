import React, { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getAccountInfo } from '../../services/runningHub/api';

interface ApiKeyInputProps {
    onValidated: (apiKey: string) => void;
    initialValue?: string;
}

export function ApiKeyInput({ onValidated, initialValue = '' }: ApiKeyInputProps) {
    const [apiKey, setApiKey] = useState(initialValue);
    const [showKey, setShowKey] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountInfo, setAccountInfo] = useState<any>(null);

    const handleValidate = useCallback(async () => {
        if (!apiKey.trim()) {
            setError('請輸入 API Key');
            return;
        }

        setIsValidating(true);
        setError(null);

        try {
            const info = await getAccountInfo(apiKey.trim());
            setAccountInfo(info);
            onValidated(apiKey.trim());
        } catch (err: any) {
            setError(err.message || 'API Key 驗證失敗');
        } finally {
            setIsValidating(false);
        }
    }, [apiKey, onValidated]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleValidate();
        }
    }, [handleValidate]);

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-gradient-to-br from-[#1a1d24] to-[#13161b] rounded-2xl p-8 shadow-2xl border border-white/10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Key className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">連接 RunningHub</h2>
                    <p className="text-sm text-slate-400">
                        請輸入您的 API Key 以開始使用
                    </p>
                </div>

                {/* Input */}
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="請輸入 API Key"
                            className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            disabled={isValidating}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                            {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success */}
                    {accountInfo && (
                        <div className="flex items-center gap-2 text-emerald-400 text-sm">
                            <CheckCircle size={16} />
                            <span>餘額: {accountInfo.remainCoins} 幣</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleValidate}
                        disabled={isValidating || !apiKey.trim()}
                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isValidating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                驗證中...
                            </>
                        ) : (
                            '連接'
                        )}
                    </button>
                </div>

                {/* Help */}
                <p className="mt-6 text-center text-xs text-slate-500">
                    前往{' '}
                    <a
                        href="https://www.runninghub.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:underline"
                    >
                        RunningHub.cn
                    </a>
                    {' '}取得 API Key
                </p>
            </div>
        </div>
    );
}
