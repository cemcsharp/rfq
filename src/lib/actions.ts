'use server'

import prisma from './prisma'
import { revalidatePath } from 'next/cache'
import nodemailer from 'nodemailer'
import bcrypt from 'bcryptjs'
import { renderRfqEmail, renderRfqClosedEmail, renderOrderEmail, renderThankYouEmail, renderEvaluationRequestEmail } from '@/components/EmailTemplate'
// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { auth } from '@/auth'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { cwd } from 'process'
import { generateSiparisPdfBuffer } from './pdfGenerator'

// --- HELPER ACTIONS ---

export async function searchGlobal(query: string) {
    if (!query || query.length < 2) return { talepler: [], rfqs: [], siparisler: [], sozlesmeler: [], tedarikciler: [], faturalar: [] }

    const [talepler, rfqs, siparisler, sozlesmeler, tedarikciler, faturalar] = await Promise.all([
        prisma.talep.findMany({
            where: {
                OR: [
                    { barkod: { contains: query, mode: 'insensitive' } },
                    { konu: { contains: query, mode: 'insensitive' } },
                    { gerekce: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: { ilgiliKisi: true },
            take: 5
        }),
        prisma.rFQ.findMany({
            where: {
                OR: [
                    { rfqNo: { contains: query, mode: 'insensitive' } },
                    { baslik: { contains: query, mode: 'insensitive' } },
                    { aciklama: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: { olusturan: true },
            take: 5
        }),
        prisma.siparis.findMany({
            where: {
                OR: [
                    { barkod: { contains: query, mode: 'insensitive' } },
                    { aciklama: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: { talep: true, tedarikci: true },
            take: 5
        }),
        // Sözleşmeler
        prisma.sozlesme.findMany({
            where: {
                OR: [
                    { sozlesmeNo: { contains: query, mode: 'insensitive' } },
                    { dosyaYolu: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: { siparis: { include: { tedarikci: true } } },
            take: 5
        }),
        // Tedarikçiler (Firmalar)
        prisma.tedarikci.findMany({
            where: {
                OR: [
                    { ad: { contains: query, mode: 'insensitive' } },
                    { yetkiliKisi: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                    { vergiNo: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 5
        }),
        // Faturalar (Finansal Kayıtlar)
        prisma.fatura.findMany({
            where: {
                OR: [
                    { faturaNo: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: { siparis: { include: { tedarikci: true } } },
            take: 5
        })
    ])

    return JSON.parse(JSON.stringify({ talepler, rfqs, siparisler, sozlesmeler, tedarikciler, faturalar }))
}

/**
 * Yetki Kontrolü (RBAC)
 * Siber Güvenlik Uzmanı: Sunucu tarafında oturum ve rol doğrulaması zorunludur.
 */
async function checkAuth(roles: string[] = ['ADMIN', 'SATINALMA']) {
    const session = await auth()
    if (!session || !session.user) throw new Error('Oturum açmanız gerekiyor.')

    if (!roles.includes(session.user.role)) throw new Error('Bu işlem için yetkiniz bulunmuyor.')
    return session
}

// --- ATTACHMENT ACTIONS ---

export async function getAttachments(relatedEntity: string, entityId: number) {
    try {
        const files = await prisma.attachment.findMany({
            where: {
                relatedEntity,
                entityId
            },
            orderBy: {
                createDate: 'desc'
            }
        })
        return files
    } catch (error) {
        console.error('getAttachments error:', error)
        return []
    }
}

export async function deleteAttachment(id: number) {
    try {
        const attachment = await prisma.attachment.findUnique({
            where: { id }
        })

        if (!attachment) {
            return { success: false, error: 'Dosya bulunamadı' }
        }

        // Dosyayı sistemden sil
        try {
            const filePath = join(cwd(), 'public', attachment.filePath)
            await unlink(filePath)
        } catch (err) {
            console.error('Dosya silinirken hata (disk):', err)
        }

        // Veritabanından sil
        await prisma.attachment.delete({
            where: { id }
        })

        return { success: true }
    } catch (error) {
        return { success: false, error: 'Dosya silinirken veritabanı hatası' }
    }
}

export async function finalizeAttachments(tempEntity: string, tempId: number, targetEntity: string, targetId: number) {
    try {
        await prisma.attachment.updateMany({
            where: {
                relatedEntity: tempEntity,
                entityId: tempId
            },
            data: {
                relatedEntity: targetEntity,
                entityId: targetId
            }
        })
        return { success: true }
    } catch (error) {
        console.error('finalizeAttachments error:', error)
        return { success: false, error: 'Dosyalar taşınamadı' }
    }
}

// --- DYNAMIC LIST ACTIONS ---

export async function getPersoneller() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const res = await prisma.personel.findMany({
        where: { aktif: true },
        include: { user: true, birim: true },
        orderBy: { adSoyad: 'asc' }
    })
    console.log(`[GET_PERSONELLER] Count: ${res.length}`)
    return res
}

export async function getBirimler() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.birim.findMany({ orderBy: { ad: 'asc' } })
}

export async function getYonetmelikMaddeleri() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.yonetmelik.findMany({ orderBy: { madde: 'asc' } })
}

export async function getAlimYontemleri() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.alimYontemi.findMany({ orderBy: { ad: 'asc' } })
}

// --- TALEP ACTIONS ---

export async function getTalepler(filter?: { sorumluId?: string | null }) {
    const session = await auth()
    if (!session?.user) throw new Error('Oturum bulunamadı')

    const userRole = session.user.role
    const personelId = session.user.personelId

    // ADMIN ve SATINALMA tüm talepleri görür
    if (userRole === 'ADMIN' || userRole === 'SATINALMA') {
        return await prisma.talep.findMany({
            where: filter,
            include: { ilgiliKisi: true, birim: true, sorumlu: true },
            orderBy: { tarih: 'desc' }
        })
    }

    // BIRIM rolü: Sadece kendi biriminin taleplerini görür
    if (userRole === 'BIRIM' && personelId) {
        // Önce personelin birimId'sini bul
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })

        if (personel?.birimId) {
            return await prisma.talep.findMany({
                where: {
                    ...filter,
                    birimId: personel.birimId
                },
                include: { ilgiliKisi: true, birim: true, sorumlu: true },
                orderBy: { tarih: 'desc' }
            })
        }
    }

    // Fallback: Sadece kendi talepleri
    return await prisma.talep.findMany({
        where: {
            ...filter,
            ilgiliKisiId: personelId || 0
        },
        include: { ilgiliKisi: true, birim: true, sorumlu: true },
        orderBy: { tarih: 'desc' }
    })
}

export async function getSatinalmaUsers() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return prisma.user.findMany({
        where: {
            role: { in: ['ADMIN', 'SATINALMA'] }
        },
        select: {
            id: true,
            name: true,
            email: true
        }
    })
}

export async function assignTalep(talepId: number, userId: string | null) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    return prisma.talep.update({
        where: { id: talepId },
        data: { sorumluId: userId }
    })
}

export async function claimTalep(talepId: number) {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Oturum bulunamadı')
    await checkAuth(['ADMIN', 'SATINALMA'])

    return prisma.talep.update({
        where: { id: talepId },
        data: { sorumluId: session.user.id }
    })
}

export async function createTalep(data: {
    ilgiliKisiId: number,
    birimId?: number,
    bildirimEmail?: string,
    barkod: string,
    konu: string,
    gerekce: string,
    kalemler: { aciklama: string, detay?: string, miktar: number, birim: string }[]
}) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const { kalemler, ...talepData } = data
    const talep = await prisma.talep.create({
        data: {
            ...talepData,
            durum: 'TASLAK',
            kalemler: {
                create: kalemler
            }
        },
        include: { kalemler: true, birim: true }
    })

    // Yöneticileri ve Bildirim E-postalarını topla
    const notifyEmails = new Set<string>()
    const notifyUserIds = new Set<string>()

    if (talep.bildirimEmail) notifyEmails.add(talep.bildirimEmail)

    if (talep.birimId) {
        // Birim amirlerini bul
        const yoneticiler = await prisma.personel.findMany({
            where: { birimId: talep.birimId, isBirimYoneticisi: true },
            include: { user: true }
        })
        for (const y of yoneticiler) {
            if (y.email) notifyEmails.add(y.email)
            if (y.user?.email) notifyEmails.add(y.user.email)
            if (y.user?.id) notifyUserIds.add(y.user.id)
        }
    }

    // Uygulama İçi Bildirimleri Gönder (Sadece sistem kullanıcılarına)
    for (const userId of Array.from(notifyUserIds)) {
        await createNotification({
            title: 'Yeni Talep (Onay/İnceleme Bekliyor)',
            message: `${talep.barkod} referanslı ${talep.konu} başlıklı talep oluşturuldu.`,
            type: 'info',
            link: '/talepler',
            userId: userId
        })
    }

    // E-Posta Bildirimlerini Gönder
    if (notifyEmails.size > 0) {
        for (const email of Array.from(notifyEmails)) {
            await sendInternalNotification(
                email,
                `Yeni Talep Oluşturuldu: ${talep.barkod}`,
                `
                <h3>Yeni Talep (Onay/İnceleme Bekliyor)</h3>
                <p><strong>Talep No:</strong> ${talep.barkod}</p>
                <p><strong>Konu:</strong> ${talep.konu}</p>
                <p><strong>Gerekçe:</strong> ${talep.gerekce}</p>
                <p>Birim personeli tarafından oluşturulan talep sisteme kaydedilmiştir, lütfen inceleyiniz.</p>
                `
            )
        }
    }

    revalidatePath('/talepler')
    return JSON.parse(JSON.stringify(talep))
}

export async function updateTalepStatus(id: number, durum: string) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const result = await prisma.$transaction(async (tx) => {
        const talep = await tx.talep.update({
            where: { id },
            data: { durum }
        })
        return talep
    })

    revalidatePath('/talepler')
    return result
}

export async function assignTalepToPersonel(talepId: number, personelId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    // atananPersonel kaldırıldığı için bu fonksiyon artık ilgiliKisi'yi günceller
    const talep = await prisma.talep.update({
        where: { id: talepId },
        data: { ilgiliKisiId: personelId }
    })
    revalidatePath('/talepler')
    return JSON.parse(JSON.stringify(talep))
}

export async function getTalep(id: number) {
    return JSON.parse(JSON.stringify(await prisma.talep.findUnique({
        where: { id },
        include: { 
            ilgiliKisi: true, 
            siparis: {
                include: {
                    degerlendirmeFormlari: {
                        include: { formTipi: true, cevaplar: { include: { soru: { include: { grup: true } } } } }
                    },
                    degerlendirmeToken: true
                }
            }, 
            kalemler: true, 
            birim: true 
        }
    })))
}

export async function updateTalep(id: number, data: {
    ilgiliKisiId?: number,
    konu?: string,
    gerekce?: string,
    barkod?: string,
    kalemler?: { aciklama: string, detay?: string, miktar: number, birim: string }[]
}) {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])

    // İş kuralı: BIRIM rolü sadece TASLAK ve ONAY_BEKLIYOR durumundaki talepleri düzenleyebilir
    if (session.user.role === 'BIRIM') {
        const existingTalep = await prisma.talep.findUnique({ where: { id } })
        if (!existingTalep) throw new Error('Talep bulunamadı.')
        if (!['TASLAK', 'ONAY_BEKLIYOR', 'BEKLEMEDE'].includes(existingTalep.durum)) {
            throw new Error('İşlem görmüş veya onaylanmış talepler üzerinde değişiklik yapılamaz.')
        }
    }

    const { kalemler, ...talepData } = data

    const talep = await prisma.talep.update({
        where: { id },
        data: {
            ...talepData,
            ...(kalemler && {
                kalemler: {
                    deleteMany: {},
                    create: kalemler
                }
            })
        },
        include: { kalemler: true }
    })

    revalidatePath('/talepler')
    return JSON.parse(JSON.stringify(talep))
}

export async function deleteTalep(id: number) {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])

    // İş kuralı: BIRIM rolü sadece TASLAK ve ONAY_BEKLIYOR durumundaki talepleri silebilir
    if (session.user.role === 'BIRIM') {
        const existingTalep = await prisma.talep.findUnique({ where: { id } })
        if (!existingTalep) throw new Error('Talep bulunamadı.')
        if (!['TASLAK', 'ONAY_BEKLIYOR', 'BEKLEMEDE'].includes(existingTalep.durum)) {
            throw new Error('İşlem görmüş veya onaylanmış talepler silinemez.')
        }
    }

    const talep = await prisma.talep.delete({
        where: { id }
    })
    revalidatePath('/talepler')
    return JSON.parse(JSON.stringify(talep))
}

export async function sendRfqEmailToSuppliers(talepId: number, kategoriId: number, sender?: { name: string, email: string, title: string }) {
    const talep = await prisma.talep.findUnique({
        where: { id: talepId },
        include: { kalemler: true }
    })
    const tedarikciler = await prisma.tedarikci.findMany({
        where: {
            kategoriId,
            aktif: true,
            email: { not: null }
        }
    })

    if (!talep) throw new Error('Talep bulunamadı')
    if (tedarikciler.length === 0) throw new Error('Bu kategoride e-posta adresi tanımlı aktif tedarikçi bulunamadı')

    // SMTP Yapılandırması (Önce DB, sonra .env)
    const smtp = await getSMTPConfig()
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass,
        },
    })

    const senderData = sender || {
        name: 'Satinalma Departmanı',
        email: smtp.user || 'noreply@example.com',
        title: 'Kurumsal Tedarik Sistemi'
    }

    // Base URL for portal
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const results = []
    for (const vendor of tedarikciler) {
        // Her tedarikçi için benzersiz token oluştur
        const teklifToken = await createTeklifToken(talepId, vendor.id, 7)
        const portalUrl = `${baseUrl}/teklif/${teklifToken.token}`

        const html = renderRfqEmail(talep, vendor, senderData, portalUrl)
        await transporter.sendMail({
            from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
            to: vendor.email!,
            replyTo: senderData.email,
            subject: `Teklif İstemi (RFQ) - ${talep.barkod} - ${talep.konu}`,
            html
        })

        // Bildirim Gönder (Tedarikçi Kullanıcılarına)
        await sendNotificationToSupplierUsers(vendor.id, {
            title: 'Yeni RFQ Daveti',
            message: `${talep.barkod} nolu talep için teklifiniz bekleniyor.`,
            type: 'info',
            link: `/portal/tedarikci/rfq` // Portal RFQ sayfası
        })

        results.push(vendor.ad)
    }
    return results
}


// --- SIPARIS ACTIONS ---

export async function getSiparisler() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const siparisler = await prisma.siparis.findMany({
        include: {
            talep: { include: { ilgiliKisi: true } },
            birim: true,
            yonetmelik: true,
            alimYontemi: true,
            degerlendirmeFormlari: {
                orderBy: { tarih: 'desc' },
                take: 1
            }
        },
        orderBy: { tarih: 'desc' }
    })

    return JSON.parse(JSON.stringify(siparisler))
}

export async function getSiparis(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const siparis = await prisma.siparis.findUnique({
        where: { id },
        include: {
            talep: { include: { ilgiliKisi: true, kalemler: true, birim: true } },
            birim: true,
            yonetmelik: true,
            alimYontemi: true,
            tedarikci: true,
            faturalar: true,
            sozlesmeler: true,
            odemePlani: true,
            degerlendirmeFormlari: {
                include: { formTipi: true },
                orderBy: { tarih: 'desc' }
            }
        }
    })
    return JSON.parse(JSON.stringify(siparis))
}

export async function createSiparisFromTalep(data: {
    talepId: number,
    barkod: string,
    birimId: number,
    yonetmelikId: number,
    alimYontemiId: number,
    tedarikciId?: number,
    aciklama?: string,
    degerlendirmeFormTipiId?: number
}) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    // 1. Transaction: Sipariş oluştur ve Talebi güncelle
    const result = await prisma.$transaction(async (tx) => {
        const siparis = await tx.siparis.create({
            data: {
                tarih: new Date(),
                barkod: data.barkod,
                aciklama: data.aciklama,
                talepId: data.talepId,
                birimId: data.birimId,
                yonetmelikId: data.yonetmelikId,
                alimYontemiId: data.alimYontemiId,
                tedarikciId: data.tedarikciId,
                degerlendirmeFormTipiId: data.degerlendirmeFormTipiId,
                durum: 'BEKLEMEDE'
            }
        })

        await tx.talep.update({
            where: { id: data.talepId },
            data: { durum: 'SIPARISE_DONUSTU' }
        })

        return siparis
    })

    if (data.tedarikciId) {
        await sendNotificationToSupplierUsers(data.tedarikciId, {
            title: 'Yeni Sipariş Emri',
            message: `${data.barkod} nolu sipariş firmanıza iletildi.`,
            type: 'success',
            link: `/portal/tedarikci/siparisler`
        })
    }

    revalidatePath('/talepler')
    revalidatePath('/siparisler')
    return JSON.parse(JSON.stringify(result))
}

