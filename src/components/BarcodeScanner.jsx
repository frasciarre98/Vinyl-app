import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

export function BarcodeScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);

    useEffect(() => {
        // Create scanner instance
        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
            false // verbose
        );

        html5QrcodeScanner.render(
            (decodedText) => {
                // Return result and close scanner
                if (html5QrcodeScanner) {
                    html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner", err));
                }
                onScan(decodedText);
            },
            (errorMessage) => {
                // Ignore errors as they happen constantly when no barcode is in frame
                // console.warn(errorMessage);
            }
        );

        scannerRef.current = html5QrcodeScanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => {
                    console.error("Failed to clear scanner on unmount", err);
                });
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col pt-16 animate-in fade-in zoom-in duration-300">
            <div className="relative w-full max-w-md mx-auto px-4 flex-1 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white">Scan Barcode</h2>
                    <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full transition-colors hover:bg-white/20">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <p className="text-white/60 text-center mb-6 shrink-0">Position the barcode inside the frame to scan automatically.</p>

                <div className="relative w-full aspect-square bg-black overflow-hidden rounded-2xl border-2 border-white/20">
                    <div id="reader" className="w-full h-full object-cover"></div>
                </div>

                <div className="mt-8 text-center shrink-0">
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white underline font-medium"
                    >
                        Cancel Scanning
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* Clean up the default html5-qrcode UI */
                #reader { border: none !important; }
                #reader__dashboard_section_csr span { color: white !important; }
                #reader__dashboard_section_swaplink { color: #a855f7 !important; text-decoration: underline; margin-top: 10px; display: inline-block; }
                #reader button { 
                    background-color: #a855f7 !important; 
                    color: white !important; 
                    border: none !important; 
                    padding: 8px 16px !important; 
                    border-radius: 8px !important; 
                    font-weight: bold !important;
                    margin: 5px !important;
                    cursor: pointer;
                }
                #reader a { color: white !important; }
                #reader video { object-fit: cover !important; }
            `}} />
        </div>
    );
}
