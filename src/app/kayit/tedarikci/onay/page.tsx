'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function OnayContent() {
    const searchParams = useSearchParams()
    const autoApproved = searchParams.get('auto') === 'true'

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center">
                    {/* Icon */}
                    <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${autoApproved ? 'from-emerald-500 to-green-600 shadow-lg shadow-emerald-200' : 'from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-purple-200'} rounded-full flex items-center justify-center`}>
                        {autoApproved ? (
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-black mb-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">
                            {autoApproved ? 'Kaydınız Tamamlandı!' : 'Başvurunuz Alındı!'}
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                        {autoApproved ? (
                            <>Kaydınız başarıyla tamamlandı. Artık tedarikçi portalına giriş yapabilirsiniz.</>
                        ) : (
                            <>Başvurunuz satınalma ekibimize iletildi. En kısa sürede değerlendirilerek size e-posta ile bilgi verilecektir.</>
                        )}
                    </p>

                    {/* Info Box */}
                    {!autoApproved && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 text-left">
                            <h3 className="text-[11px] font-bold text-purple-600 mb-3 uppercase tracking-wider">Sonraki Adımlar</h3>
                            <ul className="text-xs text-slate-500 space-y-2">
                                <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">●</span> Başvurunuz 1-2 iş günü içinde değerlendirilecektir.</li>
                                <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">●</span> Onay sonrası giriş bilgileriniz e-posta ile gönderilecektir.</li>
                                <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">●</span> Sorularınız için satinalma@pru.edu.tr adresine yazabilirsiniz.</li>
                            </ul>
                        </div>
                    )}

                    {/* Button */}
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30"
                    >
                        {autoApproved ? 'Giriş Yap →' : 'Giriş Sayfasına Dön →'}
                    </Link>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-400 text-xs mt-6">
                    PRU Satınalma Platformu — Tedarikçi Portalı
                </p>
            </div>
        </div>
    )
}

export default function TedarikciKayitOnayPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        }>
            <OnayContent />
        </Suspense>
    )
}
