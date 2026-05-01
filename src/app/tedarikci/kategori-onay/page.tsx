'use client'

import { useState, useEffect } from 'react'
import { getPendingCategoryRequests, approveCategoryRequest, rejectCategoryRequest } from '@/lib/actions'
import { useNotification } from '@/context/NotificationContext'

export default function CategoryApprovalPage() {
    const { showAlert, showConfirm } = useNotification()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRequests()
    }, [])

    async function loadRequests() {
        setLoading(true)
        try {
            const data = await getPendingCategoryRequests()
            setRequests(data)
        } catch (error) {
            console.error('İstekler yüklenirken hata:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleApprove(id: number) {
        const confirmed = await showConfirm('Bu kategori isteğini onaylamak istediğinize emin misiniz?')
        if (!confirmed) return
        try {
            await approveCategoryRequest(id)
            setRequests(prev => prev.filter(r => r.id !== id))
            showAlert('Kategori başarıyla onaylandı.', 'success')
        } catch (error) {
            showAlert('İşlem başarısız.', 'error')
        }
    }

    async function handleReject(id: number) {
        const confirmed = await showConfirm('Bu isteği reddetmek istediğinize emin misiniz?')
        if (!confirmed) return
        try {
            await rejectCategoryRequest(id)
            setRequests(prev => prev.filter(r => r.id !== id))
            showAlert('İstek reddedildi.', 'warning')
        } catch (error) {
            showAlert('İşlem başarısız.', 'error')
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in">
            {/* Page Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">Kategori Onay Yönetimi</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter italic">Tedarikçi Kategori Talep Süreçleri</p>
                </div>
                <button
                    onClick={loadRequests}
                    disabled={loading}
                    className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded text-[10px] font-medium border border-slate-200 hover:bg-slate-100 uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    {loading ? 'Yenileniyor...' : 'Verileri Yenile'}
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="premium-card p-20 text-center text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] animate-pulse">
                    Veriler Çekiliyor...
                </div>
            ) : requests.length === 0 ? (
                <div className="premium-card p-16 text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bekleyen onay isteği bulunmuyor</p>
                    <p className="text-[9px] text-slate-400 mt-1">Tüm talepler işlenmiş durumda.</p>
                </div>
            ) : (
                <div className="premium-card overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                <th className="px-6 py-4">Tedarikçi</th>
                                <th className="px-6 py-4">Talep Edilen Kategori</th>
                                <th className="px-6 py-4">Talep Tarihi</th>
                                <th className="px-6 py-4 text-right">Aksiyonlar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {requests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                                                {req.tedarikci.ad.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-700 uppercase">{req.tedarikci.ad}</p>
                                                <p className="text-[9px] text-slate-400 font-medium">{req.tedarikci.email || 'E-posta yok'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100 uppercase tracking-tight">
                                            {req.kategori.ad}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1.5 justify-end">
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                className="px-3 py-1 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 shadow-sm transition-all"
                                            >
                                                Onayla
                                            </button>
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                className="px-3 py-1 bg-rose-500 text-white rounded text-[9px] font-bold uppercase tracking-widest hover:bg-rose-600 shadow-sm transition-all"
                                            >
                                                Reddet
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
