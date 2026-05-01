'use server'

import prisma from '@/lib/prisma'
import { hash } from 'bcryptjs'
import crypto from 'crypto'
import { TedarikciDurum, DavetDurum, Prisma } from '@/generated_lib/client'
import { sendNotificationToRole } from './actions'

// ==========================================
// TEDARİKÇİ KAYIT İŞLEMLERİ
// ==========================================

interface TedarikciKayitInput {
    // Firma Bilgileri
    firmaAdi: string
    vergiNo: string
    vergiDairesi: string
    telefon: string
    adres?: string

    // Yetkili Kişi
    yetkiliAdi: string
    yetkiliEmail: string
    yetkiliTelefon?: string
    yetkiliUnvan?: string
    sifre: string

    // Kategoriler
    kategoriIds: number[]

    // Davet token (varsa)
    davetToken?: string
}

export async function registerTedarikci(input: TedarikciKayitInput) {
    try {
        // E-posta kontrolü
        const existingUser = await prisma.user.findUnique({
            where: { email: input.yetkiliEmail }
        })

        if (existingUser) {
            return { success: false, error: 'Bu e-posta adresi zaten kayıtlı.' }
        }

        // Firma adı kontrolü
        const existingTedarikci = await prisma.tedarikci.findUnique({
            where: { ad: input.firmaAdi }
        })

        if (existingTedarikci) {
            return { success: false, error: 'Bu firma adı zaten kayıtlı.' }
        }

        // Davet kontrolü
        let davet = null
        let autoApprove = false

        if (input.davetToken) {
            davet = await prisma.tedarikciDavet.findUnique({
                where: { token: input.davetToken }
            })

            if (!davet) {
                return { success: false, error: 'Geçersiz davet linki.' }
            }

            if (davet.durum !== DavetDurum.BEKLIYOR) {
                return { success: false, error: 'Bu davet linki zaten kullanılmış veya süresi dolmuş.' }
            }

            if (new Date() > davet.sonKullanmaTarihi) {
                // Davet süresini güncelle
                await prisma.tedarikciDavet.update({
                    where: { id: davet.id },
                    data: { durum: DavetDurum.SURESI_DOLDU }
                })
                return { success: false, error: 'Davet linkinin süresi dolmuş.' }
            }

            autoApprove = true // Davetli kayıtlar otomatik onaylanır
        }

        // Şifre hash
        const hashedPassword = await hash(input.sifre, 12)

        // Kategori kontrolü
        const kategori = input.kategoriIds.length > 0 ? input.kategoriIds[0] : null

        // Transaction ile kayıt
        const result = await prisma.$transaction(async (tx) => {
            // 1. Tedarikçi oluştur
            const tedarikci = await tx.tedarikci.create({
                data: {
                    ad: input.firmaAdi,
                    vergiNo: input.vergiNo,
                    vergiDairesi: input.vergiDairesi,
                    telefon: input.telefon,
                    adres: input.adres,
                    yetkiliKisi: input.yetkiliAdi,
                    email: input.yetkiliEmail,
                    kategoriId: kategori,
                    // Davetli ise kategoriler doğrudan bağlanır
                    ...(autoApprove ? {
                        kategoriler: {
                            connect: input.kategoriIds.map(id => ({ id }))
                        }
                    } : {}),
                    durum: autoApprove ? TedarikciDurum.AKTIF : TedarikciDurum.BEKLIYOR,
                    basvuruTarihi: new Date(),
                    onayTarihi: autoApprove ? new Date() : null,
                    aktif: autoApprove
                }
            })

            // Davetsiz kayıtlarda kategoriler onay sürecine girer
            if (!autoApprove && input.kategoriIds.length > 0) {
                for (const catId of input.kategoriIds) {
                    await tx.tedarikciKategoriOnay.create({
                        data: {
                            tedarikciId: tedarikci.id,
                            kategoriId: catId,
                            durum: 'BEKLIYOR'
                        }
                    })
                }
            }

            // 2. User oluştur
            const user = await tx.user.create({
                data: {
                    name: input.yetkiliAdi,
                    email: input.yetkiliEmail,
                    password: hashedPassword,
                    role: 'TEDARIKCI',
                    tedarikciId: tedarikci.id,
                    isTedarikciAdmin: true // İlk kullanıcı admin olur
                }
            })

            // 3. Davet kullanıldı işaretle
            if (davet) {
                await tx.tedarikciDavet.update({
                    where: { id: davet.id },
                    data: {
                        durum: DavetDurum.KULLANILDI,
                        kullanilanTarih: new Date()
                    }
                })
            }

            return { tedarikci, user }
        })

        return {
            success: true,
            message: autoApprove
                ? 'Kaydınız tamamlandı. Giriş yapabilirsiniz.'
                : 'Başvurunuz alındı. Onay bekliyor.',
            tedarikciId: result.tedarikci.id,
            autoApproved: autoApprove
        }

    } catch (error) {
        console.error('Tedarikçi kayıt hatası:', error)
        return { success: false, error: 'Kayıt sırasında bir hata oluştu.' }
    }
}

