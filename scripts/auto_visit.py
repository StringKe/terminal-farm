#!/usr/bin/env python3
"""自动巡访好友农场：偷菜 + 帮浇水/除草/杀虫"""
import socket, struct, json, time, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 60024

def rpc(js, timeout=10):
    s = socket.socket()
    s.settimeout(timeout)
    s.connect(('127.0.0.1', PORT))
    req = json.dumps({'id': 1, 'js': js}).encode()
    s.send(struct.pack('>I', len(req)) + req)
    h = s.recv(4)
    l = struct.unpack('>I', h)[0]
    buf = b''
    while len(buf) < l:
        buf += s.recv(l - len(buf))
    s.close()
    r = json.loads(buf)
    if r.get('ok'):
        v = r['result']
        if isinstance(v, str):
            try: return json.loads(v)
            except: pass
        return v
    print(f"  RPC ERR: {r.get('error')}")
    return None

def inject_bridge():
    rpc("window.__qqframbot_bridge__ = false; window.__qqframbot__ = null; 'cleared'")
    code = open('scripts/game_bridge.js').read()
    r = rpc(code)
    print(f"bridge: {r}")

def get_friend_list():
    rpc("window.__qqframbot__.openFriendPanel()")
    time.sleep(2)
    return rpc("JSON.stringify(window.__qqframbot__.getFriendList())")

def visit(gid):
    return rpc(f"JSON.stringify(window.__qqframbot__.visitFriend({gid}))", timeout=15)

def do_actions():
    r = rpc("JSON.stringify(window.__qqframbot__.getActionableLands())")
    if not r:
        return {}
    results = {}
    if r.get('harvestable'):
        hr = rpc("JSON.stringify(window.__qqframbot__.harvestAll())")
        results['harvest'] = hr
        time.sleep(1)
    if r.get('waterable'):
        wr = rpc("JSON.stringify(window.__qqframbot__.waterAll())")
        results['water'] = wr
        time.sleep(1)
    if r.get('eraseGrass'):
        gr = rpc("JSON.stringify(window.__qqframbot__.eraseGrassAll())")
        results['eraseGrass'] = gr
        time.sleep(1)
    if r.get('killBug'):
        kr = rpc("JSON.stringify(window.__qqframbot__.killBugAll())")
        results['killBug'] = kr
        time.sleep(1)
    return results

def back():
    rpc("JSON.stringify(window.__qqframbot__.backToOwnFarm())")

# ── main ──

print("=== QQFramBot 自动巡访 ===\n")

inject_bridge()
friends = get_friend_list()
if not friends:
    print("获取好友列表失败")
    sys.exit(1)

# 筛选有操作价值的好友
targets = [f for f in friends if f.get('steal', 0) > 0 or f.get('dry', 0) > 0
           or f.get('weed', 0) > 0 or f.get('insect', 0) > 0]

print(f"好友总数: {len(friends)}, 可操作: {len(targets)}\n")

for i, f in enumerate(targets):
    name = f.get('remark') or f.get('name') or str(f['gid'])
    tags = []
    if f.get('steal', 0) > 0: tags.append(f"偷{f['steal']}")
    if f.get('dry', 0) > 0: tags.append(f"浇{f['dry']}")
    if f.get('weed', 0) > 0: tags.append(f"草{f['weed']}")
    if f.get('insect', 0) > 0: tags.append(f"虫{f['insect']}")

    print(f"[{i+1}/{len(targets)}] {name} ({' '.join(tags)})")

    # 如果不在好友面板，先打开
    if i > 0:
        rpc("window.__qqframbot__.openFriendPanel()")
        time.sleep(2)

    vr = visit(f['gid'])
    if not vr or vr.get('error'):
        print(f"  跳过: {vr}")
        time.sleep(1)
        continue

    time.sleep(3)  # 等待农场加载

    # 重新注入 bridge（新页面可能丢失）
    rpc("window.__qqframbot_bridge__ = false")
    rpc(open('scripts/game_bridge.js').read())

    results = do_actions()
    if results:
        for action, r in results.items():
            count = r.get('count', 0) if isinstance(r, dict) else 0
            print(f"  {action}: {count}")
    else:
        print("  无可操作")

    back()
    time.sleep(1)

print(f"\n=== 完成，巡访 {len(targets)} 个好友 ===")