export async function deleteSiparis(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const siparis = await prisma.siparis.delete({
        where: { id }
    })
    revalidatePath('/siparisler')
    return JSON.parse(JSON.stringify(siparis))
}


// --- FINANS ACTIONS ---

export async function getFaturalar() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const faturalar = await prisma.fatura.findMany({
        include: {
            siparis: {
                include: {
                    talep: true,
                    tedarikci: true,
                    odemePlani: true
                }
            }
        },
        orderBy: { vadeTarihi: 'asc' }
    })
    return JSON.parse(JSON.stringify(faturalar))
}

export async function getFatura(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const fatura = await prisma.fatura.findUnique({
        where: { id },
        include: {
            siparis: {
                include: {
                    talep: true,
                    tedarikci: true,
                    odemePlani: true
                }
            }
        }
    })
    return JSON.parse(JSON.stringify(fatura))
}

export async function createFatura(data: {
    siparisId: number,
    faturaNo: string,
    tutar: number,
    vadeTarihi: Date
}) {
    const fatura = await prisma.fatura.create({
        data: {
            ...data,
            odemeDurumu: 'ODENMEDI'
        }
    })
    revalidatePath('/finans')
    return JSON.parse(JSON.stringify(fatura))
}

export async function updateFatura(id: number, data: {
    faturaNo?: string,
    tutar?: number,
    vadeTarihi?: Date,
    odemeDurumu?: string
}) {
    const fatura = await prisma.fatura.update({
        where: { id },
        data
    })
    revalidatePath('/finans')
    return JSON.parse(JSON.stringify(fatura))
}

export async function deleteFatura(id: number) {
    const fatura = await prisma.fatura.delete({
        where: { id }
    })
    revalidatePath('/finans')
    return JSON.parse(JSON.stringify(fatura))
}


// --- SOZLESME ACTIONS ---

export async function getSozlesmeler() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const sozlesmeler = await prisma.sozlesme.findMany({
        include: { siparis: { include: { talep: true, faturalar: true } } },
        orderBy: { bitisTarihi: 'asc' }
    })
    return JSON.parse(JSON.stringify(sozlesmeler))
}

export async function getSozlesme(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const sozlesme = await prisma.sozlesme.findUnique({
        where: { id },
        include: {
            siparis: {
                include: {
                    talep: true,
                    tedarikci: true,
                    faturalar: true
                }
            }
        }
    })
    return JSON.parse(JSON.stringify(sozlesme))
}

export async function createSozlesme(data: {
    siparisId: number,
    sozlesmeNo: string,
    baslangicTarihi: Date,
    bitisTarihi: Date,
    dosyaYolu?: string
}) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const sozlesme = await prisma.sozlesme.create({
        data
    })
    revalidatePath('/sozlesmeler')
    return JSON.parse(JSON.stringify(sozlesme))
}
// --- SETTINGS / DYNAMIC LISTS ACTIONS ---

export async function createPersonel(adSoyad: string, unvan: string, email?: string, telefon?: string, birimId?: number, isBirimYoneticisi?: boolean) {
    await checkAuth(['ADMIN'])
    const res = await prisma.personel.create({ data: { adSoyad, unvan, email, telefon, birimId: birimId || null, isBirimYoneticisi: isBirimYoneticisi || false } })
    revalidatePath('/ayarlar')
    return res
}

export async function updatePersonel(id: number, adSoyad: string, unvan: string, email?: string, telefon?: string, birimId?: number, isBirimYoneticisi?: boolean) {
    await checkAuth(['ADMIN'])
    const res = await prisma.personel.update({
        where: { id },
        data: { adSoyad, unvan, email, telefon, birimId: birimId || null, isBirimYoneticisi: isBirimYoneticisi || false },
        include: { user: true }
    })

    // Bağlı kullanıcı varsa ismini ve emailini de güncelle
    if (res.user) {
        await prisma.user.update({
            where: { id: res.user.id },
            data: {
                name: adSoyad,
                email: email || res.user.email
            }
        })
    }

    revalidatePath('/ayarlar')
    return res
}