// ==========================================
// DAVET İŞLEMLERİ
// ==========================================

export async function checkDavetToken(token: string) {
    try {
        const davet = await prisma.tedarikciDavet.findUnique({
            where: { token }
        })

        if (!davet) {
            return { valid: false, error: 'Geçersiz davet linki.' }
        }

        if (davet.durum !== DavetDurum.BEKLIYOR) {
            return { valid: false, error: 'Bu davet linki zaten kullanılmış.' }
        }

        if (new Date() > davet.sonKullanmaTarihi) {
            return { valid: false, error: 'Davet linkinin süresi dolmuş.' }
        }

        return {
            valid: true,
            email: davet.email,
            firmaAdi: davet.firmaAdi,
            kategoriler: davet.kategoriler as number[] | null
        }
    } catch (error) {
        console.error('Davet kontrol hatası:', error)
        return { valid: false, error: 'Bir hata oluştu.' }
    }
}

export async function createDavet(
    email: string,
    firmaAdi: string | null,
    kategoriIds: number[],
    davetEdenId: string
) {
    try {
        // Mevcut davet kontrolü - varsa iptal et
        await prisma.tedarikciDavet.updateMany({
            where: {
                email,
                durum: DavetDurum.BEKLIYOR
            },
            data: {
                durum: DavetDurum.IPTAL_EDILDI
            }
        })

        // Yeni token oluştur
        const token = crypto.randomBytes(32).toString('hex')

        // 14 gün geçerlilik
        const sonKullanma = new Date()
        sonKullanma.setDate(sonKullanma.getDate() + 14)

        const davet = await prisma.tedarikciDavet.create({
            data: {
                email,
                firmaAdi,
                kategoriler: kategoriIds,
                token,
                davetEdenId,
                sonKullanmaTarihi: sonKullanma
            }
        })

        return { success: true, token: davet.token, davetId: davet.id }
    } catch (error) {
        console.error('Davet oluşturma hatası:', error)
        return { success: false, error: 'Davet oluşturulamadı.' }
    }
}

// ==========================================
// KATEGORİ LİSTESİ
// ==========================================

export async function getTedarikciKategorileri() {
    try {
        const kategoriler = await prisma.tedarikciKategori.findMany({
            where: { aktif: true },
            orderBy: { ad: 'asc' }
        })
        return kategoriler
    } catch (error) {
        console.error('Kategori listeleme hatası:', error)
        return []
    }
}

export async function getSupplierProfile(tedarikciId: number) {
    try {
        const tedarikci = await prisma.tedarikci.findUnique({
            where: { id: tedarikciId },
            include: {
                kategoriler: true,
                kategoriIstekleri: {
                    where: { durum: 'BEKLIYOR' },
                    include: { kategori: true }
                }
            }
        })
        return tedarikci
    } catch (error) {
        console.error('Profil getirme hatası:', error)
        return null
    }
}

