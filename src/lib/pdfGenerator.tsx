import React from 'react'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { SiparisPDF } from '@/components/SiparisPDF'
import path from 'path'
import fs from 'fs'

let regularBuffer: Buffer | null = null
let boldBuffer: Buffer | null = null

// Use a global flag to ensure Font.register is only ever called ONCE.
// We also use Font.load to await the actual CDN download before we continue.
async function registerFonts() {
    if ((global as any)._siparisFontRegistered) return;

    try {
        Font.register({
            family: 'Roboto',
            fonts: [
                { src: 'https://cdnjs.cloudflare.com/ajax/libs/roboto-fontface/0.10.0/fonts/roboto/Roboto-Regular.ttf', fontWeight: 'normal' },
                { src: 'https://cdnjs.cloudflare.com/ajax/libs/roboto-fontface/0.10.0/fonts/roboto/Roboto-Bold.ttf', fontWeight: 'bold' }
            ]
        })
        
        // AWAIT the fonts to be loaded from CDN before proceeding
        await Promise.all([
            (Font as any).load({ family: 'Roboto', fontWeight: 'normal' }),
            (Font as any).load({ family: 'Roboto', fontWeight: 'bold' })
        ])

        ;(global as any)._siparisFontRegistered = true;
        console.log("PDF Font 'Roboto' loaded successfully from CDN.");
    } catch (e: any) {
        console.error("Font Registration Helper Error:", e.message)
    }
}

export async function generateSiparisPdfBuffer(siparis: any, tedarikci: any, rfq: any, kalemler: any[], sender: any): Promise<Buffer> {
    try {
        if (!siparis || !tedarikci) throw new Error("Missing siparis or tedarikci data");
        
        // V5.1: AWAIT font loading to ensure registration is complete before render
        await registerFonts()

        const element = React.createElement(SiparisPDF, { siparis, tedarikci, rfq, kalemler, sender })
        if (!element) throw new Error("Failed to create React element for PDF");
        
        const buffer = await renderToBuffer(element as any)
        return Buffer.from(buffer)
    } catch (error: any) {
        console.error("PDF Component Rendering Error:", error);
        throw error; // Rethrow to be caught by the route handler
    }
}
