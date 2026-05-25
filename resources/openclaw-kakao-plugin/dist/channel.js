import { z } from "zod";
import { getKakaoRuntime, setKakaoCfg } from "./runtime.js";
const DEFAULT_ACCOUNT_ID = "__default__";
// 카카오 설정 스키마
export const KakaoConfigSchema = z.object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    webhookPath: z.string().default("/kakao/skill"),
    botId: z.string().optional(),
    useCallback: z.boolean().default(true),
    callbackTimeoutMs: z.number().default(50000),
    dmPolicy: z.enum(["open", "pairing", "allowlist"]).default("pairing"),
    allowFrom: z.array(z.string()).optional(),
    accounts: z.record(z.string(), z.object({
        enabled: z.boolean().optional(),
        name: z.string().optional(),
        webhookPath: z.string().optional(),
        botId: z.string().optional(),
        useCallback: z.boolean().optional(),
        callbackTimeoutMs: z.number().optional(),
        dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
        allowFrom: z.array(z.string()).optional(),
    })).optional(),
});
// 채널 메타데이터
const meta = {
    id: "kakao",
    label: "카카오톡",
    selectionLabel: "카카오톡 채널 (챗봇)",
    detailLabel: "카카오톡 채널 봇",
    docsPath: "/channels/kakao",
    docsLabel: "kakao",
    blurb: "카카오톡 채널 챗봇을 통한 AI 메시징",
    systemImage: "message.fill",
};
// 계정 ID 목록 조회
function listKakaoAccountIds(cfg) {
    const kakaoConfig = cfg.channels?.kakao;
    if (!kakaoConfig)
        return [];
    const ids = [];
    if (kakaoConfig.enabled !== false) {
        ids.push(DEFAULT_ACCOUNT_ID);
    }
    if (kakaoConfig.accounts) {
        ids.push(...Object.keys(kakaoConfig.accounts));
    }
    return ids;
}
// 계정 resolve
export function resolveKakaoAccount(cfg, accountId) {
    const kakaoConfig = (cfg.channels?.kakao ?? {});
    const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
    if (resolvedAccountId === DEFAULT_ACCOUNT_ID) {
        return {
            accountId: DEFAULT_ACCOUNT_ID,
            name: kakaoConfig.name,
            enabled: kakaoConfig.enabled !== false,
            webhookPath: kakaoConfig.webhookPath ?? "/kakao/skill",
            botId: kakaoConfig.botId,
            useCallback: kakaoConfig.useCallback ?? true,
            callbackTimeoutMs: kakaoConfig.callbackTimeoutMs ?? 50000,
            config: kakaoConfig,
        };
    }
    const accountConfig = kakaoConfig.accounts?.[resolvedAccountId] ?? {};
    return {
        accountId: resolvedAccountId,
        name: accountConfig.name ?? kakaoConfig.name,
        enabled: accountConfig.enabled !== false,
        webhookPath: accountConfig.webhookPath ?? `/kakao/skill/${resolvedAccountId}`,
        botId: accountConfig.botId ?? kakaoConfig.botId,
        useCallback: accountConfig.useCallback ?? kakaoConfig.useCallback ?? true,
        callbackTimeoutMs: accountConfig.callbackTimeoutMs ?? kakaoConfig.callbackTimeoutMs ?? 50000,
        config: { ...kakaoConfig, ...accountConfig },
    };
}
// 카카오 스킬 응답 생성
export function createSimpleTextResponse(text) {
    return {
        version: "2.0",
        template: {
            outputs: [{ simpleText: { text } }],
        },
    };
}
// 콜백 대기 응답
export function createCallbackWaitResponse(waitMessage) {
    return {
        version: "2.0",
        useCallback: true,
        ...(waitMessage ? {
            data: { text: waitMessage }
        } : {}),
    };
}
// 콜백 URL로 응답 전송
async function sendCallbackResponse(callbackUrl, response) {
    try {
        const res = await fetch(callbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
        });
        if (!res.ok) {
            return { success: false, error: `HTTP ${res.status}` };
        }
        const result = await res.json();
        return {
            success: result.status === "SUCCESS",
            taskId: result.taskId,
            error: result.status !== "SUCCESS" ? result.message : undefined,
        };
    }
    catch (err) {
        return { success: false, error: String(err) };
    }
}
// 카카오 채널 플러그인
export const kakaoPlugin = {
    id: "kakao",
    meta: {
        ...meta,
        quickstartAllowFrom: true,
    },
    pairing: {
        idLabel: "kakaoBotUserKey",
        normalizeAllowEntry: (entry) => {
            return entry.replace(/^kakao:(?:user:)?/i, "");
        },
        notifyApproval: async ({ id }) => {
            // 카카오는 푸시 메시지를 보내려면 별도 API가 필요
            if (getKakaoRuntime().logging.shouldLogVerbose()) {
                console.log(`Kakao: user ${id} approved (no push notification available)`);
            }
        },
    },
    capabilities: {
        chatTypes: ["direct"],
        reactions: false,
        threads: false,
        media: true,
        nativeCommands: false,
        blockStreaming: true,
    },
    reload: { configPrefixes: ["channels.kakao"] },
    configSchema: { schema: KakaoConfigSchema },
    config: {
        listAccountIds: (cfg) => listKakaoAccountIds(cfg),
        resolveAccount: (cfg, accountId) => resolveKakaoAccount(cfg, accountId),
        defaultAccountId: () => DEFAULT_ACCOUNT_ID,
        setAccountEnabled: ({ cfg, accountId, enabled }) => {
            const kakaoConfig = (cfg.channels?.kakao ?? {});
            if (accountId === DEFAULT_ACCOUNT_ID) {
                return {
                    ...cfg,
                    channels: {
                        ...cfg.channels,
                        kakao: { ...kakaoConfig, enabled },
                    },
                };
            }
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    kakao: {
                        ...kakaoConfig,
                        accounts: {
                            ...kakaoConfig.accounts,
                            [accountId]: {
                                ...kakaoConfig.accounts?.[accountId],
                                enabled,
                            },
                        },
                    },
                },
            };
        },
        deleteAccount: ({ cfg, accountId }) => {
            const kakaoConfig = (cfg.channels?.kakao ?? {});
            if (accountId === DEFAULT_ACCOUNT_ID) {
                const { webhookPath, botId, ...rest } = kakaoConfig;
                return {
                    ...cfg,
                    channels: { ...cfg.channels, kakao: rest },
                };
            }
            const accounts = { ...kakaoConfig.accounts };
            delete accounts[accountId];
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    kakao: {
                        ...kakaoConfig,
                        accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
                    },
                },
            };
        },
        isConfigured: (account) => Boolean(account.webhookPath),
        describeAccount: (account) => ({
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: Boolean(account.webhookPath),
        }),
        resolveAllowFrom: ({ cfg, accountId }) => {
            const account = resolveKakaoAccount(cfg, accountId);
            return account.config.allowFrom ?? [];
        },
        formatAllowFrom: ({ allowFrom }) => allowFrom
            .map((entry) => String(entry).trim())
            .filter(Boolean)
            .map((entry) => entry.replace(/^kakao:(?:user:)?/i, "")),
    },
    security: {
        resolveDmPolicy: ({ cfg, accountId, account }) => {
            const resolvedAccountId = accountId ?? account?.accountId ?? DEFAULT_ACCOUNT_ID;
            const useAccountPath = Boolean(cfg.channels?.kakao?.accounts?.[resolvedAccountId]);
            const basePath = useAccountPath
                ? `channels.kakao.accounts.${resolvedAccountId}.`
                : "channels.kakao.";
            return {
                policy: account?.config?.dmPolicy ?? "pairing",
                allowFrom: account?.config?.allowFrom ?? [],
                policyPath: `${basePath}dmPolicy`,
                allowFromPath: basePath,
                approveHint: "openclaw pairing approve kakao <code>",
                normalizeEntry: (raw) => raw.replace(/^kakao:(?:user:)?/i, ""),
            };
        },
        collectWarnings: () => [],
    },
    messaging: {
        normalizeTarget: (target) => {
            const trimmed = target.trim();
            if (!trimmed)
                return undefined;
            return trimmed.replace(/^kakao:(user:)?/i, "");
        },
        targetResolver: {
            looksLikeId: (id) => {
                const trimmed = id?.trim();
                return Boolean(trimmed && trimmed.length > 0);
            },
            hint: "<botUserKey>",
        },
    },
    directory: {
        self: async () => null,
        listPeers: async () => [],
        listGroups: async () => [],
    },
    setup: {
        resolveAccountId: ({ accountId }) => accountId ?? DEFAULT_ACCOUNT_ID,
        applyAccountName: ({ cfg, accountId, name }) => {
            const kakaoConfig = (cfg.channels?.kakao ?? {});
            if (accountId === DEFAULT_ACCOUNT_ID) {
                return {
                    ...cfg,
                    channels: { ...cfg.channels, kakao: { ...kakaoConfig, name } },
                };
            }
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    kakao: {
                        ...kakaoConfig,
                        accounts: {
                            ...kakaoConfig.accounts,
                            [accountId]: { ...kakaoConfig.accounts?.[accountId], name },
                        },
                    },
                },
            };
        },
        validateInput: ({ input }) => {
            const typedInput = input;
            if (!typedInput.webhookPath) {
                return "Kakao requires webhookPath configuration.";
            }
            return null;
        },
        applyAccountConfig: ({ cfg, accountId, input }) => {
            const typedInput = input;
            const kakaoConfig = (cfg.channels?.kakao ?? {});
            if (accountId === DEFAULT_ACCOUNT_ID) {
                return {
                    ...cfg,
                    channels: {
                        ...cfg.channels,
                        kakao: {
                            ...kakaoConfig,
                            enabled: true,
                            ...(typedInput.name ? { name: typedInput.name } : {}),
                            ...(typedInput.webhookPath ? { webhookPath: typedInput.webhookPath } : {}),
                            ...(typedInput.botId ? { botId: typedInput.botId } : {}),
                            ...(typedInput.useCallback !== undefined ? { useCallback: typedInput.useCallback } : {}),
                        },
                    },
                };
            }
            return {
                ...cfg,
                channels: {
                    ...cfg.channels,
                    kakao: {
                        ...kakaoConfig,
                        enabled: true,
                        accounts: {
                            ...kakaoConfig.accounts,
                            [accountId]: {
                                ...kakaoConfig.accounts?.[accountId],
                                enabled: true,
                                ...(typedInput.name ? { name: typedInput.name } : {}),
                                ...(typedInput.webhookPath ? { webhookPath: typedInput.webhookPath } : {}),
                                ...(typedInput.botId ? { botId: typedInput.botId } : {}),
                                ...(typedInput.useCallback !== undefined ? { useCallback: typedInput.useCallback } : {}),
                            },
                        },
                    },
                },
            };
        },
    },
    outbound: {
        deliveryMode: "direct",
        chunker: (text, limit) => {
            const chunks = [];
            let remaining = text;
            while (remaining.length > 0) {
                chunks.push(remaining.slice(0, limit));
                remaining = remaining.slice(limit);
            }
            return chunks;
        },
        textChunkLimit: 1000,
        sendPayload: async ({ to }) => {
            if (getKakaoRuntime().logging.shouldLogVerbose()) {
                console.log(`Kakao: outbound message to ${to} - push not supported, use skill callback`);
            }
            return {
                messageId: `kakao-${Date.now()}`,
                chatId: to,
                channel: "kakao",
            };
        },
    },
    status: {
        defaultRuntime: {
            accountId: DEFAULT_ACCOUNT_ID,
            running: false,
            lastStartAt: null,
            lastStopAt: null,
            lastError: null,
        },
        collectStatusIssues: (accounts) => {
            const issues = [];
            for (const account of accounts) {
                const accountId = account.accountId ?? DEFAULT_ACCOUNT_ID;
                if (!account.configured) {
                    issues.push({
                        channel: "kakao",
                        accountId,
                        kind: "config",
                        message: "Kakao webhook path not configured",
                    });
                }
            }
            return issues;
        },
        buildChannelSummary: async ({ account, snapshot }) => {
            return {
                accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
                name: account?.name,
                enabled: account?.enabled ?? false,
                configured: Boolean(account?.webhookPath),
                running: snapshot?.running ?? false,
                mode: "webhook",
                webhookPath: account?.webhookPath,
            };
        },
    },
    gateway: {
        startAccount: async (ctx) => {
            const account = ctx.account;
            ctx.log?.info?.(`[${account.accountId}] Starting Kakao channel provider`);
            ctx.log?.info?.(`[${account.accountId}] Webhook path: ${account.webhookPath}`);
            ctx.log?.info?.(`[${account.accountId}] Callback mode: ${account.useCallback ? "enabled" : "disabled"}`);
            setKakaoCfg(ctx.cfg);
            // Stay alive until openclaw signals a stop via abortSignal
            await new Promise((resolve) => {
                if (ctx.abortSignal?.aborted) {
                    resolve();
                    return;
                }
                ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
            });
            ctx.log?.info?.(`[${account.accountId}] Kakao channel provider stopped`);
        },
        logoutAccount: async ({ accountId, cfg }) => {
            const kakaoConfig = (cfg.channels?.kakao ?? {});
            const nextKakao = { ...kakaoConfig };
            let cleared = false;
            if (accountId === DEFAULT_ACCOUNT_ID) {
                if (nextKakao.webhookPath || nextKakao.botId) {
                    delete nextKakao.webhookPath;
                    delete nextKakao.botId;
                    cleared = true;
                }
            }
            else if (nextKakao.accounts?.[accountId]) {
                const accounts = { ...nextKakao.accounts };
                delete accounts[accountId];
                nextKakao.accounts = Object.keys(accounts).length > 0 ? accounts : undefined;
                cleared = true;
            }
            return { cleared, loggedOut: cleared };
        },
    },
};
// AI 응답 처리 및 콜백 전송
export async function processAndSendCallback(ctxPayload, callbackUrl, cfg, account, runtime) {
    try {
        let responseText = "";
        await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg,
            dispatcherOptions: {
                deliver: async (payload) => {
                    if (payload.text) {
                        responseText = payload.text;
                    }
                },
                onError: (err) => {
                    console.error(`[kakao:${account.accountId}] Reply error: ${String(err)}`);
                },
            },
        });
        if (responseText) {
            const kakaoResponse = createSimpleTextResponse(responseText);
            const result = await sendCallbackResponse(callbackUrl, kakaoResponse);
            if (result.success) {
                console.log(`[kakao:${account.accountId}] Callback sent successfully: ${result.taskId}`);
            }
            else {
                console.error(`[kakao:${account.accountId}] Callback failed: ${result.error}`);
            }
        }
        else {
            console.log(`[kakao:${account.accountId}] No response generated`);
        }
    }
    catch (err) {
        console.error(`[kakao:${account.accountId}] Process error: ${String(err)}`);
        await sendCallbackResponse(callbackUrl, createSimpleTextResponse("죄송합니다. 응답 생성 중 오류가 발생했습니다."));
    }
}
//# sourceMappingURL=channel.js.map