export async function updateSupplierCategories(tedarikciId: number, categoryIds: number[]) {
    try {
        // Mevcut onaylanmış kategoriler
        const currentSupplier = await prisma.tedarikci.findUnique({
            where: { id: tedarikciId },
            include: { kategoriler: true }
        })

        if (!currentSupplier) throw new Error('Tedarikçi bulunamadı')

        const currentCategoryIds = currentSupplier.kategoriler.map(k => k.id)

        // 1. Eklenenler (Onay Sürecine Girecek)
        const addedCategoryIds = categoryIds.filter(id => !currentCategoryIds.includes(id))

        // 2. Çıkarılanlar (Varsa İlişki Silinecek)
        const removedCategoryIds = currentCategoryIds.filter(id => !categoryIds.includes(id))

        await prisma.$transaction(async (tx) => {
            // Çıkarılanları sil (Direkt silinir, onay gerekmez)
            if (removedCategoryIds.length > 0) {
                await tx.tedarikci.update({
                    where: { id: tedarikciId },
                    data: {
                        kategoriler: {
                            disconnect: removedCategoryIds.map(id => ({ id }))
                        }
                    }
                })
                // Varsa bekleyen isteği de sil
                await tx.tedarikciKategoriOnay.deleteMany({
                    where: {
                        tedarikciId,
                        kategoriId: { in: removedCategoryIds }
                    }
                })
            }

            // Eklenenler için onay isteği oluştur (Eğer zaten onaylıysa tekrar oluşturma)
            // Zaten onaylı olanlar `addedCategoryIds` içinde olmaz çünkü `currentCategoryIds` ile filtreledik.
            // Ancak daha önce reddedilmiş veya bekleyen bir istek olabilir.
            for (const catId of addedCategoryIds) {
                // Bekleyen istek var mı?
                const existingRequest = await tx.tedarikciKategoriOnay.findUnique({
                    where: {
                        tedarikciId_kategoriId: {
                            tedarikciId,
                            kategoriId: catId
                        }
                    }
                })

                if (existingRequest) {
                    // Eğer reddedilmişse tekrar beklemeye al, bekliyorsa dokunma
                    if (existingRequest.durum === 'REDDEDILDI') {
                        await tx.tedarikciKategoriOnay.update({
                            where: { id: existingRequest.id },
                            data: { durum: 'BEKLIYOR', updatedAt: new Date() }
                        })
                    }
                } else {
                    // Yeni istek oluştur
                    await tx.tedarikciKategoriOnay.create({
                        data: {
                            tedarikciId,
                            kategoriId: catId,
                            durum: 'BEKLIYOR'
                        }
                    })
                }
            }
        })

        return { success: true }
    } catch (error) {
        console.error('Kategori güncelleme hatası:', error)
        return { success: false, error: 'Kategori güncelleme işlemi başarısız.' }
    }
}

// ==========================================
// TEDARİKÇİ BAŞVURU YÖNETİMİ (SATINALMA)
// ==========================================

export async function getBekleyenBasvurular() {
    try {
        const basvurular = await prisma.tedarikci.findMany({
            where: { durum: TedarikciDurum.BEKLIYOR },
            include: {
                kategori: true
            },
            orderBy: { basvuruTarihi: 'desc' }
        })
        return basvurular
    } catch (error) {
        console.error('Başvuru listeleme hatası:', error)
        return []
    }
}

export async function approveTedarikci(tedarikciId: number, onaylayanId: string) {
    try {
        await prisma.tedarikci.update({
            where: { id: tedarikciId },
            data: {
                durum: TedarikciDurum.AKTIF,
                aktif: true,
                onayTarihi: new Date(),
                onaylayanId
            }
        })

        return { success: true }
    } catch (error) {
        console.error('Onay hatası:', error)
        return { success: false, error: 'Onay işlemi başarısız.' }
    }
}

export async function rejectTedarikci(tedarikciId: number, onaylayanId: string) {
    try {
        await prisma.tedarikci.update({
            where: { id: tedarikciId },
            data: {
                durum: TedarikciDurum.REDDEDILDI,
                aktif: false,
                onayTarihi: new Date(),
                onaylayanId
            }
        })

        return { success: true }
    } catch (error) {
        console.error('Ret hatası:', error)
        return { success: false, error: 'Ret işlemi başarısız.' }
    }
}
// ==========================================
// RFQ VE TEKLİF İŞLEMLERİ (TEDARİKÇİ)
// ==========================================

