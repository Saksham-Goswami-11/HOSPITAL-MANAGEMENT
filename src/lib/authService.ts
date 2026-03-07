import { supabase } from './supabase';

export interface AuthService {
    signIn: (email: string, pass: string) => Promise<any>;
    signUp: (email: string, pass: string, data?: any) => Promise<any>;
    signOut: () => Promise<void>;
    onAuthStateChange: (callback: (user: any) => void) => void;
    resetPassword: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    getSession: () => Promise<any>;
}

class SupabaseAuthService implements AuthService {
    async signIn(email: string, pass: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        return data.user;
    }
    async signUp(email: string, pass: string, data?: any) {
        const { data: authData, error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: { data }
        });
        if (error) throw error;
        return authData.user;
    }
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }
    onAuthStateChange(callback: (user: any) => void) {
        supabase.auth.onAuthStateChange((_event, session) => {
            callback(session?.user || null);
        });
    }
    async resetPassword(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/reset-password`,
        });
        if (error) throw error;
    }
    async updatePassword(password: string) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
    }
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    }
}

export const authService: AuthService = new SupabaseAuthService();
