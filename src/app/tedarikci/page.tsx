'use client'

import { useState, useEffect } from 'react'
import { getTedarikçiler, createTedarikci, updateTedarikci, deleteTedarikci, getTedarikciKategorileri, approveTedarikci, rejectTedarikci } from '@/lib/actions'
import Link from 'next/link'
import { useNotification } from '@/context/NotificationContext'
import { useSession } from 'next-auth/react'

export default function TedarikciPage() {
    const { data: session } = useSession()
    const [tedarikciler, setTedarikciler] = useState<any[]>([])
    const [kategoriler, setKategoriler] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const { showAlert, showConfirm } = useNotification()
    const [editingTedarikci, setEditingTedarikci] = useState<any>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('ALL')
    const [activeTab, setActiveTab] = useState<'APPROVED' | 'PENDING'>('APPROVED')

    const filteredTedarikciler = tedarikciler.filter(t => {
        const matchesSearch =
            t.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.yetkiliKisi && t.yetkiliKisi.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesCategory = categoryFilter === 'ALL' || t.kategoriId?.toString() === categoryFilter

        const matchesTab = activeTab === 'PENDING'
            ? t.durum === 'BEKLIYOR'
            : t.durum === 'AKTIF' || t.durum === 'ONAYLI'

        return matchesSearch && matchesCategory && matchesTab
    })

    const [formData, setFormData] = useState({
        ad: '',
        yetkiliKisi: '',
        telefon: '',
        email: '',
        vergiNo: '',
        vergiDairesi: '',
        adres: '',
        kategoriId: '',
        aktif: true
    })

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [tData, kData] = await Promise.all([getTedarikçiler(), getTedarikciKategorileri()])
            setTedarikciler(tData)
            setKategoriler(kData)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            if (editingTedarikci) {
                await updateTedarikci(editingTedarikci.id, {
                    ...formData,
                    kategoriId: formData.kategoriId ? parseInt(formData.kategoriId) : undefined
                })
            } else {
                await createTedarikci({
                    ...formData,
                    kategoriId: formData.kategoriId ? parseInt(formData.kategoriId) : undefined
                })
            }
            setShowModal(false)
            setFormData({ ad: '', yetkiliKisi: '', telefon: '', email: '', vergiNo: '', vergiDairesi: '', adres: '', kategoriId: '', aktif: true })
            setEditingTedarikci(null)
            fetchData()
        } catch (err) {
            showAlert('Hata: ' + (err as Error).message, 'error')
        }
    }

    async function handleDelete(id: number) {
        const confirmed = await showConfirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')
        if (confirmed) {
            try {
                await deleteTedarikci(id)
                fetchData()
                showAlert('Tedarikçi başarıyla silindi', 'success')
            } catch (err) {
                showAlert('Hata: ' + (err as Error).message, 'error')
            }
        }
    }

    async function handleApprove(id: number) {
        // @ts-ignore
        const userId = session?.user?.id || 'sys-admin'
        try {
            await approveTedarikci(id, userId)
            fetchData()
            showAlert('Tedarikçi başvurusu onaylandı.', 'success')
        } catch (err) {
            showAlert('Onaylama hatası: ' + (err as Error).message, 'error')
        }
    }

    async function handleReject(id: number) {
        const confirmed = await showConfirm('Bu başvuruyu reddetmek istediğinize emin misiniz?')
        if (confirmed) {
            try {
                await rejectTedarikci(id)
                fetchData()
                showAlert('Başvuru reddedildi.', 'warning')
            } catch (err) {
                showAlert('Hata: ' + (err as Error).message, 'error')
            }
        }
    }

    function openEditModal(t: any) {
        setEditingTedarikci(t)
        setFormData({
            ad: t.ad,
            yetkiliKisi: t.yetkiliKisi || '',
            telefon: t.telefon || '',
            email: t.email || '',
            vergiNo: t.vergiNo || '',
            vergiDairesi: t.vergiDairesi || '',
            adres: t.adres || '',
            kategoriId: t.kategoriId?.toString() || '',
            aktif: t.aktif
        })
        setShowModal(true)
    }

    return (
        <div className="flex flex-col gap-6 animate-in">
            {/* Page Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">Tedarikçi Portföy Yönetimi</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter italic">İş Ortağı Performans ve Veri Havuzu</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-100 p-1 rounded-lg flex mr-4">
                        <button
                            onClick={() => setActiveTab('APPROVED')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'APPROVED' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Tedarikçiler
                        </button>
                        <button
                            onClick={() => setActiveTab('PENDING')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all relative ${activeTab === 'PENDING' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Başvurular
                            {tedarikciler.filter(t => t.durum === 'BEKLIYOR').length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-100"></span>
                            )}
                        </button>
                    </div>
                    <button
                        onClick={() => { setShowModal(true); setEditingTedarikci(null); setFormData({ ad: '', yetkiliKisi: '', telefon: '', email: '', vergiNo: '', vergiDairesi: '', adres: '', kategoriId: '', aktif: true }) }}
                        className="bg-slate-700 text-white px-4 py-1.5 rounded text-[10px] font-medium border border-slate-600 hover:bg-slate-800 uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                        Yeni Tedarikçi Tanımla
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="premium-card p-4 flex flex-wrap items-center gap-4 bg-slate-50/30">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Firma Adı veya Yetkili..."
                        className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded text-[11px] font-medium outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-48">
                    <select
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[10px] font-bold text-slate-600 outline-none cursor-pointer uppercase tracking-widest"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="ALL">TÜM KATEGORİLER</option>
                        {kategoriler.map(k => (
                            <option key={k.id} value={k.id}>{k.ad.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                {(searchTerm || categoryFilter !== 'ALL') && (
                    <button
                        onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); }}
                        className="text-[10px] text-rose-500 font-bold uppercase tracking-widest hover:underline"
                    >
                        Temizle
                    </button>
                )}
            </div>

            {/* Data Table */}
            <div className="premium-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                            <th className="px-6 py-4">Tedarikçi Adı / Yetkili</th>
                            <th className="px-6 py-4">İletişim Kanalı</th>
                            <th className="px-6 py-4">Sipariş</th>
                            <th className="px-6 py-4">Performans</th>
                            <th className="px-6 py-4">Durum / Aktivasyon</th>
                            <th className="px-6 py-4 text-right">Aksiyonlar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] animate-pulse">Veriler Çekiliyor...</td></tr>
                        ) : filteredTedarikciler.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-[10px] uppercase font-medium">Kayıt bulunamadı.</td></tr>
                        ) : filteredTedarikciler.map((t: any) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <Link href={`/tedarikci/${t.id}`} className="text-[11px] font-bold text-slate-700 uppercase hover:text-indigo-600 transition-colors">{t.ad}</Link>
                                        <div className="flex gap-2 items-center mt-0.5">
                                            <span className="text-[9px] text-slate-400 font-medium">{t.yetkiliKisi || '-'}</span>
                                            {t.kategori && (
                                                <span className="text-[8px] bg-slate-50 text-slate-500 px-1 py-0.5 rounded border border-slate-100 uppercase font-bold">{t.kategori.ad}</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-slate-600 lowercase">{t.email || '-'}</span>
                                        <span className="text-[9px] text-slate-400 font-medium">{t.telefon || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-700">{t.siparisSayisi}</span>
                                        <span className="text-[8px] text-slate-400 uppercase font-medium">Sipariş</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {t.degerlendirmeSayisi > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-slate-600" style={{ width: `${(t.ortalamaPuan / 5) * 100}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-700">{t.ortalamaPuan.toFixed(1)}</span>
                                            </div>
                                            <span className="text-[8px] text-slate-400 uppercase font-medium">{t.degerlendirmeSayisi} Değerlendirme</span>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-slate-300 italic uppercase">Veri Yok</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {t.sonuc ? (
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-tighter ${t.sonuc === 'ONAYLI' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                t.sonuc === 'CALISABILIR' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                                                    t.sonuc === 'SARTLI' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-rose-50 text-rose-600 border-rose-100'
                                                }`}>
                                                {t.sonuc}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded text-[8px] font-bold border border-slate-100 bg-slate-50 text-slate-400 uppercase tracking-tighter">İncelendi</span>
                                        )}

                                        <button
                                            onClick={async () => {
                                                await updateTedarikci(t.id, { aktif: !t.aktif });
                                                fetchData();
                                                showAlert(t.aktif ? 'Tedarikçi pasife alındı.' : 'Tedarikçi aktifleştirildi.', 'info');
                                            }}
                                            className={`w-8 h-4 rounded-full relative transition-all ${t.aktif ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${t.aktif ? 'left-4.5' : 'left-0.5'}`}></div>
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1.5 justify-end transition-all">
                                        {t.durum === 'BEKLIYOR' ? (
                                            <>
                                                <button onClick={() => handleApprove(t.id)} className="px-3 py-1 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 shadow-sm" title="Onayla">ONAYLA</button>
                                                <button onClick={() => handleReject(t.id)} className="px-3 py-1 bg-rose-500 text-white rounded text-[9px] font-bold uppercase tracking-widest hover:bg-rose-600 shadow-sm" title="Reddet">REDDET</button>
                                            </>
                                        ) : (
                                            <>
                                                <Link href={`/tedarikci/${t.id}`} className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-all" title="İncele">👁️</Link>
                                                <button onClick={() => openEditModal(t)} className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-all" title="Düzenle">✏️</button>
                                                <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded text-slate-400 hover:text-rose-500 transition-all" title="Sil">🗑️</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* SLIDE-OVER PANEL (CREATE/EDIT) */}
            <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${showModal ? 'visible' : 'invisible'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${showModal ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setShowModal(false)}
                />

                {/* Panel Container */}
                <div className="absolute inset-y-0 right-0 max-w-full flex">
                    <div
                        className={`w-screen max-w-md transform transition-transform duration-300 ease-in-out ${showModal ? 'translate-x-0' : 'translate-x-full'} bg-white shadow-2xl flex flex-col`}
                    >
                        {/* Panel Header */}
                        <div className="bg-slate-800 text-white px-6 py-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest">
                                    {editingTedarikci ? 'Tedarikçi Güncelle' : 'Yeni Tedarikçi'}
                                </h2>
                                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter mt-0.5 italic">Eksiksiz Veri Girişi</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-white opacity-50 hover:opacity-100 transition-opacity"
                            >
                                <span className="text-2xl leading-none">×</span>
                            </button>
                        </div>

                        {/* Panel Body (Form) */}
                        <div className="flex-1 h-0 overflow-y-auto px-6 py-6">
                            <form onSubmit={handleSubmit} id="tedarikci-form" className="flex flex-col gap-6">
                                {/* Segment: Genel Bilgiler */}
                                <div className="flex flex-col gap-4">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Kurumsal Bilgiler</h3>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Firma Ünvanı *</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Tam ticari ünvan..."
                                            className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 transition-all uppercase"
                                            value={formData.ad}
                                            onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Kategori</label>
                                            <select
                                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none cursor-pointer uppercase"
                                                value={formData.kategoriId}
                                                onChange={(e) => setFormData({ ...formData, kategoriId: e.target.value })}
                                            >
                                                <option value="">Seçiniz...</option>
                                                {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Vergi No *</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 transition-all text-center tracking-widest"
                                                value={formData.vergiNo}
                                                onChange={(e) => setFormData({ ...formData, vergiNo: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Vergi Dairesi *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Örn: Kadıköy"
                                            className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 transition-all"
                                            value={formData.vergiDairesi}
                                            onChange={(e) => setFormData({ ...formData, vergiDairesi: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Segment: İletişim */}
                                <div className="flex flex-col gap-4">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">İletişim Kanalları</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Yetkili Kişi</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none transition-all"
                                                value={formData.yetkiliKisi}
                                                onChange={(e) => setFormData({ ...formData, yetkiliKisi: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Telefon</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none transition-all"
                                                value={formData.telefon}
                                                onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Kurumsal Email</label>
                                        <input
                                            type="email"
                                            className="w-full bg-white border border-slate-200 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none transition-all lowercase"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Firma Adresi</label>
                                        <textarea
                                            rows={3}
                                            className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded text-[11px] font-medium text-slate-700 outline-none transition-all resize-none italic"
                                            value={formData.adres}
                                            onChange={(e) => setFormData({ ...formData, adres: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, aktif: !formData.aktif })}
                                            className={`w-10 h-5 rounded-full relative transition-all ${formData.aktif ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.aktif ? 'left-6' : 'left-1'}`}></div>
                                        </button>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Sistem Aktivasyonu</p>
                                            <p className="text-[9px] text-slate-500">Bu ayar kapatılırsa tedarikçi portala giriş yapamaz.</p>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Panel Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-all"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="submit"
                                form="tedarikci-form"
                                className="bg-slate-700 text-white px-6 py-2 rounded text-[10px] font-medium border border-slate-600 hover:bg-slate-800 uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                {editingTedarikci ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