export async function getSupplierRFQs(supplierId: number) {
    try {
        // Tedarikçinin davet edildiği RFQ'ları getir
        const rfqs = await prisma.rFQTedarikci.findMany({
            where: {
                tedarikciId: supplierId,
                rfq: {
                    durum: { in: ['YAYIMLANDI', 'ACIK', 'REVIZE', 'GONDERILDI', 'DEGERLENDIRILME', 'TAMAMLANDI', 'IPTAL'] }
                }
            },
            include: {
                rfq: {
                    include: {
                        kategori: true,
                        teklifler: {
                            where: { tedarikciId: supplierId },
                            orderBy: { olusturmaTarihi: 'desc' },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return JSON.parse(JSON.stringify(rfqs.map(item => ({
            ...item.rfq,
            davetDurumu: item.durum,
            kendiTeklifi: (item.rfq as any).teklifler?.[0] || null
        }))))
    } catch (error) {
        console.error('RFQ listeleme hatası:', error)
        return []
    }
}

export async function getRFQWithOffer(rfqId: number, supplierId: number) {
    try {
        const rfq = await prisma.rFQ.findUnique({
            where: { id: rfqId },
            include: {
                kalemler: {
                    include: {
                        talepKalem: true // urun yok, direkt talepKalem bilgisi yeterli
                    }
                },
                teklifler: {
                    where: { tedarikciId: supplierId },
                    include: {
                        kalemler: true
                    },
                    orderBy: { olusturmaTarihi: 'desc' },
                    take: 1
                }
            }
        })

        if (!rfq) return null

        return JSON.parse(JSON.stringify({
            ...rfq,
            teklif: rfq.teklifler[0] || null
        }))
    } catch (error) {
        console.error('RFQ detay getirme hatası:', error)
        return null
    }
}

interface SupplierOfferInput {
    rfqId: number
    supplierId: number
    teslimSuresi: number
    vadeGun: number
    gecerlilikSuresi: number // Eklendi
    notlar?: string
    kalemler: {
        rfqKalemId: number
        talepKalemId: number
        birimFiyat: number
    }[]
}

export async function submitSupplierOffer(input: SupplierOfferInput) {
    try {
        const rfq = await prisma.rFQ.findUnique({
            where: { id: input.rfqId },
            include: {
                kalemler: true, // Eklendi
                tedarikciler: {
                    where: { tedarikciId: input.supplierId },
                    include: { teklifToken: true }
                }
            }
        })

        if (!rfq) return { success: false, error: 'RFQ bulunamadı.' }
        if (new Date() > rfq.sonTeklifTarihi) return { success: false, error: 'Teklif süresi dolmuş.' }

        const rfqTedarikci = rfq.tedarikciler[0]
        if (!rfqTedarikci) return { success: false, error: 'Bu RFQ için yetkiniz bulunmuyor.' }

        const result = await prisma.$transaction(async (tx) => {
            // Toplam tutar hesapla (miktar * birimFiyat)
            const toplamTutar = input.kalemler.reduce((acc, k) => {
                const rfqKalem = rfq.kalemler.find(rk => rk.id === k.rfqKalemId)
                const miktar = rfqKalem?.miktar || (rfqKalem as any)?.talepKalem?.miktar || 0
                return acc + ((k.birimFiyat || 0) * miktar)
            }, 0)

            // Teklif oluştur
            const teklif = await tx.teklif.create({
                data: {
                    rfqId: input.rfqId,
                    talepId: rfq.kalemler[0]?.talepId || 0,
                    tedarikciId: input.supplierId,
                    tokenId: rfqTedarikci.teklifToken?.id || 1,
                    teslimSuresi: input.teslimSuresi,
                    vadeGun: input.vadeGun,
                    gecerlilikSuresi: input.gecerlilikSuresi, // Eklendi
                    notlar: input.notlar,
                    toplamTutar: new Prisma.Decimal(toplamTutar),
                    durum: 'GÖNDERİLDİ',
                    turNo: rfq.mevcutTur,
                    kalemler: {
                        create: input.kalemler.map(k => ({
                            talepKalemId: k.talepKalemId,
                            rfqKalemId: k.rfqKalemId,
                            birimFiyat: new Prisma.Decimal(k.birimFiyat)
                        }))
                    }
                }
            })

            // RFQTedarikci durumunu güncelle
            await tx.rFQTedarikci.update({
                where: { id: rfqTedarikci.id },
                data: { durum: 'TEKLIF_VERILDI' }
            })

            return teklif
        })

        // Satınalma Ekibine Bildirim Gönder
        await sendNotificationToRole('SATINALMA', {
            title: 'Yeni Teklif Alındı',
            message: `${rfq.rfqNo} nolu RFQ için yeni bir teklif iletildi.`,
            type: 'info',
            link: `/rfq/${rfq.id}`
        })

        return { success: true, teklifId: result.id }
    } catch (error) {
        console.error('Teklif gönderme hatası:', error)
        return { success: false, error: 'Teklif gönderilirken bir hata oluştu.' }
    }
}

export async function getSupplierOffers(supplierId: number) {
    try {
        const teklifler = await prisma.teklif.findMany({
            where: { tedarikciId: supplierId },
            include: {
                rfq: true,
                talep: true
            },
            orderBy: { olusturmaTarihi: 'desc' }
        })
        return JSON.parse(JSON.stringify(teklifler))
    } catch (error) {
        console.error('Teklifleri getirme hatası:', error)
        return []
    }
}

// ==========================================
// SİPARİŞ VE FATURA İŞLEMLERİ (TEDARİKÇİ)
// ==========================================

export async function getSupplierOrders(supplierId: number) {
    try {
        const orders = await prisma.siparis.findMany({
            where: { tedarikciId: supplierId },
            include: {
                talep: true,
                faturalar: true,
                teklifKabul: {
                    select: {
                        paraBirimi: true,
                        toplamTutar: true
                    }
                }
            },
            orderBy: { tarih: 'desc' }
        })
        return JSON.parse(JSON.stringify(orders))
    } catch (error) {
        console.error('Sipariş listeleme hatası:', error)
        return []
    }
}

export async function getSupplierInvoices(supplierId: number) {
    try {
        const invoices = await prisma.fatura.findMany({
            where: {
                siparis: {
                    tedarikciId: supplierId
                }
            },
            include: {
                siparis: {
                    select: {
                        barkod: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        return JSON.parse(JSON.stringify(invoices))
    } catch (error) {
        console.error('Fatura listeleme hatası:', error)
        return []
    }
}

export async function getOrderDetails(orderId: number, supplierId: number) {
    try {
        const order = await prisma.siparis.findUnique({
            where: { id: orderId },
            include: {
                talep: {
                    include: {
                        kalemler: true
                    }
                },
                faturalar: true,
                odemePlani: true,
                teklifKabul: {
                    include: {
                        kalemler: true
                    }
                },
                kalemSecimleri: {
                    include: {
                        rfqKalem: {
                            include: {
                                talepKalem: true
                            }
                        }
                    }
                }
            }
        })

        if (!order || order.tedarikciId !== supplierId) return null
        return JSON.parse(JSON.stringify(order))
    } catch (error) {
        console.error('Sipariş detay getirme hatası:', error)
        return null
    }
}

interface SupplierInvoiceInput {
    siparisId: number
    faturaNo: string
    tutar: number
    vadeTarihi: Date
}

export async function createSupplierInvoice(input: SupplierInvoiceInput) {
    try {
        const fatura = await prisma.fatura.create({
            data: {
                faturaNo: input.faturaNo,
                tutar: new Prisma.Decimal(input.tutar),
                vadeTarihi: input.vadeTarihi,
                siparisId: input.siparisId,
                odemeDurumu: 'ODENMEDI'
            }
        })

        return { success: true, faturaId: fatura.id }
    } catch (error) {
        console.error('Fatura oluşturma hatası:', error)
        // P2002: Unique constraint failed
        if ((error as any).code === 'P2002') {
            return { success: false, error: 'Bu fatura numarası zaten kayıtlı.' }
        }
        return { success: false, error: 'Fatura oluşturulurken bir hata oluştu.' }
    }
}

// ==========================================
// PROFİL VE KULLANICI YÖNETİMİ (TEDARİKÇİ)
// ==========================================

export async function getTedarikciProfile(supplierId: number) {
    try {
        const tedarikci = await prisma.tedarikci.findUnique({
            where: { id: supplierId },
            include: {
                kategori: true
            }
        })
        return tedarikci
    } catch (error) {
        console.error('Profil getirme hatası:', error)
        return null
    }
}

export async function updateTedarikciProfile(supplierId: number, data: any) {
    try {
        await prisma.tedarikci.update({
            where: { id: supplierId },
            data: {
                vergiNo: data.vergiNo,
                vergiDairesi: data.vergiDairesi,
                telefon: data.telefon,
                adres: data.adres,
                yetkiliKisi: data.yetkiliKisi,
                email: data.email
            }
        })
        return { success: true }
    } catch (error) {
        console.error('Profil güncelleme hatası:', error)
        return { success: false, error: 'Profil güncellenirken bir hata oluştu.' }
    }
}

export async function getSupplierUsers(supplierId: number) {
    try {
        const users = await prisma.user.findMany({
            where: { tedarikciId: supplierId },
            orderBy: { createDate: 'desc' }
        })
        return users
    } catch (error) {
        console.error('Kullanıcı listeleme hatası:', error)
        return []
    }
}

export async function createSupplierUser(supplierId: number, data: any) {
    try {
        // E-posta kontrolü
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        })

        if (existingUser) {
            return { success: false, error: 'Bu e-posta adresi zaten kullanımda.' }
        }

        const hashedPassword = await hash(data.password, 12)

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: 'TEDARIKCI',
                tedarikciId: supplierId,
                isTedarikciAdmin: data.isAdmin || false
            }
        })

        return { success: true, userId: user.id }
    } catch (error) {
        console.error('Kullanıcı oluşturma hatası:', error)
        return { success: false, error: 'Kullanıcı oluşturulurken bir hata oluştu.' }
    }
}

// ==========================================
// DASHBOARD İSTATİSTİKLERİ
// ==========================================

export async function getSupplierDashboardStats(supplierId: number) {
    try {
        const [
            aktifRfqCount,
            pendingOffers,
            onayliTeklifler,
            acikSiparisler,
            totalSiparisTutar
        ] = await Promise.all([
            // 1. Aktif RFQ Sayısı (Yayınlanmış ve tedarikçinin davetli olduğu)
            prisma.rFQTedarikci.count({
                where: {
                    tedarikciId: supplierId,
                    rfq: { durum: { in: ['YAYIMLANDI', 'ACIK', 'REVIZE', 'GONDERILDI', 'DEGERLENDIRILME'] } }
                }
            }),
            // 2. Bekleyen Teklifler (Davet edilen ama henüz teklif verilmeyen)
            prisma.rFQTedarikci.count({
                where: {
                    tedarikciId: supplierId,
                    durum: 'BEKLIYOR',
                    rfq: { durum: { in: ['YAYIMLANDI', 'ACIK', 'REVIZE', 'GONDERILDI', 'DEGERLENDIRILME'] } }
                }
            }),
            // 3. Onaylanan Teklifler (Kabul edilenler)
            prisma.teklif.count({
                where: {
                    tedarikciId: supplierId,
                    siparisKabul: { some: {} }
                }
            }),
            // 4. Açık Siparişler (TAMAMLANDI olmayanlar)
            prisma.siparis.count({
                where: {
                    tedarikciId: supplierId,
                    durum: { not: 'TAMAMLANDI' }
                }
            }),
            // 5. Toplam Sipariş Tutarı (Kabul edilen tekliflerin toplamı)
            prisma.teklif.aggregate({
                where: {
                    tedarikciId: supplierId,
                    siparisKabul: { some: {} }
                },
                _sum: {
                    toplamTutar: true
                }
            })
        ])

        return {
            aktifRfqSayisi: aktifRfqCount,
            bekleyenTeklifler: pendingOffers,
            onaylananTeklifler: onayliTeklifler,
            acikSiparisler: acikSiparisler,
            toplamSiparisTutar: Number(totalSiparisTutar._sum?.toplamTutar || 0)
        }
    } catch (error) {
        console.error('Dashboard stats hatası:', error)
        return {
            aktifRfqSayisi: 0,
            bekleyenTeklifler: 0,
            onaylananTeklifler: 0,
            acikSiparisler: 0,
            toplamSiparisTutar: 0
        }
    }
}

export async function getRecentSupplierRFQs(supplierId: number, count: number = 3) {
    try {
        const rfqs = await prisma.rFQTedarikci.findMany({
            where: {
                tedarikciId: supplierId,
                rfq: { durum: { in: ['YAYIMLANDI', 'ACIK', 'REVIZE', 'GONDERILDI', 'DEGERLENDIRILME'] } }
            },
            include: {
                rfq: true
            },
            orderBy: {
                rfq: { sonTeklifTarihi: 'asc' }
            },
            take: count
        })

        return JSON.parse(JSON.stringify(rfqs.map(item => ({
            id: item.rfq.id,
            rfqNo: item.rfq.rfqNo,
            baslik: item.rfq.baslik,
            sonTeklif: item.rfq.sonTeklifTarihi,
            durum: item.rfq.durum === 'YAYIMLANDI' ? 'Açık' : 'Devam Ediyor'
        }))))
    } catch (error) {
        console.error('Son RFQ hatası:', error)
        return []
    }
}
