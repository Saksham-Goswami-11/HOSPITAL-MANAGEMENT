import React, { useState } from 'react';
import { dataService as db } from '@/lib/dataService';
import { useHospital } from '@/context/HospitalContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/basic';
import { Button, Input, Label, Textarea } from '@/components/ui/basic';
import { Star, Video, Send, Loader2, CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface TestimonialFormProps {
    onSuccess?: () => void;
}

export function TestimonialForm({ onSuccess }: TestimonialFormProps) {
    const { hospital, profile } = useHospital();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [rating, setRating] = useState(5);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hospital?.id || !profile?.id) return;

        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            await db.create('trial_extension_requests', {
                hospital_id: hospital.id,
                submitted_by: profile.id,
                contact_name: formData.get('contact_name') as string,
                contact_email: formData.get('contact_email') as string,
                testimonial_text: formData.get('testimonial_text') as string,
                video_url: formData.get('video_url') as string || null,
                rating: rating,
                status: 'pending'
            });

            setSuccess(true);
            toast({
                title: 'Review Submitted',
                description: 'Super Admin will review your testimonial shortly.',
                className: 'bg-green-50 border-green-200 text-green-900'
            });
            onSuccess?.();

        } catch (err: any) {
            console.error('Testimonial Error:', err);
            toast({
                title: 'Submission Failed',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Card className="border-green-100 bg-green-50 shadow-lg animate-in zoom-in-95 duration-500">
                <CardContent className="pt-8 pb-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <CardTitle className="text-xl font-bold text-green-900 mb-2">Thank you for your feedback!</CardTitle>
                    <CardDescription className="text-green-700 text-base">
                        Your request has been sent to the Super Admin. If approved, your trial will be extended by <strong>8 days</strong>.
                    </CardDescription>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-blue-100 shadow-xl glass-card">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    </div>
                    <CardTitle className="text-xl">Extend Your Trial</CardTitle>
                </div>
                <CardDescription className="text-blue-100 opacity-90 text-sm">
                    Submit a testimonial about your experience to get <strong>8 more days</strong> of free access.
                </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="contact_name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Name</Label>
                            <Input
                                id="contact_name"
                                name="contact_name"
                                placeholder="e.g. Dr. John Doe"
                                required
                                defaultValue={profile?.full_name || ''}
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contact_email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Email</Label>
                            <Input
                                id="contact_email"
                                name="contact_email"
                                type="email"
                                placeholder="john@hospital.com"
                                required
                                defaultValue={profile?.email || ''}
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">How would you rate MedFlow?</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setRating(s)}
                                    className="focus:outline-none group"
                                >
                                    <Star
                                        className={`w-8 h-8 transition-all ${s <= rating
                                            ? 'fill-yellow-400 text-yellow-400 scale-110'
                                            : 'text-slate-200 hover:text-yellow-200'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="testimonial_text" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Written Review</Label>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Minimum 20 words recommended
                            </span>
                        </div>
                        <Textarea
                            id="testimonial_text"
                            name="testimonial_text"
                            placeholder="Share your experience using MedFlow. What features do you like most? How has it helped your clinic operations?"
                            required
                            className="min-h-[120px] bg-slate-50 border-slate-200 focus:bg-white transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="video_url" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Testimonial Link (Required)</Label>
                            <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded cursor-help" title="Recording a video testimonial increases your chances of fast approval!">
                                PRO TIP
                            </span>
                        </div>
                        <div className="relative">
                            <Video className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                id="video_url"
                                name="video_url"
                                placeholder="Link to YouTube, Loom, or Drive video"
                                required
                                className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] rounded-xl flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Submit for Review <Send className="w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        By submitting, you agree to let MedFlow use your testimonial for marketing purposes.
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
