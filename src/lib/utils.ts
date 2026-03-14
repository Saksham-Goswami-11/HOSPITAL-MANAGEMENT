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
