/**
 * QQFramBot inject dylib — v3 with TryCatch + string extraction
 */

#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>

#define LOG_PATH "/Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data/inject.log"

static void logmsg(const char *msg) {
    int fd = open(LOG_PATH, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd >= 0) { write(fd, msg, strlen(msg)); write(fd, "\n", 1); close(fd); }
}

typedef void *V8Isolate;
typedef void *V8Local;

/* 函数指针类型 */
typedef V8Isolate (*fn_get_current)(void);
typedef V8Local   (*fn_get_context)(V8Isolate);
typedef void      (*fn_hs_ctor)(void *scope, V8Isolate);
typedef void      (*fn_hs_dtor)(void *scope);
typedef V8Local   (*fn_str_new)(V8Isolate, const char *, int, int);
typedef V8Local   (*fn_compile)(V8Local ctx, V8Local src, void *origin);
typedef V8Local   (*fn_run)(V8Local script, V8Local ctx);
typedef void      (*fn_tc_ctor)(void *tc, V8Isolate);
typedef void      (*fn_tc_dtor)(void *tc);
typedef int       (*fn_tc_hascaught)(void *tc);
typedef V8Local   (*fn_tc_exception)(void *tc);
typedef V8Local   (*fn_tc_message)(void *tc);
typedef V8Local   (*fn_val_tostring)(V8Local val, V8Local ctx);
typedef int       (*fn_str_utf8len)(V8Local str, V8Isolate);
typedef int       (*fn_str_writeutf8)(V8Local str, V8Isolate, char *, int, int *, int);

typedef void *uv_loop_t;
typedef void (*uv_async_cb)(void *);
typedef int  (*fn_uv_async_init)(uv_loop_t, void *, uv_async_cb);
typedef int  (*fn_uv_async_send)(void *);
typedef void (*fn_uv_close)(void *, void *);
typedef void (*fn_uv_unref)(void *);
typedef uv_loop_t (*fn_uv_default_loop)(void);

static char g_async[128];

#define RESOLVE(var, type, name) type var = (type)dlsym(RTLD_DEFAULT, name)

static const char *JS_CODE =
    "(() => {"
    "  try {"
    "    if (typeof window === 'undefined') return 'NODE_CTX';"
    "    var r = [];"
    "    /* invokeGameBindingEvent 的信息 */"
    "    r.push('invokeGBE=' + typeof invokeGameBindingEvent);"
    "    if (typeof invokeGameBindingEvent === 'function')"
    "      r.push('GBE_str=' + invokeGameBindingEvent.toString().substring(0, 200));"
    "    /* 搜索所有 game/cc/cocos/qq 相关全局 */"
    "    var all = Object.getOwnPropertyNames(window).filter(function(k) {"
    "      var l = k.toLowerCase();"
    "      return l.indexOf('game') >= 0 || l.indexOf('cocos') >= 0 || l === 'cc'"
    "        || l.indexOf('miniapp') >= 0 || l.indexOf('qq') >= 0"
    "        || l.indexOf('invoke') >= 0 || l.indexOf('callback') >= 0"
    "        || l.indexOf('bridge') >= 0 || l.indexOf('native') >= 0"
    "        || l.indexOf('jsbridge') >= 0 || l.indexOf('engine') >= 0;"
    "    });"
    "    r.push('gameGlobals=' + all.join(','));"
    "    /* subContext iframe 的所有全局 */"
    "    try {"
    "      var sub = window.frames[0];"
    "      if (sub) {"
    "        var subKeys = Object.getOwnPropertyNames(sub).filter(function(k) {"
    "          var l = k.toLowerCase();"
    "          return l.indexOf('game') >= 0 || l.indexOf('cc') >= 0 || l.indexOf('cocos') >= 0"
    "            || l.indexOf('engine') >= 0 || l.indexOf('invoke') >= 0;"
    "        });"
    "        r.push('subCtx_gameKeys=' + subKeys.join(','));"
    "      }"
    "    } catch(e) { r.push('subCtx_err=' + e.message); }"
    "    return r.join('\\n');"
    "  } catch(e) { return 'ERR:' + e.message; }"
    "})()";

/* 从 V8 String 提取 UTF-8 到 C 字符串 */
static void extract_v8_string(V8Local str, V8Isolate isolate, char *buf, int buflen) {
    RESOLVE(utf8len, fn_str_utf8len, "_ZNK2v86String10Utf8LengthEPNS_7IsolateE");
    RESOLVE(writeutf8, fn_str_writeutf8, "_ZNK2v86String9WriteUtf8EPNS_7IsolateEPciPii");

    if (!utf8len || !writeutf8 || !str) {
        snprintf(buf, buflen, "(null string)");
        return;
    }
    int len = utf8len(str, isolate);
    if (len >= buflen) len = buflen - 1;
    writeutf8(str, isolate, buf, len + 1, NULL, 0);
    buf[len] = '\0';
}

