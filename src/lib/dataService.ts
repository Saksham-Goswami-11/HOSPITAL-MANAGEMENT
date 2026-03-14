import { supabase } from './supabase';

export interface DataService {
    get: (table: string, id: string) => Promise<any>;
    list: (table: string, options?: {
        filters?: any; // Can be array of {column, operator, value} or simple object {column: value}
        filterLogic?: 'and' | 'or';
        sort?: { column: string; ascending?: boolean };
        limit?: number;
        select?: string;
    }, context?: any) => Promise<any[]>;
    create: (table: string, data: any) => Promise<any>;
    createMany: (table: string, data: any[]) => Promise<any[]>;
    update: (table: string, id: string, data: any) => Promise<any>;
    remove: (table: string, id: string) => Promise<void>;
    removeByFilters: (table: string, filters: any) => Promise<void>;
    callRpc: (name: string, params: any) => Promise<any>;
    invokeFunction: (name: string, options?: any) => Promise<any>;
    count: (table: string, filters?: any) => Promise<number>;
    subscribe: (table: string, callback: (payload: any) => void, event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*') => () => void;
}

// Helper to normalize filters
const normalizeFilters = (filters: any) => {
    if (!filters) return [];
    if (Array.isArray(filters)) {
        return filters.map(f => ({
            column: f.column || f.field || f.key || f.name,
            operator: f.operator || f.op || 'eq',
            value: f.value
        }));
    }
    return Object.entries(filters).map(([column, value]) => ({
        column,
        operator: 'eq',
        value
    }));
};

class SupabaseService implements DataService {
    async get(table: string, id: string) {
        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    }
    async list(table: string, optionsInput?: any, context?: any) {
        // Handle case where optionsInput is just an array of filters
        const options = Array.isArray(optionsInput) ? { filters: optionsInput } : optionsInput;

        let q = supabase.from(table).select(options?.select || '*');

        const filters = normalizeFilters(options?.filters);

        if (filters.length > 0) {
            if (options.filterLogic === 'or') {
                const filterStrings = filters.map((f: any) => `${f.column}.${f.operator || 'eq'}.${f.value}`);
                q = q.or(filterStrings.join(','));
            } else {
                filters.forEach((f: any) => {
                    const op = f.operator || 'eq';
                    const col = f.column;
                    const val = f.value;

                    if (op === '==' || op === 'eq') q = (q as any).eq(col, val);
                    else if (op === 'ilike') q = (q as any).ilike(col, val);
                    else if (op === 'in') q = (q as any).in(col, val);
                    else if (op === '<' || op === 'lt') q = (q as any).lt(col, val);
                    else if (op === '>' || op === 'gt') q = (q as any).gt(col, val);
                    else if (op === '>=' || op === 'gte') q = (q as any).gte(col, val);
                    else if (op === '<=' || op === 'lte') q = (q as any).lte(col, val);
                });
            }
        }

        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                q = q.eq(key, value);
            });
        }

        if (options?.sort) {
            q = q.order(options.sort.column, { ascending: options.sort.ascending ?? true });
        }
        if (options?.limit) {
            q = q.limit(options.limit);
        }
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }
    async create(table: string, data: any) {
        const { data: created, error } = await supabase.from(table).insert(data).select().single();
        if (error) throw error;
        return created;
    }
    async createMany(table: string, data: any[]) {
        const { data: created, error } = await supabase.from(table).insert(data).select();
        if (error) throw error;
        return created || [];
    }
    async update(table: string, id: string, data: any) {
        const { data: updated, error } = await supabase.from(table).update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated;
    }
    async remove(table: string, id: string) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
    }
    async removeByFilters(table: string, filtersInput: any) {
        let q = supabase.from(table).delete();
        const filters = normalizeFilters(filtersInput?.filters || filtersInput);
        if (filters.length > 0) {
            filters.forEach(f => {
                const op = f.operator || 'eq';
                if (op === '==' || op === 'eq') q = (q as any).eq(f.column, f.value);
                else if (op === 'in') q = (q as any).in(f.column, f.value);
            });
        }
        const { error } = await q;
        if (error) throw error;
    }
    async callRpc(name: string, params: any) {
        const { data, error } = await supabase.rpc(name, params);
        if (error) throw error;
        return data;
    }
    async invokeFunction(name: string, options?: any) {
        const { data, error } = await supabase.functions.invoke(name, options);
        return { data, error };
    }
    async count(table: string, filtersInput?: any) {
        let q = supabase.from(table).select('*', { count: 'exact', head: true });
        const filters = normalizeFilters(filtersInput?.filters || filtersInput);
        if (filters.length > 0) {
            filters.forEach(f => {
                const op = f.operator || 'eq';
                if (op === '==' || op === 'eq') q = (q as any).eq(f.column, f.value);
            });
        }
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
    }
    subscribe(table: string, callback: (payload: any) => void, event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = 'INSERT') {
        const channel = supabase
            .channel(`public:${table}`)
            .on(
                'postgres_changes' as any,
                {
                    event: event,
                    schema: 'public',
                    table: table
                },
                (payload: any) => {
                    callback(payload.new || payload.old);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}

export const dataService: DataService = new SupabaseService();
