import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/basic'
import { X, Printer } from 'lucide-react'
import { useHospital } from '@/context/HospitalContext'

// Receipt Modal — rendered via Portal to escape Radix Dialog focus trap
export function ReceiptModal({ open, onClose, sale, items }: { open: boolean, onClose: () => void, sale: any, items: any[] }) {
    const { hospital, managedClinic, clinics, profile } = useHospital()

    if (!open) return null

    const myClinic = profile?.clinic_id ? clinics.find(c => c.id === profile.clinic_id) : null
    const activeClinic = managedClinic || myClinic

    const receiptHeaderName = activeClinic?.name || hospital?.name || 'MedFlow Clinic'
    const receiptHeaderSubtext = activeClinic?.address || 'Excellence in Healthcare'
    if (!open) return null

    const modalContent = (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0"
            style={{ pointerEvents: 'auto' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div
                className="relative bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden print:shadow-none print:w-full"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEAD (Hidden in Print) */}
                <div className="flex justify-between items-center p-4 border-b bg-slate-50 print:hidden">
                    <h3 className="font-bold text-slate-800">Transaction Receipt</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* RECEIPT BODY */}
                <div className="p-6 space-y-4 print:p-0" id="receipt-content">
                    <div className="text-center border-b pb-4 mb-4">
                        <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">{receiptHeaderName}</h2>
                        <p className="text-xs text-slate-500">{receiptHeaderSubtext}</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {sale?.timestamp ? new Date(sale.timestamp).toLocaleString() : new Date().toLocaleString()}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                        <span className="text-slate-500">Patient:</span>
                        <span className="font-semibold text-right">{sale?.patient_name || 'Guest'}</span>
                        <span className="text-slate-500">Doctor/Staff:</span>
                        <span className="font-semibold text-right">{sale?.doctor_name || 'Staff'}</span>
                        <span className="text-slate-500">Type:</span>
                        <span className="font-semibold text-right">{sale?.sale_type?.replace('_', ' ') || 'N/A'}</span>
                        <span className="text-slate-500">Payment:</span>
                        <span className="font-semibold text-right">{sale?.payment_mode || 'Cash'}</span>
                        <span className="text-slate-500">Receipt #:</span>
                        <span className="font-mono text-right">{sale?.id ? sale.id.slice(0, 8) : 'PENDING'}</span>
                    </div>

                    {/* ITEMS TABLE */}
                    {items && items.length > 0 && (
                        <div className="border-t border-b py-2 my-2">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400 border-b border-dashed">
                                        <th className="text-left py-1">Item</th>
                                        <th className="text-center py-1">Qty</th>
                                        <th className="text-right py-1">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((i: any, idx: number) => (
                                        <tr key={idx} className="border-b border-slate-50">
                                            <td className="py-1">{i.item_name}</td>
                                            <td className="text-center py-1">{i.quantity}</td>
                                            <td className="text-right py-1">₹{i.price * i.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TOTALS */}
                    <div className="flex justify-between items-center text-lg font-bold pt-2">
                        <span>Total Paid</span>
                        <span>₹{Number(sale?.amount || 0).toFixed(2)}</span>
                    </div>
                </div>

                {/* FOOTER (Hidden in Print) */}
                <div className="p-4 bg-slate-50 border-t print:hidden flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
                    <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                </div>
            </div>
        </div>
    )

    // Portal to document.body to escape Radix Dialog's focus trap
    return createPortal(modalContent, document.body)
}