static void on_main_thread(void *handle) {
    char buf[1024];
    logmsg("[inject] callback fired");

    RESOLVE(get_isolate, fn_get_current, "_ZN2v87Isolate10GetCurrentEv");
    RESOLVE(get_context, fn_get_context, "_ZN2v87Isolate17GetCurrentContextEv");
    RESOLVE(hs_ctor,     fn_hs_ctor,     "_ZN2v811HandleScopeC1EPNS_7IsolateE");
    RESOLVE(hs_dtor,     fn_hs_dtor,     "_ZN2v811HandleScopeD1Ev");
    RESOLVE(str_new,     fn_str_new,     "_ZN2v86String11NewFromUtf8EPNS_7IsolateEPKcNS_13NewStringTypeEi");
    RESOLVE(compile,     fn_compile,     "_ZN2v86Script7CompileENS_5LocalINS_7ContextEEENS1_INS_6StringEEEPNS_12ScriptOriginE");
    RESOLVE(run,         fn_run,         "_ZN2v86Script3RunENS_5LocalINS_7ContextEEE");
    RESOLVE(tc_ctor,     fn_tc_ctor,     "_ZN2v88TryCatchC1EPNS_7IsolateE");
    RESOLVE(tc_dtor,     fn_tc_dtor,     "_ZN2v88TryCatchD1Ev");
    RESOLVE(tc_hascaught, fn_tc_hascaught, "_ZNK2v88TryCatch9HasCaughtEv");
    RESOLVE(tc_exception, fn_tc_exception, "_ZNK2v88TryCatch9ExceptionEv");
    RESOLVE(val_tostr,   fn_val_tostring, "_ZNK2v85Value8ToStringENS_5LocalINS_7ContextEEE");
    RESOLVE(uv_close,    fn_uv_close,    "uv_close");

    V8Isolate isolate = get_isolate();
    if (!isolate) { logmsg("[inject] no isolate"); goto done; }

    {
        char scope[64];
        hs_ctor(scope, isolate);

        /* TryCatch: 在 V8 源码中约 48 字节（6 pointers + flags），分配 128 安全 */
        char trycatch[128];
        tc_ctor(trycatch, isolate);

        V8Local context = get_context(isolate);
        V8Local source  = str_new(isolate, JS_CODE, 0, -1);
        V8Local script  = compile(context, source, NULL);

        if (!script) {
            logmsg("[inject] compile failed");
            if (tc_hascaught(trycatch)) {
                V8Local exc = tc_exception(trycatch);
                V8Local exc_str = val_tostr(exc, context);
                extract_v8_string(exc_str, isolate, buf, sizeof(buf));
                logmsg(buf);
            }
        } else {
            V8Local result = run(script, context);
            if (tc_hascaught(trycatch)) {
                logmsg("[inject] JS threw:");
                V8Local exc = tc_exception(trycatch);
                V8Local exc_str = val_tostr(exc, context);
                extract_v8_string(exc_str, isolate, buf, sizeof(buf));
                logmsg(buf);
            } else if (result) {
                V8Local result_str = val_tostr(result, context);
                extract_v8_string(result_str, isolate, buf, sizeof(buf));
                snprintf(buf + strlen(buf), sizeof(buf) - strlen(buf), " [result]");
                logmsg(buf);
            } else {
                logmsg("[inject] run returned null, no exception");
            }
        }

        tc_dtor(trycatch);
        hs_dtor(scope);
    }

done:
    if (uv_close) uv_close(handle, NULL);
}

__attribute__((constructor))
static void inject_entry(void) {
    logmsg("[inject] === dylib loaded (v3) ===");

    RESOLVE(def_loop,   fn_uv_default_loop, "uv_default_loop");
    RESOLVE(async_init, fn_uv_async_init,   "uv_async_init");
    RESOLVE(async_send, fn_uv_async_send,   "uv_async_send");
    RESOLVE(uv_unref,   fn_uv_unref,        "uv_unref");

    if (!def_loop || !async_init || !async_send) {
        logmsg("[inject] missing libuv symbols");
        return;
    }

    uv_loop_t loop = def_loop();
    async_init(loop, g_async, on_main_thread);
    uv_unref(g_async);
    async_send(g_async);
    logmsg("[inject] async scheduled");
}
