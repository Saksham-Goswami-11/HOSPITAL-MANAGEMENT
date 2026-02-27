const fs = require('fs');

function replaceFileContent(filepath, replacements) {
    try {
        let content = fs.readFileSync(filepath, 'utf8');
        for (let rep of replacements) {
            if (typeof rep.target === 'string') {
                content = content.replace(rep.target, rep.replace);
            } else {
                content = content.replace(rep.target, rep.replace); // regex
            }
        }
        fs.writeFileSync(filepath, content);
        console.log('Processed ' + filepath);
    } catch (e) { console.error('Error in ' + filepath, e.message); }
}

// 1. StaffPortal
replaceFileContent('src/components/StaffPortal.tsx', [
    { target: "import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'", replace: "import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog'" },
    { target: "import { Button, Input } from '@/components/ui/basic'", replace: "import { Button, Input, Label } from '@/components/ui/basic'" },
    { target: "import { Search, Filter, MoreVertical, Loader2 } from 'lucide-react'", replace: "import { Search, Filter, MoreVertical, Loader2, Plus, Key, Banknote } from 'lucide-react'" },
    { target: "const [newStaff, setNewStaff] = useState({", replace: "const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)\n    const [newStaff, setNewStaff] = useState({" }
]);

// 2. ClinicAdminDashboard
replaceFileContent('src/components/ClinicAdminDashboard.tsx', [
    { target: "import { Building2, ArrowLeft, RotateCw, Receipt } from 'lucide-react'", replace: "import { Building2, RotateCw } from 'lucide-react'" },
    { target: "import { Button } from '@/components/ui/basic'\r\n", replace: "" },
    { target: "import { Button } from '@/components/ui/basic'\n", replace: "" }
]);

// 3. HospitalsRegistry
replaceFileContent('src/components/HospitalsRegistry.tsx', [
    { target: "onClick={fetchLogs => fetchHospitals()}", replace: "onClick={() => fetchHospitals()}" }
]);

// 4. InventoryDashboard
replaceFileContent('src/components/InventoryDashboard.tsx', [
    { target: "import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'", replace: "import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'" },
    { target: "import { AlertTriangle, Plus, Search, Filter, Edit, RefreshCcw } from 'lucide-react'", replace: "import { Plus, Search, Filter } from 'lucide-react'" }
]);

// 5. AppLayout
replaceFileContent('src/components/layout/AppLayout.tsx', [
    { target: "import React, { useState, useEffect } from 'react'", replace: "import { useState, useEffect } from 'react'" },
    { target: "import { Button } from '@/components/ui/basic'\r\n", replace: "" },
    { target: "import { Button } from '@/components/ui/basic'\n", replace: "" }
]);

// 6. POSDashboard
replaceFileContent('src/components/POSDashboard.tsx', [
    { target: "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'\r\n", replace: "" },
    { target: "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'\n", replace: "" },
    { target: "import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'", replace: "import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'" }
]);

// 7. SuperAdminDashboard
replaceFileContent('src/components/SuperAdminDashboard.tsx', [
    { target: /recentHospitals\.map\(\(h, idx\)/g, replace: "recentHospitals.map((h)" }
]);
