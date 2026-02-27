import { useState } from 'react'
import { useHospital } from '@/context/HospitalContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/basic'
import { Input } from '@/components/ui/basic'
import { Label } from '@/components/ui/basic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/basic'
import { Lock, Mail, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'

export function LoginPage() {
    const { requestPasswordReset } = useHospital()
    const [isForgotMode, setIsForgotMode] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isForgotMode) {
                // PASSWORD RECOVERY
                await requestPasswordReset(email)
                toast({
                    title: 'Recovery Link Sent',
                    description: 'Check your email for the password reset link.',
                    className: 'bg-green-50 border-green-200 text-green-900'
                })
                setIsForgotMode(false)
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            }
        } catch (err: any) {
            console.error("Auth Error:", err)
            if (err.status === 429 || (err.message && err.message.includes("429"))) {
                setError("Supabase rate limit hit. Please wait 15 minutes.")
            } else {
                setError(err.message || 'An unexpected error occurred')
            }

            toast({
                title: 'Authentication Failed',
                description: err.message,
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-[100px] opacity-60 pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-100 rounded-full blur-[100px] opacity-60 pointer-events-none" />

            <Card className="w-full max-w-md glass-card shadow-2xl border-white/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="space-y-4 pt-8 text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                            {isForgotMode ? 'Reset Password' : 'Welcome Back'}
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            {isForgotMode ? 'Enter your email to receive a recovery link' : 'Enter your credentials to access the portal'}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pb-6">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="user@hospital.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {!isForgotMode && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotMode(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 animate-in fade-in zoom-in-95">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {isForgotMode ? 'Sending...' : 'Signing In...'}
                                </>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    {isForgotMode ? 'Send Recovery Link' : 'Sign In'}
                                    <ArrowRight className="w-5 h-5" />
                                </span>
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t border-slate-100 pt-6">
                    <button
                        onClick={() => { setError(null); setIsForgotMode(!isForgotMode); }}
                        className="text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
                    >
                        {isForgotMode ? "Back to Login" : "Forgot your password?"}
                    </button>
                </CardFooter>
            </Card>
        </div>
    )
}
