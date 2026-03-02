import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/basic';
import { UserPlus, Mail, Lock, Loader2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function RegisterPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const plan = searchParams.get('plan') || 'free';
    const billing = searchParams.get('billing') || 'monthly';

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Sign up user
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        // We store temporary onboarding state in user metadata
                        onboarding_plan: plan,
                        onboarding_billing: billing,
                        role: 'HOSPITAL_ADMIN'
                    }
                }
            });

            if (authError) throw authError;

            // 2. Note: A trigger in our DB usually creates the 'profiles' row.
            // But we need to ensure the role is set to HOSPITAL_ADMIN for self-service signups.
            // The existing trigger might default to 'STAFF' or null.
            // We'll update the profile role after signup if session is immediately available,
            // or rely on the AdminSetup component to fix it if they log in later.

            setSuccess(true);
            toast({
                title: 'Account Created',
                description: 'Please check your email to verify your account.',
                className: 'bg-green-50 border-green-200 text-green-900'
            });

        } catch (err: any) {
            console.error('Registration Error:', err);
            toast({
                title: 'Registration Failed',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md text-center p-8 glass-card border-green-100">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</CardTitle>
                    <CardDescription className="text-slate-600 text-lg mb-8">
                        We've sent a verification link to <span className="font-semibold text-slate-900">{email}</span>.
                        Once verified, you can complete your hospital setup.
                    </CardDescription>
                    <Button
                        onClick={() => navigate('/login')}
                        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white gap-2"
                    >
                        Go to Login <ArrowRight className="w-5 h-5" />
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-100 rounded-full blur-[120px] opacity-40 pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-violet-100 rounded-full blur-[120px] opacity-40 pointer-events-none" />

            <Card className="w-full max-w-lg glass-card shadow-2xl border-white/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="space-y-4 pt-8 text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            Start your Trial
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base flex justify-center items-center gap-2">
                            <span>Setting up for</span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider">
                                {plan}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 capitalize">{billing} Billing</span>
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="pt-6 pb-8">
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                type="text"
                                placeholder="Dr. John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Work Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@medflow.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Create Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400">At least 8 characters long</p>
                        </div>

                        <div className="pt-4">
                            <Button
                                type="submit"
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        Create My Account <ArrowRight className="w-5 h-5" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>

                <CardFooter className="flex flex-col border-t border-slate-100/50 bg-slate-50/50 rounded-b-2xl p-6">
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-4">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Secure HIPAA-compliant registration
                    </div>
                    <p className="text-center text-slate-600 text-sm">
                        Already have an account?{' '}
                        <button
                            onClick={() => navigate('/login')}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            Sign In
                        </button>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
