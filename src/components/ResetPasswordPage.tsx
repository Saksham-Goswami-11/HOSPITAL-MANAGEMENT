"use client"

import { useState } from "react"
import { useHospital } from "../context/HospitalContext"
import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/basic"
import { useToast } from "@/components/ui/use-toast"
import { Lock, Loader2, CheckCircle2 } from "lucide-react"

export function ResetPasswordPage() {
    const { updateUserPassword, setIsPasswordRecovery } = useHospital()
    const { toast } = useToast()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast({ title: "Passwords Mismatch", description: "Please ensure both passwords match.", variant: "destructive" })
            return
        }
        if (password.length < 6) {
            toast({ title: "Weak Password", description: "Password must be at least 6 characters.", variant: "destructive" })
            return
        }

        setLoading(true)
        try {
            await updateUserPassword(password)
            toast({
                title: "Password Updated",
                description: "Your password has been changed successfully. You can now login.",
                className: "bg-green-50 border-green-200 text-green-900"
            })
            // Redirect to login page via HashRouter-compatible URL
            setIsPasswordRecovery(false)
            window.location.href = window.location.origin + window.location.pathname + '#/login'
        } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-2xl glass-panel animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Reset Password</CardTitle>
                        <CardDescription>Enter your new password below.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Confirm Password</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="••••••••"
                            />
                        </div>
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Update Password
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="justify-center pt-0 pb-6">
                    <button onClick={() => setIsPasswordRecovery(false)} className="text-sm text-slate-400 hover:text-slate-600">
                        Cancel & Return to Login
                    </button>
                </CardFooter>
            </Card>
        </div>
    )
}
