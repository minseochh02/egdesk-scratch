import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { kakaoPlugin, resolveKakaoAccount, processAndSendCallback, createCallbackWaitResponse, createSimpleTextResponse, } from "./channel.js";
import { setKakaoRuntime, getKakaoRuntime, getKakaoCfg } from "./runtime.js";
export default defineChannelPluginEntry({
    id: "kakao",
    name: "카카오톡",
    description: "카카오톡 채널 챗봇 플러그인",
    plugin: kakaoPlugin,
    registerFull(api) {
        setKakaoRuntime(api.runtime);
        api.registerChannel({ plugin: kakaoPlugin });
        const kakaoSkillHandler = async (req, res) => {
            try {
                const bodyText = await new Promise((resolve, reject) => {
                    let data = "";
                    req.on("data", (chunk) => { data += chunk.toString(); });
                    req.on("end", () => resolve(data));
                    req.on("error", reject);
                });
                const body = JSON.parse(bodyText);
                const userKey = body.userRequest.user.properties.botUserKey ||
                    body.userRequest.user.properties.plusfriendUserKey ||
                    body.userRequest.user.id;
                const utterance = body.userRequest.utterance;
                const callbackUrl = body.userRequest.callbackUrl;
                const cfg = getKakaoCfg();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const account = resolveKakaoAccount(cfg, null);
                const runtime = getKakaoRuntime();
                const ctxPayload = {
                    From: userKey,
                    Body: utterance,
                    Channel: "kakao",
                    AccountId: account.accountId,
                    MessageId: `kakao-${Date.now()}`,
                    Timestamp: Date.now(),
                    IsGroup: false,
                    ReplyTo: userKey,
                };
                if (account.useCallback && callbackUrl) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(createCallbackWaitResponse("잠시만 기다려주세요... 🤔")));
                    processAndSendCallback(ctxPayload, callbackUrl, cfg, account, runtime).catch((err) => {
                        console.error(`[kakao] Callback error: ${err}`);
                    });
                    return true;
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(createSimpleTextResponse(`받은 메시지: ${utterance}`)));
                return true;
            }
            catch (err) {
                console.error(`[kakao] Webhook error: ${err}`);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify(createSimpleTextResponse("오류가 발생했습니다.")));
                return true;
            }
        };
        api.registerHttpRoute({
            path: "/kakao/skill",
            auth: "plugin",
            handler: kakaoSkillHandler,
        });
        api.registerHttpRoute({
            path: "/webhook/start",
            auth: "plugin",
            handler: kakaoSkillHandler,
        });
    },
});
//# sourceMappingURL=index.js.map