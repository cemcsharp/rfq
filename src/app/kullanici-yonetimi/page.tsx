'use client'

import { useState, useEffect } from 'react'
import {
    getPersoneller, getBirimler,
    createPersonel, createBirim,
    updatePersonel, updateBirim,
    deletePersonel, deleteBirim,
    upsertUserAccount, removeUserAccount
} from '@/lib/actions'
import { useNotification } from '@/context/NotificationContext'

type TabType = 'personel' | 'birim'

export default function KullaniciYonetimiPage() {
    const [activeTab, setActiveTab] = useState<TabType>('personel')
    const [data, setData] = useState({
        personeller: [] as any[],
        birimler: [] as any[]
    })
    const [loading, setLoading] = useState(true)
    const { showAlert, showConfirm } = useNotification()

    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [formData, setFormData] = useState<any>({})
    const [settingsSearchTerm, setSettingsSearchTerm] = useState('')
    const [personelBirimFilter, setPersonelBirimFilter] = useState('')
    const [showAccessModal, setShowAccessModal] = useState(false)
    const [accessFormData, setAccessFormData] = useState({ personelId: 0, email: '', password: '', role: 'SATINALMA' })

    const getFilteredData = () => {
        const list = data[activeTab === 'personel' ? 'personeller' : 'birimler'] as any[]

        if (!list) return []
        if (!settingsSearchTerm && !personelBirimFilter) return list

        return list.filter(item => {
            const searchStr = settingsSearchTerm.toLowerCase()
            
            if (activeTab === 'personel') {
                const matchSearch = item.adSoyad.toLowerCase().includes(searchStr) || (item.unvan?.toLowerCase() || '').includes(searchStr)
                const matchBirim = personelBirimFilter ? item.birimId === parseInt(personelBirimFilter) : true
                return matchSearch && matchBirim
            }
            if (activeTab === 'birim') return item.ad.toLowerCase().includes(searchStr)
            return true
        })
    }

    const filteredList = getFilteredData()

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const [p, b] = await Promise.all([
                getPersoneller(), getBirimler()
            ])
            setData({ personeller: p, birimler: b })
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const openModal = (mode: 'create' | 'edit', type: TabType, item?: any) => {
        setModalMode(mode)
        if (mode === 'edit' && item) {
            setEditingId(item.id)
            if (type === 'personel') setFormData({ adSoyad: item.adSoyad, unvan: item.unvan, email: item.email || '', telefon: item.telefon || '', birimId: item.birimId || '', isBirimYoneticisi: item.isBirimYoneticisi || false })
            if (type === 'birim') setFormData({ ad: item.ad, email: item.email || '' })
        } else {
            setEditingId(null)
            if (type === 'personel') setFormData({ adSoyad: '', unvan: '', email: '', telefon: '', birimId: '', isBirimYoneticisi: false })
            if (type === 'birim') setFormData({ ad: '', email: '' })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (modalMode === 'create') {
                if (activeTab === 'personel') await createPersonel(formData.adSoyad, formData.unvan, formData.email, formData.telefon, formData.birimId || undefined, formData.isBirimYoneticisi)
                if (activeTab === 'birim') await createBirim(formData.ad, formData.email)
            } else if (modalMode === 'edit' && editingId) {
                if (activeTab === 'personel') await updatePersonel(editingId, formData.adSoyad, formData.unvan, formData.email, formData.telefon, formData.birimId || undefined, formData.isBirimYoneticisi)
                if (activeTab === 'birim') await updateBirim(editingId, formData.ad, formData.email)
            }
            setShowModal(false)
            fetchData()
            showAlert('Değişiklik kaydedildi.', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const handleDelete = async (id: number) => {
        if (!await showConfirm('Bu kaydı tamamen silmek istediğinize emin misiniz?')) return
        try {
            if (activeTab === 'personel') await deletePersonel(id)
            if (activeTab === 'birim') await deleteBirim(id)
            fetchData()
            showAlert('Kayıt başarıyla silindi.', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const openAccessModal = (personel: any) => {
        setAccessFormData({ 
            personelId: personel.id, 
            email: personel.user?.email || personel.email || '', 
            password: '', 
            role: personel.user?.role || 'SATINALMA' 
        })
        setShowAccessModal(true)
    }

    const handleAccessSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await upsertUserAccount(accessFormData.personelId, accessFormData.email, accessFormData.password, accessFormData.role)
            setShowAccessModal(false)
            fetchData()
            showAlert('Kullanıcı giriş yetkisi kaydedildi.', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const handleRemoveAccess = async (personelId: number) => {
        if (!await showConfirm('Bu personelin sisteme giriş yetkisini iptal etmek istediğinize emin misiniz?')) return
        try {
            await removeUserAccount(personelId)
            fetchData()
            showAlert('Giriş yetkisi kaldırıldı', 'success')
        } catch (err) { showAlert('Hata: ' + (err as Error).message, 'error') }
    }

    const tabs = [
        { id: 'personel', label: 'Ekipler', icon: '👥' },
        { id: 'birim', label: 'Birimler', icon: '🏢' },
    ]

    return (
        <div className="flex flex-col gap-6 animate-in">
            {/* Page Header */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-5">
                <div>
                    <h2 className="text-[15px] font-medium text-slate-800 uppercase tracking-widest">KULLANICI VE DEPARTMAN YÖNETİMİ</h2>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter">Personel Listesi, Erişim Yetkileri ve Birim Düzenlemeleri</p>
                </div>
                <div className="flex items-center gap-4">
                    {activeTab === 'personel' && (
                        <div className="relative w-48">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] opacity-70">🏢</span>
                            <select 
                                className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-lg text-[12px] font-medium outline-none focus:border-slate-400 transition-all appearance-none cursor-pointer text-slate-600"
                                value={personelBirimFilter}
                                onChange={(e) => setPersonelBirimFilter(e.target.value)}
                            >
                                <option value="">[ Tüm Birimler ]</option>
                                {data.birimler.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.ad}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="relative w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Listede ara..."
                            className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-[12px] outline-none focus:border-slate-400 transition-all"
                            value={settingsSearchTerm}
                            onChange={(e) => setSettingsSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => openModal('create', activeTab)}
                        className="bg-slate-800 text-white px-4 py-2 rounded text-[11px] font-bold hover:bg-slate-900 transition-all shadow-md uppercase tracking-widest"
                    >
                        Yeni Kayıt Oluştur
                    </button>
                </div>
            </div>

            {/* TAB Navigation */}
            <div className="flex gap-2 border-b border-slate-100">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`px-4 py-2 rounded text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${activeTab === tab.id
                            ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <span className="text-[12px] opacity-70">{tab.icon}</span>
                        <span className="uppercase tracking-widest">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="premium-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-medium tracking-widest">
                        <tr>
                            {activeTab === 'personel' && (
                                <>
                                    <th className="px-5 py-3 text-slate-500">Ad Soyad</th>
                                    <th className="px-5 py-3 text-slate-500">Ünvan / Pozisyon</th>
                                    <th className="px-5 py-3 text-slate-500">İletişim</th>
                                    <th className="px-5 py-3 text-slate-500">Erişim Durumu</th>
                                </>
                            )}
                            {activeTab === 'birim' && (
                                <>
                                    <th className="px-5 py-3 text-slate-500">Birim Adı</th>
                                    <th className="px-5 py-3 text-slate-500">E-posta</th>
                                </>
                            )}
                            <th className="px-5 py-3 text-right text-slate-500">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-5 py-10 text-center uppercase tracking-widest text-[10px] text-slate-400 font-medium">Veriler İşleniyor...</td></tr>
                        ) : (
                            <>
                                {activeTab === 'personel' && filteredList.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group text-[12px] font-medium text-slate-600">
                                        <td className="px-5 py-3 text-slate-800 uppercase tracking-tighter">{p.adSoyad}</td>
                                        <td className="px-5 py-3 text-slate-400 italic">{p.unvan}</td>
                                        <td className="px-5 py-3 text-[10px] text-slate-500">
                                            {p.email && <div className="truncate max-w-[150px]">📧 {p.email}</div>}
                                            {p.telefon && <div className="mt-0.5">📞 {p.telefon}</div>}
                                            {!p.email && !p.telefon && '-'}
                                        </td>
                                        <td className="px-5 py-3">
                                            {p.birim ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-slate-600 font-medium">{p.birim.ad}</span>
                                                    {p.isBirimYoneticisi && (
                                                        <span className="bg-amber-50 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter w-fit">Yönetici</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 italic">Atanmamış</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            {p.user ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter w-fit text-center">Aktif Erişim</span>
                                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{p.user.role}</span>
                                                </div>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">Erişim Yok</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right opacity-30 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-end gap-3 text-[10px] uppercase font-bold">
                                                <button onClick={() => openAccessModal(p)} className="text-blue-600 hover:text-blue-800 border-b border-blue-100 hover:border-blue-600 pb-0.5 px-1 hover:bg-blue-50 rounded transition-all">Yetki</button>
                                                {p.user && (
                                                    <button onClick={() => handleRemoveAccess(p.id)} className="text-amber-600 hover:text-amber-800 border-b border-amber-100 hover:border-amber-600 pb-0.5 px-1 hover:bg-amber-50 rounded transition-all">Yetkiyi Kes</button>
                                                )}
                                                <button onClick={() => openModal('edit', 'personel', p)} className="text-slate-700 hover:text-slate-950 border-b border-slate-200 hover:border-slate-800 pb-0.5 px-1 hover:bg-slate-50 rounded transition-all">Düzenle</button>
                                                <button onClick={() => handleDelete(p.id)} className="text-rose-600 hover:text-rose-800 border-b border-rose-100 hover:border-rose-600 pb-0.5 px-1 hover:bg-rose-50 rounded transition-all">Sil</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {activeTab === 'birim' && filteredList.map((b: any) => (
                                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group text-[12px] font-medium text-slate-600">
                                        <td className="px-5 py-3 text-slate-800 uppercase tracking-tighter">{b.ad}</td>
                                        <td className="px-5 py-3 text-[10px] text-slate-500">
                                            {b.email ? <div className="truncate max-w-[200px]">📧 {b.email}</div> : '-'}
                                        </td>
                                        <td className="px-5 py-3 text-right opacity-30 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-end gap-3 text-[10px] uppercase font-bold">
                                                <button onClick={() => openModal('edit', 'birim', b)} className="text-slate-700 hover:text-slate-950 border-b border-slate-200 hover:border-slate-800 pb-0.5 px-1 hover:bg-slate-50 rounded transition-all">Düzenle</button>
                                                <button onClick={() => handleDelete(b.id)} className="text-rose-600 hover:text-rose-800 border-b border-rose-100 hover:border-rose-600 pb-0.5 px-1 hover:bg-rose-50 rounded transition-all">Sil</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">
                            {modalMode === 'create' ? 'Yeni Ekle' : 'Düzenle'} - {activeTab === 'personel' ? 'Personel' : 'Birim'}
                            <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-500">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
                            {activeTab === 'personel' && (
                                <>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Ad Soyad</label>
                                        <input required className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.adSoyad} onChange={e => setFormData({ ...formData, adSoyad: e.target.value })} />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Ünvan</label>
                                        <input className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.unvan} onChange={e => setFormData({ ...formData, unvan: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">E-posta</label>
                                            <input type="email" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Telefon</label>
                                            <input type="text" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.telefon} onChange={e => setFormData({ ...formData, telefon: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Bağlı Birim</label>
                                        <select className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.birimId || ''} onChange={e => setFormData({ ...formData, birimId: e.target.value ? parseInt(e.target.value) : '' })}>
                                            <option value="">Seçiniz...</option>
                                            {data.birimler.map((b: any) => (
                                                <option key={b.id} value={b.id}>{b.ad}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 py-2">
                                        <input type="checkbox" id="isBirimYoneticisi" className="w-4 h-4 border-2 border-slate-300 rounded accent-indigo-600" checked={formData.isBirimYoneticisi || false} onChange={e => setFormData({ ...formData, isBirimYoneticisi: e.target.checked })} />
                                        <label htmlFor="isBirimYoneticisi" className="text-[10px] font-medium text-slate-600">Bu personel birim yöneticisidir</label>
                                    </div>
                                </>
                            )}
                            {activeTab === 'birim' && (
                                <>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">İsim / Tanım</label>
                                        <input required className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.ad} onChange={e => setFormData({ ...formData, ad: e.target.value })} />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Birim E-posta</label>
                                        <input required type="email" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="muhasebe@sirket.com" />
                                    </div>
                                </>
                            )}
                            <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button>
                                <button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">
                                    {modalMode === 'create' ? 'Sisteme Kaydet' : 'Senkronize Et'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ACCESS MODAL */}
            {showAccessModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded w-full max-w-sm shadow-xl border border-slate-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t text-[11px] font-medium text-slate-700 uppercase tracking-widest">
                            Giriş Yetkisi Tanımla
                            <button onClick={() => setShowAccessModal(false)} className="text-slate-300 hover:text-slate-500">×</button>
                        </div>
                        <form onSubmit={handleAccessSubmit} className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Kullanıcı E-Posta</label>
                                <input required type="email" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={accessFormData.email} onChange={e => setAccessFormData({ ...accessFormData, email: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Parola</label>
                                <input type="password" placeholder="••••••••" className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={accessFormData.password} onChange={e => setAccessFormData({ ...accessFormData, password: e.target.value })} />
                                <p className="text-[8px] text-slate-400 italic ml-1">* Yeni hesaplar için zorunlu, mevcutlar için şifre değiştirmek istenmiyorsa boş bırakılabilir.</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-medium text-slate-400 uppercase ml-1">Yetki Rolü</label>
                                <select className="bg-white border border-slate-200 p-1.5 rounded text-[11px] font-medium outline-none focus:border-slate-400" value={accessFormData.role} onChange={e => setAccessFormData({ ...accessFormData, role: e.target.value })}>
                                    <option value="SATINALMA">SATINALMA (Standart)</option>
                                    <option value="ADMIN">ADMIN (Tam Yetki)</option>
                                    <option value="BIRIM">BİRİM (Talep Sorumlusu)</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setShowAccessModal(false)} className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase">İptal</button>
                                <button type="submit" className="bg-slate-700 text-white px-5 py-1.5 rounded text-[10px] font-medium hover:bg-slate-800 uppercase tracking-widest">Erişimi Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