export async function deletePersonel(id: number) {
    await checkAuth(['ADMIN'])
    const res = await prisma.personel.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

export async function createBirim(ad: string, email?: string) {
    await checkAuth(['ADMIN'])
    const birim = await prisma.birim.create({
        data: { ad, email }
    })
    revalidatePath('/ayarlar')
    return birim
}

export async function updateBirim(id: number, ad: string, email?: string) {
    await checkAuth(['ADMIN'])
    const birim = await prisma.birim.update({
        where: { id },
        data: { ad, email }
    })
    revalidatePath('/ayarlar')
    return birim
}

export async function deleteBirim(id: number) {
    await checkAuth(['ADMIN'])
    const res = await prisma.birim.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

export async function createYonetmelik(madde: string, aciklama: string) {
    await checkAuth(['ADMIN'])
    const res = await prisma.yonetmelik.create({ data: { madde, aciklama } })
    revalidatePath('/ayarlar')
    return res
}

export async function updateYonetmelik(id: number, madde: string, aciklama: string) {
    const res = await prisma.yonetmelik.update({ where: { id }, data: { madde, aciklama } })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteYonetmelik(id: number) {
    const res = await prisma.yonetmelik.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

export async function createAlimYontemi(ad: string) {
    const res = await prisma.alimYontemi.create({ data: { ad } })
    revalidatePath('/ayarlar')
    return res
}

export async function updateAlimYontemi(id: number, ad: string) {
    const res = await prisma.alimYontemi.update({ where: { id }, data: { ad } })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteAlimYontemi(id: number) {
    const res = await prisma.alimYontemi.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

// --- TEDARİKÇİ ACTIONS ---

export async function getTedarikçiler() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const tedarikciler = await prisma.tedarikci.findMany({
        include: {
            kategori: true,
            kategoriler: true,
            degerlendirmeler: true,
            degerlendirmeFormlari: true,
            siparislar: true
        },
        orderBy: { ad: 'asc' }
    })
    // Ortalama puan hesapla (Profesyonel formlar öncelikli)
    return tedarikciler.map(t => {
        const proFormlar = t.degerlendirmeFormlari
        const basitDegerlendirmeler = t.degerlendirmeler

        let toplamPuan = 0
        let sayi = 0

        if (proFormlar.length > 0) {
            toplamPuan = proFormlar.reduce((acc, f) => acc + f.genelPuan, 0)
            sayi = proFormlar.length
        } else if (basitDegerlendirmeler.length > 0) {
            toplamPuan = basitDegerlendirmeler.reduce((acc, d) => acc + d.genelPuan, 0)
            sayi = basitDegerlendirmeler.length
        }

        const ortalama = sayi > 0 ? toplamPuan / sayi : 0

        return {
            ...t,
            ortalamaPuan: ortalama,
            degerlendirmeSayisi: sayi,
            siparisSayisi: t.siparislar.length,
            sonuc: proFormlar.length > 0 ? proFormlar[0].sonuc : null // En güncel sonuc
        }
    })
}

export async function getTedarikci(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const tedarikci = await prisma.tedarikci.findUnique({
        where: { id },
        include: {
            kategori: true,
            kategoriler: true,
            degerlendirmeFormlari: {
                include: {
                    formTipi: true,
                    cevaplar: { include: { soru: true } }
                },
                orderBy: { tarih: 'desc' }
            },
            degerlendirmeler: {
                include: { siparis: { include: { talep: true } } },
                orderBy: { tarih: 'desc' }
            },
            siparislar: {
                include: { talep: true, faturalar: true, sozlesmeler: true },
                orderBy: { tarih: 'desc' }
            }
        }
    })

    if (!tedarikci) return null

    return {
        ...tedarikci,
        siparislar: tedarikci.siparislar.map(s => ({
            ...s,
            faturalar: s.faturalar.map(f => ({
                ...f,
                tutar: Number(f.tutar)
            }))
        }))
    }
}

export async function createTedarikci(data: {
    ad: string,
    yetkiliKisi?: string,
    telefon?: string,
    email?: string,
    adres?: string,
    vergiNo?: string,
    vergiDairesi?: string,
    kategoriId?: number
}) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const res = await prisma.tedarikci.create({ data })
    revalidatePath('/tedarikci')
    return res
}

export async function updateTedarikci(id: number, data: {
    ad?: string,
    yetkiliKisi?: string,
    telefon?: string,
    email?: string,
    adres?: string,
    vergiNo?: string,
    vergiDairesi?: string,
    aktif?: boolean,
    kategoriId?: number
}) {
    const res = await prisma.tedarikci.update({ where: { id }, data })
    revalidatePath('/tedarikci')
    return res
}

export async function deleteTedarikci(id: number) {
    const res = await prisma.tedarikci.delete({ where: { id } })
    revalidatePath('/tedarikci')
    return res
}

export async function approveTedarikci(id: number, onaylayanId: string) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const res = await prisma.tedarikci.update({
        where: { id },
        data: {
            durum: 'AKTIF',
            aktif: true,
            onayTarihi: new Date(),
            onaylayanId: onaylayanId
        }
    })
    revalidatePath('/tedarikci')
    return res
}

export async function rejectTedarikci(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const res = await prisma.tedarikci.update({
        where: { id },
        data: {
            durum: 'REDDEDILDI',
            aktif: false
        }
    })
    revalidatePath('/tedarikci')
    return res
}

export async function getTedarikcisByKategori(kategoriId: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.tedarikci.findMany({
        where: {
            kategoriId,
            aktif: true
        },
        include: { kategori: true },
        orderBy: { ad: 'asc' }
    })
}

// --- TEDARİKÇİ KATEGORİ ACTIONS ---

export async function getTedarikciKategorileri() {
    return await prisma.tedarikciKategori.findMany({
        where: { aktif: true },
        orderBy: { ad: 'asc' }
    })
}

export async function createTedarikciKategori(ad: string, aciklama?: string) {
    const res = await prisma.tedarikciKategori.create({
        data: { ad, aciklama }
    })
    revalidatePath('/ayarlar')
    return res
}

export async function updateTedarikciKategori(id: number, ad: string, aciklama?: string) {
    const res = await prisma.tedarikciKategori.update({
        where: { id },
        data: { ad, aciklama }
    })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteTedarikciKategori(id: number) {
    return await prisma.tedarikciKategori.delete({ where: { id } })
}

// --- DEĞERLENDİRME ACTIONS ---

export async function createDegerlendirme(data: {
    tedarikciId: number,
    siparisId?: number,
    teslimatPuani: number,
    kalitePuani: number,
    fiyatPuani: number,
    iletisimPuani: number,
    yorum?: string
}) {
    const genelPuan = (data.teslimatPuani + data.kalitePuani + data.fiyatPuani + data.iletisimPuani) / 4
    const res = await prisma.tedarikciDegerlendirme.create({
        data: {
            ...data,
            genelPuan
        }
    })
    revalidatePath('/tedarikci')
    revalidatePath(`/tedarikci/${data.tedarikciId}`)
    return res
}

export async function getDegerlendirmeler(tedarikciId: number) {
    return await prisma.tedarikciDegerlendirme.findMany({
        where: { tedarikciId },
        include: { siparis: { include: { talep: true } } },
        orderBy: { tarih: 'desc' }
    })
}

// --- PROFESYONEL DEĞERLENDİRME SİSTEMİ ACTIONS ---

// Form Tipi CRUD
export async function getDegerlendirmeFormTipleri() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.degerlendirmeFormuTipi.findMany({
        where: { aktif: true },
        include: {
            gruplar: {
                orderBy: { sira: 'asc' },
                include: {
                    sorular: { orderBy: { sira: 'asc' } }
                }
            }
        },
        orderBy: { ad: 'asc' }
    })
}

export async function getDegerlendirmeFormTipi(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.degerlendirmeFormuTipi.findUnique({
        where: { id },
        include: {
            gruplar: {
                orderBy: { sira: 'asc' },
                include: {
                    sorular: { orderBy: { sira: 'asc' } }
                }
            }
        }
    })
}

export async function createDegerlendirmeFormTipi(data: { ad: string, aciklama?: string }) {
    const res = await prisma.degerlendirmeFormuTipi.create({ data })
    revalidatePath('/ayarlar')
    return res
}

export async function updateDegerlendirmeFormTipi(id: number, data: { ad?: string, aciklama?: string, aktif?: boolean }) {
    const res = await prisma.degerlendirmeFormuTipi.update({ where: { id }, data })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteDegerlendirmeFormTipi(id: number) {
    const res = await prisma.degerlendirmeFormuTipi.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

// Grup CRUD
export async function createDegerlendirmeGrubu(data: { formTipiId: number, kod: string, ad: string, agirlik: number, sira?: number }) {
    const res = await prisma.degerlendirmeGrubu.create({ data })
    revalidatePath('/ayarlar')
    return res
}

export async function updateDegerlendirmeGrubu(id: number, data: { kod?: string, ad?: string, agirlik?: number, sira?: number }) {
    const res = await prisma.degerlendirmeGrubu.update({ where: { id }, data })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteDegerlendirmeGrubu(id: number) {
    const res = await prisma.degerlendirmeGrubu.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

// Soru CRUD
export async function createDegerlendirmeSorusu(data: { grupId: number, kod: string, soru: string, sira?: number }) {
    const res = await prisma.degerlendirmeSorusu.create({ data })
    revalidatePath('/ayarlar')
    return res
}

export async function updateDegerlendirmeSorusu(id: number, data: { kod?: string, soru?: string, sira?: number }) {
    const res = await prisma.degerlendirmeSorusu.update({ where: { id }, data })
    revalidatePath('/ayarlar')
    return res
}

export async function deleteDegerlendirmeSorusu(id: number) {
    const res = await prisma.degerlendirmeSorusu.delete({ where: { id } })
    revalidatePath('/ayarlar')
    return res
}

// Profesyonel Değerlendirme Form CRUD
export async function createDegerlendirmeFormu(data: {
    tedarikciId: number,
    formTipiId: number,
    siparisId?: number,
    degerlendiren: string,
    cevaplar: { soruId: number, puan: number, aciklama?: string }[]
}) {
    // Ağırlıklı puan hesaplama
    const formTipi = await prisma.degerlendirmeFormuTipi.findUnique({
        where: { id: data.formTipiId },
        include: { gruplar: { include: { sorular: true } } }
    })

    if (!formTipi) throw new Error('Form tipi bulunamadı')

    let genelPuan = 0
    for (const grup of formTipi.gruplar) {
        const grupSoruIds = grup.sorular.map(s => s.id)
        const grupCevaplar = data.cevaplar.filter(c => grupSoruIds.includes(c.soruId))
        if (grupCevaplar.length > 0) {
            const grupOrtalama = grupCevaplar.reduce((acc, c) => acc + c.puan, 0) / grupCevaplar.length
            genelPuan += grupOrtalama * (grup.agirlik / 100)
        }
    }

    // Sonuç belirleme
    let sonuc = 'YETERSIZ'
    if (genelPuan >= 4.50) sonuc = 'ONAYLI'
    else if (genelPuan >= 3.50) sonuc = 'CALISABILIR'
    else if (genelPuan >= 2.50) sonuc = 'SARTLI'

    const form = await prisma.tedarikciDegerlendirmeFormu.create({
        data: {
            tedarikciId: data.tedarikciId,
            formTipiId: data.formTipiId,
            siparisId: data.siparisId,
            degerlendiren: data.degerlendiren,
            genelPuan: Math.round(genelPuan * 100) / 100,
            sonuc,
            cevaplar: {
                create: data.cevaplar.map(c => ({
                    soruId: c.soruId,
                    puan: c.puan,
                    aciklama: c.aciklama
                }))
            }
        }
    })

    revalidatePath('/tedarikci')
    return form
}

export async function getTumDegerlendirmeler() {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    
    let whereClause = {}
    if (session.user.role === 'BIRIM' && session.user.personelId) {
        whereClause = {
            siparis: {
                talep: {
                    ilgiliKisiId: session.user.personelId
                }
            }
        }
    }

    return await prisma.tedarikciDegerlendirmeFormu.findMany({
        where: whereClause,
        include: {
            tedarikci: true,
            siparis: { include: { talep: true } },
            formTipi: true
        },
        orderBy: { tarih: 'desc' }
    })
}

export async function getTedarikciDegerlendirmeFormlari(tedarikciId: number) {
    return await prisma.tedarikciDegerlendirmeFormu.findMany({
        where: { tedarikciId },
        include: {
            formTipi: true,
            siparis: { include: { talep: true } },
            cevaplar: { include: { soru: { include: { grup: true } } } }
        },
        orderBy: { tarih: 'desc' }
    })
}

export async function updateSiparisDurum(id: number, durum: string) {
    // 1. Veritabanı İşlemleri (Transaction)
    const fullSiparis = await prisma.$transaction(async (tx) => {
        await tx.siparis.update({
            where: { id },
            data: { durum }
        })

        // Otomasyon: Sipariş TAMAMLANDI olduğunda otomatik fatura taslağı oluştur
        if (durum === 'TAMAMLANDI') {
            const hasFatura = await tx.fatura.findFirst({ where: { siparisId: id } })
            if (!hasFatura) {
                const fatNo = `AUTO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
                await tx.fatura.create({
                    data: {
                        siparisId: id,
                        faturaNo: fatNo,
                        tutar: 0,
                        vadeTarihi: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
                        odemeDurumu: 'ODENMEDI'
                    }
                })
            }
        }

        return await tx.siparis.findUnique({
            where: { id },
            include: { talep: true, tedarikci: true }
        })
    })

    // 2. İşlem Sonrası (Post-Transaction) - Revalidate ve Email
    revalidatePath('/siparisler')
    revalidatePath('/finans')

    if (!fullSiparis) return

    // Email ve Bildirim süreçleri transaction dışına taşındı (Zaman aşımı çözüm)
    if (fullSiparis.talep.bildirimEmail) {
        try {
            await sendInternalNotification(
                fullSiparis.talep.bildirimEmail,
                `Sipariş Durumu Güncellendi: ${fullSiparis.barkod}`,
                `
                <h3>Sipariş Durum Bildirimi</h3>
                <p><strong>Sipariş No:</strong> ${fullSiparis.barkod}</p>
                <p><strong>Yeni Durum:</strong> ${durum}</p>
                <p><strong>Tedarikçi:</strong> ${fullSiparis.tedarikci?.ad || '-'}</p>
                <p>Siparişinizin durumu "${durum}" olarak güncellenmiştir.</p>
                `
            )
        } catch (err) {
            console.error('Bildirim gönderim hatası:', err)
        }
    }

    if (durum === 'TAMAMLANDI') {
        try {
            await sendEvaluationEmail(id)
        } catch (err) {
            console.error('Değerlendirme maili gönderim hatası:', err)
        }
    }

    return fullSiparis
}

// --- NOTIFICATION HELPERS ---

export async function sendNotificationToSupplierUsers(supplierId: number, data: { title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' | 'error', link?: string }) {
    try {
        const users = await prisma.user.findMany({
            where: { tedarikciId: supplierId }
        })

        const notifications = users.map(user => ({
            ...data,
            userId: user.id
        }))

        if (notifications.length > 0) {
            await prisma.notification.createMany({
                data: notifications
            })
        }
    } catch (error) {
        console.error('Tedarikçi bildirimi gönderilirken hata:', error)
    }
}

export async function sendNotificationToRole(role: string, data: { title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' | 'error', link?: string }) {
    try {
        const users = await prisma.user.findMany({
            where: { role }
        })

        const notifications = users.map(user => ({
            ...data,
            userId: user.id
        }))

        if (notifications.length > 0) {
            await prisma.notification.createMany({
                data: notifications
            })
        }
    } catch (error) {
        console.error('Role bildirimi gönderilirken hata:', error)
    }
}
// --- SYSTEM METRICS & NOTIFICATIONS ---

export async function createNotification(data: { title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' | 'alert', link?: string, userId?: string }) {
    const res = await prisma.notification.create({ data })
    revalidatePath('/')
    revalidatePath('/bildirimler')
    return res
}

export async function getNotifications(onlyUnread = false) {
    const session = await auth()
    if (!session?.user?.id) return []

    return await prisma.notification.findMany({
        where: {
            userId: session.user.id,
            ...(onlyUnread ? { isRead: false } : {})
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function markNotificationAsRead(id: number) {
    const res = await prisma.notification.update({
        where: { id },
        data: { isRead: true }
    })
    revalidatePath('/')
    revalidatePath('/bildirimler')
    return res
}

export async function markAllNotificationsAsRead() {
    const session = await auth()
    if (!session?.user?.id) return { count: 0 }

    const res = await prisma.notification.updateMany({
        where: {
            userId: session.user.id,
            isRead: false
        },
        data: { isRead: true }
    })
    revalidatePath('/')
    revalidatePath('/bildirimler')
    return res
}

export async function deleteNotification(id: number) {
    const res = await prisma.notification.delete({
        where: { id }
    })
    revalidatePath('/')
    revalidatePath('/bildirimler')
    return res
}

export async function deleteAllNotifications() {
    const session = await auth()
    if (!session?.user?.id) return { count: 0 }

    const res = await prisma.notification.deleteMany({
        where: { userId: session.user.id }
    })
    revalidatePath('/')
    revalidatePath('/bildirimler')
    return res
}

export async function getSystemNotifications() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const today = new Date()
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const notifications: any[] = []

    // 1. Bekleyen Talepler
    const pendingTalepler = await prisma.talep.findMany({
        where: { durum: { in: ['TASLAK', 'ONAY_BEKLIYOR'] } },
        orderBy: { tarih: 'desc' },
        take: 5
    })
    pendingTalepler.forEach(t => {
        notifications.push({
            id: `talep-${t.id}`,
            title: 'Onay Bekliyor',
            desc: `${t.barkod} referanslı talep onayınızı bekliyor.`,
            type: 'alert',
            time: 'Şimdi',
            href: '/talepler'
        })
    })

    // 2. Vadesi Yaklaşan Faturalar
    const pendingFaturalar = await prisma.fatura.findMany({
        where: {
            odemeDurumu: 'ODENMEDI',
            vadeTarihi: { lte: sevenDaysLater }
        },
        include: { siparis: true },
        take: 5
    })
    pendingFaturalar.forEach(f => {
        notifications.push({
            id: `fatura-${f.id}`,
            title: 'Vade Yaklaşıyor',
            desc: `${f.faturaNo} nolu faturanın vadesine az kaldı.`,
            type: 'warning',
            time: 'Dikkat',
            href: '/finans'
        })
    })

    // 3. Biten Sözleşmeler
    const expiringSozlesmeler = await prisma.sozlesme.findMany({
        where: {
            bitisTarihi: { lte: thirtyDaysLater, gte: today }
        },
        take: 5
    })
    expiringSozlesmeler.forEach(s => {
        notifications.push({
            id: `soz-${s.id}`,
            title: 'Sözleşme Bitiyor',
            desc: `${s.sozlesmeNo} nolu sözleşme yakında sona erecek.`,
            type: 'info',
            time: 'Kritik',
            href: '/sozlesmeler'
        })
    })

    return notifications
}

export async function getDashboardStats() {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const role = (session.user as any).role
    const personelId = (session.user as any).personelId

    // BIRIM kullanıcısı için birimId bul
    let birimId: number | null = null
    if (role === 'BIRIM' && personelId) {
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })
        birimId = personel?.birimId || null
    }

    const birimFilter = birimId ? { birimId } : {}

    const [talepCount, activeOrdersCount, faturalar, expiringContractsCount] = await Promise.all([
        prisma.talep.count({ where: birimFilter }),
        prisma.siparis.count({ where: { durum: 'BEKLEMEDE', ...birimFilter } }),
        prisma.fatura.findMany({
            where: {
                odemeDurumu: 'ODENMEDI',
                ...(birimId ? { siparis: { birimId } } : {})
            },
            select: {
                tutar: true,
                siparis: {
                    select: {
                        teklifKabul: {
                            select: {
                                paraBirimi: true
                            }
                        }
                    }
                }
            }
        }),
        prisma.sozlesme.count({
            where: {
                bitisTarihi: { lte: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000) },
                ...(birimId ? { siparis: { birimId } } : {})
            }
        })
    ])

    // Döviz bazlı toplamları hesapla
    const borcMap: Record<string, number> = {}
    faturalar.forEach(f => {
        const paraBirimi = f.siparis?.teklifKabul?.paraBirimi || 'TRY'
        borcMap[paraBirimi] = (borcMap[paraBirimi] || 0) + Number(f.tutar)
    })

    return {
        talepHacmi: talepCount,
        aktifSiparis: activeOrdersCount,
        toplamBorc: borcMap,
        kritikSozlesme: expiringContractsCount
    }
}

export async function getRecentActivities() {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const role = (session.user as any).role
    const personelId = (session.user as any).personelId

    let birimId: number | null = null
    if (role === 'BIRIM' && personelId) {
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })
        birimId = personel?.birimId || null
    }

    return await prisma.talep.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        where: birimId ? { birimId } : {},
        select: {
            id: true,
            konu: true,
            barkod: true,
            durum: true,
            updatedAt: true
        }
    })
}

export async function getManagerReportData() {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const stats = await getDashboardStats()
    const lastTalepler = await prisma.talep.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { birim: true, ilgiliKisi: true }
    })
    const activeSiparisler = await prisma.siparis.findMany({
        take: 10,
        where: { durum: 'BEKLEMEDE' },
        include: { tedarikci: true, birim: true }
    })

    return {
        summary: [
            { Metrik: 'Toplam Talep Hacmi', Değer: stats.talepHacmi },
            { Metrik: 'Aktif Sipariş Saysı', Değer: stats.aktifSiparis },
            { Metrik: 'Toplam Borç Yükümlülüğü', Değer: stats.toplamBorc },
            { Metrik: 'Kritik Sözleşme Sayısı', Değer: stats.kritikSozlesme },
        ],
        recentRequests: lastTalepler.map(t => ({
            Referans: t.barkod,
            Konu: t.konu,
            Birim: t.birim?.ad || 'Belirtilmedi',
            Tarih: t.createdAt.toLocaleDateString('tr-TR')
        })),
        activeOrders: activeSiparisler.map((s: any) => ({
            Barkod: s.barkod,
            Tedarikçi: s.tedarikci?.ad || 'Belirtilmedi',
            Tutar: s.toplamTutar || 0,
            Durum: s.durum
        }))
    }
}

// --- HELPER ACTIONS ---


// --- ANALYTICS ACTIONS ---

export async function getAnalyticsData() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])

    const last12Months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        return {
            month: d.toLocaleString('tr-TR', { month: 'short' }),
            year: d.getFullYear(),
            start: new Date(d.getFullYear(), d.getMonth(), 1),
            end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
        }
    }).reverse() as { month: string, year: number, start: Date, end: Date }[]

    const spendingTrend = await Promise.all(last12Months.map(async (m) => {
        const aggregate = await prisma.fatura.aggregate({
            where: {
                vadeTarihi: { gte: m.start, lte: m.end }
            },
            _sum: { tutar: true }
        })
        return {
            name: m.month,
            tutar: Number(aggregate._sum?.tutar || 0)
        }
    }))

    const birimlerRaw = await prisma.siparis.groupBy({
        by: ['birimId'],
        _count: { id: true }
    })

    const birimIds = birimlerRaw.map(b => b.birimId)
    const birimNames = await prisma.birim.findMany({
        where: { id: { in: birimIds } },
        select: { id: true, ad: true }
    })

    const birimDistribution = birimlerRaw.map(b => {
        const birim = birimNames.find(bn => bn.id === b.birimId)
        return {
            name: birim?.ad || 'Diğer',
            value: b._count.id
        }
    }).sort((a, b) => b.value - a.value).slice(0, 5)

    const completedRfqs = await prisma.rFQ.findMany({
        where: { durum: 'TAMAMLANDI' },
        include: {
            teklifler: {
                select: { id: true, toplamTutar: true, durum: true }
            }
        },
        orderBy: { olusturmaTarihi: 'desc' },
        take: 6
    })

    const savingsPerformance = completedRfqs.map(rfq => {
        const accepted = rfq.teklifler.find(t => t.durum === 'KABUL')
        const others = rfq.teklifler.filter(t => t.id !== accepted?.id)
        if (!accepted || others.length === 0) return null
        const avgOthers = others.reduce((acc, t) => acc + Number(t.toplamTutar), 0) / others.length
        const rate = ((avgOthers - Number(accepted.toplamTutar)) / avgOthers) * 100
        return {
            name: rfq.rfqNo,
            oran: Math.max(0, Math.round(rate))
        }
    }).filter(Boolean)

    return {
        spendingTrend,
        birimDistribution,
        savingsPerformance
    }
}
// --- SYSTEM SETTINGS ACTIONS ---

export async function getSystemSettings() {
    return await prisma.systemSetting.findMany()
}

export async function updateSystemSetting(key: string, value: string) {
    const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    })
    revalidatePath('/ayarlar')
    return setting
}

export async function updateSystemSettings(settings: { key: string, value: string }[]) {
    for (const s of settings) {
        await prisma.systemSetting.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: { key: s.key, value: s.value }
        })
    }
    revalidatePath('/ayarlar')
    return { success: true }
}

export async function getSMTPConfig() {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: {
                    in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
                }
            }
        })

        const config: any = {}
        settings.forEach(s => {
            config[s.key] = s.value
        })

        return {
            host: config.SMTP_HOST || process.env.SMTP_HOST,
            port: parseInt(config.SMTP_PORT || process.env.SMTP_PORT || '587'),
            secure: (config.SMTP_SECURE || process.env.SMTP_SECURE) === 'true',
            user: config.SMTP_USER || process.env.SMTP_USER,
            pass: config.SMTP_PASS || process.env.SMTP_PASS,
            from: config.SMTP_FROM || process.env.SMTP_FROM
        }
    } catch (err) {
        return {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
            from: process.env.SMTP_FROM
        }
    }
}

export async function upsertUserAccount(personelId: number, email: string, password?: string, role: string = 'SATINALMA') {
    await checkAuth(['ADMIN'])

    const personel = await prisma.personel.findUnique({ where: { id: personelId }, include: { user: true } })
    if (!personel) throw new Error('Personel bulunamadı.')

    // Eğer yeni kullanıcı oluşturuluyorsa şifre zorunlu olmalı
    if (!personel.user && !password) {
        throw new Error('Yeni kullanıcı için şifre belirlemek zorunludur.')
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined

    const user = await prisma.user.upsert({
        where: { personelId },
        update: {
            email,
            role,
            name: personel.adSoyad,
            ...(hashedPassword ? { password: hashedPassword } : {})
        },
        create: {
            email,
            password: hashedPassword || '',
            role,
            personelId,
            name: personel.adSoyad
        }
    })

    revalidatePath('/ayarlar')
    return { success: true, user }
}

export async function updatePersonalProfile(data: { name: string, email: string, password?: string, image?: string }) {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Oturum bulunamadı')

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    })

    if (!user) throw new Error('Kullanıcı bulunamadı')

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            name: data.name,
            email: data.email,
            image: data.image || user.image,
            ...(hashedPassword ? { password: hashedPassword } : {})
        }
    })

    // Eğer personele bağlıysa personel kaydını da güncelle
    if (user.personelId) {
        await prisma.personel.update({
            where: { id: user.personelId },
            data: {
                adSoyad: data.name,
                email: data.email
            }
        })
    }

    revalidatePath('/profil')
    return { success: true, user: updatedUser }
}

export async function removeUserAccount(personelId: number) {
    await checkAuth(['ADMIN'])

    // Personel kaydını silmeden sadece kullanıcı hesabını (User) siler
    const res = await prisma.user.deleteMany({
        where: { personelId }
    })

    revalidatePath('/ayarlar')
    return { success: true, count: res.count }
}

// --- TEDARİKÇİ TEKLİF PORTALI ---

function generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
}

export async function createTeklifToken(talepId: number, tedarikciId: number, gecerlilikGun: number = 7) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const token = generateToken()
    const sonGecerlilik = new Date()
    sonGecerlilik.setDate(sonGecerlilik.getDate() + gecerlilikGun)

    return await prisma.teklifToken.create({
        data: {
            token,
            talepId,
            tedarikciId,
            sonGecerlilik
        }
    })
}

export async function validateToken(token: string) {
    const teklifToken = await prisma.teklifToken.findUnique({
        where: { token },
        include: {
            talep: {
                include: {
                    kalemler: true,
                    ilgiliKisi: true
                }
            },
            tedarikci: true,
            rfqTedarikci: {
                include: {
                    rfq: {
                        include: {
                            olusturan: true
                        }
                    }
                }
            }
        }
    })

    if (!teklifToken) {
        return { valid: false, error: 'Geçersiz token' }
    }

    // Tur sistemi: Kullanılmış token için yeni tur kontrolü
    if (teklifToken.kullanildiMi) {
        // RFQ varsa mevcut tur ve tedarikçinin son teklif turunu kontrol et
        if (teklifToken.rfqTedarikci?.rfq) {
            const rfq = teklifToken.rfqTedarikci.rfq

            // RFQ aktif değilse veya tamamlandıysa engelle
            if (rfq.durum === 'TAMAMLANDI' || rfq.durum === 'IPTAL') {
                return { valid: false, error: 'Bu ihale sonuçlanmış veya iptal edilmiş' }
            }

            // Tedarikçinin son teklif turunu bul
            const sonTeklif = await prisma.teklif.findFirst({
                where: {
                    rfqId: rfq.id,
                    tedarikciId: teklifToken.tedarikciId
                },
                orderBy: { turNo: 'desc' }
            })

            const sonTeklifTur = sonTeklif?.turNo || 0
            const mevcutTur = rfq.mevcutTur || 1

            // Yeni tur başladıysa izin ver
            if (mevcutTur > sonTeklifTur) {
                // Yeni turda teklif verilebilir
                return { valid: true, data: teklifToken, isNewRound: true, currentRound: mevcutTur }
            }
        }

        return { valid: false, error: 'Bu teklif zaten gönderildi' }
    }

    if (new Date() > teklifToken.sonGecerlilik) {
        return { valid: false, error: 'Teklif süresi dolmuş' }
    }

    return { valid: true, data: teklifToken }
}

export async function getTalepByToken(token: string) {
    const result = await validateToken(token)
    if (!result.valid) {
        throw new Error(result.error)
    }

    // Tur bilgisi ve önceki teklif dahil et
    const data: any = result.data

    if ((result as any).isNewRound) {
        data.isNewRound = true
        data.currentRound = (result as any).currentRound

        // Önceki tur teklifini getir
        if (data.rfqTedarikci?.rfq) {
            const oncekiTeklif = await prisma.teklif.findFirst({
                where: {
                    rfqId: data.rfqTedarikci.rfq.id,
                    tedarikciId: data.tedarikciId
                },
                include: {
                    kalemler: true
                },
                orderBy: { turNo: 'desc' }
            })

            // Decimal'ları number'a dönüştür (Client Component uyumluluğu için)
            if (oncekiTeklif) {
                data.oncekiTeklif = {
                    ...oncekiTeklif,
                    toplamTutar: Number(oncekiTeklif.toplamTutar),
                    kalemler: oncekiTeklif.kalemler.map(k => ({
                        ...k,
                        birimFiyat: Number(k.birimFiyat)
                    }))
                }
            }
        }
    }

    return data
}

export async function submitTeklif(token: string, teklifData: {
    kalemler: { talepKalemId: number, birimFiyat: number }[],
    teslimSuresi: number,
    gecerlilikSuresi: number,
    paraBirimi: string,
    notlar?: string,
    odemePlani?: { oran: number, vadeGun: number, aciklama: string }[]
}) {
    const validation = await validateToken(token)
    if (!validation.valid) {
        throw new Error(validation.error)
    }

    const teklifToken = validation.data!

    // Toplam tutarı hesapla
    const toplamTutar = teklifData.kalemler.reduce((sum, k) => {
        const kalem = teklifToken.talep.kalemler.find(tk => tk.id === k.talepKalemId)
        return sum + (k.birimFiyat * (kalem?.miktar || 0))
    }, 0)

    // RFQ bağlantısını kontrol et
    const rfqId = teklifToken.rfqTedarikci?.rfqId
    let rfqKalemMap = new Map<number, number>()

    if (rfqId) {
        const rfqKalemler = await prisma.rFQKalem.findMany({ where: { rfqId } })
        rfqKalemler.forEach(rk => rfqKalemMap.set(rk.talepKalemId, rk.id))
    }

    // RFQ'dan mevcut tur numarasını al
    let mevcutTurNo = 1
    if (rfqId) {
        const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { mevcutTur: true } })
        if (rfq) mevcutTurNo = rfq.mevcutTur
    }

    // Vade bilgisini hesapla (en uzun vade veya tekil vade olarak)
    const primaryVade = teklifData.odemePlani && teklifData.odemePlani.length > 0
        ? Math.max(...teklifData.odemePlani.map(p => p.vadeGun))
        : 0

    // Teklifi oluştur
    const teklif = await prisma.teklif.create({
        data: {
            tokenId: teklifToken.id,
            talepId: teklifToken.talepId,
            tedarikciId: teklifToken.tedarikciId,
            rfqId, // RFQ bağlantısı
            turNo: mevcutTurNo, // Mevcut tur numarası
            vadeGun: primaryVade,
            toplamTutar,
            paraBirimi: teklifData.paraBirimi,
            teslimSuresi: teklifData.teslimSuresi,
            gecerlilikSuresi: teklifData.gecerlilikSuresi,
            notlar: teklifData.notlar,
            kalemler: {
                create: teklifData.kalemler.map(k => ({
                    talepKalemId: k.talepKalemId,
                    rfqKalemId: rfqKalemMap.get(k.talepKalemId), // RFQ Kalem bağlantısı
                    birimFiyat: k.birimFiyat
                }))
            },
            odemePlani: {
                create: teklifData.odemePlani?.map(p => ({
                    oran: p.oran,
                    vadeGun: p.vadeGun,
                    aciklama: p.aciklama
                }))
            }
        }
    })

    // Dosyaları bu teklife bağla (DRAFT -> REAL)
    await prisma.attachment.updateMany({
        where: {
            relatedEntity: 'TEKLIF_TOKEN_DRAFT',
            entityId: teklifToken.id
        },
        data: {
            relatedEntity: 'TEKLIF',
            entityId: teklif.id
        }
    })

    // RFQ Tedarikçi durumunu güncelle
    if (teklifToken.rfqTedarikciId) {
        await prisma.rFQTedarikci.update({
            where: { id: teklifToken.rfqTedarikciId },
            data: {
                durum: 'YANITLADI',
                gonderimTarihi: new Date()
            }
        })
    }

    // Yeni teklif bildirimi oluştur
    await createNotification({
        title: 'Yeni Teklif Alındı',
        message: `${teklifToken.tedarikci.ad} tarafından ${teklifToken.talep.barkod} için yeni teklif verildi.`,
        type: 'success',
        link: rfqId ? `/rfq/${rfqId}` : '/talepler'
    })

    // Token'ı kullanıldı olarak işaretle
    await prisma.teklifToken.update({
        where: { id: teklifToken.id },
        data: {
            kullanildiMi: true,
            kullanilmaTarihi: new Date()
        }
    })

    // Decimal'ı number'a dönüştür (Client Component uyumluluğu için)
    return {
        ...teklif,
        toplamTutar: Number(teklif.toplamTutar)
    }
}

// Zod Şeması: API Uzmanı ve Güvenlik Uzmanı onayı için zorunludur.
const ManualOfferSchema = z.object({
    tedarikciId: z.number().optional(),
    hariciTedarikciAdi: z.string().optional(),
    kalemler: z.array(z.object({
        talepKalemId: z.number(),
        birimFiyat: z.number().positive()
    })),
    teslimSuresi: z.number().min(1),
    paraBirimi: z.string().length(3)
}).refine(data => data.tedarikciId || data.hariciTedarikciAdi, {
    message: "Tedarikçi seçilmeli veya firma adı girilmelidir.",
    path: ["tedarikciId"]
})

export async function submitManualOffer(rfqId: number, rawData: {
    tedarikciId: number,
    kalemler: { talepKalemId: number, birimFiyat: number }[],
    teslimSuresi: number,
    vadeGun?: number,
    paraBirimi: string
}) {
    // 1. Yetki Kontrolü
    await checkAuth(['ADMIN', 'SATINALMA'])

    // 2. Veri Doğrulama (Zod)
    const validated = ManualOfferSchema.safeParse(rawData)
    if (!validated.success) {
        throw new Error('Geçersiz veri girişi: ' + validated.error.message)
    }
    const data = validated.data

    const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
            kalemler: { include: { talepKalem: true } },
            tedarikciler: data.tedarikciId ? {
                where: { tedarikciId: data.tedarikciId },
                include: { tedarikci: true }
            } : false
        }
    })

    if (!rfq) throw new Error('RFQ bulunamadı.')
    if (data.tedarikciId && (!rfq.tedarikciler || rfq.tedarikciler.length === 0)) {
        throw new Error('Seçilen tedarikçi bu RFQ\'ya eklenmemiş.')
    }
    if (rfq.durum === 'TAMAMLANDI' || rfq.durum === 'IPTAL') throw new Error('Kapanmış ihaleye teklif girilemez.')

    const rfqTedarikci = data.tedarikciId ? (rfq.tedarikciler as any)[0] : null

    // Token bul (yoksa ve kayıtlı tedarikçi ise oluştur)
    let token = null
    if (data.tedarikciId && rfqTedarikci) {
        token = await prisma.teklifToken.findFirst({
            where: { rfqTedarikciId: rfqTedarikci.id }
        })

        if (!token) {
            token = await createTeklifTokenForRFQ(rfqId, data.tedarikciId, rfqTedarikci.id)
        }
    }

    // Toplam tutarı hesapla (DBA Bakış Açısı: Decimal hassasiyeti korunmalı)
    const toplamTutar = data.kalemler.reduce((sum, k) => {
        const rfqKalem = rfq.kalemler.find(rk => rk.talepKalemId === k.talepKalemId)
        return sum + (k.birimFiyat * (rfqKalem?.miktar || 0))
    }, 0)

    const rfqKalemMap = new Map<number, number>()
    rfq.kalemler.forEach(rk => rfqKalemMap.set(rk.talepKalemId, rk.id))

    // 3. Veritabanı İşlemi (Atomic Transaction gibi çalışır)
    const teklif = await prisma.teklif.create({
        data: {
            tokenId: token?.id,
            talepId: rfq.kalemler[0].talepId,
            tedarikciId: data.tedarikciId,
            hariciTedarikciAdi: data.hariciTedarikciAdi,
            rfqId: rfq.id,
            turNo: rfq.mevcutTur,
            vadeGun: rawData.vadeGun || 0,
            toplamTutar,
            paraBirimi: data.paraBirimi,
            teslimSuresi: data.teslimSuresi,
            gecerlilikSuresi: 30,
            durum: 'BEKLEMEDE',
            kalemler: {
                create: data.kalemler.map(k => ({
                    talepKalemId: k.talepKalemId,
                    rfqKalemId: rfqKalemMap.get(k.talepKalemId),
                    birimFiyat: k.birimFiyat
                }))
            },
            odemePlani: {
                create: [{ oran: 100, vadeGun: 30, aciklama: 'Manuel Giriş' }]
            }
        }
    })

    // 4. Durum Güncelleme (Sadece kayıtlı tedarikçi ise)
    if (rfqTedarikci) {
        await prisma.rFQTedarikci.update({
            where: { id: rfqTedarikci.id },
            data: {
                durum: 'YANITLADI',
                gonderimTarihi: new Date()
            }
        })
    }

    await createNotification({
        title: 'Harici Teklif Girildi',
        message: `${rfq.rfqNo} için ${data.hariciTedarikciAdi || (rfqTedarikci as any).tedarikci.ad} adına manuel teklif girişi yapıldı.`,
        type: 'info',
        link: `/rfq/${rfq.id}`
    })

    revalidatePath(`/rfq/${rfqId}`)

    return {
        ...teklif,
        toplamTutar: Number(teklif.toplamTutar)
    }
}

export async function getTekliflerByTalep(talepId: number) {
    const teklifler = await prisma.teklif.findMany({
        where: { talepId },
        include: {
            tedarikci: true,
            kalemler: {
                include: {
                    talepKalem: true
                }
            }
        },
        orderBy: { olusturmaTarihi: 'desc' }
    })

    return teklifler.map(t => ({
        ...t,
        toplamTutar: Number(t.toplamTutar),
        kalemler: t.kalemler.map(k => ({
            ...k,
            birimFiyat: Number(k.birimFiyat)
        }))
    }))
}

export async function updateTeklifDurum(teklifId: number, durum: 'BEKLEMEDE' | 'KABUL' | 'RED') {
    await prisma.teklif.update({
        where: { id: teklifId },
        data: { durum }
    })
    revalidatePath('/talepler')
    revalidatePath('/rfq')
}

// --- RFQ (TEKLİF İSTEMİ) MODÜLÜ ---

export async function getRFQs() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const rfqs = await prisma.rFQ.findMany({
        include: {
            olusturan: true,
            kategori: true,
            kalemler: {
                include: {
                    talep: true,
                    talepKalem: true
                }
            },
            tedarikciler: {
                include: {
                    tedarikci: true
                }
            },
            teklifler: {
                include: {
                    tedarikci: true
                }
            }
        },
        orderBy: { olusturmaTarihi: 'desc' }
    })

    return JSON.parse(JSON.stringify(rfqs))
}

export async function getRFQById(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: {
            olusturan: true,
            kategori: true,
            kalemler: {
                include: {
                    talep: true,
                    talepKalem: true,
                    siparisSecimi: {
                        include: {
                            teklif: {
                                include: {
                                    tedarikci: true,
                                    kalemler: {
                                        include: { talepKalem: true }
                                    },
                                    odemePlani: true
                                }
                            }
                        }
                    }
                }
            },
            tedarikciler: {
                include: {
                    tedarikci: true,
                    teklifToken: true
                }
            },
            teklifler: {
                include: {
                    tedarikci: true,
                    kalemler: {
                        include: { talepKalem: true }
                    },
                    odemePlani: true
                }
            },
            siparisler: true
        }
    })

    if (!rfq) return null

    return {
        ...rfq,
        kalemler: rfq.kalemler.map(k => ({
            ...k,
            talepKalem: k.talepKalem,
            siparisSecimi: k.siparisSecimi ? {
                ...k.siparisSecimi,
                teklif: {
                    ...k.siparisSecimi.teklif,
                    toplamTutar: Number(k.siparisSecimi.teklif.toplamTutar),
                    kalemler: k.siparisSecimi.teklif.kalemler.map(tk => ({
                        ...tk,
                        birimFiyat: Number(tk.birimFiyat)
                    }))
                }
            } : null
        })),
        teklifler: await Promise.all(rfq.teklifler.map(async (t) => {
            const attachments = await prisma.attachment.findMany({
                where: {
                    relatedEntity: 'TEKLIF',
                    entityId: t.id
                }
            })
            return {
                ...t,
                toplamTutar: Number(t.toplamTutar),
                attachments,
                kalemler: t.kalemler.map(k => ({
                    ...k,
                    birimFiyat: Number(k.birimFiyat)
                }))
            }
        })),
        siparisler: rfq.siparisler.map(s => ({
            ...s,
            toplamTutar: (s as any).toplamTutar ? Number((s as any).toplamTutar) : 0
        }))
    }
}

function generateRFQNo(): string {
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `RFQ-${year}-${random}`
}

export async function createRFQ(data: {
    baslik: string,
    aciklama?: string,
    sonTeklifTarihi: Date,
    olusturanId: number,
    kategoriId?: number,
    agirlikFiyat?: number,
    agirlikVade?: number,
    agirlikTeslimat?: number,
    agirlikPerformans?: number,
    kalemler: { talepId: number, talepKalemId: number, miktar?: number }[],
    externalEmails?: string[]
}) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const { kalemler, externalEmails, ...rfqData } = data

    const rfq = await prisma.rFQ.create({
        data: {
            rfqNo: generateRFQNo(),
            ...rfqData,
            kalemler: {
                create: kalemler.map(k => ({
                    talepId: k.talepId,
                    talepKalemId: k.talepKalemId,
                    miktar: k.miktar
                }))
            }
        },
        include: {
            kalemler: true
        }
    })

    // Dışarıdan davet edilen emailleri ekle
    if (externalEmails && externalEmails.length > 0) {
        for (const email of externalEmails) {
            try {
                await inviteExternalSupplierToRFQ(rfq.id, email)
            } catch (err) {
                console.error(`Error inviting ${email} during RFQ creation:`, err)
            }
        }
    }

    revalidatePath('/rfq')
    return JSON.parse(JSON.stringify(rfq))
}

export async function addKalemlerToRFQ(rfqId: number, kalemler: { talepId: number, talepKalemId: number, miktar?: number }[]) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    await prisma.rFQKalem.createMany({
        data: kalemler.map(k => ({
            rfqId,
            talepId: k.talepId,
            talepKalemId: k.talepKalemId,
            miktar: k.miktar
        }))
    })
    revalidatePath('/rfq')
}

export async function removeKalemFromRFQ(rfqKalemId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    await prisma.rFQKalem.delete({
        where: { id: rfqKalemId }
    })
    revalidatePath('/rfq')
}

export async function addTedarikcilerToRFQ(rfqId: number, tedarikciIds: number[]) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    await prisma.rFQTedarikci.createMany({
        data: tedarikciIds.map(id => ({
            rfqId,
            tedarikciId: id
        }))
    })
    revalidatePath('/rfq')
}

export async function removeTedarikcifromRFQ(rfqTedarikciId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    await prisma.rFQTedarikci.delete({
        where: { id: rfqTedarikciId }
    })
    revalidatePath('/rfq')
}

export async function inviteExternalSupplierToRFQ(rfqId: number, email: string) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    try {
        const rfq = await prisma.rFQ.findUnique({
            where: { id: rfqId },
            select: { id: true, rfqNo: true, baslik: true, durum: true, aciklama: true, kalemler: { include: { talep: true, talepKalem: true } } }
        })

        if (!rfq) throw new Error('RFQ bulunamadı')

        // 1. E-posta ile mevcut bir tedarikçi var mı bak
        let tedarikci = await prisma.tedarikci.findFirst({
            where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } }
        })

        // 2. Yoksa yeni bir "Misafir" tedarikçi oluştur
        if (!tedarikci) {
            const guestName = `MISAFIR-${email.trim().toLowerCase()}`
            const existingByName = await prisma.tedarikci.findUnique({ where: { ad: guestName } })
            if (existingByName) {
                tedarikci = existingByName
            } else {
                tedarikci = await prisma.tedarikci.create({
                    data: {
                        ad: guestName,
                        email: email.trim().toLowerCase(),
                        aktif: true
                    }
                })
            }
        }

        // 3. RFQ'ya zaten ekli mi kontrol et
        const existing = await prisma.rFQTedarikci.findFirst({
            where: {
                rfqId,
                tedarikciId: tedarikci.id
            }
        })

        let rfqTedarikciId: number

        if (!existing) {
            // 4. RFQ bağlantısını kur
            const rt = await prisma.rFQTedarikci.create({
                data: {
                    rfqId,
                    tedarikciId: tedarikci.id,
                    durum: 'BEKLIYOR'
                }
            })
            rfqTedarikciId = rt.id
        } else {
            rfqTedarikciId = existing.id
        }

        // 5. Eğer RFQ zaten GONDERILDI veya DEGERLENDIRILME durumundaysa hemen mail gönder
        if (rfq.durum === 'GONDERILDI' || rfq.durum === 'DEGERLENDIRILME') {
            const smtp = await getSMTPConfig()
            const transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                auth: { user: smtp.user, pass: smtp.pass },
            })

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
            const token = await createTeklifTokenForRFQ(rfqId, tedarikci.id, rfqTedarikciId)
            const portalUrl = `${baseUrl}/teklif/${token.token}`

            const talepForEmail = {
                barkod: rfq.rfqNo,
                konu: rfq.baslik,
                gerekce: rfq.aciklama || '',
                kalemler: rfq.kalemler.map(k => ({
                    aciklama: k.talepKalem.aciklama,
                    miktar: k.miktar || k.talepKalem.miktar,
                    birim: k.talepKalem.birim
                }))
            }

            const senderData = {
                name: 'Satinalma Departmanı',
                email: smtp.user || 'noreply@example.com',
                title: 'Kurumsal Tedarik Sistemi'
            }

            const html = renderRfqEmail(talepForEmail, tedarikci, senderData, portalUrl)

            await transporter.sendMail({
                from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
                to: tedarikci.email!,
                replyTo: senderData.email,
                subject: `Teklif İstemi Daveti - ${rfq.rfqNo} - ${rfq.baslik}`,
                html
            })

            // Gönderim tarihini güncelle
            await prisma.rFQTedarikci.update({
                where: { id: rfqTedarikciId },
                data: { gonderimTarihi: new Date() }
            })
        }

        revalidatePath(`/rfq/${rfqId}`)
        return { success: true, tedarikci }
    } catch (err) {
        console.error('inviteExternalSupplierToRFQ error:', err)
        throw new Error('Davet gönderilemedi: ' + (err as Error).message)
    }
}

export async function completeSupplierRegistration(tedarikciId: number, data: {
    ad: string,
    yetkiliKisi: string,
    telefon: string,
    adres: string,
    vergiNo: string,
    kategoriId: number
}) {
    try {
        await prisma.tedarikci.update({
            where: { id: tedarikciId },
            data: {
                ad: data.ad,
                yetkiliKisi: data.yetkiliKisi,
                telefon: data.telefon,
                adres: data.adres,
                vergiNo: data.vergiNo,
                kategoriId: data.kategoriId
            }
        })
        revalidatePath('/teklif')
        return { success: true }
    } catch (err) {
        console.error('completeSupplierRegistration error:', err)
        return { success: false, error: (err as Error).message }
    }
}

export async function updateRFQStatus(rfqId: number, durum: string) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    await prisma.rFQ.update({
        where: { id: rfqId },
        data: { durum }
    })
    revalidatePath('/rfq')
}

export async function sendRFQToSuppliers(rfqId: number, sender?: { name: string, email: string, title: string }) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
            kalemler: {
                include: {
                    talep: true,
                    talepKalem: true
                }
            },
            tedarikciler: {
                include: { tedarikci: true }
            }
        }
    })

    if (!rfq) throw new Error('RFQ bulunamadı')
    if (rfq.tedarikciler.length === 0) throw new Error('RFQ için tedarikçi seçilmemiş')

    const smtp = await getSMTPConfig()
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass,
        },
    })

    const senderData = sender || {
        name: 'Satinalma Departmanı',
        email: smtp.user || 'noreply@example.com',
        title: 'Kurumsal Tedarik Sistemi'
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Talep formatına dönüştür (email template için)
    const talepForEmail = {
        barkod: rfq.rfqNo,
        konu: rfq.baslik,
        gerekce: rfq.aciklama || '',
        kalemler: rfq.kalemler.map(k => ({
            aciklama: k.talepKalem.aciklama,
            miktar: k.miktar || k.talepKalem.miktar,
            birim: k.talepKalem.birim
        }))
    }

    const results = []
    for (const rfqTedarikci of rfq.tedarikciler) {
        // Tedarikçinin sistemde hesabı var mı kontrol et
        const hasAccount = await prisma.user.findFirst({
            where: { tedarikciId: rfqTedarikci.tedarikciId }
        })

        // Token oluştur (Hala lazım olabilir ama kayıtlı kullanıcılar portaldan görür)
        const token = await createTeklifTokenForRFQ(rfqId, rfqTedarikci.tedarikciId, rfqTedarikci.id)

        // Eğer hesabı varsa portala, yoksa token bazlı linke yönlendir
        const portalUrl = hasAccount
            ? `${baseUrl}/portal/tedarikci/rfq`
            : `${baseUrl}/teklif/${token.token}`

        const html = renderRfqEmail(talepForEmail, rfqTedarikci.tedarikci, senderData, portalUrl)

        await transporter.sendMail({
            from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
            to: rfqTedarikci.tedarikci.email!,
            replyTo: senderData.email,
            subject: `Teklif İstemi (RFQ) - ${rfq.rfqNo} - ${rfq.baslik}`,
            html
        })

        // Gönderim tarihini güncelle
        await prisma.rFQTedarikci.update({
            where: { id: rfqTedarikci.id },
            data: {
                gonderimTarihi: new Date(),
                durum: 'BEKLIYOR'
            }
        })

        // Uygulama içi bildirim (Eğer hesabı varsa)
        if (hasAccount) {
            await createNotification({
                userId: hasAccount.id,
                title: 'Yeni İhale Daveti',
                message: `${rfq.rfqNo} - ${rfq.baslik} ihalemize teklifinizi bekliyoruz.`,
                type: 'info',
                link: '/portal/tedarikci/rfq'
            })
        }

        results.push(rfqTedarikci.tedarikci.ad)
    }

    // RFQ durumunu güncelle
    await prisma.rFQ.update({
        where: { id: rfqId },
        data: { durum: 'GONDERILDI' }
    })

    // İhale yayınlandı bildirimi
    await createNotification({
        title: 'İhale Süreci Başlatıldı',
        message: `${rfq.rfqNo} numaralı ihale ${rfq.tedarikciler.length} tedarikçiye gönderildi.`,
        type: 'info',
        link: `/rfq/${rfq.id}`
    })

    // Birimleri bilgilendir
    const bildirimEmailleri = new Set(rfq.kalemler.map(k => k.talep.bildirimEmail).filter(Boolean))
    for (const email of bildirimEmailleri) {
        await sendInternalNotification(
            email as string,
            `İhale Süreci Başladı: ${rfq.rfqNo}`,
            `
            <h3>İhale Süreci Bildirimi</h3>
            <p><strong>İhale No:</strong> ${rfq.rfqNo}</p>
            <p><strong>Konu:</strong> ${rfq.baslik}</p>
            <p><strong>Tedarikçi Sayısı:</strong> ${rfq.tedarikciler.length}</p>
            <p>Talebiniz için ihale süreci başlatılmış ve tedarikçilere teklif davetleri gönderilmiştir.</p>
            `
        )
    }

    revalidatePath('/rfq')
    return results
}

async function createTeklifTokenForRFQ(rfqId: number, tedarikciId: number, rfqTedarikciId: number) {
    // RFQ'dan ilk talep ID'sini al
    const rfqKalem = await prisma.rFQKalem.findFirst({
        where: { rfqId }
    })

    const token = generateToken()
    const sonGecerlilik = new Date()
    sonGecerlilik.setDate(sonGecerlilik.getDate() + 7)

    return await prisma.teklifToken.create({
        data: {
            token,
            talepId: rfqKalem?.talepId || 0,
            tedarikciId,
            rfqTedarikciId,
            sonGecerlilik
        }
    })
}

export async function earlyCloseRFQ(rfqId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    // 1. Durumu güncelle ve tarihi kapat
    const rfq = await prisma.rFQ.update({
        where: { id: rfqId },
        data: {
            durum: 'DEGERLENDIRILME',
            sonTeklifTarihi: new Date() // Hemen süresi dolsun
        },
        include: {
            tedarikciler: {
                include: { tedarikci: true }
            }
        }
    })

    // 2. Tedarikçilere mail at
    const smtp = await getSMTPConfig()
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass
        }
    })

    const emailHtml = renderRfqClosedEmail(rfq.baslik, rfq.rfqNo)

    for (const t of rfq.tedarikciler) {
        if (t.tedarikci.email) {
            try {
                await transporter.sendMail({
                    from: smtp.from,
                    to: t.tedarikci.email,
                    subject: `[BİLGİ] İhale Kapandı: ${rfq.rfqNo} - ${rfq.baslik}`,
                    html: emailHtml
                })
            } catch (err) {
                console.error(`Mail gönderilemedi (${t.tedarikci.email}):`, err)
            }
        }

        // Uygulama içi bildirim
        const hasAccount = await prisma.user.findFirst({
            where: { tedarikciId: t.tedarikciId }
        })
        if (hasAccount) {
            await createNotification({
                userId: hasAccount.id,
                title: 'İhale Kapandı',
                message: `${rfq.rfqNo} ihalemiz süresi dolmadan kapatılmıştır. Teklif verme süreci sona erdi.`,
                type: 'warning',
                link: '/portal/tedarikci/rfq'
            })
        }
    }

    revalidatePath('/rfq')
}

export async function selectKalemTedarikci(rfqKalemId: number, teklifId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    // Mevcut seçimi kontrol et
    const existing = await prisma.siparisKalemSecimi.findUnique({
        where: { rfqKalemId }
    })

    // Eğer zaten bu teklif seçiliyse veya teklifId -1 ise, seçimi kaldır (Toggle/Remove)
    if (existing && (existing.teklifId === teklifId || teklifId === -1)) {
        await prisma.siparisKalemSecimi.delete({
            where: { id: existing.id }
        })
    } else if (existing) {
        // Farklı bir seçim varsa güncelle
        await prisma.siparisKalemSecimi.update({
            where: { id: existing.id },
            data: { teklifId }
        })
    } else {
        // Yeni oluştur
        await prisma.siparisKalemSecimi.create({
            data: {
                rfqKalemId,
                teklifId
            }
        })
    }
    revalidatePath('/rfq')
}

export async function createOrdersFromRFQ(rfqId: number, birimId: number, yonetmelikId: number, alimYontemiId: number, girilenBarkod?: string, degerlendirmeFormTipiId?: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
            kalemler: {
                include: {
                    talep: true,
                    siparisSecimi: {
                        include: {
                            teklif: {
                                include: {
                                    tedarikci: true,
                                    kalemler: {
                                        include: { talepKalem: true }
                                    },
                                    odemePlani: true
                                }
                            }
                        }
                    },
                    talepKalem: true
                }
            },
            teklifler: {
                include: { tedarikci: true }
            },
            tedarikciler: {
                include: { tedarikci: true }
            }
        }
    })

    if (!rfq) throw new Error('RFQ bulunamadı')

    // Kullanıcı bilgilerini al (Geçici olarak default, çünkü Session modeli şemada yok)
    const sender = {
        name: 'Satınalma Departmanı',
        title: 'Satınalma Sorumlusu',
        email: 'satinalma@pirireis.edu.tr',
        phone: '-'
    }

    // Tedarikçilere göre grupla
    const gruplar: { [tedarikciId: number]: { tedarikci: any, kalemler: any[] } } = {}

    for (const kalem of rfq.kalemler) {
        if (!kalem.siparisSecimi) continue

        const tedarikciId = kalem.siparisSecimi.teklif.tedarikciId
        if (tedarikciId === null) continue

        if (!gruplar[tedarikciId]) {
            gruplar[tedarikciId] = {
                tedarikci: kalem.siparisSecimi.teklif.tedarikci,
                kalemler: []
            }
        }
        gruplar[tedarikciId].kalemler.push(kalem)
    }

    const siparisler = []

    console.log('Gruplar:', gruplar)

    // SMTP Config for Email
    const smtp = await getSMTPConfig()
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass
        }
    })

    let index = 1
    const totalGroups = Object.keys(gruplar).length

    for (const [tedarikciId, grup] of Object.entries(gruplar)) {
        // Her tedarikçi için kaynağı olan ilk talebi bul
        const ilkKalem = grup.kalemler[0]
        const talepId = ilkKalem.talepId

        // Barkod oluştur veya girileni kullan
        let barkod = girilenBarkod || `SIP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

        // Eğer birden fazla tedarikçi varsa ve barkod girilmişse suffix ekle (Unique kısıtı için)
        if (girilenBarkod && totalGroups > 1) {
            barkod = `${girilenBarkod}-${index}`
            index++
        }

        const siparis = await prisma.siparis.create({
            data: {
                barkod,
                aciklama: `RFQ ${rfq.rfqNo} üzerinden oluşturuldu`,
                talepId,
                birimId,
                yonetmelikId,
                alimYontemiId,
                tedarikciId: parseInt(tedarikciId),
                rfqId: rfqId,
                degerlendirmeFormTipiId,
                odemePlani: {
                    create: ilkKalem.siparisSecimi.teklif.odemePlani?.map((p: any) => ({
                        oran: p.oran,
                        vadeGun: p.vadeGun,
                        aciklama: p.aciklama
                    }))
                }
            }
        })

        // Kalem seçimlerini güncelle
        for (const kalem of grup.kalemler) {
            if (kalem.siparisSecimi) {
                await prisma.siparisKalemSecimi.update({
                    where: { id: kalem.siparisSecimi.id },
                    data: { siparisId: siparis.id }
                })
            }
        }

        siparisler.push(siparis)

        // Send Order Email
        if (grup.tedarikci.email) {
            try {
                // E-Posta Şablonu HTML
                const emailHtml = renderOrderEmail(siparis, grup.tedarikci, rfq, grup.kalemler, sender)
                
                // PDF Sipariş Formunu (Buffer) Oluştur
                const pdfBuffer = await generateSiparisPdfBuffer(siparis, grup.tedarikci, rfq, grup.kalemler, sender)

                await transporter.sendMail({
                    from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
                    to: grup.tedarikci.email,
                    subject: `Sipariş Emri - ${siparis.barkod}`,
                    html: emailHtml,
                    attachments: [
                        {
                            filename: `Siparis_Formu_${siparis.barkod}.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                })
            } catch (err) {
                console.error(`Sipariş maili gönderilemedi (${grup.tedarikci.email}):`, err)
            }
        }

        // Uygulama içi bildirim (Kazanan)
        const hasAccount = await prisma.user.findFirst({
            where: { tedarikciId: parseInt(tedarikciId) }
        })
        if (hasAccount) {
            await createNotification({
                userId: hasAccount.id,
                title: 'Tebrikler, Sipariş Aldınız!',
                message: `${siparis.barkod} numaralı sipariş emri tarafınıza iletilmiştir.`,
                type: 'success',
                link: `/portal/tedarikci/siparisler/${siparis.id}`
            })
        }
    }

    // --- TEŞEKKÜR MAİLLERİ (Lose Notification) ---
    // Kazananmayan tedarikçilere (katılımcılara) teşekkür/bilgilendirme maili gönder
    const kazananTedarikciIds = Object.keys(gruplar).map(id => parseInt(id))

    // Teklif veren benzersiz tedarikçileri bul (Hem teklifler hem de davet edilenlerden yanıtlayanlar)
    const katilimcilar = new Map()
    rfq.teklifler.forEach(t => {
        katilimcilar.set(t.tedarikciId, t.tedarikci)
    })

    if (rfq.tedarikciler) {
        rfq.tedarikciler.forEach(rt => {
            if (rt.durum === 'YANITLADI') {
                katilimcilar.set(rt.tedarikciId, rt.tedarikci)
            }
        })
    }

    for (const [tedarikciId, tedarikci] of katilimcilar) {
        if (!kazananTedarikciIds.includes(tedarikciId)) {
            if (tedarikci.email) {
                try {
                    const html = renderThankYouEmail(tedarikci, rfq)
                    await transporter.sendMail({
                        from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
                        to: tedarikci.email,
                        subject: `İhale Sonuçlandı - ${rfq.rfqNo} - ${rfq.baslik}`,
                        html
                    })
                } catch (err) {
                    console.error(`Teşekkür maili gönderilemedi (${tedarikci.email}):`, err)
                }
            }

            // Uygulama içi bildirim (Kazanamayan)
            const hasAccount = await prisma.user.findFirst({
                where: { tedarikciId: tedarikciId }
            })
            if (hasAccount) {
                await createNotification({
                    userId: hasAccount.id,
                    title: 'İhale Sonuçlandı',
                    message: `${rfq.rfqNo} - ${rfq.baslik} ihalemiz sonuçlanmıştır. Katılımınız için teşekkür ederiz.`,
                    type: 'info',
                    link: '/portal/tedarikci/rfq'
                })
            }
        }
    }

    // RFQ durumunu TAMAMLANDI yap
    await prisma.rFQ.update({
        where: { id: rfqId },
        data: { durum: 'TAMAMLANDI' }
    })

    // Birimleri bilgilendir
    const bildirimEmailleri = new Set(rfq.kalemler.map(k => k.talep.bildirimEmail).filter(Boolean))
    for (const email of bildirimEmailleri) {
        await sendInternalNotification(
            email as string,
            `Siparişler Oluşturuldu: ${rfq.rfqNo}`,
            `
            <h3>Sipariş Bildirimi</h3>
            <p><strong>İhale No:</strong> ${rfq.rfqNo}</p>
            <p><strong>Konu:</strong> ${rfq.baslik}</p>
            <p><strong>Oluşturulan Sipariş Sayısı:</strong> ${Object.keys(gruplar).length}</p>
            <p>İhale süreci tamamlanmış ve seçilen tedarikçiler için sipariş emirleri oluşturulmuştur.</p>
            `
        )
    }

    // Siparişler oluşturuldu bildirimi (Satınalma)
    await createNotification({
        title: 'Siparişler Kesildi',
        message: `${rfq.rfqNo} ihalesi sonuçlandırıldı, ${siparisler.length} adet sipariş emri oluşturuldu.`,
        type: 'success',
        link: '/siparisler'
    })

    revalidatePath('/rfq')
    revalidatePath('/siparisler')

    return siparisler
}

export async function getOnayliTalepler() {
    await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    return await prisma.talep.findMany({
        where: {
            durum: {
                in: ['ONAYLANDI']
            },
            siparis: null // Henüz siparişe dönüşmemiş
        },
        include: {
            ilgiliKisi: true,
            kalemler: true
        },
        orderBy: { tarih: 'desc' }
    })
}

export async function suggestCategoryForKalemler(talepKalemIds: number[]) {
    // Basit implementasyon: Kalem açıklamalarına göre önerilen kategoriyi döndür
    // İleride AI entegrasyonu yapılabilir
    const kategoriler = await prisma.tedarikciKategori.findMany({
        where: { aktif: true }
    })
    return kategoriler
}

// --- TUR SİSTEMİ (ÇOK TURLU TEKLİF TOPLAMA) ---

export async function startNewRound(rfqId: number, bitisTarihi: Date) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
            tedarikciler: {
                include: { tedarikci: true, teklifToken: true }
            }
        }
    })

    if (!rfq) throw new Error('RFQ bulunamadı')
    if (rfq.durum === 'TAMAMLANDI' || rfq.durum === 'IPTAL') {
        throw new Error('Bu ihale sonuçlanmış veya iptal edilmiş')
    }
    if (rfq.mevcutTur >= rfq.maksimumTur) {
        throw new Error(`Maksimum tur sayısına (${rfq.maksimumTur}) ulaşıldı`)
    }

    const yeniTur = rfq.mevcutTur + 1

    // RFQ'yu güncelle
    await prisma.rFQ.update({
        where: { id: rfqId },
        data: {
            mevcutTur: yeniTur,
            turBitisTarihi: bitisTarihi,
            turDurumu: 'AKTIF',
            sonTeklifTarihi: bitisTarihi
        }
    })

    // SMTP Config for Email
    const smtp = await getSMTPConfig()
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass
        }
    })

    // Tüm tedarikçilere yeni tur bildirimi gönder
    for (const rt of rfq.tedarikciler) {
        if (rt.tedarikci.email && rt.teklifToken) {
            try {
                // Kayıtlı kullanıcı kontrolü
                const hasAccount = await prisma.user.findFirst({
                    where: { tedarikciId: rt.tedarikciId }
                })

                const teklifUrl = hasAccount
                    ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/portal/tedarikci/rfq`
                    : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/teklif/${rt.teklifToken.token}`

                await transporter.sendMail({
                    from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
                    to: rt.tedarikci.email,
                    subject: `Yeni Tur Bildirimi - ${rfq.rfqNo} (Tur ${yeniTur})`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: #3b82f6; color: white; padding: 20px; text-align: center;">
                                <h1 style="margin: 0;">TUR ${yeniTur} BAŞLADI</h1>
                            </div>
                            <div style="padding: 20px; background: #f8fafc;">
                                <p>Sayın ${rt.tedarikci.yetkiliKisi || rt.tedarikci.ad},</p>
                                <p><strong>${rfq.baslik}</strong> konulu ihale için <strong>Tur ${yeniTur}</strong> başlamıştır.</p>
                                <p>Önceki turlardaki teklifinizi gözden geçirerek revize edebilirsiniz.</p>
                                <p><strong>Son Teklif Tarihi:</strong> ${bitisTarihi.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${teklifUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                        Teklifi Revize Et
                                    </a>
                                </div>
                            </div>
                            <div style="padding: 10px; background: #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
                                Satinalma PRO | İhale Yönetim Sistemi
                            </div>
                        </div>
                    `
                })

                // Uygulama içi bildirim
                if (hasAccount) {
                    await createNotification({
                        userId: hasAccount.id,
                        title: `Yeni Tur Başladı (Tur ${yeniTur})`,
                        message: `${rfq.rfqNo} ihalemizde yeni bir tur başladı. Teklifinizi revize edebilirsiniz.`,
                        type: 'info',
                        link: '/portal/tedarikci/rfq'
                    })
                }
            } catch (err) {
                console.error(`Tur bildirimi gönderilemedi (${rt.tedarikci.email}):`, err)
            }
        }
    }

    revalidatePath('/rfq')
    revalidatePath(`/rfq/${rfqId}`)

    return { turNo: yeniTur }
}

export async function closeCurrentRound(rfqId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId } })
    if (!rfq) throw new Error('RFQ bulunamadı')

    await prisma.rFQ.update({
        where: { id: rfqId },
        data: {
            turDurumu: 'KAPALI'
        }
    })

    revalidatePath('/rfq')
    revalidatePath(`/rfq/${rfqId}`)

    return { success: true }
}

export async function getRoundOffers(rfqId: number, turNo?: number) {
    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId } })
    if (!rfq) throw new Error('RFQ bulunamadı')

    const where: any = { rfqId }
    if (turNo) {
        where.turNo = turNo
    }

    const teklifler = await prisma.teklif.findMany({
        where,
        include: {
            tedarikci: true,
            kalemler: {
                include: { talepKalem: true, rfqKalem: true }
            }
        },
        orderBy: [{ turNo: 'asc' }, { tedarikciId: 'asc' }]
    })

    return teklifler
}

export async function getOfferHistory(rfqId: number, tedarikciId: number) {
    const teklifler = await prisma.teklif.findMany({
        where: { rfqId, tedarikciId },
        include: {
            kalemler: { include: { talepKalem: true } }
        },
        orderBy: { turNo: 'asc' }
    })

    return teklifler
}

// --- BİRİM BİLGİLENDİRME (INTERNAL NOTIFICATION) ---

export async function sendInternalNotification(to: string, subject: string, htmlContent: string) {
    try {
        const smtp = await getSMTPConfig()
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            }
        })

        await transporter.sendMail({
            from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
            to,
            subject: `[Satinalma PRO] ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: #1e293b; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Birim Bilgilendirme</h2>
                    </div>
                    <div style="padding: 30px; line-height: 1.6; color: #334155;">
                        ${htmlContent}
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
                            Bu mail Satinalma PRO sistemi tarafından otomatik olarak gönderilmiştir.
                        </div>
                    </div>
                </div>
            `
        })
        return { success: true }
    } catch (err) {
        console.error('Internal notification error:', err)
        return { success: false, error: (err as Error).message }
    }
}

// --- REPORTING & ANALYTICS ACTIONS ---

export async function getReportingData(filters: { startDate?: Date, endDate?: Date } = {}) {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const role = (session.user as any).role
    const personelId = (session.user as any).personelId

    let birimId: number | null = null
    if (role === 'BIRIM' && personelId) {
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })
        birimId = personel?.birimId || null
    }

    const { startDate, endDate } = filters

    const where: any = birimId ? { birimId } : {}
    if (startDate || endDate) {
        where.tarih = {}
        if (startDate) where.tarih.gte = startDate
        if (endDate) where.tarih.lte = endDate
    }

    // 1. Siparişleri getir
    const siparisler = await prisma.siparis.findMany({
        where: { ...where, durum: 'TAMAMLANDI' },
        include: {
            birim: true,
            yonetmelik: true,
            alimYontemi: true,
            faturalar: true,
            kalemSecimleri: {
                include: {
                    teklif: {
                        include: { kalemler: true }
                    },
                    rfqKalem: {
                        include: {
                            teklifKalemleri: {
                                include: {
                                    teklif: true
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    // 2. Metrikleri hesapla
    let totalSpending = 0
    let totalNegotiatedSavings = 0
    let totalCompetitiveSavings = 0

    const unitDistribution: { [key: string]: number } = {}
    const regulationDistribution: { [key: string]: number } = {}
    const methodDistribution: { [key: string]: number } = {}

    siparisler.forEach(s => {
        // Harcama
        const orderSpending = s.faturalar.reduce((sum, f) => sum + Number(f.tutar), 0) ||
            s.kalemSecimleri.reduce((sum, ks) => {
                const tk = ks.teklif.kalemler.find(t => t.talepKalemId === ks.rfqKalem.talepKalemId)
                return sum + (Number(tk?.birimFiyat || 0) * (ks.rfqKalem.miktar || 0))
            }, 0)

        totalSpending += orderSpending

        // Avantaj Hesabı (Gelişmiş)
        s.kalemSecimleri.forEach(ks => {
            const quantity = ks.rfqKalem.miktar || 0
            const selectedTeklif = ks.teklif
            const selectedSupplierId = selectedTeklif.tedarikciId
            const selectedPrice = Number(selectedTeklif.kalemler.find(tk => tk.talepKalemId === ks.rfqKalem.talepKalemId)?.birimFiyat || 0)

            // Tüm geçerli teklif kalemlerini al (bu bu rfq kalemi için)
            const allOfferNodes = ks.rfqKalem.teklifKalemleri
            const allPrices = allOfferNodes.map(tk => Number(tk.birimFiyat))

            if (allPrices.length > 0) {
                // A. Pazarlık Kazancı: Seçilen tedarikçinin ilk teklifi vs son teklifi
                const selectedSupplierOffers = allOfferNodes
                    .filter(node => node.teklif.tedarikciId === selectedSupplierId)
                    .sort((a, b) => a.teklif.turNo - b.teklif.turNo)

                if (selectedSupplierOffers.length > 1) {
                    const firstPrice = Number(selectedSupplierOffers[0].birimFiyat)
                    totalNegotiatedSavings += (firstPrice - selectedPrice) * quantity
                }

                // B. Rekabet Kazancı: Piyasa ortalaması vs Seçilen fiyat
                const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
                if (avgPrice > selectedPrice) {
                    totalCompetitiveSavings += (avgPrice - selectedPrice) * quantity
                }
            }
        })

        // Dağılımlar
        const unitName = s.birim.ad
        unitDistribution[unitName] = (unitDistribution[unitName] || 0) + orderSpending

        const regName = s.yonetmelik.madde
        regulationDistribution[regName] = (regulationDistribution[regName] || 0) + orderSpending

        const methodName = s.alimYontemi.ad
        methodDistribution[methodName] = (methodDistribution[methodName] || 0) + orderSpending
    })

    const activeSuppliers = await prisma.tedarikci.count({ where: { aktif: true } })

    return {
        kpis: {
            totalSpending,
            totalNegotiatedSavings,
            totalCompetitiveSavings,
            totalAdvantage: totalNegotiatedSavings + totalCompetitiveSavings,
            orderCount: siparisler.length,
            activeSuppliers
        },
        distributions: {
            units: Object.entries(unitDistribution).map(([name, value]) => ({ name, value })),
            regulations: Object.entries(regulationDistribution).map(([name, value]) => ({ name, value })),
            methods: Object.entries(methodDistribution).map(([name, value]) => ({ name, value }))
        }
    }
}

export async function getPurchaserPerformance() {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const role = (session.user as any).role
    const personelId = (session.user as any).personelId

    let birimId: number | null = null
    if (role === 'BIRIM' && personelId) {
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })
        birimId = personel?.birimId || null
    }

    const purchasers = await prisma.personel.findMany({
        where: { 
            aktif: true,
            ...(birimId ? { birimId } : {})
        },
        include: {
            olusturulanRFQler: {
                include: {
                    siparisler: {
                        include: {
                            kalemSecimleri: {
                                include: {
                                    teklif: { include: { kalemler: true } },
                                    rfqKalem: {
                                        include: {
                                            teklifKalemleri: { include: { teklif: true } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    return purchasers.map(p => {
        let totalNegotiatedSavings = 0
        let totalCompetitiveSavings = 0
        let totalSpending = 0
        let orderCount = 0
        let totalRounds = 0

        p.olusturulanRFQler.forEach(rfq => {
            totalRounds += rfq.mevcutTur
            rfq.siparisler.forEach(s => {
                orderCount++
                s.kalemSecimleri.forEach(ks => {
                    const quantity = ks.rfqKalem.miktar || 0
                    const selectedPriceNode = ks.teklif.kalemler.find(tk => tk.talepKalemId === ks.rfqKalem.talepKalemId)
                    const selectedPrice = Number(selectedPriceNode?.birimFiyat || 0)
                    totalSpending += selectedPrice * quantity

                    const allOfferNodes = ks.rfqKalem.teklifKalemleri
                    const allPrices = allOfferNodes.map(tk => Number(tk.birimFiyat))

                    if (allPrices.length > 0) {
                        // Pazarlık
                        const selectedSupplierId = ks.teklif.tedarikciId
                        const selectedSupplierOffers = allOfferNodes
                            .filter(node => node.teklif.tedarikciId === selectedSupplierId)
                            .sort((a, b) => a.teklif.turNo - b.teklif.turNo)

                        if (selectedSupplierOffers.length > 1) {
                            const firstPrice = Number(selectedSupplierOffers[0].birimFiyat)
                            totalNegotiatedSavings += (firstPrice - selectedPrice) * quantity
                        }

                        // Rekabet
                        const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
                        if (avgPrice > selectedPrice) {
                            totalCompetitiveSavings += (avgPrice - selectedPrice) * quantity
                        }
                    }
                })
            })
        })

        const totalAdvantage = totalNegotiatedSavings + totalCompetitiveSavings

        return {
            id: p.id,
            name: p.adSoyad,
            rfqCount: p.olusturulanRFQler.length,
            orderCount,
            totalSpending,
            totalNegotiatedSavings,
            totalCompetitiveSavings,
            totalAdvantage,
            avgRounds: p.olusturulanRFQler.length > 0 ? totalRounds / p.olusturulanRFQler.length : 0,
            advantageRatio: totalSpending > 0 ? (totalAdvantage / (totalSpending + totalAdvantage)) * 100 : 0
        }
    }).sort((a, b) => b.totalAdvantage - a.totalAdvantage)
}

export async function getSupplierPerformanceReport() {
    const session = await checkAuth(['ADMIN', 'SATINALMA', 'BIRIM'])
    const role = (session.user as any).role
    const personelId = (session.user as any).personelId

    let birimId: number | null = null
    if (role === 'BIRIM' && personelId) {
        const personel = await prisma.personel.findUnique({
            where: { id: personelId },
            select: { birimId: true }
        })
        birimId = personel?.birimId || null
    }

    const suppliers = await prisma.tedarikci.findMany({
        where: { aktif: true },
        include: {
            siparislar: {
                where: birimId ? { birimId } : undefined,
                include: {
                    kalemSecimleri: {
                        include: {
                            teklif: { include: { kalemler: true } },
                            rfqKalem: {
                                include: {
                                    teklifKalemleri: { include: { teklif: true } }
                                }
                            }
                        }
                    },
                    faturalar: true
                }
            }
        }
    })

    return suppliers.map(s => {
        let totalVolume = 0
        let totalAdvantage = 0

        s.siparislar.forEach(sip => {
            const orderSpending = sip.faturalar.reduce((sum, f) => sum + Number(f.tutar), 0) ||
                sip.kalemSecimleri.reduce((sum, ks) => {
                    const tk = ks.teklif.kalemler.find(t => t.talepKalemId === ks.rfqKalem.talepKalemId)
                    return sum + (Number(tk?.birimFiyat || 0) * (ks.rfqKalem.miktar || 0))
                }, 0)

            totalVolume += orderSpending

            sip.kalemSecimleri.forEach(ks => {
                const quantity = ks.rfqKalem.miktar || 0
                const selectedPrice = Number(ks.teklif.kalemler.find(tk => tk.talepKalemId === ks.rfqKalem.talepKalemId)?.birimFiyat || 0)
                const allPrices = ks.rfqKalem.teklifKalemleri.map(tk => Number(tk.birimFiyat))

                if (allPrices.length > 0) {
                    const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length
                    if (avgPrice > selectedPrice) {
                        totalAdvantage += (avgPrice - selectedPrice) * quantity
                    }
                }
            })
        })

        return {
            id: s.id,
            name: s.ad,
            orderCount: s.siparislar.length,
            totalVolume,
            totalAdvantage,
            advantageRatio: totalVolume > 0 ? (totalAdvantage / (totalVolume + totalAdvantage)) * 100 : 0
        }
    }).filter(s => s.orderCount > 0).sort((a, b) => b.totalVolume - a.totalVolume)
}

// --- EVALUATION FLOW REDESIGN ACTIONS ---

export async function sendEvaluationEmail(siparisId: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    const siparis = await prisma.siparis.findUnique({
        where: { id: siparisId },
        include: {
            talep: { include: { birim: true, ilgiliKisi: true } },
            tedarikci: true,
            degerlendirmeFormTipi: true
        }
    })

    if (!siparis || !siparis.tedarikci) return

    // Birim mailini al (Öncelik ilgili kisi, sonra talep maili, sonra birim maili)
    const targetEmail = siparis.talep.ilgiliKisi?.email || siparis.talep.bildirimEmail || siparis.talep.birim?.email
    if (!targetEmail) {
        console.warn(`Sipariş ${siparis.barkod} için değerlendirme maili gönderilecek adres bulunamadı. Sadece portal bildirimi atılacak.`)
    }

    // Token oluştur
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    await prisma.degerlendirmeToken.upsert({
        where: { siparisId },
        create: { token, siparisId },
        update: { token, kullanildi: false }
    })

    const evaluationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/degerlendir/${token}`

    // Sistem içi portal bildirimi gönder
    try {
        const userToNotify = await prisma.user.findUnique({
            where: { personelId: siparis.talep.ilgiliKisiId }
        })
        if (userToNotify) {
            await prisma.notification.create({
                data: {
                    userId: userToNotify.id,
                    title: 'Tedarikçi Değerlendirmesi Bekleniyor',
                    message: `${siparis.barkod} siparişi tamamlandı. Kalitesini ve tedarikçiyi değerlendirmeniz bekleniyor.`,
                    type: 'info',
                    link: `/degerlendir/${token}`
                }
            })
        }
    } catch (err) {
        console.error("Bildirim oluşturma hatası:", err)
    }

    // Email gönder
    if (targetEmail) {
        try {
            const smtp = await getSMTPConfig()
            const transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                auth: { user: smtp.user, pass: smtp.pass }
            })

            const emailHtml = renderEvaluationRequestEmail(siparis, evaluationLink)

            await transporter.sendMail({
                from: smtp.from || `"Satinalma PRO" <${smtp.user}>`,
                to: targetEmail,
                subject: `Tedarikçi Performans Değerlendirmesi - ${siparis.tedarikci.ad}`,
                html: emailHtml
            })
        } catch (err) {
            console.error("Değerlendirme e-postası gönderilemedi:", err)
        }
    }
}

export async function getDegerlendirmeByToken(token: string) {
    const tokenRecord = await prisma.degerlendirmeToken.findUnique({
        where: { token },
        include: {
            siparis: {
                include: {
                    tedarikci: true,
                    degerlendirmeFormTipi: {
                        include: {
                            gruplar: {
                                include: { sorular: true }
                            }
                        }
                    }
                }
            }
        }
    })

    if (!tokenRecord || tokenRecord.kullanildi) {
        return null
    }

    return tokenRecord.siparis
}

export async function submitExternalDegerlendirme(token: string, data: {
    cevaplar: { soruId: number, puan: number, aciklama?: string }[]
}) {
    const tokenRecord = await prisma.degerlendirmeToken.findUnique({
        where: { token },
        include: { siparis: true }
    })

    if (!tokenRecord || tokenRecord.kullanildi) {
        throw new Error('Geçersiz veya kullanılmış token')
    }

    const siparis = tokenRecord.siparis
    if (!siparis.degerlendirmeFormTipiId) {
        throw new Error('Sipariş için değerlendirme modeli belirlenmemiş')
    }

    // Profesyonel değerlendirme formunu oluştur
    const form = await createDegerlendirmeFormu({
        tedarikciId: siparis.tedarikciId!,
        formTipiId: siparis.degerlendirmeFormTipiId,
        siparisId: siparis.id,
        degerlendiren: 'Birim Temsilcisi (Email üzerinden)',
        cevaplar: data.cevaplar
    })

    // Token'ı kullanıldı olarak işaretle
    await prisma.degerlendirmeToken.update({
        where: { id: tokenRecord.id },
        data: { kullanildi: true }
    })

    return form
}
// --- CATEGORY APPROVAL ACTIONS ---

export async function getPendingCategoryRequests() {
    await checkAuth(['ADMIN', 'SATINALMA'])
    return await prisma.tedarikciKategoriOnay.findMany({
        where: { durum: 'BEKLIYOR' },
        include: {
            tedarikci: true,
            kategori: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function approveCategoryRequest(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    return await prisma.$transaction(async (tx) => {
        const request = await tx.tedarikciKategoriOnay.update({
            where: { id },
            data: { durum: 'ONAYLANDI' }
        })

        // Tedarikçinin kategorilerine ekle
        await tx.tedarikci.update({
            where: { id: request.tedarikciId },
            data: {
                kategoriler: {
                    connect: { id: request.kategoriId }
                }
            }
        })

        return request
    })
}

export async function rejectCategoryRequest(id: number) {
    await checkAuth(['ADMIN', 'SATINALMA'])
    return await prisma.tedarikciKategoriOnay.update({
        where: { id },
        data: { durum: 'REDDEDILDI' }
    })
}
