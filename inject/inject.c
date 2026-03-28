/**
 * QQFramBot inject dylib
 *
 * 被 LLDB dlopen 到 QQEXMiniProgram 进程中执行。
 * 通过 uv_async 在 V8 主线程安全地调用 require('inspector').open(9229)。
 *
 * 编译: make  (或 cc -shared -O2 -o inject.dylib inject.c)
 */

#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

/* ── V8 类型（全部视为不透明指针）── */
typedef void *V8Isolate;
typedef void *V8Local; /* v8::Local<T> 在 arm64 上就是 8 字节指针 */

/* ── V8 函数签名 ── */
typedef V8Isolate (*fn_get_current)(void);
typedef V8Local   (*fn_get_context)(V8Isolate);
typedef void      (*fn_hs_ctor)(void *scope, V8Isolate isolate);
typedef void      (*fn_hs_dtor)(void *scope);
typedef V8Local   (*fn_str_new)(V8Isolate, const char *, int type, int len);
typedef V8Local   (*fn_compile)(V8Local ctx, V8Local src, void *origin);
typedef V8Local   (*fn_run)(V8Local script, V8Local ctx);

/* ── libuv 类型 ── */
typedef void *uv_loop_t;
typedef void (*uv_async_cb)(void *handle);
typedef int  (*fn_uv_async_init)(uv_loop_t, void *, uv_async_cb);
typedef int  (*fn_uv_async_send)(void *);
typedef void (*fn_uv_close)(void *, void *);
typedef void (*fn_uv_unref)(void *);
typedef uv_loop_t (*fn_uv_default_loop)(void);

/* ── 全局 async handle（128 字节足够 uv_async_t）── */
static char g_async[128];

/* ── V8 符号的 mangled name ── */
#define SYM_ISOLATE_CURRENT  "_ZN2v87Isolate10GetCurrentEv"
#define SYM_ISOLATE_CONTEXT  "_ZN2v87Isolate17GetCurrentContextEv"
#define SYM_HANDLESCOPE_CTOR "_ZN2v811HandleScopeC1EPNS_7IsolateE"
#define SYM_HANDLESCOPE_DTOR "_ZN2v811HandleScopeD1Ev"
#define SYM_STRING_NEW       "_ZN2v86String11NewFromUtf8EPNS_7IsolateEPKcNS_13NewStringTypeEi"
#define SYM_SCRIPT_COMPILE   "_ZN2v86Script7CompileENS_5LocalINS_7ContextEEENS1_INS_6StringEEEPNS_12ScriptOriginE"
#define SYM_SCRIPT_RUN       "_ZN2v86Script3RunENS_5LocalINS_7ContextEEE"

static const char *JS_CODE =
    "try {"
    "  require('inspector').open(9229, '127.0.0.1', false);"
    "  'inspector opened on 9229';"
    "} catch(e) { e.message; }";

/**
 * uv_async 回调，在 V8 主线程执行。
 */
static void on_main_thread(void *handle) {
    fn_get_current get_isolate = (fn_get_current)dlsym(RTLD_DEFAULT, SYM_ISOLATE_CURRENT);
    fn_get_context get_context = (fn_get_context)dlsym(RTLD_DEFAULT, SYM_ISOLATE_CONTEXT);
    fn_hs_ctor     hs_ctor     = (fn_hs_ctor)dlsym(RTLD_DEFAULT, SYM_HANDLESCOPE_CTOR);
    fn_hs_dtor     hs_dtor     = (fn_hs_dtor)dlsym(RTLD_DEFAULT, SYM_HANDLESCOPE_DTOR);
    fn_str_new     str_new     = (fn_str_new)dlsym(RTLD_DEFAULT, SYM_STRING_NEW);
    fn_compile     compile     = (fn_compile)dlsym(RTLD_DEFAULT, SYM_SCRIPT_COMPILE);
    fn_run         run         = (fn_run)dlsym(RTLD_DEFAULT, SYM_SCRIPT_RUN);
    fn_uv_close    uv_close    = (fn_uv_close)dlsym(RTLD_DEFAULT, "uv_close");

    if (!get_isolate || !get_context || !hs_ctor || !hs_dtor ||
        !str_new || !compile || !run) {
        fprintf(stderr, "[inject] failed to resolve V8 symbols\n");
        goto cleanup;
    }

    V8Isolate isolate = get_isolate();
    if (!isolate) {
        fprintf(stderr, "[inject] no V8 isolate on this thread\n");
        goto cleanup;
    }

    /* HandleScope: 3 pointers = 24 bytes on arm64，分配 64 安全 */
    char scope[64];
    hs_ctor(scope, isolate);

    V8Local context = get_context(isolate);
    V8Local source  = str_new(isolate, JS_CODE, 0 /* kNormal */, -1);
    V8Local script  = compile(context, source, NULL);

    if (script) {
        run(script, context);
        fprintf(stderr, "[inject] inspector opened on port 9229\n");
    } else {
        fprintf(stderr, "[inject] script compile failed\n");
    }

    hs_dtor(scope);

cleanup:
    if (uv_close) uv_close(handle, NULL);
}

/**
 * dylib 构造函数，dlopen 时自动执行。
 */
__attribute__((constructor))
static void inject_entry(void) {
    fprintf(stderr, "[inject] dylib loaded, scheduling V8 callback...\n");

    fn_uv_default_loop def_loop   = (fn_uv_default_loop)dlsym(RTLD_DEFAULT, "uv_default_loop");
    fn_uv_async_init   async_init = (fn_uv_async_init)dlsym(RTLD_DEFAULT, "uv_async_init");
    fn_uv_async_send   async_send = (fn_uv_async_send)dlsym(RTLD_DEFAULT, "uv_async_send");
    fn_uv_unref        uv_unref   = (fn_uv_unref)dlsym(RTLD_DEFAULT, "uv_unref");

    if (!def_loop || !async_init || !async_send || !uv_unref) {
        fprintf(stderr, "[inject] failed to resolve libuv symbols\n");
        return;
    }

    uv_loop_t loop = def_loop();
    async_init(loop, g_async, on_main_thread);
    uv_unref(g_async);  /* 不阻止事件循环退出 */
    async_send(g_async);
}
