'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { getTalep, finalizeAttachments } from '@/lib/actions'
import FileUpload from '@/components/FileUpload'
import AttachmentList from '@/components/AttachmentList'
import { useNotification } from '@/context/NotificationContext'

export default function TalepDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { showAlert } = useNotification()
    const [talep, setTalep] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [refreshFiles, setRefreshFiles] = useState(0)

    useEffect(() => {
        if (id) {
            fetchTalep()
        }
    }, [id])

    async function fetchTalep() {
        try {
            const data = await getTalep(parseInt(id))
            if (!data) {
                showAlert('Talep bulunamadı', 'error')
                router.push('/talepler')
                return
            }
            setTalep(data)
        } catch (err) {
            console.error(err)
            showAlert('Talep yüklenirken hata oluştu', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">
                    Talep Verileri Çekiliyor...
                </div>
            </div>
        )
    }

    if (!talep) return null

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button
                            onClick={() => router.push('/talepler')}
                            className="text-slate-400 hover:text-slate-800 transition-colors text-lg"
                        >
                            ←
                        </button>
                        <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">
                            Talep Arşiv Kaydı
                        </h2>
                    </div>
                    <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter italic ml-7">
                        {talep.barkod} - Dijital Dosya Detayı
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded text-[10px] font-bold border uppercase tracking-tighter ${talep.durum === 'TASLAK' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                            talep.durum === 'SIPARISE_DONUSTU' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                'bg-sky-50 text-sky-600 border-sky-100'
                        }`}>
                        {talep.durum.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Discovery Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="premium-card p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kayıt Tarihi</label>
                                <p className="text-sm font-bold text-slate-700">
                                    {new Date(talep.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">İşlem Sahibi</label>
                                <p className="text-sm font-bold text-slate-700 uppercase">{talep.ilgiliKisi?.adSoyad}</p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Konu Başlığı</label>
                            <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{talep.konu}</p>
                        </div>

                        <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Detaylı Gerekçe</label>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                                "{talep.gerekce}"
                            </p>
                        </div>

                        {/* Items Table */}
                        {talep.kalemler && talep.kalemler.length > 0 && (
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Talep Edilen Kalemler</label>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-widest font-bold">
                                            <tr>
                                                <th className="px-4 py-3">#</th>
                                                <th className="px-4 py-3">Açıklama</th>
                                                <th className="px-4 py-3 text-right">Miktar</th>
                                                <th className="px-4 py-3">Birim</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {talep.kalemler.map((kalem: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-400">{idx + 1}</td>
                                                    <td className="px-4 py-3 text-[11px] font-bold text-slate-800 uppercase">{kalem.aciklama}</td>
                                                    <td className="px-4 py-3 text-[11px] font-black text-slate-900 text-right">{kalem.miktar}</td>
                                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">{kalem.birim}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Değerlendirme Modülü */}
                    {talep.siparis && talep.siparis.degerlendirmeFormTipiId && (
                        <div className="premium-card p-6 space-y-4">
                            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                                Tedarikçi Kalite Değerlendirmesi
                            </h3>
                            
                            {talep.siparis.degerlendirmeFormlari && talep.siparis.degerlendirmeFormlari.length > 0 ? (
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Genel Puan</p>
                                        <div className="text-2xl font-black text-slate-800">
                                            {talep.siparis.degerlendirmeFormlari[0].genelPuan.toFixed(2)} <span className="text-sm float-none font-bold text-slate-400">/ 5.00</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase border
                                            ${talep.siparis.degerlendirmeFormlari[0].sonuc === 'ONAYLI' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                              talep.siparis.degerlendirmeFormlari[0].sonuc === 'CALISABILIR' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                              talep.siparis.degerlendirmeFormlari[0].sonuc === 'SARTLI' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                              'bg-rose-50 text-rose-600 border-rose-200'}
                                        `}>
                                            {talep.siparis.degerlendirmeFormlari[0].sonuc}
                                        </span>
                                        <p className="text-[9px] font-bold capitalize text-slate-400 mt-2 text-right">Değerlendiren: {talep.siparis.degerlendirmeFormlari[0].degerlendiren}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-amber-800">Değerlendirme Bekleniyor</p>
                                        <p className="text-[10px] font-semibold text-amber-600 tracking-wide">Sipariş teslim edildi, lütfen tedarikçinin performansını puanlayın.</p>
                                    </div>
                                    {talep.siparis.degerlendirmeToken && !talep.siparis.degerlendirmeToken.kullanildi && (
                                        <button 
                                            onClick={() => window.open(`/degerlendir/${talep.siparis.degerlendirmeToken.token}`, '_blank')}
                                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95"
                                        >
                                            Hemen Puanla
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar - Attachments & Info */}
                <div className="space-y-6">
                    {/* Attachments Card */}
                    <div className="premium-card p-6">
                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
                            Dijital Belgeler
                        </h3>
                        <div className="space-y-4">
                            <AttachmentList relatedEntity="TALEP" entityId={talep.id} refreshTrigger={refreshFiles} />
                            <div className="pt-4 border-t border-slate-100">
                                <FileUpload
                                    relatedEntity="TALEP"
                                    entityId={talep.id}
                                    onSuccess={() => setRefreshFiles(prev => prev + 1)}
                                    label="Yeni Belge Ekle"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Metadata Card */}
                    <div className="premium-card p-6 bg-slate-900 text-white">
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Sistem Bilgileri</h3>
                        <div className="space-y-4 text-[11px]">
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                <span className="text-white/40 uppercase">Referans ID</span>
                                <span className="font-mono">#{talep.id}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                <span className="text-white/40 uppercase">İlgili Birim</span>
                                <span className="font-bold uppercase">{talep.birim?.ad || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/40 uppercase">Son Güncelleme</span>
                                <span>{new Date(talep.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 gap-2">
                        {talep.durum === 'ONAYLANDI' && (
                            <button
                                onClick={() => router.push(`/siparisler/yeni?talepId=${talep.id}`)}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
                            >
                                Sipariş Oluştur
                            </button>
                        )}
                        <button
                            onClick={() => router.push('/talepler')}
                            className="w-full bg-white text-slate-600 border border-slate-200 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-center"
                        >
                            Listeye Dön
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
