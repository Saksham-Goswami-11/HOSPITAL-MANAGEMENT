/**
 * Deno Global Namespace Shim
 * This file provides minimal type definitions for the Deno namespace
 * to satisfy the TypeScript server in hybrid environments.
 */

declare namespace Deno {
    export interface Env {
        get(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
        toObject(): { [key: string]: string };
    }

    export const env: Env;

    export interface ServeOptions {
        port?: number;
        hostname?: string;
        signal?: AbortSignal;
        onListen?: (params: { hostname: string; port: number }) => void;
    }

    export function serve(
        handler: (request: Request, info: any) => Response | Promise<Response>,
        options?: ServeOptions
    ): void;

    export function serve(
        options: ServeOptions,
        handler: (request: Request, info: any) => Response | Promise<Response>
    ): void;
}
