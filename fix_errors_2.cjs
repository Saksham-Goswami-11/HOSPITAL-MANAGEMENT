const fs = require('fs');

function replaceFileContent(filepath, replacements) {
    let content = fs.readFileSync(filepath, 'utf8');
    for (let rep of replacements) {
        content = content.replace(rep.target, rep.replace);
    }
    fs.writeFileSync(filepath, content);
    console.log('Processed ' + filepath);
}

replaceFileContent('src/components/ClinicAdminDashboard.tsx', [
    { target: /import \{ Building2, RotateCw \} from 'lucide-react'/g, replace: "import { Building2, RotateCw } from 'lucide-react'; // removed unused" },
    { target: /import \{ Building2, ArrowLeft, RotateCw, Receipt \} from 'lucide-react'/g, replace: "import { Building2, RotateCw } from 'lucide-react'" }
]);

replaceFileContent('src/components/InventoryDashboard.tsx', [
    { target: "import { Plus, Search, Filter } from 'lucide-react'", replace: "import { Plus, Search, Filter } from 'lucide-react'; // already fixed" },
    { target: "import { AlertTriangle, Plus, Search, Filter, Edit, RefreshCcw } from 'lucide-react'", replace: "import { Plus, Search, Filter } from 'lucide-react'" }
]);

replaceFileContent('src/components/layout/AppLayout.tsx', [
    { target: "import React, { useState, useEffect } from 'react'", replace: "import { useState, useEffect } from 'react'" }
]);

replaceFileContent('src/components/POSDashboard.tsx', [
    { target: "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'\r\n", replace: "" },
    { target: "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic'\n", replace: "" }
]);

replaceFileContent('src/components/StaffPortal.tsx', [
    { target: "import { Search, Filter, MoreVertical, Loader2, Plus, Key, Banknote } from 'lucide-react'", replace: "import { Plus, Key, Banknote } from 'lucide-react'" }
]);

