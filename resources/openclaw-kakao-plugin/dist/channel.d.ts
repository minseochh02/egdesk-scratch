import { type ChannelPlugin, type OpenClawConfig } from "openclaw/plugin-sdk/channel-core";
import { z } from "zod";
import { getKakaoRuntime } from "./runtime.js";
import type { KakaoSkillResponse, ResolvedKakaoAccount } from "./types.js";
export declare const KakaoConfigSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    name: z.ZodOptional<z.ZodString>;
    webhookPath: z.ZodDefault<z.ZodString>;
    botId: z.ZodOptional<z.ZodString>;
    useCallback: z.ZodDefault<z.ZodBoolean>;
    callbackTimeoutMs: z.ZodDefault<z.ZodNumber>;
    dmPolicy: z.ZodDefault<z.ZodEnum<{
        open: "open";
        pairing: "pairing";
        allowlist: "allowlist";
    }>>;
    allowFrom: z.ZodOptional<z.ZodArray<z.ZodString>>;
    accounts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        name: z.ZodOptional<z.ZodString>;
        webhookPath: z.ZodOptional<z.ZodString>;
        botId: z.ZodOptional<z.ZodString>;
        useCallback: z.ZodOptional<z.ZodBoolean>;
        callbackTimeoutMs: z.ZodOptional<z.ZodNumber>;
        dmPolicy: z.ZodOptional<z.ZodEnum<{
            open: "open";
            pairing: "pairing";
            allowlist: "allowlist";
        }>>;
        allowFrom: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare function resolveKakaoAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedKakaoAccount;
export declare function createSimpleTextResponse(text: string): KakaoSkillResponse;
export declare function createCallbackWaitResponse(waitMessage?: string): KakaoSkillResponse;
export declare const kakaoPlugin: ChannelPlugin<ResolvedKakaoAccount>;
export declare function processAndSendCallback(ctxPayload: {
    From: string;
    Body: string;
    Channel: string;
    AccountId: string;
    MessageId: string;
    Timestamp: number;
    IsGroup: boolean;
    ReplyTo: string;
}, callbackUrl: string, cfg: any, account: ResolvedKakaoAccount, runtime: ReturnType<typeof getKakaoRuntime>): Promise<void>;
//# sourceMappingURL=channel.d.ts.map