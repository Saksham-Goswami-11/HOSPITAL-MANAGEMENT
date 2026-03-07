export const TOUR_STEPS = [
    {
        targetId: 'center',
        title: 'Welcome to MedFlow!',
        route: 'admin',
        content: "Hi! I'm Dr. Guide. I'll be your virtual assistant to show you around your new intelligent hospital management system. Let's get started!"
    },
    {
        targetId: 'tour-dashboard',
        title: 'Command Center',
        route: 'admin',
        content: 'This is your main dashboard. Here you can see a high-level overview of your hospital or clinic\'s performance, recent activities, and key metrics at a glance.'
    },
    {
        targetId: 'tour-hospitals',
        title: 'Hospitals Registry',
        route: 'hospitals',
        content: 'Manage multiple hospital branches from this central registry. You can add new facilities and monitor their operational status.'
    },
    {
        targetId: 'tour-inventory',
        title: 'Smart Inventory',
        route: 'inventory-dashboard',
        content: 'Never run out of critical supplies again! This module tracks your medical stock, predicts shortages, and alerts you when it\'s time to reorder.'
    },
    {
        targetId: 'tour-staff',
        title: 'Staff Management',
        route: 'staff',
        content: 'Keep track of all your doctors, nurses, and administrative personnel. Manage their roles, permissions, and basic details here.'
    },
    {
        targetId: 'tour-attendance',
        title: 'Attendance Tracking',
        route: 'attendance',
        content: 'Monitor staff check-ins and check-outs effortlessly. This integrates directly with the shift management system.'
    },
    {
        targetId: 'tour-shifts',
        title: 'Shift Management',
        route: 'shift-management',
        content: 'Create and assign shifts to your staff. Ensure optimal coverage for all departments across different time slots.'
    },
    {
        targetId: 'tour-pos',
        title: 'Billing & POS',
        route: 'pos',
        content: 'The heart of your financial operations. Process patient bills, track payments, and generate invoices with our automated billing engine.'
    },
    {
        targetId: 'tour-earnings',
        title: 'Earnings Overview',
        route: 'earnings',
        content: 'Dive deep into your revenue streams. View daily collections, analyze financial trends, and export reports for accounting.'
    },
    {
        targetId: 'tour-settings',
        title: 'System Settings',
        route: 'settings',
        content: 'Customize MedFlow to fit your needs. Configure your profile, adjust preferences, and manage platform-wide settings here.'
    },
    {
        targetId: 'center',
        title: "You're all set!",
        route: 'admin',
        content: "That concludes our quick tour. Feel free to explore these features in depth. If you ever need a refresher, just click the 'Replay Demo' button at the top. Happy managing!"
    }
];
