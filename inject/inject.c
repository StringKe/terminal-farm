/**
 * QQFramBot inject dylib — 一次性注入器
 *
 * 被 LLDB dlopen 到 QQEXMiniProgram 主进程。
 * 通过 uv_async 在 V8 主线程执行 rpc_server.js（编译时嵌入）。
 *
 * 编译: make deploy
 */

#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>

#define LOG_PATH "/Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data/inject.log"

static void logmsg(const char *msg) {
    int fd = open(LOG_PATH, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd >= 0) { write(fd, msg, strlen(msg)); write(fd, "\n", 1); close(fd); }
}

/* V8 types */
typedef void *V8Isolate, *V8Local;
typedef V8Isolate (*fn_get_current)(void);
typedef V8Local   (*fn_get_context)(V8Isolate);
typedef void      (*fn_hs_ctor)(void *, V8Isolate);
typedef void      (*fn_hs_dtor)(void *);
typedef V8Local   (*fn_str_new)(V8Isolate, const char *, int, int);
typedef V8Local   (*fn_compile)(V8Local, V8Local, void *);
typedef V8Local   (*fn_run)(V8Local, V8Local);

/* libuv types */
typedef void *uv_loop_t;
typedef void (*uv_async_cb)(void *);
typedef int  (*fn_uv_async_init)(uv_loop_t, void *, uv_async_cb);
typedef int  (*fn_uv_async_send)(void *);
typedef void (*fn_uv_close)(void *, void *);
typedef void (*fn_uv_unref)(void *);
typedef uv_loop_t (*fn_uv_default_loop)(void);

static char g_async[128];
#define S(n) dlsym(RTLD_DEFAULT, n)

/*
 * JS_CODE: rpc_server.js 的内容，通过 Makefile 中 xxd 嵌入。
 * 声明为 extern，由链接器从 rpc_server_js.o 提供。
 * 如果编译时没有嵌入，使用 fallback 从文件读取。
 */
static const char *RPC_SERVER_PATH =
    "/Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data/rpc_server.js";

/**
 * 构建注入 JS：用 process.mainModule.require('vm').runInThisContext() 执行 rpc_server.js
 * 这样可以在有 require/process 的 Node context 中运行。
 */
static const char *BOOTSTRAP_JS =
    "(() => {"
    "  try {"
    "    if (global.__qqframbot_rpc__) return 'ALREADY_RUNNING';"
    "    var fs = process.mainModule.require('fs');"
    "    var vm = process.mainModule.require('vm');"
    "    var code = fs.readFileSync('%s', 'utf8');"
    "    vm.runInThisContext(code, { filename: 'rpc_server.js' });"
    "    return 'OK';"
    "  } catch(e) { return 'ERR:' + e.message; }"
    "})()";

static void on_main_thread(void *handle) {
    logmsg("[inject] callback fired");

    fn_get_current gi = S("_ZN2v87Isolate10GetCurrentEv");
    fn_get_context gc = S("_ZN2v87Isolate17GetCurrentContextEv");
    fn_hs_ctor     hc = S("_ZN2v811HandleScopeC1EPNS_7IsolateE");
    fn_hs_dtor     hd = S("_ZN2v811HandleScopeD1Ev");
    fn_str_new     sn = S("_ZN2v86String11NewFromUtf8EPNS_7IsolateEPKcNS_13NewStringTypeEi");
    fn_compile     cm = S("_ZN2v86Script7CompileENS_5LocalINS_7ContextEEENS1_INS_6StringEEEPNS_12ScriptOriginE");
    fn_run         rn = S("_ZN2v86Script3RunENS_5LocalINS_7ContextEEE");
    fn_uv_close    cl = S("uv_close");

    V8Isolate iso = gi ? gi() : NULL;
    if (!iso) { logmsg("[inject] no isolate"); goto done; }

    char js[2048];
    snprintf(js, sizeof(js), BOOTSTRAP_JS, RPC_SERVER_PATH);

    {
        char scope[64];
        hc(scope, iso);
        V8Local ctx = gc(iso);
        V8Local src = sn(iso, js, 0, -1);
        V8Local scr = cm(ctx, src, NULL);
        if (scr) {
            rn(scr, ctx);
            logmsg("[inject] rpc_server.js injected");
        } else {
            logmsg("[inject] compile failed");
        }
        hd(scope);
    }

done:
    if (cl) cl(handle, NULL);
}

__attribute__((constructor))
static void inject_entry(void) {
    logmsg("[inject] === dylib loaded ===");

    fn_uv_default_loop dl = S("uv_default_loop");
    fn_uv_async_init   ai = S("uv_async_init");
    fn_uv_async_send   as_ = S("uv_async_send");
    fn_uv_unref        ur = S("uv_unref");

    if (!dl || !ai || !as_) { logmsg("[inject] missing libuv"); return; }

    uv_loop_t loop = dl();
    ai(loop, g_async, on_main_thread);
    ur(g_async);
    as_(g_async);
    logmsg("[inject] async scheduled");
}
