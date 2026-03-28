/**
 * QQFramBot Game Bridge
 *
 * 注入到 QQ 农场渲染进程的 JS 桥接层。
 * 通过 Cocos Creator API 操控游戏。
 *
 * 使用方式：通过 CDP webContents.executeJavaScript() 注入。
 */

(function () {
  'use strict';

  if (window.__qqframbot_bridge__) return;
  window.__qqframbot_bridge__ = true;

  const Bridge = {
    /**
     * 获取游戏场景信息
     */
    getSceneInfo() {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      const scene = cc.director.getScene();
      if (!scene) return { error: 'no scene' };
      return {
        name: scene.name,
        childCount: scene.children.length,
        children: scene.children.map((c) => ({
          name: c.name,
          active: c.active,
          childCount: c.children ? c.children.length : 0,
        })),
      };
    },

    /**
     * 递归遍历节点树
     */
    walkNodes(path, maxDepth) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      maxDepth = maxDepth || 3;
      const root = path ? cc.find(path) : cc.director.getScene();
      if (!root) return { error: 'node not found: ' + path };

      function walk(node, depth) {
        const info = {
          name: node.name,
          active: node.active,
          position: node.position ? { x: node.position.x, y: node.position.y } : null,
          components: [],
        };
        if (node._components) {
          info.components = node._components.map((c) => c.__classname__ || c.constructor.name);
        }
        if (depth < maxDepth && node.children) {
          info.children = node.children.map((c) => walk(c, depth + 1));
        }
        return info;
      }

      return walk(root, 0);
    },

    /**
     * 查找包含特定组件的节点
     */
    findByComponent(componentName) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      const scene = cc.director.getScene();
      const results = [];

      function search(node) {
        if (node._components) {
          for (const comp of node._components) {
            const name = comp.__classname__ || comp.constructor.name;
            if (name.includes(componentName)) {
              results.push({
                path: getNodePath(node),
                component: name,
                active: node.active,
              });
            }
          }
        }
        if (node.children) {
          node.children.forEach(search);
        }
      }

      function getNodePath(node) {
        const parts = [];
        let n = node;
        while (n && n !== scene) {
          parts.unshift(n.name);
          n = n.parent;
        }
        return parts.join('/');
      }

      search(scene);
      return results;
    },

    /**
     * 模拟触摸事件
     */
    simulateTouch(path, eventType) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      const node = cc.find(path);
      if (!node) return { error: 'node not found: ' + path };

      eventType = eventType || cc.Node.EventType.TOUCH_END;
      const touch = new cc.Touch(0, 0);
      const event = new cc.Event.EventTouch([touch], false, eventType);
      node.dispatchEvent(event);
      return { ok: true, path: path };
    },
  };

  window.__qqframbot__ = Bridge;
  console.log('[QQFramBot] game bridge loaded');
})();
