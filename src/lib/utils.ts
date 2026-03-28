import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function generateWhatsAppMessage(
    date: string,
    revenue: number,
    footfall: number,
    lowStock: any[]
) {
    const alerts = lowStock.length > 0
        ? lowStock.map(i => `⚠️ *Alert:* ${i.clinic_name} is low on '${i.item_name}'.`).join('\n   ')
        : '✅ All systems synced.'

    return encodeURIComponent(
        `🏥 *ARTEMIS SATELLITE REPORT* 🏥\n` +
        `📅 Date: ${date}\n` +
        `💰 Total Revenue: ₹${revenue}\n` +
        `👥 Total Patients: ${footfall}\n` +
        `${alerts}`
    )
}
export function getStartOfTodayIST() {
    const now = new Date();
    const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
    return `${istDate}T00:00:00+05:30`;
}

export function getTodayIST() {
    const now = new Date();
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now); // Returns YYYY-MM-DD
}

export function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' : '') + a[n % 10];
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
    };

    const whole = Math.floor(Math.abs(num));
    const decimal = Math.round((Math.abs(num) - whole) * 100);
    
    let result = inWords(whole) + 'Rupees ';
    if (decimal > 0) {
        result += 'and ' + inWords(decimal) + 'Paise ';
    }
    return result + 'Only';
}
