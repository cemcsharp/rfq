'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { registerTedarikci, checkDavetToken, getTedarikciKategorileri } from '@/lib/portalActions'

interface Kategori {
    id: number
    ad: string
}

function TedarikciKayitForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const davetToken = searchParams.get('token')

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [kategoriler, setKategoriler] = useState<Kategori[]>([])
    const [davetBilgisi, setDavetBilgisi] = useState<{
        email?: string
        firmaAdi?: string
        kategoriler?: number[]
    } | null>(null)

    const [formData, setFormData] = useState({
        firmaAdi: '',
        vergiNo: '',
        vergiDairesi: '',
        telefon: '',
        adres: '',
        yetkiliAdi: '',
        yetkiliEmail: '',
        yetkiliTelefon: '',
        yetkiliUnvan: '',
        sifre: '',
        sifreTekrar: '',
        kategoriIds: [] as number[]
    })

    useEffect(() => {
        if (davetToken) {
            checkDavetToken(davetToken).then(result => {
                if (result.valid) {
                    setDavetBilgisi({
                        email: result.email,
                        firmaAdi: result.firmaAdi || undefined,
                        kategoriler: result.kategoriler || undefined
                    })
                    setFormData(prev => ({
                        ...prev,
                        yetkiliEmail: result.email || '',
                        firmaAdi: result.firmaAdi || '',
                        kategoriIds: result.kategoriler || []
                    }))
                } else {
                    setError(result.error || 'Geçersiz davet linki')
                }
            })
        }
    }, [davetToken])

    useEffect(() => {
        getTedarikciKategorileri().then(setKategoriler)
    }, [])

    const handleNext = () => {
        setError('')
        if (step === 1) {
            if (!formData.firmaAdi || !formData.vergiNo || !formData.vergiDairesi || !formData.telefon) {
                setError('Lütfen zorunlu alanları doldurunuz.')
                return
            }
        }
        if (step === 2) {
            if (!formData.yetkiliAdi || !formData.yetkiliEmail || !formData.sifre) {
                setError('Lütfen zorunlu alanları doldurunuz.')
                return
            }
            if (formData.sifre.length < 6) {
                setError('Şifre en az 6 karakter olmalıdır.')
                return
            }
            if (formData.sifre !== formData.sifreTekrar) {
                setError('Şifreler eşleşmiyor.')
                return
            }
        }
        setStep(step + 1)
    }

    const handleBack = () => {
        setStep(step - 1)
        setError('')
    }

    const handleSubmit = async () => {
        if (formData.kategoriIds.length === 0) {
            setError('En az bir kategori seçmelisiniz.')
            return
        }
        setLoading(true)
        setError('')
        const result = await registerTedarikci({
            ...formData,
            davetToken: davetToken || undefined
        })
        setLoading(false)
        if (result.success) {
            router.push(`/kayit/tedarikci/onay?auto=${result.autoApproved}`)
        } else {
            setError(result.error || 'Kayıt başarısız.')
        }
    }

    const toggleKategori = (id: number) => {
        setFormData(prev => ({
            ...prev,
            kategoriIds: prev.kategoriIds.includes(id)
                ? prev.kategoriIds.filter(k => k !== id)
                : [...prev.kategoriIds, id]
        }))
    }

    const stepLabels = ['Firma Bilgileri', 'Yetkili Kişi', 'Kategoriler']

    return (
        <div className="min-h-screen flex">
            {/* Sol Taraf - Bilgi Paneli */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-12 flex-col justify-between relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-16">
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <span className="text-white font-black text-lg tracking-tight">PRU</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-indigo-300">PRU</span>
                                <span className="text-white/90"> Satınalma</span>
                            </h1>
                            <p className="text-white/40 text-xs font-medium tracking-wide">Tedarikçi Portalı Kayıt</p>
                        </div>
                    </div>

                    <div className="mb-12">
                        <h2 className="text-4xl font-black text-white leading-tight mb-4">
                            Tedarikçi Ağımıza<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Katılın</span>
                        </h2>
                        <p className="text-white/60 text-sm leading-relaxed max-w-md">
                            PRU Satınalma platformuna kayıt olarak, teklif isteklerini alabilir, 
                            siparişlerinizi takip edebilir ve tüm süreçlerinizi dijital ortamda yönetebilirsiniz.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { icon: '📨', title: 'RFQ & Teklif Verme', desc: 'Teklif isteklerini anında alın ve online teklif verin' },
                            { icon: '📦', title: 'Sipariş Takibi', desc: 'Kazandığınız siparişleri ve teslimatları takip edin' },
                            { icon: '💰', title: 'Fatura Yönetimi', desc: 'Faturalarınızı dijital ortamda oluşturun ve takip edin' },
                            { icon: '📊', title: 'Performans Analizi', desc: 'Değerlendirme puanlarınızı ve istatistiklerinizi görün' },
                        ].map((item, idx) => (
                            <div key={idx} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl">{item.icon}</div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">{item.title}</h3>
                                        <p className="text-white/40 text-[11px] leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-white/30 text-xs">
                    <span>© 2026 PRU - Satınalma Platformu</span>
                    <span>v2.0 Enterprise</span>
                </div>
            </div>

            {/* Sağ Taraf - Kayıt Formu */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 p-6 overflow-y-auto">
                <div className="w-full max-w-lg">
                    {/* Mobil Logo */}
                    <div className="lg:hidden text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                            <span className="text-white font-black text-lg">PRU</span>
                        </div>
                        <h1 className="text-xl font-bold">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">PRU</span>
                            <span className="text-slate-800"> Tedarikçi Kayıt</span>
                        </h1>
                    </div>

                    {/* Davet Badge */}
                    {davetBilgisi && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
                            <span className="text-emerald-600 text-lg">✓</span>
                            <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Davetli Kayıt — Otomatik Onay</span>
                        </div>
                    )}

                    {/* Progress Steps */}
                    <div className="flex items-center justify-between mb-8 px-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= s
                                        ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-slate-200 text-slate-400'
                                        }`}>
                                        {step > s ? '✓' : s}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${step >= s ? 'text-purple-600' : 'text-slate-400'}`}>
                                        {stepLabels[s - 1]}
                                    </span>
                                </div>
                                {s < 3 && (
                                    <div className={`flex-1 h-0.5 mx-3 rounded ${step > s ? 'bg-purple-500' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Form Card */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                        {error && (
                            <div className="bg-rose-50 text-rose-600 text-[12px] p-4 rounded-xl font-medium border border-rose-100 text-center flex items-center justify-center gap-2 mb-6">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {/* Step 1 */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <div className="mb-6">
                                    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">Firma Bilgileri</h2>
                                    <p className="text-xs text-slate-400 mt-1">Firmanızın resmi ticari bilgilerini giriniz</p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Firma Unvanı *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🏢</span>
                                        <input type="text" value={formData.firmaAdi} onChange={e => setFormData({ ...formData, firmaAdi: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                            placeholder="ABC Elektrik Ltd. Şti." disabled={!!davetBilgisi?.firmaAdi} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Vergi No *</label>
                                        <input type="text" value={formData.vergiNo} onChange={e => setFormData({ ...formData, vergiNo: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-3.5 outline-none transition-all"
                                            placeholder="1234567890" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Vergi Dairesi *</label>
                                        <input type="text" value={formData.vergiDairesi} onChange={e => setFormData({ ...formData, vergiDairesi: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-3.5 outline-none transition-all"
                                            placeholder="Kadıköy" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Telefon *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">📞</span>
                                        <input type="tel" value={formData.telefon} onChange={e => setFormData({ ...formData, telefon: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                            placeholder="0212 xxx xx xx" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Adres</label>
                                    <textarea value={formData.adres} onChange={e => setFormData({ ...formData, adres: e.target.value })} rows={2}
                                        className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-3.5 outline-none transition-all resize-none"
                                        placeholder="Firma adresi..." />
                                </div>
                            </div>
                        )}

                        {/* Step 2 */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <div className="mb-6">
                                    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">Yetkili Kişi Bilgileri</h2>
                                    <p className="text-xs text-slate-400 mt-1">Sisteme giriş yapacak yetkili kişinin bilgileri</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Ad Soyad *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                                            <input type="text" value={formData.yetkiliAdi} onChange={e => setFormData({ ...formData, yetkiliAdi: e.target.value })}
                                                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                                placeholder="Ahmet Yılmaz" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Unvan</label>
                                        <input type="text" value={formData.yetkiliUnvan} onChange={e => setFormData({ ...formData, yetkiliUnvan: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-3.5 outline-none transition-all"
                                            placeholder="Satış Müdürü" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">E-posta *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">📧</span>
                                        <input type="email" value={formData.yetkiliEmail} onChange={e => setFormData({ ...formData, yetkiliEmail: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                            placeholder="yetkili@firma.com" disabled={!!davetBilgisi?.email} />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Telefon</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">📱</span>
                                        <input type="tel" value={formData.yetkiliTelefon} onChange={e => setFormData({ ...formData, yetkiliTelefon: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                            placeholder="0532 xxx xx xx" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Şifre *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
                                            <input type="password" value={formData.sifre} onChange={e => setFormData({ ...formData, sifre: e.target.value })}
                                                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                                placeholder="••••••••" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Şifre Tekrar *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
                                            <input type="password" value={formData.sifreTekrar} onChange={e => setFormData({ ...formData, sifreTekrar: e.target.value })}
                                                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-12 pr-4 py-3.5 outline-none transition-all"
                                                placeholder="••••••••" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3 */}
                        {step === 3 && (
                            <div className="space-y-5">
                                <div className="mb-6">
                                    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">Hizmet Kategorileri</h2>
                                    <p className="text-xs text-slate-400 mt-1">Firmanızın hizmet verdiği kategorileri seçiniz. En az bir kategori seçmelisiniz.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {kategoriler.map(kat => (
                                        <label
                                            key={kat.id}
                                            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${formData.kategoriIds.includes(kat.id)
                                                ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            <input type="checkbox" checked={formData.kategoriIds.includes(kat.id)} onChange={() => toggleKategori(kat.id)} className="sr-only" />
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.kategoriIds.includes(kat.id)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-slate-300'
                                                }`}>
                                                {formData.kategoriIds.includes(kat.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium">{kat.ad}</span>
                                        </label>
                                    ))}
                                </div>

                                {kategoriler.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Kategori yükleniyor...
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                            {step > 1 ? (
                                <button onClick={handleBack}
                                    className="px-6 py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                                    ← Geri
                                </button>
                            ) : (
                                <Link href="/login"
                                    className="px-6 py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                                    ← Giriş Sayfası
                                </Link>
                            )}

                            {step < 3 ? (
                                <button onClick={handleNext}
                                    className="px-8 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30">
                                    Devam →
                                </button>
                            ) : (
                                <button onClick={handleSubmit} disabled={loading}
                                    className="px-8 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Kaydediliyor...
                                        </span>
                                    ) : 'Başvuruyu Gönder'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-4 bg-slate-50 text-slate-400 font-medium">veya</span>
                            </div>
                        </div>
                        <p className="mt-4 text-sm text-slate-600">
                            Zaten hesabınız var mı?{' '}
                            <Link href="/login" className="font-semibold text-purple-600 hover:text-purple-700 transition-colors">
                                Giriş Yapın →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function TedarikciKayitPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500 text-lg font-medium">Yükleniyor...</div>
            </div>
        }>
            <TedarikciKayitForm />
        </Suspense>
    )
}
