import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { numberToWords } from '@/lib/utils';
import { Printer, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/basic';

interface TaxInvoiceProps {
    order: any;
    items: any[];
    hospital: any;
    supplier: any;
    clinic: any;
}

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ order, items, hospital, supplier, clinic }) => {
    if (!order || !hospital || !supplier) return null;

    const isIntraState = order.state_code === hospital.state_code || !order.state_code;

    return (
        <div className="bg-white p-8 max-w-4xl mx-auto shadow-lg border border-slate-200" id="tax-invoice">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-slate-900 uppercase">Tax Invoice</h1>
                    <div className="text-sm space-y-1">
                        <p className="font-bold text-lg">{hospital.name}</p>
                        <p className="text-slate-600 font-medium">{hospital.address}</p>
                        <p className="font-bold">GSTIN: {hospital.gst_number || 'N/A'}</p>
                        <p>State: {hospital.state || 'N/A'} (Code: {hospital.state_code || 'N/A'})</p>
                    </div>
                </div>
                <div className="text-right space-y-1">
                    <div className="bg-slate-100 p-3 rounded-lg mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Invoice Number</p>
                        <p className="text-xl font-black text-blue-600">PO-{order.order_number}</p>
                    </div>
                    <p className="text-sm font-medium">Date: {new Date(order.created_at).toLocaleDateString('en-IN')}</p>
                    {order.irn_number && (
                        <p className="text-[10px] font-mono text-slate-500">IRN: {order.irn_number}</p>
                    )}
                </div>
            </div>

            {/* Bill To / Ship To */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Supplier (Bill From)</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-bold">{supplier.name}</p>
                        <p className="text-slate-600">{supplier.billing_address || supplier.address}</p>
                        <p className="font-bold">GSTIN: {supplier.gst_number || 'N/A'}</p>
                        <p>State: {supplier.state || 'N/A'} (Code: {supplier.state_code || 'N/A'})</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ship To (Place of Supply)</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-bold">{clinic?.name || 'Main Centre'}</p>
                        <p className="text-slate-600">{clinic?.address || hospital.address}</p>
                        <p className="font-bold font-medium">State of Supply: {order.place_of_supply || clinic?.state || hospital.state}</p>
                        <p>State Code: {order.state_code || clinic?.state_code || hospital.state_code}</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Description of Goods</TableHead>
                            <TableHead>HSN</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Disc %</TableHead>
                            <TableHead className="text-right">Taxable Val</TableHead>
                            <TableHead className="text-right">GST %</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, idx) => {
                            const basic = item.quantity_ordered * item.unit_price;
                            const discAmt = basic * (item.discount_percent / 100);
                            const taxable = basic - discAmt;
                            const tax = taxable * (item.gst_rate / 100);
                            return (
                                <TableRow key={idx} className="text-xs">
                                    <TableCell>{idx + 1}</TableCell>
                                    <TableCell className="font-medium text-slate-800">{item.item_name}</TableCell>
                                    <TableCell>{item.hsn_code || '-'}</TableCell>
                                    <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                                    <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{item.discount_percent}%</TableCell>
                                    <TableCell className="text-right">₹{taxable.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{item.gst_rate}%</TableCell>
                                    <TableCell className="text-right font-bold">₹{(taxable + tax).toLocaleString()}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Amount in Words</p>
                        <p className="text-xs font-bold text-slate-700 italic">Rupees {numberToWords(Math.round(order.total_amount))} Only</p>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details</h3>
                        <div className="text-[10px] grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                                <p>Bank Name: <span className="font-bold text-slate-800">{supplier.bank_name || 'N/A'}</span></p>
                                <p>A/c No: <span className="font-bold text-slate-800">{supplier.account_number || 'N/A'}</span></p>
                            </div>
                            <div>
                                <p>IFSC: <span className="font-bold text-slate-800">{supplier.ifsc_code || 'N/A'}</span></p>
                                <p>Branch: <span className="font-bold text-slate-800">{supplier.branch_name || 'N/A'}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm py-1">
                        <span className="text-slate-500">Taxable Amount:</span>
                        <span className="font-bold">₹{order.basic_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1">
                        <span className="text-slate-500">Discount:</span>
                        <span className="font-bold text-red-600">-₹{order.discount_amount?.toLocaleString()}</span>
                    </div>
                    {isIntraState ? (
                        <>
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-slate-500">CGST ({order.items?.[0]?.gst_rate / 2 || 9}%):</span>
                                <span className="font-bold">₹{(order.tax_amount / 2).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-slate-500">SGST ({order.items?.[0]?.gst_rate / 2 || 9}%):</span>
                                <span className="font-bold">₹{(order.tax_amount / 2).toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-slate-500">IGST ({order.items?.[0]?.gst_rate || 18}%):</span>
                            <span className="font-bold">₹{order.tax_amount?.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center bg-slate-100 p-3 rounded-lg text-slate-900 mb-2">
                        <span className="font-black uppercase tracking-widest text-sm">Grand Total (Incl. Taxes)</span>
                        <span className="text-2xl font-black">₹{order.total_amount?.toLocaleString()}</span>
                    </div>
                    {order.advance_paid > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm py-1 text-emerald-600 font-bold border-b border-dashed border-emerald-200">
                                <span>Advance Paid:</span>
                                <span>-₹{order.advance_paid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-lg">
                                <span className="font-black uppercase tracking-widest text-sm">Net Balance Due</span>
                                <span className="text-2xl font-black">₹{(order.total_amount - order.advance_paid).toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-12 border-t border-slate-100">
                <div className="text-[10px] text-slate-500 leading-relaxed italic">
                    <p className="font-bold not-italic mb-2 text-slate-700">Terms & Conditions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Goods once sold will not be taken back.</li>
                        <li>Interest @18% p.a. will be charged if payment is not made within the credit period.</li>
                        <li>Subject to local jurisdiction.</li>
                    </ul>
                </div>
                <div className="flex flex-col items-center justify-end text-center space-y-8">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">For {supplier.name}</p>
                        <div className="h-16 w-32 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-300">
                            Supplier Signature
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-800 uppercase">Authorized Signatory</p>
                </div>
            </div>
        </div>
    );
};

export const TaxInvoiceControls: React.FC<{onPrint: () => void}> = ({onPrint}) => (
    <div className="flex gap-2 print:hidden justify-center mb-6">
        <Button onClick={onPrint} className="bg-slate-900 hover:bg-slate-800 text-white flex gap-2 items-center px-6">
            <Printer className="w-4 h-4" /> Print Invoice
        </Button>
        <Button variant="outline" className="flex gap-2 items-center">
            <Download className="w-4 h-4" /> Download PDF
        </Button>
        <Button variant="outline" className="flex gap-2 items-center">
            <Share2 className="w-4 h-4" /> Share
        </Button>
    </div>
);
