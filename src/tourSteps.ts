import { TourStep } from "./context/TourContext";

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
    {
        targetId: 'welcome-step',
        title: 'Hospital Dashboard',
        content: 'Welcome to your Aarogya Nidhi command center. Here you can monitor your entire hospital network at a glance.',
        route: 'admin'
    },
    {
        targetId: 'tour-revenue-card',
        title: 'Real-time Revenue',
        content: 'Track earnings across all clinics in real-time. Click to see a detailed breakdown by clinic.',
        route: 'admin'
    },
    {
        targetId: 'tour-new-clinic',
        title: 'Register New Clinics',
        content: 'Expanding your network? Use the Hub to register new clinics and assign staff in seconds.',
        route: 'admin'
    },
    {
        targetId: 'tour-analytics-hub',
        title: 'Advanced Analytics',
        content: 'Gain deep insights into your operations with our unified analytics hub. Filter by clinic, payment mode, or service type.',
        route: 'admin'
    },
    {
        targetId: 'tour-inventory',
        title: 'Inventory Control',
        content: 'Manage stocks and supplies across all branches to ensure zero stock-outs of critical items.',
        route: 'inventory-dashboard'
    },
    {
        targetId: 'tour-staff',
        title: 'Staff Management',
        content: 'Oversee your medical and administrative team, manage profiles, and track performance.',
        route: 'staff'
    },
    {
        targetId: 'tour-shifts',
        title: 'Shift Scheduling',
        content: 'Coordinate staff rotations seamlessly with our specialized shift management system.',
        route: 'shift-management'
    },
    {
        targetId: 'tour-earnings',
        title: 'Financial Health',
        content: 'Review your long-term earnings and financial performance trends.',
        route: 'earnings'
    },
    {
        targetId: 'tour-billing',
        title: 'Subscription & Billing',
        content: 'Manage your platform subscription and view detailed invoices.',
        route: 'billing'
    },
    {
        targetId: 'tour-settings',
        title: 'System Preferences',
        content: 'Tailor the platform to your needs by adjusting hospital-wide settings and thresholds.',
        route: 'settings'
    }
];
