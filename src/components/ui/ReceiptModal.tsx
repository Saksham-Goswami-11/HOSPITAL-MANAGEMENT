import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/basic'
import { X, Printer } from 'lucide-react'
import { useHospital } from '@/context/HospitalContext'

import { ReceiptBranding } from './ReceiptBranding'

// Receipt Modal — rendered via Portal to escape Radix Dialog focus trap
export function ReceiptModal({ open, onClose, sale, items }: { open: boolean, onClose: () => void, sale: any, items: any[] }) {
    const { hospital, managedClinic, clinics, profile } = useHospital()

    if (!open) return null

    const myClinic = profile?.clinic_id ? clinics.find(c => c.id === profile.clinic_id) : null
    const activeClinic = managedClinic || myClinic

    const receiptHeaderName = activeClinic?.name || hospital?.name || 'Aarogya Nidhi Clinic'
    const receiptHeaderSubtext = activeClinic?.address || hospital?.address || 'Excellence in Healthcare'
    const patientAddress = sale?.patient_address || ''
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
                className="relative bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden print:shadow-none print:w-full"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEAD (Hidden in Print) */}
                <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 print:hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-600 rounded-full" />
                        <h3 className="font-bold text-slate-800">Transaction Receipt</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                    </button>
                </div>

                {/* RECEIPT BODY */}
                <div className="p-8 space-y-8 print:p-0" id="receipt-content">
                    {/* Header Section */}
                    <div className="flex justify-between items-start border-b pb-6">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">{receiptHeaderName}</h2>
                            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">{receiptHeaderSubtext}</p>
                        </div>
                        <div className="text-right space-y-3">
                            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-md border border-blue-100">
                                Official Invoice
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt Number</p>
                                <p className="font-mono text-sm font-semibold text-slate-900">#{sale?.id ? sale.id.slice(0, 8).toUpperCase() : 'PENDING'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Meta Info Grid */}
                    <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Billed To</p>
                                <p className="font-bold text-slate-900 text-lg uppercase leading-tight">{sale?.patient_name || 'Guest Patient'}</p>
                                {patientAddress && (
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed italic border-l-2 border-slate-200 pl-2">
                                        {patientAddress}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payment Mode</p>
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold text-slate-700 capitalize">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    {sale?.payment_mode || 'Cash'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 text-right">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction Date</p>
                                <p className="font-semibold text-slate-900 text-sm">
                                    {sale?.timestamp ? new Date(sale.timestamp).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                    }) : new Date().toLocaleDateString()}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {sale?.timestamp ? new Date(sale.timestamp).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : new Date().toLocaleTimeString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consultant / Staff</p>
                                <p className="font-semibold text-slate-900 text-sm capitalize">{sale?.doctor_name || 'Medical Staff'}</p>
                            </div>
                        </div>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="mt-8">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-900">
                                    <th className="text-left py-3 w-3/5">Item Description</th>
                                    <th className="text-center py-3">Qty</th>
                                    <th className="text-right py-3">Rate</th>
                                    <th className="text-right py-3">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items && items.length > 0 ? (
                                    items.map((i: any, idx: number) => (
                                        <tr key={idx} className="group">
                                            <td className="py-4 align-top">
                                                <div className="font-semibold text-slate-800">{i.item_name}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 italic">{sale?.sale_type?.replace('_', ' ') || 'Pharmacy'} Product</div>
                                            </td>
                                            <td className="py-4 text-center align-top text-slate-600 font-medium">{i.quantity}</td>
                                            <td className="py-4 text-right align-top text-slate-600 font-medium">₹{(parseFloat(i.price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="py-4 text-right align-top font-bold text-slate-900">
                                                ₹{((parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">No items listed in this transaction</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* TOTALS */}
                    <div className="flex justify-end pt-4">
                        <div className="w-64 space-y-3">
                            {parseFloat(sale?.discount_percentage || '0') > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                                        <span>Subtotal</span>
                                        <span>₹{Number(sale?.subtotal || sale?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold text-red-500 px-2 py-1 bg-red-50 rounded">
                                        <span>Discount ({sale?.discount_percentage}%)</span>
                                        <span>- ₹{(Number(sale?.subtotal || sale?.amount || 0) - Number(sale?.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-end border-t-2 border-slate-900 pt-3 pb-1">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Amount Paid</p>
                                    <p className="text-xl font-black text-slate-900">TOTAL</p>
                                </div>
                                <span className="text-2xl font-black text-blue-600">
                                    ₹{Number(sale?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-between items-end italic">
                        <div className="text-[10px] text-slate-400 leading-relaxed max-w-[200px]">
                            This is a computer-generated document. No signature is required. All disputes subject to local jurisdiction.
                        </div>
                        <ReceiptBranding />
                    </div>
                </div>

                {/* FOOTER (Hidden in Print) */}
                <div className="p-4 bg-slate-50 border-t print:hidden flex gap-3">
                    <Button variant="outline" className="flex-1 font-semibold border-slate-300 hover:bg-white" onClick={onClose}>
                        Return
                    </Button>
                    <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> Print Receipt
                    </Button>
                </div>
            </div>
        </div>
    )

    // Portal to document.body to escape Radix Dialog's focus trap
    return createPortal(modalContent, document.body)
}
