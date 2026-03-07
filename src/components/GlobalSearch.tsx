import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Building2, User } from 'lucide-react'
import { Input } from '@/components/ui/basic'
import { dataService as db } from '@/lib/dataService'

interface GlobalSearchProps {
    onNavigate: (type: 'hospital' | 'user', id: string) => void
    className?: string
}

export function GlobalSearch({ onNavigate, className }: GlobalSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<{ hospitals: any[], users: any[] }>({ hospitals: [], users: [] })
    const [loading, setLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Debounce Search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim().length > 1) {
                performSearch()
            } else {
                setResults({ hospitals: [], users: [] })
            }
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [query])

    // Click Outside to Close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const performSearch = async () => {
        setLoading(true)
        setShowResults(true)
        try {
            // Parallel Queries using abstracted db.list
            // Note: Since Firestore lacks native 'ilike' and complex 'or', we perform a broader 
            // query if Firebase is active, or use exact/prefix matching. 
            // For a production app with Firestore, Algolia or Typesense is highly recommended.
            const [hospData, userData] = await Promise.all([
                db.list('hospitals', {
                    limit: 50 // Fetch more for client side filtering if needed
                }),
                db.list('profiles', {
                    limit: 50
                })
            ])

            // Client-side filtering to ensure consistent behavior across both backends for search
            const q = query.toLowerCase();
            const filteredHospitals = (hospData || []).filter(h =>
                h.name?.toLowerCase().includes(q)
            ).slice(0, 5);

            const filteredUsers = (userData || []).filter(u =>
                u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
            ).slice(0, 5);

            setResults({
                hospitals: filteredHospitals,
                users: filteredUsers
            })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div ref={searchRef} className={`relative max-w-2xl w-full ${className}`}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                    placeholder="Search hospitals, users..."
                    className="pl-10 h-10 bg-white border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500/20"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (query.length > 1) setShowResults(true) }}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                )}
            </div>

            {/* DROPDOWN */}
            {showResults && (results.hospitals.length > 0 || results.users.length > 0) && (
                <div className="absolute top-12 left-0 w-full bg-white rounded-xl border border-slate-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* HOSPITALS */}
                    {results.hospitals.length > 0 && (
                        <div className="py-2">
                            <h4 className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                Hospitals
                            </h4>
                            {results.hospitals.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => {
                                        onNavigate('hospital', h.id)
                                        setShowResults(false)
                                        setQuery('')
                                    }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{h.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* USERS */}
                    {results.users.length > 0 && (
                        <div className="py-2 border-t border-slate-100">
                            <h4 className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                Users
                            </h4>
                            {results.users.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => {
                                        onNavigate('user', u.id)
                                        setShowResults(false)
                                        setQuery('')
                                    }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{u.full_name}</p>
                                        <p className="text-xs text-slate-400">{u.email} • {u.role}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
