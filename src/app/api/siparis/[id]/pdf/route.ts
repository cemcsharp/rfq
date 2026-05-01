import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { generateSiparisPdfBuffer } from '@/lib/pdfGenerator'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Helper function to log errors to a local file
function logErrorToFile(errorInfo: string) {
    try {
        const logPath = path.join(process.cwd(), 'pdf_error.log');
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${errorInfo}\n`;
        fs.appendFileSync(logPath, logMessage);
    } catch (e) {
        console.error("Could not write to log file:", e);
    }
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const siparisIdStr = params.id;
    
    logErrorToFile(`[V5.1-AWAIT-LOAD] PDF Request started for ID: ${siparisIdStr}. CWD: ${process.cwd()}`);
    
    try {
        if (!siparisIdStr) throw new Error("Missing ID in request params");
        const session = await auth()
        if (!session?.user) {
            logErrorToFile(`Unauthorized access attempt to PDF ID: ${siparisIdStr}`);
            return new NextResponse(JSON.stringify({ error: 'Yetkisiz erişim.' }), { status: 401 });
        }

        const siparisId = parseInt(siparisIdStr)
        if (!siparisId) {
            logErrorToFile(`Invalid Siparis ID: ${siparisIdStr}`);
            return new NextResponse(JSON.stringify({ error: 'Geçersiz Sipariş ID.' }), { status: 400 });
        }

        // Fetch Siparis with tedarikci, rfq, and talep
        const siparis = await prisma.siparis.findUnique({
            where: { id: siparisId },
            include: {
                tedarikci: true,
                rfq: true,
                talep: {
                    include: { kalemler: true }
                },
                kalemSecimleri: {
                    include: {
                        rfqKalem: {
                            include: {
                                talepKalem: true
                            }
                        },
                        teklif: {
                            include: {
                                kalemler: {
                                    include: { talepKalem: true }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!siparis) {
            logErrorToFile(`Siparis NOT found in DB. ID: ${siparisId}`);
            return new NextResponse(JSON.stringify({ error: 'Sipariş bulunamadı.' }), { status: 404 });
        }

        // Transform kalemSecimleri with safety checks
        const kalemler: any[] = []
        if (siparis.kalemSecimleri && siparis.kalemSecimleri.length > 0) {
            siparis.kalemSecimleri.forEach(secim => {
                if (secim.rfqKalem && secim.rfqKalem.talepKalem) {
                    kalemler.push({
                        talepKalemId: secim.rfqKalem.talepKalemId,
                        talepKalem: secim.rfqKalem.talepKalem,
                        miktar: secim.rfqKalem.miktar || secim.rfqKalem.talepKalem.miktar,
                        siparisSecimi: {
                            teklif: secim.teklif
                        }
                    })
                }
            })
        }

        // Fallback to talep kalemler if no specific selections found (direct order case)
        if (kalemler.length === 0 && siparis.talep?.kalemler) {
            siparis.talep.kalemler.forEach(tk => {
                kalemler.push({
                    talepKalemId: tk.id,
                    talepKalem: tk,
                    miktar: tk.miktar,
                    siparisSecimi: null
                })
            })
        }

        const sender = {
            name: (session.user as any).name || 'Satınalma Yetkilisi',
            title: (session.user as any).unvan || 'Satınalma Uzmanı',
            email: session.user.email || 'satinalma@kurumsal.pru',
            phone: (session.user as any).telefon || '-'
        }

        const pdfBuffer = await generateSiparisPdfBuffer(
            siparis,
            siparis.tedarikci || {},
            siparis.rfq || {},
            kalemler,
            sender
        )

        // Sanitize filename for Content-Disposition (remove spaces or wrap better)
        const safeBarkod = (siparis.barkod || 'SIPARIS').replace(/[^a-z0-9]/gi, '_');
        const filename = `Siparis_Formu_${safeBarkod}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store'
            }
        })
    } catch (err: any) {
        const errorMsg = `API ERROR [ID: ${siparisIdStr}]: ${err.message}\nStack: ${err.stack}`;
        console.error(errorMsg);
        logErrorToFile(errorMsg);
        
        return new NextResponse(JSON.stringify({ 
            error: 'PDF oluşturulamadı.', 
            details: err.message 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

